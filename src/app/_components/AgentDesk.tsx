"use client";

import { motion } from "framer-motion";
import Link from "next/link";
import { AGENTS, type AgentRole } from "@/lib/prompts";

type AgentDeskProps = {
  role: AgentRole;
  lastActive: string | null;
  msgCount: number;
  isActive?: boolean;     // currently running a task
  activeTask?: string;    // e.g. "Analyzing P&L..."
};

export function AgentDesk({ role, lastActive, msgCount, isActive, activeTask }: AgentDeskProps) {
  const agent = AGENTS[role];
  const grad = `linear-gradient(135deg, ${agent.gradient[0]}, ${agent.gradient[1]})`;
  const onLight = role === "ceo";

  return (
    <Link href={`/agent/${role}`} style={{ textDecoration: "none" }}>
      <motion.div
        style={{
          position: "relative",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          gap: 8,
          padding: "24px 16px 20px",
          borderRadius: 16,
          background: "var(--panel)",
          border: isActive ? "2px solid var(--accent)" : "1px solid var(--line)",
          cursor: "pointer",
          overflow: "visible",
          minWidth: 140,
        }}
        whileHover={{ scale: 1.05, y: -4 }}
        transition={{ type: "spring", stiffness: 300, damping: 20 }}
      >
        {/* Desk surface */}
        <div style={{
          position: "absolute", bottom: 0, left: "10%", right: "10%", height: 6,
          background: "var(--panel2)", borderRadius: "0 0 8px 8px",
        }} />

        {/* Avatar with idle float animation */}
        <motion.div
          animate={isActive
            ? { scale: [1, 1.08, 1], boxShadow: [`0 0 0 0 ${agent.gradient[0]}40`, `0 0 0 10px ${agent.gradient[0]}00`] }
            : { y: [0, -4, 0] }
          }
          transition={isActive
            ? { duration: 1.2, repeat: Infinity, ease: "easeInOut" }
            : { duration: 3, repeat: Infinity, ease: "easeInOut" }
          }
          style={{
            width: 56,
            height: 56,
            borderRadius: 16,
            background: grad,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            fontWeight: 700,
            fontSize: 22,
            color: onLight ? "#1E2761" : "#fff",
            boxShadow: isActive ? `0 0 20px ${agent.gradient[0]}40` : "none",
          }}
        >
          {agent.name[0]}
        </motion.div>

        {/* Name + title */}
        <div style={{ textAlign: "center" }}>
          <p style={{ margin: 0, fontWeight: 700, fontSize: 14, color: "var(--ink)" }}>
            {agent.name}
          </p>
          <p style={{ margin: "1px 0 0", fontSize: 10, color: "var(--muted)", fontWeight: 600 }}>
            {agent.title.replace("AI ", "")}
          </p>
        </div>

        {/* Activity bubble */}
        {isActive && activeTask ? (
          <motion.div
            initial={{ opacity: 0, scale: 0.8, y: 10 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            style={{
              position: "absolute",
              top: -12,
              left: "50%",
              transform: "translateX(-50%)",
              background: "var(--accent)",
              color: "#fff",
              fontSize: 10,
              fontWeight: 600,
              padding: "3px 10px",
              borderRadius: 20,
              whiteSpace: "nowrap",
              boxShadow: "0 2px 8px rgba(0,0,0,0.3)",
            }}
          >
            {activeTask}
          </motion.div>
        ) : null}

        {/* Stats badge */}
        <div style={{
          display: "flex", gap: 8, alignItems: "center",
          fontSize: 10, color: "var(--muted)",
        }}>
          <span>{msgCount} msgs</span>
          {lastActive && (
            <span>· {new Date(lastActive).toLocaleDateString("en-MY", { day: "numeric", month: "short" })}</span>
          )}
        </div>

        {/* Typing indicator when active */}
        {isActive && (
          <div style={{ display: "flex", gap: 3, marginTop: 4 }}>
            {[0, 1, 2].map((i) => (
              <motion.span
                key={i}
                animate={{ opacity: [0.3, 1, 0.3] }}
                transition={{ duration: 0.8, repeat: Infinity, delay: i * 0.2 }}
                style={{
                  width: 5, height: 5, borderRadius: "50%",
                  background: agent.gradient[0],
                }}
              />
            ))}
          </div>
        )}
      </motion.div>
    </Link>
  );
}
