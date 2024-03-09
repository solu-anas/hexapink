const { Schema, model, Types } = require('mongoose');

const smartTableSchema = new Schema({
    content: {
        type: Object,
        required: true
    },
    metadata: {
        // keys: [Types.ObjectId],
        skeletonTableId: {
            type: String,
            required: true
        },
        sourceTableIds: {
            type: [String],
            default: null
        },
        collections: [Types.ObjectId]
    }
});

module.exports.SmartTable = model("SmartTable", smartTableSchema);