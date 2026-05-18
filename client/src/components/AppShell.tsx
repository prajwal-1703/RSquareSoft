import { Link, useNavigate, useRouterState } from "@tanstack/react-router";
import { motion } from "framer-motion";
import { Activity, Bell, ChevronRight, Heart, LogOut, Wifi, WifiOff } from "lucide-react";
import { useAuth, useNotifications, useSocket } from "@/lib/hooks";
import { stats } from "@/lib/mock";

const ALL_NAV_ITEMS = [
  { to: "/admin", label: "Command Center", roles: ["admin"] },
  { to: "/icu", label: "ICU Allocation Engine", roles: ["admin", "doctor", "nurse"] },
  { to: "/ehr", label: "Concurrent EHR", roles: ["admin", "doctor", "nurse", "lab_technician"] },
  { to: "/emergency", label: "Emergency Simulator", roles: ["admin"] },
] as const;

export function AppShell({ children, title, subtitle }: { children: React.ReactNode; title: string; subtitle?: string }) {
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const { user, logout } = useAuth();
  
  const navItems = ALL_NAV_ITEMS.filter(it => !user || (it.roles as readonly string[]).includes(user.role));

  return (
    <div className="min-h-screen flex flex-col">
      <TopBar />
      <div className="flex flex-1 min-h-0">
        <aside className="hidden md:flex w-60 shrink-0 flex-col border-r border-border bg-sidebar/60 backdrop-blur-md">
          <div className="px-4 py-5">
            <p className="font-mono text-[10px] uppercase tracking-[0.2em] text-muted-foreground mb-3">Operations</p>
            <nav className="flex flex-col gap-1">
              {navItems.map((it) => {
                const active = pathname === it.to;
                return (
                  <Link
                    key={it.to}
                    to={it.to}
                    className={`group flex items-center justify-between rounded-md px-3 py-2 text-sm transition-colors ${
                      active ? "bg-primary/10 text-primary" : "text-muted-foreground hover:text-foreground hover:bg-white/5"
                    }`}
                  >
                    <span className="flex items-center gap-2">
                      <span className={`size-1.5 rounded-full ${active ? "bg-primary glow-cyan" : "bg-muted-foreground/40"}`} />
                      {it.label}
                    </span>
                    <ChevronRight className="size-3.5 opacity-0 group-hover:opacity-100 transition-opacity" />
                  </Link>
                );
              })}
            </nav>
          </div>
          <div className="mt-auto p-4 border-t border-border">
            <div className="rounded-xl glass p-3">
              <p className="text-[10px] font-mono uppercase tracking-widest text-muted-foreground">System Health</p>
              <div className="mt-2 flex items-end justify-between">
                <span className="font-mono text-2xl text-emerald">99.4%</span>
                <span className="text-[10px] font-mono text-emerald">SIGMA-6</span>
              </div>
              <div className="mt-2 h-1 w-full rounded-full bg-white/5 overflow-hidden">
                <motion.div initial={{ width: 0 }} animate={{ width: "99%" }} transition={{ duration: 1.2 }} className="h-full bg-emerald" />
              </div>
            </div>
          </div>
        </aside>

        <main className="flex-1 min-w-0 flex flex-col">
          <header className="px-6 py-5 border-b border-border bg-background/40 backdrop-blur">
            <div className="flex items-center justify-between gap-4 flex-wrap">
              <div>
                <h1 className="text-2xl font-bold tracking-tight">{title}</h1>
                {subtitle && <p className="text-sm text-muted-foreground mt-0.5">{subtitle}</p>}
              </div>
              <LiveTicker />
            </div>
          </header>
          <div className="p-6 flex-1">{children}</div>
        </main>
      </div>
    </div>
  );
}

