/**
 * PulseGrid AI — Immutable Audit Logging Service
 */

const prisma = require('../../config/database');
const logger = require('../../utils/logger');

class AuditService {
  /**
   * Create an immutable audit log entry.
   * Safe to call outside transactions (fire-and-forget ok via setImmediate).
   */
  async log({ userId, action, entity, entityId, previousValue, newValue, ipAddress, userAgent, metadata }) {
    try {
      await prisma.auditLog.create({
        data: {
          userId: userId || null,
          action,
          entity,
          entityId: entityId || null,
          previousValue: previousValue || undefined,
          newValue: newValue || undefined,
          ipAddress: ipAddress || null,
          userAgent: userAgent || null,
          metadata: metadata || undefined,
        },
      });
    } catch (err) {
      // Audit log failure should never crash the main request
      logger.error(`[Audit] Failed to write log: ${err.message}`);
    }
  }

  /**
   * Query audit logs with filtering and pagination.
   */
  async getLogs({ entity, entityId, userId, action, startDate, endDate, page = 1, limit = 50 } = {}) {
    const where = {};

    if (entity) where.entity = entity;
    if (entityId) where.entityId = entityId;
    if (userId) where.userId = userId;
    if (action) where.action = { contains: action, mode: 'insensitive' };
    if (startDate || endDate) {
      where.createdAt = {};
      if (startDate) where.createdAt.gte = new Date(startDate);
      if (endDate) where.createdAt.lte = new Date(endDate);
    }

    const skip = (page - 1) * limit;

    const [logs, total] = await Promise.all([
      prisma.auditLog.findMany({
        where,
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
        include: {
          user: {
            select: { id: true, firstName: true, lastName: true, role: true, email: true },
          },
        },
      }),
      prisma.auditLog.count({ where }),
    ]);

    return {
      logs,
      pagination: { page, limit, total, totalPages: Math.ceil(total / limit) },
    };
  }

  /**
   * Get the audit timeline for a specific entity (e.g., a patient).
   */
  async getEntityTimeline(entity, entityId) {
    return prisma.auditLog.findMany({
      where: { entity, entityId },
      orderBy: { createdAt: 'asc' },
      include: {
        user: { select: { id: true, firstName: true, lastName: true, role: true } },
      },
    });
  }
}

module.exports = new AuditService();
