const express = require('express');
const cors = require("cors");
const tablesRouter = require("../routes/tables");
const smartTablesRouter = require("../routes/smartTables");
const keysRouter = require("../routes/keys");
const recordsRouter = require("../routes/records");
const labelsRouter = require("../routes/labels");
const trashRouter = require("../routes/trash");
const { healthCheck } = require('../controllers/health');

module.exports = (app) => {
    app.use(cors({ origin: "http://localhost:3000", optionsSuccessStatus: 200 }));
    app.use(express.json());
    app.get('/api/health', healthCheck);
    app.use("/api/tables", tablesRouter);
    app.use("/api/smart-tables", smartTablesRouter);
    app.use("/api/keys", keysRouter);
    app.use("/api/records", recordsRouter);
    app.use("/api/labels", labelsRouter);
    app.use("/api/trash", trashRouter);
    
    app.get('*', (req, res) => {
        res.status(404).send('Seems like you are going somewhere ...');
    });

}