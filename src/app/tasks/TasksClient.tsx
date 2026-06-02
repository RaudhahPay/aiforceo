"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { createTask, updateTaskStatus, updateTask, deleteTask } from "@/server/actions/tasks";
import type { Task, TaskType, TaskStatus, TaskPriority } from "@/server/actions/tasks";

// Maps agent role → their name + what they handle
const AGENT_OPTIONS = [
  { value: "aria", label: "Aria — Chief of Staff", description: "Coordination, planning, delegation" },
  { value: "cmo",  label: "Maya — CMO",            description: "Marketing, content, campaigns" },
  { value: "cfo",  label: "Felix — CFO",            description: "Finance, P&L, cash flow" },
  { value: "coo",  label: "Owen — COO",             description: "Operations, processes, team" },
  { value: "ceo",  label: "Eden — CEO",             description: "Strategy, decisions, growth" },
  { value: "cto",  label: "Tariq — CTO",            description: "Tech, automation, systems" },
];

// ── Design tokens (match dark theme) ──────────────────────────────────────────
const D = {
  bg: "var(--bg)",
  panel: "var(--panel)",
  panel2: "var(--panel2)",
  line: "var(--line)",
  gold: "var(--accent)",
  text: "var(--ink)",
  muted: "var(--muted)",
  red: "var(--red)",
  primary: "var(--primary)",
};

// ── Type badge config ─────────────────────────────────────────────────────────
const TYPE_CONFIG: Record<TaskType, { label: string; color: string; bg: string }> = {
  approval:    { label: "Approval",   color: "#c5a572", bg: "rgba(197,165,114,0.15)" },
  review:      { label: "Review",     color: "#3b82f6", bg: "rgba(59,130,246,0.15)" },
  "follow-up": { label: "Follow-up",  color: "#e5a93c", bg: "rgba(229,169,60,0.15)" },
  alert:       { label: "Alert",      color: "#e5544b", bg: "rgba(229,84,75,0.15)" },
  action:      { label: "Action",     color: "#a855f7", bg: "rgba(168,85,247,0.15)" },
};

const PRIORITY_CONFIG: Record<number, { label: string; color: string; dot: string }> = {
  3: { label: "HIGH PRIORITY",   color: "#e5544b", dot: "🔴" },
  2: { label: "MEDIUM PRIORITY", color: "#e5a93c", dot: "🟡" },
  1: { label: "LOW PRIORITY",    color: "#8597b8", dot: "⚪" },
};

const AGENT_INITIAL: Record<string, { initials: string; color: string }> = {
  aria: { initials: "Ar", color: "#6366f1" },
  ceo:  { initials: "CEO", color: "#c5a572" },
  cfo:  { initials: "CFO", color: "#10b981" },
  cmo:  { initials: "CMO", color: "#f59e0b" },
  coo:  { initials: "COO", color: "#3b82f6" },
  cto:  { initials: "CTO", color: "#8b5cf6" },
};

const FILTER_TABS: { label: string; value: string }[] = [
  { label: "All",         value: "all" },
  { label: "Open",        value: "open" },
  { label: "In Progress", value: "in_progress" },
  { label: "Done",        value: "done" },
];

// ── Helpers ───────────────────────────────────────────────────────────────────
function formatDueDate(due: string | null): { text: string; color: string } | null {
  if (!due) return null;
  const now = new Date();
  const dueDate = new Date(due);
  const diffDays = Math.ceil((dueDate.getTime() - now.setHours(0, 0, 0, 0)) / (1000 * 60 * 60 * 24));
  if (diffDays < 0) return { text: `Overdue (${due})`, color: "#e5544b" };
  if (diffDays === 0) return { text: "Due today", color: "#e5544b" };
  if (diffDays <= 3) return { text: `Due in ${diffDays}d`, color: "#e5a93c" };
  return { text: `Due ${due}`, color: "#8597b8" };
}

function timeAgo(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  return `${Math.floor(hrs / 24)}d ago`;
}

