/**
 * PulseGrid AI — Simulation Routes
 */

const router = require('express').Router();
const authenticate = require('../../middleware/authenticate');
const { authorize } = require('../../middleware/authorize');
const simulationService = require('./simulation.service');
const ApiResponse = require('../../utils/apiResponse');

router.use(authenticate);
router.use(authorize('admin', 'doctor')); // Only admin/doctor can trigger simulations

// POST /api/simulation/mass-casualty
router.post('/mass-casualty', async (req, res, next) => {
  try {
    const { patientCount = 10, scenario = 'mixed' } = req.body;
    // Run async — return immediately with acknowledgment
    simulationService.simulateMassCasualty({ patientCount, scenario }).catch((err) => {
      require('../../utils/logger').error(`[Simulation] Error: ${err.message}`);
    });
    return ApiResponse.success(res, { patientCount, scenario }, `Mass casualty simulation started (${patientCount} patients)`);
  } catch (err) {
    next(err);
  }
});

// POST /api/simulation/icu-overload
router.post('/icu-overload', async (req, res, next) => {
  try {
    const result = await simulationService.simulateIcuOverload();
    return ApiResponse.success(res, result);
  } catch (err) {
    next(err);
  }
});

// POST /api/simulation/alert-storm
router.post('/alert-storm', async (req, res, next) => {
  try {
    const { count = 5 } = req.body;
    simulationService.simulateAlertStorm(count).catch(() => {});
    return ApiResponse.success(res, null, `Alert storm started (${count} alerts)`);
  } catch (err) {
    next(err);
  }
});

module.exports = router;
