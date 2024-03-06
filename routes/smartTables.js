const router = require('express').Router();
const { createSmartTable } = require('../controllers/createSmartTable');

router.post('/create', createSmartTable);

module.exports = router;