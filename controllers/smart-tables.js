const { SmartTable } = require("../models/SmartTable");
const { Table } = require("../models/Table");
const { Label } = require("../models/Label");
const { Key } = require("../models/Key");
const { Record } = require("../models/Record");
const { toggleTrash } = require("./trash");

module.exports.list = (req, res) => {
  if (!req.query.statusList) {
    return res.status(400).send('Please Provide statusList.');
  }

  if (req.query.statusList.includes("in-trash")) {
    return res.status(400).send('Cannot List Tables that have an "in-trash" status.');
  }

  SmartTable.aggregate([{ $limit: parseInt(req.query.limit) || 10 }])
    .then((smartTables) => {
      return res.json(smartTables)
    })
    .catch((err) => {
      console.log(err);
      return res.status(500).send("Error finding smartTables");
    })
}

module.exports.read = (req, res) => {
  // get smartTableData from getSmartTableData middleware
  const { validSourceTables, smartTable, data } = res.locals.smartTableData;
  if (!(smartTable)) {
    return res.status(404).send("SmartTable not found in res.locals");
  };
  if (!(validSourceTables)) {
    return res.status(500).send("validSourceTableIds not found in res.locals");
  };

  let outputTableIds = smartTable.metadata.sourceTableIds;

  Record.aggregate([
    { $match: { _id: { $exists: true } } },
    { $project: { "content": 1, "tableId": { $toString: "$metadata.tableId" } } },
    { $match: { "tableId": { $in: outputTableIds } } },
    { $skip: req.body.skip || 0 },
    { $limit: req.body.limit || 10 },
  ])
    .then((records) => {
      console.log("aha", records);
      const smartRecords = records.map((r) => {
        const validSourceTable = validSourceTables.find((t) => (t.tableId === r.tableId));
        const recordEntries = Object.entries(r.content);
        const newRecord = recordEntries
          .map((recordEntry) => {
            const validLabel = validSourceTable.validLabels.find((l) => (l.labelId === recordEntry[0]));
            if (!validLabel) {
              return null;
            }
            console.log(data.keys);
            return {
              ...validLabel,
              value: recordEntry[1],
              keyName: data.keys.find((k) => (k.keyId === validLabel.keyId)).keyName
            }
          })
          .filter((r) => r);

        return {
          record: newRecord,
          tableId: r.tableId
        };
      })
      console.log('####smartRecords\n', smartRecords);

      return res.status(200).json(
        smartRecords.map((sr) => (
          {
            ...sr,
            record: sr.record.reduce((result, labelObject) => ({ ...result, [labelObject.keyName]: labelObject.value }), {})
          }
        ))
      )
    }).catch((err) => {
      console.log(err)
      return res.status(500).send('Error finding valid records');
    })
}

