import { useEffect, useState, useRef, useCallback } from "react";
import { api, formatRelativeTime } from "../api/client";

/* ─────────────────────────────────────────────
   Sub-components
───────────────────────────────────────────── */

function TypingIndicator() {
  return (
    <div style={{ display: "flex", gap: "0.4rem", alignItems: "center", padding: "0.7rem 1rem" }}>
      {[0, 0.2, 0.4].map((delay, i) => (
        <span
          key={i}
          style={{
            width: 7, height: 7, borderRadius: "50%",
            background: "var(--accent)",
            display: "inline-block",
            animation: `dot-bounce 1.2s infinite ${delay}s`,
            opacity: 0.7,
          }}
        />
      ))}
    </div>
  );
}

const MODE_CONFIG = {
  MAIN: {
    label: "All Laws",
    icon: "⚖️",
    desc: "Search across all uploaded legal documents",
    gradient: "linear-gradient(135deg, #1e3a5f, #2563eb)",
    bg: "rgba(37,99,235,0.07)",
    border: "rgba(37,99,235,0.18)",
    tagBg: "rgba(37,99,235,0.08)",
  },
  BNS: {
    label: "BNS",
    icon: "📖",
    desc: "Bharatiya Nyaya Sanhita",
    gradient: "linear-gradient(135deg, #7c2d12, #ea580c)",
    bg: "rgba(234,88,12,0.07)",
    border: "rgba(234,88,12,0.18)",
    tagBg: "rgba(234,88,12,0.08)",
  },
  BNSS: {
    label: "BNSS",
    icon: "⚡",
    desc: "Bharatiya Nagarik Suraksha Sanhita",
    gradient: "linear-gradient(135deg, #4c1d95, #7c3aed)",
    bg: "rgba(124,58,237,0.07)",
    border: "rgba(124,58,237,0.18)",
    tagBg: "rgba(124,58,237,0.08)",
  },
  BSA: {
    label: "BSA",
    icon: "🔏",
    desc: "Bharatiya Sakshya Adhiniyam",
    gradient: "linear-gradient(135deg, #064e3b, #059669)",
    bg: "rgba(5,150,105,0.07)",
    border: "rgba(5,150,105,0.18)",
    tagBg: "rgba(5,150,105,0.08)",
  },
  CNT: {
    label: "Constitution",
    icon: "🏛️",
    desc: "Constitution of India",
    gradient: "linear-gradient(135deg, #78350f, #d97706)",
    bg: "rgba(217,119,6,0.07)",
    border: "rgba(217,119,6,0.18)",
    tagBg: "rgba(217,119,6,0.08)",
  },
  IT: {
    label: "IT Act",
    icon: "💻",
    desc: "Information Technology Act",
    gradient: "linear-gradient(135deg, #0f172a, #334155)",
    bg: "rgba(51,65,85,0.07)",
    border: "rgba(51,65,85,0.18)",
    tagBg: "rgba(51,65,85,0.08)",
  },
};

/* ─────────────────────────────────────────────
   Thread sidebar
───────────────────────────────────────────── */

