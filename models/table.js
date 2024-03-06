const { Schema, model, Types } = require('mongoose');
const { randomUUID } = require('crypto');

const tableSchema = new Schema({
    content: {
        type: Object,
        required: true
    },
    metadata: {
        status: {
            type: String,
            enum: ['created', 'upload-in-progress', 'insert-in-progress', 'upload-complete', 'insert-complete'],
            default: 'created'
        },
        originalFilename: {
            type: String,
            required: true,
            default: "no-name"
        },
        uuid: {
            type: Types.UUID,
            default: () => {return randomUUID()}
        },
        smartTables: [Types.ObjectId],
        labels: [Types.ObjectId]
    }
});

module.exports.Table = model('Table', tableSchema);