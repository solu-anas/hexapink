/*{
// enter name for newly-created smartTable
  // list all existing keys
  // select keys that define the structure of smartTable
  // Enter names for labels
  // list all tables with labels belong to the set of chosen keys
  // select from where to fill the smartTable
  //   
  // render the smart Table
}*/

const { SmartTable } = require("../models/SmartTable");
const { Table } = require("../models/Table");
const { Label } = require("../models/Label");
const { Key } = require("../models/Key");

module.exports.listValidTables = (req, res) => {
  Key.aggregate([
    { $match: { _id: { $exists: true } } },
    { $project: { _id: 0, newId: { $toString: "$_id" } } },
    { $match: { newId: { $in: req.body.chosenKeys } } },
  ])
    .then((keys) => {
      // check if all elments in chosenKeys are valid
      const keyIds = keys.map((k) => k.newId);
      if (keys.length !== req.body.chosenKeys.length) {
        return res.status(400).send("You have at least one invalid key");
      }
      Label
        .aggregate([
          { $match: { _id: { $exists: true } } },
          {
            $project: {
              labelId: { $toString: "$_id" },
              keyId: { $toString: "$metadata.keyId" },
            },
          },
          { $match: { keyId: { $in: keyIds } } },
          { $project: { _id: 0, keyId: 0 } },
        ])
        .then((labels) => {
          Table
            .aggregate([
              { $match: { _id: { $exists: true } } },
              {
                $project: {
                  "metadata.labels": {
                    $map: {
                      input: "$metadata.labels",
                      as: "label",
                      in: { $toString: "$$label" },
                    },
                  },
                },
              },
              {
                $project: {
                  "metadata.labels": {
                    $filter: {
                      input: "$metadata.labels",
                      as: "label",
                      cond: {
                        $in: ["$$label", labels.map((l) => l.labelId)],
                      },
                    },
                  },
                },
              },
              {
                $match: {
                  $expr: {
                    $eq: [
                      { $size: "$metadata.labels" },
                      req.body.chosenKeys.length,
                    ],
                  },
                },
              },
              { $project: { _id: 1 } },
            ])
            .then((tables) => res.status(200).json(tables.map((t) => t._id)));
        });
    })
    .catch((err) => {
      console.error("Error: ", err.message);
      res.status(500).send("Error Keys lookup");
    });
};

module.exports.create = (req, res) => {
  if (!req.body.skeletonTableId) {
    return res.status(400).send('Please Provide skeletonTableId');
  }

  if (!req.body.smartTableName) {
    return res.status(400).send('Please Provide a Name to create a Smart Table');
  }
  Table.findById(req.body.skeletonTableId)
    .then((table) => {
      const newSmartTable = new SmartTable({
        content: {
          name: req.body.smartTableName
        },
        metadata: {
          skeletonTableId: table._id
        }
      });
      newSmartTable
        .save()
        .then((newSmartTable) => {
          res.json({ newSmartTableId: newSmartTable._id })
        })
        .catch((err) => {
          console.error("Error: ", err.message);
          return res.status(500).send("Error");
        })
    })
    .catch((err) => {
      console.error("Error: ", err.message);
      return res.status(404).send('Table Not Found.')
    })
}

module.exports.fill = (req, res) => {
  SmartTable.findById(req.body.smartTableId)
    .then((smartTable) => {
      Table.findById(smartTable.metadata.skeletonTableId)
        .then((skeletonTable) => {
          Label.aggregate([
            { $match: { _id: { $in: skeletonTable.metadata.labels } } },
            { $project: { "keyId": "$metadata.keyId" } }
          ])
            .then((skeletonKeyIds) => {
              Key.aggregate([
                {
                  $match:
                    { _id: { $in: skeletonKeyIds } }
                },
                {
                  $project: { _id: 0 }
                }
              ])
                .then((keys) => {
                  Label.aggregate([
                    {
                      $match: { "metadata.keyId": { $in: keys } }
                    },
                    {
                      $project: { "labelId": "$_id" }
                    }
                  ])
                    .then((labelIds) => {
                      Table.aggregate([
                        {
                          $match: { _id: { $exists: true } }
                        },
                        {
                          $project: {
                            "metadata.labels": {
                              $map: {
                                input: "$metadata.labels",
                                as: "label",
                                in: { $toString: "$$label" },
                              },
                            },
                          },
                        },
                        {
                          $project: {
                            "metadata.labels": {
                              $filter: {
                                input: "$metadata.labels",
                                as: "label",
                                cond: {
                                  $in: ["$$label", labelIds],
                                },
                              },
                            },
                          },
                        },
                      ])
                        .then((smartTableValidTables) => {
                          if (smartTableValidTables.length === req.body.sourceTableIds.length) {
                            smartTable.updateOne({ $set: { "metadata.sourceTables": req.body.sourceTableIds } });
                            smartTable
                              .save()
                              .then((saved) => {
                                console.log(saved);
                                return res.json({ updated: saved });
                              })
                              .catch((err) => {
                                console.error(`Error: ${err.message}`);
                                return res.send(`Error: ${err.message}`);
                              })
                          }
                        })
                        .catch((err) => {
                          return res.send(`Error: ${err.message}.`);S
                        })
                    })
                    .catch((err) => {
                      return res.send(`Error: ${err.message}.`);
                    })
                })
                .catch((err) => {
                  return res.send(`Error: ${err.message}.`);
                })
            })
            .catch((err) => {
              console.error('Error: ', err.message);
              return res.status(500).send('Error.')
            })
        })
        .catch((err) => {
          console.log("Error: ", err.message);
          return res.status(400).send('Something Went Wrong.')
        })
    })
    .catch((err) => {
      console.error('Error: ', err.message);
      return res.status(404).send('Smart Table Not Found.')
    })
};