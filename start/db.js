const mongoose = require("mongoose");

module.exports = () => {
    mongoose
        .connect("mongodb://localhost:27017/hexapink")
    .then(() => {
        console.log("Connected to mongoDB successfully ...");
    })
    .catch((err) => console.error("DB Connection Error: ", err.message));
};