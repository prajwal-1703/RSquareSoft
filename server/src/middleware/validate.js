/**
 * PulseGrid AI — Zod Validation Middleware
 */

const { z } = require('zod');
const AppError = require('../utils/AppError');

/**
 * Validate request body against a Zod schema.
 * @param {z.ZodSchema} schema
 */
const validate = (schema) => (req, res, next) => {
  try {
    req.body = schema.parse(req.body);
    next();
  } catch (err) {
    next(err); // Caught by global error handler (ZodError case)
  }
};

/**
 * Validate query parameters against a Zod schema.
 * @param {z.ZodSchema} schema
 */
const validateQuery = (schema) => (req, res, next) => {
  try {
    req.query = schema.parse(req.query);
    next();
  } catch (err) {
    next(err);
  }
};

module.exports = { validate, validateQuery };
