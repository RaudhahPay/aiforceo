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
              style={{ color: "#F0B429" }}
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

function ChatCore({
  messages,
  input,
  setInput,
  streaming,
  send,
  inputRef,
  bottomRef,
  dark,
}: {
  messages: Msg[];
  input: string;
  setInput: (v: string) => void;
  streaming: boolean;
  send: () => void;
  inputRef: React.RefObject<HTMLInputElement | null>;
  bottomRef: React.RefObject<HTMLDivElement | null>;
  dark?: boolean;
}) {
  const bg = dark ? "rgba(255,255,255,0.06)" : "var(--soft)";
  const userBg = dark ? "rgba(240,180,41,0.15)" : "var(--ink)";
  const userColor = dark ? "#F0B429" : "#fff";
  const textColor = dark ? "rgba(240,242,247,0.9)" : "var(--ink)";
  const mutedColor = dark ? "rgba(240,242,247,0.45)" : "var(--muted)";

  return (
    <>
      <div
        className="flex-1 overflow-y-auto px-4 py-4 space-y-3"
        style={{ minHeight: 0 }}
      >
        {messages.map((m, i) => {
          const isUser = m.role === "user";
          const isLastAssistant =
            !isUser && i === messages.length - 1 && streaming;
          return (
            <div
              key={i}
              style={{
                display: "flex",
                justifyContent: isUser ? "flex-end" : "flex-start",
              }}
            >
              {!isUser && (
                <div
                  style={{
                    width: 26,
                    height: 26,
                    borderRadius: "50%",
                    background: "linear-gradient(135deg,#7C3AED,#A855F7)",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    fontSize: 10,
                    fontWeight: 800,
                    color: "#fff",
                    flexShrink: 0,
                    marginRight: 8,
                    marginTop: 2,
                  }}
                >
                  A
                </div>
              )}
              <div
                style={{
                  padding: "10px 14px",
                  borderRadius: 14,
                  fontSize: 13,
                  lineHeight: 1.6,
                  maxWidth: "82%",
                  background: isUser ? userBg : bg,
                  color: isUser ? userColor : textColor,
                }}
              >
                {isLastAssistant && !m.content ? (
                  <span style={{ color: mutedColor }}>…</span>
                ) : (
                  <MessageContent content={m.content} />
                )}
              </div>
            </div>
          );
        })}
        <div ref={bottomRef} />
      </div>
      <div
        style={{
          padding: "12px 16px",
          borderTop: dark
            ? "1px solid rgba(255,255,255,0.08)"
            : "1px solid var(--line)",
          flexShrink: 0,
        }}
      >
        <form
          style={{ display: "flex", gap: 8, alignItems: "center" }}
          onSubmit={(e) => {
            e.preventDefault();
            send();
          }}
        >
          <input
            ref={inputRef}
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="Ask anything…"
            disabled={streaming}
            style={{
              flex: 1,
              fontSize: 13,
              borderRadius: 10,
              border: dark
                ? "1px solid rgba(255,255,255,0.1)"
                : "1px solid var(--line)",
              padding: "9px 14px",
              outline: "none",
              background: dark ? "rgba(255,255,255,0.05)" : "#fff",
              color: dark ? "#f0f2f7" : "var(--ink)",
            }}
          />
          <button
            type="submit"
            disabled={streaming || !input.trim()}
            aria-label="Send"
            style={{
              width: 34,
              height: 34,
              borderRadius: 10,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              background: "#7C3AED",
              color: "#fff",
              fontSize: 14,
              fontWeight: 700,
              border: "none",
              cursor: streaming || !input.trim() ? "not-allowed" : "pointer",
              opacity: streaming || !input.trim() ? 0.4 : 1,
              transition: "opacity 0.15s",
              flexShrink: 0,
            }}
          >
            ↑
          </button>
        </form>
      </div>
    </>
  );
}

