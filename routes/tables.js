const router = require('express').Router();
const { upload, convert, read, list, getSchema, rename, trash } = require('../controllers/tables');

router.get('/read', read);
router.get('/list', list);
router.get('/schema', getSchema);

router.post('/upload', upload);
router.post('/convert', convert);
router.post('/rename', rename);
router.post('/trash', trash);

module.exports = router;