"use client";

import { useState, useTransition, useRef } from "react";
import {
  saveAutopilotConfig,
  createAutopilotRun,
} from "@/server/actions/autopilot";
import type {
  AutopilotConfig,
  AutopilotRun,
  AutopilotRunOutput,
  AutopilotTaskType,
} from "@/server/actions/autopilot";

// ─── Constants ────────────────────────────────────────────────────────────────

const ALL_TASKS: {
  id: AutopilotTaskType;
  label: string;
  description: string;
  icon: string;
}[] = [
  {
    id: "daily_brief",
    label: "Daily Brief",
    description:
      "Morning executive summary: KPI pulse, top 3 priorities, risk radar.",
    icon: "☀",
  },
  {
    id: "social_post",
    label: "Social Posts",
    description: "One LinkedIn + one X/Twitter post ready to publish.",
    icon: "✦",
  },
  {
    id: "weekly_review",
    label: "Weekly Review",
    description: "Monday review: revenue vs target, wins, losses, focus area.",
    icon: "◎",
  },
  {
    id: "competitor_check",
    label: "Competitor Intel",
    description: "Summarise competitor moves and surface a market opportunity.",
    icon: "◈",
  },
  {
    id: "cash_alert",
    label: "Cash Alert",
    description: "Runway check — flags if burn rate is critical.",
    icon: "⚑",
  },
  {
    id: "content_idea",
    label: "Content Ideas",
    description: "3 ready-to-execute content ideas based on your profile.",
    icon: "✎",
  },
];

const D = {
  bg: "#0E1726",
  panel: "#15203A",
  panel2: "#1C2A47",
  line: "#2A3B5E",
  gold: "#D4A017",
  text: "#E8EDF6",
  dim: "#8597B8",
  red: "var(--red)",
  green: "var(--success)",
  amber: "#E5A93C",
};

// ─── Sub-components ───────────────────────────────────────────────────────────

function StatusBadge({ status }: { status: string }) {
  const map: Record<string, { color: string; label: string }> = {
    pending: { color: D.dim, label: "Pending" },
    running: { color: D.amber, label: "Running…" },
    done: { color: D.green, label: "Done" },
    error: { color: D.red, label: "Error" },
  };
  const s = map[status] ?? map.pending;
  return (
    <span
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: 5,
        fontSize: 12,
        fontWeight: 600,
        color: s!.color,
      }}
    >
      <span
        style={{
          width: 7,
          height: 7,
          borderRadius: "50%",
          background: s!.color,
          display: "inline-block",
          animation:
            status === "running" ? "pulse-gold 1.4s infinite" : undefined,
        }}
      />
      {s!.label}
    </span>
  );
}

function TaskOutputCard({ item }: { item: AutopilotRunOutput }) {
  const [copied, setCopied] = useState(false);
  const meta = ALL_TASKS.find((t) => t.id === item.task);

  function copy() {
    void navigator.clipboard.writeText(item.output).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  }

  // Very simple markdown-to-HTML: bold, headers, bullets
  function renderMarkdown(text: string) {
    return text.split("\n").map((line, i) => {
      if (line.startsWith("## "))
        return (
          <h3
            key={i}
            style={{
              fontSize: 15,
              fontWeight: 700,
              margin: "14px 0 6px",
              color: D.text,
            }}
          >
            {line.slice(3)}
          </h3>
        );
      if (line.startsWith("### "))
        return (
          <h4
            key={i}
            style={{
              fontSize: 13,
              fontWeight: 700,
              margin: "10px 0 4px",
              color: D.gold,
            }}
          >
            {line.slice(4)}
          </h4>
        );
      if (line.startsWith("**") && line.endsWith("**"))
        return (
          <p
            key={i}
            style={{ fontWeight: 700, margin: "6px 0 2px", fontSize: 13 }}
          >
            {line.slice(2, -2)}
          </p>
        );
      if (line.startsWith("- ") || line.startsWith("• "))
        return (
          <p
            key={i}
            style={{ margin: "2px 0 2px 12px", fontSize: 13, color: D.text }}
          >
            {line}
          </p>
        );
      if (line.trim() === "") return <div key={i} style={{ height: 4 }} />;
      return (
        <p key={i} style={{ margin: "2px 0", fontSize: 13, color: D.text }}>
          {line}
        </p>
      );
    });
  }

  return (
    <div
      style={{
        background: D.panel2,
        border: `1px solid ${D.line}`,
        borderRadius: 12,
        overflow: "hidden",
      }}
    >
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          padding: "10px 14px",
          borderBottom: `1px solid ${D.line}`,
        }}
      >
        <span
          style={{
            fontSize: 13,
            fontWeight: 700,
            display: "flex",
            alignItems: "center",
            gap: 7,
          }}
        >
          <span style={{ fontSize: 15 }}>{meta?.icon}</span>
          {meta?.label ?? item.task}
        </span>
        <button
          onClick={copy}
          style={{
            fontSize: 11,
            fontWeight: 600,
            color: copied ? D.green : D.dim,
            background: "transparent",
            border: `1px solid ${D.line}`,
            borderRadius: 6,
            padding: "3px 10px",
            cursor: "pointer",
          }}
        >
          {copied ? "Copied!" : "Copy"}
        </button>
      </div>
      <div style={{ padding: "12px 16px" }}>{renderMarkdown(item.output)}</div>
    </div>
  );
}

