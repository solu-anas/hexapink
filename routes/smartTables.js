const router = require('express').Router();
const { getSmartTableData, create, attach, detach, read, list, getValidSourceTables, rename, trash, restore, order, add, remove, getKeys, info } = require('../controllers/smart-tables');

router.post('/create', create);
router.post('/attach', [getSmartTableData, getValidSourceTables], attach);
router.post('/detach', detach);
router.post('/trash', trash);
router.post('/rename', rename);
router.post('/restore', restore);
router.post('/keys/order', order);
router.post('/keys/add', add);
router.post('/keys/remove', remove);

// router.get('/keys', getKeys);
router.get('/info', getSmartTableData, (req, res) => {
    if (!res.locals.smartTableData?.data) {
        return res.status(500).send('res.locals.smartTableData.data is undefined.');
    }
    const { data } = res.locals.smartTableData;
    res.json(data);
});

router.get('/valid-tables', getSmartTableData, getValidSourceTables, (req, res) => {
    if (!res.locals.smartTableData?.validSourceTables) {
        return res.status(500).send('res.locals.smartTableData.validSourceTables is undefined.');
    }
    const { validSourceTables } = res.locals.smartTableData;
    res.json(validSourceTables);
});
router.get('/read', getSmartTableData, getValidSourceTables, read);
router.get('/list', list);


module.exports = router;