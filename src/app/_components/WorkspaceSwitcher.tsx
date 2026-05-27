"use client";

import { useRef, useState, useTransition } from "react";
import { switchWorkspace } from "@/server/actions/workspaces";
import type { WorkspaceStub } from "@/lib/workspace";

const TIER_DOT: Record<string, string> = {
  trial: "#94a3b8",
  starter: "#0096C7",
  growth: "#7C3AED",
  scale: "#F96167",
};

const D = {
  panel: "#15203A",
  panel2: "#1C2A47",
  line: "#2A3B5E",
  gold: "#D4A017",
  text: "#E8EDF6",
  dim: "#8597B8",
  bg: "#0E1726",
};

export function WorkspaceSwitcher({
  activeId,
  workspaces,
}: {
  activeId: string;
  workspaces: WorkspaceStub[];
}) {
  const [open, setOpen] = useState(false);
  const [isPending, startTransition] = useTransition();
  const containerRef = useRef<HTMLDivElement>(null);

  // Only render the switcher when the user has more than one company
  if (workspaces.length <= 1) return null;

  const active = workspaces.find((w) => w.id === activeId);
  const others = workspaces.filter((w) => w.id !== activeId);

  function handleSwitch(wsId: string) {
    setOpen(false);
    const fd = new FormData();
    fd.set("workspace_id", wsId);
    startTransition(() => switchWorkspace(fd));
  }

  return (
    <div ref={containerRef} style={{ position: "relative" }}>
      {/* Trigger — current workspace badge */}
      <button
        onClick={() => setOpen((o) => !o)}
        disabled={isPending}
        style={{
          width: "100%",
          display: "flex",
          alignItems: "center",
          gap: 7,
          padding: "5px 8px",
          background: D.panel2,
          borderRadius: 7,
          border: `1px solid ${open ? D.gold : D.line}`,
          cursor: isPending ? "default" : "pointer",
          opacity: isPending ? 0.6 : 1,
          textAlign: "left",
        }}
      >
        <span
          style={{
            width: 7,
            height: 7,
            borderRadius: "50%",
            flexShrink: 0,
            background: TIER_DOT[active?.tier ?? "trial"] ?? D.dim,
          }}
        />
        <p
          style={{
            fontSize: 10,
            color: D.gold,
            overflow: "hidden",
            textOverflow: "ellipsis",
            whiteSpace: "nowrap",
            fontWeight: 700,
            letterSpacing: "0.05em",
            textTransform: "uppercase",
            margin: 0,
            flex: 1,
          }}
        >
          {isPending ? "Switching…" : (active?.name ?? "—")}
        </p>
        <span style={{ fontSize: 9, color: D.dim, flexShrink: 0 }}>
          {open ? "▲" : "▼"}
        </span>
      </button>

      {/* Dropdown */}
      {open && (
        <>
          {/* Click-outside overlay */}
          <div
            style={{ position: "fixed", inset: 0, zIndex: 49 }}
            onClick={() => setOpen(false)}
          />
          <div
            style={{
              position: "absolute",
              top: "calc(100% + 4px)",
              left: 0,
              right: 0,
              background: D.panel,
              border: `1px solid ${D.line}`,
              borderRadius: 10,
              zIndex: 50,
              overflow: "hidden",
              boxShadow: "0 8px 24px rgba(0,0,0,0.4)",
            }}
          >
            {/* Header */}
            <div
              style={{
                padding: "8px 10px 6px",
                fontSize: 9,
                fontWeight: 700,
                letterSpacing: "0.1em",
                textTransform: "uppercase",
                color: D.dim,
                borderBottom: `1px solid ${D.line}`,
              }}
            >
              Switch company
            </div>

            {/* Other workspaces */}
            {others.map((ws) => (
              <button
                key={ws.id}
                onClick={() => handleSwitch(ws.id)}
                style={{
                  width: "100%",
                  display: "flex",
                  alignItems: "center",
                  gap: 8,
                  padding: "9px 10px",
                  background: "transparent",
                  border: "none",
                  cursor: "pointer",
                  textAlign: "left",
                  borderBottom: `1px solid ${D.line}`,
                }}
                onMouseEnter={(e) => {
                  (e.currentTarget as HTMLButtonElement).style.background =
                    D.panel2;
                }}
                onMouseLeave={(e) => {
                  (e.currentTarget as HTMLButtonElement).style.background =
                    "transparent";
                }}
              >
                <span
                  style={{
                    width: 7,
                    height: 7,
                    borderRadius: "50%",
                    flexShrink: 0,
                    background: TIER_DOT[ws.tier] ?? D.dim,
                  }}
                />
                <span
                  style={{
                    fontSize: 12,
                    color: D.text,
                    fontWeight: 500,
                    overflow: "hidden",
                    textOverflow: "ellipsis",
                    whiteSpace: "nowrap",
                    flex: 1,
                  }}
                >
                  {ws.name}
                </span>
                <span
                  style={{
                    fontSize: 10,
                    color: D.dim,
                    fontWeight: 600,
                    textTransform: "uppercase",
                    flexShrink: 0,
                  }}
                >
                  {ws.tier}
                </span>
              </button>
            ))}

            {/* Footer — manage workspaces link */}
            <a
              href="/workspaces"
              onClick={() => setOpen(false)}
              style={{
                display: "block",
                padding: "8px 10px",
                fontSize: 11,
                color: D.dim,
                textDecoration: "none",
                fontWeight: 600,
              }}
              onMouseEnter={(e) => {
                (e.currentTarget as HTMLAnchorElement).style.color = D.gold;
              }}
              onMouseLeave={(e) => {
                (e.currentTarget as HTMLAnchorElement).style.color = D.dim;
              }}
            >
              ◫ Manage all companies →
            </a>
          </div>
        </>
      )}
    </div>
  );
}
