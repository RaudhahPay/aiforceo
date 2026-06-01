"use client";

import { useState, useTransition } from "react";
import {
  saveCustomApiConnector,
  saveGoogleSheetConfig,
  disconnectConnector,
  getGoogleSheetsAuthUrl,
  getQuickBooksAuthUrl
} from "@/server/actions/connectors";

type Connector = {
  id: string;
  provider: string;
  status: string;
  metadata: Record<string, string>;
};

type Props = {
  connectors: Connector[];
  flashMsg?: string;
};

const CONNECTOR_META = {
  google_sheets: {
    label: "Google Sheets",
    icon: "📊",
    color: "var(--success)",
    description: "Pull live data from your spreadsheets. Felix (CFO) can read your P&L, Eden (CEO) can track KPIs, Maya (CMO) can push content calendars.",
    agents: ["Felix · CFO", "Eden · CEO", "Maya · CMO"],
    setupNote: "Requires GOOGLE_CLIENT_ID + GOOGLE_CLIENT_SECRET in Cloudflare secrets."
  },
  quickbooks: {
    label: "QuickBooks",
    icon: "💰",
    color: "var(--success)",
    description: "Connect your accounting so Felix (CFO) can pull real P&L, cash flow, and expense data automatically — no copy-paste needed.",
    agents: ["Felix · CFO"],
    setupNote: "Requires QUICKBOOKS_CLIENT_ID + QUICKBOOKS_CLIENT_SECRET in Cloudflare secrets."
  },
  custom_api: {
    label: "Custom API",
    icon: "🔗",
    color: "var(--accent)",
    description: "Connect any REST API — your POS, CRM, inventory system, or internal tool. Your AI executives will be able to query it for context.",
    agents: ["All executives"],
    setupNote: null
  },
  whatsapp: {
    label: "WhatsApp",
    icon: "💬",
    color: "var(--success)",
    description: "Chat with your AI C-Suite directly from WhatsApp. Ask Eden for your morning brief, Owen for an SOP, or Aria to pull status from all 5 execs.",
    agents: ["All executives"],
    setupNote: "Coming in v0.3 — WhatsApp Business API setup required."
  }
};

function StatusBadge({ status }: { status: string }) {
  const colour = status === "active" ? "var(--success)" : status === "error" ? "var(--red)" : "var(--muted)";
  return (
    <span style={{ display: "inline-flex", alignItems: "center", gap: 5, fontSize: 12, fontWeight: 600, color: colour }}>
      <span style={{ width: 7, height: 7, borderRadius: "50%", background: colour, display: "inline-block" }} />
      {status === "active" ? "Connected" : status === "error" ? "Error" : "Not connected"}
    </span>
  );
}

