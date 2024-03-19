const { Key } = require("../models/Key");
const { SmartTable } = require("../models/SmartTable");
const { Table } = require("../models/Table");


const resourcesMap = {
  "table": Table,
  "smartTable": SmartTable,
  "key": Key,
}

module.exports.toggleTrash = (res, resource, resourceIds, boolState, finalCallback = null) => {
  if (!resourceIds) {
    return res.status(400).send(`Please Provide ${resource}Ids.`);
  };

  if (!(resourceIds instanceof Array)) {
    return res.status(400).send(`${resource}Ids should be an array.`);
  };

  if (!resourceIds.length) {
    return res.status(400).send(`${resource}Ids Can\'t be empty.`);
  };

  if (!(typeof boolState === "boolean")) {
    return res.status(500).send('Hmmm...');
  };

  const ResourceModel = resourcesMap[resource];


  ResourceModel.aggregate([
    { $match: { "metadata.inTrash": !boolState } },
    { $project: { tableId: { $toString: "$_id" } } },
    { $match: { "tableId": { $in: resourceIds } } }
  ])
    .then((resources) => {
      if (resourceIds.length - resources.length) {
        return res.status(400).send(`At least one ${resource}Id is invalid`)
      }

      changeResourceTrashStatus(0);

      function changeResourceTrashStatus(index) {

        // exit if finished
        if (!(resources.length - index)) {
          // final action
          if (typeof finalCallback === "function") {
            finalCallback();
            return;
          };
          return res.send('finished');
        }

        // code start
        ResourceModel.findByIdAndUpdate(resources[index], { "metadata.inTrash": boolState })
          .then((updatedResource) => {
            console.log("updated:", updatedResource._id);

            // code end
            changeResourceTrashStatus(index + 1);
          })
          .catch((err) => {
            console.error('Error: ', err.message);
            return res.status(500).send('Something Went Wrong.');
          })
      }
    })

};