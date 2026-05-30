import { useEffect, useState, useRef, useCallback } from "react";
import { api, formatRelativeTime } from "../api/client";
import { Skeleton } from "../components/ui";

/* ── Markdown renderer ──────────────────────────────────────── */
function renderMarkdown(text) {
  if (!text) return "";
  let s = text.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
  s = s.replace(/```[\s\S]*?```/g, (m) => {
    const inner = m.slice(3, -3).replace(/^[a-z]*\n/, "");
    return `<pre style="background:rgba(0,0,0,0.22);border-radius:0.5rem;padding:0.75rem 1rem;overflow-x:auto;font-size:0.79rem;margin:0.5rem 0;border:1px solid rgba(255,255,255,0.06)"><code>${inner}</code></pre>`;
  });
  s = s.replace(/`([^`]+)`/g, '<code style="background:rgba(0,0,0,0.2);border-radius:0.2rem;padding:0.05em 0.35em;font-size:0.85em">$1</code>');
  s = s.replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>");
  s = s.replace(/\*(.+?)\*/g, "<em>$1</em>");
  s = s.replace(/^### (.+)$/gm, '<h4 style="margin:0.7rem 0 0.25rem;font-size:0.93rem;font-weight:700">$1</h4>');
  s = s.replace(/^## (.+)$/gm, '<h3 style="margin:0.8rem 0 0.3rem;font-size:1rem;font-weight:700">$1</h3>');
  s = s.replace(/^# (.+)$/gm, '<h2 style="margin:0.8rem 0 0.35rem;font-size:1.1rem;font-weight:700">$1</h2>');
  s = s.replace(/^[-•] (.+)$/gm, '<li style="margin:0.15rem 0 0.15rem 1.1rem">$1</li>');
  s = s.replace(/(<li[^>]*>[\s\S]*?<\/li>\n?)+/gs, (m) => `<ul style="padding-left:0.25rem;margin:0.3rem 0">${m}</ul>`);
  s = s.replace(/^\d+\. (.+)$/gm, '<li style="margin:0.15rem 0 0.15rem 1.1rem">$1</li>');
  s = s.replace(/^---$/gm, '<hr style="border:none;border-top:1px solid rgba(255,255,255,0.1);margin:0.6rem 0"/>');
  s = s.replace(/\n\n/g, '</p><p style="margin:0.35rem 0">');
  s = `<p style="margin:0">${s}</p>`;
  s = s.replace(/\n/g, "<br/>");
  return s;
}

function MarkdownContent({ content, isUser }) {
  if (isUser) return <span style={{ whiteSpace: "pre-wrap" }}>{content}</span>;
  return <div style={{ lineHeight: 1.68 }} dangerouslySetInnerHTML={{ __html: renderMarkdown(content) }} />;
}

/* ── Real-time AI status chip ────────────────────────────────── */
function AIStatusChip({ status, gradient }) {
  const icons = {
    "Thinking…": "🧠", "Searching documents…": "🔍",
    "Fetching case info…": "📋", "Writing response…": "✍️",
    "Searching BNS…": "📖", "Searching BNSS…": "⚡",
    "Searching BSA…": "🔏", "Searching Constitution…": "🏛️",
    "Searching IT Act…": "💻", "Searching case documents…": "📂",
    "Searching all laws…": "⚖️",
  };
  return (
    <div className="msg-enter" style={{ display: "flex", justifyContent: "flex-start", marginBottom: "0.5rem" }}>
      <div style={{
        width: 28, height: 28, borderRadius: "50%",
        background: gradient || "linear-gradient(135deg,#1e3a5f,#2563eb)",
        display: "flex", alignItems: "center", justifyContent: "center",
        fontSize: "0.75rem", flexShrink: 0, marginRight: "0.5rem", marginTop: "0.1rem", color: "#fff",
      }}>⚖</div>
      <div style={{
        display: "flex", alignItems: "center", gap: "0.5rem",
        padding: "0.45rem 0.85rem",
        background: "var(--bg-elevated)",
        borderRadius: "1rem 1rem 1rem 0.2rem",
        border: "1px solid var(--border)",
        fontSize: "0.8rem", color: "var(--muted)",
        animation: "statusPulse 1.8s ease-in-out infinite",
      }}>
        <span>{icons[status] || "🔄"}</span>
        <span>{status}</span>
        <span style={{ display: "flex", gap: "0.25rem", marginLeft: "0.2rem" }}>
          {[0, 0.2, 0.4].map((d, i) => (
            <span key={i} style={{
              width: 4, height: 4, borderRadius: "50%",
              background: "var(--accent)", display: "inline-block",
              animation: `dot-bounce 1.2s infinite ${d}s`,
            }} />
          ))}
        </span>
      </div>
    </div>
  );
}

const MODE_CONFIG = {
  MAIN: {
    label: "All Laws", icon: "⚖️",
    desc: "Search across all uploaded legal documents",
    gradient: "linear-gradient(135deg,#1e3a5f,#2563eb)",
    bg: "rgba(37,99,235,0.07)", border: "rgba(37,99,235,0.18)", tagBg: "rgba(37,99,235,0.08)",
  },
  BNS: {
    label: "BNS", icon: "📖",
    desc: "Bharatiya Nyaya Sanhita",
    gradient: "linear-gradient(135deg,#7c2d12,#ea580c)",
    bg: "rgba(234,88,12,0.07)", border: "rgba(234,88,12,0.18)", tagBg: "rgba(234,88,12,0.08)",
  },
  BNSS: {
    label: "BNSS", icon: "⚡",
    desc: "Bharatiya Nagarik Suraksha Sanhita",
    gradient: "linear-gradient(135deg,#4c1d95,#7c3aed)",
    bg: "rgba(124,58,237,0.07)", border: "rgba(124,58,237,0.18)", tagBg: "rgba(124,58,237,0.08)",
  },
  BSA: {
    label: "BSA", icon: "🔏",
    desc: "Bharatiya Sakshya Adhiniyam",
    gradient: "linear-gradient(135deg,#064e3b,#059669)",
    bg: "rgba(5,150,105,0.07)", border: "rgba(5,150,105,0.18)", tagBg: "rgba(5,150,105,0.08)",
  },
  CNT: {
    label: "Constitution", icon: "🏛️",
    desc: "Constitution of India",
    gradient: "linear-gradient(135deg,#78350f,#d97706)",
    bg: "rgba(217,119,6,0.07)", border: "rgba(217,119,6,0.18)", tagBg: "rgba(217,119,6,0.08)",
  },
  IT: {
    label: "IT Act", icon: "💻",
    desc: "Information Technology Act",
    gradient: "linear-gradient(135deg,#0f172a,#334155)",
    bg: "rgba(51,65,85,0.07)", border: "rgba(51,65,85,0.18)", tagBg: "rgba(51,65,85,0.08)",
  },
};

/* ── Thread sidebar ─────────────────────────────────────────── */
function ThreadSidebar({ threads, activeThread, onSelect, onCreate, onRename, onDelete, loading, creating }) {
  const [renaming, setRenaming] = useState(null);
  const [renameVal, setRenameVal] = useState("");

  function startRename(t) { setRenaming(t.id); setRenameVal(t.title); }
  async function commitRename(t) {
    if (renameVal.trim() && renameVal !== t.title) await onRename(t.id, renameVal.trim());
    setRenaming(null);
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100%", gap: "0.5rem" }}>
      <button
        className="btn btn-primary"
        style={{ width: "100%", display: "flex", alignItems: "center", justifyContent: "center", gap: "0.4rem", fontSize: "0.83rem" }}
        onClick={onCreate}
        disabled={creating}
      >
        {creating ? <span className="spinner" /> : <span style={{ fontSize: "1rem" }}>＋</span>}
        New Thread
      </button>

      <div style={{ flex: 1, overflowY: "auto", display: "flex", flexDirection: "column", gap: "2px" }}>
        {loading ? (
          <div style={{ display: "flex", flexDirection: "column", gap: "0.4rem", padding: "0.25rem 0" }}>
            {["70%", "55%", "80%", "60%"].map((w, i) => (
              <div key={i} style={{ display: "flex", alignItems: "center", gap: "0.5rem", padding: "0.4rem 0.35rem" }}>
                <Skeleton width={26} height={26} radius={6} />
                <div style={{ flex: 1 }}>
                  <Skeleton width={w} height="0.75rem" style={{ marginBottom: "0.35rem" }} />
                  <Skeleton width="35%" height="0.55rem" />
                </div>
              </div>
            ))}
          </div>
        ) : threads.length === 0 ? (
          <div style={{ color: "var(--muted)", fontSize: "0.82rem", padding: "1.5rem 0.5rem", textAlign: "center" }}>
            <div style={{ fontSize: "1.5rem", marginBottom: "0.4rem" }}>💬</div>
            No conversations yet
          </div>
        ) : (
          threads.map((t) => {
            const isActive = activeThread?.id === t.id;
            const cfg = MODE_CONFIG[t.mode] || MODE_CONFIG.MAIN;
            return (
              <div
                key={t.id}
                className="thread-item"
                onClick={() => onSelect(t)}
                style={{
                  borderRadius: "0.5rem", padding: "0.5rem 0.55rem", cursor: "pointer",
                  background: isActive ? cfg.bg : "transparent",
                  border: isActive ? `1px solid ${cfg.border}` : "1px solid transparent",
                  display: "flex", alignItems: "center", gap: "0.4rem",
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
                      autoFocus value={renameVal}
                      onChange={(e) => setRenameVal(e.target.value)}
                      onBlur={() => commitRename(t)}
                      onKeyDown={(e) => { e.stopPropagation(); if (e.key === "Enter") commitRename(t); if (e.key === "Escape") setRenaming(null); }}
                      onClick={(e) => e.stopPropagation()}
                      style={{ width: "100%", fontSize: "0.8rem", background: "var(--bg)", border: "1px solid var(--border-strong)", borderRadius: "0.3rem", padding: "0.15rem 0.35rem", color: "var(--text)" }}
                    />
                  ) : (
                    <div style={{ fontSize: "0.82rem", fontWeight: isActive ? 600 : 500, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", color: "var(--text)" }}>
                      {t.title}
                    </div>
                  )}
                  <div style={{ fontSize: "0.67rem", color: "var(--muted)", marginTop: "1px" }}>{formatRelativeTime(t.updated_at)}</div>
                </div>

                <div className="thread-actions" onClick={(e) => e.stopPropagation()}
                  style={{ display: "flex", gap: "2px", flexShrink: 0, opacity: isActive ? 1 : 0, transition: "opacity 0.12s" }}>
                  <button className="btn btn-ghost btn-sm" style={{ padding: "0.1rem 0.2rem", fontSize: "0.7rem" }} onClick={() => startRename(t)}>✏</button>
                  <button className="btn btn-ghost btn-sm" style={{ padding: "0.1rem 0.2rem", fontSize: "0.7rem", color: "#ef4444" }} onClick={() => onDelete(t.id)}>✕</button>
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}

function MessageBubble({ msg, gradient }) {
  const isUser = msg.role === "user";
  return (
    <div className="msg-enter" style={{ display: "flex", justifyContent: isUser ? "flex-end" : "flex-start", marginBottom: "0.65rem" }}>
      {!isUser && (
        <div style={{
          width: 28, height: 28, borderRadius: "50%",
          background: gradient || "linear-gradient(135deg,#1e3a5f,#2563eb)",
          display: "flex", alignItems: "center", justifyContent: "center",
          fontSize: "0.75rem", flexShrink: 0, marginRight: "0.5rem", marginTop: "0.15rem", color: "#fff",
        }}>⚖</div>
      )}
      <div style={{
        maxWidth: "76%",
        background: isUser ? "var(--accent)" : "var(--bg-elevated)",
        color: isUser ? "#fff" : "var(--text)",
        borderRadius: isUser ? "1rem 1rem 0.2rem 1rem" : "1rem 1rem 1rem 0.2rem",
        padding: "0.65rem 0.9rem", fontSize: "0.875rem", lineHeight: 1.65,
        border: isUser ? "none" : "1px solid var(--border)",
        boxShadow: isUser ? "0 2px 8px rgba(0,0,0,0.18)" : "0 1px 3px rgba(0,0,0,0.06)",
      }}>
        <MarkdownContent content={msg.content} isUser={isUser} />
        {msg.citations?.length > 0 && (
          <details style={{ marginTop: "0.5rem", fontSize: "0.75rem", opacity: 0.85 }}>
            <summary style={{ cursor: "pointer", fontWeight: 600, color: "var(--muted)" }}>
              📎 {msg.citations.length} source{msg.citations.length > 1 ? "s" : ""}
            </summary>
            {msg.citations.map((c, i) => (
              <div key={i} style={{ marginTop: "0.3rem", padding: "0.4rem 0.6rem", background: "rgba(0,0,0,0.15)", borderRadius: "0.4rem", lineHeight: 1.5 }}>
                <div style={{ fontWeight: 600, marginBottom: "0.15rem" }}>📄 {c.file_name}</div>
                <div style={{ fontStyle: "italic", opacity: 0.8 }}>"{c.snippet}…"</div>
              </div>
            ))}
          </details>
        )}
      </div>
    </div>
  );
}

/* ── Case picker popup (ChatGPT-style) ───────────────────────── */
function CasePicker({ onSelect, onClose }) {
  const [cases, setCases] = useState([]);
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const inputRef = useRef(null);

  useEffect(() => {
    api.cases("", "", 1, 100)
      .then((r) => setCases(r.cases || []))
      .finally(() => setLoading(false));
    setTimeout(() => inputRef.current?.focus(), 50);
  }, []);

  const filtered = cases.filter((c) =>
    !search || c.title.toLowerCase().includes(search.toLowerCase()) ||
    (c.case_number || "").toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div style={{
      position: "absolute", bottom: "calc(100% + 0.5rem)", left: 0,
      width: "min(380px, 90vw)",
      background: "var(--bg-elevated)",
      border: "1px solid var(--border)",
      borderRadius: "0.85rem",
      boxShadow: "0 12px 40px rgba(0,0,0,0.35)",
      zIndex: 100,
      animation: "popupIn 0.15s ease",
      overflow: "hidden",
    }}>
      <div style={{ padding: "0.65rem 0.75rem", borderBottom: "1px solid var(--border)" }}>
        <input
          ref={inputRef}
          className="input"
          style={{ marginBottom: 0, fontSize: "0.83rem" }}
          placeholder="Search cases…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          onKeyDown={(e) => e.key === "Escape" && onClose()}
        />
      </div>
      <div style={{ maxHeight: "260px", overflowY: "auto" }}>
        {/* "No case" option */}
        <div
          onClick={() => onSelect(null)}
          style={{ padding: "0.55rem 0.9rem", cursor: "pointer", fontSize: "0.82rem", color: "var(--muted)", display: "flex", alignItems: "center", gap: "0.5rem", borderBottom: "1px solid var(--border)" }}
          className="case-pick-row"
        >
          <span style={{ fontSize: "0.9rem" }}>✕</span> No case — global search
        </div>
        {loading ? (
          <div style={{ padding: "1rem", display: "flex", flexDirection: "column", gap: "0.4rem" }}>
            {[1, 2, 3].map((i) => <Skeleton key={i} height="1.8rem" />)}
          </div>
        ) : filtered.length === 0 ? (
          <div style={{ padding: "1.25rem", textAlign: "center", color: "var(--muted)", fontSize: "0.82rem" }}>
            No cases found
          </div>
        ) : (
          filtered.map((c) => (
            <div
              key={c.id}
              className="case-pick-row"
              onClick={() => onSelect(c)}
              style={{ padding: "0.6rem 0.9rem", cursor: "pointer", display: "flex", alignItems: "center", gap: "0.6rem" }}
            >
              <div style={{
                width: 30, height: 30, borderRadius: "0.4rem",
                background: "rgba(67,56,202,0.1)", border: "1px solid rgba(67,56,202,0.2)",
                display: "flex", alignItems: "center", justifyContent: "center", fontSize: "0.85rem", flexShrink: 0,
              }}>⚖️</div>
              <div style={{ minWidth: 0 }}>
                <div style={{ fontWeight: 600, fontSize: "0.83rem", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{c.title}</div>
                <div style={{ fontSize: "0.7rem", color: "var(--muted)" }}>
                  {c.client_name}{c.case_number ? ` · #${c.case_number}` : ""}
                </div>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}

