/**
 * PulseGrid AI — ICU Resource Allocation Service
 * Concurrent-safe with PostgreSQL row-level locking (SELECT FOR UPDATE)
 */

const prisma = require('../../config/database');
const AppError = require('../../utils/AppError');
const logger = require('../../utils/logger');
const auditService = require('../audit/audit.service');
const aiService = require('../ai/ai.service');

class IcuService {
  // ── Allocate ICU Resource ────────────────────────────────────

  async allocateResource({ patientId, resourceType, reason }, requestingUser) {
    return await prisma.$transaction(async (tx) => {
      // 1. Validate patient exists and is active
      const patient = await tx.patient.findUnique({ where: { id: patientId } });
      if (!patient || !patient.isActive) {
        throw AppError.notFound('Patient not found or inactive');
      }

      // 2. Check patient doesn't already have this resource type
      const existingAllocation = await tx.allocation.findFirst({
        where: {
          patientId,
          status: 'ACTIVE',
          resource: { resourceType },
        },
        include: { resource: true },
      });

      if (existingAllocation) {
        throw AppError.conflict(
          `Patient already has an active ${resourceType} allocation (${existingAllocation.resource.identifier})`
        );
      }

      // 3. Find available resource using row-level locking (SELECT FOR UPDATE)
      // Prisma doesn't support FOR UPDATE natively, so we use $queryRaw
      const availableResources = await tx.$queryRaw`
        SELECT id, identifier, location
        FROM icu_resources
        WHERE resource_type = ${resourceType}::"ResourceType"
          AND status = 'AVAILABLE'::"ResourceStatus"
        ORDER BY id
        LIMIT 1
        FOR UPDATE SKIP LOCKED
      `;

      if (!availableResources || availableResources.length === 0) {
        throw AppError.conflict(
          `No available ${resourceType} resources. All units are occupied or in maintenance.`
        );
      }

      const resource = availableResources[0];

      // 4. Calculate priority score (from AI risk score + severity)
      const priorityScore = patient.currentRiskScore || 50;

      // 5. Mark resource as OCCUPIED
      await tx.icuResource.update({
        where: { id: resource.id },
        data: { status: 'OCCUPIED' },
      });

      // 6. Create allocation record
      const allocation = await tx.allocation.create({
        data: {
          resourceId: resource.id,
          patientId,
          allocatedById: requestingUser.id,
          priorityScore,
          reason,
          status: 'ACTIVE',
        },
        include: {
          resource: true,
          patient: { select: { mrn: true, firstName: true, lastName: true } },
        },
      });

      setImmediate(() => {
        auditService.log({
          userId: requestingUser.id,
          action: 'ALLOCATE_RESOURCE',
          entity: 'Allocation',
          entityId: allocation.id,
          newValue: { resourceId: resource.id, patientId, resourceType },
        });
      });

      logger.info(
        `[ICU] ${resourceType} ${resource.identifier} allocated to patient ${patient.mrn}`
      );

      return allocation;
    });
  }

  // ── Release Resource ─────────────────────────────────────────

  async releaseResource(allocationId, requestingUser) {
    return await prisma.$transaction(async (tx) => {
      const allocation = await tx.allocation.findUnique({
        where: { id: allocationId },
        include: { resource: true, patient: true },
      });

      if (!allocation) throw AppError.notFound('Allocation not found');
      if (allocation.status !== 'ACTIVE') {
        throw AppError.badRequest('Allocation is already released or transferred');
      }

      // Release resource
      await tx.icuResource.update({
        where: { id: allocation.resourceId },
        data: { status: 'AVAILABLE' },
      });

      const updated = await tx.allocation.update({
        where: { id: allocationId },
        data: { status: 'RELEASED', releasedAt: new Date() },
        include: { resource: true },
      });

      setImmediate(() => {
        auditService.log({
          userId: requestingUser.id,
          action: 'RELEASE_RESOURCE',
          entity: 'Allocation',
          entityId: allocationId,
          newValue: { resourceId: allocation.resourceId, status: 'RELEASED' },
        });
      });

      logger.info(
        `[ICU] ${allocation.resource.resourceType} ${allocation.resource.identifier} released by ${requestingUser.email}`
      );

      return updated;
    });
  }

  // ── Reassign Resource ────────────────────────────────────────

