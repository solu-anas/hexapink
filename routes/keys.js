const router = require("express").Router();
const { list, rename, listLabels, trash, restore } = require('../controllers/keys');

router.get("/list", list);
router.get("/labels", listLabels);
router.post("/rename", rename);
router.post("/trash", trash);
router.post("/restore", restore);

module.exports = router;
