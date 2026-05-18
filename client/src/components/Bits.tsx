import { motion } from "framer-motion";
import { Line, LineChart, ResponsiveContainer } from "recharts";

export function Spark({ data, color = "var(--cyan)", height = 28 }: { data: { v: number }[]; color?: string; height?: number }) {
  return (
    <ResponsiveContainer width="100%" height={height}>
      <LineChart data={data}>
        <Line type="monotone" dataKey="v" stroke={color} strokeWidth={1.5} dot={false} isAnimationActive={false} />
      </LineChart>
    </ResponsiveContainer>
  );
}

export function RiskBar({ value, color = "var(--critical)" }: { value: number; color?: string }) {
  return (
    <div className="h-1.5 w-full rounded-full bg-white/5 overflow-hidden">
      <motion.div
        initial={{ width: 0 }}
        animate={{ width: `${Math.round(value * 100)}%` }}
        transition={{ duration: 0.8, ease: "easeOut" }}
        className="h-full"
        style={{ background: color }}
      />
    </div>
  );
}

export function Stat({ label, value, hint, accent = "text-foreground" }: { label: string; value: React.ReactNode; hint?: React.ReactNode; accent?: string }) {
  return (
    <div className="rounded-2xl glass p-4">
      <div className="text-[10px] font-mono uppercase tracking-widest text-muted-foreground">{label}</div>
      <div className="mt-2 flex items-end justify-between gap-2">
        <div className={`font-mono text-3xl font-semibold ${accent}`}>{value}</div>
        {hint && <div className="text-[10px] font-mono text-muted-foreground">{hint}</div>}
      </div>
    </div>
  );
}
