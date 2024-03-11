const { Label } = require('../models/Label');

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