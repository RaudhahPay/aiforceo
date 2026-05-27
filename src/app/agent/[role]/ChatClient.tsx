"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import ReactMarkdown from "react-markdown";
import type { AgentRole } from "@/lib/prompts";
import {
  copyToClipboard,
  exportPDF,
  exportWord,
  exportCSV,
} from "@/lib/export";
import { newConversation } from "@/server/actions/workspaces";

type Msg = { role: "user" | "assistant"; content: string };

const QUICK_PROMPTS: Record<AgentRole, string[]> = {
  cmo: [
    "Generate a 7-day content calendar for this week",
    "Write 10 ad headlines for our top product",
    "Repurpose my last post into 5 formats",
  ],
  coo: [
    "Build me a customer auto-responder for WhatsApp",
    "Draft a 3-step invoice chasing sequence",
    "Create a staff onboarding checklist",
  ],
  cfo: [
    "Analyze my latest P&L and find the leaks",
    "Build a 90-day cash flow forecast",
    "What if I raised prices by 5%?",
  ],
  ceo: [
    "Give me today's morning brief",
    "Should I open a second location?",
    "Run my Friday weekly review",
  ],
  cto: [
    "Audit my current tech stack and find the gaps",
    "What are my top 3 automation opportunities right now?",
    "Give me a security hygiene checklist for my business",
  ],
  aria: [
    "Give me my morning executive brief",
    "What are all the open loops across the team?",
    "Prep a summary for my board meeting",
  ],
};

// Blinking cursor shown while streaming
function Cursor() {
  return (
    <span
      style={{
        display: "inline-block",
        width: "2px",
        height: "1em",
        background: "var(--accent)",
        marginLeft: "2px",
        verticalAlign: "text-bottom",
        animation: "blink 0.8s step-end infinite",
      }}
    />
  );
}

function AssistantContent({
  content,
  streaming,
}: {
  content: string;
  streaming: boolean;
}) {
  if (!content && streaming) return <Cursor />;
  return (
    <div className="markdown-body">
      <ReactMarkdown
        components={{
          p: ({ children }) => (
            <p style={{ margin: "0 0 0.6em 0", lineHeight: 1.6 }}>{children}</p>
          ),
          ul: ({ children }) => (
            <ul style={{ margin: "0 0 0.6em 0", paddingLeft: "1.2em" }}>
              {children}
            </ul>
          ),
          ol: ({ children }) => (
            <ol style={{ margin: "0 0 0.6em 0", paddingLeft: "1.2em" }}>
              {children}
            </ol>
          ),
          li: ({ children }) => (
            <li style={{ margin: "0 0 0.2em 0" }}>{children}</li>
          ),
          strong: ({ children }) => (
            <strong style={{ fontWeight: 700 }}>{children}</strong>
          ),
          em: ({ children }) => <em>{children}</em>,
          h1: ({ children }) => (
            <h1
              style={{
                fontSize: "1.1em",
                fontWeight: 700,
                margin: "0.5em 0 0.3em",
              }}
            >
              {children}
            </h1>
          ),
          h2: ({ children }) => (
            <h2
              style={{
                fontSize: "1.05em",
                fontWeight: 700,
                margin: "0.5em 0 0.3em",
              }}
            >
              {children}
            </h2>
          ),
          h3: ({ children }) => (
            <h3
              style={{
                fontSize: "1em",
                fontWeight: 700,
                margin: "0.4em 0 0.2em",
              }}
            >
              {children}
            </h3>
          ),
          code: ({ children }) => (
            <code
              style={{
                background: "rgba(212,160,23,0.12)",
                borderRadius: "3px",
                padding: "0.1em 0.35em",
                fontSize: "0.88em",
                fontFamily: "monospace",
                color: "#D4A017",
              }}
            >
              {children}
            </code>
          ),
          pre: ({ children }) => (
            <pre
              style={{
                background: "#0E1726",
                border: "1px solid #2A3B5E",
                borderRadius: "8px",
                padding: "0.75em 1em",
                overflowX: "auto",
                fontSize: "0.85em",
                margin: "0.5em 0",
              }}
            >
              {children}
            </pre>
          ),
          blockquote: ({ children }) => (
            <blockquote
              style={{
                borderLeft: "3px solid #D4A017",
                paddingLeft: "0.75em",
                margin: "0.5em 0",
                color: "#8597B8",
              }}
            >
              {children}
            </blockquote>
          ),
          hr: () => (
            <hr
              style={{
                border: "none",
                borderTop: "1px solid #2A3B5E",
                margin: "0.75em 0",
              }}
            />
          ),
          table: ({ children }) => (
            <table
              style={{
                borderCollapse: "collapse",
                width: "100%",
                margin: "0.5em 0",
                fontSize: "0.88em",
              }}
            >
              {children}
            </table>
          ),
          th: ({ children }) => (
            <th
              style={{
                border: "1px solid #2A3B5E",
                padding: "6px 10px",
                background: "#15203A",
                fontWeight: 700,
                textAlign: "left",
              }}
            >
              {children}
            </th>
          ),
          td: ({ children }) => (
            <td style={{ border: "1px solid #2A3B5E", padding: "6px 10px" }}>
              {children}
            </td>
          ),
        }}
      >
        {content}
      </ReactMarkdown>
      {streaming && content && <Cursor />}
    </div>
  );
}

