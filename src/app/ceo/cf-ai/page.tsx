import Link from "next/link";
import { redirect } from "next/navigation";
import { requireUser } from "@/lib/auth/require";
import { getCurrentWorkspace } from "@/lib/workspace";
import { assertOrgAdmin } from "@/lib/ceo-dashboard/access";
import { composeGroupBrief, narrateBrief } from "@/lib/cf-ai/brief";
import { fmtMoney } from "@/lib/ceo-dashboard/types";
import CfAiChat from "./CfAiChat";

export const dynamic = "force-dynamic";

const TRAFFIC_COLOR = {
  green: "var(--success)",
  yellow: "var(--amber)",
  red: "var(--red)",
} as const;

const SEVERITY_COLOR = {
  red: "var(--red)",
  yellow: "var(--amber)",
  info: "var(--dim)",
} as const;

export default async function CfAiPage() {
  let user;
  try {
    user = await requireUser();
  } catch {
    redirect("/login");
  }
  const ctx = await getCurrentWorkspace();
  if (!ctx) redirect("/onboarding");

  try {
    await assertOrgAdmin(user.id, ctx.workspace.id);
  } catch {
    return (
      <main style={{ maxWidth: 720, margin: "0 auto", padding: "40px 20px" }}>
        <h1 style={{ fontWeight: 800, fontSize: 24, marginBottom: 10 }}>
          CF ai
        </h1>
        <p style={{ color: "var(--dim)", fontSize: 14 }}>
          CF ai reads every venture in the group, so it is only available to the
          workspace owner, the Group CEO role, or an org-wide admin. Ask your
          group admin for access.
        </p>
      </main>
    );
  }

  const brief = await narrateBrief(await composeGroupBrief(ctx.workspace.id));
  const line = "var(--line)";
  const dim = "var(--dim)";
  const pulseColor = TRAFFIC_COLOR[brief.groupPulse.badge];

  return (
    <main style={{ maxWidth: 1080, margin: "0 auto", padding: "28px 20px" }}>
      <header
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "flex-end",
          gap: 16,
          flexWrap: "wrap",
          marginBottom: 22,
        }}
      >
        <div>
          <div
            style={{
              fontSize: 12,
              letterSpacing: "0.14em",
              textTransform: "uppercase",
              color: "var(--gold)",
              fontWeight: 600,
              marginBottom: 6,
            }}
          >
            {ctx.workspace.name} — Group AI CEO · Advisor Mode
          </div>
          <h1
            style={{
              fontWeight: 800,
              fontSize: "clamp(26px, 4vw, 38px)",
              letterSpacing: "-0.01em",
            }}
          >
            CF ai
          </h1>
        </div>
        <Link
          href="/ceo"
          style={{
            border: `1px solid ${line}`,
            borderRadius: 10,
            padding: "9px 15px",
            fontSize: 12,
            fontWeight: 600,
            color: dim,
            textDecoration: "none",
            letterSpacing: "0.06em",
          }}
        >
          ← Group overview
        </Link>
      </header>

      <section
        style={{
          background: "var(--panel)",
          border: `1px solid color-mix(in srgb, var(--gold) 35%, transparent)`,
          borderRadius: 14,
          padding: 20,
          marginBottom: 16,
        }}
      >
        <div
          style={{
            fontSize: 11,
            fontWeight: 700,
            letterSpacing: "0.1em",
            color: "var(--gold)",
            marginBottom: 8,
          }}
        >
          TODAY&apos;S BRIEF
        </div>
        <div
          style={{ fontSize: 14.5, lineHeight: 1.65, whiteSpace: "pre-wrap" }}
        >
          {brief.narrative}
        </div>
      </section>

      <section
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))",
          gap: 12,
          marginBottom: 16,
        }}
      >
        <div
          style={{
            background: "var(--panel)",
            border: `1px solid ${line}`,
            borderRadius: 14,
            padding: 16,
          }}
        >
          <div style={{ fontSize: 11, color: dim, letterSpacing: "0.08em" }}>
            GROUP PULSE
          </div>
          <div
            style={{
              fontSize: 26,
              fontWeight: 800,
              color: pulseColor,
              marginTop: 6,
            }}
          >
            {brief.groupPulse.score}%{" "}
            <span style={{ fontSize: 13 }}>
              {brief.groupPulse.badge.toUpperCase()}
            </span>
          </div>
        </div>
        <div
          style={{
            background: "var(--panel)",
            border: `1px solid ${line}`,
            borderRadius: 14,
            padding: 16,
          }}
        >
          <div style={{ fontSize: 11, color: dim, letterSpacing: "0.08em" }}>
            GROUP CASH POSITION
          </div>
          <div style={{ fontSize: 26, fontWeight: 800, marginTop: 6 }}>
            {fmtMoney(brief.cashPositionRm, "MYR")}
          </div>
        </div>
        <div
          style={{
            background: "var(--panel)",
            border: `1px solid ${line}`,
            borderRadius: 14,
            padding: 16,
          }}
        >
          <div style={{ fontSize: 11, color: dim, letterSpacing: "0.08em" }}>
            VENTURES
          </div>
          <div style={{ fontSize: 26, fontWeight: 800, marginTop: 6 }}>
            {brief.ventures.length}
          </div>
        </div>
      </section>

      {brief.topPriorities.length > 0 ? (
        <section
          style={{
            background: "var(--panel)",
            border: `1px solid color-mix(in srgb, var(--red) 45%, transparent)`,
            borderRadius: 14,
            padding: 18,
            marginBottom: 16,
          }}
        >
          <div
            style={{
              fontWeight: 700,
              fontSize: 15,
              marginBottom: 10,
              color: "var(--red)",
            }}
          >
            Top priorities
          </div>
          <ol style={{ margin: 0, paddingLeft: 20, display: "grid", gap: 6 }}>
            {brief.topPriorities.map((p) => (
              <li key={p} style={{ fontSize: 13.5, lineHeight: 1.5 }}>
                {p}
              </li>
            ))}
          </ol>
        </section>
      ) : null}

      <section
        style={{
          background: "var(--panel)",
          border: `1px solid ${line}`,
          borderRadius: 14,
          padding: 18,
          marginBottom: 16,
        }}
      >
        <div style={{ fontWeight: 700, fontSize: 15, marginBottom: 12 }}>
          Cabinet findings by venture
        </div>
        {brief.ventures.length === 0 ? (
          <div style={{ color: dim, fontSize: 13 }}>
            No ventures yet — add one on the{" "}
            <Link href="/ceo/entities" style={{ color: "var(--gold)" }}>
              Ventures &amp; roles
            </Link>{" "}
            page.
          </div>
        ) : (
          <div style={{ display: "grid", gap: 14 }}>
            {brief.ventures.map((v) => (
              <div key={v.entityId}>
                <div
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 10,
                    marginBottom: 6,
                  }}
                >
                  <Link
                    href={`/ceo/${v.entityId}`}
                    style={{
                      fontWeight: 700,
                      fontSize: 13.5,
                      color: "var(--text)",
                      textDecoration: "none",
                    }}
                  >
                    {v.name}
                  </Link>
                  <span
                    style={{
                      fontSize: 11,
                      fontWeight: 700,
                      color: TRAFFIC_COLOR[v.health.badge],
                    }}
                  >
                    ● {v.health.badge.toUpperCase()} {v.health.score}%
                  </span>
                </div>
                {v.findings.length === 0 ? (
                  <div style={{ color: dim, fontSize: 12.5 }}>
                    No findings — clean slate.
                  </div>
                ) : (
                  <ul
                    style={{
                      margin: 0,
                      paddingLeft: 18,
                      display: "grid",
                      gap: 4,
                    }}
                  >
                    {v.findings.map((f, i) => (
                      <li
                        key={i}
                        style={{
                          fontSize: 12.5,
                          lineHeight: 1.5,
                          color: SEVERITY_COLOR[f.severity],
                        }}
                      >
                        <span
                          style={{
                            fontWeight: 700,
                            letterSpacing: "0.06em",
                            fontSize: 10.5,
                          }}
                        >
                          {f.analyst}
                        </span>{" "}
                        <span style={{ color: "var(--text)" }}>
                          {f.message}
                        </span>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            ))}
          </div>
        )}
      </section>

      <section
        style={{
          background: "var(--panel)",
          border: `1px solid ${line}`,
          borderRadius: 14,
          padding: 18,
        }}
      >
        <div style={{ fontWeight: 700, fontSize: 15, marginBottom: 12 }}>
          Ask CF ai
        </div>
        <CfAiChat />
      </section>
    </main>
  );
}
