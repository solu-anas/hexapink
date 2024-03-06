module.exports.updateKey = (label, newKeyId, cb) => {
  label.metadata.keyId = newKeyId;
  label
    .save()
    .then(() => {
      cb({ type: "success", message: "label updated" });
    })
    .catch((err) => {
      console.log(err.message);
      cb({ type: "error", message: "error saving label" });
    });
};
