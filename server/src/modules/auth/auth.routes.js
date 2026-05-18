/**
 * PulseGrid AI — Auth Routes
 */

const router = require('express').Router();
const authController = require('./auth.controller');
const authenticate = require('../../middleware/authenticate');
const { authorize } = require('../../middleware/authorize');
const { validate } = require('../../middleware/validate');
const { registerSchema, loginSchema, refreshSchema } = require('./auth.validators');

// POST /api/auth/register
router.post('/register', authenticate, authorize('admin'), validate(registerSchema), authController.register);

// POST /api/auth/login
router.post('/login', validate(loginSchema), authController.login);

// POST /api/auth/refresh
router.post('/refresh', validate(refreshSchema), authController.refresh);

// POST /api/auth/logout  (protected)
router.post('/logout', authenticate, authController.logout);

// GET /api/auth/me  (protected)
router.get('/me', authenticate, authController.getProfile);

module.exports = router;
