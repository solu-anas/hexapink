const { Schema, model, Types } = require('mongoose');

const smartTableSchema = new Schema({
    content: {
        type: Object,
        required: true
    },
    metadata: {
        // keys: [Types.ObjectId],
        skeletonTableId: {
            type: Types.ObjectId,
            required: true
        },
        sourceTables: [Types.ObjectId],
        collections: [Types.ObjectId]
    }
});

module.exports.SmartTable = model("SmartTable", smartTableSchema);