/* ── Main Research page ──────────────────────────────────────── */
export default function Research() {
  const [mode, setMode] = useState("MAIN");
  const [selectedCase, setSelectedCase] = useState(null); // { id, title, ... } or null
  const [showCasePicker, setShowCasePicker] = useState(false);
  const [threads, setThreads] = useState([]);
  const [activeThread, setActiveThread] = useState(null);
  const [messages, setMessages] = useState([]);
  const [streamingText, setStreamingText] = useState("");
  const [streamingCitations, setStreamingCitations] = useState([]);
  const [aiStatus, setAiStatus] = useState("");
  const [query, setQuery] = useState("");
  const [loading, setLoading] = useState(false);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [threadsLoading, setThreadsLoading] = useState(true);
  const [creating, setCreating] = useState(false);

  const ctrlRef   = useRef(null);
  const msgsEndRef = useRef(null);
  const inputRef   = useRef(null);
  const pickerRef  = useRef(null);

  // Effective mode: if a case is selected, switch to CASE mode automatically
  const effectiveMode = selectedCase ? "CASE" : mode;
  const effectiveCaseId = selectedCase?.id || null;
  const cfg = MODE_CONFIG[mode] || MODE_CONFIG.MAIN;

  // Close picker on outside click
  useEffect(() => {
    function handle(e) {
      if (pickerRef.current && !pickerRef.current.contains(e.target)) setShowCasePicker(false);
    }
    document.addEventListener("mousedown", handle);
    return () => document.removeEventListener("mousedown", handle);
  }, []);

  // Load threads when mode or case changes
  useEffect(() => {
    let cancelled = false;
    setThreadsLoading(true);
    setActiveThread(null);
    setMessages([]);
    setStreamingText("");
    setAiStatus("");

    const threadMode = effectiveMode;
    const threadCase = effectiveCaseId;

    api.threads(threadMode, threadCase).then((d) => {
      if (cancelled) return;
      const list = d.threads || [];
      setThreads(list);
      if (list.length > 0) {
        selectThread(list[0]);
      } else {
        api.defaultThread(threadMode, threadCase).then((t) => {
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
  }, [mode, selectedCase?.id]);

  useEffect(() => {
    msgsEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, streamingText, aiStatus]);

  async function selectThread(t) {
    if (activeThread?.id === t.id) return;
    setActiveThread(t);
    setMessages([]);
    setStreamingText("");
    setAiStatus("");
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

  const handleCreateThread = useCallback(async () => {
    if (creating) return;
    setCreating(true);
    try {
      const t = await api.createThread(effectiveMode, "New Conversation", effectiveCaseId);
      setThreads((prev) => [t, ...prev]);
      setActiveThread(t);
      setMessages([]);
      setStreamingText("");
      setAiStatus("");
      inputRef.current?.focus();
    } catch {}
    setCreating(false);
  }, [effectiveMode, creating, effectiveCaseId]);

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
      else { setActiveThread(null); setMessages([]); }
    }
  }

  const send = useCallback(() => {
    const q = query.trim();
    if (!q || loading || !activeThread) return;

    setLoading(true);
    setQuery("");
    setStreamingText("");
    setStreamingCitations([]);
    setAiStatus("");

    setMessages((prev) => [...prev, { role: "user", content: q, timestamp: new Date().toISOString() }]);

    let accumulated = "";
    let gotDone = false;

    ctrlRef.current = api.streamChatV2(
      activeThread.id, effectiveMode, q, effectiveCaseId,
      (token) => {
        accumulated += token;
        setStreamingText(accumulated);
        setAiStatus("");
      },
      (evt) => {
        gotDone = true;
        const finalContent = accumulated || evt.final_answer || "";
        if (finalContent) {
          setMessages((prev) => [...prev, {
            role: "assistant", content: finalContent,
            citations: evt.citations || [],
            timestamp: new Date().toISOString(),
          }]);
        }
        setStreamingText("");
        setStreamingCitations([]);
        setAiStatus("");
        setLoading(false);
        setThreads((prev) => prev.map((t) =>
          t.id === activeThread.id ? { ...t, updated_at: new Date().toISOString() } : t
        ));
        inputRef.current?.focus();
      },
      (err) => {
        if (accumulated && !gotDone) {
          setMessages((prev) => [...prev, { role: "assistant", content: accumulated, timestamp: new Date().toISOString() }]);
        } else {
          setMessages((prev) => [...prev, { role: "assistant", content: `⚠ Error: ${err.message}`, timestamp: new Date().toISOString() }]);
        }
        setStreamingText("");
        setAiStatus("");
        setLoading(false);
      },
      (status) => setAiStatus(status),
    );
  }, [query, loading, activeThread, effectiveMode, effectiveCaseId]);

  function handleKeyDown(e) {
    if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); send(); }
  }

  function handleCaseSelect(c) {
    setSelectedCase(c);
    setShowCasePicker(false);
  }

  const chatDisabled = loading || !activeThread;
  const activeGradient = selectedCase
    ? "linear-gradient(135deg,#1e1b4b,#4338ca)"
    : cfg.gradient;

  const placeholder = !activeThread ? "Select a conversation…"
    : selectedCase ? `Ask about case: ${selectedCase.title}…`
    : mode === "BNS" ? "Ask about Bharatiya Nyaya Sanhita…"
    : mode === "BNSS" ? "Ask about Bharatiya Nagarik Suraksha Sanhita…"
    : mode === "BSA" ? "Ask about Bharatiya Sakshya Adhiniyam…"
    : mode === "CNT" ? "Ask about the Constitution of India…"
    : mode === "IT" ? "Ask about the IT Act…"
    : "Ask about Indian law, judgments, statutes…";

  return (
    <>
      <style>{`
        @keyframes dot-bounce { 0%,80%,100% { transform:scale(0.7);opacity:0.4; } 40% { transform:scale(1);opacity:1; } }
        @keyframes cursor-blink { 50% { opacity:0; } }
        @keyframes msgFade { from { opacity:0;transform:translateY(4px); } to { opacity:1;transform:none; } }
        @keyframes statusPulse { 0%,100% { opacity:0.82; } 50% { opacity:1; } }
        @keyframes popupIn { from { opacity:0;transform:translateY(6px) scale(0.97); } to { opacity:1;transform:none; } }
        @keyframes shimmer { 0% { background-position:200% 0; } 100% { background-position:-200% 0; } }
        .msg-enter { animation:msgFade 0.2s ease; }
        .thread-item:hover { background:var(--accent-dim) !important; }
        .thread-item:hover .thread-actions { opacity:1 !important; }
        .mode-tab { cursor:pointer;transition:all 0.15s ease; }
        .mode-tab:hover { background:var(--accent-dim); }
        .case-pick-row:hover { background:var(--accent-dim); }
        .case-chip-close { opacity:0;transition:opacity 0.15s; }
        .case-chip:hover .case-chip-close { opacity:1; }
        .tool-badge {
          display:inline-flex;align-items:center;gap:0.25rem;
          font-size:0.62rem;padding:0.12rem 0.45rem;border-radius:1rem;
          font-weight:700;font-family:monospace;letter-spacing:0.03em;
        }
      `}</style>

      {/* ── Header ─────────────────────────────────────────────── */}
      <header className="page-head" style={{ marginBottom: "1rem" }}>
        <div style={{ display: "flex", alignItems: "flex-end", justifyContent: "space-between", flexWrap: "wrap", gap: "0.5rem" }}>
          <div>
            <h2 style={{ marginBottom: "0.1rem" }}>AI Research</h2>
            <p style={{ color: "var(--muted)", fontSize: "0.82rem" }}>
              Thread-based conversations with persistent memory
            </p>
          </div>

          {/* Mode tabs — no CASE mode here anymore */}
          <div style={{
            display: "flex", gap: 0,
            background: "var(--bg-elevated)", borderRadius: "0.6rem",
            border: "1px solid var(--border)", padding: "3px", flexWrap: "wrap",
          }}>
            {Object.entries(MODE_CONFIG).map(([key, m]) => (
              <button
                key={key}
                className="mode-tab"
                onClick={() => { setMode(key); setSelectedCase(null); }}
                style={{
                  padding: "0.38rem 0.85rem", borderRadius: "0.45rem", border: "none",
                  background: mode === key && !selectedCase ? "var(--bg)" : "transparent",
                  color: mode === key && !selectedCase ? "var(--text)" : "var(--muted)",
                  fontWeight: mode === key && !selectedCase ? 700 : 500,
                  fontSize: "0.81rem",
                  display: "flex", alignItems: "center", gap: "0.3rem",
                  boxShadow: mode === key && !selectedCase ? "0 1px 3px rgba(0,0,0,0.08)" : "none",
                }}
              >
                <span>{m.icon}</span> {m.label}
              </button>
            ))}
          </div>
        </div>
      </header>

      {/* ── 2-column layout ────────────────────────────────────── */}
      <div style={{
        display: "grid",
        gridTemplateColumns: "220px 1fr",
        gap: "0.85rem",
        height: "calc(100vh - 175px)",
        minHeight: 420,
      }}>
        {/* Sidebar */}
        <div className="glass" style={{ padding: "0.7rem", overflow: "hidden", display: "flex", flexDirection: "column", marginBottom: 0 }}>
          <div style={{ fontSize: "0.68rem", fontWeight: 700, color: "var(--muted)", textTransform: "uppercase", letterSpacing: "0.06em", padding: "0 0.3rem", marginBottom: "0.5rem" }}>
            Conversations
          </div>
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

        {/* Chat panel */}
        <div className="glass" style={{ display: "flex", flexDirection: "column", overflow: "hidden", padding: "0.85rem 1rem", marginBottom: 0 }}>
          {/* Thread header */}
          {activeThread && (
            <div style={{
              display: "flex", alignItems: "center", gap: "0.5rem",
              paddingBottom: "0.6rem", marginBottom: "0.5rem",
              borderBottom: "1px solid var(--border)",
            }}>
              <div style={{
                width: 28, height: 28, borderRadius: "0.4rem",
                background: activeGradient,
                display: "flex", alignItems: "center", justifyContent: "center",
                fontSize: "0.8rem", color: "#fff", flexShrink: 0,
              }}>{selectedCase ? "🗂️" : cfg.icon}</div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: "0.88rem", fontWeight: 700, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                  {activeThread.title}
                </div>
                {selectedCase && (
                  <div style={{ fontSize: "0.68rem", color: "var(--muted)", marginTop: "1px" }}>
                    📂 {selectedCase.title}
                    {selectedCase.case_number && ` · #${selectedCase.case_number}`}
                  </div>
                )}
              </div>

              {/* Active tools badges */}
              <div style={{ display: "flex", gap: "0.3rem", flexWrap: "wrap", justifyContent: "flex-end", maxWidth: 260 }}>
                {selectedCase ? (
                  <>
                    {["case_info", "case_docs", "bns", "bnss", "bsa", "constitution", "it_act", "all_laws"].map((tool) => (
                      <span key={tool} className="tool-badge" style={{ background: "rgba(67,56,202,0.1)", color: "#818cf8", border: "1px solid rgba(67,56,202,0.2)" }}>
                        {tool}
                      </span>
                    ))}
                  </>
                ) : (
                  <span className="tool-badge" style={{ background: cfg.tagBg || "rgba(37,99,235,0.08)", color: "var(--muted)", border: "1px solid var(--border)" }}>
                    {cfg.label}
                  </span>
                )}
              </div>
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
              <div style={{ padding: "1rem 0.25rem", display: "flex", flexDirection: "column", gap: "0.75rem" }}>
                <div style={{ display: "flex", gap: "0.5rem", alignItems: "flex-start" }}>
                  <Skeleton width={28} height={28} radius={"50%"} style={{ flexShrink: 0, marginTop: "0.1rem" }} />
                  <div style={{ flex: 1 }}>
                    <Skeleton width="70%" height="0.85rem" style={{ marginBottom: "0.4rem" }} />
                    <Skeleton width="85%" height="0.75rem" style={{ marginBottom: "0.4rem" }} />
                    <Skeleton width="50%" height="0.75rem" />
                  </div>
                </div>
                <div style={{ display: "flex", justifyContent: "flex-end" }}>
                  <Skeleton width="45%" height="2rem" radius={12} />
                </div>
                <div style={{ display: "flex", gap: "0.5rem", alignItems: "flex-start" }}>
                  <Skeleton width={28} height={28} radius={"50%"} style={{ flexShrink: 0, marginTop: "0.1rem" }} />
                  <div style={{ flex: 1 }}>
                    <Skeleton width="80%" height="0.85rem" style={{ marginBottom: "0.4rem" }} />
                    <Skeleton width="60%" height="0.75rem" />
                  </div>
                </div>
              </div>
            ) : messages.length === 0 && !streamingText && !aiStatus ? (
              <div style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", height: "100%", color: "var(--muted)" }}>
                <div style={{
                  width: 60, height: 60, borderRadius: "1rem",
                  background: selectedCase ? "rgba(67,56,202,0.08)" : cfg.bg || "rgba(37,99,235,0.07)",
                  display: "flex", alignItems: "center", justifyContent: "center",
                  fontSize: "1.6rem", marginBottom: "1rem",
                  border: `1px solid ${selectedCase ? "rgba(67,56,202,0.2)" : cfg.border || "rgba(37,99,235,0.18)"}`,
                }}>{selectedCase ? "🗂️" : cfg.icon}</div>
                <div style={{ fontWeight: 600, marginBottom: "0.25rem", color: "var(--text)" }}>
                  {selectedCase ? selectedCase.title : cfg.label}
                </div>
                <div style={{ fontSize: "0.82rem", textAlign: "center", maxWidth: 280, lineHeight: 1.55 }}>
                  {selectedCase
                    ? `Searching case documents + all legal sources for: ${selectedCase.title}`
                    : cfg.desc}
                </div>
                {selectedCase && (
                  <div style={{ marginTop: "1rem", display: "flex", flexWrap: "wrap", gap: "0.3rem", justifyContent: "center", maxWidth: 340 }}>
                    {["fetch_case_info", "search_case_docs", "search_bns", "search_bnss", "search_bsa", "search_constitution", "search_it_act", "search_all_laws"].map((t) => (
                      <span key={t} style={{
                        fontSize: "0.63rem", padding: "0.15rem 0.45rem", borderRadius: "1rem",
                        background: "rgba(67,56,202,0.08)", border: "1px solid rgba(67,56,202,0.15)",
                        color: "#818cf8", fontFamily: "monospace",
                      }}>{t}</span>
                    ))}
                  </div>
                )}
                <div style={{ marginTop: "1.25rem", fontSize: "0.78rem", color: "var(--muted-light)" }}>
                  Type your first question below {selectedCase ? "or use the + button to change case" : "or click + to scope to a case"}
                </div>
              </div>
            ) : (
              <>
                {messages.map((m, i) => <MessageBubble key={i} msg={m} gradient={activeGradient} />)}
                {aiStatus && !streamingText && <AIStatusChip status={aiStatus} gradient={activeGradient} />}
                {streamingText && (
                  <div className="msg-enter" style={{ display: "flex", justifyContent: "flex-start", marginBottom: "0.65rem" }}>
                    <div style={{ width: 28, height: 28, borderRadius: "50%", background: activeGradient, display: "flex", alignItems: "center", justifyContent: "center", fontSize: "0.75rem", flexShrink: 0, marginRight: "0.5rem", marginTop: "0.15rem", color: "#fff" }}>⚖</div>
                    <div style={{ maxWidth: "76%", background: "var(--bg-elevated)", borderRadius: "1rem 1rem 1rem 0.2rem", padding: "0.65rem 0.9rem", fontSize: "0.875rem", lineHeight: 1.65, border: "1px solid var(--border)" }}>
                      <MarkdownContent content={streamingText} isUser={false} />
                      <span style={{ display: "inline-block", width: 2, height: "1em", background: "var(--accent)", marginLeft: 2, animation: "cursor-blink 0.8s step-end infinite", verticalAlign: "text-bottom" }} />
                    </div>
                  </div>
                )}
              </>
            )}
            <div ref={msgsEndRef} />
          </div>

          {/* ── Input row ─────────────────────────────────────── */}
          <div style={{ marginTop: "auto", paddingTop: "0.65rem", borderTop: "1px solid var(--border)" }}>
            {/* Case chip (when selected) */}
            {selectedCase && (
              <div style={{ display: "flex", alignItems: "center", gap: "0.4rem", marginBottom: "0.45rem" }}>
                <div className="case-chip" style={{
                  display: "inline-flex", alignItems: "center", gap: "0.4rem",
                  background: "rgba(67,56,202,0.1)", border: "1px solid rgba(67,56,202,0.25)",
                  borderRadius: "1rem", padding: "0.2rem 0.5rem 0.2rem 0.35rem",
                  fontSize: "0.75rem", color: "#818cf8", fontWeight: 600, cursor: "default",
                }}>
                  <span style={{ fontSize: "0.8rem" }}>🗂️</span>
                  <span style={{ maxWidth: 180, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{selectedCase.title}</span>
                  <button
                    className="case-chip-close"
                    onClick={() => setSelectedCase(null)}
                    style={{
                      background: "none", border: "none", cursor: "pointer",
                      color: "#818cf8", fontSize: "0.7rem", lineHeight: 1,
                      padding: "0 0.1rem", display: "flex", alignItems: "center",
                    }}
                  >✕</button>
                </div>
                <span style={{ fontSize: "0.68rem", color: "var(--muted)", display: "flex", gap: "0.25rem", flexWrap: "wrap" }}>
                  {["8 tools active", "case docs + all laws"].map((t, i) => (
                    <span key={i} style={{ background: "var(--bg-elevated)", border: "1px solid var(--border)", borderRadius: "0.3rem", padding: "0.05rem 0.35rem" }}>{t}</span>
                  ))}
                </span>
              </div>
            )}

            <div style={{ display: "flex", gap: "0.4rem", alignItems: "flex-end" }}>
              {/* + Case picker button */}
              <div ref={pickerRef} style={{ position: "relative", flexShrink: 0 }}>
                <button
                  onClick={() => setShowCasePicker((v) => !v)}
                  disabled={loading}
                  title={selectedCase ? "Change case" : "Scope to a case"}
                  style={{
                    width: 36, height: 36, borderRadius: "0.55rem",
                    background: selectedCase ? "rgba(67,56,202,0.12)" : "var(--bg-elevated)",
                    border: `1px solid ${selectedCase ? "rgba(67,56,202,0.3)" : "var(--border)"}`,
                    color: selectedCase ? "#818cf8" : "var(--muted)",
                    cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center",
                    fontSize: "1.05rem", transition: "all 0.15s",
                    flexShrink: 0,
                  }}
                >
                  {selectedCase ? "🗂️" : "+"}
                </button>
                {showCasePicker && (
                  <CasePicker
                    onSelect={handleCaseSelect}
                    onClose={() => setShowCasePicker(false)}
                  />
                )}
              </div>

              <textarea
                ref={inputRef}
                className="input"
                style={{ marginBottom: 0, flex: 1, resize: "none", minHeight: "2.5rem", maxHeight: "6rem", lineHeight: 1.5, fontSize: "0.875rem" }}
                rows={1}
                placeholder={placeholder}
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                onKeyDown={handleKeyDown}
                disabled={chatDisabled}
              />
              <button
                type="button"
                className="btn btn-primary"
                disabled={chatDisabled || !query.trim()}
                onClick={send}
                style={{ alignSelf: "flex-end", height: "2.5rem", minWidth: 90, background: activeGradient }}
              >
                {loading ? <span className="spinner" /> : "Send"}
              </button>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
