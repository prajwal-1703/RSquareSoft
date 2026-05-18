/**
 * PulseGrid AI — Emergency Simulation Engine
 * Generates synthetic mass casualty events for hackathon demos
 */

const prisma = require('../../config/database');
const aiService = require('../ai/ai.service');
const notificationService = require('../notifications/notification.service');
const { broadcast, EVENTS } = require('../websocket/websocket');
const logger = require('../../utils/logger');

// ── Synthetic data generators ────────────────────────────────────

const FIRST_NAMES = ['James', 'Maria', 'David', 'Sarah', 'Michael', 'Emily', 'Robert', 'Jennifer', 'William', 'Linda'];
const LAST_NAMES = ['Smith', 'Johnson', 'Williams', 'Brown', 'Jones', 'Garcia', 'Miller', 'Davis', 'Wilson', 'Moore'];
const GENDERS = ['male', 'female'];
const BLOOD_TYPES = ['A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-'];

function rand(min, max) {
  return Math.random() * (max - min) + min;
}

function randInt(min, max) {
  return Math.floor(rand(min, max + 1));
}

function pickRandom(arr) {
  return arr[Math.floor(Math.random() * arr.length)];
}

function generateSyntheticVitals(severity = 'moderate') {
  const profiles = {
    critical: {
      heartRate: randInt(120, 160),
      systolicBp: randInt(60, 85),
      diastolicBp: randInt(40, 55),
      respiratoryRate: randInt(28, 38),
      temperature: parseFloat(rand(38.8, 40.5).toFixed(1)),
      spo2: randInt(78, 87),
      gcsScore: randInt(3, 8),
      lactate: parseFloat(rand(4, 10).toFixed(1)),
      creatinine: parseFloat(rand(2.5, 6).toFixed(1)),
      isVentilated: Math.random() > 0.4,
      isOnVasopressors: Math.random() > 0.5,
    },
    high: {
      heartRate: randInt(100, 125),
      systolicBp: randInt(85, 100),
      diastolicBp: randInt(55, 65),
      respiratoryRate: randInt(22, 30),
      temperature: parseFloat(rand(38.0, 39.5).toFixed(1)),
      spo2: randInt(88, 93),
      gcsScore: randInt(9, 12),
      lactate: parseFloat(rand(2, 4).toFixed(1)),
      creatinine: parseFloat(rand(1.5, 2.5).toFixed(1)),
      isVentilated: false,
      isOnVasopressors: false,
    },
    moderate: {
      heartRate: randInt(85, 110),
      systolicBp: randInt(100, 130),
      diastolicBp: randInt(65, 85),
      respiratoryRate: randInt(18, 24),
      temperature: parseFloat(rand(37.0, 38.5).toFixed(1)),
      spo2: randInt(93, 97),
      gcsScore: randInt(12, 15),
      lactate: parseFloat(rand(1, 2).toFixed(1)),
      creatinine: parseFloat(rand(1.0, 1.5).toFixed(1)),
      isVentilated: false,
      isOnVasopressors: false,
    },
  };
  return profiles[severity] || profiles.moderate;
}

