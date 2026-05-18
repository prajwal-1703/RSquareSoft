/**
 * PulseGrid AI — Role-Based Access Control (RBAC) Middleware
 */

const AppError = require('../utils/AppError');

/**
 * Restrict route to specific roles.
 * @param {...string} roles - Allowed roles
 */
const authorize = (...roles) => {
  return (req, res, next) => {
    if (!req.user) {
      return next(AppError.unauthorized('Authentication required'));
    }

    if (!roles.includes(req.user.role)) {
      return next(
        AppError.forbidden(
          `Role '${req.user.role}' is not authorized to perform this action. Required: ${roles.join(' | ')}`
        )
      );
    }

    next();
  };
};

// Predefined role groups for convenience
const Roles = {
  ALL: ['doctor', 'nurse', 'admin', 'lab_technician'],
  CLINICAL: ['doctor', 'nurse'],
  ADMIN_ONLY: ['admin'],
  DOCTORS_ONLY: ['doctor'],
  ALLOCATORS: ['doctor', 'admin'],
  AUDIT_VIEWERS: ['admin', 'doctor'],
  LAB_AND_DOCTOR: ['doctor', 'lab_technician'],
};

module.exports = { authorize, Roles };
