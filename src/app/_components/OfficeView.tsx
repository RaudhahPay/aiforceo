"use client";

import { motion, AnimatePresence } from "framer-motion";
import Link from "next/link";
import { AGENTS, type AgentRole } from "@/lib/prompts";
import { useState, useEffect } from "react";

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
  ownerInitial?: string;       // first letter of owner's name/email
  ownerName?: string;          // displayed on hover
  activeAgentTasks?: Record<string, string>;
};

// Each agent's home desk position + wander radius (percentage-based on the image)
const DESK_POSITIONS: Record<AgentRole, { top: number; left: number; wanderRadius: number }> = {
  aria:  { top: 72, left: 38, wanderRadius: 4 },      // Reception area
  cmo:   { top: 18, left: 12, wanderRadius: 5 },      // Top-left open desks
  coo:   { top: 32, left: 15, wanderRadius: 5 },      // Left open desks row 2
  cfo:   { top: 52, left: 72, wanderRadius: 4 },      // Right side desks
  ceo:   { top: 40, left: 42, wanderRadius: 3 },      // Center conference room
  cto:   { top: 20, left: 78, wanderRadius: 4 },      // Top-right focus room
};

// The Boss position (top of the conference room / corner office)
const BOSS_POSITION = { top: 55, left: 42 };

/** Generate a random offset within the wander radius */
function randomOffset(radius: number): { x: number; y: number } {
  const angle = Math.random() * Math.PI * 2;
  const dist = Math.random() * radius;
  return { x: Math.cos(angle) * dist, y: Math.sin(angle) * dist };
}

/** Agent avatar that wanders around its desk */
function WanderingAgent({
  role,
  stat,
  isActive,
  activeTask,
  isHovered,
  onHover,
  onLeave,
}: {
  role: AgentRole;
  stat: AgentStat;
  isActive: boolean;
  activeTask?: string;
  isHovered: boolean;
  onHover: () => void;
  onLeave: () => void;
}) {
  const pos = DESK_POSITIONS[role];
  const agent = AGENTS[role];
  const grad = `linear-gradient(135deg, ${agent.gradient[0]}, ${agent.gradient[1]})`;

  // Wandering animation — move to a new random position every 3-5 seconds
  const [wanderTarget, setWanderTarget] = useState({ x: 0, y: 0 });

  useEffect(() => {
    const interval = setInterval(() => {
      if (!isActive) {
        setWanderTarget(randomOffset(pos.wanderRadius));
      } else {
        setWanderTarget({ x: 0, y: 0 }); // Stay at desk when working
      }
    }, 3000 + Math.random() * 2000);

    return () => clearInterval(interval);
  }, [isActive, pos.wanderRadius]);

  return (
    <Link href={`/agent/${role}`} style={{ textDecoration: "none" }}>
      <motion.div
        onHoverStart={onHover}
        onHoverEnd={onLeave}
        animate={{
          top: `${pos.top + wanderTarget.y}%`,
          left: `${pos.left + wanderTarget.x}%`,
        }}
        transition={{ duration: 2, ease: "easeInOut" }}
        style={{
          position: "absolute",
          transform: "translate(-50%, -50%)",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          cursor: "pointer",
          zIndex: isHovered ? 30 : 10,
        }}
      >
        {/* Tooltip bubble */}
        <AnimatePresence>
          {(isActive || isHovered) && (
            <motion.div
              initial={{ opacity: 0, y: 6, scale: 0.85 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 6, scale: 0.85 }}
              style={{
                background: isActive ? agent.gradient[0] : "rgba(0,0,0,0.85)",
                color: "#fff",
                fontSize: 11,
                fontWeight: 600,
                padding: "6px 12px",
                borderRadius: 10,
                marginBottom: 6,
                whiteSpace: "nowrap",
                boxShadow: "0 4px 16px rgba(0,0,0,0.5)",
                textAlign: "center",
                maxWidth: 180,
                backdropFilter: "blur(8px)",
              }}
            >
              {isActive
                ? `🔄 ${activeTask}`
                : (
                  <>
                    <strong>{agent.name}</strong> · {agent.title.replace("AI ", "")}
                    <br />
                    <span style={{ fontSize: 9, opacity: 0.7 }}>
                      {stat?.msgCountMtd ?? 0} msgs this month
                      {stat?.lastActive ? ` · Active ${new Date(stat.lastActive).toLocaleDateString("en-MY", { day: "numeric", month: "short" })}` : ""}
                    </span>
                  </>
                )
              }
              {/* Tooltip arrow */}
              <div style={{
                position: "absolute", bottom: -4, left: "50%", transform: "translateX(-50%)",
                width: 8, height: 8, background: isActive ? agent.gradient[0] : "rgba(0,0,0,0.85)",
                rotate: "45deg",
              }} />
            </motion.div>
          )}
        </AnimatePresence>

        {/* Black shadow backdrop behind the entire agent */}
        <div style={{
          position: "absolute",
          top: "50%",
          left: "50%",
          transform: "translate(-50%, -50%)",
          width: 90,
          height: 100,
          borderRadius: 20,
          background: "rgba(0,0,0,0.75)",
          filter: "blur(8px)",
          zIndex: -1,
        }} />

        {/* Agent avatar — 30% larger with high-contrast border */}
        <motion.div
          animate={isActive
            ? { scale: [1, 1.12, 1], boxShadow: [`0 0 0 0 ${agent.gradient[0]}80`, `0 0 0 16px ${agent.gradient[0]}00`] }
            : {}
          }
          transition={isActive ? { duration: 1.2, repeat: Infinity } : {}}
          whileHover={{ scale: 1.15 }}
          style={{
            width: 68,
            height: 68,
            borderRadius: 18,
            background: grad,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            fontWeight: 800,
            fontSize: 26,
            color: role === "ceo" ? "#1E2761" : "#fff",
            border: "3px solid rgba(255,255,255,0.95)",
            boxShadow: isActive
              ? `0 0 30px ${agent.gradient[0]}80, 0 6px 20px rgba(0,0,0,0.6)`
              : "0 6px 20px rgba(0,0,0,0.6), 0 0 0 1px rgba(0,0,0,0.3)",
          }}
        >
          {agent.name[0]}
        </motion.div>

        {/* Name tag */}
        <div style={{
          marginTop: 5,
          fontSize: 11,
          fontWeight: 800,
          color: "#fff",
          textAlign: "center",
          letterSpacing: "0.03em",
          background: "rgba(0,0,0,0.7)",
          padding: "2px 10px",
          borderRadius: 8,
          boxShadow: "0 2px 8px rgba(0,0,0,0.5)",
        }}>
          {agent.name}
        </div>

        {/* Typing dots when active */}
        {isActive && (
          <div style={{ display: "flex", gap: 3, marginTop: 3 }}>
            {[0, 1, 2].map((i) => (
              <motion.span
                key={i}
                animate={{ opacity: [0.3, 1, 0.3], scale: [0.8, 1.2, 0.8] }}
                transition={{ duration: 0.7, repeat: Infinity, delay: i * 0.15 }}
                style={{ width: 5, height: 5, borderRadius: "50%", background: "#fff" }}
              />
            ))}
          </div>
        )}
      </motion.div>
    </Link>
  );
}

