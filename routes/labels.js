const router = require('express').Router();
const { rename, link } = require('../controllers/labels');

router.post('/rename', rename);
router.post('/link', link);

module.exports = router;