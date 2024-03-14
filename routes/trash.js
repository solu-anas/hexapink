const router = require('express').Router();
const { listTrashItems } = require('../middleware/listTrashItems');

router.get('/', listTrashItems);

module.exports = router;