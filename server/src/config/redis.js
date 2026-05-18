/**
 * PulseGrid AI — Redis Client
 */

const Redis = require('ioredis');
const config = require('./index');
const logger = require('../utils/logger');

let redis;
let redisSub;

function createRedisClient(name = 'main') {
  const client = new Redis(config.redis.url, {
    maxRetriesPerRequest: 3,
    retryStrategy(times) {
      const delay = Math.min(times * 200, 5000);
      return delay;
    },
    lazyConnect: true,
  });

  client.on('connect', () => {
    logger.info(`[Redis:${name}] Connected`);
  });

  client.on('error', (err) => {
    logger.error(`[Redis:${name}] Error: ${err.message}`);
  });

  return client;
}

function getRedis() {
  if (!redis) {
    redis = createRedisClient('main');
  }
  return redis;
}

function getRedisSub() {
  if (!redisSub) {
    redisSub = createRedisClient('subscriber');
  }
  return redisSub;
}

async function connectRedis() {
  try {
    const client = getRedis();
    await client.connect();
    logger.info('[Redis] Main client connected successfully');
  } catch (err) {
    logger.warn(`[Redis] Connection failed (non-fatal): ${err.message}`);
  }
}

module.exports = { getRedis, getRedisSub, connectRedis };
