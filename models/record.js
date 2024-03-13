const { Schema, model, Types } = require('mongoose');

const recordSchema = new Schema({
    content: {
        type: Object,
        required: true
    },
    metadata: {
        status: {
            type: String,
            enum: ["active"],
            default: "active",
            required: true
        },
        tableId: {
            type: Types.ObjectId,
            required: true
        },
        inTrash: {
            type: Boolean,
            default: false,
            required: true
        }
    }
});

module.exports.Record = model("Record", recordSchema);