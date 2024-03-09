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
const { Record } = require("../models/Record");

module.exports.list = (req, res) => {
  SmartTable.aggregate([{ $limit: req.body.limit || 10 }])
    .then((smartTables) => {
      res.json(smartTables)
    })
    .catch((err) => {
      console.log(err);
      res.status(500).send("Error finding smartTables");
    })
}

module.exports.listValidTables = (req, res) => {
  if (!req.body.chosenKeys) {
    return res.status(400).send("Please specify smartTableId");
  }
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
  console.log("#### /api/smart-tables/fill ####")
  if (!(req.body.smartTableId)) {
    return res.status(400).send("Please provide a smartTableId");
  }
  if (!(req.body.sourceTableIds)) {
    return res.status(400).send("Please provide sourceTableIds");
  }
  SmartTable.findById(req.body.smartTableId)
    .then((smartTable) => {
      console.log("#### smartTTable ####")
      console.log(smartTable);
      Table.findById(smartTable.metadata.skeletonTableId)
        .then((skeletonTable) => {
          console.log("#### skeletonTable ####")
          console.log(skeletonTable);
          Label.aggregate([
            { $match: { _id: { $in: skeletonTable.metadata.labels }, "metadata.keyId": { $exists: true } } },
            { $project: { "keyId": "$metadata.keyId" } },
          ])
            .then((skeletonLabels) => {
              console.log("#### skeletonLabels ####")
              console.log(skeletonLabels);
              Key.aggregate([
                {
                  $match:
                    { _id: { $exists: true } }
                },
                {
                  $project: { "keyId": { $toString: "$_id" } }
                },
                {
                  $match:
                  {
                    "keyId": { $in: skeletonLabels.map((l) => (l.keyId.toHexString())) },
                  }
                },
                {
                  $project: { _id: 0 }
                }
              ])
                .then((skeletonKeyIds) => {
                  console.log("#### skeletonKeyIds ####")
                  console.log(skeletonKeyIds);
                  Label.aggregate([
                    { $match: { _id: { $exists: true } } },
                    {
                      $project: { _id: 0, "labelId": { $toString: "$_id" }, "keyId": { $toString: "$metadata.keyId" } }
                    },
                    {
                      $match: { "keyId": { $in: skeletonKeyIds.map((k) => (k.keyId)) } }
                    },
                  ])
                    .then((labelIds) => {
                      console.log("#### labelIds ####")
                      console.log(labelIds);
                      Table.aggregate([
                        {
                          $match: { _id: { $exists: true } }
                        },
                        {
                          $project: {
                            "tableId": { $toString: "$_id" },
                            "stringLabels": {
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
                            _id: 0,
                            "tableId": 1,
                            "labels": {
                              $filter: {
                                input: "$stringLabels",
                                as: "label",
                                cond: {
                                  $in: ["$$label", labelIds.map((l) => (l.labelId))],
                                },
                              },
                            },
                          },
                        },
                        { $match: { "tableId": { $in: req.body.sourceTableIds } } }
                      ])
                        .then((smartTableValidTables) => {
                          console.log("#### smartTableValidTables ####")
                          console.log(smartTableValidTables);
                          if (smartTableValidTables.length === req.body.sourceTableIds.length) {
                            const sourceTableIds = req.body.sourceTableIds.filter((id) => !(smartTable.metadata.sourceTableIds.includes(id)))
                            smartTable.metadata.sourceTableIds = [...(smartTable.metadata.sourceTableIds)].concat(sourceTableIds);
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
                          } else {
                            res.status(400).send("At leat one of sourceTables is not valid");
                          }
                        })
                        .catch((err) => {
                          return res.send(`Error: ${err.message}.`); S
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

module.exports.read = (req, res) => {
  SmartTable.findById(req.body.smartTableId)
    .then((smartTable) => {
      if (!smartTable.metadata.skeletonTableId) {
        console.error(`Error: ${err.message}`);
        return res.status(400).send('no skeleton table');
      }
      if (!smartTable.metadata.sourceTableIds) {
        console.error(`Error: ${err.message}`);
        return res.status(400).send('no source tables');
      }
      Table.findById(smartTable.metadata.skeletonTableId)
        .then((skeletonTable) => {
          console.log(skeletonTable);
          Label.aggregate([
            { $match: { _id: { $exists: true } } },
            {
              $project: {
                "keyId": "$metadata.keyId",
                labelId: { $toString: "$_id" },
                metadata: 1
              }
            },
            {
              $lookup:
              {
                from: "keys",
                localField: "metadata.keyId",
                foreignField: "_id",
                as: "key"
              }
            },
            { $unwind: "$key" },
            {
              $project: {
                "keyName": "$key.content.keyName",
                keyId: { $toString: "$keyId" },
                labelId: { $toString: "$labelId" },
              }
            },
            {
              $project: {
                _id: 0,
              }
            },
            { $match: { labelId: { $in: skeletonTable.metadata.labels.map((l) => (l.toHexString())) } } },
            { $match: { "keyId": { $exists: true } } },
          ])
            .then((skeletonLabels) => {
              const skeletonKeyIds = skeletonLabels.map((l) => (l.keyId));
              Table.aggregate([
                { $match: { _id: { $exists: true } } },
                {
                  $lookup:
                  {
                    from: "labels",
                    localField: "metadata.labels",
                    foreignField: "_id",
                    as: "validLabels"
                  }
                },
                {
                  $project: {
                    "validLabels": {
                      $filter: {
                        input: "$validLabels",
                        as: "label",
                        cond: {
                          $in: [{ $toString: "$$label.metadata.keyId" }, skeletonKeyIds],
                        },
                      },
                    },
                  },
                },
                {
                  $project: {
                    _id: { $toString: "$_id" },
                    "validLabels": {
                      $map: {
                        input: "$validLabels",
                        as: "label",
                        in: {
                          labelName: "$$label.content.name",
                          labelId: { $toString: "$$label._id" },
                          keyId: { $toString: "$$label.metadata.keyId" },
                        },
                      },
                    },
                  },
                },
                {
                  $match: {
                    $expr: {
                      $eq: [{ $size: "$validLabels" }, skeletonKeyIds.length]
                    }
                  }
                }
              ]).then((validSourceTables) => {
                // return res.status(200).json(validSourceTables);
                // #########################
                // read Records starts here
                // #########################
                const validSourceTableIds = validSourceTables.map((t) => (t._id));
                let outputTabelIds = smartTable.metadata.sourceTableIds;
                outputTabelIds.push(smartTable.metadata.skeletonTableId);
                Record.aggregate([
                  { $match: { _id: { $exists: true } } },
                  { $project: { "content": 1, "tableId": { $toString: "$metadata.tableId" } } },
                  // { $match: { "tableId": { $in: validSourceTableIds } } },
                  { $match: { "tableId": { $in: outputTabelIds } } },
                  { $skip: req.body.skip || 0 },
                  { $limit: req.body.limit || 10 },
                ]).then((records) => {
                  const smartRecords = records.map((r) => {
                    const validSourceTable = validSourceTables.find((t) => (t._id === r.tableId));
                    const recordEntries = Object.entries(r.content);
                    const newRecord = recordEntries
                      .map((recordEntry) => {
                        const validLabel = validSourceTable.validLabels.find((l) => {
                          return (l.labelName === recordEntry[0])
                        });
                        if (!validLabel) {
                          return null;
                        }
                        return {
                          ...validLabel,
                          value: recordEntry[1],
                          keyName: skeletonLabels.find((l) => (l.keyId === validLabel.keyId)).keyName
                        };
                      }).filter((r) => r);
                    return newRecord;
                  })
                  return res.status(200).json(
                    smartRecords.map((sr) => (
                      sr.reduce((result, labelObject) => ({ ...result, [labelObject.keyName]: labelObject.value }), {})
                    ))
                  )
                }).catch((err) => {
                  console.log(err)
                  return res.status(500).send('Error finding valid records');
                })
              }).catch((err) => {
                console.log(err)
                return res.status(500).send('Error finding valid tables');
              })
            })
            .catch((err) => {
              console.log(err)
              return res.status(500).send('Error finding skeletonTable Labels');
            })
        })
        .catch((err) => {
          console.log(err)
          return res.status(500).send('Error finding skeletonTable');
        })
    })
    .catch((err) => {
      console.error(`Error: ${err.message}`);
      return res.status(404).send('Smart Table Not Found');
    })
};