/* ── Google Sheets sheet-config sub-form ─────────────────────────────────── */
function SheetConfigForm({ onSaved }: { onSaved: () => void }) {
  const [isPending, startTransition] = useTransition();
  const [sheetUrl,   setSheetUrl]   = useState("");
  const [sheetName,  setSheetName]  = useState("");
  const [sheetRange, setSheetRange] = useState("A1:Z500");
  const [testResult, setTestResult] = useState<{ ok: boolean; msg: string } | null>(null);
  const [err, setErr] = useState("");

  function save(e: React.FormEvent) {
    e.preventDefault();
    setErr(""); setTestResult(null);
    startTransition(async () => {
      const res = await saveGoogleSheetConfig({ sheet_url: sheetUrl, sheet_name: sheetName, sheet_range: sheetRange });
      if (res && "error" in res) { setErr(res.error ?? "Save failed"); return; }
      onSaved();
    });
  }

  async function test() {
    setTestResult(null); setErr("");
    try {
      const res = await fetch("/api/connectors/sheets/test", { method: "POST", credentials: "same-origin" });
      const data = await res.json() as { ok: boolean; rowCount?: number; headers?: string[]; error?: string };
      if (data.ok) {
        setTestResult({ ok: true, msg: `✓ Read ${data.rowCount} rows — headers: ${(data.headers ?? []).slice(0,5).join(", ")}` });
      } else {
        setTestResult({ ok: false, msg: data.error ?? "Test failed" });
      }
    } catch {
      setTestResult({ ok: false, msg: "Network error" });
    }
  }

  return (
    <form onSubmit={save} style={{ display: "flex", flexDirection: "column", gap: 10 }}>
      <p style={{ fontSize: 12, color: "var(--muted)", margin: 0 }}>
        ✅ Google account connected. Now tell your AI executives which spreadsheet to read.
      </p>
      <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
        <label style={{ fontSize: 11, fontWeight: 700, color: "var(--muted)", textTransform: "uppercase", letterSpacing: "0.05em" }}>
          Google Sheets URL *
        </label>
        <input
          type="url" required value={sheetUrl}
          onChange={e => setSheetUrl(e.target.value)}
          placeholder="https://docs.google.com/spreadsheets/d/..."
          className="input text-sm"
        />
        <p style={{ fontSize: 10, color: "var(--muted)", margin: 0 }}>
          Paste the full URL from your browser. The sheet must be accessible by the connected Google account.
        </p>
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
        <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
          <label style={{ fontSize: 11, fontWeight: 700, color: "var(--muted)", textTransform: "uppercase", letterSpacing: "0.05em" }}>
            Sheet label
          </label>
          <input value={sheetName} onChange={e => setSheetName(e.target.value)}
            placeholder="My P&L Sheet" className="input text-sm" />
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
          <label style={{ fontSize: 11, fontWeight: 700, color: "var(--muted)", textTransform: "uppercase", letterSpacing: "0.05em" }}>
            Range (default A1:Z500)
          </label>
          <input value={sheetRange} onChange={e => setSheetRange(e.target.value)}
            placeholder="A1:Z500" className="input text-sm" />
        </div>
      </div>
      {err && <p style={{ fontSize: 12, color: "var(--red)", fontWeight: 600 }}>⚠ {err}</p>}
      {testResult && (
        <p style={{ fontSize: 12, fontWeight: 600, color: testResult.ok ? "var(--success)" : "var(--red)" }}>
          {testResult.msg}
        </p>
      )}
      <div style={{ display: "flex", gap: 8 }}>
        <button type="submit" disabled={isPending || !sheetUrl} className="btn text-sm flex-1"
          style={{ opacity: isPending ? 0.6 : 1 }}>
          {isPending ? "Saving…" : "Save & activate"}
        </button>
        <button type="button" onClick={test} className="btn btn-ghost text-sm"
          style={{ whiteSpace: "nowrap" }}>
          Test connection
        </button>
      </div>
    </form>
  );
}

