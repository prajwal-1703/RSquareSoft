/**
 * PulseGrid AI — Server Entry Point
 * Bootstraps HTTP server, WebSocket, and database connections
 */

require('dotenv').config();

const http = require('http');
const app = require('./app');
const config = require('./config');
const logger = require('./utils/logger');
const prisma = require('./config/database');
const { connectRedis } = require('./config/redis');
const { initializeWebSocket } = require('./modules/websocket/websocket');

const PORT = config.port;
const HOST = config.host;

async function bootstrap() {
  // 1. Connect to PostgreSQL via Prisma
  try {
    await prisma.$connect();
    logger.info('[DB] PostgreSQL connected via Prisma');
  } catch (err) {
    logger.error(`[DB] Failed to connect to PostgreSQL: ${err.message}`);
    process.exit(1);
  }

  // 2. Connect to Redis (non-fatal — features degrade gracefully)
  await connectRedis();

  // 3. Create HTTP server
  const server = http.createServer(app);

  // 4. Initialize Socket.IO WebSocket server
  initializeWebSocket(server);

  // 5. Start listening
  server.listen(PORT, HOST, () => {
    logger.info(`
╔══════════════════════════════════════════════════════════╗
║         PulseGrid AI — Critical Care Intelligence        ║
║                   Backend API Server                     ║
╠══════════════════════════════════════════════════════════╣
║  Environment : ${config.env.padEnd(41)}║
║  Host        : ${HOST.padEnd(41)}║
║  Port        : ${String(PORT).padEnd(41)}║
║  API Base    : http://${HOST}:${PORT}/api${' '.repeat(Math.max(0, 25 - HOST.length - String(PORT).length))}║
║  Health      : http://${HOST}:${PORT}/health${' '.repeat(Math.max(0, 21 - HOST.length - String(PORT).length))}║
╚══════════════════════════════════════════════════════════╝
    `);
  });

  // 6. Graceful shutdown
  const shutdown = async (signal) => {
    logger.info(`[Server] ${signal} received — shutting down gracefully`);
    server.close(async () => {
      await prisma.$disconnect();
      logger.info('[Server] Graceful shutdown complete');
      process.exit(0);
    });

    // Force exit after 10s
    setTimeout(() => process.exit(1), 10000);
  };

  process.on('SIGTERM', () => shutdown('SIGTERM'));
  process.on('SIGINT', () => shutdown('SIGINT'));

  process.on('unhandledRejection', (reason) => {
    logger.error(`[Server] Unhandled Rejection: ${reason}`);
  });

  process.on('uncaughtException', (err) => {
    logger.error(`[Server] Uncaught Exception: ${err.message}`);
    process.exit(1);
  });
}

bootstrap();
