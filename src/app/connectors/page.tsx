import { redirect } from "next/navigation";
import { Sidebar } from "@/app/_components/Sidebar";
import { getCurrentWorkspace } from "@/lib/workspace";
import { getRemainingTokens, TIER_MONTHLY_TOKENS } from "@/lib/credits";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { ConnectorsClient } from "./ConnectorsClient";

export default async function ConnectorsPage({
  searchParams,
}: {
  searchParams: Promise<{ connected?: string; error?: string }>;
}) {
  const ctx = await getCurrentWorkspace();
  if (!ctx) redirect("/onboarding");
  const { workspace, allWorkspaces } = ctx;

  const remaining = await getRemainingTokens(workspace.id);
  const quota = TIER_MONTHLY_TOKENS[workspace.tier] ?? 100_000;

  const admin = createSupabaseAdminClient();
  const { data: connectors } = await admin
    .from("connectors")
    .select("id, provider, status, metadata")
    .eq("workspace_id", workspace.id)
    .order("created_at", { ascending: true });

  const sp = await searchParams;
  const flashMsg =
    sp.connected === "google"
      ? "Google Sheets connected successfully."
      : sp.connected === "quickbooks"
        ? "QuickBooks connected successfully."
        : sp.error
          ? `Connection error: ${sp.error.replace(/_/g, " ")}`
          : undefined;

  return (
    <div
      className="grid min-h-screen"
      style={{ gridTemplateColumns: "240px 1fr" }}
    >
      <Sidebar
        active="connectors"
        remainingTokens={remaining}
        monthlyQuota={quota}
        workspaceName={workspace.name}
        workspaceId={workspace.id}
        allWorkspaces={allWorkspaces}
      />
      <main className="p-10 overflow-y-auto">
        <div className="mb-8">
          <h1 className="serif text-3xl">Connectors</h1>
          <p className="text-sm text-[var(--muted)] mt-1">
            Connect your business tools so your AI executives can work with real
            data.
          </p>
        </div>
        <ConnectorsClient
          connectors={(connectors ?? []).map((c) => ({
            ...c,
            metadata: (c.metadata ?? {}) as Record<string, string>,
          }))}
          flashMsg={flashMsg}
        />
      </main>
    </div>
  );
}
