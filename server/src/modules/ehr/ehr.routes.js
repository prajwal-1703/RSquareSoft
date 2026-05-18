/**
 * PulseGrid AI — EHR Routes
 */

const router = require('express').Router();
const ehrController = require('./ehr.controller');
const authenticate = require('../../middleware/authenticate');
const { authorize, Roles } = require('../../middleware/authorize');
const { validate } = require('../../middleware/validate');
const { createPatientSchema, updateEhrSchema, rollbackSchema } = require('./ehr.validators');

// All EHR routes require authentication
router.use(authenticate);

// GET /api/ehr/patients
router.get('/patients', ehrController.listPatients);

// POST /api/ehr/patients
router.post(
  '/patients',
  authorize(...Roles.CLINICAL),
  validate(createPatientSchema),
  ehrController.createPatient
);

// GET /api/ehr/patients/:patientId
router.get('/patients/:patientId', ehrController.getPatient);

// PATCH /api/ehr/patients/:patientId  (versioned EHR update)
router.patch(
  '/patients/:patientId',
  authorize(...Roles.EHR_EDITORS),
  validate(updateEhrSchema),
  ehrController.updateEHR
);

// GET /api/ehr/patients/:patientId/timeline
router.get('/patients/:patientId/timeline', ehrController.getTimeline);

// GET /api/ehr/patients/:patientId/versions
router.get('/patients/:patientId/versions', ehrController.getVersionHistory);

// POST /api/ehr/patients/:patientId/rollback  (doctors + admin only)
router.post(
  '/patients/:patientId/rollback',
  authorize('doctor', 'admin'),
  validate(rollbackSchema),
  ehrController.rollbackVersion
);

module.exports = router;
