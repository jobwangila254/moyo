const logger = require('../utils/logger');

class AppError extends Error {
  constructor(message, statusCode) {
    super(message);
    this.statusCode = statusCode;
    this.isOperational = true;
    Error.captureStackTrace(this, this.constructor);
  }
}

const handleJWTError = () => new AppError('Invalid token. Please log in again.', 401);
const handleJWTExpired = () => new AppError('Token expired. Please log in again.', 401);
const handleValidationError = err => {
  const message = Object.values(err.errors)
    .map(e => e.message)
    .join('. ');
  return new AppError(message, 400);
};
const handlePrismaError = err => {
  if (err.code === 'P2002') {
    return new AppError('A record with this value already exists.', 409);
  }
  if (err.code === 'P2025') {
    return new AppError('Record not found.', 404);
  }
  return new AppError('Database error. Please try again.', 500);
};

const notFound = (req, res, next) => {
  next(new AppError(`Route ${req.originalUrl} not found`, 404));
};

const errorHandler = (err, req, res, _next) => {
  let error = { ...err, message: err.message };

  if (err.name === 'JsonWebTokenError') {
    error = handleJWTError();
  }
  if (err.name === 'TokenExpiredError') {
    error = handleJWTExpired();
  }
  if (err.name === 'ValidationError') {
    error = handleValidationError(err);
  }
  if (err.code && err.code.startsWith('P')) {
    error = handlePrismaError(err);
  }

  if (error.statusCode === 500 || !error.statusCode) {
    logger.error(`Unhandled error: ${err.message}`, {
      stack: err.stack,
      url: req.originalUrl,
      method: req.method,
    });
  }

  res.status(error.statusCode || 500).json({
    success: false,
    error: error.message || 'Internal server error',
    ...(process.env.NODE_ENV === 'development' && { stack: err.stack }),
  });
};

module.exports = { AppError, notFound, errorHandler };
