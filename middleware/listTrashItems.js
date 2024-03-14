const { Table } = require('../models/Table');
const { SmartTable } = require('../models/SmartTable');
const { Key } = require('../models/Key');
const { Record } = require('../models/Record');

module.exports.listTrashItems = (req, res) => {
    if (!req.query.objectList) {
        return res.status(400).send("Please provide objectList");
    }

    const ModelsMap = {
        "tables": Table,
        "smart-tables": SmartTable,
        "keys": Key,
        "records": Record,
    }

    const objectList = JSON.parse(req.query.objectList);
    if (!objectList.every((o) => Object.keys(ModelsMap).includes(o))) {
        return res.status(400).send("At least one object is invalid");
    }
    let results = [];

    let finishedCount = objectList.length;
    const checkInterval = setInterval(() => {
        console.log(finishedCount);
        if (finishedCount) {
            return;
        }
        clearInterval(checkInterval);
        return res.json(results);
    }, 10);

    objectList.forEach((objectName) => {
        const Model = ModelsMap[objectName]
        Model
            .find({ "metadata.status": "in-trash" })
            .then((stuff) => {
                console.log(stuff);
                results = results.concat({ type: objectName, data: stuff });
                finishedCount--;
            })
            .catch((err) => {
                console.error('Error: ', err.message);
                return res.status(500).send("Something Went Wrong.");
            });
    })
};