export type Severity = "critical" | "warning" | "stable" | "recovery";

export interface Patient {
  id: string;
  bed: string;
  name: string;
  age: number;
  condition: string;
  severity: Severity;
  risk: number; // 0..1 mortality
  hr: number;
  spo2: number;
  bp: string;
  resp: number;
  trend: number; // % change
  unit: string;
}

export const patients: Patient[] = [
  { id: "P-4421", bed: "ICU-04", name: "J. Thompson", age: 62, condition: "Septic shock", severity: "critical", risk: 0.88, hr: 138, spo2: 88, bp: "84/52", resp: 28, trend: 12, unit: "ICU-A" },
  { id: "P-8812", bed: "ICU-09", name: "M. Harris", age: 71, condition: "ARDS", severity: "critical", risk: 0.81, hr: 124, spo2: 84, bp: "92/58", resp: 32, trend: 7, unit: "ICU-A" },
  { id: "P-5532", bed: "ICU-12", name: "R. Garcia", age: 55, condition: "MI post-op", severity: "critical", risk: 0.74, hr: 118, spo2: 91, bp: "98/64", resp: 24, trend: 4, unit: "ICU-B" },
  { id: "P-2210", bed: "ICU-02", name: "W. Chen", age: 47, condition: "Pneumonia", severity: "warning", risk: 0.42, hr: 102, spo2: 93, bp: "118/74", resp: 22, trend: -2, unit: "ICU-A" },
  { id: "P-7740", bed: "ICU-15", name: "S. Patel", age: 38, condition: "Trauma", severity: "warning", risk: 0.36, hr: 96, spo2: 95, bp: "122/78", resp: 18, trend: -1, unit: "ICU-C" },
  { id: "P-1188", bed: "ICU-18", name: "L. Okafor", age: 29, condition: "DKA", severity: "warning", risk: 0.31, hr: 110, spo2: 96, bp: "128/80", resp: 20, trend: 3, unit: "ICU-C" },
  { id: "P-9090", bed: "ICU-21", name: "A. Novak", age: 66, condition: "Recovery / CABG", severity: "stable", risk: 0.12, hr: 82, spo2: 98, bp: "124/76", resp: 16, trend: -5, unit: "ICU-B" },
  { id: "P-3344", bed: "ICU-22", name: "K. Müller", age: 52, condition: "Stable obs.", severity: "stable", risk: 0.08, hr: 76, spo2: 99, bp: "120/72", resp: 14, trend: -3, unit: "ICU-B" },
  { id: "P-6611", bed: "ICU-24", name: "T. Yamada", age: 44, condition: "Post-op recov.", severity: "recovery", risk: 0.05, hr: 72, spo2: 99, bp: "118/74", resp: 14, trend: -8, unit: "ICU-D" },
  { id: "P-7821", bed: "ICU-26", name: "E. Diallo", age: 33, condition: "Discharge prep", severity: "recovery", risk: 0.03, hr: 70, spo2: 99, bp: "116/72", resp: 13, trend: -6, unit: "ICU-D" },
];

export const stats = {
  occupancy: 84,
  ventilatorsFree: 12,
  ventilatorsTotal: 48,
  bedsFree: 8,
  bedsTotal: 64,
  activeEmergencies: 4,
  aiConfidence: 99.4,
  meanRisk: 0.31,
  staffOnDuty: 142,
  inflow24h: 38,
};

export const vitalsSeries = Array.from({ length: 40 }, (_, i) => ({
  t: i,
  hr: 90 + Math.sin(i / 3) * 12 + (i > 30 ? 18 : 0) + Math.random() * 4,
  spo2: 96 - Math.sin(i / 5) * 2 - (i > 32 ? 4 : 0),
  resp: 18 + Math.sin(i / 4) * 3,
}));

export const riskDistribution = [
  { name: "Critical", value: 6, color: "var(--critical)" },
  { name: "Warning", value: 11, color: "var(--warning)" },
  { name: "Stable", value: 28, color: "var(--teal)" },
  { name: "Recovery", value: 19, color: "var(--emerald)" },
];

export const inflowSeries = Array.from({ length: 24 }, (_, i) => ({
  hour: `${i}:00`,
  admits: Math.round(2 + Math.sin(i / 3) * 2 + Math.random() * 2 + (i > 16 ? 2 : 0)),
  discharges: Math.round(1 + Math.cos(i / 4) * 2 + Math.random() * 1.5),
}));

export const severityColor: Record<Severity, string> = {
  critical: "var(--critical)",
  warning: "var(--warning)",
  stable: "var(--teal)",
  recovery: "var(--emerald)",
};

export const auditEvents = [
  { t: "14:22:04", actor: "Dr. Chen", kind: "ehr", text: "Modified Propofol dosage for THOMPSON, J — 50mg → 75mg", id: "55912-AX" },
  { t: "14:21:48", actor: "System", kind: "system", text: "Vitals ingest completed for Wing 4. No anomalies detected.", id: "55911-AU" },
  { t: "14:20:12", actor: "Nurse Kelly", kind: "warn", text: "Conflict detected in Bed 102 record. Resolving with snapshot v1.4.2…", id: "55910-RS" },
  { t: "14:18:55", actor: "AI Engine", kind: "ai", text: "Escalation suggested for HARRIS, M (ICU-09): risk +7% in 1h.", id: "55909-AI" },
  { t: "14:17:22", actor: "Dr. Lopez", kind: "ehr", text: "Signed off pre-op assessment for B-204.", id: "55908-AX" },
  { t: "14:14:10", actor: "System", kind: "critical", text: "Mass-casualty protocol drill armed for Bay 3.", id: "55907-EM" },
];

export const beds = Array.from({ length: 64 }, (_, i) => {
  const r = Math.random();
  const occupied = r > 0.18;
  const sev: Severity =
    !occupied ? "stable" :
    r > 0.92 ? "critical" :
    r > 0.78 ? "warning" :
    r > 0.45 ? "stable" : "recovery";
  return { id: i + 1, occupied, severity: sev };
});
