const logger = require('./logger');

const catchAsync = fn => (req, res, next) => {
  return Promise.resolve(fn(req, res, next)).catch(error => {
    const method = req ? req.method : 'UNKNOWN';
    const url = req ? req.originalUrl : 'UNKNOWN';
    const userId = req ? req.userId : undefined;
    logger.error(`${method} ${url} — ${error.message}`, {
      stack: error.stack,
      userId,
    });
    if (next) {
      next(error);
    }
  });
};

module.exports = catchAsync;
