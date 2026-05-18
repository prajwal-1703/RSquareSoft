/**
 * PulseGrid AI — Auth Service
 * JWT, bcrypt, refresh tokens
 */

const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const prisma = require('../../config/database');
const config = require('../../config');
const AppError = require('../../utils/AppError');
const logger = require('../../utils/logger');

class AuthService {
  // ── Token Helpers ────────────────────────────────────────────

  generateAccessToken(user) {
    return jwt.sign(
      { id: user.id, email: user.email, role: user.role },
      config.jwt.secret,
      { expiresIn: config.jwt.expiresIn }
    );
  }

  generateRefreshToken(user) {
    return jwt.sign(
      { id: user.id },
      config.jwt.refreshSecret,
      { expiresIn: config.jwt.refreshExpiresIn }
    );
  }

  // ── Register ─────────────────────────────────────────────────

  async register(data) {
    const existing = await prisma.user.findUnique({ where: { email: data.email } });
    if (existing) {
      throw AppError.conflict('Email already in use');
    }

    const hashedPassword = await bcrypt.hash(data.password, 12);

    const user = await prisma.user.create({
      data: {
        email: data.email,
        password: hashedPassword,
        firstName: data.firstName,
        lastName: data.lastName,
        role: data.role,
        department: data.department,
        phone: data.phone,
      },
      select: {
        id: true,
        email: true,
        firstName: true,
        lastName: true,
        role: true,
        department: true,
        createdAt: true,
      },
    });

    logger.info(`[Auth] New user registered: ${user.email} (${user.role})`);
    return user;
  }

  // ── Login ────────────────────────────────────────────────────

  async login(email, password, ipAddress) {
    const user = await prisma.user.findUnique({ where: { email } });

    if (!user || !user.isActive) {
      throw AppError.unauthorized('Invalid credentials');
    }

    const isPasswordValid = await bcrypt.compare(password, user.password);
    if (!isPasswordValid) {
      throw AppError.unauthorized('Invalid credentials');
    }

    const accessToken = this.generateAccessToken(user);
    const refreshToken = this.generateRefreshToken(user);

    // Persist refresh token
    await prisma.user.update({
      where: { id: user.id },
      data: {
        refreshToken: await bcrypt.hash(refreshToken, 8),
        lastLoginAt: new Date(),
      },
    });

    logger.info(`[Auth] Login: ${user.email} from ${ipAddress}`);

    return {
      accessToken,
      refreshToken,
      user: {
        id: user.id,
        email: user.email,
        firstName: user.firstName,
        lastName: user.lastName,
        role: user.role,
        department: user.department,
      },
    };
  }

  // ── Refresh Token ────────────────────────────────────────────

  async refreshAccessToken(refreshToken) {
    let decoded;
    try {
      decoded = jwt.verify(refreshToken, config.jwt.refreshSecret);
    } catch {
      throw AppError.unauthorized('Invalid or expired refresh token');
    }

    const user = await prisma.user.findFirst({
      where: { id: decoded.id, isActive: true },
    });

    if (!user || !user.refreshToken) {
      throw AppError.unauthorized('Refresh token revoked');
    }

    const isTokenValid = await bcrypt.compare(refreshToken, user.refreshToken);
    if (!isTokenValid) {
      throw AppError.unauthorized('Invalid refresh token');
    }

    const newAccessToken = this.generateAccessToken(user);
    const newRefreshToken = this.generateRefreshToken(user);

    await prisma.user.update({
      where: { id: user.id },
      data: { refreshToken: await bcrypt.hash(newRefreshToken, 8) },
    });

    return { accessToken: newAccessToken, refreshToken: newRefreshToken };
  }

  // ── Logout ───────────────────────────────────────────────────

  async logout(userId) {
    await prisma.user.update({
      where: { id: userId },
      data: { refreshToken: null },
    });
    logger.info(`[Auth] Logout: user ${userId}`);
  }

  // ── Get Profile ──────────────────────────────────────────────

  async getProfile(userId) {
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        email: true,
        firstName: true,
        lastName: true,
        role: true,
        department: true,
        phone: true,
        lastLoginAt: true,
        createdAt: true,
      },
    });

    if (!user) throw AppError.notFound('User not found');
    return user;
  }
}

module.exports = new AuthService();
