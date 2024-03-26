const { Key } = require('../models/Key');
const { Label } = require('../models/Label');
const { Table } = require('../models/Table');
const { toggleTrash } = require('./trash');

module.exports.updateLabelKeyId = (label, newKeyId, cb) => {
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
  // if (!req.query.statusList) {
  //   return res.status(400).send('Please Provide statusList.')
  // };
  // const statusList = req.query.statusList;

  Key.aggregate([
    { $match: { "metadata.status": { $in: JSON.parse(req.query.statusList) || ["active"] } } },
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

module.exports.listLabels = (req, res) => {
  if (!req.query.keyId) {
    return res.status(400).send('Please Provide keyId.');
  }

  Key.findById(req.query.keyId)
    .then((key) => {
      if (!key) {
        return res.status(404).send('There is no Key with the specified Id.');
      }
      // Table.aggregate([
      //   {$match: }
      // ])
      Label.aggregate([
        { $match: { "metadata.keyId": key._id } },
        { $project: { _id: 0, "labelId": "$_id", "labelName": "$content.name", "tableId": "$metadata.tableId" } },
        { $project: { keyId: 0 } }
      ])
        .then((linkedLabels) => {
          return res.json(linkedLabels);
        })
        .catch((err) => {
          console.error('Error: ', err.message);
          return res.status(500).send('Error finding labels.');
        })
    })
    .catch((err) => {
      console.error('Error: ', err.message);
      return res.status(500).send('Error finding key.');
    });
};

module.exports.trash = (req, res) => {
  toggleTrash(res, "key", req.body.keyIds, true, () => {
    res.send('Key Put in Trash Successfully.');
  });
};

module.exports.restore = (req, res) => {
  toggleTrash(res, "key", req.body.keyIds, false, () => {
    res.send('Key Restored Successfully.');
  });
};

module.exports.deleteKeys = async (req, res) => {
  if (!req.body.keyIds?.length) {
    return res.status(400).send('Please Provide keyIds');
  };

  const keyIds = req.body.keyIds;
  try {
    let check = 0;
    const pipeline = [];

    pipeline.push({ $match: { _id: { $exists: true } } });
    pipeline.push({ $project: { _id: { $toString: "$_id" }, metadata: 1 } });
    pipeline.push({ $match: { _id: { $in: keyIds } } });
    pipeline.push({ $project: { keyId: "$_id", inTrash: "$metadata.inTrash", _id: 0 } });
    const keys = await Key.aggregate([pipeline]);
    console.log(keys);


    if (!keys?.length) {
      return res.status(500).send('At least one of the Ids is invalid.');
    };

    const allInTrash = keys.every((key) => key.inTrash === true);
    if (!allInTrash) {
      return res.status(500).send('Can\'t delete a key not yet in Trash.');
    }

    for (const key of keys) {
      const { acknowledged } = await Label.updateMany({ "metadata.keyId": key.keyId }, { $unset: { "metadata.keyId": "" } });
      if (!acknowledged) {
        res.status(500).send('Something Went Wrong while unlinking Labels.');
        break;
      }
      else if (acknowledged) {
        const { deletedCount } = await Key.deleteOne({ _id: key.keyId });
        if (!deletedCount) {
          res.status(500).send('Something Went Wrong.');
          break;
        }
        else if (deletedCount) {
          if (check === (keyIds.length - 1)) {
            return res.send('Deleted Key(s) successfully.');
          }
          ++check;
        }
      }
    }
  } catch (err) {
    console.error(err.message);
    return res.status(500).send('Something Went Wrong.');
  }
};