// Action bar shown below each completed assistant message
function ExportBar({
  content,
  agentName,
  agentTitle,
  workspaceName,
}: {
  content: string;
  agentName: string;
  agentTitle: string;
  workspaceName: string;
}) {
  const [copied, setCopied] = useState(false);
  const opts = { agentName, agentTitle, workspaceName };

  async function handleCopy() {
    const ok = await copyToClipboard(content);
    if (ok) {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  }

  const btnStyle: React.CSSProperties = {
    display: "inline-flex",
    alignItems: "center",
    gap: 4,
    padding: "3px 9px",
    borderRadius: 6,
    fontSize: 11,
    fontWeight: 600,
    cursor: "pointer",
    border: "1px solid #2A3B5E",
    background: "transparent",
    color: "#8597B8",
    transition: "all 0.15s",
  };

  return (
    <div style={{ display: "flex", gap: 5, marginTop: 8, flexWrap: "wrap" }}>
      <button
        style={{
          ...btnStyle,
          color: copied ? "#3FB984" : "#8597B8",
          borderColor: copied ? "#3FB984" : "#2A3B5E",
        }}
        onClick={handleCopy}
      >
        {copied ? "✓ Copied" : "📋 Copy"}
      </button>
      <button style={btnStyle} onClick={() => exportPDF(content, opts)}>
        📄 PDF
      </button>
      <button style={btnStyle} onClick={() => exportWord(content, opts)}>
        📝 Word
      </button>
      <button style={btnStyle} onClick={() => exportCSV(content, opts)}>
        📊 CSV
      </button>
    </div>
  );
}

export function ChatClient({
  role,
  agent,
  workspaceName,
  conversationId: initialConversationId,
  initialMessages,
}: {
  role: AgentRole;
  agent: {
    name: string;
    title: string;
    tag: string;
    gradient: readonly [string, string];
  };
  workspaceName: string;
  conversationId: string;
  initialMessages: Msg[];
}) {
  const router = useRouter();
  const [conversationId, setConversationId] = useState(initialConversationId);
  const [messages, setMessages] = useState<Msg[]>(initialMessages);
  const [input, setInput] = useState("");
  const [pending, setPending] = useState(false);
  const [streamingIndex, setStreamingIndex] = useState<number | null>(null);
  const [newChatLoading, setNewChatLoading] = useState(false);
  const scrollRef = useRef<HTMLDivElement | null>(null);

  // Reset state when conversation switches (workspace change, bfcache restore)
  const prevConvId = useRef(conversationId);
  useEffect(() => {
    if (prevConvId.current !== conversationId) {
      prevConvId.current = conversationId;
      setMessages(initialMessages);
      setInput("");
      setPending(false);
      setStreamingIndex(null);
    }
  }, [conversationId, initialMessages]);

  useEffect(() => {
    scrollRef.current?.scrollTo({
      top: scrollRef.current.scrollHeight,
      behavior: "smooth",
    });
  }, [messages]);

  async function handleNewChat() {
    if (pending || newChatLoading) return;
    setNewChatLoading(true);
    const result = await newConversation(role);
    if ("error" in result) {
      setNewChatLoading(false);
      return;
    }
    // Update conversation ID and clear messages without a full page reload
    setConversationId(result.id);
    setMessages([]);
    setInput("");
    setNewChatLoading(false);
    // Also refresh server component state in the background
    router.refresh();
  }

  async function send(prompt?: string) {
    const text = (prompt ?? input).trim();
    if (!text || pending) return;
    setInput("");
    setPending(true);

    const next: Msg[] = [...messages, { role: "user", content: text }];
    const assistantIndex = next.length;
    setMessages([...next, { role: "assistant", content: "" }]);
    setStreamingIndex(assistantIndex);

    try {
      const res = await fetch("/api/chat/agent", {
        method: "POST",
        credentials: "same-origin",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          conversationId,
          role,
          messages: next.map(({ role, content }) => ({ role, content })),
        }),
      });

      if (!res.ok) {
        let errMsg = `Error ${res.status}`;
        try {
          const data = (await res.json()) as { error?: string };
          errMsg = data?.error ?? errMsg;
        } catch {
          /* ignore */
        }
        if (res.status === 401)
          errMsg = "Session expired — please refresh the page.";
        if (res.status === 402)
          errMsg =
            "You've used all your credits this month. [Upgrade on the pricing page](/pricing).";
        setMessages((cur) => {
          const copy = [...cur];
          copy[copy.length - 1] = { role: "assistant", content: `⚠ ${errMsg}` };
          return copy;
        });
        return;
      }

      const reader = res.body!.getReader();
      const decoder = new TextDecoder();
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        const chunk = decoder.decode(value, { stream: true });
        setMessages((cur) => {
          const copy = [...cur];
          const last = copy[copy.length - 1];
          if (last?.role === "assistant") {
            copy[copy.length - 1] = { ...last, content: last.content + chunk };
          }
          return copy;
        });
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Network error";
      setMessages((cur) => {
        const copy = [...cur];
        copy[copy.length - 1] = { role: "assistant", content: `⚠ ${msg}` };
        return copy;
      });
    } finally {
      setPending(false);
      setStreamingIndex(null);
    }
  }

  const grad = `linear-gradient(135deg, ${agent.gradient[0]}, ${agent.gradient[1]})`;
  const onLight = role === "ceo";

  return (
    <>
      <style>{`@keyframes blink { 0%,100%{opacity:1} 50%{opacity:0} }`}</style>

      <div
        className="flex flex-col"
        style={{ background: "var(--bg)", height: "100vh", overflow: "hidden" }}
      >
        {/* Header */}
        <div
          style={{
            padding: "14px 28px",
            background: "#15203A",
            borderBottom: "1px solid #2A3B5E",
            display: "flex",
            alignItems: "center",
            gap: 14,
          }}
        >
          <div
            style={{
              width: 44,
              height: 44,
              borderRadius: 12,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              fontWeight: 700,
              fontSize: 18,
              background: grad,
              color: onLight ? "#1E2761" : "#fff",
              flexShrink: 0,
            }}
          >
            {agent.name[0]}
          </div>
          <div style={{ flex: 1 }}>
            <h3
              style={{
                margin: 0,
                fontSize: 17,
                fontFamily: "Georgia,serif",
                color: "#E8EDF6",
              }}
            >
              {agent.name} · {agent.title}
            </h3>
            <p style={{ margin: 0, fontSize: 11, color: "#8597B8" }}>
              {workspaceName} · {agent.tag}
            </p>
          </div>
          {/* New Chat button */}
          <button
            onClick={handleNewChat}
            disabled={pending || newChatLoading}
            title="Start a new conversation"
            style={{
              padding: "7px 14px",
              borderRadius: 9,
              fontSize: 12,
              fontWeight: 600,
              cursor: pending || newChatLoading ? "default" : "pointer",
              background: "transparent",
              border: "1px solid #2A3B5E",
              color: "#8597B8",
              opacity: pending || newChatLoading ? 0.4 : 1,
              display: "flex",
              alignItems: "center",
              gap: 5,
              whiteSpace: "nowrap",
            }}
          >
            {newChatLoading ? "…" : "+ New chat"}
          </button>
        </div>

        {/* Messages */}
        <div
          ref={scrollRef}
          style={{
            flex: 1,
            overflowY: "auto",
            padding: "28px 32px",
            display: "flex",
            flexDirection: "column",
            gap: 14,
          }}
        >
          {messages.length === 0 && (
            <div style={{ textAlign: "center", paddingTop: 80 }}>
              <div
                style={{
                  width: 64,
                  height: 64,
                  margin: "0 auto 16px",
                  borderRadius: 18,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  fontWeight: 700,
                  fontSize: 26,
                  background: grad,
                  color: onLight ? "#1E2761" : "#fff",
                }}
              >
                {agent.name[0]}
              </div>
              <h2
                style={{
                  margin: "0 0 6px",
                  fontSize: 22,
                  fontFamily: "Georgia,serif",
                  color: "#E8EDF6",
                }}
              >
                {agent.name} is ready.
              </h2>
              <p
                style={{
                  fontSize: 13,
                  color: "#8597B8",
                  maxWidth: 380,
                  margin: "0 auto 24px",
                }}
              >
                Briefed on {workspaceName}. Ask anything — or pick a quick
                prompt below.
              </p>
              <div
                style={{
                  display: "flex",
                  flexWrap: "wrap",
                  gap: 8,
                  justifyContent: "center",
                  maxWidth: 520,
                  margin: "0 auto",
                }}
              >
                {QUICK_PROMPTS[role].map((q) => (
                  <button key={q} onClick={() => send(q)} className="chip">
                    {q}
                  </button>
                ))}
              </div>
            </div>
          )}

          {messages.map((m, i) => {
            const isStreaming = streamingIndex === i && pending;
            const isDone =
              m.role === "assistant" &&
              !isStreaming &&
              m.content &&
              !m.content.startsWith("⚠");
            return (
              <div
                key={i}
                style={{
                  display: "flex",
                  gap: 10,
                  maxWidth: "82%",
                  marginLeft: m.role === "user" ? "auto" : 0,
                  flexDirection: m.role === "user" ? "row-reverse" : "row",
                }}
              >
                {/* Avatar */}
                <div
                  style={{
                    width: 32,
                    height: 32,
                    borderRadius: 10,
                    flexShrink: 0,
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    fontWeight: 700,
                    fontSize: 11,
                    background: m.role === "user" ? "#D4A017" : grad,
                    color:
                      m.role === "user"
                        ? "#0E1726"
                        : onLight
                          ? "#1E2761"
                          : "#fff",
                  }}
                >
                  {m.role === "user" ? "You" : agent.name[0]}
                </div>
                {/* Bubble + export bar */}
                <div
                  style={{
                    display: "flex",
                    flexDirection: "column",
                    maxWidth: "100%",
                    minWidth: 0,
                  }}
                >
                  <div
                    style={{
                      borderRadius: 16,
                      padding: "10px 16px",
                      fontSize: 13,
                      lineHeight: 1.65,
                      background: m.role === "user" ? "#D4A017" : "#1C2A47",
                      border: m.role === "user" ? "none" : "1px solid #2A3B5E",
                      color: m.role === "user" ? "#0E1726" : "#E8EDF6",
                      minWidth: "2rem",
                    }}
                  >
                    {m.role === "user" ? (
                      <span style={{ whiteSpace: "pre-wrap" }}>
                        {m.content}
                      </span>
                    ) : (
                      <AssistantContent
                        content={m.content}
                        streaming={isStreaming}
                      />
                    )}
                  </div>
                  {/* Export actions — only on complete, non-error assistant messages */}
                  {isDone && (
                    <ExportBar
                      content={m.content}
                      agentName={agent.name}
                      agentTitle={agent.title}
                      workspaceName={workspaceName}
                    />
                  )}
                </div>
              </div>
            );
          })}
        </div>

        {/* Input bar */}
        <div
          style={{
            padding: "16px 28px",
            background: "#15203A",
            borderTop: "1px solid #2A3B5E",
          }}
        >
          <form
            style={{
              display: "flex",
              gap: 10,
              alignItems: "center",
              borderRadius: 16,
              padding: "8px 8px 8px 16px",
              background: "#1C2A47",
              border: `1.5px solid ${pending ? "#D4A017" : "#2A3B5E"}`,
              transition: "border-color 0.2s",
            }}
            onSubmit={(e) => {
              e.preventDefault();
              void send();
            }}
          >
            <input
              type="text"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder={
                pending
                  ? `${agent.name} is thinking…`
                  : `Ask ${agent.name} anything…`
              }
              style={{
                flex: 1,
                background: "transparent",
                border: "none",
                outline: "none",
                padding: "6px 0",
                fontSize: 13,
                color: "#E8EDF6",
              }}
              disabled={pending}
            />
            <button
              type="submit"
              style={{
                width: 36,
                height: 36,
                borderRadius: 10,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                background: "#D4A017",
                color: "#0E1726",
                fontWeight: 700,
                fontSize: 16,
                border: "none",
                cursor: "pointer",
                opacity: pending || !input.trim() ? 0.35 : 1,
                transition: "opacity 0.15s",
              }}
              disabled={pending || !input.trim()}
            >
              {pending ? "…" : "→"}
            </button>
          </form>

          {/* Quick prompts shown after conversation starts */}
          {messages.length > 0 && (
            <div className="flex gap-2 mt-3 flex-wrap">
              {QUICK_PROMPTS[role].map((q) => (
                <button
                  key={q}
                  onClick={() => send(q)}
                  disabled={pending}
                  className="chip text-xs"
                  style={{ opacity: pending ? 0.4 : 1 }}
                >
                  {q}
                </button>
              ))}
            </div>
          )}
        </div>
      </div>
    </>
  );
}
