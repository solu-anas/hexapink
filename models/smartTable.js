const { Schema, model, Types } = require('mongoose');

const smartTableSchema = new Schema({
    content: {
        type: Object,
        required: true
    },
    metadata: {
        skeletonTableId: Types.ObjectId,
        collections: [Types.ObjectId]
    }
});

module.exports.SmartTable = model("SmartTable", smartTableSchema);