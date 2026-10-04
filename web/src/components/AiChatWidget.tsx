import { useEffect, useRef, useState } from "react";

const AI_URL = import.meta.env.VITE_AI_URL ?? "http://localhost:8000";

interface Message {
  id: number;
  role: "user" | "assistant";
  text: string;
  cards?: { label: string; value: string; status: "good" | "warn" | "bad" }[];
  loading?: boolean;
}

const STATUS_COLOR = { good: "#22d3a0", warn: "#f59e0b", bad: "#f43f5e" };

const SUGGESTIONS = [
  "What's the platform status?",
  "Are there any open alerts?",
  "Show recent scaling events",
  "What's my monthly spend?",
  "Which services are degraded?",
  "How many clusters are healthy?",
];

function renderMarkdown(text: string) {
  // Bold
  let html = text.replace(/\*\*(.*?)\*\*/g, "<strong>$1</strong>");
  // Inline code
  html = html.replace(/`([^`]+)`/g, '<code style="background:#1e293b;padding:1px 5px;border-radius:3px;font-size:12px;font-family:monospace">$1</code>');
  // Bullet list
  const lines = html.split("\n");
  const out: string[] = [];
  for (const line of lines) {
    if (line.startsWith("- ")) {
      out.push(`<div style="display:flex;gap:6px;margin:2px 0"><span style="color:#3b82f6;flex-shrink:0">•</span><span>${line.slice(2)}</span></div>`);
    } else if (line.trim() === "") {
      out.push("<div style='height:6px'></div>");
    } else {
      out.push(`<div>${line}</div>`);
    }
  }
  return out.join("");
}

export function AiChatWidget({ token }: { token: string }) {
  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState<Message[]>([
    {
      id: 0,
      role: "assistant",
      text: "Hi! I'm your **AegisCloud SRE Assistant**.\n\nAsk me anything about your platform — alerts, scaling events, costs, SLOs, or cluster health. I pull live data on every question.",
    },
  ]);
  const [input, setInput] = useState("");
  const [sending, setSending] = useState(false);
  const [pulse, setPulse] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  let nextId = useRef(1);

  // Scroll to bottom on new messages
  useEffect(() => {
    if (open) bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, open]);

  // Focus input when opened
  useEffect(() => {
    if (open) setTimeout(() => inputRef.current?.focus(), 150);
  }, [open]);

  const send = async (question: string) => {
    if (!question.trim() || sending) return;
    const userMsg: Message = { id: nextId.current++, role: "user", text: question };
    const loadingMsg: Message = { id: nextId.current++, role: "assistant", text: "", loading: true };
    setMessages((m) => [...m, userMsg, loadingMsg]);
    setInput("");
    setSending(true);

    try {
      const res = await fetch(`${AI_URL}/chat`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ question, token }),
      });
      const data = await res.json();
      setMessages((m) =>
        m.map((msg) =>
          msg.id === loadingMsg.id
            ? { ...msg, text: data.answer, cards: data.cards, loading: false }
            : msg
        )
      );
    } catch {
      setMessages((m) =>
        m.map((msg) =>
          msg.id === loadingMsg.id
            ? { ...msg, text: "⚠️ Could not reach the AI service. Make sure the sidecar is running on port 8000.", loading: false }
            : msg
        )
      );
    }
    setSending(false);
  };

  const handleKey = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); send(input); }
  };

  // Pulse the button when closed to draw attention
  useEffect(() => {
    if (open) return;
    const t = setInterval(() => setPulse((p) => !p), 3000);
    return () => clearInterval(t);
  }, [open]);

  return (
    <>
      {/* Floating button */}
      <button
        id="ai-chat-toggle"
        onClick={() => setOpen((o) => !o)}
        title="AegisCloud AI Assistant"
        style={{
          position: "fixed",
          bottom: 28,
          right: 28,
          width: 56,
          height: 56,
          borderRadius: "50%",
          background: open
            ? "linear-gradient(135deg,#1e293b,#0f172a)"
            : "linear-gradient(135deg,#6366f1,#8b5cf6)",
          border: `2px solid ${open ? "#334155" : "#818cf8"}`,
          boxShadow: open ? "0 4px 20px #6366f130" : `0 4px 24px #6366f155${pulse ? ", 0 0 0 8px #6366f115" : ""}`,
          cursor: "pointer",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          fontSize: 24,
          zIndex: 1000,
          transition: "all 0.3s cubic-bezier(.4,0,.2,1)",
          transform: open ? "rotate(180deg)" : "scale(1)",
        }}
      >
        {open ? "✕" : "🤖"}
      </button>

      {/* Chat panel */}
      {open && (
        <div
          id="ai-chat-panel"
          style={{
            position: "fixed",
            bottom: 96,
            right: 28,
            width: 400,
            maxWidth: "calc(100vw - 56px)",
            height: 560,
            maxHeight: "calc(100vh - 120px)",
            background: "#0d1117",
            border: "1px solid #1a2332",
            borderRadius: 16,
            display: "flex",
            flexDirection: "column",
            zIndex: 999,
            boxShadow: "0 24px 60px #000a, 0 0 0 1px #6366f120",
            animation: "slideUpChat 0.25s cubic-bezier(.4,0,.2,1)",
            overflow: "hidden",
          }}
        >
          {/* Header */}
          <div style={{
            padding: "14px 18px",
            background: "linear-gradient(135deg,#0f1729,#1a1040)",
            borderBottom: "1px solid #1a2332",
            display: "flex",
            alignItems: "center",
            gap: 10,
            flexShrink: 0,
          }}>
            <div style={{
              width: 36, height: 36, borderRadius: "50%",
              background: "linear-gradient(135deg,#6366f1,#8b5cf6)",
              display: "flex", alignItems: "center", justifyContent: "center",
              fontSize: 18, flexShrink: 0,
            }}>🤖</div>
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: 14, fontWeight: 700, color: "#e2e8f0" }}>SRE Assistant</div>
              <div style={{ fontSize: 11, color: "#22d3a0", display: "flex", alignItems: "center", gap: 5 }}>
                <span style={{ width: 6, height: 6, borderRadius: "50%", background: "#22d3a0", display: "inline-block", animation: "pulse-dot 1.8s ease-in-out infinite" }} />
                Live platform data
              </div>
            </div>
            <button onClick={() => setOpen(false)} style={{
              background: "none", border: "none", color: "#4d5d72",
              cursor: "pointer", fontSize: 18, padding: "2px 6px", borderRadius: 6,
              lineHeight: 1,
            }}>✕</button>
          </div>

          {/* Messages */}
          <div style={{ flex: 1, overflowY: "auto", padding: "14px 16px", display: "flex", flexDirection: "column", gap: 12 }}>
            {messages.map((msg) => (
              <div key={msg.id} style={{ display: "flex", gap: 8, flexDirection: msg.role === "user" ? "row-reverse" : "row", alignItems: "flex-start" }}>
                {msg.role === "assistant" && (
                  <div style={{ width: 28, height: 28, borderRadius: "50%", background: "linear-gradient(135deg,#6366f1,#8b5cf6)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 14, flexShrink: 0 }}>🤖</div>
                )}
                <div style={{ maxWidth: "82%", display: "flex", flexDirection: "column", gap: 6 }}>
                  <div style={{
                    background: msg.role === "user" ? "linear-gradient(135deg,#3730a3,#6366f1)" : "#141b25",
                    border: `1px solid ${msg.role === "user" ? "#6366f180" : "#1a2332"}`,
                    borderRadius: msg.role === "user" ? "14px 14px 4px 14px" : "14px 14px 14px 4px",
                    padding: "10px 13px",
                    fontSize: 13,
                    color: msg.role === "user" ? "#e2e8f0" : "#94a3b8",
                    lineHeight: 1.55,
                  }}>
                    {msg.loading ? (
                      <div style={{ display: "flex", gap: 4, alignItems: "center", padding: "4px 0" }}>
                        {[0, 1, 2].map((i) => (
                          <div key={i} style={{
                            width: 7, height: 7, borderRadius: "50%", background: "#6366f1",
                            animation: `dotBounce 1.2s ease-in-out ${i * 0.2}s infinite`,
                          }} />
                        ))}
                      </div>
                    ) : (
                      <div dangerouslySetInnerHTML={{ __html: renderMarkdown(msg.text) }} />
                    )}
                  </div>

                  {/* Data cards */}
                  {msg.cards && msg.cards.length > 0 && (
                    <div style={{ display: "flex", flexWrap: "wrap", gap: 5 }}>
                      {msg.cards.map((card, i) => (
                        <div key={i} style={{
                          background: STATUS_COLOR[card.status] + "15",
                          border: `1px solid ${STATUS_COLOR[card.status]}40`,
                          borderRadius: 8,
                          padding: "4px 10px",
                          fontSize: 11,
                        }}>
                          <span style={{ color: "#64748b" }}>{card.label}: </span>
                          <span style={{ color: STATUS_COLOR[card.status], fontWeight: 700 }}>{card.value}</span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            ))}
            <div ref={bottomRef} />
          </div>

          {/* Suggestions (shown only on first open with no user messages) */}
          {messages.filter((m) => m.role === "user").length === 0 && (
            <div style={{ padding: "8px 14px 4px", display: "flex", flexWrap: "wrap", gap: 6, flexShrink: 0, borderTop: "1px solid #141b25" }}>
              {SUGGESTIONS.map((s) => (
                <button
                  key={s}
                  onClick={() => send(s)}
                  style={{
                    background: "#141b25", border: "1px solid #1a2332",
                    borderRadius: 20, padding: "4px 10px",
                    color: "#64748b", fontSize: 11, cursor: "pointer",
                    transition: "all 0.15s",
                    whiteSpace: "nowrap",
                  }}
                  onMouseEnter={(e) => { e.currentTarget.style.borderColor = "#6366f1"; e.currentTarget.style.color = "#c4b5fd"; }}
                  onMouseLeave={(e) => { e.currentTarget.style.borderColor = "#1a2332"; e.currentTarget.style.color = "#64748b"; }}
                >
                  {s}
                </button>
              ))}
            </div>
          )}

          {/* Input */}
          <div style={{
            padding: "10px 12px",
            borderTop: "1px solid #1a2332",
            background: "#0d1117",
            display: "flex",
            gap: 8,
            flexShrink: 0,
          }}>
            <input
              ref={inputRef}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={handleKey}
              placeholder="Ask about your platform…"
              disabled={sending}
              style={{
                flex: 1,
                background: "#141b25",
                border: "1px solid #1e293b",
                borderRadius: 10,
                padding: "9px 13px",
                color: "#e2e8f0",
                fontSize: 13,
                outline: "none",
                transition: "border-color 0.15s",
              }}
              onFocus={(e) => { e.target.style.borderColor = "#6366f1"; }}
              onBlur={(e) => { e.target.style.borderColor = "#1e293b"; }}
            />
            <button
              onClick={() => send(input)}
              disabled={sending || !input.trim()}
              style={{
                width: 38, height: 38,
                background: sending || !input.trim() ? "#1e293b" : "linear-gradient(135deg,#6366f1,#8b5cf6)",
                border: "none", borderRadius: 10,
                color: "#fff", cursor: sending || !input.trim() ? "default" : "pointer",
                fontSize: 16, display: "flex", alignItems: "center", justifyContent: "center",
                transition: "all 0.2s", flexShrink: 0,
              }}
            >
              {sending ? "⟳" : "↑"}
            </button>
          </div>
        </div>
      )}

      <style>{`
        @keyframes slideUpChat {
          from { opacity: 0; transform: translateY(20px) scale(0.97); }
          to   { opacity: 1; transform: translateY(0) scale(1); }
        }
        @keyframes dotBounce {
          0%, 80%, 100% { transform: scale(0.6); opacity: 0.5; }
          40% { transform: scale(1); opacity: 1; }
        }
      `}</style>
    </>
  );
}
