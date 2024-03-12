const { Key } = require('../models/Key');
const { Label } = require('../models/Label');

module.exports.updateKey = (label, newKeyId, cb) => {
  label.metadata.keyId = newKeyId;
  label
    .save()
    .then(() => {
      cb({ type: "success", message: "label updated" });
    })
    .catch((err) => {
      console.log(err.message);
      cb({ type: "error", message: "error saving label" });
    });
};

module.exports.list = (req, res) => {
  Key.aggregate([
    { $match: { "metadata.status": { $in: req.body.statusList || ["active"] } } },
    { $project: { keyType: "$metadata.keyType", keyName: "$content.keyName", _id: 0, keyId: { $toString: "$_id" } } },
  ])
    .then((allKeys) => {
      return res.json([...allKeys]);
    })
    .catch((err) => {
      console.error("Error: ", err.message);
      return res.status(500).send("Internal Server Error");
    });
};

module.exports.rename = (req, res) => {
  Key.findByIdAndUpdate(req.body.keyId, { "content.keyName": req.body.newKeyName })
    .then((key) => {
      key
        .save()
        .then((savedKey) => {
          return res.send('Updated Key Name Successfully.');
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

module.exports.trash = (req, res) => {
  Key.findById(req.body.keyId)
    .then((key) => {
      // find all the labels that are linked to the key you want to put in trash
      Label
        .updateMany({ "metadata.keyId": key._id }, { $unset: { "metadata.keyId": { $exists: true } } })
        .then(({ acknowledged }) => {
          if (!acknowledged) {
            return res.status(500).send("You fucked up :/");
          }
          key.metadata.status = "in-trash";
          key.save()
            .then(() => {
              return res.send('Key is put in trash successfully.');
            })
            .catch((err) => {
              console.error('Error: ', err.message);
              return res.status(500).send('Error Updating Key Status.');
            })
        })
        .catch((err) => {
          console.error('Error: ', err.message);
          return res.status(500).send('Something Went Wrong.');
        })
    })
    .catch((err) => {
      console.error('Error: ', err.message);
      return res.status(500).send('Something Went Wrong.');
    });
};

module.exports.listLabels = (req, res) => {
  Key.findById(req.body.keyId)
    .then((key) => {
      Label.aggregate([
        { $match: { "metadata.keyId": key._id } },
        { $project: { _id: 0, "labelId": "$_id", "labelName": "$content.name" } },
        { $project: { keyId: 0 } }
      ])
        .then((linkedLabels) => {
          return res.json(linkedLabels);
        })
        .catch((err) => {
          console.error('Error: ', err.message);
          return res.status(500).send('Something Went Wrong.');
        })
    })
    .catch((err) => {
      console.error('Error: ', err.message);
      return res.status(500).send('Something Went Wrong.');
    });
};