// ── Task Card ─────────────────────────────────────────────────────────────────
function TaskCard({
  task,
  onStatusChange,
  onDelete,
  onUpdated,
  isPending,
}: {
  task: Task;
  onStatusChange: (id: string, status: TaskStatus) => void;
  onDelete: (id: string) => void;
  onUpdated: (updated: Task) => void;
  isPending: boolean;
}) {
  const router = useRouter();
  const [isEditing, setIsEditing] = useState(false);
  const [editAgent, setEditAgent] = useState(task.source_agent ?? "");
  const [editTitle, setEditTitle] = useState(task.title);
  const [editDue, setEditDue] = useState(task.due_date ?? "");
  const [editPriority, setEditPriority] = useState<TaskPriority>(task.priority);
  const [savePending, startSave] = useTransition();

  const typeConfig = TYPE_CONFIG[task.type] ?? TYPE_CONFIG.action;
  const agentMeta = task.source_agent ? AGENT_INITIAL[task.source_agent] : null;
  const dueInfo = formatDueDate(task.due_date);
  const isActive = task.status === "open" || task.status === "in_progress";

  function handleStart() {
    onStatusChange(task.id, "in_progress");
    if (task.source_agent) {
      const prompt = encodeURIComponent(`Task: ${task.title}${task.description ? `\n\nContext: ${task.description}` : ""}\n\nPlease help me work on this.`);
      router.push(`/agent/${task.source_agent}?task=${prompt}`);
    }
  }

  function handleSaveEdit() {
    startSave(async () => {
      await updateTask(task.id, {
        title: editTitle.trim(),
        assignedAgent: editAgent || null,
        dueDate: editDue || null,
        priority: editPriority,
      });
      onUpdated({ ...task, title: editTitle.trim(), source_agent: editAgent || null, due_date: editDue || null, priority: editPriority });
      setIsEditing(false);
    });
  }

  return (
    <div
      style={{
        background: D.panel2,
        border: `1px solid ${D.line}`,
        borderRadius: 12,
        padding: "12px 14px",
        display: "flex",
        flexDirection: "column",
        gap: 8,
        opacity: isPending ? 0.6 : 1,
        transition: "opacity 0.15s",
      }}
    >
      {/* Top row */}
      <div style={{ display: "flex", alignItems: "flex-start", gap: 10 }}>
        {/* Agent avatar */}
        {agentMeta && (
          <div
            title={`Created by ${task.source_agent}`}
            style={{
              width: 26,
              height: 26,
              borderRadius: 8,
              background: agentMeta.color,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              fontSize: 9,
              fontWeight: 700,
              color: "#fff",
              flexShrink: 0,
              marginTop: 1,
            }}
          >
            {agentMeta.initials}
          </div>
        )}

        {/* Title + description */}
        <div style={{ flex: 1, minWidth: 0 }}>
          <p
            style={{
              margin: 0,
              fontSize: 13,
              fontWeight: 600,
              color: task.status === "done" || task.status === "dismissed"
                ? D.muted
                : D.text,
              textDecoration: task.status === "done" ? "line-through" : "none",
            }}
          >
            {task.title}
          </p>
          {task.description && (
            <p style={{ margin: "3px 0 0", fontSize: 11, color: D.muted, lineHeight: 1.5 }}>
              {task.description}
            </p>
          )}
        </div>

        {/* Type badge */}
        <span
          style={{
            fontSize: 10,
            fontWeight: 700,
            padding: "3px 8px",
            borderRadius: 6,
            background: typeConfig.bg,
            color: typeConfig.color,
            whiteSpace: "nowrap",
            flexShrink: 0,
          }}
        >
          {typeConfig.label}
        </span>
      </div>

      {/* Bottom row: meta + actions */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          {dueInfo && (
            <span style={{ fontSize: 10, color: dueInfo.color, fontWeight: 600 }}>
              📅 {dueInfo.text}
            </span>
          )}
          <span style={{ fontSize: 10, color: D.muted }}>
            {timeAgo(task.created_at)}
          </span>
          {task.status === "in_progress" && (
            <span style={{ fontSize: 10, color: "#3b82f6", fontWeight: 600 }}>
              In Progress
            </span>
          )}
          {task.status === "dismissed" && (
            <span style={{ fontSize: 10, color: D.muted }}>Dismissed</span>
          )}
        </div>

        {/* Action buttons for active tasks */}
        {isActive && (
          <div style={{ display: "flex", gap: 6, flexShrink: 0 }}>
            {task.status === "open" && (
              <button
                onClick={handleStart}
                disabled={isPending}
                title={task.source_agent ? `Open with ${task.source_agent.toUpperCase()}` : "Mark as in progress"}
                style={{
                  padding: "4px 9px",
                  borderRadius: 7,
                  fontSize: 11,
                  fontWeight: 600,
                  cursor: "pointer",
                  background: "rgba(59,130,246,0.12)",
                  border: "1px solid rgba(59,130,246,0.3)",
                  color: "#3b82f6",
                  display: "flex",
                  alignItems: "center",
                  gap: 4,
                }}
              >
                {task.source_agent ? `▶ Open with ${task.source_agent.toUpperCase()}` : "▶ Start"}
              </button>
            )}
            <button
              onClick={() => onStatusChange(task.id, "done")}
              disabled={isPending}
              style={{
                padding: "4px 9px",
                borderRadius: 7,
                fontSize: 11,
                fontWeight: 600,
                cursor: "pointer",
                background: "rgba(16,185,129,0.12)",
                border: "1px solid rgba(16,185,129,0.3)",
                color: "#10b981",
              }}
            >
              ✓ Done
            </button>
            <button
              onClick={() => onStatusChange(task.id, "dismissed")}
              disabled={isPending}
              style={{
                padding: "4px 9px", borderRadius: 7, fontSize: 11, fontWeight: 600,
                cursor: "pointer", background: "rgba(229,84,75,0.08)",
                border: "1px solid rgba(229,84,75,0.2)", color: "#e5544b",
              }}
            >✗ Dismiss</button>
            <button
              onClick={() => setIsEditing(!isEditing)}
              style={{
                padding: "4px 9px", borderRadius: 7, fontSize: 11, fontWeight: 600,
                cursor: "pointer", background: "rgba(133,151,184,0.08)",
                border: "1px solid rgba(133,151,184,0.2)", color: D.muted,
              }}
            >✎ Edit</button>
          </div>
        )}

        {/* Inline edit form */}
        {isEditing && (
          <div style={{ borderTop: `1px solid ${D.line}`, paddingTop: 10, display: "flex", flexDirection: "column", gap: 8 }}>
            <div>
              <label style={{ fontSize: 10, fontWeight: 600, color: D.muted, display: "block", marginBottom: 3 }}>Title</label>
              <input value={editTitle} onChange={e => setEditTitle(e.target.value)}
                style={{ width: "100%", padding: "7px 10px", borderRadius: 7, border: `1px solid ${D.line}`, background: D.panel, color: D.text, fontSize: 12, boxSizing: "border-box" }} />
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
              <div>
                <label style={{ fontSize: 10, fontWeight: 600, color: D.muted, display: "block", marginBottom: 3 }}>Assign to Agent</label>
                <select value={editAgent} onChange={e => setEditAgent(e.target.value)}
                  style={{ width: "100%", padding: "7px 10px", borderRadius: 7, border: `1px solid ${D.line}`, background: D.panel, color: D.text, fontSize: 12 }}>
                  <option value="">— Unassigned —</option>
                  {AGENT_OPTIONS.map(a => <option key={a.value} value={a.value}>{a.label.split(" — ")[0]}</option>)}
                </select>
              </div>
              <div>
                <label style={{ fontSize: 10, fontWeight: 600, color: D.muted, display: "block", marginBottom: 3 }}>Priority</label>
                <select value={editPriority} onChange={e => setEditPriority(Number(e.target.value) as TaskPriority)}
                  style={{ width: "100%", padding: "7px 10px", borderRadius: 7, border: `1px solid ${D.line}`, background: D.panel, color: D.text, fontSize: 12 }}>
                  <option value={3}>High</option>
                  <option value={2}>Medium</option>
                  <option value={1}>Low</option>
                </select>
              </div>
            </div>
            <div>
              <label style={{ fontSize: 10, fontWeight: 600, color: D.muted, display: "block", marginBottom: 3 }}>Due Date</label>
              <input type="date" value={editDue} onChange={e => setEditDue(e.target.value)}
                style={{ padding: "7px 10px", borderRadius: 7, border: `1px solid ${D.line}`, background: D.panel, color: D.text, fontSize: 12 }} />
            </div>
            <div style={{ display: "flex", gap: 8 }}>
              <button onClick={handleSaveEdit} disabled={savePending}
                style={{ padding: "6px 14px", borderRadius: 7, fontSize: 11, fontWeight: 700, cursor: "pointer", background: "var(--accent)", color: "#0a0e1a", border: "none" }}>
                {savePending ? "Saving…" : "✓ Save"}
              </button>
              <button onClick={() => setIsEditing(false)}
                style={{ padding: "6px 12px", borderRadius: 7, fontSize: 11, fontWeight: 600, cursor: "pointer", background: "transparent", color: D.muted, border: `1px solid ${D.line}` }}>
                Cancel
              </button>
            </div>
          </div>
        )}

        {/* Delete for done/dismissed */}
        {!isActive && (
          <button
            onClick={() => onDelete(task.id)}
            disabled={isPending}
            style={{
              padding: "3px 8px",
              borderRadius: 6,
              fontSize: 10,
              cursor: "pointer",
              background: "transparent",
              border: `1px solid ${D.line}`,
              color: D.muted,
            }}
          >
            Remove
          </button>
        )}
      </div>
    </div>
  );
}

// ── Add Task Form ─────────────────────────────────────────────────────────────
function AddTaskForm({
  onClose,
  onCreated,
}: {
  onClose: () => void;
  onCreated: (task: Task) => void;
}) {
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [type, setType] = useState<TaskType>("action");
  const [priority, setPriority] = useState<TaskPriority>(2);
  const [dueDate, setDueDate] = useState("");
  const [assignedAgent, setAssignedAgent] = useState("");
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState("");

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!title.trim()) { setError("Title is required"); return; }
    setError("");
    startTransition(async () => {
      try {
        const task = await createTask({
          title: title.trim(),
          description: description.trim() || undefined,
          type,
          priority,
          dueDate: dueDate || undefined,
          assignedAgent: assignedAgent || undefined,
        });
        onCreated(task);
        onClose();
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to create task");
      }
    });
  }

  return (
    <div
      style={{
        background: D.panel,
        border: `1px solid ${D.line}`,
        borderRadius: 14,
        padding: 20,
        marginBottom: 20,
      }}
    >
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 16 }}>
        <h3 style={{ margin: 0, fontSize: 14, fontWeight: 700, color: D.text }}>Add Task</h3>
        <button
          onClick={onClose}
          style={{ background: "none", border: "none", cursor: "pointer", color: D.muted, fontSize: 18 }}
        >
          ×
        </button>
      </div>

      <form onSubmit={handleSubmit} style={{ display: "flex", flexDirection: "column", gap: 12 }}>
        {/* Title */}
        <div>
          <label style={{ fontSize: 11, fontWeight: 600, color: D.muted, display: "block", marginBottom: 5 }}>
            Title *
          </label>
          <input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="What needs to be done?"
            required
            style={{
              width: "100%",
              padding: "9px 12px",
              borderRadius: 9,
              border: `1px solid ${D.line}`,
              background: D.panel2,
              color: D.text,
              fontSize: 13,
              boxSizing: "border-box",
            }}
          />
        </div>

        {/* Description */}
        <div>
          <label style={{ fontSize: 11, fontWeight: 600, color: D.muted, display: "block", marginBottom: 5 }}>
            Description (optional)
          </label>
          <textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            rows={2}
            placeholder="Additional context..."
            style={{
              width: "100%",
              padding: "9px 12px",
              borderRadius: 9,
              border: `1px solid ${D.line}`,
              background: D.panel2,
              color: D.text,
              fontSize: 13,
              resize: "vertical",
              boxSizing: "border-box",
            }}
          />
        </div>

        {/* Assign to Agent */}
        <div>
          <label style={{ fontSize: 11, fontWeight: 600, color: D.muted, display: "block", marginBottom: 5 }}>
            Assign to AI Executive
          </label>
          <select
            value={assignedAgent}
            onChange={(e) => setAssignedAgent(e.target.value)}
            style={{
              width: "100%", padding: "9px 12px", borderRadius: 9,
              border: `1px solid ${D.line}`, background: D.panel2, color: D.text, fontSize: 13,
            }}
          >
            <option value="">— Unassigned —</option>
            {AGENT_OPTIONS.map((a) => (
              <option key={a.value} value={a.value}>{a.label}</option>
            ))}
          </select>
          {assignedAgent && (
            <p style={{ margin: "4px 0 0", fontSize: 10, color: D.muted }}>
              ▶ Start will open this task in {AGENT_OPTIONS.find(a => a.value === assignedAgent)?.label.split(" — ")[0]}&apos;s chat
            </p>
          )}
        </div>

        {/* Type + Priority row */}
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
          <div>
            <label style={{ fontSize: 11, fontWeight: 600, color: D.muted, display: "block", marginBottom: 5 }}>
              Type
            </label>
            <select
              value={type}
              onChange={(e) => setType(e.target.value as TaskType)}
              style={{
                width: "100%",
                padding: "9px 12px",
                borderRadius: 9,
                border: `1px solid ${D.line}`,
                background: D.panel2,
                color: D.text,
                fontSize: 13,
              }}
            >
              <option value="action">Action</option>
              <option value="approval">Approval</option>
              <option value="review">Review</option>
              <option value="follow-up">Follow-up</option>
              <option value="alert">Alert</option>
            </select>
          </div>

          <div>
            <label style={{ fontSize: 11, fontWeight: 600, color: D.muted, display: "block", marginBottom: 5 }}>
              Priority
            </label>
            <select
              value={priority}
              onChange={(e) => setPriority(Number(e.target.value) as TaskPriority)}
              style={{
                width: "100%",
                padding: "9px 12px",
                borderRadius: 9,
                border: `1px solid ${D.line}`,
                background: D.panel2,
                color: D.text,
                fontSize: 13,
              }}
            >
              <option value={3}>High</option>
              <option value={2}>Medium</option>
              <option value={1}>Low</option>
            </select>
          </div>
        </div>

        {/* Due date */}
        <div>
          <label style={{ fontSize: 11, fontWeight: 600, color: D.muted, display: "block", marginBottom: 5 }}>
            Due date (optional)
          </label>
          <input
            type="date"
            value={dueDate}
            onChange={(e) => setDueDate(e.target.value)}
            style={{
              width: "100%",
              padding: "9px 12px",
              borderRadius: 9,
              border: `1px solid ${D.line}`,
              background: D.panel2,
              color: D.text,
              fontSize: 13,
              boxSizing: "border-box",
            }}
          />
        </div>

        {error && (
          <p style={{ margin: 0, fontSize: 12, color: "#e5544b" }}>{error}</p>
        )}

        <div style={{ display: "flex", gap: 10, justifyContent: "flex-end" }}>
          <button
            type="button"
            onClick={onClose}
            style={{
              padding: "9px 18px",
              borderRadius: 9,
              fontSize: 13,
              fontWeight: 600,
              cursor: "pointer",
              background: "transparent",
              border: `1px solid ${D.line}`,
              color: D.muted,
            }}
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={isPending}
            style={{
              padding: "9px 18px",
              borderRadius: 9,
              fontSize: 13,
              fontWeight: 600,
              cursor: isPending ? "not-allowed" : "pointer",
              background: "var(--accent)",
              border: "none",
              color: "#0a0e1a",
              opacity: isPending ? 0.7 : 1,
            }}
          >
            {isPending ? "Creating..." : "Create Task"}
          </button>
        </div>
      </form>
    </div>
  );
}

