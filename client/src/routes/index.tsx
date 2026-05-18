import { createFileRoute, Link } from "@tanstack/react-router";
import { motion } from "framer-motion";
import { Activity, Bell, BrainCircuit, ChevronRight, GitBranch, Heart, ShieldCheck, Siren, Workflow, Zap } from "lucide-react";
import { Area, AreaChart, ResponsiveContainer } from "recharts";
import { vitalsSeries, stats } from "@/lib/mock";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "PulseGrid AI — The Operating System for Critical Care" },
      { name: "description", content: "Real-time ICU orchestration, AI mortality risk prediction and concurrent-safe EHR for mission-critical hospitals." },
      { property: "og:title", content: "PulseGrid AI — Critical Care OS" },
      { property: "og:description", content: "Hospital command center for AI-driven ICU coordination." },
    ],
  }),
  component: Landing,
});

function Landing() {
  return (
    <div className="min-h-screen">
      <LandingNav />
      <Hero />
      <DashboardSlab />
      <Features />
      <Architecture />
      <Cta />
      <Footer />
    </div>
  );
}

function LandingNav() {
  return (
    <header className="sticky top-0 z-50 border-b border-border bg-background/70 backdrop-blur-md">
      <div className="max-w-7xl mx-auto px-6 h-16 flex items-center justify-between">
        <Link to="/" className="flex items-center gap-2.5">
          <span className="grid place-items-center size-7 rounded-md bg-primary glow-cyan">
            <Heart className="size-4 text-primary-foreground" />
          </span>
          <span className="font-extrabold tracking-tight italic">
            PulseGrid<span className="text-primary">AI</span>
          </span>
        </Link>
        <nav className="hidden md:flex items-center gap-7 text-sm text-muted-foreground">
          <a href="#features" className="hover:text-foreground transition-colors">Platform</a>
          <a href="#architecture" className="hover:text-foreground transition-colors">Architecture</a>
          <Link to="/admin" className="hover:text-foreground transition-colors">Command Center</Link>
          <Link to="/icu" className="hover:text-foreground transition-colors">AI Engine</Link>
        </nav>
        <div className="flex items-center gap-3">
          <Link to="/login" className="text-sm text-muted-foreground hover:text-foreground">Sign in</Link>
          <Link to="/admin" className="inline-flex items-center gap-1.5 rounded-md bg-primary px-3.5 py-1.5 text-xs font-semibold text-primary-foreground hover:opacity-90">
            Launch console <ChevronRight className="size-3.5" />
          </Link>
        </div>
      </div>
    </header>
  );
}

function Hero() {
  return (
    <section className="relative overflow-hidden">
      <div className="absolute inset-0 grid-bg opacity-40 [mask-image:radial-gradient(ellipse_at_top,black,transparent_70%)]" />
      <div className="absolute -top-40 left-1/2 -translate-x-1/2 size-[700px] rounded-full bg-primary/10 blur-3xl pointer-events-none" />
      <div className="relative max-w-7xl mx-auto px-6 pt-24 pb-12">
        <motion.div
          initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.7 }}
        >
          <span className="inline-flex items-center gap-2 px-2.5 py-1 rounded-full bg-cyan/10 border border-cyan/30">
            <span className="size-1.5 rounded-full bg-cyan glow-cyan animate-pulse" />
            <span className="text-[10px] font-mono uppercase tracking-[0.18em] text-cyan">Real-time ICU orchestration · live</span>
          </span>
        </motion.div>
        <div className="mt-6 grid lg:grid-cols-12 gap-10 items-end">
          <div className="lg:col-span-7">
            <motion.h1
              initial={{ opacity: 0, y: 30 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.8, delay: 0.05 }}
              className="text-5xl md:text-7xl font-extrabold tracking-tight text-balance leading-[1.02]"
            >
              The operating system for{" "}
              <span className="text-primary">critical care.</span>
            </motion.h1>
            <motion.p
              initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.8, delay: 0.15 }}
              className="mt-6 max-w-[58ch] text-lg text-muted-foreground"
            >
              PulseGrid unifies your ICU into a mission-critical command center. Predict mortality risk hours before deterioration, allocate beds and ventilators in real time, and keep every EHR write concurrent-safe and fully auditable.
            </motion.p>
            <motion.div
              initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.3 }}
              className="mt-8 flex flex-wrap gap-3"
            >
              <Link to="/admin" className="inline-flex items-center gap-2 rounded-lg bg-primary px-5 py-3 text-sm font-semibold text-primary-foreground glow-cyan hover:opacity-90">
                <Zap className="size-4" /> Initiate command center
              </Link>
              <Link to="/emergency" className="inline-flex items-center gap-2 rounded-lg border border-border bg-white/5 px-5 py-3 text-sm font-semibold text-foreground hover:bg-white/10">
                <Siren className="size-4 text-critical" /> Run emergency simulation
              </Link>
            </motion.div>
          </div>

          <div className="lg:col-span-5 grid grid-cols-2 gap-3">
            <MiniStat label="Occupancy" value={`${stats.occupancy}%`} tone="cyan" />
            <MiniStat label="Vent free" value={`${stats.ventilatorsFree}/${stats.ventilatorsTotal}`} tone="emerald" />
            <MiniStat label="Mean risk" value={stats.meanRisk.toFixed(2)} tone="warning" />
            <MiniStat label="AI confidence" value={`${stats.aiConfidence}%`} tone="cyan" />
          </div>
        </div>

        <LiveTicker />
      </div>
    </section>
  );
}

