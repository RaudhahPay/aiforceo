import type { CompanySnapshot } from "@/server/actions/portfolio";

/** Build a human-readable portfolio brief string for injection into Aria. */
export function buildPortfolioPrompt(snapshots: CompanySnapshot[]): string {
  const lines: string[] = [
    "Portfolio Brief Request — Here is the current status across all my companies:\n",
  ];

  snapshots.forEach((s, i) => {
    lines.push(`COMPANY ${i + 1}: ${s.name}`);
    if (s.hasKpiData && s.latestMonth) {
      const rev = s.revenue != null ? `RM ${s.revenue.toLocaleString()}` : "N/A";
      const delta =
        s.momRevenueDelta != null
          ? ` (${s.momRevenueDelta > 0 ? "+" : ""}${s.momRevenueDelta}% MoM)`
          : "";
      lines.push(`- Revenue (${s.latestMonth}): ${rev}${delta}`);
      if (s.customers != null) lines.push(`- Customers: ${s.customers}`);
      if (s.headcount != null) lines.push(`- Headcount: ${s.headcount}`);
      if (s.cashIn != null)
        lines.push(`- Cash In: RM ${s.cashIn.toLocaleString()}`);
    } else {
      lines.push("- No KPI data entered yet");
    }
    lines.push(`- Open Tasks: ${s.openTasks}`);
    if (s.lastActivity) {
      const daysAgo = Math.floor(
        (Date.now() - new Date(s.lastActivity).getTime()) / (1000 * 60 * 60 * 24),
      );
      lines.push(`- Last AI activity: ${daysAgo === 0 ? "today" : `${daysAgo}d ago`}`);
    }
    lines.push("");
  });

  lines.push(
    "Please give me a portfolio-level executive brief covering:",
    "1. Which company needs my attention most urgently today?",
    "2. What are the top 3 cross-company actions I should take this week?",
    "3. Any anomalies or concerns across the portfolio?",
  );

  return lines.join("\n");
}
