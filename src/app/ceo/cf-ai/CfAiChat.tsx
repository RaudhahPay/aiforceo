"use client";

/**
 * Ask CF ai — chat panel. Client keeps the short history and passes it
 * back on each ask so CF ai can follow the thread; the server re-grounds
 * every answer in a fresh group brief.
 */

import { useState, useRef, useEffect, type FormEvent } from "react";
import { C } from "@/app/_components/dashboard-primitives";
import { askCfAi } from "@/server/actions/cf-ai";

type Msg = { role: "user" | "assistant"; content: string };

const SUGGESTIONS = [
  "What needs my attention today?",
  "How is our cash position across the group?",
  "Which venture is weakest right now, and why?",
  "What is missing from this month's reporting?",
];

export default function CfAiChat() {
  const [messages, setMessages] = useState<Msg[]>([]);
  const [input, setInput] = useState("");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, pending]);

  async function ask(question: string) {
    const q = question.trim();
    if (!q || pending) return;
    setError(null);
    setPending(true);
    setInput("");
    const nextMessages: Msg[] = [...messages, { role: "user", content: q }];
    setMessages(nextMessages);

    const res = await askCfAi({
      question: q,
      // last 6 turns is plenty of thread; every answer is re-grounded anyway
      history: nextMessages.slice(-7, -1),
    });
    setPending(false);
    if (res.ok) {
      setMessages([
        ...nextMessages,
        { role: "assistant", content: res.answer },
      ]);
    } else {
      setError(res.error);
      setMessages(messages); // roll back the unanswered question
      setInput(q);
    }
  }

  function onSubmit(e: FormEvent) {
    e.preventDefault();
    void ask(input);
  }

  return (
    <div style={{ display: "grid", gap: 12 }}>
      {messages.length === 0 ? (
        <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
          {SUGGESTIONS.map((s) => (
            <button
              key={s}
              type="button"
              onClick={() => void ask(s)}
              disabled={pending}
              style={{
                background: "transparent",
                border: `1px solid ${C.line}`,
                color: C.dim,
                borderRadius: 999,
                padding: "7px 13px",
                fontSize: 12.5,
                cursor: pending ? "wait" : "pointer",
              }}
            >
              {s}
            </button>
          ))}
        </div>
      ) : (
        <div
          style={{
            display: "grid",
            gap: 10,
            maxHeight: 420,
            overflowY: "auto",
            paddingRight: 4,
          }}
        >
          {messages.map((m, i) => (
            <div
              key={i}
              style={{
                justifySelf: m.role === "user" ? "end" : "start",
                maxWidth: "85%",
                background:
                  m.role === "user"
                    ? `color-mix(in srgb, ${C.gold} 12%, transparent)`
                    : C.panel2,
                border: `1px solid ${
                  m.role === "user"
                    ? `color-mix(in srgb, ${C.gold} 35%, transparent)`
                    : C.line
                }`,
                borderRadius: 12,
                padding: "10px 14px",
                fontSize: 13.5,
                lineHeight: 1.55,
                whiteSpace: "pre-wrap",
              }}
            >
              {m.role === "assistant" ? (
                <div
                  style={{
                    fontSize: 10.5,
                    fontWeight: 700,
                    letterSpacing: "0.1em",
                    color: C.gold,
                    marginBottom: 5,
                  }}
                >
                  CF AI
                </div>
              ) : null}
              {m.content}
            </div>
          ))}
          {pending ? (
            <div style={{ color: C.dim, fontSize: 12.5 }}>
              CF ai is reading the group numbers…
            </div>
          ) : null}
          <div ref={bottomRef} />
        </div>
      )}

      {error ? (
        <div style={{ color: C.red, fontSize: 12.5 }}>{error}</div>
      ) : null}

      <form onSubmit={onSubmit} style={{ display: "flex", gap: 8 }}>
        <input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="Ask CF ai about the group…"
          maxLength={600}
          style={{
            flex: 1,
            background: C.panel2,
            border: `1px solid ${C.line}`,
            borderRadius: 10,
            color: C.text,
            padding: "11px 14px",
            fontSize: 13.5,
          }}
        />
        <button
          type="submit"
          disabled={pending || input.trim().length < 2}
          style={{
            background: C.gold,
            color: "#101318",
            fontWeight: 700,
            fontSize: 13,
            border: 0,
            borderRadius: 10,
            padding: "0 18px",
            cursor: pending ? "wait" : "pointer",
            opacity: pending || input.trim().length < 2 ? 0.6 : 1,
          }}
        >
          {pending ? "…" : "Ask"}
        </button>
      </form>

      <div style={{ color: C.dim, fontSize: 11.5 }}>
        CF ai is in advisor mode: it analyses and recommends from your dashboard
        data only. Decisions stay with you.
      </div>
    </div>
  );
}
