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
    status: {
      type: String, 
      enum: ["in-trash", "active"],
      default: "active"
    }
  },
});

module.exports.Key = model("Key", keySchema);
