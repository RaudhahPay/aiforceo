"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { createCustomAgent } from "@/server/actions/custom-agents";

const GRADIENT_PRESETS = [
  { from: "#6366F1", to: "#8B5CF6", name: "Purple" },
  { from: "#0096C7", to: "#00BFFF", name: "Blue" },
  { from: "#F96167", to: "#FF9966", name: "Coral" },
  { from: "#2A9D8F", to: "#43BBAA", name: "Teal" },
  { from: "#F0B429", to: "#F8D66D", name: "Gold" },
  { from: "#E76F51", to: "#F4A261", name: "Orange" },
];

const SYSTEM_PROMPT_TEMPLATES = [
  {
    label: "Legal Advisor",
    prompt: `You are a legal advisor AI for this business. Specialties:
- Contract review and red-flag identification
- GDPR / PDPA compliance guidance
- Employment law basics (hiring, termination, NDAs)
- Business structure and regulatory requirements
- Dispute resolution and escalation paths
Always remind the owner that you provide general guidance only, and recommend professional legal counsel for high-stakes decisions.`,
  },
  {
    label: "HR Manager",
    prompt: `You are an AI HR Manager for this business. Specialties:
- Job description writing and interview question generation
- Employee handbook creation and policy drafting
- Performance review frameworks
- Compensation benchmarking guidance
- Onboarding and offboarding checklists
- Conflict resolution frameworks`,
  },
  {
    label: "Customer Success",
    prompt: `You are an AI Customer Success Manager for this business. Specialties:
- Customer health scoring and churn prediction signals
- Success playbook creation for different customer segments
- Escalation handling scripts
- Renewal and upsell conversation frameworks
- NPS / CSAT survey design and analysis
- Support ticket triage and response templates`,
  },
];

export function NewAgentClient() {
  const router = useRouter();
  const [form, setForm] = useState({
    name: "",
    title: "",
    description: "",
    system_prompt: "",
    gradient_from: GRADIENT_PRESETS[0]!.from,
    gradient_to: GRADIENT_PRESETS[0]!.to,
  });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  function field(k: keyof typeof form) {
    return (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) =>
      setForm((f) => ({ ...f, [k]: e.target.value }));
  }

  function setGradient(from: string, to: string) {
    setForm((f) => ({ ...f, gradient_from: from, gradient_to: to }));
  }

  function applyTemplate(template: typeof SYSTEM_PROMPT_TEMPLATES[0]) {
    setForm((f) => ({ ...f, system_prompt: template.prompt }));
  }

  async function save(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError("");
    const res = await createCustomAgent(form);
    setSaving(false);
    if (!res.ok) { setError(res.error); return; }
    router.push("/agents");
  }

  const previewGrad = `linear-gradient(135deg, ${form.gradient_from}, ${form.gradient_to})`;

  return (
    <main className="min-h-screen p-10 max-w-2xl mx-auto">
      <Link href="/agents" className="text-sm text-[var(--muted)] mb-6 inline-block">
        ← Back to AI Executives
      </Link>
      <h1 className="serif text-3xl mb-1">Create a custom agent</h1>
      <p className="text-sm text-[var(--muted)] mb-8">
        Build an AI specialist with any expertise your business needs.
      </p>

      <form onSubmit={(e) => void save(e)} className="flex flex-col gap-6">
        {/* Preview + name */}
        <div className="card p-6 flex gap-5 items-start">
          <div style={{
            width: 60, height: 60, borderRadius: 16, flexShrink: 0,
            background: previewGrad,
            display: "flex", alignItems: "center", justifyContent: "center",
            fontWeight: 700, fontSize: 22, color: "#fff",
          }}>
            {form.name[0]?.toUpperCase() || "?"}
          </div>
          <div style={{ flex: 1 }}>
            <input required value={form.name} onChange={field("name")}
              placeholder="Agent name (e.g. Alex, Dana)"
              className="input text-lg font-bold mb-2" maxLength={40} />
            <input required value={form.title} onChange={field("title")}
              placeholder="Title (e.g. AI Legal Advisor)"
              className="input text-sm" maxLength={60} />
          </div>
        </div>

        {/* Gradient picker */}
        <div className="card p-5">
          <label className="text-xs font-bold text-[var(--muted)] uppercase tracking-widest block mb-3">
            Avatar colour
          </label>
          <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
            {GRADIENT_PRESETS.map((p) => (
              <button
                key={p.from}
                type="button"
                onClick={() => setGradient(p.from, p.to)}
                style={{
                  width: 36, height: 36, borderRadius: 10,
                  background: `linear-gradient(135deg, ${p.from}, ${p.to})`,
                  border: form.gradient_from === p.from ? "3px solid var(--ink)" : "3px solid transparent",
                  cursor: "pointer",
                }}
                title={p.name}
              />
            ))}
          </div>
        </div>

        {/* Description */}
        <div className="flex flex-col gap-2">
          <label className="text-xs font-bold text-[var(--muted)] uppercase tracking-widest">
            Short description (shown in sidebar)
          </label>
          <input value={form.description} onChange={field("description")}
            placeholder="e.g. Contract review & compliance" className="input text-sm" maxLength={200} />
        </div>

        {/* System prompt */}
        <div className="flex flex-col gap-2">
          <div className="flex items-center justify-between">
            <label className="text-xs font-bold text-[var(--muted)] uppercase tracking-widest">
              System prompt *
            </label>
            <div style={{ display: "flex", gap: 6 }}>
              {SYSTEM_PROMPT_TEMPLATES.map((t) => (
                <button
                  key={t.label}
                  type="button"
                  className="btn btn-ghost text-xs"
                  onClick={() => applyTemplate(t)}
                  style={{ padding: "4px 10px" }}
                >
                  {t.label}
                </button>
              ))}
            </div>
          </div>
          <textarea
            required
            value={form.system_prompt}
            onChange={field("system_prompt")}
            className="input text-sm"
            style={{ minHeight: 200, resize: "vertical" }}
            placeholder="You are an AI specialist for this business. Describe exactly what this agent does, its areas of expertise, and how it should respond..."
            minLength={20}
            maxLength={4000}
          />
          <p className="text-xs text-[var(--muted)]">
            {form.system_prompt.length} / 4000 · The business profile and brand voice are automatically injected before this prompt.
          </p>
        </div>

        {error && (
          <p style={{ fontSize: 13, fontWeight: 600, color: "var(--red)" }}>⚠ {error}</p>
        )}

        <div style={{ display: "flex", gap: 12 }}>
          <button type="submit" className="btn" disabled={saving}>
            {saving ? "Creating…" : "Create agent →"}
          </button>
          <Link href="/agents" className="btn btn-ghost" style={{ textDecoration: "none" }}>
            Cancel
          </Link>
        </div>
      </form>
    </main>
  );
}
