/*{
// enter name for newly-created smartTable
  // list all existing keys
  // select keys that define the structure of smartTable
  // Enter names for labels
  // list all tables with labels belong to the set of chosen keys
  // select from where to fill the smartTable
    // render the smart Table
}*/

/*{
    "smartTableName": "",
    "chosenKeys": ["","",""],
    "labelsNames": ["","",""]
}*/

const { SmartTable } = require("../models/smartTable");
const { Table } = require("../models/table");
const { Key } = require("../models/key");
const { response } = require("express");

module.exports.createSmartTable = async (req, res) => {
  Key.find({ _id: { $in: req.body.chosenKeys } })
    .then((keys) => {
      console.log(keys);
      res.send(keys);
    })
    .catch((err) => {
      console.error("Error: ", err.message);
      res.status(500).send("Error Keys lookup");
    });
};
