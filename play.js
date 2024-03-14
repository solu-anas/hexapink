const { Table } = require("./models/Table");

// we have valid ids
const validIds = ["5434543", "78941643", "43657431", "534345357"]



function activateTableWithId(tableId) {
    // code start
    Table.findByIdAndUpdate(tableId, { "metadata.status": "active" })
        .then((x) => {
            // code end
          console.log(x);
        })
        .catch((err) => {
          console.error('Error: ', err.message);
          return res.status(500).send('Something Went Wrong.');
        })
}