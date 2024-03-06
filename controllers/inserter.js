const { Table } = require("../models/table");
const { Record } = require("../models/record");
const { Label } = require("../models/label");
const fs = require("fs");
const { Transform, pipeline } = require("stream");
const { join } = require("path");
const csv = require("csv-parser");

module.exports.insert = (req, res) => {
  Table.findOne({ "metadata.uuid": req.body.tableUUID }).then((table) => {
    if (!table) {
      return res.status(404).send("Table Not Found");
    } else if (table.metadata.status !== "upload-complete")
      return res.status(400).send("Bad Request");

    // pipeline stages
    const reader = fs.createReadStream(
      join(__dirname, `../uploads/${table.metadata.uuid}.csv`)
    );
    const parser = csv();
    const inserter = insertInDB(table._id);

    parser.once("data", (chunk) => {
      let labels = Object.keys(chunk);
      let labelIndex = 0;

      function pushLabel(label, table, cb) {
        const newLabel = new Label({
          content: {
            name: label,
          },
          metadata: {
            type: "undefined",
          },
        });
        newLabel.save().then((savedLabel) => {
          table.metadata.labels.push(savedLabel._id);
          table.save().then(cb);
        });
      }
      function pushLabelCallback(table) {
        if (labelIndex + 1 < labels.length ) {
          pushLabel(labelIndex++, table, pushLabelCallback);
        }
        else {
          res.json({tableUUID: table.metadata.uuid})
        }
      }
      pushLabel(labels[labelIndex], table, pushLabelCallback);
    });

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
  });
};

const insertInDB = function (tableId) {
  const transformerOpts = {
    async transform(chunk, enc, cb) {
      const newRecord = new Record({
        content: chunk,
        metadata: {
          tableId: tableId,
        },
      });
      newRecord.save().then(() => {
        cb();
      });
    },
    objectMode: true,
  };
  return new Transform(transformerOpts);
};

// select table
// check if table exists
// look up table in fs
// extract labels (header)
// per each label
// create label entry in db
// add label reference to table metadata, labels array
// extract records
// per each record
// create record entry in db
// add table reference to the record metadata
