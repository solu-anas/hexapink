const router = require('express').Router();
const { getSmartTableData, create, attach, detach, read, list } = require('../controllers/smart-tables');


router.get('/valid-tables', getSmartTableData, (req, res) => {
    const { validSourceTables } = res.locals.smartTableData;
    if (!validSourceTables) {
        return res.status(500).send("Error getting validSourceTables from res.locals")
    }
    return res.send(validSourceTables);
});
router.post('/create', create);
router.post('/attach', getSmartTableData, attach)
router.post('/detach', detach)

router.get('/read', getSmartTableData, read)
router.get('/list', list)

module.exports = router;