const { Transform } = require('stream');
const { Record } = require('../models/Record');
const { Label } = require('../models/Label');



module.exports.insertTransform = (tableId) => {
  const transformerOpts = {
    async transform(chunk, enc, cb) {
      const newRecord = new Record({
        content: chunk,
        metadata: {
          tableId: tableId,
        },
      });
      newRecord.save().then(() => {
        cb();
      });
    },
    objectMode: true,
  };
  return new Transform(transformerOpts);
};