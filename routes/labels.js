const router = require('express').Router();
const { rename } = require('../controllers/labels');

router.post('/rename', rename);

module.exports = router;