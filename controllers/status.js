const { Table } = require("../models/Table");

module.exports.changeStatus = (req, res, oldStatus, newStatus) => {

    if (!req.body.tablesIds) {
        return res.status(400).send('Please Provide tablesIds.');
    };

    if (!req.body.tablesIds.length) {
        return res.status(400).send('tablesIds Can\'t be empty.');
    };

    const statusList = [
        "created",
        "upload-in-progress",
        "convert-in-progress",
        "upload-complete",
        "convert-complete",
        "active",
    ]

    if (!statusList.includes(oldStatus)) {
        return res.status(400).send('oldStatus is invalid');
    };

    if (!statusList.includes(newStatus)) {
        return res.status(400).send('newStatus is invalid');
    };

    Table
        .aggregate([
            { $match: { "metadata.status": oldStatus } },
            { $project: { tableId: { $toString: "$_id" } } },
            { $match: { "tableId": { $in: req.body.tablesIds } } }
        ])
        .then((tables) => {
            if (req.body.tablesIds.length - tables.length) {
                return res.status(400).send("At least one tableId is invalid")
            }

            activateTableWithIndex(0);

            function activateTableWithIndex(index) {
                // exit if finished
                if (!(tables.length - index)) {
                    // final action
                    return res.send('finished');
                }

                // code start
                Table.findByIdAndUpdate(tables[index], { "metadata.status": newStatus }).then((updatedTable) => {
                    console.log("updated:", updatedTable._id);
                    // code end
                    activateTableWithIndex(index + 1);
                }).catch((err) => {
                    console.error('Error: ', err.message);
                    return res.status(500).send('Something Went Wrong.');
                })

            }
        })
};