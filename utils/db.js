const { Transform } = require('stream');
const { Record } = require('../models/Record');
const { Label } = require('../models/Label');

module.exports.insertTransform = (table, insertTransformCallback) => {
  let chunkIndex = 0;
  const transformerOpts = {
    async transform(chunk, enc, cb) {

      // set labels
      if (!chunkIndex) {
        setLabels(chunk, table, (callbackResponse) => {
          insertRecord(chunk, table, (err) => {
            if (err) {
              console.log("Error:", err);
              insertTransformCallback({ type: "error", message: err.message });
              return;
            }
            chunkIndex++;
            insertTransformCallback(callbackResponse);
            cb();
          });
        });
      } else {
        // insert record
        insertRecord(chunk, table, (err) => {
          if (err) {
            console.log("Error:", err);
            // insertTransformCallback({type: "error", message: err.message});
            return;
          }
          chunkIndex++;
          cb();
        });
      }
    },
    objectMode: true,
  };
  return new Transform(transformerOpts);
};

const insertRecord = (chunk, table, cb) => {
  const chunkEntries = Object.entries(chunk);
  console.log("chunk", chunk);
  console.log("chunk entries", chunkEntries);

  if (!chunkEntries.length) {
    return cb({ message: "empty chunk" });
    // return res.status(500).send("empty chunk");
  }
  const newRecordContent = table.metadata.labels
    .map((l) => (l.toHexString()))
    .reduce((contentObject, label, index) => {
      return { ...contentObject, [label]: chunkEntries[index][1] }
    }, {})
  const newRecord = new Record({
    content: newRecordContent,
    metadata: {
      tableId: table._id,
    },
  });
  newRecord.save().then(() => cb(null));
}

const setLabels = (chunk, table, setLabelsCallBack) => {
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
            console.log(err.message);
            setLabelsCallBack({ type: "error", message: "Error updating table labels" });
          });
      })

      .catch((err) => {
        console.log(err.message);
        setLabelsCallBack({ type: "error", message: "Error creating labels" });
      });
  }

  const pushLabelCb = (table) => {
    if (labelIndex < labels.length - 1)
      pushLabel(labels[++labelIndex], table, pushLabelCb);
    else {
      setLabelsCallBack({ type: "end", message: { tableId: table._id } });
    }
  };

  pushLabel(labels[labelIndex], table, pushLabelCb);
};