class SimulationService {
  /**
   * Simulate a mass casualty event (MCI).
   * Generates N synthetic patients with varying severity.
   */
  async simulateMassCasualty({ patientCount = 10, scenario = 'mixed' } = {}) {
    logger.warn(`[Simulation] Starting mass casualty event: ${patientCount} patients, scenario: ${scenario}`);

    const results = [];
    const severities = scenario === 'critical'
      ? ['critical', 'critical', 'high']
      : scenario === 'mixed'
      ? ['critical', 'high', 'moderate', 'moderate', 'moderate']
      : ['moderate'];

    for (let i = 0; i < patientCount; i++) {
      try {
        const severity = pickRandom(severities);
        const vitals = generateSyntheticVitals(severity);
        const age = randInt(25, 85);

        // Get AI risk score
        const prediction = await aiService.predictRisk({ ...vitals, age });

        // Create synthetic patient
        const mrn = `SIM-${Date.now()}-${i}`;
        const patient = await prisma.patient.create({
          data: {
            mrn,
            firstName: pickRandom(FIRST_NAMES),
            lastName: pickRandom(LAST_NAMES),
            dateOfBirth: new Date(Date.now() - age * 365.25 * 24 * 60 * 60 * 1000),
            gender: pickRandom(GENDERS),
            bloodType: pickRandom(BLOOD_TYPES),
            version: 1,
            currentRiskScore: prediction.risk_score,
            riskLevel: prediction.risk_level,
          },
        });

        // Record vitals
        await prisma.vital.create({
          data: { patientId: patient.id, ...vitals },
        });

        // Auto-create version snapshot
        await prisma.patientVersion.create({
          data: {
            patientId: patient.id,
            version: 1,
            snapshot: patient,
            changesSummary: 'Simulation: Mass casualty intake',
            updatedById: (await prisma.user.findFirst({ where: { role: 'admin' } }))?.id ||
              (await prisma.user.findFirst())?.id,
          },
        });

        // Broadcast patient arrival
        await broadcast(EVENTS.SIMULATION_EVENT, {
          type: 'PATIENT_ARRIVAL',
          patient: {
            id: patient.id,
            mrn: patient.mrn,
            name: `${patient.firstName} ${patient.lastName}`,
            severity,
            riskScore: prediction.risk_score,
            riskLevel: prediction.risk_level,
            prediction,
          },
          timestamp: new Date(),
        });

        // Trigger emergency alert for critical patients
        if (prediction.risk_level === 'critical') {
          await notificationService.emergencyAlert({
            title: `CRITICAL PATIENT ARRIVAL: ${patient.firstName} ${patient.lastName}`,
            message: `Patient ${mrn} risk score ${prediction.risk_score} — ${prediction.recommended_action}`,
            patientId: patient.id,
            severity: 'CRITICAL',
          });
        }

        results.push({ patient, prediction, severity });

        // Stagger arrivals for realistic feel
        await new Promise((r) => setTimeout(r, 200));
      } catch (err) {
        logger.error(`[Simulation] Failed to create patient ${i}: ${err.message}`);
      }
    }

    // Final summary broadcast
    await broadcast(EVENTS.SIMULATION_EVENT, {
      type: 'MCI_COMPLETE',
      summary: {
        total: results.length,
        critical: results.filter((r) => r.prediction.risk_level === 'critical').length,
        high: results.filter((r) => r.prediction.risk_level === 'high').length,
        moderate: results.filter((r) => r.prediction.risk_level === 'moderate').length,
      },
      timestamp: new Date(),
    });

    logger.warn(`[Simulation] Mass casualty complete: ${results.length} patients created`);
    return results;
  }

  /**
   * Simulate ICU overload stress test.
   */
  async simulateIcuOverload() {
    const [totalBeds, totalVents] = await Promise.all([
      prisma.icuResource.count({ where: { resourceType: 'ICU_BED' } }),
      prisma.icuResource.count({ where: { resourceType: 'VENTILATOR' } }),
    ]);

    await broadcast(EVENTS.SIMULATION_EVENT, {
      type: 'ICU_OVERLOAD',
      message: 'ICU capacity exceeded — emergency reallocation protocol activated',
      capacity: { beds: totalBeds, ventilators: totalVents },
      timestamp: new Date(),
    });

    await notificationService.emergencyAlert({
      title: 'ICU OVERLOAD — Emergency Reallocation Required',
      message: `All ${totalBeds} ICU beds are at capacity. Activating emergency overflow protocol.`,
      severity: 'EMERGENCY',
    });

    return { message: 'ICU overload simulation triggered', capacity: { beds: totalBeds, ventilators: totalVents } };
  }

  /**
   * Simulate a real-time alert storm for demo purposes.
   */
  async simulateAlertStorm(count = 5) {
    const alerts = [];
    for (let i = 0; i < count; i++) {
      await new Promise((r) => setTimeout(r, 500));
      const alert = await notificationService.emergencyAlert({
        title: `ALERT ${i + 1}: Critical Vital Signs Detected`,
        message: `Patient in ICU Bay ${randInt(1, 20)} requires immediate attention`,
        severity: 'CRITICAL',
      });
      alerts.push(alert);
    }
    return { message: `${count} alerts triggered`, alerts };
  }
}

module.exports = new SimulationService();
