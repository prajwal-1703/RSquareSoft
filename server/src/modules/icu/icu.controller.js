/**
 * PulseGrid AI — ICU Controller
 */

const icuService = require('./icu.service');
const ApiResponse = require('../../utils/apiResponse');

class IcuController {
  async allocate(req, res, next) {
    try {
      const allocation = await icuService.allocateResource(req.body, req.user);
      return ApiResponse.created(res, allocation, 'Resource allocated successfully');
    } catch (err) {
      next(err);
    }
  }

  async release(req, res, next) {
    try {
      const result = await icuService.releaseResource(req.params.allocationId, req.user);
      return ApiResponse.success(res, result, 'Resource released successfully');
    } catch (err) {
      next(err);
    }
  }

  async reassign(req, res, next) {
    try {
      const { newPatientId, reason } = req.body;
      const result = await icuService.reassignResource(
        req.params.allocationId,
        newPatientId,
        reason,
        req.user
      );
      return ApiResponse.success(res, result, 'Resource reassigned successfully');
    } catch (err) {
      next(err);
    }
  }

  async getOccupancy(req, res, next) {
    try {
      const occupancy = await icuService.getOccupancy();
      return ApiResponse.success(res, occupancy);
    } catch (err) {
      next(err);
    }
  }

  async getEmergencyQueue(req, res, next) {
    try {
      const queue = await icuService.getEmergencyQueue();
      return ApiResponse.success(res, queue);
    } catch (err) {
      next(err);
    }
  }

  async triggerPrediction(req, res, next) {
    try {
      const prediction = await icuService.triggerAIPrediction(req.params.patientId);
      return ApiResponse.success(res, prediction, 'AI risk prediction updated');
    } catch (err) {
      next(err);
    }
  }
}

module.exports = new IcuController();
