"use client";

import { motion, AnimatePresence } from "framer-motion";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { AGENTS, type AgentRole } from "@/lib/prompts";
import { useState, useEffect, useCallback } from "react";

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
  ownerInitial?: string;
  ownerName?: string;
  activeAgentTasks?: Record<string, string>;
};

// Office zones — agents can be moved between these
const ZONES = {
  "desk":       { label: "Their Desk", icon: "💻" },
  "pantry":     { label: "Pantry",     icon: "☕" },
  "lounge":     { label: "Lounge",     icon: "🛋️" },
  "meeting":    { label: "Meeting Room", icon: "📋" },
  "focus":      { label: "Focus Room", icon: "🎯" },
} as const;

type ZoneKey = keyof typeof ZONES;

// Zone positions on the image (percentage-based)
const ZONE_POSITIONS: Record<ZoneKey, { top: number; left: number }> = {
  desk:    { top: 0, left: 0 }, // placeholder — each agent has their own desk
  pantry:  { top: 12, left: 45 },
  lounge:  { top: 22, left: 58 },
  meeting: { top: 42, left: 42 },
  focus:   { top: 18, left: 82 },
};

// Default desk positions per agent
const DESK_POSITIONS: Record<AgentRole, { top: number; left: number; wanderRadius: number }> = {
  aria:  { top: 72, left: 38, wanderRadius: 3 },
  cmo:   { top: 18, left: 12, wanderRadius: 4 },
  coo:   { top: 32, left: 15, wanderRadius: 4 },
  cfo:   { top: 52, left: 72, wanderRadius: 3 },
  ceo:   { top: 40, left: 42, wanderRadius: 2 },
  cto:   { top: 20, left: 78, wanderRadius: 3 },
};

const BOSS_POSITION = { top: 55, left: 42 };
const MEETING_SCREEN = { top: 38, left: 42 }; // Big screen in meeting room

function randomOffset(radius: number) {
  const angle = Math.random() * Math.PI * 2;
  const dist = Math.random() * radius;
  return { x: Math.cos(angle) * dist, y: Math.sin(angle) * dist };
}

