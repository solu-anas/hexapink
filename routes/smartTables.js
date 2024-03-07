const router = require('express').Router();
const { listValidTables, create, fill } = require('../controllers/smart-tables');


router.get('/valid-tables', listValidTables);
router.post('/create', create);
router.post('/fill', fill)

module.exports = router;