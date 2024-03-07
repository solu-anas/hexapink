const { Schema, model } = require("mongoose");
const { UUID } = require("mongodb");

const tableSchema = new Schema({
  content: {
    type: Object,
    required: true,
  },
  metadata: {
    status: {
      type: String,
      enum: [
        "created",
        "upload-in-progress",
        "insert-in-progress",
        "upload-complete",
        "insert-complete",
        "active",
      ],
      default: "created",
    },
    originalFilename: {
      type: String,
      required: true,
      default: "no-name",
    },
    uuid: {
      type: String,
      default: () => new UUID()
    },
    labels: [Schema.Types.ObjectId],
  },
});

module.exports.Table = model("Table", tableSchema);
