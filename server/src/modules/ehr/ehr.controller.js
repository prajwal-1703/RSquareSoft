/**
 * PulseGrid AI — EHR Controller
 */

const ehrService = require('./ehr.service');
const ApiResponse = require('../../utils/apiResponse');

class EhrController {
  async createPatient(req, res, next) {
    try {
      const patient = await ehrService.createPatient(req.body, req.user);
      return ApiResponse.created(res, patient, 'Patient created successfully');
    } catch (err) {
      next(err);
    }
  }

  async getPatient(req, res, next) {
    try {
      const patient = await ehrService.getPatient(req.params.patientId);
      return ApiResponse.success(res, patient);
    } catch (err) {
      next(err);
    }
  }

  async listPatients(req, res, next) {
    try {
      const { page, limit, search, riskLevel } = req.query;
      const result = await ehrService.listPatients({
        page: page ? parseInt(page) : 1,
        limit: limit ? parseInt(limit) : 20,
        search,
        riskLevel,
      });
      return ApiResponse.paginated(res, result.patients, result.pagination);
    } catch (err) {
      next(err);
    }
  }

  async updateEHR(req, res, next) {
    try {
      const result = await ehrService.updateEHR(req.params.patientId, req.body, req.user);
      return ApiResponse.success(res, result, 'EHR updated successfully');
    } catch (err) {
      next(err);
    }
  }

  async getTimeline(req, res, next) {
    try {
      const events = await ehrService.getTimeline(req.params.patientId);
      return ApiResponse.success(res, events);
    } catch (err) {
      next(err);
    }
  }

  async getVersionHistory(req, res, next) {
    try {
      const history = await ehrService.getVersionHistory(req.params.patientId);
      return ApiResponse.success(res, history);
    } catch (err) {
      next(err);
    }
  }

  async rollbackVersion(req, res, next) {
    try {
      const { targetVersion, reason } = req.body;
      const result = await ehrService.rollbackVersion(
        req.params.patientId,
        targetVersion,
        reason,
        req.user
      );
      return ApiResponse.success(res, result, `EHR rolled back to version ${targetVersion}`);
    } catch (err) {
      next(err);
    }
  }
}

module.exports = new EhrController();
