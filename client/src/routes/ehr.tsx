import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { motion, AnimatePresence } from "framer-motion";
import { Check, GitBranch, GitCommit, GitMerge, Loader2, Lock, RefreshCw, RotateCcw, Save } from "lucide-react";
import { AppShell, Card } from "@/components/AppShell";
import { useState, useEffect } from "react";
import { ehrApi } from "@/lib/api";
import { patients as mockPatients } from "@/lib/mock";
import { useAuth } from "@/lib/hooks";

export const Route = createFileRoute("/ehr")({
  head: () => ({ meta: [{ title: "EHR Management · PulseGrid AI" }] }),
  component: EHR,
});

function EHR() {
  const { user } = useAuth();
  const qc = useQueryClient();
  const [conflict, setConflict] = useState(false);
  const [selectedPatientId, setSelectedPatientId] = useState<string | null>(null);
  const [saveStatus, setSaveStatus] = useState<"idle" | "saving" | "saved" | "error">("idle");
  const [activeTab, setActiveTab] = useState<"overview" | "editor">("overview");

  // ── Patient list ──────────────────────────────────────────────
  const patientsQuery = useQuery({
    queryKey: ["patients-ehr"],
    queryFn: () => ehrApi.listPatients({ limit: 20 }),
    retry: false,
  });

  const apiPatients = patientsQuery.data?.data ?? [];

  // ── Single patient + full EHR ─────────────────────────────────
  const patientQuery = useQuery({
    queryKey: ["patient-ehr", selectedPatientId],
    queryFn: () => ehrApi.getPatient(selectedPatientId!),
    enabled: !!selectedPatientId,
    retry: false,
  });

  // ── Version history ───────────────────────────────────────────
  const versionsQuery = useQuery({
    queryKey: ["patient-versions", selectedPatientId],
    queryFn: () => ehrApi.getVersionHistory(selectedPatientId!),
    enabled: !!selectedPatientId,
    retry: false,
  });

  const [activeVersion, setActiveVersion] = useState<number | null>(null);

  // ── EHR update mutation ───────────────────────────────────────
  const updateMutation = useMutation({
    mutationFn: (body: object) => ehrApi.updateEHR(selectedPatientId!, body),
    onSuccess: () => {
      setSaveStatus("saved");
      setFields(prev => ({ ...prev, notes: "", diagnosisName: "", medicationName: "", medicationDosage: "", labReport: "" }));
      qc.invalidateQueries({ queryKey: ["patient-ehr", selectedPatientId] });
      qc.invalidateQueries({ queryKey: ["patient-versions", selectedPatientId] });
      setTimeout(() => setSaveStatus("idle"), 3000);
    },
    onError: (err: { response?: { status?: number; data?: { message?: string } } }) => {
      if (err.response?.status === 409) {
        setConflict(true);
      }
      setSaveStatus("error");
      setTimeout(() => setSaveStatus("idle"), 3000);
    },
  });

  // ── Rollback mutation ─────────────────────────────────────────
  const rollbackMutation = useMutation({
    mutationFn: ({ targetVersion, reason }: { targetVersion: number; reason: string }) =>
      ehrApi.rollback(selectedPatientId!, { targetVersion, reason }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["patient-ehr", selectedPatientId] });
      qc.invalidateQueries({ queryKey: ["patient-versions", selectedPatientId] });
    },
  });

  const patient = patientQuery.data as any;
  const versions = (versionsQuery.data as any[]) ?? [];
  const currentVersion = activeVersion ?? patient?.version ?? 1;

  // EHR fields (editable state)
  const [fields, setFields] = useState({
    notes: "",
    heartRate: "", systolicBp: "", diastolicBp: "", respiratoryRate: "", temperature: "", spo2: "", gcsScore: "", bloodGlucose: "", creatinine: "", lactate: "", wbcCount: "", plateletCount: "", isVentilated: false, isOnVasopressors: false,
    diagnosisName: "", diagnosisSeverity: "moderate", diagnosisIcdCode: "",
    labTestName: "", labTestCategory: "", labResult: "", labUnit: "", labReferenceRange: "", labIsAbnormal: false,
    allergyName: "", allergySeverity: "moderate", allergyReaction: ""
  });
  const [medicationsList, setMedicationsList] = useState([{ id: '1', name: "", dosage: "", route: "", frequency: "" }]);

  // Pre-fill fields to preserve existing data on partial updates
  useEffect(() => {
    if (patient) {
      const v = patient.vitals?.[0] || {};
      setFields(prev => ({
        ...prev,
        heartRate: v.heartRate?.toString() || "",
        systolicBp: v.systolicBp?.toString() || "",
        diastolicBp: v.diastolicBp?.toString() || "",
        respiratoryRate: v.respiratoryRate?.toString() || "",
        temperature: v.temperature?.toString() || "",
        spo2: v.spo2?.toString() || "",
        gcsScore: v.gcsScore?.toString() || "",
        bloodGlucose: v.bloodGlucose?.toString() || "",
        creatinine: v.creatinine?.toString() || "",
        lactate: v.lactate?.toString() || "",
        wbcCount: v.wbcCount?.toString() || "",
        plateletCount: v.plateletCount?.toString() || "",
        isVentilated: v.isVentilated || false,
        isOnVasopressors: v.isOnVasopressors || false,
      }));
      setMedicationsList([{ id: Math.random().toString(), name: "", dosage: "", route: "", frequency: "" }]);
    }
  }, [patient?.id, activeTab]);

  const handleSave = () => {
    if (!selectedPatientId || !patient) return;
    setSaveStatus("saving");

    const vitals = (fields.heartRate || fields.spo2 || fields.gcsScore || fields.systolicBp || fields.isVentilated || fields.isOnVasopressors) ? {
      heartRate: fields.heartRate ? parseFloat(fields.heartRate) : undefined,
      systolicBp: fields.systolicBp ? parseFloat(fields.systolicBp) : undefined,
      diastolicBp: fields.diastolicBp ? parseFloat(fields.diastolicBp) : undefined,
      respiratoryRate: fields.respiratoryRate ? parseFloat(fields.respiratoryRate) : undefined,
      temperature: fields.temperature ? parseFloat(fields.temperature) : undefined,
      spo2: fields.spo2 ? parseFloat(fields.spo2) : undefined,
      gcsScore: fields.gcsScore ? parseFloat(fields.gcsScore) : undefined,
      bloodGlucose: fields.bloodGlucose ? parseFloat(fields.bloodGlucose) : undefined,
      creatinine: fields.creatinine ? parseFloat(fields.creatinine) : undefined,
      lactate: fields.lactate ? parseFloat(fields.lactate) : undefined,
      wbcCount: fields.wbcCount ? parseFloat(fields.wbcCount) : undefined,
      plateletCount: fields.plateletCount ? parseFloat(fields.plateletCount) : undefined,
      isVentilated: fields.isVentilated,
      isOnVasopressors: fields.isOnVasopressors
    } : undefined;

    const diagnosis = fields.diagnosisName ? {
      description: fields.diagnosisName,
      icdCode: fields.diagnosisIcdCode,
      severity: fields.diagnosisSeverity
    } : undefined;

    const validMeds = medicationsList.filter(m => m.name.trim() !== "");
    const medicationsPayload = validMeds.length > 0 ? validMeds.map(m => ({
      name: m.name,
      dosage: m.dosage || "Standard dose",
      route: m.route,
      frequency: m.frequency || "PRN"
    })) : undefined;

    const labReport = fields.labTestName ? {
      testName: fields.labTestName,
      testCategory: fields.labTestCategory,
      result: fields.labResult,
      unit: fields.labUnit,
      referenceRange: fields.labReferenceRange,
      isAbnormal: fields.labIsAbnormal
    } : undefined;

    const allergy = fields.allergyName ? {
      allergen: fields.allergyName,
      severity: fields.allergySeverity,
      reaction: fields.allergyReaction
    } : undefined;

    updateMutation.mutate({
      version: patient.version,
      ...(vitals ? { vitals } : {}),
      ...(diagnosis ? { diagnosis } : {}),
      ...(medicationsPayload ? { medications: medicationsPayload } : {}),
      ...(labReport ? { labReport } : {}),
      ...(allergy ? { allergy } : {}),
      ...(fields.notes ? { notes: fields.notes } : {})
    });
  };

  const v = patient?.vitals?.[0] || {};
  const hasChanges = !!fields.notes || !!fields.diagnosisName || !!fields.medicationName || !!fields.labTestName || !!fields.allergyName ||
    fields.heartRate !== (v.heartRate?.toString() || "") ||
    fields.systolicBp !== (v.systolicBp?.toString() || "") ||
    fields.gcsScore !== (v.gcsScore?.toString() || "") ||
    fields.isVentilated !== (v.isVentilated || false) ||
    fields.isOnVasopressors !== (v.isOnVasopressors || false);

  return (
    <AppShell title="Concurrent-Safe EHR" subtitle={
      patient
        ? `Patient · ${patient.firstName} ${patient.lastName} · ${patient.mrn}`
        : "Select a patient to view their record"
    }>
      <div className="grid grid-cols-12 gap-4">

        {/* ── Patient Selector ─────────────────────────────────── */}
        <Card title="Patients" className="col-span-12 lg:col-span-3" action={
          <button onClick={() => qc.invalidateQueries({ queryKey: ["patients-ehr"] })} className="rounded-md border border-border px-2 py-1 text-[10px] font-mono hover:bg-white/5">
            <RefreshCw className="size-3" />
          </button>
        }>
          {patientsQuery.isLoading ? (
            <div className="flex items-center gap-2 py-8 text-muted-foreground text-sm justify-center">
              <Loader2 className="size-4 animate-spin" />
            </div>
          ) : (
            <div className="space-y-1.5 max-h-[500px] overflow-auto">
              {(apiPatients.length > 0 ? apiPatients : mockPatients).map((p: {
                id: string; mrn?: string; firstName?: string; lastName?: string; name?: string;
                riskLevel?: string; severity?: string; currentRiskScore?: number; risk?: number;
              }) => {
                const isReal = !!p.mrn;
                const name = isReal ? `${p.firstName} ${p.lastName}` : (p.name ?? "");
                const risk = isReal ? p.currentRiskScore ?? 0 : Math.round((p.risk ?? 0) * 100);
                const level = isReal ? p.riskLevel ?? "stable" : p.severity ?? "stable";
                const sel = selectedPatientId === p.id;
                return (
                  <button
                    key={p.id}
                    onClick={() => { setSelectedPatientId(p.id); setActiveVersion(null); setConflict(false); setActiveTab("overview"); setFields({ notes: "", heartRate: "", systolicBp: "", diastolicBp: "", respiratoryRate: "", temperature: "", spo2: "", gcsScore: "", bloodGlucose: "", creatinine: "", lactate: "", wbcCount: "", plateletCount: "", isVentilated: false, isOnVasopressors: false, diagnosisName: "", diagnosisSeverity: "moderate", diagnosisIcdCode: "", labTestName: "", labTestCategory: "", labResult: "", labUnit: "", labReferenceRange: "", labIsAbnormal: false, allergyName: "", allergySeverity: "moderate", allergyReaction: "" }); setMedicationsList([{ id: Math.random().toString(), name: "", dosage: "", route: "", frequency: "" }]); }}
                    className={`w-full text-left px-3 py-2.5 rounded-xl border transition-all text-sm ${sel ? "border-primary/50 bg-primary/5" : "border-border bg-background/40 hover:bg-white/5"}`}
                  >
                    <div className="flex items-center justify-between">
                      <span className="font-semibold truncate">{name}</span>
                      <span className="font-mono text-[10px]" style={{ color: level === "critical" ? "var(--critical)" : level === "high" ? "var(--warning)" : "var(--teal)" }}>
                        {risk}%
                      </span>
                    </div>
                    <span className="font-mono text-[10px] text-muted-foreground">{p.mrn ?? p.id.slice(-6)}</span>
                  </button>
                );
              })}
            </div>
          )}
        </Card>

        {/* ── Version History ───────────────────────────────────── */}
        <Card title="Version History" className="col-span-12 lg:col-span-3">
          {!selectedPatientId ? (
            <p className="text-sm text-muted-foreground py-4 text-center">Select a patient</p>
          ) : versionsQuery.isLoading ? (
            <div className="flex items-center gap-2 py-4 text-muted-foreground text-sm justify-center">
              <Loader2 className="size-4 animate-spin" />
            </div>
          ) : versions.length > 0 ? (
            <ol className="relative border-l border-border ml-2 space-y-3">
              {versions.map((v: { version: number; changesSummary: string; createdAt: string; updatedBy?: { firstName: string; lastName: string } }) => {
                const sel = v.version === currentVersion;
                return (
                  <li key={v.version} className="ml-4">
                    <button onClick={() => setActiveVersion(v.version)} className={`text-left w-full rounded-xl p-3 border transition-all ${sel ? "border-primary/50 bg-primary/5" : "border-border bg-background/40 hover:bg-white/5"}`}>
                      <span className="absolute -left-1.5 mt-1 size-3 rounded-full bg-primary glow-cyan" />
                      <div className="flex items-center justify-between">
                        <span className="font-mono text-xs text-primary">v{v.version}</span>
                        <span className="font-mono text-[10px] text-muted-foreground">{new Date(v.createdAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}</span>
                      </div>
                      <p className="mt-1 text-sm">{v.changesSummary}</p>
                      {v.updatedBy && (
                        <div className="mt-1 flex items-center justify-between">
                          <span className="text-[10px] text-muted-foreground">{v.updatedBy.firstName} {v.updatedBy.lastName}</span>
                          <span className="font-mono text-[10px] text-emerald flex items-center gap-1">
                            <GitCommit className="size-3" /> #{v.version.toString().padStart(4, "0")}
                          </span>
                        </div>
                      )}
                    </button>
                    {!sel && v.version < (patient?.version ?? 1) && user?.role === "admin" && (
                      <button
                        onClick={() => rollbackMutation.mutate({ targetVersion: v.version, reason: `Manual rollback to v${v.version}` })}
                        disabled={rollbackMutation.isPending}
                        className="mt-1 ml-0 w-full rounded-md border border-warning/30 bg-warning/5 text-warning py-1 text-[10px] font-mono uppercase tracking-widest hover:bg-warning/10 disabled:opacity-60 flex items-center justify-center gap-1"
                      >
                        <RotateCcw className="size-3" /> Rollback
                      </button>
                    )}
                  </li>
                );
              })}
            </ol>
          ) : (
            // Mock version history when no real data
            [
              { v: "v1.4.7", t: "14:22:04", actor: "Dr. Chen", note: "Propofol 50 → 75mg IV", hash: "0x9af3" },
              { v: "v1.4.6", t: "13:51:18", actor: "Nurse Kelly", note: "Vitals snapshot · ABG ordered", hash: "0x7b21" },
              { v: "v1.4.5", t: "13:14:02", actor: "AI Engine", note: "Mortality risk recalculated", hash: "0x5d10" },
            ].map((v) => (
              <li key={v.v} className="ml-4">
                <button onClick={() => {}} className="text-left w-full rounded-xl p-3 border border-border bg-background/40">
                  <div className="flex items-center justify-between">
                    <span className="font-mono text-xs text-primary">{v.v}</span>
                    <span className="font-mono text-[10px] text-muted-foreground">{v.t}</span>
                  </div>
                  <p className="mt-1 text-sm">{v.note}</p>
                </button>
              </li>
            ))
          )}
        </Card>

        {/* ── EHR View / Editor ───────────────────────────────────────── */}
        <div className="col-span-12 lg:col-span-6 space-y-4">
          {patient && (
            <div className="flex bg-background/40 p-1 rounded-lg border border-border w-max">
              <button onClick={() => setActiveTab("overview")} className={`px-4 py-1.5 text-xs font-mono uppercase tracking-widest rounded-md transition-colors ${activeTab === "overview" ? "bg-primary/20 text-primary" : "text-muted-foreground hover:bg-white/5"}`}>Overview</button>
              {['doctor', 'nurse', 'lab_technician'].includes(user?.role) && (
                <button onClick={() => setActiveTab("editor")} className={`px-4 py-1.5 text-xs font-mono uppercase tracking-widest rounded-md transition-colors ${activeTab === "editor" ? "bg-primary/20 text-primary" : "text-muted-foreground hover:bg-white/5"}`}>Editor</button>
              )}
            </div>
          )}

          <Card
            title={activeTab === "overview" ? "Medical Record Overview" : `Editing · v${currentVersion}`}
            glow={activeTab === "overview" ? "emerald" : "cyan"}
            action={
              <div className="flex items-center gap-2">
                <span className="font-mono text-[10px] text-emerald inline-flex items-center gap-1">
                  <Lock className="size-3" /> Optimistic lock
                </span>
                {selectedPatientId && user?.role === "admin" && (
                  <button onClick={() => setConflict(true)} className="rounded-md border border-warning/30 bg-warning/10 px-2 py-1 text-[10px] font-mono uppercase tracking-widest text-warning hover:bg-warning/15">
                    Sim conflict
                  </button>
                )}
              </div>
            }
          >
            {patientQuery.isLoading ? (
              <div className="flex items-center gap-2 py-8 text-muted-foreground text-sm justify-center">
                <Loader2 className="size-4 animate-spin" /> Loading EHR…
              </div>
            ) : patient ? (
              <>
                <div className="grid sm:grid-cols-2 gap-3">
                  <Editable label="First Name" value={patient.firstName} readOnly />
                  <Editable label="Last Name" value={patient.lastName} readOnly />
                  <Editable label="MRN" value={patient.mrn} readOnly />
                  <Editable label="Risk Score" value={`${patient.currentRiskScore ?? 0}%`} readOnly />
                  <Editable label="Blood Type" value={patient.bloodType ?? "—"} readOnly />
                  <Editable label="Risk Level" value={patient.riskLevel ?? "—"} readOnly />
                </div>

                {/* Diagnoses */}
                {patient.diagnoses?.length > 0 && (
                  <div className="mt-4">
                    <p className="text-[10px] font-mono uppercase tracking-widest text-muted-foreground mb-2">Diagnoses</p>
                    <div className="space-y-1.5">
                      {patient.diagnoses.map((d: { id: string; description: string; severity: string }) => (
                        <div key={d.id} className="flex items-center gap-2 px-3 py-2 rounded-lg border border-border bg-background/40 text-sm">
                          <span className="size-2 rounded-full" style={{ background: d.severity === "critical" ? "var(--critical)" : d.severity === "high" ? "var(--warning)" : "var(--teal)" }} />
                          <span>{d.description}</span>
                          <span className="ml-auto font-mono text-[10px] text-muted-foreground capitalize">{d.severity}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {activeTab === "overview" ? (
                  <div className="mt-4 grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="rounded-xl border border-border bg-background/40 p-4 space-y-3">
                      <p className="text-[10px] font-mono uppercase tracking-widest text-muted-foreground border-b border-border pb-2">Current Vitals & Biomarkers</p>
                      {patient.vitals?.[0] ? (
                        <div className="grid grid-cols-2 gap-x-4 gap-y-2 text-sm">
                          <div className="flex justify-between"><span className="text-muted-foreground">HR:</span> <span>{patient.vitals[0].heartRate} bpm</span></div>
                          <div className="flex justify-between"><span className="text-muted-foreground">BP:</span> <span>{patient.vitals[0].systolicBp || "—"}/{patient.vitals[0].diastolicBp || "—"}</span></div>
                          <div className="flex justify-between"><span className="text-muted-foreground">SpO2:</span> <span>{patient.vitals[0].spo2}%</span></div>
                          <div className="flex justify-between"><span className="text-muted-foreground">Resp:</span> <span>{patient.vitals[0].respiratoryRate || "—"} /min</span></div>
                          <div className="flex justify-between"><span className="text-muted-foreground">Temp:</span> <span>{patient.vitals[0].temperature}°C</span></div>
                          <div className="flex justify-between"><span className="text-muted-foreground">GCS:</span> <span>{patient.vitals[0].gcsScore}</span></div>
                          <div className="flex justify-between"><span className="text-muted-foreground">Glucose:</span> <span>{patient.vitals[0].bloodGlucose || "—"}</span></div>
                          <div className="flex justify-between"><span className="text-muted-foreground">Lactate:</span> <span>{patient.vitals[0].lactate || "—"}</span></div>
                          <div className="flex justify-between"><span className="text-muted-foreground">Creatinine:</span> <span>{patient.vitals[0].creatinine || "—"}</span></div>
                          <div className="flex justify-between"><span className="text-muted-foreground">WBC:</span> <span>{patient.vitals[0].wbcCount || "—"}</span></div>
                          <div className="flex justify-between col-span-2 mt-1 pt-2 border-t border-border/50"><span className="text-muted-foreground">Support:</span> <span className="font-mono text-[10px] uppercase text-warning">{patient.vitals[0].isVentilated ? "Ventilator " : ""}{patient.vitals[0].isOnVasopressors ? "Vasopressors" : ""}{!patient.vitals[0].isVentilated && !patient.vitals[0].isOnVasopressors ? <span className="text-muted-foreground">None</span> : ""}</span></div>
                        </div>
                      ) : <p className="text-xs text-muted-foreground">No vitals recorded.</p>}
                    </div>

                    <div className="space-y-4">
                      <div className="rounded-xl border border-border bg-background/40 p-4 space-y-3">
                        <p className="text-[10px] font-mono uppercase tracking-widest text-muted-foreground border-b border-border pb-2">Active Medications & Allergies</p>
                        {patient.medications?.length > 0 ? (
                          <div className="space-y-2 mb-3">
                            {patient.medications.map((m: any) => (
                              <div key={m.id} className="text-sm leading-tight"><span className="text-emerald font-mono">Rx</span> {m.name} <br/><span className="text-muted-foreground text-xs pl-5">{m.dosage} {m.route ? `· ${m.route}` : ""} {m.frequency ? `· ${m.frequency}` : ""}</span></div>
                            ))}
                          </div>
                        ) : <p className="text-xs text-muted-foreground mb-3">No active medications.</p>}
                        {patient.allergies?.length > 0 && (
                          <div className="space-y-1 border-t border-border pt-3">
                            {patient.allergies.map((a: any) => (
                              <div key={a.id} className="text-sm text-critical flex items-center gap-2"><span className="font-mono">⚠</span> {a.allergen} <span className="text-muted-foreground text-xs capitalize ml-auto">{a.severity}</span></div>
                            ))}
                          </div>
                        )}
                      </div>

                      <div className="rounded-xl border border-border bg-background/40 p-4 space-y-3">
                        <p className="text-[10px] font-mono uppercase tracking-widest text-muted-foreground border-b border-border pb-2">Lab Reports</p>
                        {patient.labReports?.length > 0 ? (
                          <div className="space-y-2">
                            {patient.labReports.slice(0, 4).map((l: any) => (
                              <div key={l.id} className="flex justify-between items-center text-sm">
                                <span className="truncate"><span className="text-cyan font-mono mr-2">Lab</span>{l.testName}</span>
                                <span className="font-mono text-xs">{l.result} {l.unit} {l.isAbnormal && <span className="text-critical ml-1 font-bold">!</span>}</span>
                              </div>
                            ))}
                          </div>
                        ) : <p className="text-xs text-muted-foreground">No lab reports.</p>}
                      </div>
                    </div>
                  </div>
                ) : (
                  <>
                  <div className="mt-4 grid grid-cols-1 md:grid-cols-2 gap-4">
                    
                    {/* Vitals & Support */}
                  {['doctor', 'nurse'].includes(user?.role) && (
                    <div className="rounded-xl border border-border bg-background/40 p-4 space-y-3">
                      <p className="text-[10px] font-mono uppercase tracking-widest text-muted-foreground border-b border-border pb-2">Vitals & Support</p>
                      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                        <label className="block">
                          <span className="text-[9px] font-mono text-muted-foreground uppercase">Heart Rate (bpm)</span>
                          <input type="number" value={fields.heartRate} onChange={e => setFields(f => ({...f, heartRate: e.target.value}))} className="mt-1 w-full rounded-md border border-border bg-background/60 px-2 py-1.5 text-xs outline-none focus:border-primary/50" />
                        </label>
                        <label className="block">
                          <span className="text-[9px] font-mono text-muted-foreground uppercase">SpO2 (%)</span>
                          <input type="number" value={fields.spo2} onChange={e => setFields(f => ({...f, spo2: e.target.value}))} className="mt-1 w-full rounded-md border border-border bg-background/60 px-2 py-1.5 text-xs outline-none focus:border-primary/50" />
                        </label>
                        <label className="block">
                          <span className="text-[9px] font-mono text-muted-foreground uppercase">Temp (°C)</span>
                          <input type="number" value={fields.temperature} onChange={e => setFields(f => ({...f, temperature: e.target.value}))} className="mt-1 w-full rounded-md border border-border bg-background/60 px-2 py-1.5 text-xs outline-none focus:border-primary/50" />
                        </label>
                        <label className="block">
                          <span className="text-[9px] font-mono text-muted-foreground uppercase">Resp. Rate</span>
                          <input type="number" value={fields.respiratoryRate} onChange={e => setFields(f => ({...f, respiratoryRate: e.target.value}))} className="mt-1 w-full rounded-md border border-border bg-background/60 px-2 py-1.5 text-xs outline-none focus:border-primary/50" />
                        </label>
                        <label className="block">
                          <span className="text-[9px] font-mono text-muted-foreground uppercase">Systolic BP</span>
                          <input type="number" value={fields.systolicBp} onChange={e => setFields(f => ({...f, systolicBp: e.target.value}))} className="mt-1 w-full rounded-md border border-border bg-background/60 px-2 py-1.5 text-xs outline-none focus:border-primary/50" />
                        </label>
                        <label className="block">
                          <span className="text-[9px] font-mono text-muted-foreground uppercase">Diastolic BP</span>
                          <input type="number" value={fields.diastolicBp} onChange={e => setFields(f => ({...f, diastolicBp: e.target.value}))} className="mt-1 w-full rounded-md border border-border bg-background/60 px-2 py-1.5 text-xs outline-none focus:border-primary/50" />
                        </label>
                        <label className="block col-span-2">
                          <span className="text-[9px] font-mono text-muted-foreground uppercase">GCS Score (3-15)</span>
                          <input type="number" value={fields.gcsScore} onChange={e => setFields(f => ({...f, gcsScore: e.target.value}))} className="mt-1 w-full rounded-md border border-border bg-background/60 px-2 py-1.5 text-xs outline-none focus:border-primary/50" />
                        </label>
                      </div>
                      <div className="flex items-center gap-4 pt-2">
                        <label className="flex items-center gap-2 text-xs text-muted-foreground cursor-pointer hover:text-foreground transition-colors">
                          <input type="checkbox" checked={fields.isVentilated} onChange={e => setFields(f => ({...f, isVentilated: e.target.checked}))} className="rounded border-border bg-background/60 text-primary focus:ring-primary/50" />
                          Mechanical Vent
                        </label>
                        <label className="flex items-center gap-2 text-xs text-muted-foreground cursor-pointer hover:text-foreground transition-colors">
                          <input type="checkbox" checked={fields.isOnVasopressors} onChange={e => setFields(f => ({...f, isOnVasopressors: e.target.checked}))} className="rounded border-border bg-background/60 text-primary focus:ring-primary/50" />
                          Vasopressors
                        </label>
                      </div>
                    </div>
                  )}

                  {/* Diagnoses & Medications */}
                  {['doctor'].includes(user?.role) && (
                    <div className="rounded-xl border border-border bg-background/40 p-4 space-y-3">
                      <p className="text-[10px] font-mono uppercase tracking-widest text-muted-foreground border-b border-border pb-2">Diagnoses & Meds</p>
                      
                      <div className="grid grid-cols-3 gap-2">
                        <label className="block col-span-2">
                          <span className="text-[9px] font-mono text-muted-foreground uppercase flex items-center justify-between">New Diagnosis <select value={fields.diagnosisSeverity} onChange={e => setFields(f => ({...f, diagnosisSeverity: e.target.value}))} className="bg-transparent text-[9px] outline-none text-primary cursor-pointer"><option value="mild" className="bg-background">Mild</option><option value="moderate" className="bg-background">Moderate</option><option value="severe" className="bg-background">Severe</option><option value="critical" className="bg-background">Critical</option></select></span>
                          <input value={fields.diagnosisName} onChange={e => setFields(f => ({...f, diagnosisName: e.target.value}))} placeholder="e.g., Acute Myocardial Infarction" className="mt-1 w-full rounded-md border border-border bg-background/60 px-2 py-1.5 text-xs outline-none focus:border-primary/50" />
                        </label>
                        <label className="block">
                          <span className="text-[9px] font-mono text-muted-foreground uppercase">ICD-10 Code</span>
                          <input value={fields.diagnosisIcdCode} onChange={e => setFields(f => ({...f, diagnosisIcdCode: e.target.value}))} placeholder="e.g. I21.9" className="mt-1 w-full rounded-md border border-border bg-background/60 px-2 py-1.5 text-xs outline-none focus:border-primary/50" />
                        </label>
                      </div>

                      <div className="space-y-3 mt-3">
                        {medicationsList.map((med) => (
                          <div key={med.id} className="relative grid grid-cols-2 lg:grid-cols-4 gap-3 p-3 border border-border/50 rounded-lg bg-background/20">
                            <label className="block col-span-2 lg:col-span-1">
                              <span className="text-[9px] font-mono text-muted-foreground uppercase flex items-center justify-between">Medication {medicationsList.length > 1 && <button type="button" onClick={() => setMedicationsList(l => l.filter(m => m.id !== med.id))} className="text-critical hover:text-critical/80 -mr-1">✕</button>}</span>
                              <input value={med.name} onChange={e => setMedicationsList(l => l.map(m => m.id === med.id ? {...m, name: e.target.value} : m))} placeholder="e.g. Norepinephrine" className="mt-1 w-full rounded-md border border-border bg-background/60 px-2 py-1.5 text-xs outline-none focus:border-primary/50" />
                            </label>
                            <label className="block">
                              <span className="text-[9px] font-mono text-muted-foreground uppercase">Dosage</span>
                              <input value={med.dosage} onChange={e => setMedicationsList(l => l.map(m => m.id === med.id ? {...m, dosage: e.target.value} : m))} placeholder="e.g. 5mcg/min" className="mt-1 w-full rounded-md border border-border bg-background/60 px-2 py-1.5 text-xs outline-none focus:border-primary/50" />
                            </label>
                            <label className="block">
                              <span className="text-[9px] font-mono text-muted-foreground uppercase">Route</span>
                              <input value={med.route} onChange={e => setMedicationsList(l => l.map(m => m.id === med.id ? {...m, route: e.target.value} : m))} placeholder="e.g. IV" className="mt-1 w-full rounded-md border border-border bg-background/60 px-2 py-1.5 text-xs outline-none focus:border-primary/50" />
                            </label>
                            <label className="block">
                              <span className="text-[9px] font-mono text-muted-foreground uppercase">Frequency</span>
                              <input value={med.frequency} onChange={e => setMedicationsList(l => l.map(m => m.id === med.id ? {...m, frequency: e.target.value} : m))} placeholder="e.g. Continuous" className="mt-1 w-full rounded-md border border-border bg-background/60 px-2 py-1.5 text-xs outline-none focus:border-primary/50" />
                            </label>
                          </div>
                        ))}
                        <button type="button" onClick={() => setMedicationsList(l => [...l, { id: Math.random().toString(), name: "", dosage: "", route: "", frequency: "" }])} className="w-full rounded-md border border-dashed border-border/50 py-2 text-[10px] font-mono uppercase tracking-widest text-muted-foreground hover:bg-white/5 hover:text-foreground transition-colors">
                          + Add Medication
                        </button>
                      </div>
                    </div>
                  )}

                  {/* Clinical Workup (Labs & Biomarkers) */}
                  {['doctor', 'lab_technician'].includes(user?.role) && (
                    <div className="rounded-xl border border-border bg-background/40 p-4 space-y-3">
                      <p className="text-[10px] font-mono uppercase tracking-widest text-muted-foreground border-b border-border pb-2">Biomarkers & Lab Results</p>
                      <div className="grid grid-cols-4 gap-3">
                        <label className="block">
                          <span className="text-[9px] font-mono text-muted-foreground uppercase">Glucose (mg/dL)</span>
                          <input type="number" value={fields.bloodGlucose} onChange={e => setFields(f => ({...f, bloodGlucose: e.target.value}))} className="mt-1 w-full rounded-md border border-border bg-background/60 px-2 py-1.5 text-xs outline-none focus:border-primary/50" />
                        </label>
                        <label className="block">
                          <span className="text-[9px] font-mono text-muted-foreground uppercase">Lactate (mmol/L)</span>
                          <input type="number" value={fields.lactate} onChange={e => setFields(f => ({...f, lactate: e.target.value}))} className="mt-1 w-full rounded-md border border-border bg-background/60 px-2 py-1.5 text-xs outline-none focus:border-primary/50" />
                        </label>
                        <label className="block">
                          <span className="text-[9px] font-mono text-muted-foreground uppercase">Creatinine</span>
                          <input type="number" value={fields.creatinine} onChange={e => setFields(f => ({...f, creatinine: e.target.value}))} className="mt-1 w-full rounded-md border border-border bg-background/60 px-2 py-1.5 text-xs outline-none focus:border-primary/50" />
                        </label>
                        <label className="block">
                          <span className="text-[9px] font-mono text-muted-foreground uppercase">WBC</span>
                          <input type="number" value={fields.wbcCount} onChange={e => setFields(f => ({...f, wbcCount: e.target.value}))} className="mt-1 w-full rounded-md border border-border bg-background/60 px-2 py-1.5 text-xs outline-none focus:border-primary/50" />
                        </label>
                      </div>
                      
                      <div className="grid grid-cols-2 lg:grid-cols-4 gap-2 border-t border-border pt-3">
                        <label className="block col-span-2">
                          <span className="text-[9px] font-mono text-muted-foreground uppercase">Formal Test Name</span>
                          <input value={fields.labTestName} onChange={e => setFields(f => ({...f, labTestName: e.target.value}))} placeholder="e.g. Comprehensive Metabolic Panel" className="mt-1 w-full rounded-md border border-border bg-background/60 px-2 py-1.5 text-xs outline-none focus:border-primary/50" />
                        </label>
                        <label className="block">
                          <span className="text-[9px] font-mono text-muted-foreground uppercase">Category</span>
                          <input value={fields.labTestCategory} onChange={e => setFields(f => ({...f, labTestCategory: e.target.value}))} placeholder="e.g. Chemistry" className="mt-1 w-full rounded-md border border-border bg-background/60 px-2 py-1.5 text-xs outline-none focus:border-primary/50" />
                        </label>
                        <label className="block">
                          <span className="text-[9px] font-mono text-muted-foreground uppercase">Result</span>
                          <input value={fields.labResult} onChange={e => setFields(f => ({...f, labResult: e.target.value}))} placeholder="e.g. K+ 5.2 (High)" className="mt-1 w-full rounded-md border border-border bg-background/60 px-2 py-1.5 text-xs outline-none focus:border-primary/50" />
                        </label>
                      </div>
                    </div>
                  )}

                  {/* Allergies */}
                  {['doctor', 'nurse'].includes(user?.role) && (
                    <div className="rounded-xl border border-border bg-background/40 p-4 space-y-3">
                      <p className="text-[10px] font-mono uppercase tracking-widest text-muted-foreground border-b border-border pb-2">Allergies</p>
                      <div className="grid grid-cols-3 gap-2">
                        <label className="block col-span-1">
                          <span className="text-[9px] font-mono text-muted-foreground uppercase">Allergen</span>
                          <input value={fields.allergyName} onChange={e => setFields(f => ({...f, allergyName: e.target.value}))} placeholder="e.g. Penicillin" className="mt-1 w-full rounded-md border border-border bg-background/60 px-2 py-1.5 text-xs outline-none focus:border-primary/50" />
                        </label>
                        <label className="block col-span-2">
                          <span className="text-[9px] font-mono text-muted-foreground uppercase flex justify-between">Reaction <span className="text-primary cursor-pointer text-[9px]">Severity: <select value={fields.allergySeverity} onChange={e => setFields(f => ({...f, allergySeverity: e.target.value}))} className="bg-transparent outline-none cursor-pointer"><option value="mild" className="bg-background">Mild</option><option value="moderate" className="bg-background">Moderate</option><option value="severe" className="bg-background">Severe</option></select></span></span>
                          <input value={fields.allergyReaction} onChange={e => setFields(f => ({...f, allergyReaction: e.target.value}))} placeholder="e.g. Hives, Anaphylaxis" className="mt-1 w-full rounded-md border border-border bg-background/60 px-2 py-1.5 text-xs outline-none focus:border-primary/50" />
                        </label>
                      </div>
                    </div>
                  )}
                </div>

                {/* Progress Note & Commit */}
                {['doctor', 'nurse', 'lab_technician'].includes(user?.role) && (
                  <div className="mt-4 rounded-xl border border-border bg-background/40 p-4">
                    <p className="text-[10px] font-mono uppercase tracking-widest text-muted-foreground mb-2">Progress Note</p>
                    <textarea
                      value={fields.notes}
                      onChange={(e) => setFields((f) => ({ ...f, notes: e.target.value }))}
                      placeholder="Enter clinical notes, procedure details, or plan updates..."
                      className="w-full rounded-lg bg-background/60 border border-border p-3 text-sm leading-relaxed h-16 outline-none focus:border-primary/50 resize-none"
                    />
                    
                    <div className="mt-3 flex items-center justify-between border-t border-border pt-3">
                      <div className="flex items-center gap-2 text-[10px] font-mono text-muted-foreground">
                        <GitBranch className="size-3" /> version-{currentVersion}
                        <span className="size-1 rounded-full bg-muted-foreground/40" />
                        {saveStatus === "saved" && <span className="text-emerald inline-flex items-center gap-1"><Check className="size-3" /> Saved</span>}
                        {saveStatus === "error" && <span className="text-critical">Conflict or error</span>}
                      </div>
                      <button
                        onClick={handleSave}
                        disabled={updateMutation.isPending || !hasChanges}
                        className="rounded-lg bg-primary px-4 py-2 text-xs font-semibold text-primary-foreground glow-cyan inline-flex items-center gap-2 disabled:opacity-60 transition-all hover:brightness-110"
                      >
                        {updateMutation.isPending ? <Loader2 className="size-3.5 animate-spin" /> : <Save className="size-3.5" />}
                        Commit snapshot
                      </button>
                    </div>
                  </div>
                )}
                </>
                )}
              </>
            ) : (
              <div className="py-16 text-center text-muted-foreground text-sm">
                <GitBranch className="size-10 mx-auto opacity-20 mb-3" />
                Select a patient from the list to edit their EHR
              </div>
            )}
          </Card>

          {/* ── Conflict Resolution UI ────────────────────────── */}
          <AnimatePresence>
            {conflict ? (
              <motion.div key="conflict-ui" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}>
                <Card title="⚠ Conflict Detected" glow="critical">
                  <div className="rounded-xl border border-critical/30 bg-critical/5 p-4 scanline">
                    <p className="text-sm">
                      <strong className="text-critical">Concurrent write detected.</strong> Optimistic lock prevented overwrite (version mismatch). PulseGrid prepared a 3-way merge — review and resolve.
                    </p>
                    <div className="mt-3 grid grid-cols-3 gap-2 text-xs font-mono">
                      <div className="rounded-md bg-background/60 border border-border p-2">
                        <p className="text-[10px] text-muted-foreground">YOURS · v{currentVersion}</p>
                        <p className="text-cyan mt-1">Your changes</p>
                      </div>
                      <div className="rounded-md bg-background/60 border border-border p-2">
                        <p className="text-[10px] text-muted-foreground">THEIRS · v{currentVersion}b</p>
                        <p className="text-warning mt-1">Remote changes</p>
                      </div>
                      <div className="rounded-md bg-background/60 border border-emerald/30 p-2">
                        <p className="text-[10px] text-muted-foreground">RESOLVED</p>
                        <p className="text-emerald mt-1">Latest wins</p>
                      </div>
                    </div>
                    <div className="mt-3 flex gap-2">
                      <button onClick={() => { setConflict(false); qc.invalidateQueries({ queryKey: ["patient-ehr", selectedPatientId] }); }} className="rounded-md bg-emerald/15 border border-emerald/30 text-emerald px-3 py-1.5 text-[10px] font-mono uppercase tracking-widest inline-flex items-center gap-1.5">
                        <GitMerge className="size-3" /> Accept merge
                      </button>
                      <button onClick={() => setConflict(false)} className="rounded-md border border-border bg-background/60 px-3 py-1.5 text-[10px] font-mono uppercase tracking-widest">
                        Discard mine
                      </button>
                    </div>
                  </div>
                </Card>
              </motion.div>
            ) : null}
          </AnimatePresence>

          {/* ── Audit Activity ────────────────────────────────────── */}
          {patient && (
            <Card title="Activity · Who Updated What">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-[10px] font-mono uppercase tracking-widest text-muted-foreground">
                    <th className="text-left py-2">Time</th>
                    <th className="text-left">Actor</th>
                    <th className="text-left">Change</th>
                    <th className="text-right">Version</th>
                  </tr>
                </thead>
                <tbody>
                  {versions.slice(0, 5).map((v: { version: number; changesSummary: string; createdAt: string; updatedBy?: { firstName: string; lastName: string } }) => (
                    <tr key={v.version} className="border-t border-border hover:bg-white/3">
                      <td className="py-2 font-mono text-xs text-muted-foreground">{new Date(v.createdAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}</td>
                      <td className="text-sm">{v.updatedBy ? `${v.updatedBy.firstName} ${v.updatedBy.lastName}` : "System"}</td>
                      <td className="text-sm text-muted-foreground">{v.changesSummary}</td>
                      <td className="text-right font-mono text-xs text-emerald">v{v.version}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </Card>
          )}
        </div>
      </div>
    </AppShell>
  );
}

function Editable({ label, value, readOnly }: { label: string; value: string; readOnly?: boolean }) {
  return (
    <label className="block">
      <span className="text-[10px] font-mono uppercase tracking-widest text-muted-foreground">{label}</span>
      <input
        defaultValue={value}
        readOnly={readOnly}
        className={`mt-1 w-full rounded-lg border border-border bg-background/60 px-3 py-2 text-sm outline-none ${readOnly ? "opacity-60 cursor-not-allowed" : "focus:border-primary/50"}`}
      />
    </label>
  );
}
