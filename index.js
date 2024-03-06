const express = require("express");
const cors = require("cors");
const app = express();
const tablesRouter = require("./routes/tables");
const smartTablesRouter = require("./routes/smartTables");
const keysRouter = require("./routes/keys");
const mongoose = require("mongoose");

mongoose
  .connect("mongodb://localhost:27017/hexapink")
  .then(() => console.log("Connected to mongoDB successfully ..."))
  .catch((err) => console.error("DB Connection Error: ", err.message));

app.use(cors({ origin: "http://localhost:3000", optionsSuccessStatus: 200 }));
app.use(express.json());

app.use("/api/tables", tablesRouter);
app.use("/api/smart-tables", smartTablesRouter);
app.use("/api/keys", keysRouter);
app.get("/test", (req, res) => {
  res.send('Ok');
})

app.listen(8000, () => console.log(`Listening to port 8000 ...`));
