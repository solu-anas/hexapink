const helmet = require('helmet');
const compression = require('compression');

module.exports = (app) => {
    console.log('Setting Production Environment ...');
    app.use(helmet());
    app.use(compression());
}