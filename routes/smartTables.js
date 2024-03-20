const router = require('express').Router();
const { getSmartTableData, create, attach, detach, read, list, getValidSourceTables, rename, trash, restore, order, add, remove, getKeys, info } = require('../controllers/smart-tables');

router.post('/create', create);
router.post('/attach', getSmartTableData, attach);
router.post('/detach', detach);
router.post('/trash', trash);
router.post('/rename', rename);
router.post('/restore', restore);
router.post('/keys/order', order);
router.post('/keys/add', add);
router.post('/keys/remove', remove);

router.get('/info', info);
router.get('/keys', getKeys);
router.get('/valid-tables', getSmartTableData, getValidSourceTables);
router.get('/read', getSmartTableData, read);
router.get('/list', list);


module.exports = router;