module.exports.create = (req, res) => {
  if (!req.body.keysList) {
    return res.status(400).send('Please Provide keysList');
  }
  if (!req.body.keysList.length) {
    return res.status(400).send('keysList can\'t be empty');
  }
  if (!req.body.smartTableName) {
    return res.status(400).send('Please Provide a Name to create a Smart Table');
  }
  Key.aggregate([
    { $match: { $expr: { $ne: ["$metadata.inTrash", true] } } },
    { $project: { "keyId": { $toString: "$_id" } } },
    { $match: { "keyId": { $in: req.body.keysList } } }
  ])
    .then((keys) => {
      console.log(keys.length, req.body.keysList.length);
      if (keys.length - req.body.keysList.length) {
        return res.status(400).send('At least one key in keysList is invalid');
      }
      const newSmartTable = new SmartTable({
        content: {
          name: req.body.smartTableName
        },
        metadata: {
          keysList: req.body.keysList
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
  const { validSourceTables, smartTable } = res.locals.smartTableData;
  if (!(smartTable)) {
    return res.status(404).send("smartTable not found in res.locals");
  };

  if (!(validSourceTables)) {
    return res.status(500).send("validSourceTableIds not found in res.locals");
  };

  if (!(req.body.sourceTableIds)) {
    return res.status(400).send("Please provide sourceTableIds");
  };

  // Check validity
  const validSourceTableIds = validSourceTables.map((t) => t.tableId);
  console.log(validSourceTableIds);
  if (!(req.body.sourceTableIds.every((t) => validSourceTableIds.includes(t)))) {
    return res.status(400).send("At least one of sourceTables is not valid");
  }

  // Filter Out Duplicate Source Tables and Duplicate Skeleton Table
  let isThereDuplicates = false;
  const sourceTableIds = req.body.sourceTableIds.filter((id) => {
    if (smartTable.metadata.sourceTableIds.includes(id)) {
      isThereDuplicates = true;
      return false;
    };
    return true;
  });

  if (isThereDuplicates) {
    return res.status(400).send('There is at least one duplicate Table.');
  };

  // attach new source tables to old source tables
  smartTable.metadata.sourceTableIds = [...(smartTable.metadata.sourceTableIds)].concat(sourceTableIds);

  smartTable
    .save()
    .then((saved) => {
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

      if (!smartTable.metadata.sourceTableIds.length) {
        smartTable.metadata.status = "empty";
      }

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

module.exports.rename = (req, res) => {
  if (!req.query.smartTableId) {
    return res.status(400).send('Please Provide smartTableId.');
  }

  if (!req.body.newSmartTableName) {
    return res.status(400).send('Please Provide newSmartTableName.');
  }

  SmartTable.findByIdAndUpdate(req.body.smartTableId, { "content.name": req.body.newSmartTableName })
    .then((smartTable) => {
      if (!smartTable) {
        return res.status(404).send('SmartTable Not Found.');
      }
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
  toggleTrash(res, "smartTable", req.body.smartTableIds, true, () => {
    res.send('smartTable Put in Trash Successfully.');
  });
};

module.exports.restore = (req, res) => {
  toggleTrash(res, "smartTable", req.body.smartTableIds, false, () => {
    res.send('smartTable Restored Successfully.');
  });
};

module.exports.order = (req, res) => {
  if (!req.body.smartTableId) {
    return res.status(400).send('Please Provide smartTableId.');
  };
  const smartTableId = req.body.smartTableId;

  if (!req.body.orderedKeys) {
    return res.status(400).send("Please Provide orderedKeys.")
  };
  const orderedKeys = req.body.orderedKeys;

  if (!orderedKeys instanceof Array) {
    return res.status(400).send('orderedKeys must be an Array.');
  };

  SmartTable.findById(smartTableId)
    .then((smartTable) => {
      if (!smartTable) {
        return res.status(404).send('Smart Table Not Found.');
      };

      if (!verifyOrderChange(smartTable.metadata.keysList, orderedKeys)) {
        return res.status(400).send("Invalid orderedKeys.");
      };

      smartTable.metadata.keysList = orderedKeys;
      smartTable.save().then((savedSmartTable) => {
        return res.send(`Updated SmartTable: ${savedSmartTable.metadata.keysList} Successfully.`)
      });
    })
    .catch((err) => {
      console.error(err.message);
      return res.status(500).send("Error Finding SmartTable.")
    })

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

module.exports.add = (req, res) => {
  if (!req.body.smartTableId) {
    return res.status(400).send('Please Provide smartTableId.');
  };
  const smartTableId = req.body.smartTableId;

  if (!req.body.keyId) {
    return res.status(400).send('Please Provide keyId.');
  };
  const keyId = req.body.keyId;

  SmartTable.findById(smartTableId)
    .then((smartTable) => {
      if (!smartTable) {
        return res.status(404).send('smartTable with provided Id not found.');
      };

      Key.findById(keyId)
        .then((key) => {
          if (!key) {
            return res.status(404).send('key with provided Id not found.');
          };

          // check if provided key is already attached to smartTable
          if (smartTable.metadata.keysList.includes(key._id.toHexString())) {
            return res.status(400).send('Can\'t Add an already Attached Key. Please Add a different Key.');
          };
          smartTable.metadata.keysList.push(key._id);
          smartTable.save()
            .then((smartTable) => {
              return res.send('Added key to keysList successfully.');
            })
            .catch((err) => {
              console.error('Error: ', err.message);
              return res.status(500).send('Something Went Wrong.');
            })
        })
        .catch((err) => {
          console.error('Error: ', err.message);
          return res.status(500).send('Error Finding Key.')
        })
    })
    .catch((err) => {
      console.error('Error: ', err.message);
      return res.status(500).send('Error Finding SmartTable.');
    })
};

module.exports.remove = (req, res) => {
  if (!req.body.smartTableId) {
    return res.status(400).send('Please Provide smartTableId.');
  };
  const smartTableId = req.body.smartTableId;

  if (!req.body.keyId) {
    return res.status(400).send('Please Provide keyId.');
  };
  const keyId = req.body.keyId;

  SmartTable.findById(smartTableId)
    .then((smartTable) => {
      if (!smartTable) {
        return res.status(404).send('smartTable with provided Id not found.');
      };

      Key.findById(keyId)
        .then((key) => {
          if (!key) {
            return res.status(404).send('key with provided Id not found.');
          };

          const removeIndex = smartTable.metadata.keysList.indexOf(key._id);
          if (removeIndex === -1) {
            return res.status(400).send('Invalid Key.');
          };

          const removed = smartTable.metadata.keysList.splice(removeIndex, 1);
          if (removed.length !== 1) {
            return res.status(500).send('Something Went Wrong.');
          };

          if (removed[0] !== key._id.toHexString()) {
            console.log("Actually Removed: ", removed);
            console.log("Intended to Remove: ", smartTable.metadata.keysList[removeIndex]);
            return res.status(500).send('Something Went Wrong.');
          };

          smartTable.save()
            .then((savedSmartTable) => {
              if ((smartTable.metadata.keysList.length - savedSmartTable.metadata.keysList.length) === 1) {
                console.log("Old: ", smartTable.metadata.keysList);
                console.log("New: ", savedSmartTable.metadata.keysList);
                return res.status.send('Something Went Wrong.');
              };
              return res.send('Removed key to keysList successfully.');
            })
            .catch((err) => {
              console.error('Error: ', err.message);
              return res.status(500).send('Something Went Wrong.');
            })
        })
        .catch((err) => {
          console.error('Error: ', err.message);
          return res.status(500).send('Error Finding Key.')
        })
    })
    .catch((err) => {
      console.error('Error: ', err.message);
      return res.status(500).send('Error Finding SmartTable.');
    })
};

module.exports.deleteSmartTables = async (req, res) => {
  if (!req.body.smartTableIds) {
    return res.status(400).send('Please Provide smartTableIds');
  };

  if (!req.body.smartTableIds.length) {
    return res.status(400).send('smartTableIds can\'t be empty.');
  };

  const smartTableIds = req.body.smartTableIds;
  try {
    let check = 0;
    const pipeline = [];

    pipeline.push({ $match: { _id: { $exists: true } } });
    pipeline.push({ $project: { _id: { $toString: "$_id" }, metadata: 1 } });
    pipeline.push({ $match: { _id: { $in: smartTableIds } } });
    pipeline.push({ $project: { smartTableId: "$_id", inTrash: "$metadata.inTrash", _id: 0 } });
    const smartTables = await SmartTable.aggregate([pipeline]);

    if (!smartTables?.length) {
      return res.status(500).send('At least one of the Ids is invalid.');
    };

    const allInTrash = smartTables.every((smartTable) => smartTable.inTrash === true);
    if (!allInTrash) {
      return res.status(500).send('Can\'t delete a smartTable not yet in Trash.');
    }

    for (const smartTable of smartTables) {
      const { deletedCount } = await SmartTable.deleteOne({ _id: smartTable.smartTableId });
      if (!deletedCount) {
        res.status(500).send('Something Went Wrong while deleting SmartTable.');
        break;
      }
      else if (deletedCount) {
        if (check === (smartTableIds.length - 1)) {
          return res.send('Deleted Table(s) successfully.');
        }
        ++check;
      }
    }
  } catch (err) {
    console.error(err.message);
    return res.status(500).send('Something Went Wrong.');
  }
};

// not used anymore
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

module.exports.getKeys = (req, res) => {
  if (!req.body.smartTableId) {
    return res.status(400).send('Please Provide smartTableId.');
  };
  const smartTableId = req.body.smartTableId;

  SmartTable
    .findById(smartTableId)
    .then((smartTable) => {
      Key.aggregate([
        { $match: { _id: { $exists: true } } },
        { $project: { _id: { $toString: "$_id" }, content: 1, metadata: 1 } },
        { $match: { _id: { $in: smartTable.metadata.keysList } } },
        { $project: { keyId: "$_id", keyName: "$content.keyName" } },
        { $project: { _id: 0 } }
      ])
        .then((keys) => {
          const result = smartTable.metadata.keysList.map((k) => (
            keys.find((_k) => (_k.keyId === k))
          ))
          return res.json(result);
        })
        .catch((err) => {
          console.error('Error: ', err.message);
          return res.status(500).send('Something Went Wrong.');
        })

    })
    .catch((err) => {
      console.error('Error: ', err.message);
      return res.status(500).send('Something Went Wrong.');
    })
};

module.exports.valid = (req, res) => {
  try {
    const { validSourceTables } = res.locals.smartTableData;
    if (!validSourceTables) {
      return res.status(500).send("Error getting validSourceTables from res.locals")
    };
  } catch (err) {
    console.error("Error: ", err.message);
  }
  return res.send(validSourceTables);
};

module.exports.info = (req, res) => {
  if (!req.body.smartTableId) {
    return res.status(400).send('Please Provide smartTableId.');
  };
  const smartTableId = req.body.smartTableId;

  SmartTable.findById(smartTableId)
    .then((smartTable) => {
      if (!smartTable) {
        return res.status(500).send("Something Went Wrong.");
      };
      const options = {
        richKeysList: false
      };
      let pipeline = [];
      pipeline = pipeline.concat([
        { $match: { _id: { $exists: true } } },
        { $project: { stId: { $toString: "$_id" }, metadata: 1, content: 1, stName: "$content.name", } },
        { $match: { stId: smartTableId } },
      ]);

      if (options.richKeysList) {
        pipeline = pipeline.concat([
          {
            $project: {
              keyIds: {
                $map: {
                  input: "$metadata.keysList",
                  as: "id",
                  in: {
                    $toObjectId: "$$id"
                  }
                }
              },
              _id: 0,
              stId: 1,
              stName: 1,
              metadata: 1
            }
          },
          {
            $lookup:
            {
              from: "keys",
              localField: "keyIds",
              foreignField: "_id",
              as: "keys"
            }
          },
          {
            $project: {
              stId: 1, stName: 1, metadata: 1,
              keys: {
                $map: {
                  input: "$keys",
                  as: "key",
                  in: {
                    keyId: "$$key._id",
                    keyName: "$$key.content.keyName",
                    keyStatus: "$$key.metadata.status"
                  }
                }
              }
            }
          },
          {
            $project: {
              stId: 1, stName: 1, keys: 1,
              stTables: "$metadata.sourcesmartTableIds",
            }
          }
        ])
      } else {
        pipeline.push({
          $project: {
            _id: 0,
            stId: 1,
            stName: 1,
            stTables: "$metadata.sourceTableIds",
            keys: "$metadata.keysList",
          }
        })
      }

      SmartTable.aggregate(pipeline)
        .then((aggregationResult) => {
          if (!aggregationResult.length) {
            return res.status(500).send('Something Went Wrong.');
          };
          if (options.richKeysList) {
            const unorderedInfo = aggregationResult[0];
            console.log("####", unorderedInfo);

            // ordering the info.keys according to smartTable.metadata.keysList original (user-defined) order
            const orderedKeys = smartTable.metadata.keysList.map((k) => unorderedInfo.keys.find((_k) => _k.keyId.toHexString() === k));
            const orderedInfo = {
              ...unorderedInfo,
              keys: orderedKeys
            }
            console.log(orderedInfo);
            return res.json(orderedInfo);
          } else {
            return res.json(aggregationResult[0]);
          }
        })
        .catch((err) => {
          console.error('Error: ', err.message);
          return res.status(500).send('Something Went Wrong.');
        })
    })
    .catch((err) => {
      console.error('Error: ', err.message);
      return res.status(500).send('Something Went Wrong.');
    })

};