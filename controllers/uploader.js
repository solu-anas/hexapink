const { Table } = require("../models/table");
const { checkAndCreateDir, upload } = require("../utils/filesystem");
const formidable = require("formidable").formidable;

// Route to handle file upload
module.exports.upload = (req, res) => {
  const totalSize = req.headers["content-length"];
  const form = formidable({});

  form.on("fileBegin", (filename, file) => {
    console.log("\nfile upload started", filename);
  });

  form.on("error", (err) => {
    console.error("Error: ", err.message);
    res.send("Error Uploading File");
  });

  // Parse the incoming form data
  form.parse(req, (err, fields, files) => {
    // Handle errors
    // Then Send immediate response to the client
    if (err) {
      res.send("error uploading file");
      console.log("\nerror uploading file", err);
      return;
    }

    const file = files.file[0];
    const originalFilename = file.originalFilename;

    const table = new Table({
      content: {
        title: originalFilename,
      },
      metadata: {
        originalFilename: originalFilename,
      },
    });

    table.save().then((savedTable) => {
      const { uuid } = savedTable.metadata;
      console.log(uuid);

      // Check and Create /uploads directory
      checkAndCreateDir("./uploads", () => {
        // Get the file details

        let readPath = file.filepath;
        let writePath = "./uploads/" + uuid + ".csv";

        // Upload the file
        upload(readPath, writePath, totalSize, (response) => {
          switch (response.status) {
            case "start":
              Table.findOneAndUpdate(savedTable._id, {
                "metadata.status": "upload-in-progress",
              })
              break;
            case "finish":
              process.stdout.cursorTo(0);
              process.stdout.clearLine();
              process.stdout.write("File Uploaded Successfully");
              Table.findOneAndUpdate(savedTable._id, {
                "metadata.status": "upload-complete",
              }).then((updatedTable) => {
                res.json({ tableUUID: updatedTable.metadata.uuid });
              });
              break;
            case "error":
              console.error("\nError: ", response.error);
              res.send("Error Writing File");
              break;

            default:
              break;
          }
        });
      });
    });
  });
};