  async reassignResource(allocationId, newPatientId, reason, requestingUser) {
    return await prisma.$transaction(async (tx) => {
      const allocation = await tx.allocation.findUnique({
        where: { id: allocationId },
        include: { resource: true },
      });

      if (!allocation || allocation.status !== 'ACTIVE') {
        throw AppError.notFound('Active allocation not found');
      }

      const newPatient = await tx.patient.findUnique({ where: { id: newPatientId } });
      if (!newPatient) throw AppError.notFound('New patient not found');

      // Close old allocation
      await tx.allocation.update({
        where: { id: allocationId },
        data: { status: 'TRANSFERRED', releasedAt: new Date() },
      });

      // Create new allocation
      const newAllocation = await tx.allocation.create({
        data: {
          resourceId: allocation.resourceId,
          patientId: newPatientId,
          allocatedById: requestingUser.id,
          priorityScore: newPatient.currentRiskScore || 50,
          reason: `Reassigned: ${reason}`,
          status: 'ACTIVE',
        },
        include: { resource: true, patient: true },
      });

      setImmediate(() => {
        auditService.log({
          userId: requestingUser.id,
          action: 'REASSIGN_RESOURCE',
          entity: 'Allocation',
          entityId: allocationId,
          previousValue: { patientId: allocation.patientId },
          newValue: { newPatientId, newAllocationId: newAllocation.id, reason },
        });
      });

      logger.info(`[ICU] Resource reassigned from ${allocation.patientId} to ${newPatientId}`);
      return newAllocation;
    });
  }

  // ── Get ICU Occupancy ────────────────────────────────────────

  async getOccupancy() {
    const [beds, ventilators] = await Promise.all([
      prisma.icuResource.groupBy({
        by: ['status'],
        where: { resourceType: 'ICU_BED' },
        _count: { id: true },
      }),
      prisma.icuResource.groupBy({
        by: ['status'],
        where: { resourceType: 'VENTILATOR' },
        _count: { id: true },
      }),
    ]);

    const toMap = (groups) => {
      const map = { AVAILABLE: 0, OCCUPIED: 0, MAINTENANCE: 0, RESERVED: 0 };
      groups.forEach((g) => (map[g.status] = g._count.id));
      const total = Object.values(map).reduce((s, v) => s + v, 0);
      return { ...map, total, occupancyRate: total ? ((map.OCCUPIED / total) * 100).toFixed(1) : 0 };
    };

    return {
      icuBeds: toMap(beds),
      ventilators: toMap(ventilators),
      timestamp: new Date(),
    };
  }

  // ── Emergency Queue (patients by risk score) ─────────────────

  async getEmergencyQueue() {
    const criticalPatients = await prisma.patient.findMany({
      where: {
        isActive: true,
        currentRiskScore: { gte: 50 },
      },
      orderBy: { currentRiskScore: 'desc' },
      take: 20,
      include: {
        vitals: { orderBy: { recordedAt: 'desc' }, take: 1 },
        allocations: {
          where: { status: 'ACTIVE' },
          include: { resource: true },
        },
      },
    });

    return criticalPatients.map((p) => ({
      patientId: p.id,
      mrn: p.mrn,
      name: `${p.firstName} ${p.lastName}`,
      riskScore: p.currentRiskScore,
      riskLevel: p.riskLevel,
      hasIcuBed: p.allocations.some((a) => a.resource.resourceType === 'ICU_BED'),
      hasVentilator: p.allocations.some((a) => a.resource.resourceType === 'VENTILATOR'),
      latestVitals: p.vitals[0] || null,
    }));
  }

  // ── Trigger AI Prediction and update patient risk ─────────────

  async triggerAIPrediction(patientId) {
    const patient = await prisma.patient.findUnique({
      where: { id: patientId },
      include: { vitals: { orderBy: { recordedAt: 'desc' }, take: 1 } },
    });

    if (!patient || !patient.vitals.length) return null;

    const latestVitals = patient.vitals[0];
    const prediction = await aiService.predictRisk(latestVitals);

    await prisma.patient.update({
      where: { id: patientId },
      data: {
        currentRiskScore: prediction.risk_score,
        riskLevel: prediction.risk_level,
      },
    });

    return prediction;
  }
}

module.exports = new IcuService();
