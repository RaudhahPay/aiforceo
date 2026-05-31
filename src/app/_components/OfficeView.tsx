"use client";

import { motion } from "framer-motion";
import type { AgentRole } from "@/lib/prompts";
import { AgentDesk } from "./AgentDesk";

const ROLES: AgentRole[] = ["aria", "cmo", "coo", "cfo", "ceo", "cto"];

type AgentStat = {
  convCount: number;
  msgCountMtd: number;
  lastActive: string | null;
  lastContent: string | null;
};

type Props = {
  agentStats: Record<AgentRole, AgentStat>;
  workspaceName: string;
  activeAgentTasks?: Record<string, string>; // { role: "task description" }
};

export function OfficeView({ agentStats, workspaceName, activeAgentTasks = {} }: Props) {
  const activeCount = Object.keys(activeAgentTasks).length;

  return (
    <div style={{
      minHeight: "100vh",
      background: "var(--bg)",
      padding: "24px",
    }}>
      {/* Office header */}
      <motion.div
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        style={{
          textAlign: "center",
          marginBottom: 32,
        }}
      >
        <p style={{ fontSize: 11, color: "var(--accent)", fontWeight: 700, letterSpacing: "0.1em", textTransform: "uppercase", margin: "0 0 4px" }}>
          🏢 Virtual Office
        </p>
        <h2 className="serif" style={{ fontSize: 28, margin: "0 0 4px" }}>
          {workspaceName}
        </h2>
        <p style={{ fontSize: 12, color: "var(--muted)", margin: 0 }}>
          {activeCount > 0
            ? `${activeCount} executive${activeCount > 1 ? "s" : ""} working right now`
            : "All executives standing by"
          }
        </p>
      </motion.div>

      {/* Office floor plan — isometric grid */}
      <div style={{
        display: "flex",
        justifyContent: "center",
        perspective: "1000px",
      }}>
        <motion.div
          initial={{ opacity: 0, rotateX: 15 }}
          animate={{ opacity: 1, rotateX: 0 }}
          transition={{ duration: 0.6 }}
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(3, 1fr)",
            gap: 20,
            maxWidth: 600,
            width: "100%",
          }}
        >
          {ROLES.map((role, i) => {
            const stat = agentStats[role];
            return (
              <motion.div
                key={role}
                initial={{ opacity: 0, y: 30 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.1 }}
              >
                <AgentDesk
                  role={role}
                  lastActive={stat?.lastActive ?? null}
                  msgCount={stat?.msgCountMtd ?? 0}
                  isActive={!!activeAgentTasks[role]}
                  activeTask={activeAgentTasks[role]}
                />
              </motion.div>
            );
          })}
        </motion.div>
      </div>

      {/* Office ambiance — floor grid lines */}
      <div style={{
        position: "fixed",
        bottom: 0,
        left: 0,
        right: 0,
        height: 200,
        background: "linear-gradient(to top, var(--panel) 0%, transparent 100%)",
        pointerEvents: "none",
        opacity: 0.3,
      }} />
    </div>
  );
}