function RunHistoryItem({ run }: { run: AutopilotRun }) {
  const [expanded, setExpanded] = useState(false);

  const date = new Date(run.created_at).toLocaleString("en-MY", {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });

  const taskCount = run.tasks?.length ?? 0;
  const outputCount = run.outputs?.length ?? 0;

  return (
    <div
      style={{
        border: `1px solid ${D.line}`,
        borderRadius: 12,
        overflow: "hidden",
      }}
    >
      <button
        onClick={() => setExpanded((v) => !v)}
        style={{
          width: "100%",
          display: "flex",
          alignItems: "center",
          gap: 12,
          padding: "12px 16px",
          background: D.panel,
          border: "none",
          cursor: "pointer",
          textAlign: "left",
        }}
      >
        <span style={{ fontSize: 14, color: D.text, fontWeight: 600, flex: 1 }}>
          {date}
        </span>
        <span style={{ fontSize: 12, color: D.dim }}>
          {outputCount}/{taskCount} tasks
        </span>
        <StatusBadge status={run.status} />
        <span style={{ color: D.dim, fontSize: 12 }}>
          {expanded ? "▲" : "▼"}
        </span>
      </button>

      {expanded && run.outputs && run.outputs.length > 0 && (
        <div
          style={{
            padding: "12px 16px",
            background: D.bg,
            display: "flex",
            flexDirection: "column",
            gap: 10,
          }}
        >
          {run.outputs.map((o) => (
            <TaskOutputCard key={o.task} item={o} />
          ))}
        </div>
      )}

      {expanded && (!run.outputs || run.outputs.length === 0) && (
        <div style={{ padding: "12px 16px", background: D.bg }}>
          <p style={{ fontSize: 13, color: D.dim }}>
            No outputs saved for this run.
          </p>
        </div>
      )}
    </div>
  );
}

// ─── Main client ──────────────────────────────────────────────────────────────

type Props = {
  workspaceId: string;
  initialConfig: AutopilotConfig;
  initialRuns: AutopilotRun[];
};

