/**
 * PulseGrid AI — Audit Routes
 */

const router = require('express').Router();
const authenticate = require('../../middleware/authenticate');
const { authorize, Roles } = require('../../middleware/authorize');
const auditService = require('./audit.service');
const ApiResponse = require('../../utils/apiResponse');

router.use(authenticate);
router.use(authorize(...Roles.AUDIT_VIEWERS)); // Only doctors and admin

// GET /api/audit/logs
router.get('/logs', async (req, res, next) => {
  try {
    const { entity, entityId, userId, action, startDate, endDate, page, limit } = req.query;
    const result = await auditService.getLogs({
      entity, entityId, userId, action, startDate, endDate,
      page: page ? parseInt(page) : 1,
      limit: limit ? parseInt(limit) : 50,
    });
    return ApiResponse.paginated(res, result.logs, result.pagination);
  } catch (err) {
    next(err);
  }
});

// GET /api/audit/entity/:entity/:entityId
router.get('/entity/:entity/:entityId', async (req, res, next) => {
  try {
    const timeline = await auditService.getEntityTimeline(req.params.entity, req.params.entityId);
    return ApiResponse.success(res, timeline);
  } catch (err) {
    next(err);
  }
});

module.exports = router;
