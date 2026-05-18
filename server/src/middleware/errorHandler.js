/**
 * PulseGrid AI — Global Error Handler Middleware
 */

const logger = require('../utils/logger');
const AppError = require('../utils/AppError');
const ApiResponse = require('../utils/apiResponse');

function handlePrismaError(err) {
  switch (err.code) {
    case 'P2002':
      return AppError.conflict(`Duplicate value for field: ${err.meta?.target?.join(', ')}`);
    case 'P2025':
      return AppError.notFound('Record not found');
    case 'P2003':
      return AppError.badRequest('Related record not found (foreign key violation)');
    case 'P2034':
      return AppError.conflict('Transaction conflict — please retry');
    default:
      return new AppError(`Database error: ${err.message}`, 500);
  }
}

function handleJWTError() {
  return AppError.unauthorized('Invalid token. Please log in again.');
}

function handleJWTExpiredError() {
  return AppError.unauthorized('Your token has expired. Please log in again.');
}

function handleZodError(err) {
  const errors = err.errors.map((e) => ({
    field: e.path.join('.'),
    message: e.message,
  }));
  return AppError.badRequest('Validation failed', errors);
}

const errorHandler = (err, req, res, next) => {
  let error = err;

  // Transform known error types
  if (err.name === 'PrismaClientKnownRequestError') {
    error = handlePrismaError(err);
  } else if (err.name === 'JsonWebTokenError') {
    error = handleJWTError();
  } else if (err.name === 'TokenExpiredError') {
    error = handleJWTExpiredError();
  } else if (err.name === 'ZodError') {
    error = handleZodError(err);
  }

  const statusCode = error.statusCode || 500;
  const message = error.isOperational ? error.message : 'Something went wrong';

  // Log server errors
  if (statusCode >= 500) {
    logger.error({
      err: error,
      req: { method: req.method, url: req.url, ip: req.ip },
    }, `[Error] ${error.message}`);
  }

  return ApiResponse.error(res, message, statusCode, error.errors);
};

module.exports = errorHandler;
