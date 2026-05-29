import { useEffect, useState, useRef, useCallback } from "react";
import { api, formatTime } from "../api/client";

const SUGGESTIONS = [
  "Explain this case simply",
  "What precedent was cited?",
  "What was the final ruling?",
  "What acts/sections apply?",
];

/* ── Simple markdown renderer ───────────────────────────────────── */
function renderMarkdown(text) {
  if (!text) return "";
  // Escape HTML
  let s = text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");

  // Code blocks
  s = s.replace(/```[\s\S]*?```/g, (m) => {
    const inner = m.slice(3, -3).replace(/^[a-z]*\n/, "");
    return `<pre style="background:rgba(0,0,0,0.18);border-radius:0.4rem;padding:0.6rem 0.8rem;overflow-x:auto;font-size:0.78rem;margin:0.4rem 0"><code>${inner}</code></pre>`;
  });
  // Inline code
  s = s.replace(/`([^`]+)`/g, '<code style="background:rgba(0,0,0,0.18);border-radius:0.2rem;padding:0.05em 0.3em;font-size:0.85em">$1</code>');
  // Bold
  s = s.replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>");
  // Italic
  s = s.replace(/\*(.+?)\*/g, "<em>$1</em>");
  // Headings
  s = s.replace(/^### (.+)$/gm, '<h4 style="margin:0.7rem 0 0.2rem;font-size:0.92rem;font-weight:700">$1</h4>');
  s = s.replace(/^## (.+)$/gm, '<h3 style="margin:0.8rem 0 0.25rem;font-size:1rem;font-weight:700">$1</h3>');
  s = s.replace(/^# (.+)$/gm, '<h2 style="margin:0.8rem 0 0.3rem;font-size:1.1rem;font-weight:700">$1</h2>');
  // Unordered lists
  s = s.replace(/^[-•] (.+)$/gm, '<li style="margin:0.15rem 0 0.15rem 1rem">$1</li>');
  s = s.replace(/(<li[^>]*>.*<\/li>\n?)+/gs, (m) => `<ul style="padding-left:0.5rem;margin:0.25rem 0">${m}</ul>`);
  // Ordered lists
  s = s.replace(/^\d+\. (.+)$/gm, '<li style="margin:0.15rem 0 0.15rem 1rem">$1</li>');
  // Horizontal rule
  s = s.replace(/^---$/gm, '<hr style="border:none;border-top:1px solid rgba(255,255,255,0.1);margin:0.5rem 0"/>');
  // Paragraphs (blank-line separated)
  s = s.replace(/\n\n/g, "</p><p style=\"margin:0.35rem 0\">");
  s = `<p style="margin:0">${s}</p>`;
  // Single newlines → <br>
  s = s.replace(/\n/g, "<br/>");
  return s;
}

function MarkdownContent({ content, isUser }) {
  if (isUser) return <span style={{ whiteSpace: "pre-wrap" }}>{content}</span>;
  return (
    <div
      style={{ lineHeight: 1.65 }}
      dangerouslySetInnerHTML={{ __html: renderMarkdown(content) }}
    />
  );
}

/* ── Typing / status indicator ──────────────────────────────────── */
function StatusIndicator({ status }) {
  const icons = {
    "Thinking…": "🧠",
    "Searching documents…": "🔍",
    "Fetching case info…": "📋",
    "Writing response…": "✍️",
  };
  const icon = icons[status] || "🔄";
  return (
    <div style={{
      display: "flex", alignItems: "center", gap: "0.5rem",
      padding: "0.45rem 0.7rem",
      background: "rgba(99,102,241,0.08)",
      borderRadius: "0.5rem",
      border: "1px solid rgba(99,102,241,0.18)",
      fontSize: "0.78rem",
      color: "var(--muted)",
      marginBottom: "0.4rem",
      animation: "statusPulse 1.8s ease-in-out infinite",
    }}>
      <span style={{ fontSize: "0.9rem" }}>{icon}</span>
      <span>{status}</span>
      <span style={{ display: "flex", gap: "0.2rem", marginLeft: "auto" }}>
        {[0, 0.2, 0.4].map((d, i) => (
          <span key={i} style={{
            width: 5, height: 5, borderRadius: "50%",
            background: "var(--accent)",
            display: "inline-block",
            animation: `dot-bounce 1.2s infinite ${d}s`,
          }} />
        ))}
      </span>
    </div>
  );
}

function MessageBubble({ msg }) {
  const isUser = msg.role === "user";
  return (
    <div style={{
      display: "flex",
      justifyContent: isUser ? "flex-end" : "flex-start",
      marginBottom: "0.6rem",
      animation: "msgFade 0.18s ease",
    }}>
      {!isUser && (
        <div style={{
          width: 24, height: 24, borderRadius: "50%",
          background: "linear-gradient(135deg, var(--accent), #a78bfa)",
          display: "flex", alignItems: "center", justifyContent: "center",
          fontSize: "0.65rem", flexShrink: 0, marginRight: "0.4rem", marginTop: "0.15rem",
          color: "#fff",
        }}>⚖</div>
      )}
      <div style={{
        maxWidth: "85%",
        background: isUser
          ? "linear-gradient(135deg, var(--accent), #6366f1)"
          : "var(--bg-elevated)",
        color: isUser ? "#fff" : "var(--text)",
        borderRadius: isUser ? "0.85rem 0.85rem 0.2rem 0.85rem" : "0.85rem 0.85rem 0.85rem 0.2rem",
        padding: "0.55rem 0.8rem",
        fontSize: "0.83rem",
        lineHeight: 1.6,
        border: isUser ? "none" : "1px solid var(--border)",
        boxShadow: isUser ? "0 2px 8px rgba(99,102,241,0.25)" : "0 1px 3px rgba(0,0,0,0.1)",
      }}>
        <MarkdownContent content={msg.content} isUser={isUser} />
      </div>
    </div>
  );
}

export default function CaseChatPanel({ caseId, caseTitle }) {
  const [threads, setThreads] = useState([]);
  const [activeThread, setActiveThread] = useState(null);
  const [showThreadList, setShowThreadList] = useState(false);
  const [messages, setMessages] = useState([]);
  const [streamingText, setStreamingText] = useState("");
  const [aiStatus, setAiStatus] = useState(""); // "Thinking…" | "Searching…" | etc.
  const [query, setQuery] = useState("");
  const [loading, setLoading] = useState(false);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [creating, setCreating] = useState(false);

  const ctrlRef = useRef(null);
  const msgsEndRef = useRef(null);
  const inputRef = useRef(null);

  // Load threads for this case
  // Thread management uses "MAIN" mode scoped by case_id (backward-compatible with all backends)
  // The CASE agent behavior is triggered in the chat stream via case_id
  useEffect(() => {
    if (!caseId) return;
    api.threads("MAIN", caseId)
      .then(async (d) => {
        let list = d.threads || [];
        if (list.length === 0) {
          const t = await api.defaultThread("MAIN", caseId);
          list = [t];
        }
        setThreads(list);
        loadThread(list[0]);
      })
      .catch(() => {});
  }, [caseId]);

  useEffect(() => {
    msgsEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, streamingText, aiStatus]);

  async function loadThread(t) {
    setActiveThread(t);
    setMessages([]);
    setCitations([]);
    setStreamingText("");
    setAiStatus("");
    setHistoryLoading(true);
    try {
      const d = await api.threadHistory(t.id, "MAIN", caseId);
      setMessages(d.messages || []);
    } catch {
      setMessages([]);
    } finally {
      setHistoryLoading(false);
    }
  }

  async function createThread() {
    if (creating) return;
    setCreating(true);
    try {
      const title = `Thread ${threads.length + 1}`;
      const t = await api.createThread("MAIN", title, caseId);
      setThreads((prev) => [t, ...prev]);
      loadThread(t);
      setShowThreadList(false);
    } catch {}
    setCreating(false);
  }

  async function deleteThread(threadId) {
    if (!confirm("Delete this thread?")) return;
    await api.deleteThread(threadId);
    const remaining = threads.filter((t) => t.id !== threadId);
    setThreads(remaining);
    if (activeThread?.id === threadId) {
      if (remaining.length > 0) loadThread(remaining[0]);
      else { setActiveThread(null); setMessages([]); }
    }
  }

  const send = useCallback((text) => {
    const q = (text || query).trim();
    if (!q || loading || !activeThread) return;

    setLoading(true);
    if (!text) setQuery("");
    setStreamingText("");
    setAiStatus("");
    setCitations([]);

    const userMsg = { role: "user", content: q, timestamp: new Date().toISOString() };
    setMessages((prev) => [...prev, userMsg]);

    let accumulated = "";

    ctrlRef.current = api.streamChatV2(
      activeThread.id,
      "MAIN",
      q,
      caseId,
      // onChunk
      (token) => {
        accumulated += token;
        setStreamingText(accumulated);
        setAiStatus(""); // clear status once content arrives
      },
      // onDone
      (evt) => {
        const aiMsg = { role: "assistant", content: accumulated, timestamp: new Date().toISOString() };
        setMessages((prev) => [...prev, aiMsg]);
        setStreamingText("");
        setAiStatus("");
        setLoading(false);
        setThreads((prev) =>
          prev.map((t) =>
            t.id === activeThread.id
              ? { ...t, updated_at: new Date().toISOString() }
              : t
          )
        );
        inputRef.current?.focus();
      },
      // onError
      (err) => {
        setStreamingText("");
        setAiStatus("");
        setMessages((prev) => [
          ...prev,
          { role: "assistant", content: `⚠ ${err.message}`, timestamp: new Date().toISOString() },
        ]);
        setLoading(false);
      },
      // onStatus
      (status) => {
        setAiStatus(status);
      }
    );
  }, [query, loading, activeThread, caseId]);

  return (
    <div className="glass chat-panel">
      <style>{`
        @keyframes dot-bounce {
          0%, 80%, 100% { transform: scale(0.7); opacity: 0.4; }
          40% { transform: scale(1); opacity: 1; }
        }
        @keyframes cursor-blink { 50% { opacity: 0; } }
        @keyframes msgFade {
          from { opacity: 0; transform: translateY(4px); }
          to { opacity: 1; transform: none; }
        }
        @keyframes statusPulse {
          0%, 100% { opacity: 0.85; }
          50% { opacity: 1; }
        }
        .case-thread-item { cursor: pointer; border-radius: 0.5rem; padding: 0.35rem 0.5rem; transition: background 0.15s; }
        .case-thread-item:hover { background: rgba(99,102,241,0.12); }
        .case-thread-item.active-t { background: rgba(99,102,241,0.2); }
        .chat-panel-cite:hover { background: rgba(99,102,241,0.08) !important; }
      `}</style>

      {/* Panel header */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "0.45rem" }}>
        <div>
          <h3 style={{ fontSize: "0.95rem", margin: 0, fontWeight: 700, display: "flex", alignItems: "center", gap: "0.4rem" }}>
            <span style={{
              width: 20, height: 20, borderRadius: "0.35rem",
              background: "linear-gradient(135deg, #1e1b4b, #4338ca)",
              display: "inline-flex", alignItems: "center", justifyContent: "center",
              fontSize: "0.6rem", color: "#fff",
            }}>⚖</span>
            Case AI Co-pilot
          </h3>
          <p className="meta" style={{ marginBottom: 0, fontSize: "0.72rem" }}>
            {activeThread ? `Thread: ${activeThread.title}` : "Loading…"}
          </p>
        </div>
        <button
          className="btn btn-ghost btn-sm"
          style={{ fontSize: "0.72rem", padding: "0.2rem 0.5rem" }}
          onClick={() => setShowThreadList((v) => !v)}
          title="Manage threads"
        >
          🔀 Threads ({threads.length})
        </button>
      </div>

      {/* Thread list dropdown */}
      {showThreadList && (
        <div style={{
          background: "var(--bg-elevated)", border: "1px solid var(--border)",
          borderRadius: "0.6rem", padding: "0.5rem", marginBottom: "0.5rem",
          maxHeight: 180, overflowY: "auto",
        }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "0.35rem" }}>
            <span style={{ fontSize: "0.72rem", fontWeight: 700, color: "var(--muted)", textTransform: "uppercase" }}>
              Threads
            </span>
            <button className="btn btn-primary btn-sm" style={{ fontSize: "0.7rem", padding: "0.15rem 0.45rem" }} onClick={createThread} disabled={creating}>
              {creating ? <span className="spinner" /> : "+ New"}
            </button>
          </div>
          {threads.map((t) => (
            <div
              key={t.id}
              className={`case-thread-item${activeThread?.id === t.id ? " active-t" : ""}`}
              style={{ display: "flex", alignItems: "center", gap: "0.35rem" }}
              onClick={() => { loadThread(t); setShowThreadList(false); }}
            >
              <span style={{ flex: 1, fontSize: "0.78rem", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                {t.title}
              </span>
              <button
                className="btn btn-ghost btn-sm"
                style={{ fontSize: "0.68rem", padding: "0.1rem 0.25rem", color: "#ef4444", flexShrink: 0 }}
                onClick={(e) => { e.stopPropagation(); deleteThread(t.id); }}
                title="Delete thread"
              >🗑</button>
            </div>
          ))}
        </div>
      )}

      {/* Suggestion chips */}
      <div style={{ display: "flex", flexWrap: "wrap", gap: "0.3rem", marginBottom: "0.5rem" }}>
        {SUGGESTIONS.map((s) => (
          <button
            key={s} type="button"
            className="btn btn-ghost btn-sm"
            onClick={() => send(s)}
            disabled={loading || !activeThread}
            style={{ fontSize: "0.7rem" }}
          >
            {s}
          </button>
        ))}
      </div>

      {/* Messages */}
      <div className="chat-msgs" style={{ flex: 1, overflowY: "auto" }}>
        {historyLoading ? (
          <div style={{ display: "flex", justifyContent: "center", padding: "1.5rem", color: "var(--muted)", fontSize: "0.8rem" }}>
            <span className="spinner" style={{ marginRight: "0.4rem" }} /> Loading history…
          </div>
        ) : !activeThread ? (
          <p className="meta" style={{ padding: "0.5rem 0", fontSize: "0.8rem" }}>Loading thread…</p>
        ) : messages.length === 0 && !streamingText && !aiStatus ? (
          <div style={{ display: "flex", flexDirection: "column", alignItems: "center", padding: "1.5rem 0.5rem", color: "var(--muted)" }}>
            <div style={{ fontSize: "1.8rem", marginBottom: "0.4rem" }}>⚖</div>
            <div style={{ fontSize: "0.82rem", textAlign: "center" }}>Ask anything about this case</div>
            {caseTitle && (
              <div style={{ fontSize: "0.72rem", marginTop: "0.2rem", color: "var(--muted)", fontStyle: "italic" }}>
                {caseTitle}
              </div>
            )}
            <div style={{ marginTop: "0.75rem", display: "flex", flexWrap: "wrap", gap: "0.3rem", justifyContent: "center", maxWidth: 240 }}>
              {["fetch_case_info", "search_case_docs", "search_bns", "search_bnss"].map((tool) => (
                <span key={tool} style={{
                  fontSize: "0.58rem", padding: "0.1rem 0.35rem",
                  borderRadius: "0.3rem", background: "rgba(67,56,202,0.1)",
                  color: "#818cf8", fontFamily: "monospace",
                  border: "1px solid rgba(67,56,202,0.15)",
                }}>{tool}</span>
              ))}
            </div>
          </div>
        ) : (
          <>
            {messages.map((m, i) => <MessageBubble key={i} msg={m} />)}

            {/* Real-time status indicator */}
            {aiStatus && !streamingText && (
              <StatusIndicator status={aiStatus} />
            )}

            {/* Streaming text bubble */}
            {streamingText && (
              <div style={{ display: "flex", justifyContent: "flex-start", marginBottom: "0.6rem" }}>
                <div style={{
                  width: 24, height: 24, borderRadius: "50%",
                  background: "linear-gradient(135deg, var(--accent), #a78bfa)",
                  display: "flex", alignItems: "center", justifyContent: "center",
                  fontSize: "0.65rem", flexShrink: 0, marginRight: "0.4rem", marginTop: "0.15rem",
                  color: "#fff",
                }}>⚖</div>
                <div style={{
                  maxWidth: "85%", background: "var(--bg-elevated)",
                  borderRadius: "0.85rem 0.85rem 0.85rem 0.2rem",
                  padding: "0.55rem 0.8rem", fontSize: "0.83rem", lineHeight: 1.6,
                  border: "1px solid var(--border)", boxShadow: "0 1px 3px rgba(0,0,0,0.1)",
                }}>
                  <MarkdownContent content={streamingText} isUser={false} />
                  <span style={{
                    display: "inline-block", width: 2, height: "1em",
                    background: "var(--accent)", marginLeft: 2,
                    animation: "cursor-blink 0.8s step-end infinite",
                    verticalAlign: "text-bottom",
                  }} />
                </div>
              </div>
            )}
          </>
        )}
        <div ref={msgsEndRef} />
      </div>

      {/* Input */}
      <div style={{ display: "flex", gap: "0.5rem", marginTop: "0.5rem", paddingTop: "0.5rem", borderTop: "1px solid var(--border)" }}>
        <input
          ref={inputRef}
          className="input"
          style={{ marginBottom: 0, flex: 1 }}
          placeholder={activeThread ? "Ask about this case…" : "Loading…"}
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && !e.shiftKey && send()}
          disabled={loading || !activeThread}
        />
        <button
          type="button"
          className="btn btn-primary"
          disabled={loading || !query.trim() || !activeThread}
          onClick={() => send()}
          style={{ minWidth: 56 }}
        >
          {loading ? <span className="spinner" /> : "Ask"}
        </button>
      </div>
    </div>
  );
}
