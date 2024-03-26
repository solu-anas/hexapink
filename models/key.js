const { Schema, model } = require("mongoose");

const keySchema = new Schema({
  content: {
    type: Object,
  },
  metadata: {
    keyType: {
      type: String,
      default: "all",
    },
    isActive: {
      type: Boolean,
      default: true
    },
    inTrash: {
      type: Boolean,
      required: true,
      default: false
    }
  },
}, {timestamps: true});

module.exports.Key = model("Key", keySchema);