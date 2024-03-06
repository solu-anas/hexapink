const { Table } = require("../models/table");
const { Record } = require("../models/record");

module.exports.list = (req, res) => {
  Table.findOne({ "metadata.uuid": req.body.tableUUID }).then((table) => {
    Record.aggregate([
      { $match: { "metadata.tableId": table._id } },
      { $limit: req.body.limit },
      { $project: { _id: 0, id: "$_id", content: 1 } },
    ]).then((records) => {
      res.json(records);
    });
  });
};