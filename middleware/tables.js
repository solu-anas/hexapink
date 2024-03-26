const { Table } = require("../models/Table");
const { Label } = require("../models/Label");
const { Record } = require("../models/Record");
const { checkAndCreateDir, upload } = require("../utils/fs");
const { insertTransform } = require("../utils/db");
const { toggleTrash } = require("../controllers/trash");
const { changeStatus } = require("../controllers/status");
const { pipeline } = require("stream");
const { join } = require("path");
const csv = require("csv-parser");
const formidable = require("formidable").formidable;
const fs = require("fs");

module.exports.convert = (req, res) => {
  const { tableId, escape, separator, quote, newline } = req.body;
  if (!tableId) {
    return res.status(400).send("Please provide a tableId");
  }
  // if (!separator) {
  //   return res.status(400).send("Please provide a separator");
  // }
  // if (!escape) {
  //   return res.status(400).send("Please provide a escape");
  // }
  // if (!quote) {
  //   return res.status(400).send("Please provide a quote");
  // }
  // if (!newline) {
  //   return res.status(400).send("Please provide a newline");
  // }

  Table
    .findById(tableId)
    .then((table) => {
      if (!table) {
        return res.status(404).send("Table Not Found");
      }

      else if (table.metadata.status !== "upload-complete") {
        return res.status(400).send("Bad Request");
      }

      // pipeline stages
      const reader = fs.createReadStream(join(__dirname, `../uploads/${table.metadata.uuid}.csv`));
      const parser = csv({
        mapHeaders: ({ header, index }) => {
          return index + "-" + header;
        },
        escape: escape || "\"",
        separator: separator || ",",
        quote: quote || "\"",
        newline: newline || "\n"
      });
      const inserter = insertTransform(table, ({ type, message }) => {
        switch (type) {
          case "error":
            console.log(message)
            return res.status(500).send(message);
          case "end":
            console.log(message);
            return res.json(message);

          default:
            break;
        }
      });

      // run pipeline
      pipeline(reader, parser, inserter, (err) => {
        if (err) {
          console.error("Pipeline failed.", err.message);
          return res.status(500).send(`Error inserting table`);
        }

        Table.findOneAndUpdate(table._id, {
          "metadata.status": "convert-complete",
        })
          .then((updatedTable) => {
            console.log("\nPipeline succeeded.");
          });
      });
    })
    .catch((err) => {
      console.error('Error: ', err.message);
      return res.status(500).send('Error finding table');
    })
    ;
};

module.exports.upload = (req, res) => {
  const totalSize = req.headers["content-length"];
  const form = formidable();

  form.on('fileBegin', (formName, file) => {
    const allowedFileExtensions = ['csv'];
    const allowedFileTypes = ['text/csv', "application/vnd.ms-excel"];
    const fileExtension = file.originalFilename.slice(((file.originalFilename.lastIndexOf('.') - 1) >>> 0) + 2);
    const fileTypeError = new Error('Invalid File Type, only .csv files are allowed.');

    if (!allowedFileExtensions.includes(fileExtension)) {
      form.emit('error', fileTypeError);
      return;
    }

    if (!allowedFileTypes.includes(file.mimetype)) {
      form.emit('error', fileTypeError);
      return;
    }
    console.log(`Formidable: Started Uploading: ${file.originalFilename}`);
  })

  // Parse the incoming form data
  form.parse(req, (err, fields, files) => {
    console.log("Formidable: Started Parsing");
    if (err) {
      return;
    }

    if (!Object.keys(files).length) {
      return res.status(400).send('Please attach a .csv file to the FormData.');
    }

    if (!files.file?.length) {
      return res.status(400).send('No file provided or empty file');
    }

    if (files.file.length !== 1) {
      return res.status(400).send('The Uploader can accept only One .csv file Per Upload.');
    }

    const encoding = fields.encoding[0];
    if (!encoding) {
      return res.status(400).send("Provide one of the following encodings" + validEncodings.join(", "));
    }

    const validEncodings = ["utf8", "utf-8", "utf16le", "utf-16le"];
    if (!validEncodings.includes(encoding)) {
      return res.status(400).send("Incorrect encoding. Provide one of the following encodings:\n" + validEncodings.join(", "))
    }

    const file = files.file[0];

    // creating table document
    const table = new Table({
      content: {
        tableName: fields.tableName[0] || file.originalFilename,
      },
      metadata: {
        originalFilename: file.originalFilename,
      },
    })

    table
      .save()
      .then((savedTable) => {
        const { uuid } = savedTable.metadata;
        // Check and Create /uploads directory
        checkAndCreateDir("./uploads", () => {
          // Get the file details

          const readPath = file.filepath;
          const writePath = "./uploads/" + uuid + ".csv";

          // Upload the file
          upload(encoding, readPath, writePath, totalSize, (response) => {
            switch (response.status) {
              case "start":
                Table.findOneAndUpdate(savedTable._id, {
                  "metadata.status": "upload-in-progress",
                });
                break;
              case "finish":
                process.stdout.cursorTo(0);
                process.stdout.clearLine();
                process.stdout.write("File Uploaded Successfully\n");
                Table.findOneAndUpdate(savedTable._id, {
                  "metadata.status": "upload-complete",
                }).then((updatedTable) => {
                  res.json({ tableId: updatedTable._id });
                });
                break;
              case "error":
                console.error("\nError: ", response.error);
                res.send("Error Writing File");
                break;
              default:
                break;
            }
          });
        });
      });
  })

  form.on("error", (err) => {
    console.log('Formidable: ' + err.message);
    return res.status(500).send('Upload Failed. Please Try Again.');
  });
}