// ── Context Menu ──────────────────────────────────────────────────
function AgentContextMenu({
  role, x, y, onClose, onChat, onMove, onMeeting, showMeeting,
}: {
  role: AgentRole; x: number; y: number;
  onClose: () => void; onChat: () => void;
  onMove: (zone: ZoneKey) => void;
  onMeeting: () => void; showMeeting: boolean;
}) {
  const agent = AGENTS[role];
  return (
    <>
      <div onClick={onClose} style={{ position: "fixed", inset: 0, zIndex: 98 }} />
      <motion.div
        initial={{ opacity: 0, scale: 0.9, y: 10 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.9 }}
        style={{
          position: "absolute", top: y, left: x, zIndex: 99,
          background: "rgba(0,0,0,0.92)", backdropFilter: "blur(12px)",
          border: "1px solid rgba(255,255,255,0.15)",
          borderRadius: 14, padding: "8px 4px", minWidth: 180,
          boxShadow: "0 8px 32px rgba(0,0,0,0.6)",
        }}
      >
        {/* Header */}
        <div style={{ padding: "4px 12px 8px", borderBottom: "1px solid rgba(255,255,255,0.1)", marginBottom: 4 }}>
          <span style={{ fontSize: 12, fontWeight: 700, color: "#fff" }}>{agent.name}</span>
          <span style={{ fontSize: 10, color: "rgba(255,255,255,0.5)", marginLeft: 6 }}>{agent.title.replace("AI ", "")}</span>
        </div>

        {/* Chat */}
        <MenuItem icon="💬" label="Chat" onClick={onChat} />

        {/* Move submenu */}
        <div style={{ padding: "2px 12px", fontSize: 9, color: "rgba(255,255,255,0.35)", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.1em", marginTop: 4 }}>
          Move to
        </div>
        {(Object.entries(ZONES) as [ZoneKey, typeof ZONES[ZoneKey]][]).map(([key, zone]) => (
          <MenuItem key={key} icon={zone.icon} label={zone.label} onClick={() => onMove(key)} />
        ))}

        {/* Meeting (only for Aria / Boss) */}
        {showMeeting && (
          <>
            <div style={{ borderTop: "1px solid rgba(255,255,255,0.1)", margin: "4px 0" }} />
            <MenuItem icon="📋" label="Call C-Suite Meeting" onClick={onMeeting} accent />
          </>
        )}
      </motion.div>
    </>
  );
}

function MenuItem({ icon, label, onClick, accent }: { icon: string; label: string; onClick: () => void; accent?: boolean }) {
  return (
    <button
      onClick={onClick}
      style={{
        display: "flex", alignItems: "center", gap: 8, width: "100%",
        padding: "7px 12px", background: "transparent", border: "none",
        cursor: "pointer", color: accent ? "#FFD700" : "#fff", fontSize: 12,
        fontWeight: accent ? 700 : 500, borderRadius: 8, textAlign: "left",
      }}
      onMouseEnter={(e) => { e.currentTarget.style.background = "rgba(255,255,255,0.1)"; }}
      onMouseLeave={(e) => { e.currentTarget.style.background = "transparent"; }}
    >
      <span style={{ fontSize: 14 }}>{icon}</span>
      {label}
    </button>
  );
}

// ── Wandering Agent ───────────────────────────────────────────────
function WanderingAgent({
  role, stat, isActive, activeTask, currentZone, onContextMenu,
}: {
  role: AgentRole; stat: AgentStat; isActive: boolean; activeTask?: string;
  currentZone: ZoneKey; onContextMenu: (e: React.MouseEvent) => void;
}) {
  const agent = AGENTS[role];
  const grad = `linear-gradient(135deg, ${agent.gradient[0]}, ${agent.gradient[1]})`;

  // Position based on current zone
  const basePos = currentZone === "desk"
    ? DESK_POSITIONS[role]
    : { ...ZONE_POSITIONS[currentZone], wanderRadius: 3 };
  const wanderRadius = "wanderRadius" in basePos ? basePos.wanderRadius : 3;

  const [wander, setWander] = useState({ x: 0, y: 0 });
  const [showLabel, setShowLabel] = useState(false);

  useEffect(() => {
    const iv = setInterval(() => {
      if (!isActive) setWander(randomOffset(wanderRadius));
      else setWander({ x: 0, y: 0 });
    }, 3000 + Math.random() * 2000);
    return () => clearInterval(iv);
  }, [isActive, wanderRadius]);

  return (
    <motion.div
      onHoverStart={() => setShowLabel(true)}
      onHoverEnd={() => setShowLabel(false)}
      onClick={onContextMenu}
      animate={{ top: `${basePos.top + wander.y}%`, left: `${basePos.left + wander.x}%` }}
      transition={{ duration: 2, ease: "easeInOut" }}
      style={{
        position: "absolute", transform: "translate(-50%, -50%)",
        display: "flex", flexDirection: "column", alignItems: "center",
        cursor: "pointer", zIndex: showLabel ? 30 : 10,
      }}
    >
      {/* Tooltip */}
      <AnimatePresence>
        {(isActive || showLabel) && (
          <motion.div
            initial={{ opacity: 0, y: 6, scale: 0.85 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 6, scale: 0.85 }}
            style={{
              background: isActive ? agent.gradient[0] : "rgba(0,0,0,0.88)",
              color: "#fff", fontSize: 11, fontWeight: 600,
              padding: "5px 12px", borderRadius: 10, marginBottom: 6,
              whiteSpace: "nowrap", boxShadow: "0 4px 16px rgba(0,0,0,0.5)",
              textAlign: "center",
            }}
          >
            {isActive ? `🔄 ${activeTask}` : `${agent.name} · ${currentZone === "desk" ? agent.title.replace("AI ", "") : ZONES[currentZone].label}`}
          </motion.div>
        )}
      </AnimatePresence>

      {/* Shadow backdrop */}
      <div style={{
        position: "absolute", top: "50%", left: "50%",
        transform: "translate(-50%, -50%)", width: 90, height: 100,
        borderRadius: 20, background: "rgba(0,0,0,0.75)", filter: "blur(8px)", zIndex: -1,
      }} />

      {/* Avatar */}
      <motion.div
        animate={isActive ? { scale: [1, 1.12, 1] } : {}}
        transition={isActive ? { duration: 1.2, repeat: Infinity } : {}}
        whileHover={{ scale: 1.12 }}
        style={{
          width: 68, height: 68, borderRadius: 18, background: grad,
          display: "flex", alignItems: "center", justifyContent: "center",
          fontWeight: 800, fontSize: 26, color: role === "ceo" ? "#1E2761" : "#fff",
          border: "3px solid rgba(255,255,255,0.95)",
          boxShadow: isActive
            ? `0 0 30px ${agent.gradient[0]}80, 0 6px 20px rgba(0,0,0,0.6)`
            : "0 6px 20px rgba(0,0,0,0.6)",
        }}
      >
        {agent.name[0]}
      </motion.div>

      {/* Name tag */}
      <div style={{
        marginTop: 5, fontSize: 11, fontWeight: 800, color: "#fff",
        background: "rgba(0,0,0,0.7)", padding: "2px 10px", borderRadius: 8,
        boxShadow: "0 2px 8px rgba(0,0,0,0.5)",
      }}>
        {agent.name}
      </div>

      {/* Typing dots when active */}
      {isActive && (
        <div style={{ display: "flex", gap: 3, marginTop: 3 }}>
          {[0, 1, 2].map((i) => (
            <motion.span key={i}
              animate={{ opacity: [0.3, 1, 0.3], scale: [0.8, 1.2, 0.8] }}
              transition={{ duration: 0.7, repeat: Infinity, delay: i * 0.15 }}
              style={{ width: 5, height: 5, borderRadius: "50%", background: "#fff" }}
            />
          ))}
        </div>
      )}
    </motion.div>
  );
}

// ── Main Office View ──────────────────────────────────────────────
export function OfficeView({ agentStats, workspaceName, ownerInitial, ownerName, activeAgentTasks = {} }: Props) {
  const router = useRouter();
  const [agentZones, setAgentZones] = useState<Record<AgentRole, ZoneKey>>(
    Object.fromEntries(ROLES.map((r) => [r, "desk" as ZoneKey])) as Record<AgentRole, ZoneKey>
  );
  const [contextMenu, setContextMenu] = useState<{ role: AgentRole | "boss"; x: number; y: number } | null>(null);
  const [hoveredBoss, setHoveredBoss] = useState(false);
  const [bossWander, setBossWander] = useState({ x: 0, y: 0 });

  const activeCount = Object.keys(activeAgentTasks).length;

  useEffect(() => {
    const iv = setInterval(() => setBossWander(randomOffset(3)), 4000);
    return () => clearInterval(iv);
  }, []);

  const moveAgent = useCallback((role: AgentRole, zone: ZoneKey) => {
    setAgentZones((prev) => ({ ...prev, [role]: zone }));
    setContextMenu(null);
  }, []);

  const callMeeting = useCallback(() => {
    // Move all agents to meeting room
    setAgentZones(Object.fromEntries(ROLES.map((r) => [r, "meeting" as ZoneKey])) as Record<AgentRole, ZoneKey>);
    setContextMenu(null);
    // Navigate to Aria chat for group meeting
    setTimeout(() => router.push("/agent/aria?meeting=true"), 800);
  }, [router]);

  const handleAgentContext = useCallback((role: AgentRole, e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    const rect = (e.currentTarget as HTMLElement).closest("[data-office-map]")?.getBoundingClientRect();
    const x = e.clientX - (rect?.left ?? 0);
    const y = e.clientY - (rect?.top ?? 0);
    setContextMenu({ role, x: Math.min(x, (rect?.width ?? 800) - 200), y: Math.min(y, (rect?.height ?? 600) - 300) });
  }, []);

  return (
    <div style={{ width: "100%", padding: "16px 0" }}>
      {/* Header */}
      <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }}
        style={{ textAlign: "center", marginBottom: 12 }}>
        <p style={{ fontSize: 11, color: "var(--accent)", fontWeight: 700, letterSpacing: "0.12em", textTransform: "uppercase", margin: "0 0 2px" }}>
          🏢 {workspaceName} HQ
        </p>
        <p style={{ fontSize: 12, color: "var(--muted)", margin: 0 }}>
          {activeCount > 0
            ? `${activeCount} executive${activeCount > 1 ? "s" : ""} working`
            : "Click any agent for options • Click the big screen for Dashboard"
          }
        </p>
      </motion.div>

      {/* Office map */}
      <div data-office-map style={{
        position: "relative", width: "100%", maxWidth: 900, margin: "0 auto",
        borderRadius: 16, overflow: "hidden", border: "2px solid var(--line)",
        boxShadow: "0 8px 40px rgba(0,0,0,0.5)",
      }}>
        {/* Background */}
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/office-bg.png" alt="AI Executive Office"
          style={{ width: "100%", height: "auto", display: "block" }} />

        {/* Big screen in meeting room → Dashboard */}
        <Link href="/dashboard" style={{ textDecoration: "none" }}>
          <motion.div
            whileHover={{ scale: 1.05, boxShadow: "0 0 30px rgba(24,119,242,0.5)" }}
            style={{
              position: "absolute",
              top: `${MEETING_SCREEN.top}%`, left: `${MEETING_SCREEN.left}%`,
              transform: "translate(-50%, -50%)",
              width: "12%", height: "8%",
              borderRadius: 6,
              cursor: "pointer",
              zIndex: 5,
            }}
            title="Open Dashboard"
          />
        </Link>

        {/* Agent hotspots */}
        {ROLES.map((role) => (
          <WanderingAgent
            key={role} role={role} stat={agentStats[role]}
            isActive={!!activeAgentTasks[role]}
            activeTask={activeAgentTasks[role]}
            currentZone={agentZones[role]}
            onContextMenu={(e) => handleAgentContext(role, e)}
          />
        ))}

        {/* The Boss */}
        {ownerInitial && (
          <motion.div
            onHoverStart={() => setHoveredBoss(true)}
            onHoverEnd={() => setHoveredBoss(false)}
            onClick={(e) => {
              e.stopPropagation();
              const rect = (e.currentTarget as HTMLElement).closest("[data-office-map]")?.getBoundingClientRect();
              setContextMenu({ role: "boss", x: (e.clientX - (rect?.left ?? 0)), y: (e.clientY - (rect?.top ?? 0)) });
            }}
            animate={{ top: `${BOSS_POSITION.top + bossWander.y}%`, left: `${BOSS_POSITION.left + bossWander.x}%` }}
            transition={{ duration: 2.5, ease: "easeInOut" }}
            style={{
              position: "absolute", transform: "translate(-50%, -50%)",
              display: "flex", flexDirection: "column", alignItems: "center",
              zIndex: hoveredBoss ? 30 : 15, cursor: "pointer",
            }}
          >
            <AnimatePresence>
              {hoveredBoss && (
                <motion.div initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 6 }}
                  style={{ background: "rgba(0,0,0,0.88)", color: "#fff", fontSize: 11, fontWeight: 600,
                    padding: "5px 12px", borderRadius: 10, marginBottom: 6, whiteSpace: "nowrap",
                    boxShadow: "0 4px 16px rgba(0,0,0,0.5)" }}>
                  👑 {ownerName ?? "The Boss"} · Online
                </motion.div>
              )}
            </AnimatePresence>

            <div style={{ position: "absolute", top: "50%", left: "50%", transform: "translate(-50%, -50%)",
              width: 85, height: 95, borderRadius: 20, background: "rgba(0,0,0,0.75)", filter: "blur(8px)", zIndex: -1 }} />

            <motion.div
              animate={{ y: [0, -3, 0] }}
              transition={{ duration: 3, repeat: Infinity, ease: "easeInOut" }}
              whileHover={{ scale: 1.12 }}
              style={{
                width: 62, height: 62, borderRadius: "50%",
                background: "linear-gradient(135deg, #FFD700, #FFA500)",
                display: "flex", alignItems: "center", justifyContent: "center",
                fontWeight: 800, fontSize: 24, color: "#1E2761",
                border: "3px solid rgba(255,255,255,0.95)",
                boxShadow: "0 0 24px rgba(255,215,0,0.5), 0 6px 20px rgba(0,0,0,0.6)",
              }}
            >
              {ownerInitial}
            </motion.div>

            <div style={{ marginTop: 5, fontSize: 11, fontWeight: 800, color: "#FFD700",
              background: "rgba(0,0,0,0.7)", padding: "2px 10px", borderRadius: 8,
              boxShadow: "0 2px 8px rgba(0,0,0,0.5)" }}>
              👑 BOSS
            </div>
          </motion.div>
        )}

        {/* Context Menu */}
        <AnimatePresence>
          {contextMenu && contextMenu.role !== "boss" && (
            <AgentContextMenu
              role={contextMenu.role as AgentRole}
              x={contextMenu.x} y={contextMenu.y}
              onClose={() => setContextMenu(null)}
              onChat={() => { setContextMenu(null); router.push(`/agent/${contextMenu.role}`); }}
              onMove={(zone) => moveAgent(contextMenu.role as AgentRole, zone)}
              onMeeting={callMeeting}
              showMeeting={contextMenu.role === "aria"}
            />
          )}
          {contextMenu && contextMenu.role === "boss" && (
            <>
              <div onClick={() => setContextMenu(null)} style={{ position: "fixed", inset: 0, zIndex: 98 }} />
              <motion.div
                initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.9 }}
                style={{
                  position: "absolute", top: contextMenu.y, left: contextMenu.x, zIndex: 99,
                  background: "rgba(0,0,0,0.92)", backdropFilter: "blur(12px)",
                  border: "1px solid rgba(255,215,0,0.3)", borderRadius: 14,
                  padding: "8px 4px", minWidth: 180, boxShadow: "0 8px 32px rgba(0,0,0,0.6)",
                }}
              >
                <div style={{ padding: "4px 12px 8px", borderBottom: "1px solid rgba(255,255,255,0.1)", marginBottom: 4 }}>
                  <span style={{ fontSize: 12, fontWeight: 700, color: "#FFD700" }}>👑 {ownerName ?? "The Boss"}</span>
                </div>
                <MenuItem icon="📊" label="Open Dashboard" onClick={() => { setContextMenu(null); router.push("/dashboard"); }} />
                <MenuItem icon="📋" label="Call C-Suite Meeting" onClick={callMeeting} accent />
                <MenuItem icon="📂" label="Document Vault" onClick={() => { setContextMenu(null); router.push("/documents"); }} />
                <MenuItem icon="⚙" label="Settings" onClick={() => { setContextMenu(null); router.push("/settings"); }} />
              </motion.div>
            </>
          )}
        </AnimatePresence>
      </div>

      {/* Legend */}
      <div style={{ display: "flex", justifyContent: "center", gap: 14, marginTop: 14, flexWrap: "wrap" }}>
        {ROLES.map((role) => {
          const agent = AGENTS[role];
          const stat = agentStats[role];
          return (
            <button key={role} onClick={() => router.push(`/agent/${role}`)}
              style={{
                display: "flex", alignItems: "center", gap: 5,
                fontSize: 11, color: "var(--muted)", textDecoration: "none",
                padding: "3px 8px", borderRadius: 6, background: "var(--panel)",
                border: "1px solid var(--line)", cursor: "pointer",
              }}
            >
              <span style={{ width: 10, height: 10, borderRadius: 4,
                background: `linear-gradient(135deg, ${agent.gradient[0]}, ${agent.gradient[1]})`,
                border: "1px solid rgba(255,255,255,0.3)" }} />
              <span style={{ fontWeight: 600 }}>{agent.name}</span>
              <span style={{ fontSize: 10, opacity: 0.5 }}>{stat?.msgCountMtd ?? 0}</span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
