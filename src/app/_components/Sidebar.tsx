import Link from "next/link";
import { AGENTS, type AgentRole } from "@/lib/prompts";
import { CreditMeter } from "./CreditMeter";
import { WorkspaceSwitcher } from "./WorkspaceSwitcher";
import { MobileSidebarToggle } from "./MobileSidebarToggle";
import { signOut } from "@/server/actions/auth";
import type { WorkspaceStub } from "@/lib/workspace";

type ActivePage =
  | "command"
  | "dashboard"
  | "agents"
  | "brief"
  | "actions"
  | "sales"
  | "marketing"
  | "finance"
  | "operations"
  | "customers"
  | "autopilot"
  | "tasks"
  | "alerts"
  | "settings"
  | "connectors"
  | "documents"
  | "workspaces"
  | "search"
  | "saved"
  | "office"
  | "investor-pack"
  | AgentRole;

const ROLES: AgentRole[] = ["aria", "cmo", "coo", "cfo", "ceo", "cto"];

const D = {
  bg: "#0a0e1a",
  panel: "#111827",
  panel2: "#1a2236",
  line: "#1e293b",
  gold: "#c5a572",
  text: "#e8edf6",
  dim: "#8597b8",
  red: "#e5544b",
};

export function Sidebar({
  active,
  remainingTokens,
  monthlyQuota,
  workspaceName,
  workspaceId,
  allWorkspaces = [],
}: {
  active?: ActivePage;
  remainingTokens: number;
  monthlyQuota: number;
  workspaceName?: string;
  workspaceId?: string;
  allWorkspaces?: WorkspaceStub[];
}) {
  return (
    <>
      <MobileSidebarToggle />
      <aside
        className="app-sidebar"
        style={{
          width: 240,
          minHeight: "100vh",
          background: D.bg,
          borderRight: `1px solid ${D.line}`,
          display: "flex",
          flexDirection: "column",
        }}
      >
        {/* Logo */}
        <div
          style={{
            padding: "16px 14px 14px",
            borderBottom: `1px solid ${D.line}`,
          }}
        >
          <Link
            href="/dashboard"
            style={{
              display: "flex",
              alignItems: "center",
              gap: 9,
              fontWeight: 700,
              fontSize: 15,
              textDecoration: "none",
              color: D.text,
            }}
          >
            <span className="logo-mark" />
            AI<span style={{ color: D.gold }}>for</span>CEO
          </Link>
          {workspaceName && (
            <div style={{ marginTop: 8 }}>
              {workspaceId && allWorkspaces.length > 1 ? (
                <WorkspaceSwitcher
                  activeId={workspaceId}
                  workspaces={allWorkspaces}
                />
              ) : (
                <div
                  style={{
                    padding: "5px 8px",
                    background: D.panel2,
                    borderRadius: 7,
                    border: `1px solid ${D.line}`,
                  }}
                >
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
                    }}
                  >
                    {workspaceName}
                  </p>
                </div>
              )}
            </div>
          )}
        </div>

        <div
          style={{
            flex: 1,
            overflowY: "auto",
            padding: "10px 8px",
            display: "flex",
            flexDirection: "column",
            gap: 14,
          }}
        >
          {/* Command */}
          <Section title="Command">
            <Item href="/office" active={active === "command" || active === "office"} icon="⌂">
              Command Centre
            </Item>
            <Item href="/agents" active={active === "agents"} icon="👥">
              AI Executives
            </Item>
            <Item href="/dashboard" active={active === "dashboard" || active === "brief"} icon="📋">
              Morning Brief
            </Item>
          </Section>

          {/* Intelligence */}
          <Section title="Intelligence">
            <Item href="/dashboard" active={active === "sales"} icon="💰">
              Sales
            </Item>
            <Item href="/dashboard" active={active === "marketing"} icon="📣">
              Marketing
            </Item>
            <Item href="/dashboard" active={active === "finance"} icon="📊">
              Finance
            </Item>
            <Item href="/dashboard" active={active === "operations"} icon="⚙">
              Operations
            </Item>
          </Section>

          {/* Automation */}
          <Section title="Automation">
            <Item href="/autopilot" active={active === "autopilot"} icon="⚡">
              Campaigns
            </Item>
            <Item href="/documents" active={active === "documents"} icon="📂">
              Documents
            </Item>
            <Item href="/search" active={active === "search"} icon="🔍">
              Search
            </Item>
          </Section>

          {/* Setup */}
          <Section title="Setup">
            <Item href="/settings" active={active === "settings"} icon="⚙">
              Settings
            </Item>
            <Item href="/connectors" active={active === "connectors"} icon="🔗">
              Connectors
            </Item>
            <Item href="/workspaces" active={active === "workspaces"} icon="🏢">
              Workspaces
              {allWorkspaces.length > 1 && (
                <span
                  style={{
                    marginLeft: "auto",
                    fontSize: 10,
                    fontWeight: 700,
                    background: D.gold,
                    color: D.bg,
                    borderRadius: 20,
                    padding: "1px 7px",
                  }}
                >
                  {allWorkspaces.length}
                </span>
              )}
            </Item>
          </Section>

          {/* AI C-Suite */}
          <Section title="AI Executives">
            {ROLES.map((r) => (
              <Item
                key={r}
                href={`/agent/${r}`}
                active={active === r}
                iconRole={r}
              >
                {AGENTS[r].name}
                <span
                  style={{
                    fontSize: 10,
                    color: active === r ? "rgba(14,23,38,0.55)" : D.dim,
                    marginLeft: 3,
                    fontWeight: 400,
                  }}
                >
                  {AGENTS[r].title.replace("AI ", "")}
                </span>
              </Item>
            ))}
          </Section>
        </div>

        {/* Credit meter + sign out */}
        <div
          style={{
            padding: "10px 8px",
            borderTop: `1px solid ${D.line}`,
            display: "flex",
            flexDirection: "column",
            gap: 6,
          }}
        >
          <CreditMeter remaining={remainingTokens} quota={monthlyQuota} />
          <form action={signOut}>
            <button
              type="submit"
              style={{
                width: "100%",
                padding: "8px 10px",
                borderRadius: 10,
                fontSize: 12,
                fontWeight: 600,
                cursor: "pointer",
                background: "transparent",
                border: `1px solid ${D.line}`,
                color: D.dim,
                textAlign: "left",
                display: "flex",
                alignItems: "center",
                gap: 8,
              }}
            >
              <span
                style={{
                  width: 22,
                  height: 22,
                  borderRadius: 7,
                  flexShrink: 0,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  fontSize: 11,
                  background: D.panel2,
                  color: D.dim,
                }}
              >
                ↩
              </span>
              Sign out
            </button>
          </form>
        </div>
      </aside>
    </>
  );
}

