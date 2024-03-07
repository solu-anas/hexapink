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

module.exports.link = (req, res) => {
  // find label
  Label.findById(req.body.labelId)
    .then((label) => {
      // check if req.body.oldKeyId is set
      if (req.body.oldKeyId) {
        // check if the provided id is valid
        Key.findById(req.body.oldKeyId)
          .then((key) => {
            // check if key._id is unique amongst sibling labels (labels of the same table)
            if (!req.body.tableId) {
              return res.status(400).send('Please provide a tableId.')
            }
            Table.findById(req.body.tableId)
              .then((table) => {
                const foundLabel = table.metadata.labels.find((l) =>
                  label._id.equals(l)
                );
                console.log(foundLabel);
                if (!foundLabel) {
                  res.status(404).send("label not found in table");
                } else {
                  Label.aggregate([
                    { $match: { "metadata.keyId": key._id } },
                    { $project: { newId: { $toString: "$_id" } } },
                    {
                      $match: {
                        newId: {
                          $in: table.metadata.labels.map((l) =>
                            l.toHexString()
                          ),
                        },
                      },
                    },
                  ])
                    .then((matchingLabels) => {
                      // then reassign newKeyId
                      if (!matchingLabels.length) {
                        updateKey(label, key._id, updateCallBack);
                      } else {
                        res
                          .status(400)
                          .send("can't link to sibling labels to the same key");
                      }
                    })
                    .catch((err) => {
                      console.log(err.message);
                      res.status(500).send("error checking sibling labels");
                    });
                }
              })
              .catch(() => {
                res.status(404).send("table not found");
              });
          })
          .catch(() => {
            res.status(404).send("there is no key with the provided id");
          });
      }
      // check if req.body.newKeyName is set
      else if (req.body.newKeyName) {
        // create new key and get its id
        // then reassign newKeyId
        const newKey = new Key({
          content: {
            keyName: req.body.newKeyName,
          },
        });
        newKey
          .save()
          .then((key) => {
            updateKey(label, key._id, updateCallBack);
          })
          .catch((err) => {
            console.log(err.message);
            res.status(500).send("error saving new key");
          });
      }
      function updateCallBack({ type, message }) {
        switch (type) {
          case "error":
            res.status(400).send(message);
            break;
          case "success":
            res.status(200).send(message);
            break;

          default:
            res.status(500).send(message);
            break;
        }
      }
    })
    .catch((err) => {
      console.log(err.message);
      res.status(500).send("error finding label");
      // cb({ type: "error", message: "label not found" });
    });
};

module.exports.insert = (req, res) => {
  Table.findOne({ "metadata.uuid": req.body.tableUUID })
    .then((table) => {
      if (!table) return res.status(404).send("Table Not Found");
      else if (table.metadata.status !== "upload-complete") return res.status(400).send("Bad Request");

      // pipeline stages
      const reader = fs.createReadStream(join(__dirname, `../uploads/${table.metadata.uuid}.csv`));
      const parser = csv();
      const inserter = insertTransform(table._id);

      // run pipeline
      pipeline(reader, parser, inserter, (err) => {
        if (err) {
          console.error("Pipeline failed.", err);
          res.send(`Error: ${err.message}`);
        } else {
          Table.findOneAndUpdate(table._id, {
            "metadata.status": "insert-complete",
          }).then((updatedTable) => {
            console.log("Pipeline succeeded.");
          });
        }
      });

      parser.once("data", (chunk) => {
        let labels = Object.keys(chunk);
        let labelIndex = 0;

        const pushLabel = (label, table, cb) => {
          const newLabel = new Label({
            content: {
              name: label,
            },
            metadata: {
              type: "undefined",
            },
          });
          newLabel.save()
            .then((savedLabel) => {
              table.metadata.labels.push(savedLabel._id);
              table
                .save()
                .then(cb)
                .catch((err) => {
                  console.error("Error: ", err.message);
                  return res.status(500).send("Error");
                })
                ;
            })

            .catch((err) => {
              console.error("Error: ", err.message);
              return res.status(500).send('Error');
            });
        }

        const pushLabelCb = (table) => {
          if (labelIndex < labels.length - 1)
            pushLabel(labels[++labelIndex], table, pushLabelCb);
          else {
            return res.json({ tableId: table._id });
          }
        }
        pushLabel(labels[labelIndex], table, pushLabelCb);

      });

    })
    .catch((err) => {
      console.error('Error: ', err.message);
      return res.status(500).send('Error');
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
        title: originalFilename,
      },
      metadata: {
        originalFilename: originalFilename,
      },
    });

    table.save().then((savedTable) => {
      const { uuid } = savedTable.metadata;
      // Check and Create /uploads directory
      checkAndCreateDir("./uploads", () => {
        // Get the file details

        let readPath = file.filepath;
        let writePath = "./uploads/" + uuid + ".csv";

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
                res.json({ tableUUID: updatedTable.metadata.uuid });
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
          $in: ["insert-complete", "active"],
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
          { $limit: req.body.limit || 10 }
        ])
        .then((records) => {
          console.log(records);
          return res.json(records);
        });
    })
    .catch((err) => {
      console.error("Error: ", err.message);
      return res.send("Error");
    });
};

module.exports.list = (req, res) => {
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
      res.status(500).send("Error");
    });
};

module.exports.getSchema = (req, res) => {
  Table.findOne({ "metadata.uuid": req.body.tableUUID })
    .then((table) => {
      Label.aggregate([{ $match: { _id: { $in: table.metadata.labels } } }])
        .then((labels) => {
          res.send(labels);
        })
        .catch((err) => {
          console.error("Error: ", err.message);
          return res.status(500).send("Error");
        });
    })
    .catch((err) => {
      console.error("Error: ", err.message);
      return res.status(500).send("Error");
    });
};