// ── Priority Section ──────────────────────────────────────────────────────────
function PrioritySection({
  priority,
  tasks,
  onStatusChange,
  onDelete,
  onUpdated,
  pendingIds,
}: {
  priority: 1 | 2 | 3;
  tasks: Task[];
  onStatusChange: (id: string, status: TaskStatus) => void;
  onDelete: (id: string) => void;
  onUpdated: (updated: Task) => void;
  pendingIds: Set<string>;
}) {
  if (tasks.length === 0) return null;
  const cfg = PRIORITY_CONFIG[priority]!;

  return (
    <div style={{ marginBottom: 20 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 10 }}>
        <span>{cfg.dot}</span>
        <h3 style={{
          margin: 0,
          fontSize: 11,
          fontWeight: 700,
          letterSpacing: "0.08em",
          textTransform: "uppercase",
          color: cfg.color,
        }}>
          {cfg.label}
        </h3>
        <span style={{
          fontSize: 10,
          fontWeight: 700,
          background: "rgba(255,255,255,0.06)",
          color: D.muted,
          padding: "1px 7px",
          borderRadius: 10,
        }}>
          {tasks.length}
        </span>
      </div>
      <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
        {tasks.map((task) => (
          <TaskCard
            key={task.id}
            task={task}
            onStatusChange={onStatusChange}
            onDelete={onDelete}
            onUpdated={onUpdated}
            isPending={pendingIds.has(task.id)}
          />
        ))}
      </div>
    </div>
  );
}

