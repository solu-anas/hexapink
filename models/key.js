const { Types, Schema, model } = require("mongoose");

const keySchema = new Schema({
  content: {
    type: Object,
  },
  metadata: {
    keyType: {
      type: String,
      default: "all",
    },
  },
});

module.exports.Key = model("Key", keySchema);
