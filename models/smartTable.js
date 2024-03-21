const { Schema, model, Types } = require('mongoose');

const smartTableSchema = new Schema({
    content: {
        type: Object,
        required: true
    },
    metadata: {
        status: {
            type: String,
            enum: ["active"],
            default: "active"
        },
        inTrash: {
            type: Boolean,
            default: false,
            required: true
        },
        keysList: {
            type: [String],
            required: true
        },
        sourceTableIds: {
            type: [String],
            default: null
        },
        collections: [Types.ObjectId]
    }
}, { timestamps: true });

module.exports.SmartTable = model("SmartTable", smartTableSchema);