"use client";

import { useState, useEffect } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { updateCustomAgent, getCustomAgents, type CustomAgent } from "@/server/actions/custom-agents";

const GRADIENT_PRESETS = [
  { from: "#6366F1", to: "#8B5CF6" },
  { from: "#0096C7", to: "#00BFFF" },
  { from: "#F96167", to: "#FF9966" },
  { from: "#2A9D8F", to: "#43BBAA" },
  { from: "#C5A572", to: "#E2C28F" },
  { from: "#E76F51", to: "#F4A261" },
];

export default function EditAgentPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const [agent, setAgent] = useState<CustomAgent | null>(null);
  const [form, setForm] = useState({
    name: "", title: "", description: "", system_prompt: "",
    gradient_from: GRADIENT_PRESETS[0]!.from, gradient_to: GRADIENT_PRESETS[0]!.to,
  });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    void getCustomAgents().then((agents) => {
      const a = agents.find((ag) => ag.id === id);
      if (a) {
        setAgent(a);
        setForm({ name: a.name, title: a.title, description: a.description,
          system_prompt: a.system_prompt, gradient_from: a.gradient_from, gradient_to: a.gradient_to });
      }
      setLoaded(true);
    });
  }, [id]);

  function field(k: keyof typeof form) {
    return (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) =>
      setForm((f) => ({ ...f, [k]: e.target.value }));
  }

  async function save(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true); setError("");
    const res = await updateCustomAgent(id, form);
    setSaving(false);
    if (!res.ok) { setError(res.error); return; }
    router.push("/agents");
  }

  if (!loaded) return <main className="p-10 text-[var(--muted)]">Loading…</main>;
  if (!agent) return <main className="p-10 text-[var(--red)]">Agent not found.</main>;

  const previewGrad = `linear-gradient(135deg, ${form.gradient_from}, ${form.gradient_to})`;

  return (
    <main className="min-h-screen p-10 max-w-2xl mx-auto">
      <Link href="/agents" className="text-sm text-[var(--muted)] mb-6 inline-block">← Back to AI Executives</Link>
      <h1 className="serif text-3xl mb-1">Edit {agent.name}</h1>
      <p className="text-sm text-[var(--muted)] mb-8">Update this custom agent&apos;s persona and system prompt.</p>

      <form onSubmit={(e) => void save(e)} className="flex flex-col gap-6">
        <div className="card p-6 flex gap-5 items-start">
          <div style={{ width: 60, height: 60, borderRadius: 16, flexShrink: 0, background: previewGrad, display: "flex", alignItems: "center", justifyContent: "center", fontWeight: 700, fontSize: 22, color: "#fff" }}>
            {form.name[0]?.toUpperCase() || "?"}
          </div>
          <div style={{ flex: 1 }}>
            <input required value={form.name} onChange={field("name")} placeholder="Agent name" className="input text-lg font-bold mb-2" maxLength={40} />
            <input required value={form.title} onChange={field("title")} placeholder="Title" className="input text-sm" maxLength={60} />
          </div>
        </div>

        <div className="card p-5">
          <label className="text-xs font-bold text-[var(--muted)] uppercase tracking-widest block mb-3">Avatar colour</label>
          <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
            {GRADIENT_PRESETS.map((p) => (
              <button key={p.from} type="button" onClick={() => setForm((f) => ({ ...f, gradient_from: p.from, gradient_to: p.to }))}
                style={{ width: 36, height: 36, borderRadius: 10, background: `linear-gradient(135deg, ${p.from}, ${p.to})`, border: form.gradient_from === p.from ? "3px solid var(--ink)" : "3px solid transparent", cursor: "pointer" }} />
            ))}
          </div>
        </div>

        <div className="flex flex-col gap-2">
          <label className="text-xs font-bold text-[var(--muted)] uppercase tracking-widest">Short description</label>
          <input value={form.description} onChange={field("description")} placeholder="e.g. Contract review & compliance" className="input text-sm" maxLength={200} />
        </div>

        <div className="flex flex-col gap-2">
          <label className="text-xs font-bold text-[var(--muted)] uppercase tracking-widest">System prompt *</label>
          <textarea required value={form.system_prompt} onChange={field("system_prompt")} className="input text-sm" style={{ minHeight: 200, resize: "vertical" }} minLength={20} maxLength={4000} />
          <p className="text-xs text-[var(--muted)]">{form.system_prompt.length} / 4000</p>
        </div>

        {error && <p style={{ fontSize: 13, fontWeight: 600, color: "var(--red)" }}>⚠ {error}</p>}

        <div style={{ display: "flex", gap: 12 }}>
          <button type="submit" className="btn" disabled={saving}>{saving ? "Saving…" : "Save changes"}</button>
          <Link href="/agents" className="btn btn-ghost" style={{ textDecoration: "none" }}>Cancel</Link>
        </div>
      </form>
    </main>
  );
}