module.exports.read = (req, res) => {
  if (!(req.query.tableId)) {
    return res.status(500).send("Please provide a tableId");
  };

  const tableId = req.query.tableId;
  const tablePipeline = [
    {
      $match: {
        $expr: {
          $eq: ["$_id", { $toObjectId: tableId }]
        },
        "metadata.status": {
          $in: ["convert-complete", "active"],
        },
      },
    }
  ];

  Table.aggregate(tablePipeline)
    .then((tableIds) => {
      if (!tableIds.length) {
        return res.status(400).send("Invalid or Non-Existent Table");
      }
      const foundTable = tableIds[0];
      Record
        .aggregate([
          {
            $match: { $expr: { $eq: ["$metadata.tableId", foundTable._id] } }
          },
          {
            $project: { content: 1, tableId: { $toString: "$metadata.tableId" } },
          },
          { $skip: req.body.skip || 0 },
          { $limit: req.body.limit || 10 },
        ])
        .then((records) => {
          console.log(records);
          return res.json(records);
        });
    })
    .catch((err) => {
      console.error("Error: ", err.message);
      return res.status(500).send("Error Finding table");
    });
};

module.exports.list = (req, res) => {

  if (!(req.query.statusList)) {
    return res.status(400).send("Please provide a statusList");
  }
  const statusList = JSON.parse(req.query.statusList);

  const validStatuses = [
    "created",
    "upload-in-progress",
    "convert-in-progress",
    "upload-complete",
    "convert-complete",
    "active",
  ];
  if (!(statusList.every(s => validStatuses.includes(s)))) {
    return res.status(400).send("At least on status is invalid");
  }

  const pipeline = [
    {
      $match: {
        "metadata.inTrash": false,
        "metadata.status": { $in: statusList },
      },
    },
    {
      $lookup:
      {
        from: "labels",
        localField: "metadata.labels",
        foreignField: "_id",
        as: "labels"
      }
    },
    {
      $project: {
        _id: 0,
        tableId: "$_id",
        labels: {
          $map: {
            input: "$labels",
            as: "label",
            in: {
              labelId: "$$label._id",
              labelName: "$$label.content.name",
              KeyId: "$$label.metadata.keyId"
            }
          }
        }
      }
    },

    { $limit: parseInt(req.query.limit) || 10 },
  ];

  Table.aggregate(pipeline)
    .then((tables) => {
      res.send(tables);
    })
    .catch((err) => {
      console.error("Error: ", err.message);
      res.status(500).send("Error listing tables");
    });
};

module.exports.getInfo = (req, res) => {
  if (!(req.query.tableId)) {
    return res.status(500).send("Please provide a tableId");
  }
  const tableId = req.query.tableId;
  Table.findById(tableId)
    .then((table) => {
      Label.aggregate([
        { $match: { _id: { $in: table.metadata.labels } } },
        {
          $lookup:
          {
            from: "keys",
            localField: "metadata.keyId",
            foreignField: "_id",
            as: "key"
          }
        },
        {
          $project: {
            content: 1,
            key: {
              $cond: {
                if: { $eq: [{ $size: "$key" }, 0] },
                then: [{}],
                else: "$key"
              }
            }
          }
        },
        { $unwind: "$key" },
        {
          $project: {
            labelId: "$_id", labelName: "$content.name", labelType: "$metadata.type", keyId: "$key._id", keyName: "$key.content.keyName"
          }
        },
        { $project: { key: 0, _id: 0 } },
      ])
        .then((labels) => {
          res.json({
            tableInfo: {
              tableId: table._id,
              tableName: table.content.tableName,
              schema: table.metadata.labels.map((l) => (
                labels.find((_l) => (_l.labelId.toHexString() === l.toHexString()))
              ))
            }
          });
        })
        .catch((err) => {
          console.error("Error: ", err.message);
          return res.status(500).send("Error finding labels");
        });
    })
    .catch((err) => {
      console.error("Error: ", err.message);
      return res.status(500).send("Error finding table");
    });
};

module.exports.rename = (req, res) => {
  if (!req.body.tableId) {
    return res.status(400).send('Please Provide tableId.');
  }

  if (!req.body.newTableName) {
    return res.status(400).send('Please Provide newTableName.');
  }

  Table.findByIdAndUpdate(req.body.tableId, { "content.tableName": req.body.newTableName })
    .then((table) => {
      table
        .save()
        .then((savedTable) => {
          return res.send('Table Name Updated Successfully.')
        })
        .catch((err) => {
          console.error('Error: ', err.message);
          return res.status(500).send("Something Went Wrong.");
        });
    })
    .catch((err) => {
      console.error('Error: ', err.message);
      return res.status(500).send('Something Went Wrong.')
    });
};

