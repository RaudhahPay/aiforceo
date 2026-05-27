"use client";

import { useState } from "react";
import Link from "next/link";

const TIER_PILL: Record<string, string> = {
  trial: "bg-gray-100 text-gray-600",
  starter: "bg-blue-100 text-blue-700",
  growth: "bg-purple-100 text-purple-700",
  scale: "bg-orange-100 text-orange-700",
};

export type CustomerRow = {
  id: string;
  name: string;
  email: string | null;
  fullName: string | null;
  tier: string;
  tokensMtd: number;
  onboarded: boolean;
  createdAt: string;
  stripeCustomerId: string | null;
};

export function CustomersClient({ rows }: { rows: CustomerRow[] }) {
  const [query, setQuery] = useState("");
  const [tierFilter, setTierFilter] = useState<string>("all");
  const [sort, setSort] = useState<"newest" | "oldest" | "tokens">("newest");

  const filtered = rows
    .filter((r) => {
      const q = query.toLowerCase();
      if (
        q &&
        !r.name.toLowerCase().includes(q) &&
        !(r.email ?? "").toLowerCase().includes(q)
      )
        return false;
      if (tierFilter !== "all" && r.tier !== tierFilter) return false;
      return true;
    })
    .sort((a, b) => {
      if (sort === "tokens") return b.tokensMtd - a.tokensMtd;
      if (sort === "oldest") return a.createdAt.localeCompare(b.createdAt);
      return b.createdAt.localeCompare(a.createdAt);
    });

  return (
    <div>
      {/* Toolbar */}
      <div className="flex flex-wrap gap-3 mb-5 items-center">
        <input
          type="text"
          placeholder="Search by name or email…"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          className="input text-sm"
          style={{ maxWidth: 260 }}
        />
        <select
          value={tierFilter}
          onChange={(e) => setTierFilter(e.target.value)}
          className="input text-sm"
          style={{ maxWidth: 140 }}
        >
          <option value="all">All tiers</option>
          <option value="trial">Trial</option>
          <option value="starter">Starter</option>
          <option value="growth">Growth</option>
          <option value="scale">Scale</option>
        </select>
        <select
          value={sort}
          onChange={(e) => setSort(e.target.value as typeof sort)}
          className="input text-sm"
          style={{ maxWidth: 160 }}
        >
          <option value="newest">Newest first</option>
          <option value="oldest">Oldest first</option>
          <option value="tokens">Most active (MTD)</option>
        </select>
        <span className="text-xs text-[var(--muted)] ml-auto">
          {filtered.length} of {rows.length}
        </span>
      </div>

      {/* Table */}
      <div className="card overflow-hidden p-0">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead style={{ background: "var(--soft)" }}>
              <tr>
                {[
                  "Company",
                  "Owner",
                  "Tier",
                  "Tokens (MTD)",
                  "Onboarded",
                  "Joined",
                  "",
                ].map((h) => (
                  <th
                    key={h}
                    className="text-left px-4 py-3 text-[11px] font-bold uppercase tracking-wider text-[var(--muted)]"
                  >
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-[var(--line)]">
              {filtered.length === 0 ? (
                <tr>
                  <td
                    colSpan={7}
                    className="px-4 py-8 text-center text-sm text-[var(--muted)]"
                  >
                    No results.
                  </td>
                </tr>
              ) : (
                filtered.map((r) => (
                  <tr
                    key={r.id}
                    className="hover:bg-[var(--soft)] transition-colors"
                  >
                    <td className="px-4 py-3 font-semibold">{r.name}</td>
                    <td className="px-4 py-3">
                      <div className="text-sm truncate max-w-[180px]">
                        {r.fullName && (
                          <span className="font-medium">{r.fullName} · </span>
                        )}
                        <span className="text-[var(--muted)]">
                          {r.email ?? "—"}
                        </span>
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <span
                        className={`px-2.5 py-1 rounded-full text-[11px] font-bold uppercase ${TIER_PILL[r.tier] ?? "bg-gray-100 text-gray-600"}`}
                      >
                        {r.tier}
                      </span>
                    </td>
                    <td className="px-4 py-3 tabular-nums">
                      {r.tokensMtd > 0 ? fmtNum(r.tokensMtd) : "—"}
                    </td>
                    <td className="px-4 py-3">
                      <span
                        className={`inline-flex items-center gap-1.5 text-xs font-medium ${r.onboarded ? "text-[var(--success)]" : "text-[var(--muted)]"}`}
                      >
                        <span
                          className={`w-1.5 h-1.5 rounded-full ${r.onboarded ? "bg-[var(--success)]" : "bg-gray-300"}`}
                        />
                        {r.onboarded ? "Yes" : "No"}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-[var(--muted)] whitespace-nowrap text-xs">
                      {new Date(r.createdAt).toLocaleDateString("en-MY", {
                        day: "numeric",
                        month: "short",
                        year: "numeric",
                      })}
                    </td>
                    <td className="px-4 py-3">
                      <Link
                        href={`/admin/customers/${r.id}`}
                        className="text-xs font-semibold text-[var(--accent)] hover:underline"
                      >
                        Manage →
                      </Link>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

function fmtNum(n: number): string {
  if (n >= 1_000_000) return (n / 1_000_000).toFixed(1) + "M";
  if (n >= 1_000) return (n / 1_000).toFixed(0) + "K";
  return String(n);
}
