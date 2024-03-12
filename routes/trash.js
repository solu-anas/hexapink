const router = require('express').Router();
const { listTrashItems } = require('../controllers/trash');

router.get('/', listTrashItems);

module.exports = router;