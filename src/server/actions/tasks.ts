"use server";

import { requireWorkspaceOwner } from "@/lib/auth/require";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { revalidatePath } from "next/cache";

export type TaskType = "approval" | "review" | "follow-up" | "alert" | "action";
export type TaskStatus = "open" | "in_progress" | "done" | "dismissed";
export type TaskPriority = 1 | 2 | 3;

export type Task = {
  id: string;
  workspace_id: string;
  title: string;
  description: string | null;
  type: TaskType;
  status: TaskStatus;
  priority: TaskPriority;
  source_agent: string | null;
  source_msg_id: string | null;
  due_date: string | null;
  completed_at: string | null;
  created_at: string;
  updated_at: string;
};

/**
 * List tasks for the current workspace.
 * Returns open + in_progress tasks, plus done/dismissed tasks from the last 7 days.
 */
export async function listTasks(status?: string): Promise<Task[]> {
  const { workspace } = await requireWorkspaceOwner();
  const admin = createSupabaseAdminClient();

  if (status && status !== "all") {
    const { data, error } = await admin
      .from("tasks")
      .select("*")
      .eq("workspace_id", workspace.id)
      .eq("status", status)
      .order("priority", { ascending: false })
      .order("created_at", { ascending: false });

    if (error) throw new Error(error.message);
    return (data ?? []) as Task[];
  }

  // Default: open + in_progress + done/dismissed from last 7 days
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

  return [...(active ?? []), ...(recent ?? [])] as Task[];
}

/**
 * Create a new task for the current workspace.
 */
export async function createTask(data: {
  title: string;
  description?: string;
  type: TaskType;
  priority?: TaskPriority;
  dueDate?: string;
  sourceAgent?: string;
  assignedAgent?: string; // which agent should handle this task
}): Promise<Task> {
  const { workspace } = await requireWorkspaceOwner();
  const admin = createSupabaseAdminClient();

  const { data: task, error } = await admin
    .from("tasks")
    .insert({
      workspace_id: workspace.id,
      title: data.title,
      description: data.description ?? null,
      type: data.type,
      priority: data.priority ?? 2,
      due_date: data.dueDate ?? null,
      // source_agent holds either the auto-extracting agent OR the manually assigned agent
      source_agent: data.assignedAgent ?? data.sourceAgent ?? null,
    })
    .select("*")
    .single();

  if (error) throw new Error(error.message);

  revalidatePath("/tasks");
  revalidatePath("/command");
  return task as Task;
}

/**
 * Update the status of a task.
 */
export async function updateTaskStatus(
  id: string,
  status: TaskStatus,
): Promise<void> {
  const { workspace } = await requireWorkspaceOwner();
  const admin = createSupabaseAdminClient();

  // Verify ownership first (RLS backs this up, but belt-and-suspenders)
  const { data: existing } = await admin
    .from("tasks")
    .select("workspace_id")
    .eq("id", id)
    .maybeSingle();

  if (!existing || existing.workspace_id !== workspace.id) {
    throw new Error("Task not found");
  }

  const updates: Record<string, unknown> = {
    status,
    updated_at: new Date().toISOString(),
  };
  if (status === "done") {
    updates.completed_at = new Date().toISOString();
  }

  const { error } = await admin
    .from("tasks")
    .update(updates)
    .eq("id", id);

  if (error) throw new Error(error.message);

  revalidatePath("/tasks");
  revalidatePath("/command");
}

/**
 * Update task fields (title, description, assigned agent, due date, priority).
 */
export async function updateTask(
  id: string,
  data: {
    title?: string;
    description?: string;
    assignedAgent?: string | null;
    dueDate?: string | null;
    priority?: TaskPriority;
    type?: TaskType;
  },
): Promise<void> {
  const { workspace } = await requireWorkspaceOwner();
  const admin = createSupabaseAdminClient();

  const { data: existing } = await admin
    .from("tasks").select("workspace_id").eq("id", id).maybeSingle();
  if (!existing || existing.workspace_id !== workspace.id) throw new Error("Task not found");

  const updates: Record<string, unknown> = { updated_at: new Date().toISOString() };
  if (data.title !== undefined) updates.title = data.title;
  if (data.description !== undefined) updates.description = data.description || null;
  if (data.assignedAgent !== undefined) updates.source_agent = data.assignedAgent || null;
  if (data.dueDate !== undefined) updates.due_date = data.dueDate || null;
  if (data.priority !== undefined) updates.priority = data.priority;
  if (data.type !== undefined) updates.type = data.type;

  const { error } = await admin.from("tasks").update(updates).eq("id", id);
  if (error) throw new Error(error.message);

  revalidatePath("/tasks");
  revalidatePath("/command");
}

/**
 * Hard delete a task.
 */
export async function deleteTask(id: string): Promise<void> {
  const { workspace } = await requireWorkspaceOwner();
  const admin = createSupabaseAdminClient();

  const { data: existing } = await admin
    .from("tasks")
    .select("workspace_id")
    .eq("id", id)
    .maybeSingle();

  if (!existing || existing.workspace_id !== workspace.id) {
    throw new Error("Task not found");
  }

  const { error } = await admin.from("tasks").delete().eq("id", id);
  if (error) throw new Error(error.message);

  revalidatePath("/tasks");
  revalidatePath("/command");
}
