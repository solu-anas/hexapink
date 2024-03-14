const router = require('express').Router();
const { upload, convert, read, list, getSchema, rename, activate, deactivate, restore, trash } = require('../middleware/tables');

router.get('/read', read);
router.get('/list', list);
router.get('/schema', getSchema);

router.post('/upload', upload);
router.post('/convert', convert);
router.post('/rename', rename);
router.post('/activate', activate);
router.post('/deactivate', deactivate)
router.post('/trash', trash)
router.post('/restore', restore);


module.exports = router;