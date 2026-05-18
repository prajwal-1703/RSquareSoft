/**
 * PulseGrid AI — JWT Authentication Middleware
 */

const jwt = require('jsonwebtoken');
const config = require('../config');
const AppError = require('../utils/AppError');
const prisma = require('../config/database');

const authenticate = async (req, res, next) => {
  try {
    // 1. Get token from Authorization header or cookie
    let token;
    if (req.headers.authorization?.startsWith('Bearer ')) {
      token = req.headers.authorization.split(' ')[1];
    } else if (req.cookies?.access_token) {
      token = req.cookies.access_token;
    }

    if (!token) {
      return next(AppError.unauthorized('Access token required'));
    }

    // 2. Verify token
    const decoded = jwt.verify(token, config.jwt.secret);

    // 3. Check user still exists and is active
    const user = await prisma.user.findFirst({
      where: { id: decoded.id, isActive: true },
      select: {
        id: true,
        email: true,
        firstName: true,
        lastName: true,
        role: true,
        department: true,
      },
    });

    if (!user) {
      return next(AppError.unauthorized('User no longer exists or is deactivated'));
    }

    // 4. Attach user to request
    req.user = user;
    next();
  } catch (err) {
    next(err);
  }
};

module.exports = authenticate;