module.exports.restoreFromTrash = (req, res) => {
  if (!req.body.tableList) {
    return res.status(400).send('Please Provide tableList');
  }

  let finishedCheck = req.body.tableList.length;
  req.body.tableList.forEach((id) => {
    // check if the provided ids are valid
    Table.findById(id)
      .then((table) => {
        if (!table) {
          return res.status(400).send('At least one Id in tableList is not valid.');
        }

        if (!table.metadata.inTrash) {
          return res.status(400).send("You can't restore something that is not in trash.")
        }

        else if (table.metadata.inTrash) {
          Record.updateMany({ "metadata.tableId": table._id }, { "metadata.inTrash": false })
            .then(({ acknowledged }) => {
              if (!acknowledged) {
                return res.status(500).send('Something Went Wrong.');
              }
              table.metadata.inTrash = false;
              table
                .save()
                .then((savedTable) => {
                  if (!finishedCheck) {
                    finishedCheck--;
                    return;
                  }
                  return res.send('Restored Tables and their Records Successfully.')
                })
            })
            .catch((err) => {
              console.error('Error: ', err.message);
              return res.status(500).send('Something Went Wrong.');
            })
        }
      })
  });
};

module.exports.activate = (req, res) => {
  changeStatus(req, res, "convert-complete", "active");
};

module.exports.deactivate = (req, res) => {
  changeStatus(req, res, "active", "convert-complete");
};

module.exports.trash = (req, res) => {
  toggleTrash(res, "table", req.body.tableIds, true, () => {
    res.send('Table Put in Trash Successfully.');
  });
};

module.exports.restore = (req, res) => {
  toggleTrash(res, "table", req.body.tableIds, false, () => {
    res.send('Table Restored Successfully.');
  });
};

module.exports.order = (req, res) => {
  if (!req.body.tableId) {
    return res.status(400).send("Please provide tableId");
  }
  const tableId = req.body.tableId;

  if (!req.body.orderedLabels) {
    return res.status(400).send("Please provide orderedLabels");
  }
  const orderedLabels = req.body.orderedLabels;

  if (!(orderedLabels instanceof Array)) {
    return res.status(400).send("orderedLabels must be an Array");
  }
  Table.findById(tableId).then((table) => {
    if (!table) {
      return res.status(404).send("table not found");
    }
    if (!verifyOrderChange(table.metadata.labels.map((l) => l.toHexString()), orderedLabels)) {
      return res.status(400).send("invalid orderedLabels");
    }
    table.metadata.labels = orderedLabels;
    table.save().then((savedTable) => {
      return res.send(`Table ${savedTable._id} updated labels's order successfully`);

    }).catch((err) => {
      console.log(err.message);
      return res.status(500).send("Error saving table");
    })
  }).catch((err) => {
    console.log(err.message);
    return res.status(500).send("Error finding table");
  })

  // verifies if orderedLabels elements can replace old metadata.labels
  function verifyOrderChange(oldOrder, newOrder) {
    if (oldOrder.length - newOrder.length) {
      return false;
    }
    if (!(oldOrder.every((item) => newOrder.includes(item)))) {
      return false;
    }
    return true;
  }
};

module.exports.deleteTables = async (req, res) => {
  if (!req.body.tableIds) {
    return res.status(400).send('Please Provide tableIds');
  };

  if (!req.body.tableIds.length) {
    return res.status(400).send('tableIds can\'t be empty.');
  };

  const tableIds = req.body.tableIds;
  try {
    let check = 0;
    const pipeline = [];

    pipeline.push({ $match: { _id: { $exists: true } } });
    pipeline.push({ $project: { _id: { $toString: "$_id" }, metadata: 1 } });
    pipeline.push({ $match: { _id: { $in: tableIds } } });
    pipeline.push({ $project: { tableId: "$_id", inTrash: "$metadata.inTrash", _id: 0 } });
    const tables = await Table.aggregate([pipeline]);

    if (!tables?.length) {
      return res.status(500).send('At least one of the Ids is invalid.');
    };

    const allInTrash = tables.every((table) => table.inTrash === true);
    if (!allInTrash) {
      return res.status(500).send('Can\'t delete a table not yet in Trash.');
    }
    
    for (const table of tables) {
      const { acknowledged } = await Record.deleteMany({ "metadata.tableId": table.tableId });
      if (!acknowledged) {
        res.status(500).send('Something Went Wrong while deleting Records.');
        break;
      }
      else if (acknowledged) {
        const { deletedCount } = await Table.deleteOne({ _id: table.tableId });
        if (!deletedCount) {
          res.status(500).send('Something Went Wrong.');
          break;
        }
        else if (deletedCount) {
          if (check === (tableIds.length - 1)) {
            return res.send('Deleted Table(s) successfully.');
          }
          ++check;
        }
      }
    }
  } catch (err) {
    console.error(err.message);
    return res.status(500).send('Something Went Wrong.');
  }
};

module.exports.oauth = (req, res) => {
  // redirection to authorization server
  
};