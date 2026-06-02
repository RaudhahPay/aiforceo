import { redirect } from "next/navigation";
import { Sidebar } from "@/app/_components/Sidebar";
import { getCurrentWorkspace } from "@/lib/workspace";
import { getRemainingTokens, TIER_MONTHLY_TOKENS } from "@/lib/credits";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { TasksClient } from "./TasksClient";
import type { Task } from "@/server/actions/tasks";

export default async function TasksPage() {
  const ctx = await getCurrentWorkspace();
  if (!ctx || !ctx.workspace.onboarded) redirect("/onboarding");
  const { workspace, allWorkspaces } = ctx;

  const remaining = await getRemainingTokens(workspace.id);
  const quota = TIER_MONTHLY_TOKENS[workspace.tier] ?? 100_000;

  const admin = createSupabaseAdminClient();
  const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();

  const [{ data: active }, { data: recent }] = await Promise.all([
    admin
      .from("tasks")
      .select("*")
      .eq("workspace_id", workspace.id)
      .in("status", ["open", "in_progress"])
      .order("priority", { ascending: false })
      .order("created_at", { ascending: false }),
    admin
      .from("tasks")
      .select("*")
      .eq("workspace_id", workspace.id)
      .in("status", ["done", "dismissed"])
      .gte("updated_at", sevenDaysAgo)
      .order("updated_at", { ascending: false })
      .limit(20),
  ]);

  const tasks: Task[] = [
    ...((active ?? []) as Task[]),
    ...((recent ?? []) as Task[]),
  ];

  return (
    <div className="grid min-h-screen app-grid" style={{ gridTemplateColumns: "240px 1fr" }}>
      <Sidebar
        active="tasks"
        remainingTokens={remaining}
        monthlyQuota={quota}
        workspaceName={workspace.name}
        workspaceId={workspace.id}
        allWorkspaces={allWorkspaces}
      />
      <TasksClient initialTasks={tasks} />
    </div>
  );
}
