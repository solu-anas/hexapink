const router = require("express").Router();
const { list, rename, listLabels, trash } = require('../controllers/keys');


router.get("/list", list);
router.get("/labels", listLabels);
router.post("/rename", rename);
router.post("/trash", trash);


module.exports = router;
