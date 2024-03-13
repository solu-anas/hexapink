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
      enum: ["active"],
      default: "active"
    },
    inTrash: {
      type: Boolean,
      required: true,
      default: false
    }
  },
});

module.exports.Key = model("Key", keySchema);