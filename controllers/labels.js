const { Label } = require('../models/Label');
const { Table } = require('../models/Table');
const { Key } = require('../models/Key');
const { updateKey } = require('./keys');

module.exports.rename = (req, res) => {
    if (!req.body.labelId) {
        return res.status(400).send('Please Provide labelId');
    }


    if (!req.body.newLabelName) {
        return res.status(400).send('Please Provide newLabelName');
    }

    Label.findByIdAndUpdate(req.body.labelId, { "content.name": req.body.newLabelName })
        .then((label) => {
            if (!label) {
                return res.status(404).send("Label Not found.");
            }
            return res.send('Updated Label Successfully.')

        })
        .catch((err) => {
            console.error("Error: ", err.message);
            return res.status(500).send('Error Finding Label.');
        })

};

module.exports.link = (req, res) => {
    if (!(req.body.labelId)) {
        return res.status(400).send("Please provide a labelId");
    }
    // find label
    Label.findById(req.body.labelId)
        .then((label) => {
            if (!label) {
                return res.status(404).send('there is no label with the provided id')
            }
            Table.aggregate([
                { $match: { "metadata.labels": { $in: [label._id] } } }
            ])
                .then((tables) => {
                    if (!tables.length) {
                        return res.status(404).send("Table with specified label Not Found");
                    }
                    const table = tables[0];
                    // check if req.body.oldKeyId is set
                    if (req.body.oldKeyId) {
                        // check if the provided id is valid
                        Key.findById(req.body.oldKeyId)
                            .then((key) => {
                                // check if key._id is unique amongst sibling labels (labels of the same table)
                                if (!key) {
                                    return res.status(404).send('there is no key with the provided id')
                                }
                                if (!table._id.toHexString()) {
                                    return res.status(400).send('Please provide a tableId.')
                                }
                                Table.findById(table._id.toHexString())
                                    .then((table) => {
                                        if (!table) {
                                            return res.status(404).send("table not found");
                                        }
                                        const foundLabel = table.metadata.labels.find((l) =>
                                            label._id.equals(l)
                                        );
                                        if (!foundLabel) {
                                            return res.status(404).send("label not found in table");
                                        }
                                        Label.aggregate([
                                            { $match: { "metadata.keyId": key._id } },
                                            { $project: { newId: { $toString: "$_id" } } },
                                            {
                                                $match: {
                                                    newId: {
                                                        $in: table.metadata.labels.map((l) =>
                                                            l.toHexString()
                                                        ),
                                                    },
                                                },
                                            },
                                        ])
                                            .then((matchingLabels) => {
                                                // then reassign newKeyId
                                                if (!matchingLabels.length) {
                                                    updateKey(label, key._id, updateCallBack);
                                                } else {
                                                    res
                                                        .status(400)
                                                        .send("can't link sibling labels to the same key");
                                                }
                                            })
                                            .catch((err) => {
                                                console.log(err.message);
                                                res.status(500).send("error checking sibling labels");
                                            });
                                    })
                                    .catch((err) => {
                                        console.log(err.message);
                                        res.status(500).send("Error finding table");
                                    });
                            })
                            .catch((err) => {
                                console.log(err.message);
                                return res.status(500).send("Error finding key");
                            });
                    }
                    // check if req.body.newKeyName is set
                    else if (req.body.newKeyName) {
                        // create new key and get its id
                        // then reassign newKeyId
                        const newKey = new Key({
                            content: {
                                keyName: req.body.newKeyName,
                            },
                        });
                        newKey
                            .save()
                            .then((key) => {
                                updateKey(label, key._id, updateCallBack);
                            })
                            .catch((err) => {
                                console.log(err.message);
                                res.status(500).send("Error saving new key");
                            });
                    } else {
                        res.status(400).send("Please provide a newKeyName or an oldKeyId");
                    }
                    function updateCallBack({ type, message }) {
                        switch (type) {
                            case "error":
                                res.status(400).send(message);
                                break;
                            case "success":
                                res.status(200).send(message);
                                break;

                            default:
                                res.status(500).send(message);
                                break;
                        }
                    }
                })
                .catch((err) => {
                    console.error("Error: ", err.message);
                })

        })
        .catch((err) => {
            console.log(err.message);
            res.status(500).send("Error finding label");
        });
};

module.exports.unlink = (req, res) => {
    if (!req.body.labelId) {
        return res.status(400).send('Please Provide labelId.');
    };

    Label
        .findByIdAndUpdate(req.body.labelId, { $unset: { "metadata.keyId": { $exists: true } } })
        .then((label) => {
            if (!label) {
                return res.status(500).send("Something Went Wrong.");
            }
            return res.send('Label unlinked successfully.');
        })
        .catch((err) => {
            console.error('Error: ', err.message);
            return res.status(500).send('Something Went Wrong.');
        })
};