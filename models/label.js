const { Types, Schema, model } = require("mongoose");

const labelSchema = new Schema({
  content: {
    name: {
      type: String,
      required: true,
    },
  },
  metadata: {
    keyId: {
      type: Types.ObjectId,
    },
    type: {
      type: String,
      enum: ["undefined", "string", "number", "boolean"],
      default: "undefined",
      required: true,
    },
  },
});

module.exports.Label = model("Label", labelSchema);