// ── Main Tasks Client ─────────────────────────────────────────────────────────
export function TasksClient({ initialTasks }: { initialTasks: Task[] }) {
  const [tasks, setTasks] = useState<Task[]>(initialTasks);
  const [activeFilter, setActiveFilter] = useState<string>("all");
  const [showAddForm, setShowAddForm] = useState(false);
  const [pendingIds, setPendingIds] = useState<Set<string>>(new Set());
  const [, startTransition] = useTransition();

  // ── Filtering ──
  const filteredTasks = tasks.filter((t) => {
    if (activeFilter === "all") return true;
    return t.status === activeFilter;
  });

  // ── Group by priority ──
  const byPriority = (p: 1 | 2 | 3) => filteredTasks.filter((t) => t.priority === p);

  // ── Stats ──
  const openCount = tasks.filter((t) => t.status === "open").length;
  const inProgressCount = tasks.filter((t) => t.status === "in_progress").length;

  // ── Handlers ──
  function handleStatusChange(id: string, status: TaskStatus) {
    setPendingIds((prev) => new Set(prev).add(id));
    startTransition(async () => {
      try {
        await updateTaskStatus(id, status);
        setTasks((prev) =>
          prev.map((t) =>
            t.id === id
              ? { ...t, status, updated_at: new Date().toISOString(), completed_at: status === "done" ? new Date().toISOString() : t.completed_at }
              : t,
          ),
        );
      } catch (err) {
        console.error("Failed to update task:", err);
      } finally {
        setPendingIds((prev) => {
          const next = new Set(prev);
          next.delete(id);
          return next;
        });
      }
    });
  }

  function handleDelete(id: string) {
    setPendingIds((prev) => new Set(prev).add(id));
    startTransition(async () => {
      try {
        await deleteTask(id);
        setTasks((prev) => prev.filter((t) => t.id !== id));
      } catch (err) {
        console.error("Failed to delete task:", err);
      } finally {
        setPendingIds((prev) => {
          const next = new Set(prev);
          next.delete(id);
          return next;
        });
      }
    });
  }

  function handleUpdated(updated: Task) {
    setTasks((prev) => prev.map((t) => t.id === updated.id ? updated : t));
  }

  function handleCreated(task: Task) {
    setTasks((prev) => [task, ...prev]);
  }

  return (
    <main
      style={{
        background: D.bg,
        minHeight: "100vh",
        padding: "20px 28px",
        overflow: "auto",
      }}
    >
      {/* Header */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          marginBottom: 24,
          flexWrap: "wrap",
          gap: 12,
        }}
      >
        <div>
          <p style={{
            margin: 0,
            fontSize: 11,
            fontWeight: 700,
            color: "var(--accent)",
            textTransform: "uppercase",
            letterSpacing: "0.1em",
          }}>
            CEO Task Manager
          </p>
          <h1 className="serif" style={{ margin: "2px 0 0", fontSize: 28 }}>
            Action Queue
          </h1>
          <p style={{ margin: "4px 0 0", fontSize: 12, color: D.muted }}>
            {openCount} open · {inProgressCount} in progress
          </p>
        </div>
        <button
          onClick={() => setShowAddForm((s) => !s)}
          style={{
            padding: "10px 18px",
            borderRadius: 10,
            fontSize: 13,
            fontWeight: 600,
            cursor: "pointer",
            background: "var(--accent)",
            border: "none",
            color: "#0a0e1a",
            display: "flex",
            alignItems: "center",
            gap: 7,
          }}
        >
          + Add Task
        </button>
      </div>

      {/* Add Task Form */}
      {showAddForm && (
        <AddTaskForm
          onClose={() => setShowAddForm(false)}
          onCreated={handleCreated}
        />
      )}

      {/* Filter Tabs */}
      <div
        style={{
          display: "flex",
          gap: 4,
          marginBottom: 24,
          borderBottom: `1px solid ${D.line}`,
          paddingBottom: 0,
        }}
      >
        {FILTER_TABS.map((tab) => {
          const isActive = activeFilter === tab.value;
          const count =
            tab.value === "all"
              ? tasks.length
              : tasks.filter((t) => t.status === tab.value).length;

          return (
            <button
              key={tab.value}
              onClick={() => setActiveFilter(tab.value)}
              style={{
                padding: "8px 14px",
                borderRadius: "8px 8px 0 0",
                fontSize: 12,
                fontWeight: isActive ? 700 : 500,
                cursor: "pointer",
                background: isActive ? D.panel : "transparent",
                border: `1px solid ${isActive ? D.line : "transparent"}`,
                borderBottom: isActive ? `1px solid ${D.bg}` : "none",
                color: isActive ? "var(--accent)" : D.muted,
                display: "flex",
                alignItems: "center",
                gap: 6,
                marginBottom: isActive ? -1 : 0,
              }}
            >
              {tab.label}
              {count > 0 && (
                <span
                  style={{
                    fontSize: 10,
                    fontWeight: 700,
                    background: isActive ? "rgba(197,165,114,0.2)" : "rgba(255,255,255,0.06)",
                    color: isActive ? "var(--accent)" : D.muted,
                    padding: "1px 6px",
                    borderRadius: 10,
                  }}
                >
                  {count}
                </span>
              )}
            </button>
          );
        })}
      </div>

      {/* Task sections by priority */}
      <div>
        {filteredTasks.length === 0 ? (
          <div
            style={{
              background: D.panel,
              border: `1px solid ${D.line}`,
              borderRadius: 16,
              padding: "40px 20px",
              textAlign: "center",
            }}
          >
            <p style={{ margin: 0, fontSize: 24, marginBottom: 10 }}>🎉</p>
            <p style={{ margin: 0, fontSize: 14, fontWeight: 600, color: D.text }}>
              {activeFilter === "all" ? "No tasks yet" : `No ${activeFilter.replace("_", " ")} tasks`}
            </p>
            <p style={{ margin: "6px 0 0", fontSize: 12, color: D.muted }}>
              {activeFilter === "all"
                ? "AI agents will add tasks here when they spot action items, or add one yourself."
                : "Switch to another tab or add a new task."}
            </p>
          </div>
        ) : (
          <>
            <PrioritySection
              priority={3}
              tasks={byPriority(3)}
              onStatusChange={handleStatusChange}
              onDelete={handleDelete}
              onUpdated={handleUpdated}
              pendingIds={pendingIds}
            />
            <PrioritySection
              priority={2}
              tasks={byPriority(2)}
              onStatusChange={handleStatusChange}
              onDelete={handleDelete}
              onUpdated={handleUpdated}
              pendingIds={pendingIds}
            />
            <PrioritySection
              priority={1}
              tasks={byPriority(1)}
              onStatusChange={handleStatusChange}
              onDelete={handleDelete}
              onUpdated={handleUpdated}
              pendingIds={pendingIds}
            />
          </>
        )}
      </div>
    </main>
  );
}
