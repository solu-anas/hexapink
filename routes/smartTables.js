const router = require('express').Router();
const { getSmartTableData, create, attach, detach, read, list, getValidSourceTables } = require('../controllers/smart-tables');


router.post('/create', create);
router.post('/attach', getSmartTableData, attach)
router.post('/detach', detach)

router.get('/valid-tables', getSmartTableData, getValidSourceTables);
router.get('/read', getSmartTableData, read)
router.get('/list', list)

module.exports = router;