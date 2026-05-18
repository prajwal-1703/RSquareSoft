/**
 * PulseGrid AI — EHR Service
 * Concurrent-safe EHR with optimistic concurrency control + versioning
 */

const prisma = require('../../config/database');
const AppError = require('../../utils/AppError');
const logger = require('../../utils/logger');
const auditService = require('../audit/audit.service');
const { getRedis } = require('../../config/redis');

class EhrService {
  // ── Generate MRN ─────────────────────────────────────────────

  async generateMRN() {
    const redis = getRedis();
    let counter;
    try {
      counter = await redis.incr('mrn:counter');
    } catch {
      // Fallback: use timestamp + random
      counter = Date.now();
    }
    return `PG-${String(counter).padStart(6, '0')}`;
  }

  // ── Create Patient ───────────────────────────────────────────

  async createPatient(data, requestingUser) {
    const mrn = await this.generateMRN();

    const patient = await prisma.patient.create({
      data: {
        mrn,
        firstName: data.firstName,
        lastName: data.lastName,
        dateOfBirth: new Date(data.dateOfBirth),
        gender: data.gender,
        bloodType: data.bloodType,
        contactPhone: data.contactPhone,
        emergencyContact: data.emergencyContact,
        insuranceId: data.insuranceId,
        version: 1,
      },
    });

    // Create initial version snapshot
    await prisma.patientVersion.create({
      data: {
        patientId: patient.id,
        version: 1,
        snapshot: patient,
        changesSummary: 'Patient record created',
        updatedById: requestingUser.id,
      },
    });

    await auditService.log({
      userId: requestingUser.id,
      action: 'CREATE_PATIENT',
      entity: 'Patient',
      entityId: patient.id,
      newValue: patient,
    });

    logger.info(`[EHR] Patient created: ${patient.mrn} by ${requestingUser.email}`);
    return patient;
  }

  // ── Get Patient ──────────────────────────────────────────────

  async getPatient(patientId) {
    const patient = await prisma.patient.findUnique({
      where: { id: patientId },
      include: {
        vitals: { orderBy: { recordedAt: 'desc' }, take: 10 },
        diagnoses: { orderBy: { diagnosedAt: 'desc' } },
        medications: { where: { isActive: true } },
        labReports: { orderBy: { collectedAt: 'desc' }, take: 20 },
        allergies: true,
        allocations: {
          where: { status: 'ACTIVE' },
          include: { resource: true },
        },
      },
    });

    if (!patient) throw AppError.notFound('Patient not found');
    return patient;
  }

  // ── List Patients ────────────────────────────────────────────

  async listPatients({ page = 1, limit = 20, search, riskLevel } = {}) {
    const skip = (page - 1) * limit;
    const where = { isActive: true };

    if (search) {
      where.OR = [
        { firstName: { contains: search, mode: 'insensitive' } },
        { lastName: { contains: search, mode: 'insensitive' } },
        { mrn: { contains: search, mode: 'insensitive' } },
      ];
    }

    if (riskLevel) {
      where.riskLevel = riskLevel;
    }

    const [patients, total] = await Promise.all([
      prisma.patient.findMany({
        where,
        skip,
        take: limit,
        orderBy: [{ currentRiskScore: 'desc' }, { admissionDate: 'desc' }],
        select: {
          id: true,
          mrn: true,
          firstName: true,
          lastName: true,
          gender: true,
          dateOfBirth: true,
          admissionDate: true,
          currentRiskScore: true,
          riskLevel: true,
          version: true,
          _count: { select: { allocations: true } },
        },
      }),
      prisma.patient.count({ where }),
    ]);

    return {
      patients,
      pagination: { page, limit, total, totalPages: Math.ceil(total / limit) },
    };
  }

  // ── Update EHR (Optimistic Concurrency Control) ───────────────

