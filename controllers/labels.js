const { Label } = require('../models/Label');
const { Table } = require('../models/Table');
const { Key } = require('../models/Key');
const { updateLabelKeyId } = require('./keys');

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
        return res.status(400).send("Please provide a labelId.");
    }
    // find label
    Label.findById(req.body.labelId)
        .then((label) => {
            // check if the label was found
            if (!label) {
                return res.status(404).send('There is no label with the provided id.')
            }
            // find table
            Table.aggregate([
                { $match: { "metadata.labels": { $in: [label._id] }, "metadata.status": "convert-complete" } },
                {
                    $lookup: {
                        from: "labels",
                        foreignField: "_id",
                        localField: "metadata.labels",
                        as: "labels",
                    }
                }
            ])
                .then((tables) => {
                    // check if the table was found
                    if (!tables.length) {
                        return res.status(404).send("Table with specified label Not Found.");
                    }
                    const table = tables[0];
                    // check if req.body.oldKeyId is set
                    if (req.body.oldKeyId) {
                        // find old key
                        Key.findById(req.body.oldKeyId)
                            .then((key) => {
                                // ckeck if old key exists
                                if (!key) {
                                    return res.status(404).send('There is no key with the provided id.');
                                }
                                // check if metadata.keyId is unique amongst sibling labels (labels of the same table)
                                if (!(table.labels.every(l => l.metadata.keyId?.toHexString() !== req.body.oldKeyId))) {
                                    return res
                                        .status(400)
                                        .send("Can't link sibling labels to the same key");
                                }
                                // then reassign metadata.keyId to oldKeyId
                                updateLabelKeyId(label, key._id, updateCallBack);
                            })
                            .catch((err) => {
                                console.log(err.message);
                                res.status(500).send("Error finding key.");
                            });
                    }
                    // check if req.body.newKeyName is set
                    else if (req.body.newKeyName) {
                        // create new key and get its id
                        const newKey = new Key({
                            content: {
                                keyName: req.body.newKeyName,
                            },
                        });
                        newKey
                            .save()
                            .then((key) => {
                                // then reassign metadata.keyId to newKeyId
                                updateLabelKeyId(label, key._id, updateCallBack);
                            })
                            .catch((err) => {
                                console.log(err.message);
                                res.status(500).send("Error saving new key.");
                            });
                    } else {
                        res.status(400).send("Please provide a newKeyName or an oldKeyId.");
                    }

                    // callback for updateLabelKeyId()
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
                    res.status(500).send("Error finding Table.");
                })
        })
        .catch((err) => {
            console.log(err.message);
            res.status(500).send("Error finding label.");
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