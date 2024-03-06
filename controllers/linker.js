const { Table } = require("../models/table");
const { Label } = require("../models/label");
const { Key } = require("../models/key");
const { updateKey } = require("./keys");

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
          .catch(() => {
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
      cb({ type: "error", message: "label not found" });
    });
};