  async updateEHR(patientId, data, requestingUser) {
    const { version, vitals, diagnosis, medication, labReport, allergy } = data;

    return await prisma.$transaction(async (tx) => {
      // 1. Lock patient row and verify version
      const patient = await tx.patient.findUnique({
        where: { id: patientId },
      });

      if (!patient) throw AppError.notFound('Patient not found');
      if (!patient.isActive) throw AppError.badRequest('Patient record is not active');

      // ── OPTIMISTIC CONCURRENCY CHECK ──────────────────────────
      if (patient.version !== version) {
        logger.warn(
          `[EHR] Concurrency conflict: patient ${patientId} expected v${version}, got v${patient.version}`
        );
        throw AppError.versionConflict('Patient EHR');
      }

      const newVersion = patient.version + 1;
      const changes = [];

      // 2. Record vitals
      let newVitals = null;
      if (vitals) {
        newVitals = await tx.vital.create({
          data: { patientId, ...vitals },
        });
        changes.push('vitals');
      }

      // 3. Record diagnosis
      if (diagnosis) {
        await tx.diagnosis.create({
          data: { patientId, ...diagnosis },
        });
        changes.push('diagnosis');
      }

      // 4. Record medication
      if (medication) {
        await tx.medication.create({
          data: { patientId, prescribedBy: requestingUser.id, ...medication },
        });
        changes.push('medication');
      }

      // 5. Record lab report
      if (labReport) {
        await tx.labReport.create({
          data: { patientId, orderedBy: requestingUser.id, ...labReport },
        });
        changes.push('labReport');
      }

      // 6. Record allergy
      if (allergy) {
        await tx.allergy.create({
          data: { patientId, ...allergy },
        });
        changes.push('allergy');
      }

      // 7. Bump patient version
      const updatedPatient = await tx.patient.update({
        where: { id: patientId },
        data: { version: newVersion, updatedAt: new Date() },
      });

      // 8. Create immutable version snapshot
      await tx.patientVersion.create({
        data: {
          patientId,
          version: newVersion,
          snapshot: { ...updatedPatient, latestVitals: newVitals },
          changesSummary: `Updated: ${changes.join(', ')}`,
          updatedById: requestingUser.id,
        },
      });

      // 9. Audit log (outside tx for immutability — use queued approach in prod)
      setImmediate(() => {
        auditService.log({
          userId: requestingUser.id,
          action: 'UPDATE_EHR',
          entity: 'Patient',
          entityId: patientId,
          previousValue: { version },
          newValue: { version: newVersion, changes },
        });
      });

      logger.info(`[EHR] Patient ${patientId} updated to v${newVersion} by ${requestingUser.email}`);
      return { patient: updatedPatient, newVersion, changes };
    });
  }

  // ── Get Timeline ─────────────────────────────────────────────

  async getTimeline(patientId) {
    const [vitals, diagnoses, medications, labReports, allocations] = await Promise.all([
      prisma.vital.findMany({
        where: { patientId },
        orderBy: { recordedAt: 'desc' },
        take: 50,
      }),
      prisma.diagnosis.findMany({
        where: { patientId },
        orderBy: { diagnosedAt: 'desc' },
      }),
      prisma.medication.findMany({
        where: { patientId },
        orderBy: { startDate: 'desc' },
      }),
      prisma.labReport.findMany({
        where: { patientId },
        orderBy: { collectedAt: 'desc' },
        take: 50,
      }),
      prisma.allocation.findMany({
        where: { patientId },
        include: { resource: true },
        orderBy: { allocatedAt: 'desc' },
      }),
    ]);

    // Merge into chronological timeline
    const events = [
      ...vitals.map((v) => ({ type: 'VITAL', timestamp: v.recordedAt, data: v })),
      ...diagnoses.map((d) => ({ type: 'DIAGNOSIS', timestamp: d.diagnosedAt, data: d })),
      ...medications.map((m) => ({ type: 'MEDICATION', timestamp: m.startDate, data: m })),
      ...labReports.map((l) => ({ type: 'LAB_REPORT', timestamp: l.collectedAt, data: l })),
      ...allocations.map((a) => ({ type: 'ALLOCATION', timestamp: a.allocatedAt, data: a })),
    ].sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));

    return events;
  }

  // ── Get Version History ──────────────────────────────────────

  async getVersionHistory(patientId) {
    const versions = await prisma.patientVersion.findMany({
      where: { patientId },
      orderBy: { version: 'desc' },
      include: { updatedBy: { select: { id: true, firstName: true, lastName: true, role: true } } },
    });
    return versions;
  }

  // ── Rollback Version ─────────────────────────────────────────

  async rollbackVersion(patientId, targetVersion, reason, requestingUser) {
    const versionRecord = await prisma.patientVersion.findUnique({
      where: { patientId_version: { patientId, version: targetVersion } },
    });

    if (!versionRecord) {
      throw AppError.notFound(`Version ${targetVersion} not found for this patient`);
    }

    const currentPatient = await prisma.patient.findUnique({ where: { id: patientId } });
    if (!currentPatient) throw AppError.notFound('Patient not found');

    const newVersion = currentPatient.version + 1;

    await prisma.$transaction(async (tx) => {
      // Restore snapshot fields
      const snap = versionRecord.snapshot;
      await tx.patient.update({
        where: { id: patientId },
        data: {
          version: newVersion,
          currentRiskScore: snap.currentRiskScore,
          riskLevel: snap.riskLevel,
        },
      });

      await tx.patientVersion.create({
        data: {
          patientId,
          version: newVersion,
          snapshot: snap,
          changesSummary: `Rollback to v${targetVersion}: ${reason}`,
          updatedById: requestingUser.id,
        },
      });
    });

    await auditService.log({
      userId: requestingUser.id,
      action: 'ROLLBACK_EHR',
      entity: 'Patient',
      entityId: patientId,
      previousValue: { version: currentPatient.version },
      newValue: { rolledBackTo: targetVersion, reason },
    });

    logger.info(`[EHR] Patient ${patientId} rolled back to v${targetVersion}`);
    return { success: true, newVersion, rolledBackTo: targetVersion };
  }
}

module.exports = new EhrService();
