const router = require("express").Router();
const { list, rename, listLabels, trash, restore, deleteKeys } = require('../controllers/keys');

router.get("/list", list);
router.get("/labels", listLabels);

router.post("/rename", rename);
router.post("/trash", trash);
router.post("/restore", restore);

router.delete("/delete", deleteKeys);

module.exports = router;
