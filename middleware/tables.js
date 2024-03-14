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
  if (!(req.body.tableId)) {
    return res.status(400).send("Please provide a tableId");
  }

  Table
    .findById(req.body.tableId)
    .then((table) => {
      if (!table) {
        return res.status(404).send("Table Not Found");
      }

      else if (table.metadata.status !== "upload-complete") {
        return res.status(400).send("Bad Request");
      }

      // pipeline stages
      const reader = fs.createReadStream(join(__dirname, `../uploads/${table.metadata.uuid}.csv`));
      const headers = [];
      const parser = csv({
        mapHeaders: ({ header, index }) => {
          return index + "-" + header;
        }
      });
      parser.once("data", (data) => {
        console.log(data);
      })
      const inserter = insertTransform(table, ({ type, message }) => {
        switch (type) {
          case "error":
            return res.status(500).send(message);
          case "end":
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
  const form = formidable({});

  form.on("fileBegin", (filename, file) => {
    console.log("\nfile upload started", filename);
  });

  form.on("error", (err) => {
    console.error("Error: ", err.message);
    res.send("Error Uploading File");
  });

  // Parse the incoming form data
  form.parse(req, (err, fields, files) => {
    // Handle errors
    // Then Send immediate response to the client
    if (err) {
      res.send("error uploading file");
      console.log("\nerror uploading file", err);
      return;
    }

    if (!Object.keys(files).length) {
      return res.status(400).send('Please attach a .csv file to the FormData.');
    }

    if (files.file.length !== 1) {
      return res.status(400).send('The Uploader can accept only One .csv file Per Upload.');
    }

    const file = files.file[0];
    const originalFilename = file.originalFilename;
    const table = new Table({
      content: {
        tableName: fields.tableName[0] || originalFilename,
      },
      metadata: {
        originalFilename: originalFilename,
      },
    });

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
          upload(readPath, writePath, totalSize, (response) => {
            switch (response.status) {
              case "start":
                Table.findOneAndUpdate(savedTable._id, {
                  "metadata.status": "upload-in-progress",
                });
                break;
              case "finish":
                process.stdout.cursorTo(0);
                process.stdout.clearLine();
                process.stdout.write("File Uploaded Successfully");
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
  });
};

module.exports.read = (req, res) => {
  if (!(req.query.tableId)) {
    return res.status(500).send("Please provide a tableId");
  }
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

  if (req.query.statusList.includes("in-trash")) {
    return res.status(400).send('Cannot List Tables that have an "in-trash" status');
  }

  const pipeline = [
    {
      $match: {
        _id: { $exists: true },
        "metadata.status": { $in: JSON.parse(req.query.statusList) },
      },
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

module.exports.getSchema = (req, res) => {
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
          res.send(labels);
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
  toggleTrash(req, res, true, () => {
    res.send('Table Put in Trash Successfully.');
  });
};

module.exports.restore = (req, res) => {
  toggleTrash(req, res, false, () => {
    res.send('Table Restored Successfully.');
  });
};