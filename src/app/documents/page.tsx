"use client";

import { useState, useEffect, useRef } from "react";
import Link from "next/link";
import { listDocuments, uploadDocument, deleteDocument, type Document } from "@/server/actions/documents";

const TYPE_ICON: Record<string, string> = {
  "application/pdf": "📄",
  "image/jpeg": "🖼️",
  "image/png": "🖼️",
  "image/webp": "🖼️",
  "image/gif": "🖼️",
  "text/plain": "📝",
  "text/csv": "📊",
  "text/markdown": "📝",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document": "📃",
};

const TYPE_LABEL: Record<string, string> = {
  "application/pdf": "PDF",
  "image/jpeg": "Image",
  "image/png": "Image",
  "image/webp": "Image",
  "image/gif": "Image",
  "text/plain": "Text",
  "text/csv": "CSV",
  "text/markdown": "Markdown",
};

function fmtSize(bytes: number): string {
  if (bytes >= 1_000_000) return (bytes / 1_000_000).toFixed(1) + " MB";
  if (bytes >= 1_000) return (bytes / 1_000).toFixed(0) + " KB";
  return bytes + " B";
}

export default function DocumentsPage() {
  const [docs, setDocs] = useState<Document[]>([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [filter, setFilter] = useState<"all" | "user" | "agent">("all");
  const [error, setError] = useState("");
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    void listDocuments().then((d) => { setDocs(d); setLoading(false); });
  }, []);

  async function handleUpload(files: FileList) {
    setUploading(true);
    setError("");
    for (const file of Array.from(files)) {
      const fd = new FormData();
      fd.append("file", file);
      const res = await uploadDocument(fd);
      if (!res.ok) { setError(res.error); break; }
    }
    const updated = await listDocuments();
    setDocs(updated);
    setUploading(false);
  }

  async function handleDelete(id: string) {
    if (!confirm("Delete this document? This cannot be undone.")) return;
    setDocs((d) => d.filter((doc) => doc.id !== id));
    await deleteDocument(id);
  }

  const filtered = filter === "all" ? docs
    : filter === "user" ? docs.filter((d) => !d.source_agent)
    : docs.filter((d) => !!d.source_agent);

  return (
    <main className="min-h-screen p-10 max-w-5xl mx-auto">
      <Link href="/dashboard" className="text-sm text-[var(--muted)] mb-6 inline-block">
        ← Dashboard
      </Link>

      <div className="flex items-start justify-between mb-8">
        <div>
          <h1 className="serif text-3xl">Document Vault</h1>
          <p className="text-sm text-[var(--muted)] mt-1">
            Shared documents accessible by all your AI executives.
          </p>
        </div>
        <div style={{ display: "flex", gap: 8 }}>
          <input
            ref={fileInputRef}
            type="file"
            multiple
            style={{ display: "none" }}
            onChange={(e) => { if (e.target.files?.length) void handleUpload(e.target.files); e.target.value = ""; }}
          />
          <button
            className="btn"
            onClick={() => fileInputRef.current?.click()}
            disabled={uploading}
          >
            {uploading ? "Uploading…" : "📎 Upload document"}
          </button>
        </div>
      </div>

      {/* Filters */}
      <div style={{ display: "flex", gap: 8, marginBottom: 20 }}>
        {(["all", "user", "agent"] as const).map((f) => (
          <button
            key={f}
            onClick={() => setFilter(f)}
            style={{
              padding: "5px 14px", borderRadius: 20, fontSize: 12, fontWeight: 600,
              border: "1px solid var(--line)", cursor: "pointer",
              background: filter === f ? "var(--accent)" : "var(--soft)",
              color: filter === f ? "#fff" : "var(--muted)",
            }}
          >
            {f === "all" ? "All" : f === "user" ? "📎 Uploaded" : "🤖 AI Generated"}
          </button>
        ))}
        <span style={{ marginLeft: "auto", fontSize: 12, color: "var(--muted)", alignSelf: "center" }}>
          {filtered.length} document{filtered.length !== 1 ? "s" : ""}
        </span>
      </div>

      {error && (
        <div style={{ padding: "10px 14px", background: "rgba(229,84,75,0.1)", border: "1px solid rgba(229,84,75,0.3)", borderRadius: 10, marginBottom: 16 }}>
          <p style={{ fontSize: 13, color: "var(--red)", fontWeight: 600, margin: 0 }}>⚠ {error}</p>
        </div>
      )}

      {loading ? (
        <p className="text-center text-[var(--muted)] py-12">Loading documents…</p>
      ) : filtered.length === 0 ? (
        <div className="card p-12 text-center" style={{ border: "2px dashed var(--line)" }}>
          <p style={{ fontSize: 40, marginBottom: 12 }}>📂</p>
          <h3 style={{ margin: "0 0 8px", fontSize: 18, fontWeight: 700 }}>
            {docs.length === 0 ? "No documents yet" : "No matching documents"}
          </h3>
          <p style={{ margin: "0 0 20px", fontSize: 13, color: "var(--muted)" }}>
            Upload files here or ask any AI executive to generate a document — it will appear automatically.
          </p>
          <button className="btn" onClick={() => fileInputRef.current?.click()}>
            Upload your first document
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filtered.map((doc) => (
            <div key={doc.id} className="card p-5 flex flex-col gap-3">
              <div style={{ display: "flex", alignItems: "flex-start", gap: 12 }}>
                <span style={{ fontSize: 32, lineHeight: 1 }}>
                  {TYPE_ICON[doc.mime_type] ?? "📁"}
                </span>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <p style={{ margin: 0, fontWeight: 700, fontSize: 14, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                    {doc.name}
                  </p>
                  <p style={{ margin: "2px 0 0", fontSize: 11, color: "var(--muted)" }}>
                    {TYPE_LABEL[doc.mime_type] ?? doc.mime_type.split("/")[1]} · {fmtSize(doc.size)}
                  </p>
                </div>
              </div>

              {doc.description && (
                <p style={{ margin: 0, fontSize: 12, color: "var(--muted)", lineHeight: 1.4 }}>
                  {doc.description}
                </p>
              )}

              <div style={{ display: "flex", alignItems: "center", gap: 6, marginTop: "auto" }}>
                {doc.source_agent ? (
                  <span style={{ fontSize: 10, fontWeight: 700, padding: "2px 8px", borderRadius: 20, background: "rgba(24,119,242,0.12)", color: "var(--accent)" }}>
                    🤖 {doc.source_agent.toUpperCase()}
                  </span>
                ) : (
                  <span style={{ fontSize: 10, fontWeight: 700, padding: "2px 8px", borderRadius: 20, background: "rgba(176,179,184,0.12)", color: "var(--muted)" }}>
                    📎 Uploaded
                  </span>
                )}
                <span style={{ fontSize: 10, color: "var(--muted)" }}>
                  {new Date(doc.created_at).toLocaleDateString("en-MY", { day: "numeric", month: "short" })}
                </span>
                <button
                  onClick={() => void handleDelete(doc.id)}
                  style={{ marginLeft: "auto", background: "none", border: "none", cursor: "pointer", color: "var(--muted)", fontSize: 14, padding: "2px 4px" }}
                  title="Delete document"
                >×</button>
              </div>
            </div>
          ))}
        </div>
      )}
    </main>
  );
}
