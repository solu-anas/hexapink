const router = require('express').Router();
const { upload, convert, read, list, rename, activate, deactivate, restore, trash, getInfo, order } = require('../middleware/tables');

router.get('/read', read);
router.get('/list', list);
router.get('/info', getInfo);

router.post('/upload', upload);
router.post('/convert', convert);
router.post('/rename', rename);
router.post('/activate', activate);
router.post('/deactivate', deactivate);
router.post('/trash', trash);
router.post('/restore', restore);
router.post('/order', order);


module.exports = router;