function TopBar() {
  const { user, logout } = useAuth();
  const { connected } = useSocket();
  const { unreadCount } = useNotifications();
  const nav = useNavigate();

  const handleLogout = async () => {
    await logout();
    nav({ to: "/login" });
  };

  return (
    <header className="sticky top-0 z-40 border-b border-border bg-background/80 backdrop-blur-md">
      <div className="px-4 md:px-6 h-14 flex items-center justify-between gap-4">
        <Link to="/" className="flex items-center gap-2.5">
          <span className="relative grid place-items-center size-7 rounded-md bg-primary glow-cyan">
            <Heart className="size-4 text-primary-foreground" />
          </span>
          <span className="font-extrabold tracking-tight italic">
            PulseGrid<span className="text-primary">AI</span>
          </span>
          <span className="hidden md:inline font-mono text-[10px] uppercase tracking-[0.2em] text-muted-foreground ml-3">
            Critical Care OS · v1.0
          </span>
        </Link>
        <div className="flex items-center gap-3">
          {/* WebSocket status */}
          <span className={`hidden md:inline-flex items-center gap-2 text-[10px] font-mono uppercase tracking-widest ${connected ? "text-emerald" : "text-muted-foreground"}`}>
            {connected ? <Wifi className="size-3" /> : <WifiOff className="size-3" />}
            {connected ? "Network online" : "Offline"}
          </span>
          {/* Notification bell */}
          <Link to="/admin" className="relative inline-flex items-center gap-1.5 rounded-md border border-border px-2.5 py-1 text-[10px] font-mono hover:bg-white/5">
            <Bell className="size-3" />
            {unreadCount > 0 && (
              <span className="absolute -top-1.5 -right-1.5 size-4 rounded-full bg-critical text-[9px] flex items-center justify-center text-white font-bold">
                {unreadCount > 9 ? "9+" : unreadCount}
              </span>
            )}
          </Link>
          {/* User info or sign in */}
          {user ? (
            <div className="flex items-center gap-2">
              <div className="hidden md:flex flex-col items-end">
                <span className="text-xs font-semibold">{user.firstName} {user.lastName}</span>
                <span className="font-mono text-[9px] uppercase tracking-widest text-muted-foreground">{user.role}</span>
              </div>
              <button onClick={handleLogout} className="rounded-md border border-border px-2.5 py-1.5 text-xs font-mono hover:bg-white/5 inline-flex items-center gap-1.5">
                <LogOut className="size-3" /> Out
              </button>
            </div>
          ) : (
            <Link to="/login" className="rounded-md bg-primary px-3 py-1.5 text-xs font-semibold text-primary-foreground hover:opacity-90">
              Sign in
            </Link>
          )}
        </div>
      </div>
    </header>
  );
}


function LiveTicker() {
  const items = [
    { k: "Occupancy", v: `${stats.occupancy}%`, c: "text-cyan" },
    { k: "Vents", v: `${stats.ventilatorsFree}/${stats.ventilatorsTotal}`, c: "text-foreground" },
    { k: "Mean Risk", v: stats.meanRisk.toFixed(2), c: "text-warning" },
    { k: "Inflow 24h", v: `${stats.inflow24h}`, c: "text-emerald" },
  ];
  return (
    <div className="flex items-center gap-4 px-3 py-2 rounded-lg glass">
      <Activity className="size-3.5 text-primary" />
      {items.map((it) => (
        <div key={it.k} className="flex items-center gap-2">
          <span className="text-[10px] font-mono uppercase tracking-widest text-muted-foreground">{it.k}</span>
          <span className={`font-mono text-sm ${it.c}`}>{it.v}</span>
        </div>
      ))}
    </div>
  );
}

export function Card({
  title, action, children, className = "", glow,
}: { title?: string; action?: React.ReactNode; children: React.ReactNode; className?: string; glow?: "cyan" | "critical" | "emerald" }) {
  const glowClass = glow === "cyan" ? "glow-cyan" : glow === "critical" ? "glow-critical" : glow === "emerald" ? "glow-emerald" : "";
  return (
    <div className={`rounded-2xl glass ${glowClass} ${className}`}>
      {(title || action) && (
        <div className="px-4 py-3 border-b border-border flex items-center justify-between">
          {title && <h3 className="text-[11px] font-mono uppercase tracking-[0.18em] text-muted-foreground">{title}</h3>}
          {action}
        </div>
      )}
      <div className="p-4">{children}</div>
    </div>
  );
}

export function SeverityChip({ severity }: { severity: "critical" | "warning" | "stable" | "recovery" }) {
  const map = {
    critical: "bg-critical/15 text-critical border-critical/30",
    warning: "bg-warning/15 text-warning border-warning/30",
    stable: "bg-teal/15 text-teal border-teal/30",
    recovery: "bg-emerald/15 text-emerald border-emerald/30",
  };
  return (
    <span className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-md border text-[10px] font-mono uppercase tracking-wider ${map[severity]}`}>
      <span className="size-1.5 rounded-full bg-current" />
      {severity}
    </span>
  );
}
