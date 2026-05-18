/**
 * PulseGrid AI — Express App Configuration
 */

const express = require('express');
const helmet = require('helmet');
const cors = require('cors');
const cookieParser = require('cookie-parser');
const rateLimit = require('express-rate-limit');

const config = require('./config');
const requestLogger = require('./middleware/requestLogger');
const errorHandler = require('./middleware/errorHandler');
const ApiResponse = require('./utils/apiResponse');

// ── Import Routes ────────────────────────────────────────────────
const authRoutes = require('./modules/auth/auth.routes');
const ehrRoutes = require('./modules/ehr/ehr.routes');
const icuRoutes = require('./modules/icu/icu.routes');
const aiRoutes = require('./modules/ai/ai.routes');
const auditRoutes = require('./modules/audit/audit.routes');
const notificationRoutes = require('./modules/notifications/notification.routes');
const simulationRoutes = require('./modules/simulation/simulation.routes');

const app = express();

// ── Security Middleware ──────────────────────────────────────────
app.use(helmet());

app.use(
  cors({
    origin: config.cors.origin,
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization'],
  })
);

// ── Rate Limiting ────────────────────────────────────────────────
const globalLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 500,
  standardHeaders: true,
  legacyHeaders: false,
  message: { success: false, message: 'Too many requests, please try again later.' },
});

const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 20,
  message: { success: false, message: 'Too many auth attempts. Please wait.' },
});

app.use(globalLimiter);

// ── Body Parsing ─────────────────────────────────────────────────
app.use(express.json({ limit: '1mb' }));
app.use(express.urlencoded({ extended: true }));
app.use(cookieParser());

// ── Request Logging ──────────────────────────────────────────────
app.use(requestLogger);

// ── Health Check ─────────────────────────────────────────────────
app.get('/health', (req, res) => {
  return ApiResponse.success(res, {
    service: 'PulseGrid AI API',
    version: '1.0.0',
    status: 'healthy',
    timestamp: new Date(),
  });
});

// ── API Routes ───────────────────────────────────────────────────
app.use('/api/auth', authLimiter, authRoutes);
app.use('/api/ehr', ehrRoutes);
app.use('/api/icu', icuRoutes);
app.use('/api/ai', aiRoutes);
app.use('/api/audit', auditRoutes);
app.use('/api/notifications', notificationRoutes);
app.use('/api/simulation', simulationRoutes);

// ── 404 Handler ──────────────────────────────────────────────────
app.use((req, res) => {
  return ApiResponse.notFound(res, `Route ${req.method} ${req.url} not found`);
});

// ── Global Error Handler ─────────────────────────────────────────
app.use(errorHandler);

module.exports = app;
