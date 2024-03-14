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
  if (!req.query.statusList) {
    return res.status(400).send('Please Provide statusList.')
  }

  if (req.query.statusList.includes("in-trash")) {
    return res.status(400).send('Cannot List Keys that have an "in-trash" status.')
  }

  Key.aggregate([
    { $match: { "metadata.status": { $in: req.query.statusList || ["active"] } } },
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
  if (!req.body.keyId) {
    return res.status(400).send("Please Provide keyId.")
  }

  Key.findByIdAndUpdate(req.body.keyId, { "content.keyName": req.body.newKeyName })
    .then((key) => {
      if (!key) {
        return res.status(404).send('Key with specified Id Not Found.');
      }

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
  if (!req.body.keyId) {
    return res.status(400).send("Please Provide keyId.")
  }

  Key.findById(req.body.keyId)
    .then((key) => {
      if (!key) {
        return res.status(404).send('Key with specified Id Not Found.');
      }

      // find all the labels that are linked to the key you want to put in trash and "unlink" them
      Label
        .updateMany({ "metadata.keyId": key._id }, { $unset: { "metadata.keyId": { $exists: true } } })
        .then(({ acknowledged }) => {
          if (!acknowledged) {
            return res.status(500).send("Something Went Wrong.");
          }
          key.metadata.inTrash = true;
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

module.exports.restoreFromTrash = (req, res) => {
  if (!req.body.keysList.length) {
    return res.status(400).send('Please Provide keysList.');
  }

  let finishedCheck = req.body.keysList.length;
  req.body.keysList.forEach((id) => {
    // check if the provided ids are valid
    Key.findById(id)
      .then((key) => {
        if (!Key) {
          return res.status(400).send('At least one Id in KeyList is not valid.');
        }

        if (!key.metadata.inTrash) {
          return res.status(400).send("You can't restore something that is not in trash.")
        }

        if (key.metadata.inTrash) {
          Key.metadata.inTrash = false;
          Key
            .save()
            .then((savedKey) => {
              if (!finishedCheck) {
                finishedCheck--;
                return;
              }
              return res.send('Restored Keys Successfully.')
            })
        }
      })
  })
};

module.exports.listLabels = (req, res) => {
  if (!req.query.keyId) {
    return res.status(400).send('Please Provide keyId.');
  }

  Key.findById(req.query.keyId)
    .then((key) => {
      if (!key) {
        return res.status(404).send('There are no Key with the specified Id.');
      }
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