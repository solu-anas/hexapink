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

module.exports.read = (req, res) => {
  // get smartTableData from getSmartTableData middleware
  const { validSourceTables, skeletonLabels, smartTable } = res.locals.smartTableData;
  if (!(smartTable)) {
    return res.status(404).send("SmartTable not found in res.locals");
  }
  if (!(validSourceTables)) {
    return res.status(500).send("validSourceTableIds not found in res.locals");
  }
  if (!(skeletonLabels)) {
    return res.status(500).send("skeletonLabels not found in res.locals");
  }
  console.log("#### validSourceTables ####");
  console.log(validSourceTables);

  let outputTableIds = smartTable.metadata.sourceTableIds;
  console.log("#### outputTableIds ####");
  console.log(outputTableIds);

  outputTableIds.push(smartTable.metadata.skeletonTableId);
  Record.aggregate([
    { $match: { _id: { $exists: true } } },
    { $project: { "content": 1, "tableId": { $toString: "$metadata.tableId" } } },
    { $match: { "tableId": { $in: outputTableIds } } },
    { $skip: req.body.skip || 0 },
    { $limit: req.body.limit || 10 },
  ]).then((records) => {
    const smartRecords = records.map((r) => {
      // const validSourceTableIds = validSourceTables.map((t) => (t._id));
      const validSourceTable = validSourceTables.find((t) => (t._id === r.tableId));
      console.log("#### validSourceTable ####");
      console.log(validSourceTable);
      const recordEntries = Object.entries(r.content);
      const newRecord = recordEntries
        .map((recordEntry) => {
          const validLabel = validSourceTable.validLabels.find((l) => {
            return (l.labelId === recordEntry[0])
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
}

module.exports.oldListValidTables = (req, res) => {
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

module.exports.attach = (req, res) => {
  // get smartTableData from getSmartTableData middleware
  const { validSourceTables, skeletonLabels, smartTable } = res.locals.smartTableData;
  if (!(smartTable)) {
    return res.status(404).send("SmartTable not found in res.locals");
  }
  if (!(validSourceTables)) {
    return res.status(500).send("validSourceTableIds not found in res.locals");
  }
  if (!(skeletonLabels)) {
    return res.status(500).send("skeletonLabels not found in res.locals");
  }
  if (!(req.body.sourceTableIds)) {
    return res.status(400).send("Please provide sourceTableIds");
  }

  // Check validity
  const validSourceTableIds = validSourceTables.map((t) => t._id);
  if (!(req.body.sourceTableIds.every((t) => validSourceTableIds.includes(t)))) {
    return res.status(400).send("At least one of sourceTables is not valid");
  }

  // Filter Out Duplicate Source Tables and Duplicate Skeleton Table
  let isThereDuplicates = false;  
  const sourceTableIds = req.body.sourceTableIds.filter((id) => {
    if (smartTable.metadata.sourceTableIds.includes(id)) {
      isThereDuplicates = true;
      return false;
    }
    if (id === smartTable.metadata.skeletonTableId) {
      isThereDuplicates = true;
      return false;
    }
    return true;
  });

  if (isThereDuplicates) {
    return res.status(400).send('There is at least one duplicate Table.');
  }

  // attach new source tables to old source tables
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
};

module.exports.detach = (req, res) => {
  if (!(req.body.smartTableId)) {
    return res.status(400).send("Please provide a smartTableId");
  }
  if (!(req.body.sourceTableIds)) {
    return res.status(400).send("Please provide a sourceTableIds");
  }
  SmartTable.findById(req.body.smartTableId)
    .then((smartTable) => {
      if (!(smartTable)) {
        return res.status(404).send("SmartTable not found");
      }
      if (!(req.body.sourceTableIds.every((id) => smartTable.metadata.sourceTableIds.includes(id)))) {
        return res.status(400).send("At least one sourceTableId is invalid");
      }
      smartTable.metadata.sourceTableIds = smartTable.metadata.sourceTableIds.filter((id) => !(req.body.sourceTableIds.includes(id)));
      smartTable.save()
        .then((savedSmartTable) => {
          return res.json(savedSmartTable);
        })
        .catch((err) => {
          console.log(err)
          return res.status(500).send('Error updating SmartTable');
        })
    })
    .catch((err) => {
      console.log(err)
      return res.status(500).send('Error finding SmartTable');
    })
}

module.exports.getSmartTableData = (req, res, next) => {
  if (!(req.body.smartTableId)) {
    return res.status(400).send("Please provide a smartTableId")
  }
  SmartTable.findById(req.body.smartTableId)
    .then((smartTable) => {
      console.log("#### smartTable ####");
      console.log(smartTable);
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
          console.log("#### skeletonTable ####");
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
              console.log("#### skeletonLabels ####");
              console.log(skeletonLabels);
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
                console.log("#### validSourceTables ####");
                console.log(validSourceTables);
                res.locals.smartTableData = {
                  smartTable: smartTable,
                  validSourceTables: validSourceTables,
                  skeletonLabels: skeletonLabels,
                }
                next();
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

module.exports.getValidSourceTables = (req, res) => {
  const { validSourceTables } = res.locals.smartTableData;
  if (!validSourceTables) {
    return res.status(500).send("Error getting validSourceTables from res.locals")
  }
  return res.send(validSourceTables);
};

module.exports.rename = (req, res) => {
  SmartTable.findByIdAndUpdate(req.body.smartTableId, { "content.name": req.body.newSmartTableName })
    .then((smartTable) => {
      smartTable
        .save()
        .then((savedSmartTable) => {
          return res.send('Smart Table Name Updated Successfully.')
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
  SmartTable.findByIdAndUpdate(req.body.smartTableId, { "metadata.status": "in-trash" })
    .then((smartTable) => {
      smartTable
        .save()
        .then((savedSmartTable) => {
          return res.send('Smart Table Put in Trash Successfully.');
        })
        .catch((err) => {
          console.error('Error: ', err.message);
          return res.status(500).send('Something Went Wrong.')
        })
    })
    .catch((err) => {
      console.error('Error: ', err.message);
      return res.status(500).send('Something Went Wrong.');
    });
};