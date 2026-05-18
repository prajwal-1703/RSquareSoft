/**
 * PulseGrid AI — AI Routes
 */

const router = require('express').Router();
const authenticate = require('../../middleware/authenticate');
const aiService = require('./ai.service');
const ApiResponse = require('../../utils/apiResponse');

router.use(authenticate);

// POST /api/ai/predict
router.post('/predict', async (req, res, next) => {
  try {
    const prediction = await aiService.predictRisk(req.body);
    return ApiResponse.success(res, prediction, 'Risk prediction complete');
  } catch (err) {
    next(err);
  }
});

// GET /api/ai/health
router.get('/health', async (req, res, next) => {
  try {
    const healthy = await aiService.healthCheck();
    return ApiResponse.success(res, { status: healthy ? 'online' : 'offline' });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