/* ── OAuthCard ───────────────────────────────────────────────── */
function OAuthCard({
  provider, meta, connector, onDisconnect
}: {
  provider: "google_sheets" | "quickbooks";
  meta: typeof CONNECTOR_META.google_sheets;
  connector?: Connector;
  onDisconnect: (id: string) => Promise<void>;
}) {
  const [loading,    setLoading]    = useState(false);
  const [err,        setErr]        = useState("");
  const [sheetSaved, setSheetSaved] = useState(false);

  // For google_sheets: show sheet config if connected but no sheet_url yet
  const needsSheetConfig = provider === "google_sheets"
    && connector?.status === "active"
    && !connector?.metadata?.sheet_url
    && !sheetSaved;

  async function connect() {
    setLoading(true); setErr("");
    try {
      const fn = provider === "google_sheets" ? getGoogleSheetsAuthUrl : getQuickBooksAuthUrl;
      const result = await fn();
      if ("error" in result) { setErr(result.error ?? "Unknown error"); setLoading(false); return; }
      window.location.href = result.url;
    } catch (e) {
      setErr(String(e)); setLoading(false);
    }
  }

  async function disconnect() {
    if (!connector) return;
    setLoading(true);
    await onDisconnect(connector.id);
    setLoading(false);
  }

  const tag = provider === "google_sheets" ? "SHEETS" : "ACCOUNTING";
  const sheetName = connector?.metadata?.sheet_name;
  const sheetUrl  = connector?.metadata?.sheet_url;

  return (
    <div className="card p-6 flex flex-col gap-4">
      {/* Header */}
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-3">
          <span style={{ fontSize: 28 }}>{meta.icon}</span>
          <div>
            <h3 className="font-bold text-base">{meta.label}</h3>
            <StatusBadge status={connector?.status ?? "pending"} />
          </div>
        </div>
        <span style={{
          fontSize: 10, fontWeight: 700, padding: "3px 8px",
          borderRadius: 6, background: meta.color + "18", color: meta.color,
        }}>{tag}</span>
      </div>

      <p className="text-sm text-[var(--muted)]">{meta.description}</p>

      <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
        {meta.agents.map(a => (
          <span key={a} style={{
            fontSize: 11, padding: "2px 8px", borderRadius: 20,
            border: "1px solid var(--line)", color: "var(--muted)", fontWeight: 600,
          }}>{a}</span>
        ))}
      </div>

      {/* Error */}
      {err && (
        <div style={{ background: "rgba(229,84,75,0.08)", border: "1px solid rgba(229,84,75,0.3)", borderRadius: 8, padding: "10px 14px" }}>
          <p style={{ fontSize: 13, fontWeight: 600, color: "var(--red)", margin: 0 }}>⚠ {err}</p>
          {meta.setupNote && <p style={{ fontSize: 11, color: "var(--muted)", marginTop: 4 }}>{meta.setupNote}</p>}
        </div>
      )}

      {/* Sheet config needed after OAuth */}
      {needsSheetConfig && (
        <div style={{ background: "rgba(63,185,132,0.06)", border: "1px solid rgba(63,185,132,0.25)", borderRadius: 10, padding: "14px 16px" }}>
          <SheetConfigForm onSaved={() => setSheetSaved(true)} />
        </div>
      )}

      {/* Connected + sheet configured */}
      {connector && !needsSheetConfig && (
        <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
          {sheetUrl && (
            <div style={{ background: "rgba(63,185,132,0.08)", border: "1px solid rgba(63,185,132,0.25)", borderRadius: 8, padding: "10px 14px" }}>
              <p style={{ fontSize: 12, fontWeight: 700, color: "var(--success)", margin: "0 0 2px" }}>
                📊 {sheetName || "Sheet"} connected
              </p>
              <p style={{ fontSize: 11, color: "var(--muted)", margin: 0, wordBreak: "break-all" }}>{sheetUrl}</p>
            </div>
          )}
          <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
            <span style={{ flex: 1, fontSize: 12, color: "var(--muted)" }}>
              {sheetUrl ? "Live data is injected into every agent message." : "OAuth connected — add a sheet URL to activate."}
            </span>
            {!sheetUrl && (
              <button onClick={() => setSheetSaved(false)} className="btn btn-ghost text-xs">
                Configure sheet
              </button>
            )}
            <button onClick={disconnect} disabled={loading}
              className="btn btn-ghost text-xs" style={{ color: "var(--red)" }}>
              {loading ? "…" : "Disconnect"}
            </button>
          </div>
        </div>
      )}

      {/* Not connected */}
      {!connector && (
        <button onClick={connect} disabled={loading} className="btn text-sm"
          style={{ background: meta.color, color: "var(--bg)", border: "none", opacity: loading ? 0.6 : 1 }}>
          {loading ? "Redirecting…" : `Connect ${meta.label}`}
        </button>
      )}
    </div>
  );
}

