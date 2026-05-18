/**
 * PulseGrid AI — Pino Logger
 */

const pino = require('pino');
const config = require('../config');

const logger = pino({
  level: config.logging.level,
  transport:
    config.env === 'development'
      ? {
          target: 'pino-pretty',
          options: {
            colorize: true,
            translateTime: 'SYS:standard',
            ignore: 'pid,hostname',
          },
        }
      : undefined,
  base: {
    service: 'pulsegrid-api',
  },
});

module.exports = logger;
