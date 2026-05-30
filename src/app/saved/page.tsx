import { redirect } from "next/navigation";
import Link from "next/link";
import { Sidebar } from "@/app/_components/Sidebar";
import { getCurrentWorkspace } from "@/lib/workspace";
import { getRemainingTokens, TIER_MONTHLY_TOKENS } from "@/lib/credits";
import { getStarredMessages } from "@/server/actions/search";

const ROLE_LABEL: Record<string, string> = {
  cmo: "Maya · CMO",
  coo: "Owen · COO",
  cfo: "Felix · CFO",
  ceo: "Eden · CEO",
  cto: "Tariq · CTO",
  aria: "Aria · Chief of Staff",
};

export default async function SavedPage() {
  const ctx = await getCurrentWorkspace();
  if (!ctx || !ctx.workspace.onboarded) redirect("/onboarding");
  const { workspace, allWorkspaces } = ctx;

  const [remaining, saved] = await Promise.all([
    getRemainingTokens(workspace.id),
    getStarredMessages(),
  ]);
  const quota = TIER_MONTHLY_TOKENS[workspace.tier] ?? 100_000;

  return (
    <div className="grid min-h-screen app-grid" style={{ gridTemplateColumns: "240px 1fr" }}>
      <Sidebar
        active="settings"
        remainingTokens={remaining}
        monthlyQuota={quota}
        workspaceName={workspace.name}
        workspaceId={workspace.id}
        allWorkspaces={allWorkspaces}
      />

      <main className="p-10 overflow-y-auto">
        <div className="mb-8">
          <h1 className="serif text-3xl">Saved Outputs</h1>
          <p className="text-sm text-[var(--muted)] mt-1">
            Agent responses you&apos;ve bookmarked for reference.
          </p>
        </div>

        {saved.length === 0 ? (
          <div className="card p-8 text-center">
            <p style={{ fontSize: 32, marginBottom: 12 }}>⭐</p>
            <h3 style={{ margin: "0 0 8px", fontSize: 16, fontWeight: 700 }}>No saved outputs yet</h3>
            <p style={{ margin: "0 0 20px", fontSize: 13, color: "var(--muted)" }}>
              Click the ⭐ icon on any agent response to save it here for quick access.
            </p>
            <Link href="/dashboard" className="btn text-sm" style={{ textDecoration: "none" }}>
              Go to dashboard
            </Link>
          </div>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
            {saved.map((m) => {
              const conv = (m as { conversations?: { agent_role?: string } }).conversations;
              const role = conv?.agent_role ?? "aria";
              const roleLabel = ROLE_LABEL[role] ?? role.toUpperCase();
              return (
                <div key={m.id} className="card p-5">
                  <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 10 }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                      <span style={{
                        fontSize: 11, fontWeight: 700, padding: "2px 10px", borderRadius: 20,
                        background: "rgba(212,160,23,0.12)", color: "var(--gold)",
                      }}>
                        {roleLabel}
                      </span>
                      <span style={{ fontSize: 11, color: "var(--muted)" }}>
                        {new Date(m.created_at).toLocaleDateString("en-MY", { day: "numeric", month: "short", year: "numeric" })}
                      </span>
                    </div>
                    <Link
                      href={`/agent/${role}?conv=${m.conversation_id}`}
                      style={{ fontSize: 12, color: "var(--muted)", textDecoration: "none" }}
                    >
                      View in chat →
                    </Link>
                  </div>
                  <p style={{ margin: 0, fontSize: 13, lineHeight: 1.7, color: "var(--ink)", whiteSpace: "pre-wrap" }}>
                    {m.content.slice(0, 500)}{m.content.length > 500 ? "…" : ""}
                  </p>
                </div>
              );
            })}
          </div>
        )}
      </main>
    </div>
  );
}
