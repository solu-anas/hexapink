const { Schema, model } = require("mongoose");
const { UUID } = require("mongodb");

const tableSchema = new Schema({
  content: {
    tableName: {
      type: String,
      required: true
    }
  },
  metadata: {
    status: {
      type: String,
      enum: [
        "created",
        "upload-in-progress",
        "convert-in-progress",
        "upload-complete",
        "convert-complete",
        // "active",
        "in-trash"
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
