const router = require('express').Router();
const { upload } = require('../controllers/uploader');
const { insert } = require('../controllers/inserter');
const { list } = require('../controllers/lister');
const { link } = require('../controllers/linker');

router.post('/upload', upload);
router.post('/insert', insert);
router.get('/list', list)
router.post('/link', link)

module.exports = router;