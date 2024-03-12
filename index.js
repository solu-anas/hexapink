const express = require("express");
const app = express();

require('./start/db')();
require('./start/prod')(app);
require('./start/routes')(app);

const port = process.env.PORT || 8000;
const server = app.listen(port, () => console.log(`Listening to port 8000 ...`));
server.on('clientError', (err) => {
  console.error('Error: ', err.message);
});