export function AutopilotClient({
  workspaceId,
  initialConfig,
  initialRuns,
}: Props) {
  const [config, setConfig] = useState<AutopilotConfig>(initialConfig);
  const [runs, setRuns] = useState<AutopilotRun[]>(initialRuns);
  const [liveOutputs, setLiveOutputs] = useState<AutopilotRunOutput[]>([]);
  const [isRunning, setIsRunning] = useState(false);
  const [runError, setRunError] = useState("");
  const [configSaved, setConfigSaved] = useState(false);
  const [isPending, startTransition] = useTransition();
  const abortRef = useRef<AbortController | null>(null);

  const lastRun = runs[0] ?? null;

  function toggleTask(taskId: AutopilotTaskType) {
    setConfig((c) => ({
      ...c,
      tasks: c.tasks.includes(taskId)
        ? c.tasks.filter((t) => t !== taskId)
        : [...c.tasks, taskId],
    }));
    setConfigSaved(false);
  }

  function saveConfig() {
    startTransition(async () => {
      const res = await saveAutopilotConfig({
        workspaceId,
        enabled: config.enabled,
        tasks: config.tasks,
        schedule: config.schedule,
      });
      if ("error" in res) {
        setRunError(res.error);
      } else {
        setConfigSaved(true);
        setTimeout(() => setConfigSaved(false), 3000);
      }
    });
  }

  async function runNow() {
    if (isRunning || config.tasks.length === 0) return;
    setRunError("");
    setLiveOutputs([]);

    // Create the run record first
    const createResult = await createAutopilotRun(workspaceId, config.tasks);
    if ("error" in createResult) {
      setRunError(createResult.error);
      return;
    }
    const { runId } = createResult;

    // Add a "running" placeholder to the top of the history
    const placeholderRun: AutopilotRun = {
      id: runId,
      workspace_id: workspaceId,
      run_date: new Date().toISOString().slice(0, 10),
      status: "running",
      tasks: config.tasks,
      outputs: null,
      created_at: new Date().toISOString(),
    };
    setRuns((prev) => [placeholderRun, ...prev]);
    setIsRunning(true);

    const abort = new AbortController();
    abortRef.current = abort;

    try {
      const resp = await fetch("/api/autopilot/run", {
        method: "POST",
        credentials: "same-origin",
        signal: abort.signal,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ workspaceId, runId, tasks: config.tasks }),
      });

      if (!resp.ok || !resp.body) {
        throw new Error(`Server error ${resp.status}`);
      }

      const reader = resp.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split("\n");
        buffer = lines.pop() ?? "";
        for (const line of lines) {
          if (!line.trim()) continue;
          try {
            const parsed = JSON.parse(line) as AutopilotRunOutput;
            setLiveOutputs((prev) => [...prev, parsed]);
          } catch {
            // Malformed line — skip
          }
        }
      }

      // Mark run as done in state
      setRuns((prev) =>
        prev.map((r) =>
          r.id === runId ? { ...r, status: "done", outputs: liveOutputs } : r,
        ),
      );
    } catch (err) {
      if ((err as Error).name !== "AbortError") {
        setRunError(err instanceof Error ? err.message : "Run failed");
        setRuns((prev) =>
          prev.map((r) => (r.id === runId ? { ...r, status: "error" } : r)),
        );
      }
    } finally {
      setIsRunning(false);
      abortRef.current = null;
    }
  }

  const nextSchedule = (() => {
    const now = new Date();
    const next = new Date(now);
    next.setDate(now.getDate() + 1);
    next.setHours(7, 0, 0, 0);
    return next.toLocaleString("en-MY", {
      weekday: "short",
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  })();

  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        gap: 20,
        maxWidth: 860,
      }}
    >
      {/* ── Status card ─────────────────────────────────────────────────────── */}
      <div
        className="card"
        style={{
          display: "flex",
          flexWrap: "wrap",
          alignItems: "center",
          gap: 20,
          padding: "20px 24px",
        }}
      >
        <div style={{ flex: 1, minWidth: 200 }}>
          <p
            style={{
              fontSize: 11,
              fontWeight: 700,
              textTransform: "uppercase",
              letterSpacing: "0.08em",
              color: D.dim,
              marginBottom: 6,
            }}
          >
            C-Suite Autopilot Status
          </p>
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <span
              style={{
                width: 36,
                height: 36,
                borderRadius: 10,
                background: "linear-gradient(135deg, #D4A017, #C97B3A)",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                fontSize: 18,
                flexShrink: 0,
              }}
            >
              ⚡
            </span>
            <div>
              <p
                style={{
                  fontWeight: 700,
                  fontSize: 15,
                  margin: 0,
                  color: D.text,
                }}
              >
                Autopilot
              </p>
              <p style={{ fontSize: 12, color: D.dim, margin: 0 }}>
                {lastRun
                  ? `Last run: ${new Date(lastRun.created_at).toLocaleString("en-MY", { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" })}`
                  : "No runs yet"}
              </p>
            </div>
          </div>
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
          <p style={{ fontSize: 11, color: D.dim, margin: 0 }}>
            Next scheduled
          </p>
          <p
            style={{ fontSize: 13, fontWeight: 600, color: D.text, margin: 0 }}
          >
            {nextSchedule}
          </p>
        </div>

        {lastRun && (
          <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
            <p style={{ fontSize: 11, color: D.dim, margin: 0 }}>Last status</p>
            <StatusBadge status={lastRun.status} />
          </div>
        )}

        <button
          onClick={() => void runNow()}
          disabled={isRunning || config.tasks.length === 0}
          className="btn"
          style={{
            background: "linear-gradient(135deg, #D4A017, #C97B3A)",
            color: "#0E1726",
            fontWeight: 700,
            fontSize: 13,
            padding: "10px 22px",
            gap: 8,
          }}
        >
          {isRunning ? (
            <>
              <span style={{ animation: "blink 1s infinite" }}>●</span> Running…
            </>
          ) : (
            <>⚡ Run now</>
          )}
        </button>
      </div>

      {/* ── Error banner ────────────────────────────────────────────────────── */}
      {runError && (
        <div
          style={{
            background: "rgba(229,84,75,0.1)",
            border: `1px solid rgba(229,84,75,0.3)`,
            borderRadius: 10,
            padding: "10px 16px",
          }}
        >
          <p style={{ fontSize: 13, fontWeight: 600, color: D.red, margin: 0 }}>
            ⚠ {runError}
          </p>
        </div>
      )}

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 20 }}>
        {/* ── Task toggles ──────────────────────────────────────────────────── */}
        <div
          className="card"
          style={{ display: "flex", flexDirection: "column", gap: 14 }}
        >
          <div
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
            }}
          >
            <h2 style={{ fontSize: 14, fontWeight: 700, margin: 0 }}>
              Task Configuration
            </h2>
            <button
              onClick={saveConfig}
              disabled={isPending}
              className="btn btn-ghost"
              style={{ fontSize: 11, padding: "5px 14px" }}
            >
              {isPending ? "Saving…" : configSaved ? "✓ Saved" : "Save"}
            </button>
          </div>
          <p style={{ fontSize: 12, color: D.dim, margin: 0 }}>
            Configure which directives the C-Suite executes each session.
          </p>

          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {ALL_TASKS.map((task) => {
              const active = config.tasks.includes(task.id);
              return (
                <button
                  key={task.id}
                  onClick={() => toggleTask(task.id)}
                  style={{
                    display: "flex",
                    alignItems: "flex-start",
                    gap: 12,
                    padding: "10px 12px",
                    borderRadius: 10,
                    border: `1.5px solid ${active ? D.gold : D.line}`,
                    background: active
                      ? "rgba(212,160,23,0.06)"
                      : "transparent",
                    cursor: "pointer",
                    textAlign: "left",
                  }}
                >
                  <span style={{ fontSize: 16, marginTop: 1 }}>
                    {task.icon}
                  </span>
                  <div style={{ flex: 1 }}>
                    <p
                      style={{
                        fontSize: 13,
                        fontWeight: 600,
                        margin: 0,
                        color: active ? D.gold : D.text,
                      }}
                    >
                      {task.label}
                    </p>
                    <p
                      style={{ fontSize: 11, color: D.dim, margin: "2px 0 0" }}
                    >
                      {task.description}
                    </p>
                  </div>
                  <span
                    style={{
                      width: 18,
                      height: 18,
                      borderRadius: 5,
                      border: `2px solid ${active ? D.gold : D.line}`,
                      background: active ? D.gold : "transparent",
                      flexShrink: 0,
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      fontSize: 10,
                      color: "#0E1726",
                      fontWeight: 800,
                      marginTop: 2,
                    }}
                  >
                    {active ? "✓" : ""}
                  </span>
                </button>
              );
            })}
          </div>
        </div>

        {/* ── Live output stream ────────────────────────────────────────────── */}
        <div
          className="card"
          style={{ display: "flex", flexDirection: "column", gap: 12 }}
        >
          <h2 style={{ fontSize: 14, fontWeight: 700, margin: 0 }}>
            Live Output
          </h2>

          {!isRunning && liveOutputs.length === 0 && (
            <div
              style={{
                flex: 1,
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                justifyContent: "center",
                gap: 10,
                padding: "40px 20px",
                opacity: 0.5,
              }}
            >
              <span style={{ fontSize: 36 }}>⚡</span>
              <p
                style={{
                  fontSize: 13,
                  color: D.dim,
                  textAlign: "center",
                  margin: 0,
                }}
              >
                Hit &ldquo;Run now&rdquo; to execute the full C-Suite briefing
                cycle.
              </p>
            </div>
          )}

          {(isRunning || liveOutputs.length > 0) && (
            <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
              {/* Tasks yet to complete show as pending dots */}
              {isRunning && (
                <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
                  {config.tasks
                    .filter((t) => !liveOutputs.find((o) => o.task === t))
                    .map((t) => {
                      const meta = ALL_TASKS.find((x) => x.id === t);
                      return (
                        <span
                          key={t}
                          style={{
                            fontSize: 11,
                            fontWeight: 600,
                            padding: "3px 10px",
                            borderRadius: 20,
                            border: `1px solid ${D.line}`,
                            color: D.dim,
                            display: "flex",
                            alignItems: "center",
                            gap: 5,
                          }}
                        >
                          <span style={{ animation: "blink 1s infinite" }}>
                            ●
                          </span>
                          {meta?.label ?? t}
                        </span>
                      );
                    })}
                </div>
              )}
              {liveOutputs.map((o) => (
                <TaskOutputCard key={o.task} item={o} />
              ))}
            </div>
          )}
        </div>
      </div>

      {/* ── Run history ───────────────────────────────────────────────────────── */}
      {runs.length > 0 && (
        <div
          className="card"
          style={{ display: "flex", flexDirection: "column", gap: 12 }}
        >
          <h2 style={{ fontSize: 14, fontWeight: 700, margin: 0 }}>
            Run History
          </h2>
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {runs.map((run) => (
              <RunHistoryItem key={run.id} run={run} />
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
