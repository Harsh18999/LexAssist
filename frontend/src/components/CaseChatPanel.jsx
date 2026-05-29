import { useEffect, useState, useRef, useCallback } from "react";
import { api, formatTime } from "../api/client";

const SUGGESTIONS = [
  "Explain this judgment simply",
  "What precedent was cited?",
  "What was the final ruling?",
  "Explain Article 21 implication",
];

function TypingIndicator() {
  return (
    <div style={{ display: "flex", gap: "0.3rem", alignItems: "center", padding: "0.5rem 0.75rem" }}>
      {[0, 0.2, 0.4].map((delay, i) => (
        <span
          key={i}
          style={{
            width: 7, height: 7, borderRadius: "50%",
            background: "var(--accent)",
            display: "inline-block",
            animation: `dot-bounce 1.2s infinite ${delay}s`,
          }}
        />
      ))}
    </div>
  );
}

function MessageBubble({ msg }) {
  const isUser = msg.role === "user";
  return (
    <div style={{
      display: "flex",
      justifyContent: isUser ? "flex-end" : "flex-start",
      marginBottom: "0.55rem",
    }}>
      {!isUser && (
        <div style={{
          width: 22, height: 22, borderRadius: "50%",
          background: "linear-gradient(135deg, var(--accent), #a78bfa)",
          display: "flex", alignItems: "center", justifyContent: "center",
          fontSize: "0.65rem", flexShrink: 0, marginRight: "0.35rem", marginTop: "0.1rem",
        }}>⚖</div>
      )}
      <div style={{
        maxWidth: "84%",
        background: isUser
          ? "linear-gradient(135deg, var(--accent), #6366f1)"
          : "var(--bg-elevated)",
        color: isUser ? "#fff" : "var(--text)",
        borderRadius: isUser ? "0.8rem 0.8rem 0.2rem 0.8rem" : "0.8rem 0.8rem 0.8rem 0.2rem",
        padding: "0.5rem 0.7rem",
        fontSize: "0.83rem",
        lineHeight: 1.55,
        whiteSpace: "pre-wrap",
        border: isUser ? "none" : "1px solid var(--border)",
        boxShadow: "0 1px 3px rgba(0,0,0,0.12)",
      }}>
        {msg.content}
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
  const [citations, setCitations] = useState([]);
  const [query, setQuery] = useState("");
  const [loading, setLoading] = useState(false);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [creating, setCreating] = useState(false);

  const ctrlRef = useRef(null);
  const msgsEndRef = useRef(null);
  const inputRef = useRef(null);

  // Load threads for this case on mount
  useEffect(() => {
    if (!caseId) return;
    api.threads("case", caseId)
      .then(async (d) => {
        let list = d.threads || [];
        if (list.length === 0) {
          // Auto-create a default thread for this case
          const t = await api.defaultThread("case", caseId);
          list = [t];
        }
        setThreads(list);
        loadThread(list[0]);
      })
      .catch(() => {});
  }, [caseId]);

  useEffect(() => {
    msgsEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, streamingText]);

  async function loadThread(t) {
    setActiveThread(t);
    setMessages([]);
    setCitations([]);
    setStreamingText("");
    setHistoryLoading(true);
    try {
      const d = await api.threadHistory(t.id, "case", caseId);
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
      const t = await api.createThread("case", title, caseId);
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
    setCitations([]);

    const userMsg = { role: "user", content: q, timestamp: new Date().toISOString() };
    setMessages((prev) => [...prev, userMsg]);

    let accumulated = "";

    ctrlRef.current = api.streamChatV2(
      activeThread.id,
      "case",
      q,
      caseId,
      // onChunk
      (token) => {
        accumulated += token;
        setStreamingText(accumulated);
      },
      // onDone
      (evt) => {
        const aiMsg = { role: "assistant", content: accumulated, timestamp: new Date().toISOString() };
        setMessages((prev) => [...prev, aiMsg]);
        setStreamingText("");
        setCitations(evt.citations || []);
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
        setMessages((prev) => [
          ...prev,
          { role: "assistant", content: `⚠ ${err.message}`, timestamp: new Date().toISOString() },
        ]);
        setLoading(false);
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
        .case-thread-item { cursor: pointer; border-radius: 0.5rem; padding: 0.35rem 0.5rem; transition: background 0.15s; }
        .case-thread-item:hover { background: rgba(99,102,241,0.12); }
        .case-thread-item.active-t { background: rgba(99,102,241,0.2); }
      `}</style>

      {/* Panel header */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "0.45rem" }}>
        <div>
          <h3 style={{ fontSize: "0.95rem", margin: 0, fontWeight: 700 }}>Case AI Co-pilot</h3>
          <p className="meta" style={{ marginBottom: 0, fontSize: "0.75rem" }}>
            {activeThread ? `Thread: ${activeThread.title}` : "Loading…"}
          </p>
        </div>
        <button
          className="btn btn-ghost btn-sm"
          style={{ fontSize: "0.75rem", padding: "0.2rem 0.5rem" }}
          onClick={() => setShowThreadList((v) => !v)}
          title="Manage threads"
        >
          🔀 Threads ({threads.length})
        </button>
      </div>

      {/* Thread list dropdown */}
      {showThreadList && (
        <div style={{
          background: "var(--bg-elevated)",
          border: "1px solid var(--border)",
          borderRadius: "0.6rem",
          padding: "0.5rem",
          marginBottom: "0.5rem",
          maxHeight: 180,
          overflowY: "auto",
        }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "0.35rem" }}>
            <span style={{ fontSize: "0.75rem", fontWeight: 700, color: "var(--muted)", textTransform: "uppercase" }}>
              Threads
            </span>
            <button className="btn btn-primary btn-sm" style={{ fontSize: "0.72rem", padding: "0.15rem 0.45rem" }} onClick={createThread} disabled={creating}>
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
              <span style={{ flex: 1, fontSize: "0.8rem", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                {t.title}
              </span>
              <button
                className="btn btn-ghost btn-sm"
                style={{ fontSize: "0.7rem", padding: "0.1rem 0.25rem", color: "#ef4444", flexShrink: 0 }}
                onClick={(e) => { e.stopPropagation(); deleteThread(t.id); }}
                title="Delete thread"
              >🗑</button>
            </div>
          ))}
        </div>
      )}

      {/* Suggestion chips */}
      <div style={{ display: "flex", flexWrap: "wrap", gap: "0.3rem", marginBottom: "0.55rem" }}>
        {SUGGESTIONS.map((s) => (
          <button
            key={s}
            type="button"
            className="btn btn-ghost btn-sm"
            onClick={() => send(s)}
            disabled={loading || !activeThread}
            style={{ fontSize: "0.73rem" }}
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
        ) : messages.length === 0 && !streamingText ? (
          <div style={{ display: "flex", flexDirection: "column", alignItems: "center", padding: "1.5rem 0.5rem", color: "var(--muted)" }}>
            <div style={{ fontSize: "1.8rem", marginBottom: "0.4rem" }}>⚖</div>
            <div style={{ fontSize: "0.82rem", textAlign: "center" }}>Ask about this case…</div>
            {caseTitle && (
              <div style={{ fontSize: "0.75rem", marginTop: "0.2rem", color: "var(--muted)", fontStyle: "italic" }}>
                {caseTitle}
              </div>
            )}
          </div>
        ) : (
          <>
            {messages.map((m, i) => <MessageBubble key={i} msg={m} />)}

            {streamingText && (
              <div style={{ display: "flex", justifyContent: "flex-start", marginBottom: "0.55rem" }}>
                <div style={{ width: 22, height: 22, borderRadius: "50%", background: "linear-gradient(135deg, var(--accent), #a78bfa)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: "0.65rem", flexShrink: 0, marginRight: "0.35rem", marginTop: "0.1rem" }}>⚖</div>
                <div style={{ maxWidth: "84%", background: "var(--bg-elevated)", borderRadius: "0.8rem 0.8rem 0.8rem 0.2rem", padding: "0.5rem 0.7rem", fontSize: "0.83rem", lineHeight: 1.55, whiteSpace: "pre-wrap", border: "1px solid var(--border)" }}>
                  {streamingText}
                  <span style={{ display: "inline-block", width: 2, height: "1em", background: "var(--accent)", marginLeft: 2, animation: "cursor-blink 0.8s step-end infinite", verticalAlign: "text-bottom" }} />
                </div>
              </div>
            )}
            {loading && !streamingText && <TypingIndicator />}
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
          placeholder={activeThread ? "Legal research question…" : "Loading…"}
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && send()}
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

      {/* Citations */}
      {citations.length > 0 && (
        <div style={{ marginTop: "0.65rem" }}>
          <div className="label" style={{ marginBottom: "0.3rem", fontSize: "0.7rem" }}>CITATIONS</div>
          {citations.map((c, i) => (
            <div key={i} className="cite" style={{ marginBottom: "0.4rem" }}>
              <strong style={{ fontSize: "0.73rem", color: "var(--accent)" }}>{c.file_name}</strong>
              <p style={{ fontSize: "0.71rem", marginTop: "0.1rem", color: "var(--muted)" }}>{c.snippet}</p>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
