import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { motion } from "framer-motion";
import { Activity, FlaskConical, Heart, Loader2, ShieldCheck, Stethoscope, UserRound } from "lucide-react";
import { useState } from "react";
import { auth } from "@/lib/auth";
import { connectSocket } from "@/lib/socket";

export const Route = createFileRoute("/login")({
  head: () => ({ meta: [{ title: "Sign in · PulseGrid AI" }, { name: "description", content: "Role-based access for doctors, nurses, lab and admin." }] }),
  component: Login,
});

const roles = [
  { id: "doctor", label: "Doctor", to: "/doctor", icon: Stethoscope, accent: "var(--cyan)" },
  { id: "nurse", label: "Nurse", to: "/nurse", icon: Heart, accent: "var(--emerald)" },
  { id: "admin", label: "Admin", to: "/admin", icon: ShieldCheck, accent: "var(--warning)" },
  { id: "lab", label: "Lab Tech", to: "/ehr", icon: FlaskConical, accent: "var(--teal)" },
] as const;

function Login() {
  const [role, setRole] = useState<typeof roles[number]["id"]>("doctor");
  const [email, setEmail] = useState("dr.smith@pulsegrid.ai");
  const [password, setPassword] = useState("PulseGrid@123");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const nav = useNavigate();
  const active = roles.find((r) => r.id === role)!;

  // When role changes, pre-fill demo credentials
  const handleRoleChange = (r: typeof roles[number]["id"]) => {
    setRole(r);
    setError(null);
    const emailMap: Record<string, string> = {
      doctor: "dr.smith@pulsegrid.ai",
      nurse: "nurse.johnson@pulsegrid.ai",
      admin: "admin@pulsegrid.ai",
      lab: "lab@pulsegrid.ai",
    };
    setEmail(emailMap[r] || `${r}@pulsegrid.ai`);
    setPassword("PulseGrid@123");
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    try {
      const user = await auth.login(email, password);
      connectSocket(); // fire-and-forget async WebSocket connect
      nav({ to: auth.roleHomePath(user.role) });
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { message?: string } } })?.response?.data?.message;
      setError(msg || "Login failed. Check credentials and try again.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen relative grid lg:grid-cols-2">
      <div className="absolute inset-0 grid-bg opacity-30 pointer-events-none" />
      <div className="hidden lg:flex flex-col justify-between p-12 border-r border-border relative">
        <Link to="/" className="flex items-center gap-2">
          <span className="grid place-items-center size-8 rounded-md bg-primary glow-cyan">
            <Heart className="size-4 text-primary-foreground" />
          </span>
          <span className="font-extrabold italic tracking-tight text-lg">
            PulseGrid<span className="text-primary">AI</span>
          </span>
        </Link>
        <div>
          <p className="font-mono text-[10px] uppercase tracking-[0.2em] text-primary">Identity / Authentication</p>
          <h1 className="mt-4 text-5xl font-extrabold tracking-tight text-balance">
            Step into the <span className="text-primary">command surface.</span>
          </h1>
          <p className="mt-5 max-w-md text-muted-foreground">
            Role-based access scopes your view to the patients, units and signals you can act on. Every session is signed, every action is auditable.
          </p>
          <div className="mt-8 flex gap-2">
            {[Activity, UserRound, Stethoscope, ShieldCheck].map((I, i) => (
              <span key={i} className="grid place-items-center size-10 rounded-lg glass">
                <I className="size-4 text-muted-foreground" />
              </span>
            ))}
          </div>
          <div className="mt-6 rounded-xl glass p-4 text-xs text-muted-foreground space-y-1">
            <p className="font-mono text-[10px] uppercase tracking-widest text-primary mb-2">Demo Credentials</p>
            <p>All accounts use password: <span className="text-cyan font-mono">PulseGrid@123</span></p>
            <p>Admin: <span className="font-mono">admin@pulsegrid.ai</span></p>
            <p>Doctor: <span className="font-mono">dr.smith@pulsegrid.ai</span></p>
            <p>Nurse: <span className="font-mono">nurse.johnson@pulsegrid.ai</span></p>
          </div>
        </div>
        <p className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground">
          Session encryption · TLS 1.3 · JWT Auth
        </p>
      </div>

      <div className="flex items-center justify-center p-6 lg:p-12">
        <motion.div
          initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}
          className="w-full max-w-md rounded-3xl glass p-8"
        >
          <div className="flex items-center justify-between">
            <p className="font-mono text-[10px] uppercase tracking-[0.2em] text-muted-foreground">Secure sign in</p>
            <span className="inline-flex items-center gap-1.5 font-mono text-[10px] text-emerald">
              <span className="size-1.5 rounded-full bg-emerald glow-emerald animate-pulse" /> Live backend
            </span>
          </div>
          <h2 className="mt-3 text-2xl font-bold">Choose your role</h2>

          <div className="mt-5 grid grid-cols-2 gap-2">
            {roles.map((r) => {
              const sel = r.id === role;
              return (
                <button
                  key={r.id}
                  onClick={() => handleRoleChange(r.id)}
                  className={`flex items-center gap-2 rounded-xl border p-3 text-sm transition-all text-left ${
                    sel ? "border-primary/50 bg-primary/10" : "border-border bg-background/40 hover:bg-white/5"
                  }`}
                  style={sel ? { boxShadow: `0 0 18px -8px ${r.accent}` } : undefined}
                >
                  <span className="grid place-items-center size-8 rounded-lg" style={{ background: `color-mix(in oklab, ${r.accent} 18%, transparent)`, color: r.accent }}>
                    <r.icon className="size-4" />
                  </span>
                  <span className="font-medium">{r.label}</span>
                </button>
              );
            })}
          </div>

          <form className="mt-6 space-y-3" onSubmit={handleSubmit}>
            <Field label="Email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="staff@pulsegrid.ai" />
            <Field label="Password" type="password" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="••••••••••" />

            {error && (
              <motion.p initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="text-xs text-critical bg-critical/10 border border-critical/30 rounded-lg px-3 py-2">
                {error}
              </motion.p>
            )}

            <button
              type="submit"
              disabled={loading}
              className="mt-2 w-full rounded-lg bg-primary py-3 text-sm font-semibold text-primary-foreground hover:opacity-90 glow-cyan disabled:opacity-60 flex items-center justify-center gap-2"
            >
              {loading ? <><Loader2 className="size-4 animate-spin" /> Authenticating…</> : `Authenticate as ${active.label}`}
            </button>
          </form>
          <p className="mt-4 text-center text-[10px] font-mono uppercase tracking-widest text-muted-foreground">
            Or jump directly · <Link to="/admin" className="text-primary">command center</Link>
          </p>
        </motion.div>
      </div>
    </div>
  );
}


function Field({ label, ...rest }: { label: string } & React.InputHTMLAttributes<HTMLInputElement>) {
  return (
    <label className="block">
      <span className="text-[10px] font-mono uppercase tracking-widest text-muted-foreground">{label}</span>
      <input
        {...rest}
        className="mt-1 w-full rounded-lg border border-border bg-background/60 px-3 py-2.5 text-sm outline-none focus:border-primary/50 focus:ring-2 focus:ring-primary/20"
      />
    </label>
  );
}