function CustomApiCard({
  connector,
  onDisconnect
}: {
  connector?: Connector;
  onDisconnect: (id: string) => Promise<void>;
}) {
  const meta = CONNECTOR_META.custom_api;
  const [open, setOpen] = useState(!connector);
  const [isPending, startTransition] = useTransition();
  const [success, setSuccess] = useState(false);
  const [err, setErr] = useState("");

  const [form, setForm] = useState({
    name:        connector?.metadata?.name ?? "",
    endpoint:    connector?.metadata?.endpoint ?? "",
    authType:    (connector?.metadata?.authType ?? "none") as "none" | "api_key" | "bearer" | "basic",
    authHeader:  connector?.metadata?.authHeader ?? "",
    authValue:   connector?.metadata?.authValue ?? "",
    description: connector?.metadata?.description ?? ""
  });

  function field(k: keyof typeof form) {
    return (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) =>
      setForm(f => ({ ...f, [k]: e.target.value }));
  }

  function submit(e: React.FormEvent) {
    e.preventDefault();
    setErr("");
    setSuccess(false);
    startTransition(async () => {
      const res = await saveCustomApiConnector(form);
      if (res && "error" in res) { setErr(res.error ?? "Unknown error"); return; }
      setSuccess(true);
      setOpen(false);
    });
  }

  return (
    <div className="card p-6 flex flex-col gap-4">
      <div className="flex items-start justify-between">
        <div className="flex items-center gap-3">
          <span style={{ fontSize: 28 }}>{meta.icon}</span>
          <div>
            <h3 className="font-bold text-base">{meta.label}</h3>
            <StatusBadge status={connector?.status ?? "pending"} />
          </div>
        </div>
        <span style={{
          fontSize: 10, fontWeight: 700, padding: "3px 8px",
          borderRadius: 6, background: "rgba(197,165,114,0.1)", color: "var(--accent)"
        }}>REST API</span>
      </div>

      <p className="text-sm text-[var(--muted)]">{meta.description}</p>

      {connector && !open && (
        <div className="flex items-center gap-3">
          <div className="flex-1 text-sm">
            <span className="font-semibold">{connector.metadata.name}</span>
            <span className="text-[var(--muted)] ml-2">{connector.metadata.endpoint}</span>
          </div>
          <button className="btn btn-ghost text-xs" onClick={() => setOpen(true)}>Edit</button>
          <button className="btn btn-ghost text-xs" style={{ color: "var(--red)" }}
            onClick={() => onDisconnect(connector.id)}>Remove</button>
        </div>
      )}

      {(open || !connector) && (
        <form onSubmit={submit} className="flex flex-col gap-3">
          <div className="grid grid-cols-2 gap-3">
            <div className="flex flex-col gap-1">
              <label className="text-xs font-bold text-[var(--muted)]">Name</label>
              <input value={form.name} onChange={field("name")} placeholder="My CRM" required
                className="input text-sm" />
            </div>
            <div className="flex flex-col gap-1">
              <label className="text-xs font-bold text-[var(--muted)]">Base URL</label>
              <input value={form.endpoint} onChange={field("endpoint")} placeholder="https://api.mycrm.com/v1" required type="url"
                className="input text-sm" />
            </div>
          </div>

          <div className="flex flex-col gap-1">
            <label className="text-xs font-bold text-[var(--muted)]">Auth type</label>
            <select value={form.authType} onChange={field("authType")} className="input text-sm">
              <option value="none">No auth</option>
              <option value="api_key">API Key (custom header)</option>
              <option value="bearer">Bearer token</option>
              <option value="basic">Basic auth</option>
            </select>
          </div>

          {form.authType !== "none" && (
            <div className="grid grid-cols-2 gap-3">
              {form.authType === "api_key" && (
                <div className="flex flex-col gap-1">
                  <label className="text-xs font-bold text-[var(--muted)]">Header name</label>
                  <input value={form.authHeader} onChange={field("authHeader")} placeholder="X-API-Key"
                    className="input text-sm" />
                </div>
              )}
              <div className="flex flex-col gap-1 col-span-1">
                <label className="text-xs font-bold text-[var(--muted)]">
                  {form.authType === "bearer" ? "Token" : form.authType === "basic" ? "user:password" : "Value"}
                </label>
                <input value={form.authValue} onChange={field("authValue")} type="password" placeholder="••••••••"
                  className="input text-sm" />
              </div>
            </div>
          )}

          <div className="flex flex-col gap-1">
            <label className="text-xs font-bold text-[var(--muted)]">Description (optional — shown to agents as context)</label>
            <textarea value={form.description} onChange={field("description")} rows={2}
              placeholder="Customer records API — provides customer name, email, last purchase date"
              className="input text-sm resize-none" />
          </div>

          {err && <p className="text-sm font-semibold" style={{ color: "var(--red)" }}>⚠ {err}</p>}
          {success && <p className="text-sm font-semibold" style={{ color: "var(--success)" }}>✓ Connector saved</p>}

          <div className="flex gap-2">
            <button type="submit" disabled={isPending} className="btn text-sm"
              style={{ background: "var(--accent)", color: "var(--bg)", border: "none", opacity: isPending ? 0.6 : 1 }}>
              {isPending ? "Saving…" : "Save connector"}
            </button>
            {connector && (
              <button type="button" className="btn btn-ghost text-sm" onClick={() => setOpen(false)}>Cancel</button>
            )}
          </div>
        </form>
      )}
    </div>
  );
}