function ThreadSidebar({ threads, activeThread, onSelect, onCreate, onRename, onDelete, loading, creating }) {
  const [renaming, setRenaming] = useState(null);
  const [renameVal, setRenameVal] = useState("");

  function startRename(t) {
    setRenaming(t.id);
    setRenameVal(t.title);
  }
  async function commitRename(t) {
    if (renameVal.trim() && renameVal !== t.title) await onRename(t.id, renameVal.trim());
    setRenaming(null);
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100%", gap: "0.6rem" }}>
      {/* New thread */}
      <button
        className="btn btn-primary"
        style={{ width: "100%", display: "flex", alignItems: "center", justifyContent: "center", gap: "0.4rem" }}
        onClick={onCreate}
        disabled={creating}
      >
        {creating ? <span className="spinner" /> : <span style={{ fontSize: "1rem" }}>＋</span>}
        New Thread
      </button>

      {/* List */}
      <div style={{ flex: 1, overflowY: "auto", display: "flex", flexDirection: "column", gap: "2px" }}>
        {loading ? (
          <div style={{ color: "var(--muted)", fontSize: "0.8rem", padding: "1rem 0.5rem", textAlign: "center" }}>
            <span className="spinner" style={{ marginRight: "0.3rem" }} /> Loading…
          </div>
        ) : threads.length === 0 ? (
          <div style={{ color: "var(--muted)", fontSize: "0.82rem", padding: "1.5rem 0.5rem", textAlign: "center" }}>
            <div style={{ fontSize: "1.5rem", marginBottom: "0.4rem" }}>💬</div>
            No conversations yet
          </div>
        ) : (
          threads.map((t) => {
            const isActive = activeThread?.id === t.id;
            const cfg = MODE_CONFIG[t.mode] || MODE_CONFIG.research;
            return (
              <div
                key={t.id}
                className="thread-item"
                onClick={() => onSelect(t)}
                style={{
                  borderRadius: "0.5rem",
                  padding: "0.5rem 0.55rem",
                  cursor: "pointer",
                  background: isActive ? cfg.bg : "transparent",
                  border: isActive ? `1px solid ${cfg.border}` : "1px solid transparent",
                  display: "flex",
                  alignItems: "center",
                  gap: "0.4rem",
                  transition: "all 0.12s ease",
                }}
              >
                <div style={{
                  width: 26, height: 26, borderRadius: "0.4rem",
                  background: isActive ? cfg.gradient : "var(--accent-dim)",
                  display: "flex", alignItems: "center", justifyContent: "center",
                  fontSize: "0.75rem", flexShrink: 0,
                  color: isActive ? "#fff" : "var(--muted)",
                  transition: "all 0.12s ease",
                }}>{cfg.icon}</div>

                <div style={{ flex: 1, minWidth: 0 }}>
                  {renaming === t.id ? (
                    <input
                      autoFocus
                      value={renameVal}
                      onChange={(e) => setRenameVal(e.target.value)}
                      onBlur={() => commitRename(t)}
                      onKeyDown={(e) => {
                        e.stopPropagation();
                        if (e.key === "Enter") commitRename(t);
                        if (e.key === "Escape") setRenaming(null);
                      }}
                      onClick={(e) => e.stopPropagation()}
                      style={{
                        width: "100%", fontSize: "0.8rem",
                        background: "var(--bg)", border: "1px solid var(--border-strong)",
                        borderRadius: "0.3rem", padding: "0.15rem 0.35rem", color: "var(--text)",
                      }}
                    />
                  ) : (
                    <div style={{
                      fontSize: "0.82rem", fontWeight: isActive ? 600 : 500,
                      overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
                      color: "var(--text)",
                    }}>{t.title}</div>
                  )}
                  <div style={{ fontSize: "0.67rem", color: "var(--muted)", marginTop: "1px" }}>
                    {formatRelativeTime(t.updated_at)}
                  </div>
                </div>

                {/* Actions — only show on hover/active via CSS */}
                <div className="thread-actions" onClick={(e) => e.stopPropagation()}
                  style={{ display: "flex", gap: "2px", flexShrink: 0, opacity: isActive ? 1 : 0, transition: "opacity 0.12s" }}
                >
                  <button className="btn btn-ghost btn-sm" title="Rename"
                    style={{ padding: "0.1rem 0.2rem", fontSize: "0.7rem" }}
                    onClick={() => startRename(t)}>✏</button>
                  <button className="btn btn-ghost btn-sm" title="Delete"
                    style={{ padding: "0.1rem 0.2rem", fontSize: "0.7rem", color: "#ef4444" }}
                    onClick={() => onDelete(t.id)}>✕</button>
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}

/* ─────────────────────────────────────────────
   Message bubble
───────────────────────────────────────────── */

function MessageBubble({ msg }) {
  const isUser = msg.role === "user";
  return (
    <div className="msg-enter" style={{
      display: "flex", justifyContent: isUser ? "flex-end" : "flex-start", marginBottom: "0.65rem",
    }}>
      {!isUser && (
        <div style={{
          width: 28, height: 28, borderRadius: "50%",
          background: "linear-gradient(135deg, #111, #444)",
          display: "flex", alignItems: "center", justifyContent: "center",
          fontSize: "0.75rem", flexShrink: 0, marginRight: "0.5rem", marginTop: "0.15rem",
          color: "#fff",
        }}>⚖</div>
      )}
      <div style={{
        maxWidth: "76%",
        background: isUser ? "var(--accent)" : "var(--bg-elevated)",
        color: isUser ? "#fff" : "var(--text)",
        borderRadius: isUser ? "1rem 1rem 0.2rem 1rem" : "1rem 1rem 1rem 0.2rem",
        padding: "0.6rem 0.85rem",
        fontSize: "0.875rem",
        lineHeight: 1.65,
        whiteSpace: "pre-wrap",
        border: isUser ? "none" : "1px solid var(--border)",
        boxShadow: isUser
          ? "0 2px 8px rgba(0,0,0,0.18)"
          : "0 1px 3px rgba(0,0,0,0.06)",
      }}>
        {msg.content}
      </div>
    </div>
  );
}

/* ─────────────────────────────────────────────
   Main Research page
───────────────────────────────────────────── */

export default function Research() {
  const [mode, setMode] = useState("MAIN");
  const [threads, setThreads] = useState([]);
  const [activeThread, setActiveThread] = useState(null);
  const [messages, setMessages] = useState([]);
  const [streamingText, setStreamingText] = useState("");
  const [citations, setCitations] = useState([]);
  const [query, setQuery] = useState("");
  const [loading, setLoading] = useState(false);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [threadsLoading, setThreadsLoading] = useState(true);
  const [creating, setCreating] = useState(false);

  const ctrlRef = useRef(null);
  const msgsEndRef = useRef(null);
  const inputRef = useRef(null);

  // Load threads for current mode — only fetch if needed
  useEffect(() => {
    let cancelled = false;
    setThreadsLoading(true);

    api.threads(mode, null).then((d) => {
      if (cancelled) return;
      const list = d.threads || [];
      setThreads(list);

      if (list.length > 0) {
        // Auto-select first if no active thread or active thread is from different mode
        if (!activeThread || activeThread.mode !== mode) {
          selectThread(list[0]);
        }
      } else {
        // Auto-create default thread
        api.defaultThread(mode, null).then((t) => {
          if (cancelled) return;
          setThreads([t]);
          selectThread(t);
        }).catch(() => {});
      }
    }).catch(() => {
      if (!cancelled) setThreads([]);
    }).finally(() => {
      if (!cancelled) setThreadsLoading(false);
    });

    return () => { cancelled = true; };
  }, [mode]);

  // Auto-scroll
  useEffect(() => {
    msgsEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, streamingText]);

  async function selectThread(t) {
    if (activeThread?.id === t.id) return; // No-op if already selected
    setActiveThread(t);
    setMessages([]);
    setCitations([]);
    setStreamingText("");
    setHistoryLoading(true);
    try {
      const d = await api.threadHistory(t.id, t.mode, t.case_id || null);
      setMessages(d.messages || []);
    } catch {
      setMessages([]);
    } finally {
      setHistoryLoading(false);
    }
  }

  // Debounced create — prevents double-click creating multiples
  const handleCreateThread = useCallback(async () => {
    if (creating) return;
    setCreating(true);
    try {
      const t = await api.createThread(mode, "New Conversation", null);
      setThreads((prev) => [t, ...prev]);
      setActiveThread(t);
      setMessages([]);
      setCitations([]);
      setStreamingText("");
      inputRef.current?.focus();
    } catch {}
    setCreating(false);
  }, [mode, creating]);

  async function handleRename(threadId, newTitle) {
    const updated = await api.renameThread(threadId, newTitle);
    setThreads((prev) => prev.map((t) => t.id === threadId ? updated : t));
    if (activeThread?.id === threadId) setActiveThread(updated);
  }

  async function handleDelete(threadId) {
    if (!confirm("Delete this conversation?")) return;
    await api.deleteThread(threadId);
    const remaining = threads.filter((t) => t.id !== threadId);
    setThreads(remaining);
    if (activeThread?.id === threadId) {
      if (remaining.length > 0) selectThread(remaining[0]);
      else { setActiveThread(null); setMessages([]); setCitations([]); }
    }
  }

  const send = useCallback(() => {
    const q = query.trim();
    if (!q || loading || !activeThread) return;

    setLoading(true);
    setQuery("");
    setStreamingText("");
    setCitations([]);

    setMessages((prev) => [...prev, { role: "user", content: q, timestamp: new Date().toISOString() }]);

    let accumulated = "";

    ctrlRef.current = api.streamChatV2(
      activeThread.id, mode, q, null,
      (token) => { accumulated += token; setStreamingText(accumulated); },
      (evt) => {
        setMessages((prev) => [...prev, { role: "assistant", content: accumulated, timestamp: new Date().toISOString() }]);
        setStreamingText("");
        setCitations(evt.citations || []);
        setLoading(false);
        setThreads((prev) => prev.map((t) =>
          t.id === activeThread.id ? { ...t, updated_at: new Date().toISOString() } : t
        ));
        inputRef.current?.focus();
      },
      (err) => {
        setStreamingText("");
        setMessages((prev) => [...prev, { role: "assistant", content: `⚠ Error: ${err.message}`, timestamp: new Date().toISOString() }]);
        setLoading(false);
      }
    );
  }, [query, loading, activeThread, mode]);

  function handleKeyDown(e) {
    if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); send(); }
  }

  const cfg = MODE_CONFIG[mode] || MODE_CONFIG.research;

  return (
    <>
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
        .msg-enter { animation: msgFade 0.2s ease; }
        .thread-item:hover { background: var(--accent-dim) !important; }
        .thread-item:hover .thread-actions { opacity: 1 !important; }
        .mode-tab { cursor: pointer; transition: all 0.15s ease; position: relative; }
        .mode-tab:hover { background: var(--accent-dim); }
        .mode-tab::after {
          content: ""; position: absolute; bottom: -1px; left: 50%;
          transform: translateX(-50%); width: 0; height: 2px;
          background: var(--accent); transition: width 0.2s ease; border-radius: 2px;
        }
        .mode-tab.active::after { width: 60%; }
      `}</style>

      {/* Page header with mode tabs */}
      <header className="page-head" style={{ marginBottom: "1rem" }}>
        <div style={{ display: "flex", alignItems: "flex-end", justifyContent: "space-between" }}>
          <div>
            <h2 style={{ marginBottom: "0.15rem" }}>AI Research</h2>
            <p style={{ color: "var(--muted)", fontSize: "0.82rem" }}>
              Thread-based conversations with persistent memory
            </p>
          </div>

          {/* Mode tabs */}
          <div style={{
            display: "flex", gap: 0,
            background: "var(--bg-elevated)", borderRadius: "0.6rem",
            border: "1px solid var(--border)", padding: "3px",
          }}>
            {Object.entries(MODE_CONFIG).map(([key, m]) => (
              <button
                key={key}
                className={`mode-tab${mode === key ? " active" : ""}`}
                onClick={() => setMode(key)}
                style={{
                  padding: "0.4rem 1rem", borderRadius: "0.45rem",
                  border: "none",
                  background: mode === key ? "var(--bg)" : "transparent",
                  color: mode === key ? "var(--text)" : "var(--muted)",
                  fontWeight: mode === key ? 700 : 500,
                  fontSize: "0.82rem",
                  display: "flex", alignItems: "center", gap: "0.3rem",
                  boxShadow: mode === key ? "0 1px 3px rgba(0,0,0,0.08)" : "none",
                }}
              >
                <span>{m.icon}</span> {m.label}
              </button>
            ))}
          </div>
        </div>
      </header>

      {/* 3-column layout */}
      <div style={{
        display: "grid",
        gridTemplateColumns: "230px 1fr 280px",
        gap: "0.85rem",
        height: "calc(100vh - 175px)",
        minHeight: 420,
      }}>
        {/* Sidebar */}
        <div className="glass" style={{ padding: "0.7rem", overflow: "hidden", display: "flex", flexDirection: "column", marginBottom: 0 }}>
          <div style={{
            fontSize: "0.7rem", fontWeight: 700, color: "var(--muted)",
            textTransform: "uppercase", letterSpacing: "0.06em",
            padding: "0 0.3rem", marginBottom: "0.5rem",
          }}>Conversations</div>
          <ThreadSidebar
            threads={threads}
            activeThread={activeThread}
            onSelect={selectThread}
            onCreate={handleCreateThread}
            onRename={handleRename}
            onDelete={handleDelete}
            loading={threadsLoading}
            creating={creating}
          />
        </div>

        {/* Chat */}
        <div className="glass" style={{
          display: "flex", flexDirection: "column", overflow: "hidden",
          padding: "0.85rem 1rem", marginBottom: 0,
        }}>
          {/* Thread header */}
          {activeThread && (
            <div style={{
              display: "flex", alignItems: "center", gap: "0.5rem",
              paddingBottom: "0.6rem", marginBottom: "0.5rem",
              borderBottom: "1px solid var(--border)",
            }}>
              <div style={{
                width: 28, height: 28, borderRadius: "0.4rem",
                background: cfg.gradient, display: "flex", alignItems: "center", justifyContent: "center",
                fontSize: "0.8rem", color: "#fff", flexShrink: 0,
              }}>{cfg.icon}</div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: "0.88rem", fontWeight: 700, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                  {activeThread.title}
                </div>
              </div>
              <span style={{
                fontSize: "0.68rem", padding: "0.15rem 0.5rem", borderRadius: "1rem",
                background: cfg.tagBg, color: "var(--muted)", fontWeight: 600, flexShrink: 0,
              }}>{cfg.label}</span>
            </div>
          )}

          {/* Messages area */}
          <div style={{ flex: 1, overflowY: "auto", paddingRight: "0.2rem" }}>
            {!activeThread ? (
              <div style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", height: "100%", color: "var(--muted)" }}>
                <div style={{ fontSize: "2.5rem", marginBottom: "0.75rem", opacity: 0.4 }}>💬</div>
                <div style={{ fontWeight: 600, marginBottom: "0.2rem" }}>Select a conversation</div>
                <div style={{ fontSize: "0.82rem" }}>or create a new thread from the sidebar</div>
              </div>
            ) : historyLoading ? (
              <div style={{ display: "flex", justifyContent: "center", alignItems: "center", height: "100%", color: "var(--muted)", fontSize: "0.85rem" }}>
                <span className="spinner" style={{ marginRight: "0.5rem" }} /> Loading history…
              </div>
            ) : messages.length === 0 && !streamingText ? (
              <div style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", height: "100%", color: "var(--muted)" }}>
                <div style={{
                  width: 56, height: 56, borderRadius: "1rem", background: cfg.bg,
                  display: "flex", alignItems: "center", justifyContent: "center",
                  fontSize: "1.5rem", marginBottom: "1rem", border: `1px solid ${cfg.border}`,
                }}>{cfg.icon}</div>
                <div style={{ fontWeight: 600, marginBottom: "0.2rem", color: "var(--text)" }}>{cfg.label}</div>
                <div style={{ fontSize: "0.82rem", textAlign: "center", maxWidth: 260, lineHeight: 1.5 }}>{cfg.desc}</div>
                <div style={{ marginTop: "1.25rem", fontSize: "0.78rem", color: "var(--muted-light)" }}>
                  Type your first question below
                </div>
              </div>
            ) : (
              <>
                {messages.map((m, i) => <MessageBubble key={i} msg={m} />)}
                {streamingText && (
                  <div className="msg-enter" style={{ display: "flex", justifyContent: "flex-start", marginBottom: "0.65rem" }}>
                    <div style={{ width: 28, height: 28, borderRadius: "50%", background: "linear-gradient(135deg, #111, #444)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: "0.75rem", flexShrink: 0, marginRight: "0.5rem", marginTop: "0.15rem", color: "#fff" }}>⚖</div>
                    <div style={{
                      maxWidth: "76%", background: "var(--bg-elevated)",
                      borderRadius: "1rem 1rem 1rem 0.2rem",
                      padding: "0.6rem 0.85rem", fontSize: "0.875rem", lineHeight: 1.65,
                      whiteSpace: "pre-wrap", border: "1px solid var(--border)",
                    }}>
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
          <div style={{
            display: "flex", gap: "0.5rem", marginTop: "auto",
            paddingTop: "0.65rem", borderTop: "1px solid var(--border)",
          }}>
            <textarea
              ref={inputRef}
              className="input"
              style={{ marginBottom: 0, flex: 1, resize: "none", minHeight: "2.5rem", maxHeight: "5rem", lineHeight: 1.5 }}
              rows={1}
              placeholder={
                !activeThread ? "Select a conversation…"
                : mode === "BNS" ? "Ask about Bharatiya Nyaya Sanhita…"
                : mode === "BNSS" ? "Ask about Bharatiya Nagarik Suraksha Sanhita…"
                : mode === "BSA" ? "Ask about Bharatiya Sakshya Adhiniyam…"
                : mode === "CNT" ? "Ask about the Constitution of India…"
                : mode === "IT" ? "Ask about the IT Act…"
                : "Ask about Indian law, judgments, statutes…"
              }
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              onKeyDown={handleKeyDown}
              disabled={loading || !activeThread}
            />
            <button
              type="button"
              className="btn btn-primary"
              disabled={loading || !query.trim() || !activeThread}
              onClick={send}
              style={{ alignSelf: "flex-end", height: "2.5rem", minWidth: 90 }}
            >
              {loading ? <span className="spinner" /> : "Send"}
            </button>
          </div>
        </div>

        {/* Right column: citations + info */}
        <div style={{ display: "flex", flexDirection: "column", gap: "0.85rem", overflow: "hidden" }}>
          <div className="glass" style={{ flex: 1, overflow: "auto", marginBottom: 0 }}>
            <h3 style={{ fontSize: "0.85rem", marginBottom: "0.65rem", fontWeight: 700, display: "flex", alignItems: "center", gap: "0.35rem" }}>
              📎 Citations
            </h3>
            {citations.length ? (
              citations.map((c, i) => (
                <div key={i} style={{
                  marginBottom: "0.55rem", padding: "0.5rem 0.6rem",
                  background: "var(--bg-elevated)", borderRadius: "0.5rem",
                  border: "1px solid var(--border)",
                }}>
                  <strong style={{ fontSize: "0.75rem", display: "block", marginBottom: "0.15rem", color: "var(--text)" }}>
                    {c.file_name}
                  </strong>
                  <p style={{ fontSize: "0.73rem", lineHeight: 1.5, color: "var(--muted)", margin: 0 }}>{c.snippet}</p>
                </div>
              ))
            ) : (
              <div style={{ display: "flex", flexDirection: "column", alignItems: "center", padding: "1.5rem 0", color: "var(--muted)" }}>
                <div style={{ fontSize: "1.3rem", marginBottom: "0.3rem", opacity: 0.4 }}>📎</div>
                <div style={{ fontSize: "0.78rem" }}>Sources appear after responses</div>
              </div>
            )}
          </div>

          {activeThread && (
            <div className="glass" style={{ marginBottom: 0, padding: "0.85rem" }}>
              <div style={{ fontSize: "0.68rem", fontWeight: 700, color: "var(--muted)", textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: "0.35rem" }}>
                Thread Info
              </div>
              <div style={{ fontSize: "0.82rem", fontWeight: 600, marginBottom: "0.1rem", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                {activeThread.title}
              </div>
              <div style={{ fontSize: "0.73rem", color: "var(--muted)" }}>
                {messages.length} messages · Persistent memory
              </div>
            </div>
          )}
        </div>
      </div>
    </>
  );
}
