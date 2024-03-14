const { Table } = require("../models/Table");

module.exports.toggleTrash = (req, res, boolState, finalCallback = null) => {
    if (!req.body.tablesIds) {
      return res.status(400).send('Please Provide tablesIds.');
    };
  
    if (!req.body.tablesIds.length) {
      return res.status(400).send('tablesIds Can\'t be empty.');
    };
  
    if (!(typeof boolState === "boolean")) {
      return res.status(500).send('Hmmm...');
    };
    
  
  
    Table.aggregate([
      { $match: { "metadata.inTrash": !boolState } },
      { $project: { tableId: { $toString: "$_id" } } },
      { $match: { "tableId": { $in: req.body.tablesIds } } }
    ])
      .then((tables) => {
        if (req.body.tablesIds.length - tables.length) {
          return res.status(400).send("At least one tableId is invalid")
        }
  
        changeTableTrashStatus(0);
  
        function changeTableTrashStatus(index) {
  
          // exit if finished
          if (!(tables.length - index)) {
            // final action
            if (typeof finalCallback === "function") {
              finalCallback();
              return;
            };
            return res.send('finished');
          }
  
          // code start
          Table.findByIdAndUpdate(tables[index], { "metadata.inTrash": boolState })
            .then((updatedTable) => {
              console.log("updated:", updatedTable._id);
  
              // code end
              changeTableTrashStatus(index + 1);
            })
            .catch((err) => {
              console.error('Error: ', err.message);
              return res.status(500).send('Something Went Wrong.');
            })
        }
      })
  
  
  
  };