/*{
// enter name for newly-created smartTable
  // list all existing keys
  // select keys that define the structure of smartTable
  // Enter names for labels
  // list all tables with labels belong to the set of chosen keys
  // select from where to fill the smartTable
    // render the smart Table
}*/

const { SmartTable } = require("../models/SmartTable");
const { Table } = require("../models/Table");
const { Label } = require("../models/Label");
const { Key } = require("../models/Key");

module.exports.createSmartTable = async (req, res) => {
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
      Label.aggregate([
        { $match: { _id: { $exists: true } } },
        {
          $project: {
            labelId: { $toString: "$_id" },
            keyId: { $toString: "$metadata.keyId" },
          },
        },
        { $match: { keyId: { $in: keyIds } } },
        { $project: { _id: 0, keyId: 0 } },
      ]).then((labels) => {
        Table.aggregate([
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
        ]).then((tables) => {
          return res.status(200).json(tables.map((t) => t._id));
        });
      });
    })
    .catch((err) => {
      console.error("Error: ", err.message);
      res.status(500).send("Error Keys lookup");
    });
};