const { Table } = require("../models/Table");
const { Label } = require("../models/Label");
const { Record } = require("../models/Record");
const { Key } = require("../models/Key");
const { checkAndCreateDir, upload } = require("../utils/fs");
const { insertTransform } = require("../utils/db");
const { updateKey } = require("./keys");
const { pipeline } = require("stream");
const { join } = require("path");
const csv = require("csv-parser");
const formidable = require("formidable").formidable;
const fs = require("fs");

module.exports.convert = (req, res) => {
  if (!(req.body.tableId)) {
    return res.status(400).send("Please provide a tableId");
  }
  Table.findById(req.body.tableId)
    .then((table) => {
      if (!table) return res.status(404).send("Table Not Found");
      else if (table.metadata.status !== "upload-complete") return res.status(400).send("Bad Request");

      // pipeline stages
      const reader = fs.createReadStream(join(__dirname, `../uploads/${table.metadata.uuid}.csv`));
      const parser = csv();

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
        }).then((updatedTable) => {
          console.log("Pipeline succeeded.");
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
    const file = files.file[0];

    const originalFilename = file.originalFilename;

    const table = new Table({
      content: {
        tableName: req.body.tableName || originalFilename,
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
  const tablePipeline = [
    {
      $match: {
        $expr: {
          $eq: ["$_id", { $toObjectId: req.body.tableId }]
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
  if (!(req.body.statusList)) {
    return res.status(400).send("Please provide a statusList");
  }
  const pipeline = [
    {
      $match: {
        _id: { $exists: true },
        "metadata.status": { $in: req.body.statusList },
      },
    },
    { $limit: req.body.limit || 10 },
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
  if (!(req.body.tableId)) {
    return res.status(500).send("Please provide a tableId");
  }
  Table.findById(req.body.tableId)
    .then((table) => {
      Label.aggregate([{ $match: { _id: { $in: table.metadata.labels } } }])
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

module.exports.trash = (req, res) => {
  Table.findByIdAndUpdate(req.body.tableId, { "metadata.status": "in-trash" })
    .then((table) => {
      table
        .save()
        .then((savedTable) => {
          return res.send('Table is in Trash.')
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