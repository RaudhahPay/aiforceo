"use client";

import Link from "next/link";
import { MiniChart } from "./MiniChart";

type Props = {
  briefContent: string | null;
  workspaceName: string;
  revenue?: number;
  revenueData?: number[];  // last 5 data points for sparkline
};

export function MorningBrief({ briefContent, workspaceName, revenue, revenueData }: Props) {
  if (!briefContent) {
    return (
      <div style={{
        background: "var(--panel)",
        border: "1px solid var(--line)",
        borderRadius: 16,
        padding: "24px 28px",
        display: "flex",
        alignItems: "center",
        gap: 16,
      }}>
        <div style={{
          width: 48, height: 48, borderRadius: 14,
          background: "rgba(240,180,41,0.12)",
          display: "flex", alignItems: "center", justifyContent: "center",
          fontSize: 24, flexShrink: 0,
        }}>✨</div>
        <div style={{ flex: 1 }}>
          <h3 style={{ margin: 0, fontSize: 16, fontWeight: 700 }}>
            Good morning! Your brief is being prepared.
          </h3>
          <p style={{ margin: "4px 0 0", fontSize: 13, color: "var(--muted)" }}>
            Ask Aria for your morning brief, or enable auto-briefs in Settings → Notifications.
          </p>
        </div>
        <Link href="/agent/aria" className="btn text-sm" style={{ textDecoration: "none", flexShrink: 0 }}>
          Ask Aria
        </Link>
      </div>
    );
  }

  // Strip markdown formatting from brief content
  function cleanMarkdown(text: string): string {
    return text
      .replace(/#{1,6}\s*/g, "")         // headings
      .replace(/\*\*([^*]+)\*\*/g, "$1") // bold
      .replace(/\*([^*]+)\*/g, "$1")     // italic
      .replace(/__([^_]+)__/g, "$1")     // bold alt
      .replace(/_([^_]+)_/g, "$1")       // italic alt
      .replace(/~~([^~]+)~~/g, "$1")     // strikethrough
      .replace(/`([^`]+)`/g, "$1")       // inline code
      .replace(/---+/g, "")              // horizontal rules
      .trim();
  }

  // Extract key bullet points from brief content (first 3 lines that start with - or •)
  const bullets = briefContent
    .split("\n")
    .filter(l => l.trim().startsWith("-") || l.trim().startsWith("•") || l.trim().startsWith("*"))
    .slice(0, 3)
    .map(l => cleanMarkdown(l.replace(/^[\s\-•*]+/, "").trim()))
    .filter(l => l.length > 5);

  return (
    <div style={{
      background: "var(--panel)",
      border: "1px solid var(--line)",
      borderRadius: 16,
      padding: "24px 28px",
      position: "relative",
      overflow: "hidden",
    }}>
      {/* Accent bar */}
      <div style={{
        position: "absolute", top: 0, left: 0, right: 0, height: 3,
        background: "linear-gradient(90deg, var(--accent), var(--accent)50)",
      }} />

      <div style={{ display: "flex", gap: 24, alignItems: "flex-start" }}>
        {/* Left: Brief content */}
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 12 }}>
            <span style={{ fontSize: 20 }}>✨</span>
            <h3 style={{ margin: 0, fontSize: 16, fontWeight: 700 }}>
              Aria&apos;s Morning Brief
            </h3>
            <span style={{ fontSize: 11, color: "var(--muted)" }}>
              {workspaceName}
            </span>
          </div>

          {bullets.length > 0 ? (
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              {bullets.map((b, i) => (
                <div key={i} style={{ display: "flex", gap: 10, alignItems: "flex-start" }}>
                  <span style={{
                    fontSize: 11, fontWeight: 700, color: "var(--accent)",
                    marginTop: 2,
                  }}>
                    {i === 0 ? "📈" : i === 1 ? "📣" : "⚠️"}
                  </span>
                  <p style={{ margin: 0, fontSize: 13, color: "var(--ink)", lineHeight: 1.5 }}>
                    {b}
                  </p>
                </div>
              ))}
            </div>
          ) : (
            <p style={{ margin: 0, fontSize: 13, color: "var(--muted)", lineHeight: 1.6 }}>
              {cleanMarkdown(briefContent).slice(0, 200)}…
            </p>
          )}

          <div style={{ display: "flex", gap: 10, marginTop: 16 }}>
            <Link href="/agent/aria" className="btn text-sm" style={{ textDecoration: "none" }}>
              View Details
            </Link>
            <Link href="/agent/aria" className="btn btn-ghost text-sm" style={{ textDecoration: "none" }}>
              Ask Aria
            </Link>
          </div>
        </div>

        {/* Right: Revenue sparkline */}
        {revenue !== undefined && revenue > 0 && (
          <div style={{
            flexShrink: 0, width: 180,
            background: "var(--panel2)",
            borderRadius: 12,
            padding: "14px 16px",
          }}>
            <p style={{ margin: 0, fontSize: 10, color: "var(--muted)", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.06em" }}>
              Revenue
            </p>
            <p style={{ margin: "4px 0 8px", fontSize: 22, fontWeight: 800, color: "var(--ink)", fontFamily: "Georgia,serif" }}>
              RM {Math.round(revenue).toLocaleString()}
            </p>
            {revenueData && revenueData.length > 1 && (
              <MiniChart data={revenueData} color="var(--success)" height={36} />
            )}
          </div>
        )}
      </div>
    </div>
  );
}
