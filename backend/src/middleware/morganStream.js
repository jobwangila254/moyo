const logger = require('../utils/logger');

const stream = {
  write: message => logger.http(message.trim()),
};

module.exports = stream;
