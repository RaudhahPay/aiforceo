import { redirect } from "next/navigation";
import { Sidebar } from "@/app/_components/Sidebar";
import { getCurrentWorkspace } from "@/lib/workspace";
import { getRemainingTokens, TIER_MONTHLY_TOKENS } from "@/lib/credits";
import { loadPortfolioSnapshot } from "@/server/actions/portfolio";
import { PortfolioClient } from "./PortfolioClient";

export default async function PortfolioPage() {
  const ctx = await getCurrentWorkspace();
  if (!ctx || !ctx.workspace.onboarded) redirect("/onboarding");
  const { workspace, allWorkspaces } = ctx;

  const remaining = await getRemainingTokens(workspace.id);
  const quota = TIER_MONTHLY_TOKENS[workspace.tier] ?? 100_000;

  const snapshots = await loadPortfolioSnapshot();

  return (
    <div
      className="grid min-h-screen app-grid"
      style={{ gridTemplateColumns: "240px 1fr" }}
    >
      <Sidebar
        active="portfolio"
        remainingTokens={remaining}
        monthlyQuota={quota}
        workspaceName={workspace.name}
        workspaceId={workspace.id}
        allWorkspaces={allWorkspaces}
      />
      <PortfolioClient
        snapshots={snapshots}
        activeWorkspaceId={workspace.id}
        remaining={remaining}
        quota={quota}
      />
    </div>
  );
}
