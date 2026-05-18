/**
 * PulseGrid AI — ICU Routes
 */

const router = require('express').Router();
const icuController = require('./icu.controller');
const authenticate = require('../../middleware/authenticate');
const { authorize, Roles } = require('../../middleware/authorize');

router.use(authenticate);

// POST /api/icu/allocate
router.post('/allocate', authorize(...Roles.ALLOCATORS), icuController.allocate);

// PATCH /api/icu/release/:allocationId
router.patch('/release/:allocationId', authorize(...Roles.ALLOCATORS), icuController.release);

// PATCH /api/icu/reassign/:allocationId
router.patch('/reassign/:allocationId', authorize(...Roles.ALLOCATORS), icuController.reassign);

// GET /api/icu/occupancy
router.get('/occupancy', icuController.getOccupancy);

// GET /api/icu/emergency-queue
router.get('/emergency-queue', icuController.getEmergencyQueue);

// POST /api/icu/predict/:patientId
router.post('/predict/:patientId', authorize(...Roles.CLINICAL), icuController.triggerPrediction);

module.exports = router;
