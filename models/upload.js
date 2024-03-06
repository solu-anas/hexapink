const { Schema, Types, model } = require('mongoose');

const uploadSchema = new Schema({
    originalName: {
        type: String
    },
    uuid: {
        type: Types.UUID,
        required: true
    },
    size: {
        type: Number
    },
    createdAt: {
        type: Date,
        default: Date.now
    }
});

const Upload = model('Upload', uploadSchema);

module.exports.Upload = Upload;