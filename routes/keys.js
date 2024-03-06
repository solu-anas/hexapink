const { Key } = require("../models/key");
const router = require("express").Router();

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