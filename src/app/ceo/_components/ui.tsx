"use client";

/**
 * CEO Dashboard — shared UI primitives for the module.
 * Complements @/app/_components/dashboard-primitives (C, Stat, Panel).
 */

import { useState, type ReactNode, type FormEvent } from "react";
import { C } from "@/app/_components/dashboard-primitives";

export type Traffic = "green" | "yellow" | "red";

export const TRAFFIC_COLOR: Record<Traffic, string> = {
  green: C.green,
  yellow: C.amber,
  red: C.red,
};

export const TRAFFIC_LABEL: Record<Traffic, string> = {
  green: "HEALTHY",
  yellow: "WATCH",
  red: "RED",
};

export function TrafficBadge({
  status,
  label,
}: {
  status: Traffic;
  label?: string;
}) {
  const col = TRAFFIC_COLOR[status];
  return (
    <span
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: 6,
        fontSize: 11,
        fontWeight: 700,
        letterSpacing: "0.08em",
        padding: "4px 10px",
        borderRadius: 999,
        whiteSpace: "nowrap",
        color: col,
        background: `color-mix(in srgb, ${col} 14%, transparent)`,
      }}
    >
      ● {label ?? TRAFFIC_LABEL[status]}
    </span>
  );
}

export function SectionCard({
  title,
  note,
  children,
  tone,
}: {
  title: string;
  note?: string;
  children: ReactNode;
  tone?: Traffic;
}) {
  return (
    <section
      style={{
        background: C.panel,
        border: `1px solid ${tone ? `color-mix(in srgb, ${TRAFFIC_COLOR[tone]} 45%, transparent)` : C.line}`,
        borderRadius: 14,
        padding: 18,
        marginBottom: 16,
      }}
    >
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "baseline",
          marginBottom: 12,
          gap: 12,
          flexWrap: "wrap",
        }}
      >
        <div style={{ fontWeight: 700, fontSize: 15 }}>{title}</div>
        {note ? <div style={{ fontSize: 12, color: C.dim }}>{note}</div> : null}
      </div>
      {children}
    </section>
  );
}

