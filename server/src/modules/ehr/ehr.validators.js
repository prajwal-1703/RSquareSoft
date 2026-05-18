/**
 * PulseGrid AI — EHR Validators (Zod)
 */

const { z } = require('zod');

const createPatientSchema = z.object({
  firstName: z.string().min(1),
  lastName: z.string().min(1),
  dateOfBirth: z.string().refine((d) => !isNaN(Date.parse(d)), 'Invalid date'),
  gender: z.enum(['male', 'female', 'other']),
  bloodType: z.enum(['A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-']).optional(),
  contactPhone: z.string().optional(),
  emergencyContact: z.string().optional(),
  insuranceId: z.string().optional(),
});

const updateEhrSchema = z.object({
  version: z.number().int().min(1, 'Version number required for concurrency control'),
  vitals: z
    .object({
      heartRate: z.number().optional(),
      systolicBp: z.number().optional(),
      diastolicBp: z.number().optional(),
      respiratoryRate: z.number().optional(),
      temperature: z.number().optional(),
      spo2: z.number().optional(),
      gcsScore: z.number().optional(),
      bloodGlucose: z.number().optional(),
      creatinine: z.number().optional(),
      lactate: z.number().optional(),
      wbcCount: z.number().optional(),
      plateletCount: z.number().optional(),
      isVentilated: z.boolean().optional(),
      isOnVasopressors: z.boolean().optional(),
    })
    .optional(),
  diagnosis: z
    .object({
      icdCode: z.string().optional(),
      description: z.string().min(1),
      severity: z.enum(['mild', 'moderate', 'severe', 'critical']).optional(),
      notes: z.string().optional(),
    })
    .optional(),
  medication: z
    .object({
      name: z.string().min(1),
      dosage: z.string().min(1),
      route: z.string().optional(),
      frequency: z.string().optional(),
    })
    .optional(),
  labReport: z
    .object({
      testName: z.string().min(1),
      testCategory: z.string().optional(),
      result: z.string().min(1),
      unit: z.string().optional(),
      referenceRange: z.string().optional(),
      isAbnormal: z.boolean().optional(),
    })
    .optional(),
  allergy: z
    .object({
      allergen: z.string().min(1),
      severity: z.string().optional(),
      reaction: z.string().optional(),
    })
    .optional(),
});

const rollbackSchema = z.object({
  targetVersion: z.number().int().min(1),
  reason: z.string().min(1),
});

module.exports = { createPatientSchema, updateEhrSchema, rollbackSchema };
