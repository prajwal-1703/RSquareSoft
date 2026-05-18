import { createFileRoute } from "@tanstack/react-router";
import { AnimatePresence, motion } from "framer-motion";
import { AlertOctagon, Ambulance, Loader2, Pause, Play, RotateCcw, Siren, Zap } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { Area, AreaChart, ResponsiveContainer, XAxis, YAxis } from "recharts";
import { AppShell, Card } from "@/components/AppShell";
import { simulationApi } from "@/lib/api";
import { useSimulationEvents } from "@/lib/hooks";

export const Route = createFileRoute("/emergency")({
  head: () => ({ meta: [{ title: "Emergency Simulation · PulseGrid AI" }] }),
  component: Emergency,
});

interface Event { id: number; t: string; text: string; tone: "critical" | "warning" | "emerald" | "cyan" }

function Emergency() {
  const [running, setRunning] = useState(true);
  const [tick, setTick] = useState(0);
  const [inflow, setInflow] = useState<{ t: number; v: number }[]>(() => Array.from({ length: 20 }, (_, i) => ({ t: i, v: 4 + Math.sin(i / 2) * 2 })));
  const [events, setEvents] = useState<Event[]>([
    { id: 0, t: "T+00:00", text: "Mass-casualty protocol ARMED · Bay 03", tone: "critical" },
  ]);
  const [simLoading, setSimLoading] = useState<string | null>(null);
  const [simError, setSimError] = useState<string | null>(null);
  const idRef = useRef(1);

  // ── Real-time WebSocket simulation events ─────────────────────
  const { events: wsEvents } = useSimulationEvents();

  // Inject WebSocket events into the local event feed
  useEffect(() => {
    if (wsEvents.length === 0) return;
    const latest = wsEvents[0];
    let text = "";
    let tone: Event["tone"] = "cyan";

    if (latest.type === "PATIENT_ARRIVAL") {
      const p = latest.patient as { name: string; riskLevel: string; riskScore: number };
      text = `Patient arrival: ${p?.name} · Risk ${p?.riskScore}% (${p?.riskLevel})`;
      tone = p?.riskLevel === "critical" ? "critical" : p?.riskLevel === "high" ? "warning" : "emerald";
    } else if (latest.type === "MCI_COMPLETE") {
      const s = latest.summary as { total: number; critical: number };
      text = `MCI complete · ${s?.total} patients created, ${s?.critical} critical`;
      tone = "emerald";
    } else if (latest.type === "ICU_OVERLOAD") {
      text = "ICU OVERLOAD · Emergency reallocation protocol activated";
      tone = "critical";
    } else {
      text = `Simulation: ${latest.type}`;
    }

    if (text) {
      setEvents((evs) => [{ id: idRef.current++, t: stamp(tick), text, tone }, ...evs].slice(0, 14));
      setInflow((prev) => [...prev.slice(-19), { t: prev[prev.length - 1].t + 1, v: 6 + Math.random() * 10 + 8 }]);
    }
  }, [wsEvents]);

  // ── Local simulation ticker ───────────────────────────────────
  useEffect(() => {
    if (!running) return;
    const id = setInterval(() => { setTick((t) => t + 1); }, 1400);
    return () => clearInterval(id);
  }, [running]);

  useEffect(() => {
    if (tick === 0) return;
    setInflow((prev) => [...prev.slice(-19), { t: prev[prev.length - 1].t + 1, v: 6 + Math.random() * 10 + (tick > 5 ? 8 : 0) }]);
    const templates: Event[] = [
      { id: 0, t: stamp(tick), text: "Trauma inflow +3 patients · Ambulance bay 02", tone: "warning" },
      { id: 0, t: stamp(tick), text: "Ventilator allocated → ICU-A Bed 07 (auto)", tone: "cyan" },
      { id: 0, t: stamp(tick), text: "Step-down complete · Novak, A → Ward 4B", tone: "emerald" },
      { id: 0, t: stamp(tick), text: "CRITICAL · Bed 209 SpO₂ 78% · escalation routed", tone: "critical" },
      { id: 0, t: stamp(tick), text: "AI re-prioritized 11 patients (Δ < 80ms)", tone: "cyan" },
    ];
    const pick = templates[Math.floor(Math.random() * templates.length)];
    setEvents((evs) => [{ ...pick, id: idRef.current++ }, ...evs].slice(0, 14));
  }, [tick]);

  // ── Real simulation triggers ──────────────────────────────────
  const runSimulation = async (type: "mass-casualty" | "icu-overload" | "alert-storm") => {
    setSimLoading(type);
    setSimError(null);
    try {
      if (type === "mass-casualty") {
        await simulationApi.massCasualty({ patientCount: 10, scenario: "mixed" });
        const newEvent: Event = { id: idRef.current++, t: stamp(tick), text: "🚨 Mass casualty simulation started · 10 synthetic patients", tone: "critical" };
        setEvents((evs) => [newEvent, ...evs].slice(0, 14));
      } else if (type === "icu-overload") {
        await simulationApi.icuOverload();
        const newEvent: Event = { id: idRef.current++, t: stamp(tick), text: "⚠ ICU overload simulation triggered", tone: "warning" };
        setEvents((evs) => [newEvent, ...evs].slice(0, 14));
      } else {
        await simulationApi.alertStorm(5);
        const newEvent: Event = { id: idRef.current++, t: stamp(tick), text: "🔔 Alert storm: 5 critical alerts fired", tone: "warning" };
        setEvents((evs) => [newEvent, ...evs].slice(0, 14));
      }
    } catch {
      setSimError("Backend offline — simulation runs in local mode only");
      const newEvent: Event = { id: idRef.current++, t: stamp(tick), text: "⚠ Backend offline · local simulation active", tone: "warning" };
      setEvents((evs) => [newEvent, ...evs].slice(0, 14));
    } finally {
      setSimLoading(null);
    }
  };

  const inflowNow = inflow[inflow.length - 1]?.v ?? 0;
  const overload = inflowNow > 12;

  return (
    <AppShell title="Emergency Simulation Center" subtitle="Live mass-casualty drill · concurrent allocation under load">
      <div className="grid grid-cols-12 gap-4">
        <Card title="Drill Controls" className="col-span-12 md:col-span-5" glow={overload ? "critical" : "cyan"}>
          <div className="flex items-center justify-between">
            <div>
              <p className="text-[10px] font-mono uppercase tracking-widest text-muted-foreground">Status</p>
              <p className={`mt-1 font-mono text-2xl ${overload ? "text-critical" : "text-emerald"}`}>
                {overload ? "ICU OVERLOAD" : running ? "RUNNING" : "PAUSED"}
              </p>
            </div>
            <motion.div animate={{ scale: [1, 1.06, 1] }} transition={{ repeat: Infinity, duration: 1.4 }} className={`grid place-items-center size-16 rounded-full ${overload ? "bg-critical/20 glow-critical" : "bg-cyan/20"}`}>
              <Siren className={`size-7 ${overload ? "text-critical" : "text-cyan"}`} />
            </motion.div>
          </div>
          <div className="mt-4 flex gap-2">
            <button onClick={() => setRunning((r) => !r)} className="flex-1 inline-flex items-center justify-center gap-2 rounded-lg bg-primary text-primary-foreground px-3 py-2.5 text-xs font-semibold">
              {running ? <Pause className="size-4" /> : <Play className="size-4" />} {running ? "Pause" : "Resume"}
            </button>
            <button
              onClick={() => { setTick(0); setEvents([{ id: idRef.current++, t: "T+00:00", text: "Reset · protocol re-armed", tone: "critical" }]); setInflow(Array.from({ length: 20 }, (_, i) => ({ t: i, v: 4 + Math.sin(i / 2) * 2 }))); }}
              className="rounded-lg border border-border bg-background/60 px-3 py-2.5 text-xs font-semibold inline-flex items-center gap-2"
            >
              <RotateCcw className="size-4" /> Reset
            </button>
          </div>

          {/* Real API Simulation buttons */}
          <div className="mt-4 border-t border-border pt-4">
            <p className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground mb-3">Backend Simulations</p>
            {simError && <p className="mb-2 text-[10px] text-warning bg-warning/10 border border-warning/30 rounded px-2 py-1">{simError}</p>}
            <div className="grid grid-cols-1 gap-2">
              <button
                onClick={() => runSimulation("mass-casualty")}
                disabled={!!simLoading}
                className="rounded-lg border border-critical/30 bg-critical/10 text-critical px-3 py-2 text-xs font-mono uppercase tracking-widest hover:bg-critical/15 disabled:opacity-60 inline-flex items-center justify-center gap-2"
              >
                {simLoading === "mass-casualty" ? <Loader2 className="size-3 animate-spin" /> : <Siren className="size-3" />}
                Mass Casualty (10 patients)
              </button>
              <button
                onClick={() => runSimulation("icu-overload")}
                disabled={!!simLoading}
                className="rounded-lg border border-warning/30 bg-warning/10 text-warning px-3 py-2 text-xs font-mono uppercase tracking-widest hover:bg-warning/15 disabled:opacity-60 inline-flex items-center justify-center gap-2"
              >
                {simLoading === "icu-overload" ? <Loader2 className="size-3 animate-spin" /> : <AlertOctagon className="size-3" />}
                ICU Overload Event
              </button>
              <button
                onClick={() => runSimulation("alert-storm")}
                disabled={!!simLoading}
                className="rounded-lg border border-cyan/30 bg-cyan/10 text-cyan px-3 py-2 text-xs font-mono uppercase tracking-widest hover:bg-cyan/15 disabled:opacity-60 inline-flex items-center justify-center gap-2"
              >
                {simLoading === "alert-storm" ? <Loader2 className="size-3 animate-spin" /> : <Zap className="size-3" />}
                Alert Storm (5 alerts)
              </button>
            </div>
          </div>

          <div className="mt-4 grid grid-cols-3 gap-2 text-xs">
            <Block label="Inflow" value={`${Math.round(inflowNow)}/min`} tone={overload ? "critical" : "cyan"} />
            <Block label="Beds free" value={`${Math.max(0, 8 - tick)}`} tone={tick > 6 ? "critical" : "emerald"} />
            <Block label="Vents free" value={`${Math.max(0, 12 - tick * 2)}`} tone={tick > 4 ? "warning" : "emerald"} />
          </div>
        </Card>


        <Card title="Decision Engine · Real-time" className="col-span-12 md:col-span-7" glow="cyan">
          <div className="space-y-2 max-h-80 overflow-hidden">
            <AnimatePresence initial={false}>
              {events.map((e) => (
                <motion.div
                  key={e.id}
                  layout
                  initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: 20 }}
                  className="flex items-center gap-3 p-3 rounded-xl border border-border bg-background/40"
                >
                  <span className="size-2 rounded-full shrink-0" style={{ background: `var(--${e.tone})`, boxShadow: `0 0 10px var(--${e.tone})` }} />
                  <span className="font-mono text-[10px] text-muted-foreground w-16 shrink-0">{e.t}</span>
                  <span className="text-sm flex-1">{e.text}</span>
                </motion.div>
              ))}
            </AnimatePresence>
          </div>
        </Card>

        <Card title="Resource Movement" className="col-span-12 md:col-span-5" glow={overload ? "critical" : "emerald"}>
          <div className="space-y-3">
            <Movement icon={Ambulance} from="Bay 02" to="ICU-A · 07" tone="critical" />
            <Movement icon={AlertOctagon} from="ICU-B · 21" to="Step-down" tone="emerald" />
            <Movement icon={Ambulance} from="Bay 03" to="ICU-C · 14" tone="warning" />
            <Movement icon={AlertOctagon} from="ER · Triage" to="ICU-A · 11" tone="critical" />
          </div>
          <div className="mt-4 rounded-xl border border-critical/30 bg-critical/5 p-3 scanline">
            <p className="font-mono text-[10px] uppercase tracking-widest text-critical">Auto-protocol</p>
            <p className="mt-1 text-sm">All discharges accelerated · 4 beds freed in 18min. AI confidence 96%.</p>
          </div>
        </Card>

        <Card title="Concurrent Allocation Requests" className="col-span-12">
          <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-2">
            {Array.from({ length: 12 }).map((_, i) => {
              const states = ["resolved", "queued", "racing", "resolved", "racing", "queued"] as const;
              const s = states[(i + tick) % states.length];
              const tone = s === "resolved" ? "emerald" : s === "racing" ? "warning" : "cyan";
              return (
                <motion.div
                  key={i} layout
                  className="rounded-xl border border-border bg-background/40 p-3"
                >
                  <p className="font-mono text-[10px] text-muted-foreground">REQ #{1024 + i}</p>
                  <p className="text-sm font-semibold">Bed-{20 + i}</p>
                  <p className={`mt-1 font-mono text-[10px] uppercase`} style={{ color: `var(--${tone})` }}>{s}</p>
                  <div className="mt-2 h-1 rounded-full bg-white/5 overflow-hidden">
                    <motion.div animate={{ width: s === "resolved" ? "100%" : s === "racing" ? "65%" : "30%" }} transition={{ duration: 0.6 }} className="h-full" style={{ background: `var(--${tone})` }} />
                  </div>
                </motion.div>
              );
            })}
          </div>
        </Card>
      </div>
    </AppShell>
  );
}

