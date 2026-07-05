function fmt(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(0)}K`;
  return String(n);
}

export function CreditMeter({ remaining, quota }: { remaining: number; quota: number }) {
  const safeQuota = Math.max(quota, 1);
  const pct = Math.max(0, Math.min(100, (remaining / safeQuota) * 100));
  const barColor = pct > 50 ? "var(--success)" : pct > 20 ? "var(--amber)" : "var(--red)";
  return (
    <div style={{
      borderRadius: 12, padding: "12px 14px",
      background: "#1C2A47", border: "1px solid #2A3B5E",
    }}>
      <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: "0.08em", textTransform: "uppercase", color: "#8597B8" }}>
        AI Credits
      </div>
      <div style={{ fontSize: 20, fontWeight: 700, marginTop: 4, color: "#E8EDF6", fontFamily: "Georgia, serif" }}>
        {fmt(remaining)}{" "}
        <span style={{ fontSize: 12, fontWeight: 400, color: "#8597B8" }}>/ {fmt(quota)}</span>
      </div>
      <div style={{ height: 4, borderRadius: 3, marginTop: 8, background: "#2A3B5E", overflow: "hidden" }}>
        <div style={{ width: `${pct}%`, height: "100%", borderRadius: 3, background: barColor, transition: "width 0.4s" }} />
      </div>
      <a href="/pricing" style={{
        display: "block", marginTop: 10, textAlign: "center",
        background: "rgba(240,180,41,0.12)", color: "#D4A017",
        padding: "7px", borderRadius: 8, fontSize: 11, fontWeight: 700,
        letterSpacing: "0.03em", textDecoration: "none",
      }}>
        Top up · RM 9 / 200K tokens
      </a>
    </div>
  );
}
