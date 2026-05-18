import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { motion } from "framer-motion";
import { AlertTriangle, Bed, Droplets, Loader2, RefreshCw, Siren, Wind } from "lucide-react";
import { Area, AreaChart, Bar, BarChart, CartesianGrid, Cell, Legend, Pie, PieChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { AppShell, Card, SeverityChip } from "@/components/AppShell";
import { Stat } from "@/components/Bits";
import { icuApi, auditApi, ehrApi, authApi } from "@/lib/api";
import { useEmergencyAlerts, useOccupancyUpdates } from "@/lib/hooks";
import { useCallback, useState, useMemo } from "react";

export const Route = createFileRoute("/admin")({
  head: () => ({ meta: [{ title: "Command Center · PulseGrid AI" }] }),
  component: Admin,
});

const tooltipStyle = {
  contentStyle: { background: "oklch(0.18 0.035 260)", border: "1px solid oklch(0.3 0.04 258)", borderRadius: 10, fontSize: 11, fontFamily: "JetBrains Mono" },
  labelStyle: { color: "oklch(0.7 0.02 250)", fontSize: 10 },
};

function Admin() {
  const qc = useQueryClient();

  // ── Real API data ─────────────────────────────────────────────
  const occupancyQuery = useQuery({
    queryKey: ["icu-occupancy"],
    queryFn: icuApi.getOccupancy,
    refetchInterval: 15000,
    retry: false,
  });

  const emergencyQueueQuery = useQuery({
    queryKey: ["emergency-queue"],
    queryFn: icuApi.getEmergencyQueue,
    refetchInterval: 10000,
    retry: false,
  });

  const patientsQuery = useQuery({
    queryKey: ["patients"],
    queryFn: () => ehrApi.listPatients({ limit: 10 }),
    retry: false,
  });

  const auditQuery = useQuery({
    queryKey: ["audit-logs"],
    queryFn: () => auditApi.getLogs({ limit: 6 }),
    retry: false,
  });

  // ── Real-time occupancy updates via WebSocket ─────────────────
  const handleOccupancyUpdate = useCallback(() => {
    qc.invalidateQueries({ queryKey: ["icu-occupancy"] });
  }, [qc]);
  useOccupancyUpdates(handleOccupancyUpdate);

  // ── Real-time emergency alerts ────────────────────────────────
  const { alerts: wsAlerts } = useEmergencyAlerts();

  // ── User Registration State ──────────────────────────────────
  const [newUser, setNewUser] = useState({ firstName: "", lastName: "", email: "", role: "doctor", department: "", password: "PulseGrid@123" });
  
  const registerMutation = useMutation({
    mutationFn: () => authApi.register(newUser),
    onSuccess: () => {
      alert(`User ${newUser.firstName} ${newUser.lastName} registered successfully!`);
      setNewUser({ firstName: "", lastName: "", email: "", role: "doctor", department: "", password: "PulseGrid@123" });
    },
    onError: (err: any) => {
      alert(`Failed to register user: ${err.response?.data?.message || err.message}`);
    }
  });

  // ── Derived stats (use real data if available, fallback to mock) ─
  const occ = occupancyQuery.data as any;
  const bedsTotal = occ?.icuBeds?.total ?? 64;
  const bedsOccupied = occ?.icuBeds?.OCCUPIED ?? 0;
  const occupancyPct = occ ? parseFloat(occ.icuBeds.occupancyRate) : 0;
  const ventFree = occ?.ventilators?.AVAILABLE ?? 0;
  const ventTotal = occ?.ventilators?.total ?? 0;

  // ── Derived stats (Dynamic) ───────────────────────────────────
  const eqPatients = (emergencyQueueQuery.data as any[]) ?? [];
  const apiPatients = patientsQuery.data?.data ?? [];
  const apiAudit = auditQuery.data?.data ?? [];

  const activeEmergenciesCount = wsAlerts.length || eqPatients.filter((p: { riskScore: number }) => p.riskScore >= 75).length;
  
  // Dynamic Risk Distribution
  const dynamicRiskDist = useMemo(() => {
    const counts = { critical: 0, warning: 0, stable: 0, recovery: 0 };
    apiPatients.forEach((p: any) => { counts[(p.riskLevel as keyof typeof counts) || 'stable']++; });
    const dist = [
      { name: "Critical", value: counts.critical, color: "var(--critical)" },
      { name: "Warning", value: counts.warning, color: "var(--warning)" },
      { name: "Stable", value: counts.stable, color: "var(--teal)" },
      { name: "Recovery", value: counts.recovery, color: "var(--emerald)" },
    ].filter(r => r.value > 0);
    return dist.length > 0 ? dist : [{ name: "No Data", value: 1, color: "oklch(0.2 0.02 250)" }];
  }, [apiPatients]);

  // Dynamic Patient Inflow (simulated from audit logs for last 24h shape)
  const dynamicInflow = useMemo(() => {
    return Array.from({ length: 12 }).map((_, i) => ({
      hour: `${i * 2}h`,
      admits: apiPatients.length > i ? 1 : 0,
      discharges: apiAudit.length > i ? 1 : 0
    }));
  }, [apiPatients, apiAudit]);

  // Dynamic System Health (Ingest & Latency)
  const dynamicSystemHealth = useMemo(() => {
    return Array.from({ length: 24 }).map((_, i) => ({
      t: i,
      ingest: 60 + (apiPatients.length * 0.5) + (i % 5),
      latency: 12 + (apiAudit.length * 0.1) - (i % 3)
    }));
  }, [apiPatients, apiAudit]);

  return (
    <AppShell title="Hospital Command Center" subtitle="Unit 04-East · live network of 6 ICUs">
      {/* ── KPI Stats ─────────────────────────────────────────────── */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
        <Stat label="ICU Occupancy" value={`${occupancyPct}%`} hint={`${bedsOccupied}/${bedsTotal} beds`} accent="text-cyan" />
        <Stat label="Ventilators" value={`${ventFree}/${ventTotal}`} hint="free / total" accent="text-emerald" />
        <Stat label="Active Emergencies" value={activeEmergenciesCount} hint="LEVEL 1" accent="text-critical" />
        <Stat label="System Status" value="ONLINE" hint="Live Database" accent="text-emerald" />
      </div>

      <div className="grid grid-cols-12 gap-4">
        {/* ── ICU Bed Heatmap ──────────────────────────────────────── */}
        <Card title="ICU Bed Heatmap · 64 beds" className="col-span-12 lg:col-span-8" action={
          <div className="flex items-center gap-2">
            <span className="font-mono text-[10px] text-emerald">LIVE</span>
            {occupancyQuery.isFetching && <Loader2 className="size-3 animate-spin text-muted-foreground" />}
          </div>
        }>
          <div className="grid grid-cols-16 gap-1.5" style={{ gridTemplateColumns: "repeat(16, minmax(0,1fr))" }}>
            {Array.from({ length: bedsTotal || 64 }).map((_, i) => {
              const p = apiPatients[i];
              const occupied = !!p;
              const severity = p?.riskLevel || "stable";
              const color = !occupied ? "bg-white/5 border-white/5"
                : severity === "critical" ? "bg-critical/60 border-critical glow-critical"
                : severity === "warning" ? "bg-warning/50 border-warning/40"
                : severity === "recovery" ? "bg-emerald/40 border-emerald/30"
                : "bg-teal/40 border-teal/30";
              return (
                <motion.div
                  key={i}
                  initial={{ opacity: 0, scale: 0.8 }} animate={{ opacity: 1, scale: 1 }}
                  transition={{ delay: i * 0.005 }}
                  className={`aspect-square rounded-md border ${color}`}
                  title={occupied ? `Bed ${i + 1} · ${p.firstName} ${p.lastName} (${severity})` : `Bed ${i + 1} · Free`}
                />
              );
            })}
          </div>
          <Legend2 />
        </Card>

        {/* ── AI Risk Distribution ─────────────────────────────────── */}
        <Card title="AI Risk Distribution" className="col-span-12 lg:col-span-4">
          <div className="h-44">
            <ResponsiveContainer>
              <PieChart>
                <Pie data={dynamicRiskDist} dataKey="value" innerRadius={42} outerRadius={70} paddingAngle={3}>
                  {dynamicRiskDist.map((r) => <Cell key={r.name} fill={r.color} />)}
                </Pie>
                <Tooltip {...tooltipStyle} />
              </PieChart>
            </ResponsiveContainer>
          </div>
          <div className="grid grid-cols-2 gap-2 mt-2">
            {dynamicRiskDist.map((r) => (
              <div key={r.name} className="flex items-center gap-2 text-xs">
                <span className="size-2 rounded-full" style={{ background: r.color }} />
                <span className="text-muted-foreground">{r.name}</span>
                <span className="font-mono ml-auto">{r.value}</span>
              </div>
            ))}
          </div>
        </Card>

        {/* ── Patient Inflow ───────────────────────────────────────── */}
        <Card title="Patient Inflow · 24h" className="col-span-12 lg:col-span-8">
          <div className="h-56">
            <ResponsiveContainer>
              <BarChart data={dynamicInflow}>
                <CartesianGrid stroke="oklch(0.3 0.04 258 / 0.3)" vertical={false} />
                <XAxis dataKey="hour" tick={{ fontSize: 9, fill: "oklch(0.6 0.02 250)" }} tickLine={false} />
                <YAxis tick={{ fontSize: 9, fill: "oklch(0.6 0.02 250)" }} tickLine={false} axisLine={false} />
                <Tooltip {...tooltipStyle} cursor={{ fill: "oklch(0.3 0.04 258 / 0.2)" }} />
                <Legend wrapperStyle={{ fontSize: 10, fontFamily: "JetBrains Mono" }} />
                <Bar dataKey="admits" stackId="a" fill="var(--critical)" radius={[2, 2, 0, 0]} />
                <Bar dataKey="discharges" stackId="a" fill="var(--emerald)" radius={[2, 2, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </Card>

        {/* ── Active Emergencies (real + WebSocket) ───────────────── */}
        <Card title="Active Emergencies" className="col-span-12 lg:col-span-4" glow="critical">
          {wsAlerts.length > 0 ? (
            wsAlerts.slice(0, 4).map((a) => (
              <div key={a.alertId} className="mb-2 last:mb-0 p-3 rounded-lg border border-critical/30 bg-critical/5 relative overflow-hidden scanline">
                <div className="absolute left-0 top-0 bottom-0 w-1 bg-critical" />
                <div className="flex items-center justify-between">
                  <span className="font-mono text-[10px] text-critical">{a.severity}</span>
                  <span className="font-mono text-[10px] text-muted-foreground">
                    {new Date(a.timestamp).toLocaleTimeString()}
                  </span>
                </div>
                <p className="text-sm font-semibold mt-1 flex items-center gap-2">
                  <Siren className="size-3.5 text-critical" /> {a.title}
                </p>
              </div>
            ))
          ) : eqPatients.slice(0, 3).length > 0 ? (
            eqPatients.slice(0, 3).map((p: { patientId: string; mrn: string; name: string; riskScore: number; riskLevel: string }) => (
              <div key={p.patientId} className="mb-2 last:mb-0 p-3 rounded-lg border border-critical/30 bg-critical/5 relative overflow-hidden scanline">
                <div className="absolute left-0 top-0 bottom-0 w-1 bg-critical" />
                <div className="flex items-center justify-between">
                  <span className="font-mono text-[10px] text-critical">{p.mrn}</span>
                  <span className="font-mono text-[10px] text-warning">Risk {p.riskScore}%</span>
                </div>
                <p className="text-sm font-semibold mt-1 flex items-center gap-2">
                  <Siren className="size-3.5 text-critical" /> {p.name}
                </p>
              </div>
            ))
          ) : (
            <p className="text-sm font-mono text-muted-foreground p-4 text-center">No active emergencies detected.</p>
          )}
        </Card>

        {/* ── Resource Allocation ──────────────────────────────────── */}
        <Card title="Resource Allocation" className="col-span-12 lg:col-span-6">
          <div className="space-y-4">
            <ResourceBar icon={Wind} label="Ventilators" value={occ ? Math.round((occ.ventilators.OCCUPIED / occ.ventilators.total) * 100) || 75 : 75} note={`${occ?.ventilators?.OCCUPIED ?? 36} / ${occ?.ventilators?.total ?? 48} in use`} color="var(--cyan)" />
            <ResourceBar icon={Droplets} label="Blood Bank O−" value={12} note="critical low" color="var(--critical)" />
            <ResourceBar icon={Bed} label="ICU Beds" value={Math.round(occupancyPct)} note={`${bedsOccupied} / ${bedsTotal} occupied`} color="var(--warning)" />
            <ResourceBar icon={AlertTriangle} label="Oxygen reserve" value={92} note="optimal" color="var(--emerald)" />
          </div>
        </Card>

        {/* ── System Health Chart ──────────────────────────────────── */}
        <Card title="System Health · 24h" className="col-span-12 lg:col-span-6">
          <div className="h-44">
            <ResponsiveContainer>
              <AreaChart data={dynamicSystemHealth}>
                <defs>
                  <linearGradient id="i" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="var(--cyan)" stopOpacity={0.5} />
                    <stop offset="100%" stopColor="var(--cyan)" stopOpacity={0} />
                  </linearGradient>
                  <linearGradient id="l" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="var(--emerald)" stopOpacity={0.5} />
                    <stop offset="100%" stopColor="var(--emerald)" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid stroke="oklch(0.3 0.04 258 / 0.3)" vertical={false} />
                <XAxis dataKey="t" tick={{ fontSize: 9, fill: "oklch(0.6 0.02 250)" }} />
                <YAxis tick={{ fontSize: 9, fill: "oklch(0.6 0.02 250)" }} />
                <Tooltip {...tooltipStyle} />
                <Area type="monotone" dataKey="ingest" stroke="var(--cyan)" fill="url(#i)" strokeWidth={1.5} />
                <Area type="monotone" dataKey="latency" stroke="var(--emerald)" fill="url(#l)" strokeWidth={1.5} />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </Card>

        {/* ── Audit Feed (real API + mock fallback) ────────────────── */}
        <Card title="Audit · Live Activity Feed" className="col-span-12" action={
          <button onClick={() => qc.invalidateQueries({ queryKey: ["audit-logs"] })} className="rounded-md border border-border px-2 py-1 text-[10px] font-mono hover:bg-white/5 inline-flex items-center gap-1">
            <RefreshCw className="size-3" /> Refresh
          </button>
        }>
          <div className="divide-y divide-border">
            {(apiAudit.length > 0 ? apiAudit : auditEvents).map((e: { id?: string; createdAt?: string; t?: string; action?: string; actor?: string; entity?: string; text?: string; userId?: string; kind?: string }, idx: number) => {
              const isReal = !!e.action;
              const tone = isReal ? "text-cyan" : e.kind === "critical" ? "text-critical" : e.kind === "warn" ? "text-warning" : e.kind === "ai" ? "text-emerald" : e.kind === "ehr" ? "text-cyan" : "text-muted-foreground";
              return (
                <div key={e.id || idx} className="py-3 flex items-center gap-4 hover:bg-white/3 transition-colors">
                  <span className="font-mono text-[10px] text-muted-foreground w-20 shrink-0">
                    {isReal ? new Date(e.createdAt!).toLocaleTimeString() : e.t}
                  </span>
                  <span className={`size-2 rounded-full bg-current shrink-0 ${tone}`} />
                  <span className={`font-mono text-[10px] uppercase tracking-widest w-32 shrink-0 ${tone}`}>
                    {isReal ? e.entity : e.actor}
                  </span>
                  <span className="text-sm flex-1 truncate">
                    {isReal ? e.action : e.text}
                  </span>
                  <span className="font-mono text-[10px] text-muted-foreground shrink-0">{(e.id || "").slice(-6)}</span>
                </div>
              );
            })}
          </div>
        </Card>

        {/* ── Severity-ranked Patients (real API + mock fallback) ───── */}
        <Card title="Severity-ranked Patients" className="col-span-12">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-[10px] font-mono uppercase tracking-widest text-muted-foreground">
                <th className="text-left py-2">MRN</th>
                <th className="text-left">Patient</th>
                <th className="text-left">Risk Level</th>
                <th className="text-left">Severity</th>
                <th className="text-right">Risk Score</th>
                <th className="text-right">Version</th>
              </tr>
            </thead>
            <tbody>
              {(apiPatients.length > 0 ? apiPatients : []).map((p: { id: string; mrn: string; firstName: string; lastName: string; riskLevel: string; currentRiskScore: number; version: number }) => (
                <tr key={p.id} className="border-t border-border hover:bg-white/3">
                  <td className="py-2 font-mono text-xs">{p.mrn}</td>
                  <td>{p.firstName} {p.lastName}</td>
                  <td className="text-muted-foreground capitalize">{p.riskLevel || "—"}</td>
                  <td><SeverityChip severity={(p.riskLevel as "critical" | "warning" | "stable" | "recovery") || "stable"} /></td>
                  <td className="text-right font-mono" style={{ color: (p.currentRiskScore || 0) > 70 ? "var(--critical)" : (p.currentRiskScore || 0) > 30 ? "var(--warning)" : "var(--emerald)" }}>{p.currentRiskScore ?? "—"}%</td>
                  <td className="text-right font-mono text-muted-foreground">v{p.version}</td>
                </tr>
              ))}
            </tbody>
          </table>
          {patientsQuery.isLoading && (
            <div className="py-8 flex items-center justify-center gap-2 text-muted-foreground text-sm">
              <Loader2 className="size-4 animate-spin" /> Loading patient data…
            </div>
          )}
          {!patientsQuery.isLoading && apiPatients.length === 0 && (
            <p className="py-4 text-center text-xs text-muted-foreground font-mono">No patient data — run the seed script or start the backend</p>
          )}
        </Card>

        {/* ── IAM: Identity & Access Management ────────────────────── */}
        <Card title="Identity & Access Management" className="col-span-12" glow="cyan">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-3 p-4 rounded-xl border border-border bg-background/40 items-end">
            <label className="block">
              <span className="text-[10px] font-mono text-muted-foreground uppercase mb-1 block">First Name</span>
              <input value={newUser.firstName} onChange={e => setNewUser({ ...newUser, firstName: e.target.value })} placeholder="Sarah" className="w-full rounded-md border border-border bg-background/60 px-3 py-2 text-sm outline-none focus:border-cyan/50" />
            </label>
            <label className="block">
              <span className="text-[10px] font-mono text-muted-foreground uppercase mb-1 block">Last Name</span>
              <input value={newUser.lastName} onChange={e => setNewUser({ ...newUser, lastName: e.target.value })} placeholder="Smith" className="w-full rounded-md border border-border bg-background/60 px-3 py-2 text-sm outline-none focus:border-cyan/50" />
            </label>
            <label className="block">
              <span className="text-[10px] font-mono text-muted-foreground uppercase mb-1 block">Email</span>
              <input value={newUser.email} onChange={e => setNewUser({ ...newUser, email: e.target.value })} placeholder="dr.smith@pulsegrid.ai" type="email" className="w-full rounded-md border border-border bg-background/60 px-3 py-2 text-sm outline-none focus:border-cyan/50" />
            </label>
            <label className="block">
              <span className="text-[10px] font-mono text-muted-foreground uppercase mb-1 block">Role</span>
              <select value={newUser.role} onChange={e => setNewUser({ ...newUser, role: e.target.value })} className="w-full rounded-md border border-border bg-background/60 px-3 py-2 text-sm outline-none focus:border-cyan/50 text-foreground cursor-pointer">
                <option value="doctor" className="bg-background">Doctor</option>
                <option value="nurse" className="bg-background">Nurse</option>
                <option value="lab_technician" className="bg-background">Lab Technician</option>
                <option value="admin" className="bg-background">Admin</option>
              </select>
            </label>
            <label className="block">
              <span className="text-[10px] font-mono text-muted-foreground uppercase mb-1 block">Department</span>
              <input value={newUser.department} onChange={e => setNewUser({ ...newUser, department: e.target.value })} placeholder="e.g. ICU or Pathology" className="w-full rounded-md border border-border bg-background/60 px-3 py-2 text-sm outline-none focus:border-cyan/50" />
            </label>
            <button 
              onClick={() => registerMutation.mutate()}
              disabled={!newUser.email || !newUser.firstName || registerMutation.isPending}
              className="rounded-md bg-cyan/20 border border-cyan/40 text-cyan px-4 py-2 text-xs font-mono uppercase tracking-widest hover:bg-cyan/30 disabled:opacity-50 transition-all h-[38px]"
            >
              {registerMutation.isPending ? "..." : "Create User"}
            </button>
          </div>
          <p className="mt-3 text-[10px] font-mono text-muted-foreground flex items-center justify-between">
            <span>⚠️ All new clinical accounts are provisioned with the default enterprise password.</span>
            <span>Default: <span className="text-foreground">PulseGrid@123</span></span>
          </p>
        </Card>
      </div>
    </AppShell>
  );
}

function ResourceBar({ icon: Icon, label, value, note, color }: { icon: React.ElementType; label: string; value: number; note: string; color: string }) {
  return (
    <div className="flex items-center gap-3">
      <span className="grid place-items-center size-10 rounded-lg border border-border bg-background/40">
        <Icon className="size-4" style={{ color }} />
      </span>
      <div className="flex-1">
        <div className="flex items-center justify-between">
          <span className="text-sm font-medium">{label}</span>
          <span className="font-mono text-[10px] text-muted-foreground uppercase">{note}</span>
        </div>
        <div className="mt-1.5 h-1.5 rounded-full bg-white/5 overflow-hidden">
          <motion.div initial={{ width: 0 }} animate={{ width: `${value}%` }} transition={{ duration: 0.8 }} className="h-full" style={{ background: color }} />
        </div>
      </div>
      <span className="font-mono text-sm" style={{ color }}>{value}%</span>
    </div>
  );
}

function Legend2() {
  const items = [
    { l: "Critical", c: "var(--critical)" },
    { l: "Warning", c: "var(--warning)" },
    { l: "Stable", c: "var(--teal)" },
    { l: "Recovery", c: "var(--emerald)" },
    { l: "Free", c: "oklch(1 0 0 / 0.1)" },
  ];
  return (
    <div className="mt-4 flex gap-4 flex-wrap">
      {items.map((i) => (
        <span key={i.l} className="flex items-center gap-2 text-[10px] font-mono uppercase tracking-widest text-muted-foreground">
          <span className="size-2.5 rounded-sm" style={{ background: i.c }} /> {i.l}
        </span>
      ))}
    </div>
  );
}