function stamp(tick: number) {
  const s = tick * 14;
  const mm = String(Math.floor(s / 60)).padStart(2, "0");
  const ss = String(s % 60).padStart(2, "0");
  return `T+${mm}:${ss}`;
}
function Block({ label, value, tone }: { label: string; value: string; tone: string }) {
  return (
    <div className="rounded-lg border border-border bg-background/40 p-2.5">
      <p className="text-[9px] font-mono uppercase tracking-widest text-muted-foreground">{label}</p>
      <p className="font-mono text-base" style={{ color: `var(--${tone})` }}>{value}</p>
    </div>
  );
}
function Movement({ icon: Icon, from, to, tone }: { icon: React.ElementType; from: string; to: string; tone: string }) {
  return (
    <div className="flex items-center gap-3 p-3 rounded-xl border border-border bg-background/40">
      <span className="grid place-items-center size-9 rounded-lg" style={{ background: `color-mix(in oklab, var(--${tone}) 15%, transparent)`, color: `var(--${tone})` }}>
        <Icon className="size-4" />
      </span>
      <span className="text-sm">{from}</span>
      <motion.span animate={{ x: [0, 6, 0] }} transition={{ repeat: Infinity, duration: 1.4 }} className="text-muted-foreground">→</motion.span>
      <span className="text-sm font-semibold">{to}</span>
    </div>
  );
}
