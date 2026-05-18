/**
 * PulseGrid AI — Notification Service
 */

const prisma = require('../../config/database');
const { notifyUser, notifyRole, emergencyBroadcast, EVENTS } = require('../websocket/websocket');
const logger = require('../../utils/logger');

class NotificationService {
  /**
   * Create and deliver a notification to a specific user.
   */
  async notifyUser(userId, { type, title, message, metadata = {} }) {
    const notification = await prisma.notification.create({
      data: { userId, type, title, message, metadata },
    });

    // Real-time delivery
    await notifyUser(userId, EVENTS.NOTIFICATION, notification);
    return notification;
  }

  /**
   * Broadcast a notification to all users of a specific role.
   */
  async notifyRole(role, { type, title, message, metadata = {} }) {
    // Persist for each user in the role
    const users = await prisma.user.findMany({
      where: { role, isActive: true },
      select: { id: true },
    });

    await prisma.notification.createMany({
      data: users.map((u) => ({ userId: u.id, type, title, message, metadata })),
    });

    // Real-time broadcast to role room
    await notifyRole(role, EVENTS.NOTIFICATION, { type, title, message, metadata });
  }

  /**
   * Broadcast a critical emergency alert to all emergency ops users.
   */
  async emergencyAlert({ title, message, patientId, severity = 'CRITICAL', metadata = {} }) {
    // Create DB alert
    const alert = await prisma.alert.create({
      data: {
        patientId: patientId || null,
        severity,
        title,
        message,
        source: 'system',
        metadata,
      },
    });

    // Broadcast to emergency ops room (doctors + admins)
    await emergencyBroadcast(EVENTS.EMERGENCY_ALERT, {
      alertId: alert.id,
      title,
      message,
      severity,
      patientId,
      timestamp: alert.createdAt,
      metadata,
    });

    logger.warn(`[Notification] EMERGENCY ALERT: ${title}`);
    return alert;
  }

  /**
   * AI risk escalation notification.
   */
  async aiRiskEscalation(patient, prediction) {
    const title = `Critical Risk: ${patient.firstName} ${patient.lastName}`;
    const message = `Patient ${patient.mrn} risk score: ${prediction.risk_score} — ${prediction.recommended_action}`;

    // Alert all doctors
    await this.notifyRole('doctor', {
      type: 'RISK_ALERT',
      title,
      message,
      metadata: { patientId: patient.id, prediction },
    });

    // Broadcast AI escalation event to emergency ops
    await emergencyBroadcast(EVENTS.AI_RISK_ESCALATION, {
      patientId: patient.id,
      mrn: patient.mrn,
      name: `${patient.firstName} ${patient.lastName}`,
      prediction,
      timestamp: new Date(),
    });
  }

  /**
   * Get notifications for a user.
   */
  async getUserNotifications(userId, { page = 1, limit = 20, unreadOnly = false } = {}) {
    const where = { userId };
    if (unreadOnly) where.isRead = false;

    const skip = (page - 1) * limit;
    const [notifications, total, unreadCount] = await Promise.all([
      prisma.notification.findMany({
        where,
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
      }),
      prisma.notification.count({ where }),
      prisma.notification.count({ where: { userId, isRead: false } }),
    ]);

    return {
      notifications,
      unreadCount,
      pagination: { page, limit, total, totalPages: Math.ceil(total / limit) },
    };
  }

  /**
   * Mark notifications as read.
   */
  async markAsRead(userId, notificationIds) {
    await prisma.notification.updateMany({
      where: { id: { in: notificationIds }, userId },
      data: { isRead: true },
    });
  }
}

module.exports = new NotificationService();
