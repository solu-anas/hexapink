const { Schema, model } = require('mongoose');

const recordSchema = new Schema({
    content: {
        type: Object,
        required: true
    },
    metadata: {
        type: Object,
        required: true
    }
});

module.exports.Record = model("Record", recordSchema);