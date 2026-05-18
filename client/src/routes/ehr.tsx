import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { motion, AnimatePresence } from "framer-motion";
import { Check, GitBranch, GitCommit, GitMerge, Loader2, Lock, RefreshCw, RotateCcw, Save } from "lucide-react";
import { AppShell, Card } from "@/components/AppShell";
import { useState } from "react";
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
    heartRate: "",
    spo2: "",
    gcsScore: "",
    isVentilated: false,
    isOnVasopressors: false,
    diagnosisName: "",
    diagnosisSeverity: "moderate",
    medicationName: "",
    medicationDosage: ""
  });

  const handleSave = () => {
    if (!selectedPatientId || !patient) return;
    setSaveStatus("saving");

    const vitals = (fields.heartRate || fields.spo2 || fields.gcsScore || fields.isVentilated || fields.isOnVasopressors) ? {
      heartRate: fields.heartRate ? parseFloat(fields.heartRate) : undefined,
      spo2: fields.spo2 ? parseFloat(fields.spo2) : undefined,
      gcsScore: fields.gcsScore ? parseFloat(fields.gcsScore) : undefined,
      isVentilated: fields.isVentilated,
      isOnVasopressors: fields.isOnVasopressors
    } : undefined;

    const diagnosis = fields.diagnosisName ? {
      description: fields.diagnosisName,
      severity: fields.diagnosisSeverity
    } : undefined;

    const medication = fields.medicationName ? {
      name: fields.medicationName,
      dosage: fields.medicationDosage || "Standard dose",
      frequency: "PRN"
    } : undefined;

    updateMutation.mutate({
      version: patient.version,
      ...(vitals ? { vitals } : {}),
      ...(diagnosis ? { diagnosis } : {}),
      ...(medication ? { medication } : {}),
      ...(fields.notes ? { notes: fields.notes } : {})
    });
  };

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
                    onClick={() => { setSelectedPatientId(p.id); setActiveVersion(null); setConflict(false); setFields({ notes: "", heartRate: "", spo2: "", gcsScore: "", isVentilated: false, isOnVasopressors: false, diagnosisName: "", diagnosisSeverity: "moderate", medicationName: "", medicationDosage: "" }); }}
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

        {/* ── EHR Editor ───────────────────────────────────────── */}
        <div className="col-span-12 lg:col-span-6 space-y-4">
          <Card
            title={`Editing · v${currentVersion}`}
            glow="cyan"
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

                <div className="mt-4 grid grid-cols-1 md:grid-cols-2 gap-4">
                  
                  {/* Vitals & Support */}
                  <div className="rounded-xl border border-border bg-background/40 p-4 space-y-3">
                    <p className="text-[10px] font-mono uppercase tracking-widest text-muted-foreground border-b border-border pb-2">Vitals & Support</p>
                    <div className="grid grid-cols-2 gap-3">
                      <label className="block">
                        <span className="text-[9px] font-mono text-muted-foreground uppercase">Heart Rate (bpm)</span>
                        <input type="number" value={fields.heartRate} onChange={e => setFields(f => ({...f, heartRate: e.target.value}))} className="mt-1 w-full rounded-md border border-border bg-background/60 px-2 py-1.5 text-xs outline-none focus:border-primary/50" />
                      </label>
                      <label className="block">
                        <span className="text-[9px] font-mono text-muted-foreground uppercase">SpO2 (%)</span>
                        <input type="number" value={fields.spo2} onChange={e => setFields(f => ({...f, spo2: e.target.value}))} className="mt-1 w-full rounded-md border border-border bg-background/60 px-2 py-1.5 text-xs outline-none focus:border-primary/50" />
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

                  {/* Diagnoses & Medications */}
                  <div className="rounded-xl border border-border bg-background/40 p-4 space-y-3">
                    <p className="text-[10px] font-mono uppercase tracking-widest text-muted-foreground border-b border-border pb-2">Diagnoses & Meds</p>
                    <label className="block">
                      <span className="text-[9px] font-mono text-muted-foreground uppercase flex items-center justify-between">New Diagnosis <select value={fields.diagnosisSeverity} onChange={e => setFields(f => ({...f, diagnosisSeverity: e.target.value}))} className="bg-transparent text-[9px] outline-none text-primary cursor-pointer"><option value="stable" className="bg-background">Stable</option><option value="high" className="bg-background">High</option><option value="critical" className="bg-background">Critical</option></select></span>
                      <input value={fields.diagnosisName} onChange={e => setFields(f => ({...f, diagnosisName: e.target.value}))} placeholder="e.g., Acute Myocardial Infarction" className="mt-1 w-full rounded-md border border-border bg-background/60 px-2 py-1.5 text-xs outline-none focus:border-primary/50" />
                    </label>
                    <div className="grid grid-cols-2 gap-3 mt-3">
                      <label className="block">
                        <span className="text-[9px] font-mono text-muted-foreground uppercase">Medication</span>
                        <input value={fields.medicationName} onChange={e => setFields(f => ({...f, medicationName: e.target.value}))} placeholder="e.g., Norepinephrine" className="mt-1 w-full rounded-md border border-border bg-background/60 px-2 py-1.5 text-xs outline-none focus:border-primary/50" />
                      </label>
                      <label className="block">
                        <span className="text-[9px] font-mono text-muted-foreground uppercase">Dosage</span>
                        <input value={fields.medicationDosage} onChange={e => setFields(f => ({...f, medicationDosage: e.target.value}))} placeholder="e.g., 5mcg/min" className="mt-1 w-full rounded-md border border-border bg-background/60 px-2 py-1.5 text-xs outline-none focus:border-primary/50" />
                      </label>
                    </div>
                  </div>

                </div>

                {/* Progress Note & Commit */}
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
                      disabled={updateMutation.isPending || (!fields.notes && !fields.diagnosisName && !fields.heartRate && !fields.medicationName && !fields.isVentilated && !fields.isOnVasopressors)}
                      className="rounded-lg bg-primary px-4 py-2 text-xs font-semibold text-primary-foreground glow-cyan inline-flex items-center gap-2 disabled:opacity-60 transition-all hover:brightness-110"
                    >
                      {updateMutation.isPending ? <Loader2 className="size-3.5 animate-spin" /> : <Save className="size-3.5" />}
                      Commit snapshot
                    </button>
                  </div>
                </div>
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
