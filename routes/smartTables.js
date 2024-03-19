const router = require('express').Router();
const { getSmartTableData, create, attach, detach, read, list, getValidSourceTables, rename, trash, restore } = require('../controllers/smart-tables');

router.post('/create', create);
router.post('/attach', getSmartTableData, attach);
router.post('/detach', detach);
router.post('/trash', trash);
router.post('/rename', rename);
router.post('/restore', restore);

router.get('/valid-tables', getSmartTableData, getValidSourceTables);
router.get('/read', getSmartTableData, read);
router.get('/list', list);


module.exports = router;