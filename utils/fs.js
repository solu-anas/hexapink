const fs = require("fs");

module.exports.checkAndCreateDir = (directoryPath, cb) => {
  fs.access(directoryPath, fs.constants.F_OK, (err) => {
    if (err) {
      // Directory doesn't exist, create it
      fs.mkdir(directoryPath, { recursive: true }, (err) => {
        if (err) {
          console.error("Error creating directory:", err.message);
        } else {
          console.log("Directory created successfully.");
          cb();
        }
      });
    } else {
      console.log("Directory already exists.");
      cb();
    }
  });
};

module.exports.upload = (encoding, readPath, writePath, totalSize, cb) => {
  const readStream = fs.createReadStream(readPath, {encoding});
  const writeStream = fs.createWriteStream(writePath);
  readStream.pipe(writeStream);

  writeStream.on("error", (err) => {
    console.error("\nError writing file:", err);
  });

  let uploadedSize = 0;
  readStream.on("data", (chunk) => {
    if (chunk.includes("\ufffd")) {
      readStream.destroy(new Error(`Invalid ${encoding} character`));
      return;
    }
    uploadedSize += chunk.length;
    const progress = ((uploadedSize / totalSize) * 100).toFixed(2);
    process.stdout.clearLine();
    process.stdout.cursorTo(0);
    process.stdout.write(`Upload Progress: ${progress}%`);
  });

  readStream.once("data", () => {
    cb({ status: "start" });
  })

  writeStream.on("finish", () => {
    cb({ status: "finish", message: "File Uploaded Successfully\n" });
  });


  writeStream.on("error", (err) => {
    cb({ status: "error", error: err });
  });
};
