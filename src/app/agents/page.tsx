import { redirect } from "next/navigation";
import Link from "next/link";
import { Sidebar } from "@/app/_components/Sidebar";
import { getCurrentWorkspace } from "@/lib/workspace";
import { getRemainingTokens, TIER_MONTHLY_TOKENS } from "@/lib/credits";
import { getCustomAgents, deleteCustomAgentAction } from "@/server/actions/custom-agents";
import { AGENTS, type AgentRole } from "@/lib/prompts";

export default async function AgentsPage() {
  const ctx = await getCurrentWorkspace();
  if (!ctx || !ctx.workspace.onboarded) redirect("/onboarding");
  const { workspace, allWorkspaces } = ctx;

  const [remaining, customAgents] = await Promise.all([
    getRemainingTokens(workspace.id),
    getCustomAgents(),
  ]);
  const quota = TIER_MONTHLY_TOKENS[workspace.tier] ?? 100_000;

  const DEFAULT_ROLES = Object.entries(AGENTS) as [AgentRole, (typeof AGENTS)[AgentRole]][];

  return (
    <div className="grid min-h-screen app-grid" style={{ gridTemplateColumns: "240px 1fr" }}>
      <Sidebar
        active="agents"
        remainingTokens={remaining}
        monthlyQuota={quota}
        workspaceName={workspace.name}
        workspaceId={workspace.id}
        allWorkspaces={allWorkspaces}
      />

      <main className="p-10 overflow-y-auto">
        <div className="flex items-start justify-between mb-8">
          <div>
            <h1 className="serif text-3xl">AI Executives</h1>
            <p className="text-sm text-[var(--muted)] mt-1">
              Your default C-suite plus any custom specialists you create.
            </p>
          </div>
          <Link
            href="/agents/new"
            className="btn text-sm"
            style={{ textDecoration: "none" }}
          >
            + Create custom agent
          </Link>
        </div>

        {/* Default agents */}
        <h2 className="text-xs font-bold uppercase tracking-widest text-[var(--muted)] mb-3">
          Default C-Suite (6)
        </h2>
        <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-4 mb-10">
          {DEFAULT_ROLES.map(([role, agent]) => (
            <div key={role} className="card p-5 flex gap-4 items-start">
              <div style={{
                width: 44, height: 44, borderRadius: 12, flexShrink: 0,
                background: `linear-gradient(135deg, ${agent.gradient[0]}, ${agent.gradient[1]})`,
                display: "flex", alignItems: "center", justifyContent: "center",
                fontWeight: 700, fontSize: 18, color: role === "ceo" ? "#1E2761" : "#fff",
              }}>
                {agent.name[0]}
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <p style={{ margin: 0, fontWeight: 700, fontSize: 15 }}>{agent.name}</p>
                <p style={{ margin: "2px 0 4px", fontSize: 12, color: "var(--accent)", fontWeight: 600 }}>{agent.title}</p>
                <p style={{ margin: 0, fontSize: 12, color: "var(--muted)" }}>{agent.tag}</p>
              </div>
              <Link href={`/agent/${role}`} className="btn btn-ghost text-xs" style={{ textDecoration: "none", flexShrink: 0 }}>
                Chat →
              </Link>
            </div>
          ))}
        </div>

        {/* Custom agents */}
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-xs font-bold uppercase tracking-widest text-[var(--muted)]">
            Custom Agents ({customAgents.length} / 10)
          </h2>
        </div>

        {customAgents.length === 0 ? (
          <div className="card p-8 text-center" style={{ border: "2px dashed var(--line)" }}>
            <p style={{ fontSize: 32, marginBottom: 12 }}>🤖</p>
            <h3 style={{ margin: "0 0 8px", fontSize: 16, fontWeight: 700 }}>No custom agents yet</h3>
            <p style={{ margin: "0 0 20px", fontSize: 13, color: "var(--muted)" }}>
              Create a specialist AI executive with a custom system prompt — a legal advisor, HR manager, or anything your business needs.
            </p>
            <Link href="/agents/new" className="btn text-sm" style={{ textDecoration: "none" }}>
              Create your first agent
            </Link>
          </div>
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-4">
            {customAgents.map((agent) => (
              <div key={agent.id} className="card p-5 flex gap-4 items-start">
                <div style={{
                  width: 44, height: 44, borderRadius: 12, flexShrink: 0,
                  background: `linear-gradient(135deg, ${agent.gradient_from}, ${agent.gradient_to})`,
                  display: "flex", alignItems: "center", justifyContent: "center",
                  fontWeight: 700, fontSize: 18, color: "#fff",
                }}>
                  {agent.name[0]}
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <p style={{ margin: 0, fontWeight: 700, fontSize: 15 }}>{agent.name}</p>
                  <p style={{ margin: "2px 0 4px", fontSize: 12, color: "var(--accent)", fontWeight: 600 }}>{agent.title}</p>
                  {agent.description && (
                    <p style={{ margin: 0, fontSize: 12, color: "var(--muted)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                      {agent.description}
                    </p>
                  )}
                </div>
                <div style={{ display: "flex", flexDirection: "column", gap: 6, flexShrink: 0 }}>
                  <Link href={`/agent/${agent.id}`} className="btn btn-ghost text-xs" style={{ textDecoration: "none" }}>
                    Chat
                  </Link>
                  <Link href={`/agents/${agent.id}/edit`} className="btn btn-ghost text-xs" style={{ textDecoration: "none" }}>
                    Edit
                  </Link>
                  <form action={deleteCustomAgentAction.bind(null, agent.id)}>
                    <button type="submit" className="btn btn-ghost text-xs w-full" style={{ color: "var(--red)" }}>
                      Delete
                    </button>
                  </form>
                </div>
              </div>
            ))}
          </div>
        )}
      </main>
    </div>
  );
}
