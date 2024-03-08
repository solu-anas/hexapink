const router = require('express').Router();
const { listValidTables, create, fill, read } = require('../controllers/smart-tables');


router.get('/valid-tables', listValidTables);
router.post('/create', create);
router.post('/fill', fill)
router.get('/read', read)

module.exports = router;