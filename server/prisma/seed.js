/**
 * PulseGrid AI — Database Seed Script
 * Creates realistic ICU resources, staff, patients, and initial data
 */

const { PrismaClient } = require('@prisma/client');
const bcrypt = require('bcryptjs');

const prisma = new PrismaClient();

// ── Helper ───────────────────────────────────────────────────────
function rand(min, max) { return Math.random() * (max - min) + min; }
function randInt(min, max) { return Math.floor(rand(min, max + 1)); }
function pick(arr) { return arr[Math.floor(Math.random() * arr.length)]; }
function daysAgo(days) { return new Date(Date.now() - days * 86400000); }

async function main() {
  console.log('🌱 Seeding PulseGrid AI database...\n');

  // ── 1. Staff Users ────────────────────────────────────────────
  const hashedPassword = await bcrypt.hash('PulseGrid@123', 12);

  const users = await Promise.all([
    prisma.user.upsert({
      where: { email: 'admin@pulsegrid.ai' },
      update: {},
      create: {
        email: 'admin@pulsegrid.ai', password: hashedPassword,
        firstName: 'Alex', lastName: 'Chen', role: 'admin', department: 'Administration',
      },
    }),
    prisma.user.upsert({
      where: { email: 'dr.smith@pulsegrid.ai' },
      update: {},
      create: {
        email: 'dr.smith@pulsegrid.ai', password: hashedPassword,
        firstName: 'Dr. Sarah', lastName: 'Smith', role: 'doctor', department: 'Critical Care',
      },
    }),
    prisma.user.upsert({
      where: { email: 'dr.patel@pulsegrid.ai' },
      update: {},
      create: {
        email: 'dr.patel@pulsegrid.ai', password: hashedPassword,
        firstName: 'Dr. Raj', lastName: 'Patel', role: 'doctor', department: 'Pulmonology',
      },
    }),
    prisma.user.upsert({
      where: { email: 'nurse.johnson@pulsegrid.ai' },
      update: {},
      create: {
        email: 'nurse.johnson@pulsegrid.ai', password: hashedPassword,
        firstName: 'Michael', lastName: 'Johnson', role: 'nurse', department: 'ICU',
      },
    }),
    prisma.user.upsert({
      where: { email: 'nurse.davis@pulsegrid.ai' },
      update: {},
      create: {
        email: 'nurse.davis@pulsegrid.ai', password: hashedPassword,
        firstName: 'Linda', lastName: 'Davis', role: 'nurse', department: 'ICU',
      },
    }),
    prisma.user.upsert({
      where: { email: 'lab@pulsegrid.ai' },
      update: {},
      create: {
        email: 'lab@pulsegrid.ai', password: hashedPassword,
        firstName: 'Tom', lastName: 'Wilson', role: 'lab_technician', department: 'Laboratory',
      },
    }),
  ]);

  console.log(`✅ Created ${users.length} staff users`);
  console.log('   Default password: PulseGrid@123\n');

  const adminUser = users[0];
  const doctor1 = users[1];

  // ── 2. ICU Beds ───────────────────────────────────────────────
  const bedData = Array.from({ length: 20 }, (_, i) => ({
    resourceType: 'ICU_BED',
    identifier: `ICU-BED-${String(i + 1).padStart(2, '0')}`,
    location: `ICU Wing ${i < 10 ? 'A' : 'B'}, Bay ${(i % 10) + 1}`,
    status: i < 14 ? 'AVAILABLE' : i < 18 ? 'OCCUPIED' : 'MAINTENANCE',
  }));

  for (const bed of bedData) {
    await prisma.icuResource.upsert({
      where: { identifier: bed.identifier },
      update: {},
      create: bed,
    });
  }

  console.log(`✅ Created 20 ICU beds (14 available, 4 occupied, 2 maintenance)\n`);

  // ── 3. Ventilators ───────────────────────────────────────────
  const ventData = Array.from({ length: 12 }, (_, i) => ({
    resourceType: 'VENTILATOR',
    identifier: `VENT-${String(i + 1).padStart(2, '0')}`,
    location: `ICU Storage Room ${i < 6 ? 'A' : 'B'}`,
    status: i < 8 ? 'AVAILABLE' : i < 11 ? 'OCCUPIED' : 'MAINTENANCE',
  }));

  for (const vent of ventData) {
    await prisma.icuResource.upsert({
      where: { identifier: vent.identifier },
      update: {},
      create: vent,
    });
  }

  console.log(`✅ Created 12 ventilators (8 available, 3 occupied, 1 maintenance)\n`);

  // ── 4. Patients ──────────────────────────────────────────────
  const patientData = [
    { firstName: 'James', lastName: 'Morrison', gender: 'male', age: 72, severity: 'critical' },
    { firstName: 'Maria', lastName: 'Rodriguez', gender: 'female', age: 58, severity: 'high' },
    { firstName: 'David', lastName: 'Thompson', gender: 'male', age: 45, severity: 'moderate' },
    { firstName: 'Emily', lastName: 'Williams', gender: 'female', age: 81, severity: 'critical' },
    { firstName: 'Robert', lastName: 'Anderson', gender: 'male', age: 64, severity: 'high' },
    { firstName: 'Sarah', lastName: 'Martinez', gender: 'female', age: 39, severity: 'moderate' },
    { firstName: 'Michael', lastName: 'Brown', gender: 'male', age: 76, severity: 'critical' },
    { firstName: 'Linda', lastName: 'Garcia', gender: 'female', age: 52, severity: 'high' },
  ];

  const riskMap = { critical: { score: randInt(75, 95), level: 'critical' }, high: { score: randInt(50, 74), level: 'high' }, moderate: { score: randInt(20, 49), level: 'moderate' } };

  let mrnCounter = 1;
  for (const pd of patientData) {
    const mrn = `PG-${String(mrnCounter++).padStart(6, '0')}`;
    const risk = riskMap[pd.severity];
    const bloodTypes = ['A+', 'O+', 'B+', 'AB+', 'A-', 'O-'];

    const existing = await prisma.patient.findUnique({ where: { mrn } });
    if (existing) continue;

    const patient = await prisma.patient.create({
      data: {
        mrn,
        firstName: pd.firstName,
        lastName: pd.lastName,
        dateOfBirth: new Date(Date.now() - pd.age * 365.25 * 24 * 60 * 60 * 1000),
        gender: pd.gender,
        bloodType: pick(bloodTypes),
        admissionDate: daysAgo(randInt(1, 7)),
        currentRiskScore: risk.score,
        riskLevel: risk.level,
        version: 1,
      },
    });

    // Create vitals
    await prisma.vital.create({
      data: {
        patientId: patient.id,
        heartRate: pd.severity === 'critical' ? randInt(120, 155) : pd.severity === 'high' ? randInt(95, 120) : randInt(70, 95),
        systolicBp: pd.severity === 'critical' ? randInt(65, 88) : randInt(90, 130),
        diastolicBp: pd.severity === 'critical' ? randInt(40, 55) : randInt(60, 85),
        respiratoryRate: pd.severity === 'critical' ? randInt(28, 35) : randInt(16, 24),
        temperature: parseFloat((pd.severity === 'critical' ? rand(38.8, 40.2) : rand(37.0, 38.5)).toFixed(1)),
        spo2: pd.severity === 'critical' ? randInt(80, 88) : pd.severity === 'high' ? randInt(89, 93) : randInt(94, 99),
        gcsScore: pd.severity === 'critical' ? randInt(4, 9) : pd.severity === 'high' ? randInt(10, 13) : randInt(13, 15),
        lactate: parseFloat((pd.severity === 'critical' ? rand(4, 8) : rand(1, 2)).toFixed(1)),
        isVentilated: pd.severity === 'critical' && Math.random() > 0.5,
        isOnVasopressors: pd.severity === 'critical' && Math.random() > 0.6,
      },
    });

    // Create initial version snapshot
    await prisma.patientVersion.create({
      data: {
        patientId: patient.id,
        version: 1,
        snapshot: patient,
        changesSummary: 'Initial patient admission',
        updatedById: doctor1.id,
      },
    });

    // Add a diagnosis
    await prisma.diagnosis.create({
      data: {
        patientId: patient.id,
        description: pick(['Septic Shock', 'ARDS', 'Acute MI', 'Respiratory Failure', 'Multi-organ Dysfunction', 'Pneumonia']),
        severity: pd.severity,
        diagnosedAt: daysAgo(randInt(0, 3)),
      },
    });
  }

  console.log(`✅ Created ${patientData.length} patients with vitals and diagnoses\n`);

  // ── 5. Seed Audit Log ────────────────────────────────────────
  await prisma.auditLog.create({
    data: {
      userId: adminUser.id,
      action: 'SYSTEM_SEED',
      entity: 'System',
      entityId: null,
      newValue: { message: 'Database seeded successfully', timestamp: new Date() },
    },
  });

  console.log('✅ Seed audit log created\n');

  console.log('╔══════════════════════════════════════════════╗');
  console.log('║         PulseGrid AI — Seed Complete!        ║');
  console.log('╠══════════════════════════════════════════════╣');
  console.log('║  Accounts (password: PulseGrid@123):         ║');
  console.log('║  admin@pulsegrid.ai       (admin)            ║');
  console.log('║  dr.smith@pulsegrid.ai    (doctor)           ║');
  console.log('║  dr.patel@pulsegrid.ai    (doctor)           ║');
  console.log('║  nurse.johnson@pulsegrid.ai (nurse)          ║');
  console.log('║  lab@pulsegrid.ai         (lab_technician)   ║');
  console.log('╚══════════════════════════════════════════════╝');
}

main()
  .catch((e) => {
    console.error('Seed failed:', e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
