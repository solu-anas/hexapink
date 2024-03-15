const router = require('express').Router();
const { rename, link, unlink } = require('../controllers/labels');

router.post('/rename', rename);
router.post('/link', link);
router.post('/unlink', unlink);

module.exports = router;