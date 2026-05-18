/**
 * PulseGrid AI — Socket.IO + Redis Pub/Sub WebSocket Infrastructure
 */

const { Server } = require('socket.io');
const jwt = require('jsonwebtoken');
const config = require('../../config');
const { getRedis, getRedisSub } = require('../../config/redis');
const logger = require('../../utils/logger');
const prisma = require('../../config/database');

// ── Event Constants ─────────────────────────────────────────────

const EVENTS = {
  // Server → Client
  PATIENT_UPDATED: 'patient:updated',
  ICU_ALLOCATED: 'icu:allocated',
  ICU_RELEASED: 'icu:released',
  ICU_REASSIGNED: 'icu:reassigned',
  EMERGENCY_ALERT: 'emergency:alert',
  AI_RISK_ESCALATION: 'ai:risk_escalation',
  OCCUPANCY_UPDATE: 'icu:occupancy_update',
  NOTIFICATION: 'notification:new',
  SIMULATION_EVENT: 'simulation:event',

  // Client → Server
  JOIN_ROOM: 'room:join',
  LEAVE_ROOM: 'room:leave',
  ACK_ALERT: 'alert:acknowledge',
};

// ── Redis Pub/Sub Channel ───────────────────────────────────────
const REDIS_CHANNEL = 'pulsegrid:events';

let io;

function initializeWebSocket(httpServer) {
  io = new Server(httpServer, {
    cors: {
      origin: config.cors.origin,
      methods: ['GET', 'POST'],
      credentials: true,
    },
    pingTimeout: 30000,
    pingInterval: 10000,
  });

  // ── JWT Authentication for WebSocket ─────────────────────────
  io.use(async (socket, next) => {
    try {
      const token =
        socket.handshake.auth?.token ||
        socket.handshake.headers?.authorization?.replace('Bearer ', '');

      if (!token) return next(new Error('Authentication token required'));

      const decoded = jwt.verify(token, config.jwt.secret);
      const user = await prisma.user.findFirst({
        where: { id: decoded.id, isActive: true },
        select: { id: true, email: true, firstName: true, lastName: true, role: true },
      });

      if (!user) return next(new Error('User not found'));
      socket.user = user;
      next();
    } catch (err) {
      next(new Error('Invalid token'));
    }
  });

  // ── Connection Handler ─────────────────────────────────────────
  io.on('connection', (socket) => {
    const user = socket.user;
    logger.info(`[WS] Connected: ${user.email} (${user.role}) — socket ${socket.id}`);

    // Auto-join role-based room
    socket.join(`role:${user.role}`);
    socket.join(`user:${user.id}`);

    // Doctors and admins also join emergency ops room
    if (['doctor', 'admin'].includes(user.role)) {
      socket.join('emergency:ops');
    }

    // Manual room join
    socket.on(EVENTS.JOIN_ROOM, (room) => {
      socket.join(room);
      logger.debug(`[WS] ${user.email} joined room: ${room}`);
    });

    socket.on(EVENTS.LEAVE_ROOM, (room) => {
      socket.leave(room);
    });

    socket.on(EVENTS.ACK_ALERT, async (alertId) => {
      try {
        await prisma.alert.update({
          where: { id: alertId },
          data: {
            status: 'ACKNOWLEDGED',
            acknowledgedBy: user.id,
            acknowledgedAt: new Date(),
          },
        });
        logger.info(`[WS] Alert ${alertId} acknowledged by ${user.email}`);
      } catch (err) {
        logger.error(`[WS] Alert ack failed: ${err.message}`);
      }
    });

    socket.on('disconnect', (reason) => {
      logger.info(`[WS] Disconnected: ${user.email} — ${reason}`);
    });

    socket.on('error', (err) => {
      logger.error(`[WS] Socket error for ${user.email}: ${err.message}`);
    });
  });

  // ── Redis Subscriber for cross-process events ─────────────────
  setupRedisSub();

  logger.info('[WS] Socket.IO server initialized');
  return io;
}

function setupRedisSub() {
  const redisSub = getRedisSub();

  redisSub.subscribe(REDIS_CHANNEL, (err) => {
    if (err) {
      logger.warn(`[Redis:sub] Failed to subscribe: ${err.message}`);
      return;
    }
    logger.info(`[Redis:sub] Subscribed to ${REDIS_CHANNEL}`);
  });

  redisSub.on('message', (channel, rawMessage) => {
    if (channel !== REDIS_CHANNEL) return;
    try {
      const { event, room, data } = JSON.parse(rawMessage);
      if (io) {
        if (room) {
          io.to(room).emit(event, data);
        } else {
          io.emit(event, data);
        }
      }
    } catch (err) {
      logger.error(`[Redis:sub] Message parse error: ${err.message}`);
    }
  });
}

/**
 * Broadcast an event via Redis Pub/Sub (works across multiple server instances).
 * @param {string} event - Socket.IO event name
 * @param {any} data - Event payload
 * @param {string} [room] - Target room (optional — broadcasts to all if omitted)
 */
async function broadcast(event, data, room = null) {
  try {
    const redis = getRedis();
    await redis.publish(REDIS_CHANNEL, JSON.stringify({ event, room, data }));
  } catch (err) {
    // Fallback: direct emit if Redis is unavailable
    logger.warn(`[WS] Redis publish failed, direct emit fallback: ${err.message}`);
    if (io) {
      if (room) {
        io.to(room).emit(event, data);
      } else {
        io.emit(event, data);
      }
    }
  }
}

/**
 * Emit directly to a specific user's socket room.
 */
async function notifyUser(userId, event, data) {
  return broadcast(event, data, `user:${userId}`);
}

/**
 * Emit to all users of a given role.
 */
async function notifyRole(role, event, data) {
  return broadcast(event, data, `role:${role}`);
}

/**
 * Emit to emergency operations room (doctors + admins).
 */
async function emergencyBroadcast(event, data) {
  return broadcast(event, data, 'emergency:ops');
}

function getIO() {
  return io;
}

module.exports = {
  initializeWebSocket,
  broadcast,
  notifyUser,
  notifyRole,
  emergencyBroadcast,
  getIO,
  EVENTS,
};