function MiniStat({ label, value, tone }: { label: string; value: string; tone: "cyan" | "emerald" | "warning" | "critical" }) {
  const colors: Record<string, string> = {
    cyan: "text-cyan", emerald: "text-emerald", warning: "text-warning", critical: "text-critical",
  };
  return (
    <div className="rounded-2xl glass p-4">
      <p className="text-[10px] font-mono uppercase tracking-widest text-muted-foreground">{label}</p>
      <p className={`mt-1.5 font-mono text-3xl font-semibold ${colors[tone]}`}>{value}</p>
    </div>
  );
}

function LiveTicker() {
  const items = [
    { k: "ICU-A", v: "94% load" }, { k: "ICU-B", v: "76% load" }, { k: "Ventilators", v: "36 in use" },
    { k: "Inflow ↑", v: "+12 / 4h" }, { k: "EHR writes", v: "1.4k/min" }, { k: "AI predictions", v: "240/s" },
  ];
  return (
    <div className="mt-14 flex items-center gap-6 overflow-x-auto py-3 px-4 border-y border-border bg-white/2">
      <span className="text-[10px] font-mono uppercase tracking-widest text-muted-foreground shrink-0">Live feed</span>
      {items.map((it, i) => (
        <div key={i} className="flex items-center gap-2 shrink-0">
          <span className="text-[10px] text-muted-foreground">{it.k}</span>
          <span className="font-mono text-xs text-foreground">{it.v}</span>
          <span className="size-1 rounded-full bg-primary/60" />
        </div>
      ))}
    </div>
  );
}

