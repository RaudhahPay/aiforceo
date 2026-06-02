"use client";

import dynamic from "next/dynamic";
import type { AgentRole } from "@/lib/prompts";
import { MorningBrief } from "@/app/_components/MorningBrief";
import { BusinessHealth } from "@/app/_components/BusinessHealth";
import { ExecutiveRecommendations } from "@/app/_components/ExecutiveRecommendations";
import { ActionCard } from "@/app/_components/ActionCard";
import Link from "next/link";
import type { Task, TaskType } from "@/server/actions/tasks";

const OfficeView = dynamic(() => import("@/app/_components/OfficeView").then(m => m.OfficeView), { ssr: false });
const WelcomeGuide = dynamic(() => import("@/app/_components/WelcomeGuide").then(m => m.WelcomeGuide), { ssr: false });

type AgentStat = {
  convCount: number;
  msgCountMtd: number;
  lastActive: string | null;
  lastContent: string | null;
};

type Props = {
  workspaceName: string;
  workspaceId: string;
  agentStats: Record<AgentRole, AgentStat>;
  todayBriefContent: string | null;
  savedKpis: unknown;
  remaining: number;
  quota: number;
  ownerInitial: string;
  ownerName: string;
  hasBusinessProfile: boolean;
  hasBrandVoice: boolean;
  hasFinancials: boolean;
  hasConnectors: boolean;
  memories: Array<{ category: string; content: string; source_agent: string | null }>;
  tasks: Task[];
};

