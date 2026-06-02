"use client";

import { useState } from "react";
import { ChatClient } from "@/app/agent/[role]/ChatClient";
import { C } from "@/app/_components/dashboard-primitives";

type PastConv = { id: string; title: string; updatedAt: string };
type Msg = { role: "user" | "assistant"; content: string; id?: string };

export type DepartmentConfig = {
  label: string;
  icon: string;
  accent: string;
};

export type QuickAction = {
  label: string;
  prompt: string;
};

export function DepartmentWorkspace({
  department,
  kpiView,
  period,
  onPeriodChange,
  // Chat props
  role,
  agent,
  workspaceName,
  conversationId,
  initialMessages,
  pastConversations,
  quickActions,
}: {
  department: DepartmentConfig;
  kpiView: React.ReactNode;
  period: "MTD" | "QTD" | "YTD";
  onPeriodChange: (p: "MTD" | "QTD" | "YTD") => void;
  // Chat props
  role: string;
  agent: { name: string; title: string; tag: string; gradient: readonly [string, string] };
  workspaceName: string;
  conversationId: string;
  initialMessages: Msg[];
  pastConversations: PastConv[];
  quickActions: QuickAction[];
}) {
  const [autoPrompt, setAutoPrompt] = useState<string | undefined>(undefined);
  const [promptSeq, setPromptSeq] = useState(0);
  const periods: ("MTD" | "QTD" | "YTD")[] = ["MTD", "QTD", "YTD"];

  return (
    <div
      style={{
        display: "grid",
        gridTemplateColumns: "40% 60%",
        height: "100vh",
        overflow: "hidden",
        background: C.ink,
      }}
    >
      {/* Left panel — KPI */}
      <div
        style={{
          overflow: "auto",
          padding: "18px 16px",
          borderRight: `1px solid ${C.line}`,
        }}
      >
        {/* Department header */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 10,
            marginBottom: 14,
          }}
        >
          <span style={{ fontSize: 22 }}>{department.icon}</span>
          <div>
            <h2
              style={{
                margin: 0,
                fontSize: 18,
                fontFamily: "Georgia,serif",
                color: C.text,
              }}
            >
              {department.label}
            </h2>
            <p style={{ margin: 0, fontSize: 11, color: C.dim }}>
              {workspaceName}
            </p>
          </div>
        </div>

        {/* Period selector */}
        <div
          style={{
            display: "flex",
            gap: 6,
            marginBottom: 16,
          }}
        >
          {periods.map((p) => (
            <button
              key={p}
              onClick={() => onPeriodChange(p)}
              style={{
                padding: "6px 14px",
                borderRadius: 8,
                fontSize: 12,
                fontWeight: 700,
                cursor: "pointer",
                border: `1px solid ${period === p ? department.accent : C.line}`,
                background: period === p ? department.accent : C.panel,
                color: period === p ? C.ink : C.dim,
                transition: "background 0.15s",
              }}
            >
              {p}
            </button>
          ))}
        </div>

        {/* KPI view */}
        {kpiView}

        {/* Quick actions */}
        <div style={{ marginTop: 18, paddingTop: 14, borderTop: `1px solid ${C.line}` }}>
          <h4
            style={{
              margin: "0 0 10px",
              fontSize: 11,
              color: C.dim,
              letterSpacing: "0.1em",
              textTransform: "uppercase",
              fontWeight: 700,
            }}
          >
            Quick Actions
          </h4>
          <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
            {quickActions.map((qa) => (
              <button
                key={qa.label}
                onClick={() => { setAutoPrompt(qa.prompt); setPromptSeq((s) => s + 1); }}
                style={{
                  padding: "10px 14px",
                  borderRadius: 10,
                  background: C.panel,
                  border: `1px solid ${C.line}`,
                  color: C.text,
                  fontSize: 12,
                  fontWeight: 600,
                  cursor: "pointer",
                  textAlign: "left",
                  transition: "border-color 0.15s",
                }}
              >
                {qa.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Right panel — Embedded Chat */}
      <div style={{ height: "100%", overflow: "hidden" }}>
        <ChatClient
          key={conversationId}
          role={role}
          agent={agent}
          workspaceName={workspaceName}
          conversationId={conversationId}
          initialMessages={initialMessages}
          pastConversations={pastConversations}
          embedded
          autoSendPrompt={autoPrompt ? `${autoPrompt}__seq${promptSeq}` : undefined}
        />
      </div>
    </div>
  );
}
