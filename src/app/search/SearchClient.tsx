"use client";

import { useState } from "react";
import Link from "next/link";
import { searchConversations, type SearchResult } from "@/server/actions/search";
// AGENTS imported for potential future use (agent icon display)
// import { AGENTS } from "@/lib/prompts";

const ROLE_LABEL: Record<string, string> = {
  cmo: "Maya · CMO",
  coo: "Owen · COO",
  cfo: "Felix · CFO",
  ceo: "Eden · CEO",
  cto: "Tariq · CTO",
  aria: "Aria · Chief of Staff",
};

export function SearchClient() {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<SearchResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [searched, setSearched] = useState(false);

  async function handleSearch(e: React.FormEvent) {
    e.preventDefault();
    if (!query.trim()) return;
    setLoading(true);
    setSearched(true);
    const res = await searchConversations(query);
    setResults(res);
    setLoading(false);
  }

  return (
    <main className="min-h-screen p-10 max-w-3xl mx-auto">
      <Link href="/dashboard" className="text-sm text-[var(--muted)] mb-6 inline-block">
        ← Dashboard
      </Link>
      <h1 className="serif text-3xl mb-2">Search conversations</h1>
      <p className="text-sm text-[var(--muted)] mb-6">
        Find anything your AI executives have ever said or you have asked.
      </p>

      <form onSubmit={(e) => void handleSearch(e)} className="flex gap-3 mb-8">
        <input
          type="search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search all conversations… (e.g. cash flow, marketing, SOP)"
          className="input flex-1"
          autoFocus
        />
        <button type="submit" className="btn" disabled={loading || !query.trim()}>
          {loading ? "…" : "Search"}
        </button>
      </form>

      {loading && (
        <div className="text-center text-[var(--muted)] py-12">Searching…</div>
      )}

      {!loading && searched && results.length === 0 && (
        <div className="card p-8 text-center">
          <p style={{ fontSize: 24, marginBottom: 8 }}>🔍</p>
          <p className="font-semibold mb-1">No results for &ldquo;{query}&rdquo;</p>
          <p className="text-sm text-[var(--muted)]">Try different keywords or shorter phrases.</p>
        </div>
      )}

      {!loading && results.length > 0 && (
        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          <p className="text-sm text-[var(--muted)] mb-1">{results.length} result{results.length !== 1 ? "s" : ""}</p>
          {results.map((r) => {
            const roleLabel = ROLE_LABEL[r.agentRole] ?? r.agentRole.toUpperCase();
            const isAgent = r.role === "assistant";
            return (
              <Link
                key={r.messageId}
                href={`/agent/${r.agentRole}?conv=${r.conversationId}`}
                className="card"
                style={{ padding: "14px 18px", textDecoration: "none", display: "block" }}
              >
                <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 6 }}>
                  <span style={{
                    fontSize: 11, fontWeight: 700, padding: "2px 8px", borderRadius: 20,
                    background: isAgent ? "rgba(240,180,41,0.12)" : "rgba(139,92,246,0.12)",
                    color: isAgent ? "var(--gold)" : "#8B5CF6",
                  }}>
                    {isAgent ? roleLabel : "You"}
                  </span>
                  <span style={{ fontSize: 11, color: "var(--muted)" }}>
                    {new Date(r.createdAt).toLocaleDateString("en-MY", { day: "numeric", month: "short", year: "numeric" })}
                  </span>
                </div>
                <p style={{ margin: 0, fontSize: 13, lineHeight: 1.6, color: "var(--ink)" }}>
                  {r.headline}
                </p>
              </Link>
            );
          })}
        </div>
      )}
    </main>
  );
}