export function CommandCentre({
  workspaceName, workspaceId, agentStats, todayBriefContent,
  savedKpis, remaining, quota, ownerInitial, ownerName,
  hasBusinessProfile, hasBrandVoice, hasFinancials, hasConnectors,
  memories, tasks,
}: Props) {
  // Extract KPI values for health scores
  const kpi = savedKpis as Record<string, unknown> | null;
  const periods = (kpi?.periods as Record<string, Record<string, number>> | undefined);
  const finance = (kpi?.finance as Record<string, number> | undefined);
  const ops = (kpi?.ops as Record<string, number> | undefined);

  const healthData = {
    sales: (periods?.MTD as Record<string, number> | undefined)?.revenue
      ?? (periods?.MTD?.reach ? Math.round((periods.MTD.reach ?? 0) * (periods.MTD.avgSale ?? 0) * (periods.MTD.avgTxn ?? 1)) : 0),
    gpPct: periods?.MTD?.gpPct ?? 0,
    customers: ops?.customers ?? 0,
    repeatRate: ops?.repeatRate ?? 0,
    cashBalance: finance?.cashBalance ?? 0,
    cashIn: finance?.cashIn ?? 0,
    cashOut: finance?.cashOut ?? 0,
    headcount: ops?.headcount ?? 0,
    csat: ops?.csat ?? 0,
    nps: ops?.nps ?? 0,
  };

  // Only show setup guide when nothing is configured yet
  const setupComplete = hasBusinessProfile && hasBrandVoice && hasConnectors;
  const showSetupBanner = !setupComplete && !hasBusinessProfile;

  return (
    <main style={{ background: "var(--bg)", minHeight: "100vh", padding: "20px 28px", overflow: "auto" }}>
      {/* Command Bar */}
      <div style={{
        display: "flex", alignItems: "center", justifyContent: "space-between",
        marginBottom: 24, flexWrap: "wrap", gap: 12,
      }}>
        <div>
          <p style={{ margin: 0, fontSize: 11, fontWeight: 700, color: "var(--accent)", textTransform: "uppercase", letterSpacing: "0.1em" }}>
            CEO Command Centre
          </p>
          <h1 className="serif" style={{ margin: "2px 0 0", fontSize: 28 }}>
            {workspaceName}
          </h1>
        </div>
        <div style={{ display: "flex", gap: 10 }}>
          <Link href="/connectors" className="btn btn-ghost text-sm" style={{ textDecoration: "none" }}>
            🔗 Connect Data
          </Link>
          <Link href="/agent/aria" className="btn text-sm" style={{ textDecoration: "none" }}>
            ✨ Ask Aria
          </Link>
        </div>
      </div>

      {/* Setup banner — only for truly new users with no business profile */}
      {showSetupBanner && (
        <div style={{ marginBottom: 20 }}>
          <WelcomeGuide
            workspaceName={workspaceName}
            hasKpiData={healthData.sales > 0}
            hasBusinessProfile={hasBusinessProfile}
            hasBrandVoice={hasBrandVoice}
            hasFinancials={hasFinancials}
            hasConnectors={hasConnectors}
          />
        </div>
      )}

      {/* Section 1: Morning Brief */}
      <div style={{ marginBottom: 24 }}>
        <MorningBrief
          briefContent={todayBriefContent}
          workspaceName={workspaceName}
          revenue={healthData.sales}
        />
      </div>

      {/* Section 2: Business Health + Action Queue */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 380px", gap: 20, marginBottom: 24 }}>
        <BusinessHealth kpi={healthData} />

        {/* CEO Action Queue */}
        <div>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 14 }}>
            <h2 style={{ margin: 0, fontSize: 13, fontWeight: 700, color: "var(--muted)", textTransform: "uppercase", letterSpacing: "0.08em" }}>
              CEO Action Queue
            </h2>
            <Link href="/tasks" style={{ fontSize: 11, color: "var(--accent)", textDecoration: "none", fontWeight: 600 }}>
              View all →
            </Link>
          </div>
          <div style={{
            background: "var(--panel)", border: "1px solid var(--line)",
            borderRadius: 16, padding: 14, display: "flex", flexDirection: "column", gap: 8,
          }}>
            {/* System alerts (always shown) */}
            {remaining < quota * 0.2 && (
              <ActionCard title="Token quota running low" description={`${Math.round(remaining / 1000)}K tokens remaining this month`} type="alert" timeAgo="now" />
            )}

            {/* Real tasks from DB */}
            {tasks.map((task) => (
              <Link key={task.id} href="/tasks" style={{ textDecoration: "none" }}>
                <ActionCard
                  title={task.title}
                  description={task.description ?? (task.source_agent ? `From ${task.source_agent.toUpperCase()}` : "")}
                  type={task.type as Exclude<TaskType, "action">}
                  timeAgo={task.due_date ? `Due ${task.due_date}` : ""}
                />
              </Link>
            ))}

            {/* Fallback setup prompts when no real tasks exist */}
            {tasks.length === 0 && !hasConnectors && (
              <ActionCard title="Connect your data sources" description="Link Google Sheets or QuickBooks for live data" type="follow-up" timeAgo="" onClick={() => {}} />
            )}
            {tasks.length === 0 && !hasBrandVoice && (
              <ActionCard title="Set up brand voice" description="Paste a writing sample so Maya matches your tone" type="follow-up" timeAgo="" />
            )}
            {tasks.length === 0 && hasConnectors && hasBrandVoice && remaining >= quota * 0.2 && (
              <p style={{ margin: 0, padding: "12px 0", fontSize: 12, color: "var(--muted)", textAlign: "center" }}>
                No pending actions. You&apos;re all caught up! 🎉
              </p>
            )}
          </div>
        </div>
      </div>

      {/* Section 3: AI Executive Recommendations */}
      <div style={{ marginBottom: 24 }}>
        <ExecutiveRecommendations agentStats={agentStats} memories={memories} />
      </div>

      {/* Section 4: Office Map (secondary, smaller) */}
      <div style={{ marginBottom: 20 }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 14 }}>
          <h2 style={{ margin: 0, fontSize: 13, fontWeight: 700, color: "var(--muted)", textTransform: "uppercase", letterSpacing: "0.08em" }}>
            AI Executive Office Map
          </h2>
          <Link href="/office" style={{ fontSize: 12, color: "var(--accent)", textDecoration: "none" }}>
            Full view →
          </Link>
        </div>
        <div style={{ width: "100%" }}>
          <OfficeView
            agentStats={agentStats}
            workspaceName={workspaceName}
            ownerInitial={ownerInitial}
            ownerName={ownerName}
          />
        </div>
      </div>

      {/* Footer */}
      <div style={{ textAlign: "center", padding: "16px 0", fontSize: 11, color: "var(--muted)" }}>
        AI for CEO · {workspaceName} · {Math.round(remaining / 1000)}K tokens remaining
      </div>
    </main>
  );
}
