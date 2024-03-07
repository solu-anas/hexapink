const router = require('express').Router();
const { createSmartTable } = require('../controllers/smart-tables');

router.post('/create', createSmartTable);

module.exports = router;