function DashboardSlab() {
  return (
    <section className="relative max-w-7xl mx-auto px-6 py-12">
      <div className="absolute -inset-x-10 top-10 h-64 bg-primary/10 blur-3xl pointer-events-none" />
      <motion.div
        initial={{ opacity: 0, y: 30 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} transition={{ duration: 0.7 }}
        className="relative rounded-3xl glass overflow-hidden ring-1 ring-white/5 shadow-2xl shadow-black/40"
      >
        <div className="h-10 px-4 flex items-center justify-between border-b border-border bg-background/40">
          <div className="flex items-center gap-2">
            <span className="size-2.5 rounded-full bg-critical/70" />
            <span className="size-2.5 rounded-full bg-warning/70" />
            <span className="size-2.5 rounded-full bg-emerald/70" />
          </div>
          <span className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground">COMMAND_CENTER / UNIT_04_EAST</span>
          <span className="font-mono text-[10px] text-emerald">UPDATING LIVE</span>
        </div>
        <div className="grid grid-cols-12 gap-4 p-5">
          <div className="col-span-12 md:col-span-8 space-y-4">
            <div className="rounded-2xl bg-background/60 border border-border p-4">
              <div className="flex items-center justify-between mb-3">
                <p className="text-[10px] font-mono uppercase tracking-widest text-muted-foreground">Vitals stream · HR / SPO2</p>
                <span className="font-mono text-[10px] text-cyan">SYNCING…</span>
              </div>
              <div className="h-44 dot-grid rounded-lg overflow-hidden">
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={vitalsSeries}>
                    <defs>
                      <linearGradient id="hr" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor="var(--critical)" stopOpacity={0.55} />
                        <stop offset="100%" stopColor="var(--critical)" stopOpacity={0} />
                      </linearGradient>
                      <linearGradient id="spo2" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor="var(--cyan)" stopOpacity={0.45} />
                        <stop offset="100%" stopColor="var(--cyan)" stopOpacity={0} />
                      </linearGradient>
                    </defs>
                    <Area type="monotone" dataKey="hr" stroke="var(--critical)" strokeWidth={1.6} fill="url(#hr)" isAnimationActive={false} />
                    <Area type="monotone" dataKey="spo2" stroke="var(--cyan)" strokeWidth={1.6} fill="url(#spo2)" isAnimationActive={false} />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            </div>
            <div className="grid grid-cols-12 gap-2">
              {Array.from({ length: 48 }).map((_, i) => {
                const r = (i * 37) % 100;
                const cls = r > 92 ? "bg-critical/70 glow-critical" : r > 75 ? "bg-warning/60" : r > 30 ? "bg-emerald/40" : "bg-white/5";
                return <div key={i} className={`aspect-square rounded ${cls}`} />;
              })}
            </div>
          </div>

          <div className="col-span-12 md:col-span-4 space-y-3">
            {[
              { bed: "ICU-04", name: "Thompson, J", risk: 88, sev: "CRITICAL", color: "critical" },
              { bed: "ICU-09", name: "Harris, M", risk: 81, sev: "CRITICAL", color: "critical" },
              { bed: "ICU-12", name: "Garcia, R", risk: 74, sev: "CRITICAL", color: "critical" },
              { bed: "ICU-02", name: "Chen, W", risk: 42, sev: "WARNING", color: "warning" },
              { bed: "ICU-21", name: "Novak, A", risk: 12, sev: "STABLE", color: "teal" },
            ].map((p) => (
              <div key={p.bed} className={`rounded-xl bg-background/60 border border-border p-3 scanline`}>
                <div className="flex items-center justify-between">
                  <span className="font-mono text-[10px] text-muted-foreground">{p.bed}</span>
                  <span className={`font-mono text-[10px]`} style={{ color: `var(--${p.color})` }}>{p.sev}</span>
                </div>
                <p className="mt-0.5 text-sm font-semibold">{p.name}</p>
                <div className="mt-2 flex items-center gap-2">
                  <div className="h-1 flex-1 rounded-full bg-white/5 overflow-hidden">
                    <div className="h-full" style={{ width: `${p.risk}%`, background: `var(--${p.color})` }} />
                  </div>
                  <span className="font-mono text-[10px] text-muted-foreground">{p.risk}%</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      </motion.div>
    </section>
  );
}

function Features() {
  const items = [
    { icon: Workflow, title: "ICU Allocation Engine", body: "Autonomous bed and ventilator orchestration with multi-factor severity scoring and live reallocation." },
    { icon: GitBranch, title: "Concurrent-safe EHR", body: "Optimistic locking, cryptographic snapshots, and an immutable audit log keep every clinician's edits consistent." },
    { icon: BrainCircuit, title: "Mortality prediction", body: "1,400+ data points / second flow into our neural net to flag deterioration hours before clinical triggers." },
    { icon: Siren, title: "Emergency response", body: "Mass-casualty simulator, escalation protocols, and live resource movement keep your team rehearsed and ready." },
    { icon: ShieldCheck, title: "Audit & compliance", body: "HIPAA & SOC2 aligned. Every action signed, every state replayable." },
    { icon: Activity, title: "Real-time telemetry", body: "Sub-50ms ingest from 200+ monitor models, unified into a single operational view." },
  ];
  return (
    <section id="features" className="max-w-7xl mx-auto px-6 py-24">
      <div className="max-w-2xl mb-12">
        <p className="font-mono text-[10px] uppercase tracking-[0.2em] text-primary">Platform</p>
        <h2 className="mt-3 text-4xl font-bold tracking-tight">Built for the moment that matters.</h2>
        <p className="mt-3 text-muted-foreground">Five subsystems, one command surface. Engineered for hospitals that can't afford latency, conflict, or guesswork.</p>
      </div>
      <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
        {items.map((it, i) => (
          <motion.div
            key={it.title}
            initial={{ opacity: 0, y: 20 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }}
            transition={{ duration: 0.5, delay: i * 0.05 }}
            className="group rounded-2xl glass p-6 hover:border-primary/30 transition-colors"
          >
            <span className="inline-flex size-10 items-center justify-center rounded-lg bg-primary/10 text-primary ring-1 ring-primary/20">
              <it.icon className="size-5" />
            </span>
            <h3 className="mt-5 text-lg font-semibold">{it.title}</h3>
            <p className="mt-2 text-sm text-muted-foreground leading-relaxed">{it.body}</p>
          </motion.div>
        ))}
      </div>
    </section>
  );
}

function Architecture() {
  const layers = [
    { name: "Ingest", desc: "Monitor / EHR / lab streams", color: "var(--cyan)" },
    { name: "Concurrent state", desc: "Conflict-free EHR snapshots", color: "var(--teal)" },
    { name: "AI engine", desc: "Mortality + deterioration models", color: "var(--emerald)" },
    { name: "Allocation", desc: "Live bed & ventilator routing", color: "var(--warning)" },
    { name: "Command surface", desc: "Dashboards & alerts", color: "var(--critical)" },
  ];
  return (
    <section id="architecture" className="max-w-7xl mx-auto px-6 py-20">
      <div className="rounded-3xl glass p-8 md:p-12">
        <div className="grid md:grid-cols-12 gap-8 items-center">
          <div className="md:col-span-5">
            <p className="font-mono text-[10px] uppercase tracking-[0.2em] text-primary">Architecture</p>
            <h2 className="mt-3 text-3xl font-bold tracking-tight">Five layers, zero conflicts.</h2>
            <p className="mt-3 text-muted-foreground text-sm leading-relaxed">
              PulseGrid runs a deterministic pipeline from monitor telemetry to clinical action. Every layer is observable, every write is versioned, every decision is explainable.
            </p>
          </div>
          <div className="md:col-span-7 space-y-2">
            {layers.map((l, i) => (
              <motion.div
                key={l.name}
                initial={{ opacity: 0, x: 30 }} whileInView={{ opacity: 1, x: 0 }} viewport={{ once: true }}
                transition={{ delay: i * 0.08 }}
                className="flex items-center gap-4 p-4 rounded-xl border border-border bg-background/40"
              >
                <span className="font-mono text-xs text-muted-foreground w-6">0{i + 1}</span>
                <span className="size-2 rounded-full" style={{ background: l.color, boxShadow: `0 0 12px ${l.color}` }} />
                <span className="font-semibold flex-1">{l.name}</span>
                <span className="text-sm text-muted-foreground">{l.desc}</span>
                <ChevronRight className="size-4 text-muted-foreground" />
              </motion.div>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}

function Cta() {
  return (
    <section className="max-w-7xl mx-auto px-6 py-20">
      <div className="relative overflow-hidden rounded-3xl border border-border bg-gradient-to-br from-primary/15 via-background to-background p-10 md:p-16">
        <div className="absolute inset-0 grid-bg opacity-30" />
        <div className="relative max-w-2xl">
          <h2 className="text-4xl md:text-5xl font-extrabold tracking-tight text-balance">
            Bring your ICU online in <span className="text-primary">a single shift.</span>
          </h2>
          <p className="mt-4 text-muted-foreground">
            Deploy the command center, connect your monitors, and start surfacing AI-grade decisions in hours, not quarters.
          </p>
          <div className="mt-8 flex flex-wrap gap-3">
            <Link to="/admin" className="rounded-lg bg-primary px-5 py-3 text-sm font-semibold text-primary-foreground glow-cyan hover:opacity-90">
              Open command center
            </Link>
            <Link to="/login" className="rounded-lg border border-border bg-white/5 px-5 py-3 text-sm font-semibold hover:bg-white/10">
              Sign in by role
            </Link>
          </div>
        </div>
      </div>
    </section>
  );
}

function Footer() {
  return (
    <footer className="border-t border-border bg-background/60">
      <div className="max-w-7xl mx-auto px-6 py-10 flex flex-col md:flex-row justify-between items-center gap-6">
        <div className="flex items-center gap-2">
          <span className="grid place-items-center size-6 rounded-md bg-primary">
            <Heart className="size-3.5 text-primary-foreground" />
          </span>
          <span className="font-mono text-[10px] uppercase tracking-[0.25em] text-muted-foreground">
            PulseGrid Operations Platform · © 2026
          </span>
        </div>
        <div className="flex gap-6 font-mono text-[10px] uppercase tracking-widest text-muted-foreground">
          <span>HIPAA / SOC2</span>
          <span>System status: stable</span>
          <span>API v4.2</span>
        </div>
      </div>
    </footer>
  );
}