export function ProspectChat({ inline = false }: { inline?: boolean }) {
  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState<Msg[]>(INITIAL_MESSAGES);
  const [input, setInput] = useState("");
  const [streaming, setStreaming] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (open || inline) {
      bottomRef.current?.scrollIntoView({ behavior: "smooth" });
      if (open) inputRef.current?.focus();
    }
  }, [open, inline, messages]);

  function handleInputFocus() {
    if (inline && !open) setOpen(true);
  }

  async function send() {
    const text = input.trim();
    if (!text || streaming) return;
    setInput("");
    if (inline) setOpen(true);

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

  // Inline mode — embeds in the page, expands on interaction
  if (inline) {
    return (
      <div style={{ width: "100%", maxWidth: 620 }}>
        {open && (
          <div
            style={{
              borderRadius: "18px 18px 0 0",
              background: "rgba(255,255,255,0.04)",
              border: "1px solid rgba(255,255,255,0.1)",
              borderBottom: "none",
              height: 280,
              display: "flex",
              flexDirection: "column",
              overflow: "hidden",
            }}
          >
            <ChatCore
              messages={messages}
              input={input}
              setInput={setInput}
              streaming={streaming}
              send={send}
              inputRef={inputRef}
              bottomRef={bottomRef}
              dark
            />
          </div>
        )}
        {!open && (
          <form
            onSubmit={(e) => {
              e.preventDefault();
              void send();
            }}
            style={{
              display: "flex",
              alignItems: "center",
              gap: 0,
              background: "rgba(255,255,255,0.06)",
              border: "1px solid rgba(255,255,255,0.12)",
              borderRadius: 999,
              padding: "6px 6px 6px 22px",
              transition: "border-color 0.2s",
            }}
            onFocusCapture={() => {
              if (!open) setOpen(true);
            }}
          >
            <input
              ref={inputRef}
              type="text"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onFocus={handleInputFocus}
              placeholder="Ask your AI C-Suite anything…"
              disabled={streaming}
              style={{
                flex: 1,
                fontSize: 15,
                background: "transparent",
                border: "none",
                outline: "none",
                color: "#f0f2f7",
                caretColor: "#F0B429",
              }}
            />
            <button
              type="submit"
              disabled={streaming || !input.trim()}
              aria-label="Send"
              style={{
                width: 38,
                height: 38,
                borderRadius: "50%",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                background: input.trim() ? "#F0B429" : "rgba(255,255,255,0.1)",
                color: input.trim() ? "#0a0a0f" : "rgba(240,242,247,0.4)",
                fontSize: 16,
                fontWeight: 700,
                border: "none",
                cursor: streaming || !input.trim() ? "default" : "pointer",
                transition: "background 0.2s, color 0.2s",
                flexShrink: 0,
              }}
            >
              ↑
            </button>
          </form>
        )}
        {open && (
          <form
            onSubmit={(e) => {
              e.preventDefault();
              void send();
            }}
            style={{
              display: "flex",
              alignItems: "center",
              gap: 0,
              background: "rgba(255,255,255,0.06)",
              border: "1px solid rgba(255,255,255,0.12)",
              borderTop: "none",
              borderRadius: "0 0 999px 999px",
              padding: "6px 6px 6px 22px",
            }}
          >
            <input
              ref={inputRef}
              type="text"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder="Reply to Aria…"
              disabled={streaming}
              style={{
                flex: 1,
                fontSize: 15,
                background: "transparent",
                border: "none",
                outline: "none",
                color: "#f0f2f7",
                caretColor: "#F0B429",
              }}
            />
            <button
              type="submit"
              disabled={streaming || !input.trim()}
              aria-label="Send"
              style={{
                width: 38,
                height: 38,
                borderRadius: "50%",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                background: input.trim() ? "#F0B429" : "rgba(255,255,255,0.1)",
                color: input.trim() ? "#0a0a0f" : "rgba(240,242,247,0.4)",
                fontSize: 16,
                fontWeight: 700,
                border: "none",
                cursor: streaming || !input.trim() ? "default" : "pointer",
                transition: "background 0.2s, color 0.2s",
                flexShrink: 0,
              }}
            >
              ↑
            </button>
          </form>
        )}
      </div>
    );
  }

  // Floating mode — bottom-right widget
  return (
    <>
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

      {open && (
        <div
          className="fixed bottom-24 right-6 z-50 rounded-2xl flex flex-col"
          style={{
            width: 340,
            height: 420,
            background: "#0d0f17",
            border: "1px solid rgba(255,255,255,0.1)",
            boxShadow: "0 24px 64px rgba(0,0,0,.6)",
          }}
        >
          <div
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              padding: "14px 16px",
              borderBottom: "1px solid rgba(255,255,255,0.08)",
              flexShrink: 0,
            }}
          >
            <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
              <div
                style={{
                  width: 30,
                  height: 30,
                  borderRadius: "50%",
                  background: "linear-gradient(135deg,#7C3AED,#A855F7)",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  fontSize: 11,
                  fontWeight: 800,
                  color: "#fff",
                }}
              >
                A
              </div>
              <div>
                <p
                  style={{
                    color: "#f0f2f7",
                    fontSize: 13,
                    fontWeight: 700,
                    lineHeight: 1.2,
                  }}
                >
                  Aria
                </p>
                <p
                  style={{
                    color: "rgba(240,242,247,0.45)",
                    fontSize: 11,
                    lineHeight: 1.2,
                  }}
                >
                  AI Chief of Staff
                </p>
              </div>
            </div>
            <button
              onClick={() => setOpen(false)}
              aria-label="Close"
              style={{
                color: "rgba(240,242,247,0.45)",
                fontSize: 20,
                lineHeight: 1,
                background: "none",
                border: "none",
                cursor: "pointer",
                padding: 4,
              }}
            >
              ×
            </button>
          </div>

          <div
            style={{
              flex: 1,
              display: "flex",
              flexDirection: "column",
              minHeight: 0,
            }}
          >
            <ChatCore
              messages={messages}
              input={input}
              setInput={setInput}
              streaming={streaming}
              send={send}
              inputRef={inputRef}
              bottomRef={bottomRef}
              dark
            />
          </div>
        </div>
      )}
    </>
  );
}