export function OfficeView({ agentStats, workspaceName, ownerInitial, ownerName, activeAgentTasks = {} }: Props) {
  const [hoveredAgent, setHoveredAgent] = useState<AgentRole | null>(null);
  const [hoveredBoss, setHoveredBoss] = useState(false);
  const activeCount = Object.keys(activeAgentTasks).length;

  // Boss wander
  const [bossWander, setBossWander] = useState({ x: 0, y: 0 });
  useEffect(() => {
    const interval = setInterval(() => {
      setBossWander(randomOffset(3));
    }, 4000);
    return () => clearInterval(interval);
  }, []);

  return (
    <div style={{ width: "100%", padding: "16px 0" }}>
      {/* Header */}
      <motion.div
        initial={{ opacity: 0, y: -10 }}
        animate={{ opacity: 1, y: 0 }}
        style={{ textAlign: "center", marginBottom: 12 }}
      >
        <p style={{ fontSize: 11, color: "var(--accent)", fontWeight: 700, letterSpacing: "0.12em", textTransform: "uppercase", margin: "0 0 2px" }}>
          🏢 {workspaceName} HQ
        </p>
        <p style={{ fontSize: 12, color: "var(--muted)", margin: 0 }}>
          {activeCount > 0
            ? `${activeCount} executive${activeCount > 1 ? "s" : ""} working • Click any agent to chat`
            : "All executives on standby • Click any agent to chat"
          }
        </p>
      </motion.div>

      {/* Office map */}
      <div style={{
        position: "relative",
        width: "100%",
        maxWidth: 900,
        margin: "0 auto",
        borderRadius: 16,
        overflow: "hidden",
        border: "2px solid var(--line)",
        boxShadow: "0 8px 40px rgba(0,0,0,0.5)",
      }}>
        {/* Background */}
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src="/office-bg.png"
          alt="AI Executive Office"
          style={{ width: "100%", height: "auto", display: "block" }}
        />

        {/* Agent hotspots */}
        {ROLES.map((role) => (
          <WanderingAgent
            key={role}
            role={role}
            stat={agentStats[role]}
            isActive={!!activeAgentTasks[role]}
            activeTask={activeAgentTasks[role]}
            isHovered={hoveredAgent === role}
            onHover={() => setHoveredAgent(role)}
            onLeave={() => setHoveredAgent(null)}
          />
        ))}

        {/* The Boss (logged-in user) */}
        {ownerInitial && (
          <motion.div
            onHoverStart={() => setHoveredBoss(true)}
            onHoverEnd={() => setHoveredBoss(false)}
            animate={{
              top: `${BOSS_POSITION.top + bossWander.y}%`,
              left: `${BOSS_POSITION.left + bossWander.x}%`,
            }}
            transition={{ duration: 2.5, ease: "easeInOut" }}
            style={{
              position: "absolute",
              transform: "translate(-50%, -50%)",
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              zIndex: hoveredBoss ? 30 : 15,
            }}
          >
            {/* Boss tooltip */}
            <AnimatePresence>
              {hoveredBoss && (
                <motion.div
                  initial={{ opacity: 0, y: 6, scale: 0.85 }}
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  exit={{ opacity: 0, y: 6, scale: 0.85 }}
                  style={{
                    background: "rgba(0,0,0,0.85)",
                    color: "#fff",
                    fontSize: 11,
                    fontWeight: 600,
                    padding: "6px 12px",
                    borderRadius: 10,
                    marginBottom: 6,
                    whiteSpace: "nowrap",
                    boxShadow: "0 4px 16px rgba(0,0,0,0.5)",
                  }}
                >
                  👑 {ownerName ?? "The Boss"} · Online
                </motion.div>
              )}
            </AnimatePresence>

            {/* Black shadow backdrop behind boss */}
            <div style={{
              position: "absolute",
              top: "50%",
              left: "50%",
              transform: "translate(-50%, -50%)",
              width: 85,
              height: 95,
              borderRadius: 20,
              background: "rgba(0,0,0,0.75)",
              filter: "blur(8px)",
              zIndex: -1,
            }} />

            {/* Boss avatar — 30% larger */}
            <motion.div
              animate={{ y: [0, -3, 0] }}
              transition={{ duration: 3, repeat: Infinity, ease: "easeInOut" }}
              whileHover={{ scale: 1.15 }}
              style={{
                width: 62,
                height: 62,
                borderRadius: "50%",
                background: "linear-gradient(135deg, #FFD700, #FFA500)",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                fontWeight: 800,
                fontSize: 24,
                color: "#1E2761",
                border: "3px solid rgba(255,255,255,0.95)",
                boxShadow: "0 0 24px rgba(255,215,0,0.5), 0 6px 20px rgba(0,0,0,0.6)",
                cursor: "default",
              }}
            >
              {ownerInitial}
            </motion.div>

            {/* Boss label */}
            <div style={{
              marginTop: 5,
              fontSize: 11,
              fontWeight: 800,
              color: "#FFD700",
              background: "rgba(0,0,0,0.7)",
              padding: "2px 10px",
              borderRadius: 8,
              boxShadow: "0 2px 8px rgba(0,0,0,0.5)",
            }}>
              👑 BOSS
            </div>
          </motion.div>
        )}
      </div>

      {/* Legend */}
      <div style={{
        display: "flex",
        justifyContent: "center",
        gap: 14,
        marginTop: 14,
        flexWrap: "wrap",
      }}>
        {ROLES.map((role) => {
          const agent = AGENTS[role];
          const stat = agentStats[role];
          return (
            <Link
              key={role}
              href={`/agent/${role}`}
              style={{
                display: "flex", alignItems: "center", gap: 5,
                fontSize: 11, color: "var(--muted)", textDecoration: "none",
                padding: "3px 8px", borderRadius: 6,
                background: "var(--panel)",
                border: "1px solid var(--line)",
              }}
            >
              <span style={{
                width: 10, height: 10, borderRadius: 4,
                background: `linear-gradient(135deg, ${agent.gradient[0]}, ${agent.gradient[1]})`,
                border: "1px solid rgba(255,255,255,0.3)",
              }} />
              <span style={{ fontWeight: 600 }}>{agent.name}</span>
              <span style={{ fontSize: 10, opacity: 0.5 }}>
                {stat?.msgCountMtd ?? 0}
              </span>
            </Link>
          );
        })}
      </div>
    </div>
  );
}
