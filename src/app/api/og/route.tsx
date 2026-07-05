import { ImageResponse } from "next/og";

const EXECUTIVES = [
  { role: "CMO", name: "Maya", color: "#F96167" },
  { role: "COO", name: "Owen", color: "#2A9D8F" },
  { role: "CFO", name: "Felix", color: "#5566B5" },
  { role: "CEO", name: "Eden", color: "#F0B429" },
  { role: "CTO", name: "Tariq", color: "#0096C7" },
  { role: "CoS", name: "Aria", color: "#7C3AED" },
];

export async function GET(): Promise<ImageResponse> {
  return new ImageResponse(
    <div
      style={{
        width: 1200,
        height: 630,
        background: "#0a0e1a",
        display: "flex",
        flexDirection: "column",
        justifyContent: "space-between",
        padding: "64px 72px",
        fontFamily: "system-ui, -apple-system, sans-serif",
      }}
    >
      {/* Top bar */}
      <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
        <div
          style={{
            width: 40,
            height: 40,
            borderRadius: 10,
            background: "linear-gradient(135deg, #F0B429, #7C3AED)",
          }}
        />
        <span
          style={{
            color: "#e8edf6",
            fontSize: 24,
            fontWeight: 800,
            letterSpacing: "-0.5px",
          }}
        >
          AI<span style={{ color: "#F0B429" }}>for</span>CEO
        </span>
        <div
          style={{
            marginLeft: 16,
            padding: "4px 12px",
            borderRadius: 20,
            border: "1px solid rgba(240,180,41,0.4)",
            color: "#F0B429",
            fontSize: 12,
            fontWeight: 700,
            letterSpacing: "0.08em",
          }}
        >
          FOUNDING MEMBER OFFER — $47/mo
        </div>
      </div>

      {/* Main headline */}
      <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
        <div
          style={{
            color: "#e8edf6",
            fontSize: 58,
            fontWeight: 900,
            lineHeight: 1.05,
            letterSpacing: "-2px",
          }}
        >
          Your AI C-Suite.
          <br />
          <span style={{ color: "#F0B429" }}>Deployed in 30 minutes.</span>
        </div>
        <div
          style={{
            color: "#8597b8",
            fontSize: 22,
            fontWeight: 400,
            maxWidth: 680,
          }}
        >
          Six Command Executives briefed on your business — CMO, COO, CFO, CEO,
          CTO, and Aria your Chief of Staff.
        </div>
      </div>

      {/* Executive chips */}
      <div style={{ display: "flex", gap: 12 }}>
        {EXECUTIVES.map((exec) => (
          <div
            key={exec.role}
            style={{
              display: "flex",
              alignItems: "center",
              gap: 8,
              padding: "8px 16px",
              borderRadius: 40,
              background: "rgba(255,255,255,0.05)",
              border: "1px solid rgba(255,255,255,0.1)",
            }}
          >
            <div
              style={{
                width: 28,
                height: 28,
                borderRadius: 7,
                background: exec.color,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                color: "#fff",
                fontSize: 12,
                fontWeight: 800,
              }}
            >
              {exec.name[0]}
            </div>
            <div style={{ display: "flex", flexDirection: "column" }}>
              <span
                style={{
                  color: "#e8edf6",
                  fontSize: 13,
                  fontWeight: 700,
                  lineHeight: 1.2,
                }}
              >
                {exec.name}
              </span>
              <span style={{ color: "#8597b8", fontSize: 11, lineHeight: 1.2 }}>
                {exec.role}
              </span>
            </div>
          </div>
        ))}
      </div>
    </div>,
    {
      width: 1200,
      height: 630,
    },
  );
}