function ComingSoonCard({ provider }: { provider: "whatsapp" }) {
  const meta = CONNECTOR_META[provider];
  return (
    <div className="card p-6 flex flex-col gap-4" style={{ opacity: 0.65 }}>
      <div className="flex items-start justify-between">
        <div className="flex items-center gap-3">
          <span style={{ fontSize: 28 }}>{meta.icon}</span>
          <div>
            <h3 className="font-bold text-base">{meta.label}</h3>
            <span style={{ fontSize: 11, fontWeight: 600, color: "var(--muted)" }}>Coming in v0.3</span>
          </div>
        </div>
      </div>
      <p className="text-sm text-[var(--muted)]">{meta.description}</p>
      <button disabled className="btn text-sm" style={{ opacity: 0.4 }}>Coming soon</button>
    </div>
  );
}

export function ConnectorsClient({ connectors: initial, flashMsg }: Props) {
  const [connectors, setConnectors] = useState<Connector[]>(initial);

  function getConnector(provider: string) {
    return connectors.find(c => c.provider === provider);
  }

  async function handleDisconnect(id: string) {
    await disconnectConnector(id);
    setConnectors(c => c.filter(x => x.id !== id));
  }

  return (
    <div className="flex flex-col gap-6">
      {flashMsg && (
        <div style={{ background: "rgba(63,185,132,0.08)", border: "1px solid rgba(63,185,132,0.2)", borderRadius: 10, padding: "12px 16px" }}>
          <p className="text-sm font-semibold" style={{ color: "var(--success)" }}>✓ {flashMsg}</p>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <OAuthCard
          provider="google_sheets"
          meta={CONNECTOR_META.google_sheets}
          connector={getConnector("google_sheets")}
          onDisconnect={handleDisconnect}
        />
        <OAuthCard
          provider="quickbooks"
          meta={CONNECTOR_META.quickbooks}
          connector={getConnector("quickbooks")}
          onDisconnect={handleDisconnect}
        />
        <CustomApiCard
          connector={getConnector("custom_api")}
          onDisconnect={handleDisconnect}
        />
        <ComingSoonCard provider="whatsapp" />
      </div>

      <div className="card p-5" style={{ background: "var(--soft)" }}>
        <h4 className="font-bold text-sm mb-2">What happens when a connector is active?</h4>
        <ul className="text-sm text-[var(--muted)] space-y-1">
          <li>• <strong>Google Sheets:</strong> Felix (CFO) and Eden (CEO) can reference live spreadsheet data when you ask for analysis</li>
          <li>• <strong>QuickBooks:</strong> Felix automatically pulls your real P&amp;L, cash position, and expense breakdown — no copy-paste</li>
          <li>• <strong>Custom API:</strong> Any agent can query your endpoint for context before responding to your questions</li>
          <li>• <strong>WhatsApp:</strong> Use any agent via WhatsApp message — get your morning brief without opening a browser</li>
        </ul>
        <p className="text-xs text-[var(--muted)] mt-3">Connector credentials are encrypted and stored securely. Your agents never share them externally.</p>
      </div>
    </div>
  );
}
