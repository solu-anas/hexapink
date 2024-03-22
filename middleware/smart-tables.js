const { SmartTable } = require('../models/SmartTable');
const { Table } = require('../models/Table');

module.exports.getSmartTableData = (req, res, next) => {
    let smartTableId;

    switch (req.method.toLowerCase()) {
        case "post":
            smartTableId = req.body.smartTableId;
            break;

        case "get":
            smartTableId = req.query.smartTableId;
            break;
        default:
            break;
    };

    if (!smartTableId) {
        return res.status(400).send('Please Provide smartTableId.');
    };

    SmartTable.findById(smartTableId)
        .then((smartTable) => {
            if (!smartTable) {
                return res.status(500).send("Something Went Wrong.");
            };
            const options = {
                richKeysList: true
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
                                        keyId: { $toString: "$$key._id" },
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
                            stTables: "$metadata.sourceTableIds",
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
                        const orderedKeys = smartTable.metadata.keysList.map((k) => unorderedInfo.keys.find((_k) => _k.keyId === k));
                        const orderedInfo = {
                            ...unorderedInfo,
                            keys: orderedKeys
                        }
                        console.log(orderedInfo);
                        // return res.json(orderedInfo);
                        res.locals.smartTableData = {
                            smartTable,
                            data: orderedInfo
                        }
                        next();
                    } else {
                        res.locals.smartTableData = {
                            smartTable,
                            data: aggregationResult[0]
                        };
                        next();
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

module.exports.getValidSourceTables = (req, res, next) => {
    if (!res.locals.smartTableData) {
        return res.status(500).send('res.locals.smartTableData is not found.');
    };

    const { smartTable } = res.locals.smartTableData;
    const { keysList } = smartTable.metadata;

    Table.aggregate([
        { $match: { $expr: { $ne: ["$metadata.inTrash", true] }, "metadata.status": "convert-complete" } },
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
                            $in: [{ $toString: "$$label.metadata.keyId" }, keysList],
                        },
                    },
                },
            },
        },
        {
            $project: {
                _id: 0,
                tableId: { $toString: "$_id" },
                "validLabels": {
                    $map: {
                        input: "$validLabels",
                        as: "label",
                        in: {
                            labelName: "$$label.content.name",
                            labelId: { $toString: "$$label._id" },
                            keyId: { $toString: "$$label.metadata.keyId" }
                        },
                    },
                },
            },
        },
        {
            $match: {
                $expr: {
                    $eq: [{ $size: "$validLabels" }, keysList.length]
                }
            }
        }
    ])
        .then((validSourceTables) => {
            console.log("#####", validSourceTables);
            res.locals.smartTableData.validSourceTables = validSourceTables;
            next();
        })
        .catch((err) => {
            console.error("Error: ", err.message);
            return res.status(500).send('Error finding validSourceTables');
        })

};