function Section({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 1 }}>
      <h6
        style={{
          fontSize: 10,
          fontWeight: 700,
          letterSpacing: "0.1em",
          textTransform: "uppercase",
          color: D.dim,
          padding: "4px 10px 6px",
          margin: 0,
        }}
      >
        {title}
      </h6>
      {children}
    </div>
  );
}

function Item({
  href,
  active,
  icon,
  iconRole,
  children,
}: {
  href: string;
  active?: boolean;
  icon?: string;
  iconRole?: AgentRole;
  children: React.ReactNode;
}) {
  const gradient = iconRole
    ? `linear-gradient(135deg, ${AGENTS[iconRole].gradient[0]}, ${AGENTS[iconRole].gradient[1]})`
    : undefined;

  return (
    <Link
      href={href}
      style={{
        display: "flex",
        alignItems: "center",
        gap: 9,
        padding: "8px 10px",
        borderRadius: 10,
        fontSize: 13,
        fontWeight: 500,
        textDecoration: "none",
        background: active ? D.gold : "transparent",
        color: active ? D.bg : D.text,
      }}
    >
      <span
        style={{
          width: 22,
          height: 22,
          borderRadius: 7,
          flexShrink: 0,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          fontSize: 11,
          fontWeight: 700,
          background: iconRole
            ? gradient
            : active
              ? "rgba(14,23,38,0.22)"
              : D.panel2,
          color: iconRole
            ? iconRole === "ceo"
              ? "#1E2761"
              : "#fff"
            : active
              ? D.bg
              : D.dim,
        }}
      >
        {iconRole ? AGENTS[iconRole].name[0] : icon}
      </span>
      <span
        style={{
          display: "flex",
          alignItems: "center",
          gap: 3,
          flex: 1,
          minWidth: 0,
          overflow: "hidden",
        }}
      >
        {children}
      </span>
    </Link>
  );
}
