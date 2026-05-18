import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { motion } from "framer-motion";
import { ArrowRight, BedDouble, BrainCircuit, Loader2, Wind } from "lucide-react";
import { AppShell, Card, SeverityChip } from "@/components/AppShell";
import { RiskBar } from "@/components/Bits";
import { beds, patients } from "@/lib/mock";
import { icuApi } from "@/lib/api";
import { useAuth } from "@/lib/hooks";

export const Route = createFileRoute("/icu")({
  head: () => ({ meta: [{ title: "ICU Allocation Engine · PulseGrid AI" }] }),
  component: ICU,
});

function ICU() {
  const { user } = useAuth();
  const qc = useQueryClient();
  const queue = [...patients].sort((a, b) => b.risk - a.risk).slice(0, 6);

  const occupancyQuery = useQuery({
    queryKey: ["icu-occupancy"],
    queryFn: icuApi.getOccupancy,
    refetchInterval: 15000,
    retry: false,
  });

  const emergencyQueue = useQuery({
    queryKey: ["emergency-queue"],
    queryFn: icuApi.getEmergencyQueue,
    refetchInterval: 10000,
    retry: false,
  });

  const occ = occupancyQuery.data as any;
  const ventInUse = occ?.ventilators?.OCCUPIED ?? 36;
  const ventTotal = occ?.ventilators?.total ?? 48;
  const bedOccupied = occ?.icuBeds?.OCCUPIED ?? 56;
  const bedTotal = occ?.icuBeds?.total ?? 64;
  const eqPatients = (emergencyQueue.data as any[]) ?? [];

  const allocateMutation = useMutation({
    mutationFn: (data: { patientId: string; resourceType: "ICU_BED" | "VENTILATOR" }) =>
      icuApi.allocate({ ...data, reason: "Emergency queue priority allocation" }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["icu-occupancy"] });
      qc.invalidateQueries({ queryKey: ["emergency-queue"] });
    },
  });

  const aiRecommendations = eqPatients.slice(0, 3).map((p: any) => ({
    patientId: p.patientId,
    from: p.hasIcuBed ? "Standard Ward" : "Emergency Room",
    to: p.hasIcuBed ? "Ventilator Support" : "ICU Bed",
    reason: `Risk score ${p.riskScore}% — allocate immediately`,
    conf: Math.min(99, p.riskScore + 12),
    resourceType: p.hasIcuBed ? "VENTILATOR" : "ICU_BED"
  }));

  return (
    <AppShell title="ICU Allocation Engine" subtitle="Live bed & ventilator routing · 6 ICUs synchronized">
      <div className="grid grid-cols-12 gap-4">
        <Card title="ICU Bed Map · live" className="col-span-12 lg:col-span-8" glow="cyan">
          <div className="grid gap-1.5" style={{ gridTemplateColumns: "repeat(16, minmax(0,1fr))" }}>
            {beds.map((b) => {
              const color = !b.occupied ? "bg-white/5 border-white/10 hover:bg-cyan/20 cursor-pointer"
                : b.severity === "critical" ? "bg-critical/60 border-critical glow-critical"
                : b.severity === "warning" ? "bg-warning/50 border-warning/40"
                : b.severity === "recovery" ? "bg-emerald/40 border-emerald/30"
                : "bg-teal/40 border-teal/30";
              return (
                <motion.div
                  key={b.id}
                  whileHover={{ scale: 1.15 }}
                  initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: b.id * 0.005 }}
                  className={`aspect-square rounded-md border ${color} relative`}
                  title={`Bed ${b.id}`}
                >
                  <span className="absolute inset-0 grid place-items-center font-mono text-[8px] text-foreground/70">{b.id}</span>
                </motion.div>
              );
            })}
          </div>
          <div className="mt-4 flex flex-wrap gap-3 text-[10px] font-mono uppercase tracking-widest text-muted-foreground">
            <Legend color="var(--critical)" label="Critical" />
            <Legend color="var(--warning)" label="Warning" />
            <Legend color="var(--teal)" label="Stable" />
            <Legend color="var(--emerald)" label="Recovery" />
            <Legend color="oklch(1 0 0 / 0.15)" label="Free · clickable" />
          </div>
        </Card>

        <Card title="Ventilator Allocation" className="col-span-12 lg:col-span-4" glow="emerald">
          <div className="flex items-center justify-between">
            <div>
              <p className="font-mono text-4xl text-emerald">{ventInUse}<span className="text-muted-foreground text-lg">/{ventTotal}</span></p>
              <p className="text-xs text-muted-foreground">in active use</p>
            </div>
            <div className="flex items-center gap-2">
              <Wind className="size-10 text-emerald" />
              {occupancyQuery.isFetching && <Loader2 className="size-4 animate-spin text-muted-foreground" />}
            </div>
          </div>
          <div className="mt-4 grid grid-cols-12 gap-1">
            {Array.from({ length: ventTotal }).map((_, i) => (
              <div key={i} className={`aspect-square rounded ${i < ventInUse ? "bg-emerald/60" : "bg-white/5"}`} />
            ))}
          </div>
          <div className="mt-4 space-y-2">
            <Row label="Bed used" used={bedOccupied} total={bedTotal} />
            <Row label="Vents" used={ventInUse} total={ventTotal} />
            <Row label="Available" used={occ?.icuBeds?.AVAILABLE ?? 8} total={bedTotal} />
          </div>
        </Card>

        <Card title="Dynamic Patient Prioritization" className="col-span-12 lg:col-span-7">
          <div className="space-y-2">
            {(eqPatients.length > 0 ? eqPatients.slice(0, 6) : queue).map((p: any, i: number) => {
              const severity = p.riskLevel || p.severity || "stable";
              const riskScore = p.riskScore ?? Math.round(p.risk * 100);
              const color = severity === "critical" ? "var(--critical)" : severity === "warning" || severity === "high" ? "var(--warning)" : "var(--teal)";
              return (
                <motion.div
                  key={p.patientId || p.id} initial={{ opacity: 0, x: -10 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: i * 0.04 }}
                  className="flex items-center gap-3 p-3 rounded-xl border border-border bg-background/40"
                >
                  <span className="font-mono text-xl text-muted-foreground w-6 text-right">{i + 1}</span>
                  <SeverityChip severity={severity === "high" ? "warning" : severity === "moderate" ? "stable" : severity} />
                  <div className="flex-1">
                    <p className="text-sm font-semibold">{p.name} <span className="text-muted-foreground font-normal">· {p.mrn || p.bed}</span></p>
                    <p className="text-xs text-muted-foreground">{p.condition}</p>
                  </div>
                  <div className="w-32"><RiskBar value={riskScore / 100} color={color} /></div>
                  <span className="font-mono text-sm w-14 text-right" style={{ color }}>{riskScore}%</span>
                  <button 
                    onClick={() => allocateMutation.mutate({ patientId: p.patientId, resourceType: p.hasIcuBed ? "VENTILATOR" : "ICU_BED" })}
                    disabled={allocateMutation.isPending}
                    className="rounded-md bg-primary/15 border border-primary/30 text-primary px-2.5 py-1.5 text-[10px] font-mono uppercase tracking-widest hover:bg-primary/25 inline-flex items-center gap-1 disabled:opacity-50"
                  >
                    {allocateMutation.isPending ? <Loader2 className="size-3 animate-spin" /> : "Allocate"} <ArrowRight className="size-3" />
                  </button>
                </motion.div>
              );
            })}
          </div>
        </Card>

        <Card title="AI Recommendation Engine" className="col-span-12 lg:col-span-5" glow="cyan">
          <div className="space-y-3">
            {aiRecommendations.length > 0 ? aiRecommendations.map((r, i) => (
              <div key={i} className="rounded-xl border border-border bg-background/40 p-3">
                <div className="flex items-center justify-between">
                  <span className="flex items-center gap-2 text-sm">
                    <BedDouble className="size-3.5 text-cyan" /> {r.from}
                    <ArrowRight className="size-3.5 text-muted-foreground" />
                    <span className="text-cyan">{r.to}</span>
                  </span>
                  <span className="font-mono text-[10px] text-emerald">{r.conf}%</span>
                </div>
                <p className="mt-1 text-xs text-muted-foreground flex items-start gap-2">
                  <BrainCircuit className="size-3 mt-0.5 text-emerald shrink-0" /> {r.reason}
                </p>
                <div className="mt-2 flex gap-2">
                  <button 
                    onClick={() => allocateMutation.mutate({ patientId: r.patientId, resourceType: r.resourceType as any })}
                    disabled={allocateMutation.isPending}
                    className="flex-1 rounded-md bg-emerald/15 border border-emerald/30 text-emerald py-1.5 text-[10px] font-mono uppercase tracking-widest hover:bg-emerald/25 disabled:opacity-50 inline-flex items-center justify-center gap-2"
                  >
                    {allocateMutation.isPending ? <Loader2 className="size-3 animate-spin" /> : "Accept"}
                  </button>
                  <button className="flex-1 rounded-md border border-border bg-background/60 py-1.5 text-[10px] font-mono uppercase tracking-widest hover:bg-white/5">Defer</button>
                </div>
              </div>
            )) : (
              <div className="py-8 text-center text-xs text-muted-foreground">
                No active critical recommendations at this time.
              </div>
            )}
          </div>
        </Card>
      </div>
    </AppShell>
  );
}

function Row({ label, used, total }: { label: string; used: number; total: number }) {
  const pct = (used / total) * 100;
  return (
    <div className="flex items-center gap-3 text-xs">
      <span className="font-mono w-12 text-muted-foreground">{label}</span>
      <div className="flex-1 h-1.5 rounded-full bg-white/5 overflow-hidden">
        <div className="h-full bg-emerald" style={{ width: `${pct}%` }} />
      </div>
      <span className="font-mono w-12 text-right">{used}/{total}</span>
    </div>
  );
}
function Legend({ color, label }: { color: string; label: string }) {
  return <span className="inline-flex items-center gap-1.5"><span className="size-2.5 rounded-sm" style={{ background: color }} /> {label}</span>;
}