export function Table({
  head,
  children,
}: {
  head: string[];
  children: ReactNode;
}) {
  return (
    <div style={{ overflowX: "auto" }}>
      <table
        style={{ width: "100%", borderCollapse: "collapse", fontSize: 12.5 }}
      >
        <thead>
          <tr>
            {head.map((h) => (
              <th
                key={h}
                style={{
                  textAlign: "left",
                  padding: "8px 10px",
                  color: C.dim,
                  fontSize: 11,
                  textTransform: "uppercase",
                  letterSpacing: "0.08em",
                  borderBottom: `1px solid ${C.line}`,
                  whiteSpace: "nowrap",
                }}
              >
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>{children}</tbody>
      </table>
    </div>
  );
}

export function Td({
  children,
  right,
  color,
}: {
  children: ReactNode;
  right?: boolean;
  color?: string;
}) {
  return (
    <td
      style={{
        padding: "9px 10px",
        borderBottom: `1px solid ${C.line}`,
        textAlign: right ? "right" : "left",
        color: color ?? C.text,
        fontVariantNumeric: "tabular-nums",
        whiteSpace: "nowrap",
      }}
    >
      {children}
    </td>
  );
}

const inputStyle: React.CSSProperties = {
  width: "100%",
  background: C.panel2,
  border: `1px solid ${C.line}`,
  borderRadius: 8,
  color: C.text,
  padding: "8px 10px",
  fontSize: 13,
};

export function Field({
  label,
  children,
  width,
}: {
  label: string;
  children: ReactNode;
  width?: number | string;
}) {
  return (
    <label
      style={{
        display: "block",
        width: width ?? "auto",
        flex: width ? undefined : "1 1 140px",
      }}
    >
      <div
        style={{
          fontSize: 11,
          color: C.dim,
          marginBottom: 4,
          letterSpacing: "0.04em",
        }}
      >
        {label}
      </div>
      {children}
    </label>
  );
}

export function TextInput(props: React.InputHTMLAttributes<HTMLInputElement>) {
  return <input {...props} style={{ ...inputStyle, ...props.style }} />;
}

export function NumInput(props: React.InputHTMLAttributes<HTMLInputElement>) {
  return (
    <input
      type="number"
      step="any"
      inputMode="decimal"
      {...props}
      style={{ ...inputStyle, textAlign: "right", ...props.style }}
    />
  );
}

export function Select(props: React.SelectHTMLAttributes<HTMLSelectElement>) {
  return <select {...props} style={{ ...inputStyle, ...props.style }} />;
}

export function FormGrid({ children }: { children: ReactNode }) {
  return (
    <div
      style={{
        display: "flex",
        flexWrap: "wrap",
        gap: 10,
        alignItems: "flex-end",
      }}
    >
      {children}
    </div>
  );
}

/**
 * Wraps a form around a server action call: handles pending state,
 * surfaces the returned error, refreshes on success via router.refresh()
 * done by the caller through onDone.
 */
export function ActionForm({
  onSubmit,
  submitLabel,
  children,
  onDone,
  confirmText,
}: {
  onSubmit: () => Promise<{ ok: true } | { ok: false; error: string }>;
  submitLabel: string;
  children?: ReactNode;
  onDone?: () => void;
  confirmText?: string;
}) {
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  async function handle(e: FormEvent) {
    e.preventDefault();
    if (confirmText && !window.confirm(confirmText)) return;
    setPending(true);
    setError(null);
    setSaved(false);
    const res = await onSubmit();
    setPending(false);
    if (res.ok) {
      setSaved(true);
      onDone?.();
      setTimeout(() => setSaved(false), 2500);
    } else {
      setError(res.error);
    }
  }

  return (
    <form onSubmit={handle} style={{ display: "grid", gap: 10 }}>
      {children}
      <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
        <button
          type="submit"
          disabled={pending}
          style={{
            background: C.gold,
            color: "#101318",
            fontWeight: 700,
            fontSize: 13,
            border: 0,
            borderRadius: 8,
            padding: "9px 16px",
            cursor: pending ? "wait" : "pointer",
            opacity: pending ? 0.6 : 1,
          }}
        >
          {pending ? "Saving…" : submitLabel}
        </button>
        {saved ? (
          <span style={{ color: C.green, fontSize: 12, fontWeight: 600 }}>
            Saved ✓
          </span>
        ) : null}
        {error ? (
          <span style={{ color: C.red, fontSize: 12 }}>{error}</span>
        ) : null}
      </div>
    </form>
  );
}

export function GhostButton({
  onClick,
  children,
  danger,
}: {
  onClick: () => void | Promise<void>;
  children: ReactNode;
  danger?: boolean;
}) {
  const [busy, setBusy] = useState(false);
  return (
    <button
      type="button"
      disabled={busy}
      onClick={async () => {
        setBusy(true);
        await onClick();
        setBusy(false);
      }}
      style={{
        background: "transparent",
        border: `1px solid ${C.line}`,
        color: danger ? C.red : C.dim,
        borderRadius: 7,
        padding: "5px 10px",
        fontSize: 12,
        cursor: busy ? "wait" : "pointer",
        opacity: busy ? 0.5 : 1,
      }}
    >
      {children}
    </button>
  );
}

/** Attainment bar with traffic colouring. */
export function AttainBar({ pct, status }: { pct: number; status: Traffic }) {
  return (
    <div
      style={{
        height: 5,
        background: C.panel2,
        borderRadius: 99,
        overflow: "hidden",
      }}
    >
      <div
        style={{
          height: "100%",
          width: `${Math.max(2, Math.min(100, pct))}%`,
          background: TRAFFIC_COLOR[status],
          borderRadius: 99,
        }}
      />
    </div>
  );
}
