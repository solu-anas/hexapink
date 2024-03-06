const { Schema, model } = require('mongoose');

const collectionSchema = new Schema({
    content: {
        type: Object,
        required: true
    }
});

module.exports.Collection = model("Collection", collectionSchema);