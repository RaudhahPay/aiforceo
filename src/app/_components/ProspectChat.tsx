"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";

type Msg = { role: "user" | "assistant"; content: string };

const INITIAL_MESSAGES: Msg[] = [
  {
    role: "assistant",
    content:
      "What's costing you the most right now — revenue you're not capturing, or costs you can't see clearly?",
  },
];

// Render message content with markdown-style links: [text](url)
function MessageContent({ content }: { content: string }) {
  const parts = content.split(/(\[[^\]]+\]\([^)]+\))/g);
  return (
    <>
      {parts.map((part, i) => {
        const match = part.match(/^\[([^\]]+)\]\(([^)]+)\)$/);
        if (match && match[1] && match[2]) {
          return (
            <Link
              key={i}
              href={match[2]}
              className="underline font-semibold"
              style={{ color: "#7C3AED" }}
            >
              {match[1]}
            </Link>
          );
        }
        return <span key={i}>{part}</span>;
      })}
    </>
  );
}

export function ProspectChat() {
  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState<Msg[]>(INITIAL_MESSAGES);
  const [input, setInput] = useState("");
  const [streaming, setStreaming] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (open) {
      bottomRef.current?.scrollIntoView({ behavior: "smooth" });
      inputRef.current?.focus();
    }
  }, [open, messages]);

  async function send() {
    const text = input.trim();
    if (!text || streaming) return;
    setInput("");

    const userMsg: Msg = { role: "user", content: text };
    const nextMessages: Msg[] = [...messages, userMsg];
    setMessages([...nextMessages, { role: "assistant", content: "" }]);
    setStreaming(true);

    try {
      const res = await fetch("/api/chat/prospect", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ messages: nextMessages }),
      });

      if (!res.ok) {
        const err = await res.text().catch(() => "Error");
        setMessages((cur) => {
          const copy = [...cur];
          copy[copy.length - 1] = {
            role: "assistant",
            content: `Sorry, something went wrong. (${err})`,
          };
          return copy;
        });
        return;
      }

      const reader = res.body?.getReader();
      if (!reader) return;

      const dec = new TextDecoder();
      let acc = "";
      for (;;) {
        const { value, done } = await reader.read();
        if (done) break;
        acc += dec.decode(value, { stream: true });
        setMessages((cur) => {
          const copy = [...cur];
          copy[copy.length - 1] = { role: "assistant", content: acc };
          return copy;
        });
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Network error";
      setMessages((cur) => {
        const copy = [...cur];
        copy[copy.length - 1] = {
          role: "assistant",
          content: `Sorry — ${msg}`,
        };
        return copy;
      });
    } finally {
      setStreaming(false);
    }
  }

  return (
    <>
      {/* Floating trigger button */}
      <button
        onClick={() => setOpen((o) => !o)}
        className="fixed bottom-6 right-6 z-50 flex items-center gap-2.5 px-4 py-3 rounded-full text-white font-semibold text-sm shadow-2xl transition-all hover:scale-105 active:scale-95"
        style={{
          background: "linear-gradient(135deg,#7C3AED,#A855F7)",
          boxShadow: "0 8px 32px rgba(124,58,237,.4)",
        }}
        aria-label={open ? "Close chat" : "Chat with Aria"}
      >
        <span className="w-6 h-6 rounded-full bg-white/20 flex items-center justify-center text-[11px] font-bold shrink-0">
          A
        </span>
        {open ? "Close" : "Chat with Aria"}
      </button>

      {/* Chat panel */}
      {open && (
        <div
          className="fixed bottom-24 right-6 z-50 rounded-2xl bg-white shadow-2xl flex flex-col"
          style={{
            width: 320,
            height: 384,
            border: "1px solid var(--line)",
            boxShadow: "0 24px 64px rgba(15,23,41,.18)",
          }}
        >
          {/* Header */}
          <div
            className="flex items-center justify-between px-4 py-3 rounded-t-2xl shrink-0"
            style={{ background: "linear-gradient(135deg,#7C3AED,#A855F7)" }}
          >
            <div className="flex items-center gap-2.5">
              <div className="w-7 h-7 rounded-full bg-white/20 flex items-center justify-center text-[11px] font-bold text-white">
                A
              </div>
              <div>
                <p className="text-white text-xs font-bold leading-tight">
                  Aria
                </p>
                <p className="text-white/70 text-[10px]">AI Chief of Staff</p>
              </div>
            </div>
            <button
              onClick={() => setOpen(false)}
              className="text-white/70 hover:text-white text-lg leading-none w-6 h-6 flex items-center justify-center"
              aria-label="Close"
            >
              ×
            </button>
          </div>

          {/* Messages */}
          <div className="flex-1 overflow-y-auto px-3 py-3 space-y-2.5">
            {messages.map((m, i) => {
              const isUser = m.role === "user";
              const isLastAssistant =
                !isUser && i === messages.length - 1 && streaming;
              return (
                <div
                  key={i}
                  className="flex"
                  style={{ justifyContent: isUser ? "flex-end" : "flex-start" }}
                >
                  <div
                    className="px-3 py-2 rounded-xl text-xs leading-relaxed max-w-[85%]"
                    style={{
                      background: isUser ? "var(--ink)" : "var(--soft)",
                      color: isUser ? "#fff" : "var(--ink)",
                    }}
                  >
                    {isLastAssistant && !m.content ? (
                      <span className="text-[var(--muted)]">…</span>
                    ) : (
                      <MessageContent content={m.content} />
                    )}
                  </div>
                </div>
              );
            })}
            <div ref={bottomRef} />
          </div>

          {/* Input */}
          <div className="px-3 py-2.5 border-t border-[var(--line)] shrink-0">
            <form
              className="flex gap-2 items-center"
              onSubmit={(e) => {
                e.preventDefault();
                void send();
              }}
            >
              <input
                ref={inputRef}
                type="text"
                value={input}
                onChange={(e) => setInput(e.target.value)}
                placeholder="Ask anything…"
                disabled={streaming}
                className="flex-1 text-xs rounded-lg border border-[var(--line)] px-3 py-2 outline-none bg-white"
                style={{ fontSize: 12 }}
              />
              <button
                type="submit"
                disabled={streaming || !input.trim()}
                className="w-7 h-7 rounded-lg flex items-center justify-center text-white text-sm font-bold shrink-0 transition-opacity disabled:opacity-40"
                style={{ background: "#7C3AED" }}
                aria-label="Send"
              >
                →
              </button>
            </form>
          </div>
        </div>
      )}
    </>
  );
}
