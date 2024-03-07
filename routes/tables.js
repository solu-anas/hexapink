const router = require('express').Router();
const { upload, insert, read, link, list, getSchema } = require('../controllers/tables');

router.get('/read', read);
router.get('/list', list);
router.get('/schema', getSchema);

router.post('/upload', upload);
router.post('/insert', insert);
router.post('/link', link)

module.exports = router;