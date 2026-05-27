import { redirect } from "next/navigation";
import { Sidebar } from "@/app/_components/Sidebar";
import { getCurrentWorkspace } from "@/lib/workspace";
import { getRemainingTokens, TIER_MONTHLY_TOKENS } from "@/lib/credits";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { requireUser } from "@/lib/auth/require";
import { switchWorkspace, createWorkspace } from "@/server/actions/workspaces";
import Link from "next/link";

const TIER_LABEL: Record<string, string> = {
  trial: "Trial",
  starter: "Starter · 3 execs",
  growth: "Growth · All 6",
  scale: "Scale",
};

const TIER_COLOR: Record<string, string> = {
  trial: "#94a3b8",
  starter: "#0096C7",
  growth: "#7C3AED",
  scale: "#F96167",
};

export default async function WorkspacesPage() {
  const [user, ctx] = await Promise.all([requireUser(), getCurrentWorkspace()]);
  if (!ctx) redirect("/onboarding");
  const { workspace: active, allWorkspaces: sidebarWorkspaces } = ctx;

  const remaining = await getRemainingTokens(active.id);
  const quota = TIER_MONTHLY_TOKENS[active.tier] ?? 100_000;

  const admin = createSupabaseAdminClient();

  // All workspaces owned by this user + their stats
  const { data: allWorkspaces } = await admin
    .from("workspaces")
    .select("id, name, tier, onboarded, created_at")
    .eq("owner_id", user.id)
    .order("created_at", { ascending: true });

  // Message counts per workspace (this month)
  const wsIds = (allWorkspaces ?? []).map((w) => w.id);
  const startOfMonth = new Date(
    new Date().getFullYear(),
    new Date().getMonth(),
    1,
  ).toISOString();
  const { data: msgCounts } = await admin
    .from("messages")
    .select("workspace_id")
    .in("workspace_id", wsIds)
    .gte("created_at", startOfMonth);

  const countByWs = (msgCounts ?? []).reduce<Record<string, number>>(
    (acc, m) => {
      acc[m.workspace_id] = (acc[m.workspace_id] ?? 0) + 1;
      return acc;
    },
    {},
  );

  // Connector counts
  const { data: connectors } = await admin
    .from("connectors")
    .select("workspace_id, status")
    .in("workspace_id", wsIds)
    .eq("status", "active");

  const connectorsByWs = (connectors ?? []).reduce<Record<string, number>>(
    (acc, c) => {
      acc[c.workspace_id] = (acc[c.workspace_id] ?? 0) + 1;
      return acc;
    },
    {},
  );

  return (
    <div
      className="grid min-h-screen"
      style={{ gridTemplateColumns: "240px 1fr" }}
    >
      <Sidebar
        active="workspaces"
        remainingTokens={remaining}
        monthlyQuota={quota}
        workspaceName={active.name}
        workspaceId={active.id}
        allWorkspaces={sidebarWorkspaces}
      />

      <main className="p-10 overflow-y-auto">
        <div className="flex justify-between items-start mb-8">
          <div>
            <h1 className="serif text-3xl">Workspaces</h1>
            <p className="text-sm text-[var(--muted)] mt-1">
              Each workspace is a separate company with its own AI C-Suite,
              profile, and data.
            </p>
          </div>
          <span className="px-3 py-1.5 rounded-full text-xs font-bold border border-[var(--line)] bg-white text-[var(--muted)]">
            {(allWorkspaces ?? []).length} / 5 workspaces
          </span>
        </div>

        {/* Workspace cards */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 mb-8">
          {(allWorkspaces ?? []).map((ws) => {
            const isActive = ws.id === active.id;
            const msgCount = countByWs[ws.id] ?? 0;
            const connCount = connectorsByWs[ws.id] ?? 0;
            return (
              <div
                key={ws.id}
                className="card p-6"
                style={{
                  border: isActive ? "2px solid var(--accent)" : undefined,
                }}
              >
                <div className="flex items-start justify-between mb-4">
                  <div>
                    <div className="flex items-center gap-2">
                      <h3 className="serif text-xl">{ws.name}</h3>
                      {isActive && (
                        <span
                          style={{
                            fontSize: 10,
                            fontWeight: 700,
                            padding: "2px 8px",
                            borderRadius: 20,
                            background: "var(--accent)",
                            color: "#fff",
                          }}
                        >
                          ACTIVE
                        </span>
                      )}
                    </div>
                    <p className="text-xs text-[var(--muted)] mt-0.5">
                      Created{" "}
                      {new Date(ws.created_at).toLocaleDateString("en-US", {
                        month: "short",
                        year: "numeric",
                      })}
                    </p>
                  </div>
                  <span
                    style={{
                      fontSize: 11,
                      fontWeight: 700,
                      padding: "3px 10px",
                      borderRadius: 20,
                      background: (TIER_COLOR[ws.tier] ?? "#94a3b8") + "18",
                      color: TIER_COLOR[ws.tier] ?? "#94a3b8",
                    }}
                  >
                    {TIER_LABEL[ws.tier] ?? ws.tier}
                  </span>
                </div>

                {/* Stats */}
                <div className="grid grid-cols-3 gap-3 mb-4 py-3 border-y border-[var(--line)]">
                  <div className="text-center">
                    <p className="text-xl font-bold">{msgCount}</p>
                    <p className="text-[10px] text-[var(--muted)] uppercase tracking-wide font-semibold">
                      Messages MTD
                    </p>
                  </div>
                  <div className="text-center">
                    <p className="text-xl font-bold">{connCount}</p>
                    <p className="text-[10px] text-[var(--muted)] uppercase tracking-wide font-semibold">
                      Connectors
                    </p>
                  </div>
                  <div className="text-center">
                    <p
                      className="text-xl font-bold"
                      style={{ color: ws.onboarded ? "#22c55e" : "#f59e0b" }}
                    >
                      {ws.onboarded ? "✓" : "!"}
                    </p>
                    <p className="text-[10px] text-[var(--muted)] uppercase tracking-wide font-semibold">
                      Profile
                    </p>
                  </div>
                </div>

                <div className="flex gap-2">
                  {!isActive && (
                    <form action={switchWorkspace} className="flex-1">
                      <input type="hidden" name="workspace_id" value={ws.id} />
                      <button type="submit" className="btn w-full text-sm">
                        Switch to this company
                      </button>
                    </form>
                  )}
                  {isActive && (
                    <Link
                      href="/dashboard"
                      className="btn flex-1 text-sm text-center"
                      style={{ textDecoration: "none" }}
                    >
                      Open dashboard
                    </Link>
                  )}
                  {!ws.onboarded && (
                    <Link href="/onboarding" className="btn btn-ghost text-sm">
                      Complete setup
                    </Link>
                  )}
                </div>
              </div>
            );
          })}

          {/* Add workspace card */}
          {(allWorkspaces ?? []).length < 5 && (
            <div
              className="card p-6 border-2 border-dashed"
              style={{ borderColor: "var(--line)", background: "var(--soft)" }}
            >
              <h3 className="font-bold text-base mb-1">Add a new company</h3>
              <p className="text-sm text-[var(--muted)] mb-4">
                Each company gets its own AI C-Suite, fully customised to that
                business&apos;s profile and brand voice.
              </p>
              <form action={createWorkspace} className="flex gap-2">
                <input
                  name="name"
                  required
                  minLength={2}
                  maxLength={80}
                  placeholder="Company name"
                  className="input text-sm flex-1"
                />
                <button
                  type="submit"
                  className="btn text-sm"
                  style={{ whiteSpace: "nowrap" }}
                >
                  Create &amp; set up
                </button>
              </form>
            </div>
          )}
        </div>

        {/* Info box */}
        <div className="card p-5" style={{ background: "var(--soft)" }}>
          <h4 className="font-bold text-sm mb-2">
            About multi-company workspaces
          </h4>
          <ul className="text-sm text-[var(--muted)] space-y-1">
            <li>
              • Each company has a{" "}
              <strong>completely separate AI profile</strong> — different
              industry, brand voice, P&amp;L, and executives
            </li>
            <li>
              • Conversations and data are <strong>never shared</strong> between
              companies
            </li>
            <li>
              • Your subscription covers all workspaces — one Growth plan = 6 AI
              execs × all your companies
            </li>
            <li>
              • You can create up to <strong>5 companies</strong> per account on
              Growth and Scale plans
            </li>
          </ul>
        </div>
      </main>
    </div>
  );
}
