const { Key } = require("../models/Key");
const router = require("express").Router();

router.get("/list", (req, res) => {
  Key.aggregate([
    { $match: { _id: { $exists: true } } },
    { $project: { keyType: "$metadata.keyType", keyName: "$content.keyName", _id: 0, keyId: { $toString: "$_id" } } },
  ])
    .then((allKeys) => {
      console.log(allKeys);
      res.json([...allKeys]);
    })
    .catch((err) => {
      console.error("Error: ", err.message);
      res.status(500).send("Internal Server Error");
    });
});

router.post("/create", (req, res) => {
  const newKey = new Key({
    content: {
      name: req.body.keyName,
    },
  });
  newKey
    .save()
    .then((savedKey) => {
      res.json({ keyId: savedKey._id });
    })
    .catch((err) => {
      console.error("Error Creating New Key: ", err.message);
      res.status(400).send("Bad Request");
    });
});

module.exports = router;
