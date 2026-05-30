/**
 * DocumentAI.jsx — Chat with a single document.
 * ─────────────────────────────────────────────
 * • Session-only (no persistence) — messages live in React state only
 * • Real-time status chips + streaming tokens (identical pattern to Research)
 * • Document info pulled from /documents/{docId} before chatting
 */
import { useEffect, useState, useRef, useCallback } from "react";
import { useParams, Link } from "react-router-dom";
import { api, formatBytes, formatTime } from "../api/client";
import { Skeleton } from "../components/ui";

/* ── Markdown renderer ─────────────────────────────────────── */
function renderMarkdown(text) {
  if (!text) return "";
  let s = text.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
  s = s.replace(/```[\s\S]*?```/g, (m) => {
    const inner = m.slice(3, -3).replace(/^[a-z]*\n/, "");
    return `<pre style="background:rgba(0,0,0,0.22);border-radius:0.5rem;padding:0.75rem 1rem;overflow-x:auto;font-size:0.79rem;margin:0.5rem 0;border:1px solid rgba(255,255,255,0.06)"><code>${inner}</code></pre>`;
  });
  s = s.replace(/`([^`]+)`/g, '<code style="background:rgba(0,0,0,0.18);border-radius:0.2rem;padding:0.05em 0.35em;font-size:0.85em">$1</code>');
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

/* ── Status chip ──────────────────────────────────────────── */
function AIStatusChip({ status }) {
  const icons = {
    "Searching document…": "🔍",
    "Writing response…": "✍️",
  };
  return (
    <div className="dai-msg-enter" style={{ display: "flex", justifyContent: "flex-start", marginBottom: "0.5rem" }}>
      <div style={{
        width: 28, height: 28, borderRadius: "50%",
        background: "linear-gradient(135deg,#134e4a,#0f766e)",
        display: "flex", alignItems: "center", justifyContent: "center",
        fontSize: "0.75rem", flexShrink: 0, marginRight: "0.5rem", marginTop: "0.1rem", color: "#fff",
      }}>📄</div>
      <div style={{
        display: "flex", alignItems: "center", gap: "0.5rem",
        padding: "0.45rem 0.85rem",
        background: "var(--bg-elevated)",
        borderRadius: "1rem 1rem 1rem 0.2rem",
        border: "1px solid var(--border)",
        fontSize: "0.8rem", color: "var(--muted)",
        animation: "dai-pulse 1.8s ease-in-out infinite",
      }}>
        <span>{icons[status] || "🔄"}</span>
        <span>{status}</span>
        <span style={{ display: "flex", gap: "0.25rem", marginLeft: "0.2rem" }}>
          {[0, 0.2, 0.4].map((d, i) => (
            <span key={i} style={{
              width: 4, height: 4, borderRadius: "50%",
              background: "var(--accent)", display: "inline-block",
              animation: `dai-dot 1.2s infinite ${d}s`,
            }} />
          ))}
        </span>
      </div>
    </div>
  );
}

/* ── Message bubble ──────────────────────────────────────── */
function MessageBubble({ msg }) {
  const isUser = msg.role === "user";
  return (
    <div className="dai-msg-enter" style={{ display: "flex", justifyContent: isUser ? "flex-end" : "flex-start", marginBottom: "0.65rem" }}>
      {!isUser && (
        <div style={{
          width: 28, height: 28, borderRadius: "50%",
          background: "linear-gradient(135deg,#134e4a,#0f766e)",
          display: "flex", alignItems: "center", justifyContent: "center",
          fontSize: "0.75rem", flexShrink: 0, marginRight: "0.5rem", marginTop: "0.15rem", color: "#fff",
        }}>📄</div>
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
            <summary style={{ cursor: "pointer", fontWeight: 600, color: isUser ? "rgba(255,255,255,0.8)" : "var(--muted)" }}>
              📎 {msg.citations.length} source passage{msg.citations.length > 1 ? "s" : ""}
            </summary>
            {msg.citations.map((c, i) => (
              <div key={i} style={{ marginTop: "0.3rem", padding: "0.4rem 0.6rem", background: "rgba(0,0,0,0.15)", borderRadius: "0.4rem", lineHeight: 1.5 }}>
                <div style={{ fontWeight: 600, marginBottom: "0.15rem" }}>📄 {c.file_name}</div>
                <div style={{ fontStyle: "italic", opacity: 0.8 }}>"{c.snippet}…"</div>
              </div>
            ))}
          </details>
        )}
        {msg.response_time_sec && (
          <div style={{ marginTop: "0.25rem", fontSize: "0.65rem", opacity: 0.5 }}>
            {msg.response_time_sec}s
          </div>
        )}
      </div>
    </div>
  );
}

/* ── Suggestion chips ────────────────────────────────────── */
const SUGGESTIONS = [
  "Summarise this document",
  "What are the key claims?",
  "List the parties involved",
  "What are the legal issues?",
  "Identify key dates & deadlines",
  "What evidence is mentioned?",
];

/* ── Main component ──────────────────────────────────────── */
export default function DocumentAI() {
  const { id: docId } = useParams();
  const [doc, setDoc] = useState(null);
  const [docLoading, setDocLoading] = useState(true);
  const [docError, setDocError] = useState(null);

  const [messages, setMessages] = useState([]);
  const [streamingText, setStreamingText] = useState("");
  const [aiStatus, setAiStatus] = useState("");
  const [query, setQuery] = useState("");
  const [loading, setLoading] = useState(false);

  const ctrlRef = useRef(null);
  const msgsEndRef = useRef(null);
  const inputRef = useRef(null);

  // Load document metadata via single-fetch endpoint
  useEffect(() => {
    api.getDocument(docId)
      .then((d) => setDoc(d))
      .catch((e) => setDocError(e.message || "Document not found."))
      .finally(() => setDocLoading(false));
  }, [docId]);

  useEffect(() => {
    msgsEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, streamingText, aiStatus]);

  const send = useCallback((q) => {
    const text = (q || query).trim();
    if (!text || loading) return;

    setLoading(true);
    setQuery("");
    setStreamingText("");
    setAiStatus("");
    setMessages((prev) => [...prev, { role: "user", content: text }]);

    let accumulated = "";
    let gotDone = false;

    ctrlRef.current?.abort();
    ctrlRef.current = api.documentChat(
      docId, text, messages,
      // onChunk
      (token) => {
        accumulated += token;
        setStreamingText(accumulated);
        setAiStatus("");
      },
      // onDone
      (evt) => {
        gotDone = true;
        const finalContent = accumulated || evt.final_answer || "";
        if (finalContent) {
          setMessages((prev) => [...prev, {
            role: "assistant",
            content: finalContent,
            citations: evt.citations || [],
            response_time_sec: evt.response_time_sec,
          }]);
        }
        setStreamingText("");
        setAiStatus("");
        setLoading(false);
        setTimeout(() => inputRef.current?.focus(), 80);
      },
      // onError
      (err) => {
        if (accumulated && !gotDone) {
          setMessages((prev) => [...prev, { role: "assistant", content: accumulated }]);
        } else {
          setMessages((prev) => [...prev, { role: "assistant", content: `⚠ ${err.message || "Error"}` }]);
        }
        setStreamingText("");
        setAiStatus("");
        setLoading(false);
      },
      // onStatus
      (status) => { setAiStatus(status); },
    );
  }, [query, loading, docId]);

  function handleKeyDown(e) {
    if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); send(); }
  }

  function clearSession() {
    if (loading) { ctrlRef.current?.abort(); setLoading(false); }
    setMessages([]);
    setStreamingText("");
    setAiStatus("");
    setTimeout(() => inputRef.current?.focus(), 80);
  }

  const isReady = doc && doc.status === "completed";
  const isProcessing = doc && (doc.status === "processing" || doc.status === "pending");

  return (
    <>
      <style>{`
        @keyframes dai-dot { 0%,80%,100% { transform:scale(0.7);opacity:0.4; } 40% { transform:scale(1);opacity:1; } }
        @keyframes dai-pulse { 0%,100% { opacity:0.82; } 50% { opacity:1; } }
        @keyframes dai-msg { from { opacity:0;transform:translateY(4px); } to { opacity:1;transform:none; } }
        @keyframes dai-cursor { 50% { opacity:0; } }
        @keyframes shimmer { 0% { background-position:200% 0; } 100% { background-position:-200% 0; } }
        .dai-msg-enter { animation:dai-msg 0.2s ease; }
        .dai-suggestion:hover { background:rgba(15,118,110,0.12) !important; border-color:rgba(15,118,110,0.35) !important; color:var(--text) !important; }
      `}</style>

      {/* ── Header ─────────────────────────────────────────── */}
      <header className="page-head" style={{ marginBottom: "0.75rem" }}>
        <Link to="/documents" className="meta" style={{ display: "inline-flex", alignItems: "center", gap: "0.3rem", marginBottom: "0.4rem" }}>
          ← Documents
        </Link>

        {docLoading ? (
          <div style={{ display: "flex", alignItems: "center", gap: "0.6rem" }}>
            <Skeleton width={36} height={36} radius={8} />
            <div>
              <Skeleton width={200} height="1.1rem" style={{ marginBottom: "0.35rem" }} />
              <Skeleton width={130} height="0.75rem" />
            </div>
          </div>
        ) : docError ? (
          <div style={{ color: "var(--danger)" }}>⚠ {docError}</div>
        ) : doc ? (
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: "0.5rem" }}>
            <div style={{ display: "flex", alignItems: "center", gap: "0.65rem" }}>
              <div style={{
                width: 40, height: 40, borderRadius: "0.6rem",
                background: "linear-gradient(135deg,rgba(239,68,68,0.12),rgba(239,68,68,0.06))",
                border: "1px solid rgba(239,68,68,0.2)",
                display: "flex", alignItems: "center", justifyContent: "center",
                fontSize: "1.2rem", flexShrink: 0,
              }}>📄</div>
              <div>
                <h2 style={{ marginBottom: "0.05rem", fontSize: "1rem" }}>{doc.filename}</h2>
                <p style={{ margin: 0, fontSize: "0.75rem", color: "var(--muted)", display: "flex", gap: "0.4rem", alignItems: "center", flexWrap: "wrap" }}>
                  <span>{formatBytes(doc.size_bytes)}</span>
                  <span>·</span>
                  <span>{formatTime(doc.created_at)}</span>
                  <span>·</span>
                  {doc.status === "completed" && <span style={{ color: "#16a34a", fontWeight: 700 }}>✓ Indexed</span>}
                  {isProcessing && <span style={{ color: "var(--accent)", fontWeight: 700 }}>⚡ Indexing…</span>}
                  {doc.status === "error" && <span style={{ color: "#dc2626", fontWeight: 700 }}>⚠ Index Error</span>}
                </p>
              </div>
            </div>
            <div style={{ display: "flex", gap: "0.4rem" }}>
              {messages.length > 0 && (
                <button
                  className="btn btn-ghost btn-sm"
                  onClick={clearSession}
                  style={{ fontSize: "0.78rem" }}
                >
                  🗑 Clear chat
                </button>
              )}
              <button
                className="btn btn-ghost btn-sm"
                onClick={async () => {
                  try { const r = await api.downloadDocument(docId); window.open(r.url, "_blank"); }
                  catch (e) { alert(e.message); }
                }}
                style={{ fontSize: "0.78rem" }}
              >
                👁 View PDF
              </button>
            </div>
          </div>
        ) : null}
      </header>

      {/* ── Chat window ────────────────────────────────────── */}
      <div className="glass" style={{
        display: "flex", flexDirection: "column",
        height: "calc(100vh - 200px)", minHeight: 400,
        padding: "0.85rem 1rem", marginBottom: 0,
      }}>
        {/* Not indexed warning */}
        {doc && !isReady && !isProcessing && (
          <div style={{
            background: "rgba(239,68,68,0.08)", border: "1px solid rgba(239,68,68,0.2)",
            borderRadius: "0.6rem", padding: "0.65rem 0.9rem", marginBottom: "0.65rem",
            fontSize: "0.82rem", color: "#dc2626", display: "flex", alignItems: "center", gap: "0.5rem",
          }}>
            <span>⚠</span>
            <span>This document has not been indexed yet — AI answers may not be available. Upload it via a Case to index it.</span>
          </div>
        )}
        {isProcessing && (
          <div style={{
            background: "rgba(37,99,235,0.07)", border: "1px solid rgba(37,99,235,0.18)",
            borderRadius: "0.6rem", padding: "0.65rem 0.9rem", marginBottom: "0.65rem",
            fontSize: "0.82rem", color: "var(--accent)", display: "flex", alignItems: "center", gap: "0.5rem",
          }}>
            <span className="spinner" style={{ width: 13, height: 13, borderWidth: 2 }} />
            <span>Document is still being indexed. You can start chatting — answers will improve once indexing completes.</span>
          </div>
        )}

        {/* Messages */}
        <div style={{ flex: 1, overflowY: "auto", paddingRight: "0.2rem" }}>
          {messages.length === 0 && !streamingText && !aiStatus ? (
            <div style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", height: "100%", color: "var(--muted)" }}>
              <div style={{
                width: 60, height: 60, borderRadius: "1rem",
                background: "linear-gradient(135deg,rgba(15,118,110,0.1),rgba(15,118,110,0.05))",
                border: "1px solid rgba(15,118,110,0.2)",
                display: "flex", alignItems: "center", justifyContent: "center",
                fontSize: "1.6rem", marginBottom: "1rem",
              }}>📄</div>
              <div style={{ fontWeight: 700, marginBottom: "0.25rem", color: "var(--text)", fontSize: "0.95rem" }}>
                {docLoading ? "Loading…" : doc?.filename || "Document AI"}
              </div>
              <div style={{ fontSize: "0.8rem", textAlign: "center", maxWidth: 300, lineHeight: 1.6, marginBottom: "1.5rem" }}>
                Ask anything about this document. Answers are sourced strictly from its contents.
              </div>
              {/* Suggestion chips */}
              <div style={{ display: "flex", flexWrap: "wrap", gap: "0.4rem", justifyContent: "center", maxWidth: 480 }}>
                {SUGGESTIONS.map((s) => (
                  <button
                    key={s}
                    className="dai-suggestion"
                    onClick={() => send(s)}
                    disabled={loading || !isReady && !isProcessing}
                    style={{
                      background: "var(--bg-elevated)", border: "1px solid var(--border)",
                      borderRadius: "1.5rem", padding: "0.35rem 0.75rem",
                      fontSize: "0.78rem", color: "var(--muted)", cursor: "pointer",
                      transition: "all 0.15s",
                    }}
                  >
                    {s}
                  </button>
                ))}
              </div>
            </div>
          ) : (
            <>
              {messages.map((m, i) => <MessageBubble key={i} msg={m} />)}
              {aiStatus && !streamingText && <AIStatusChip status={aiStatus} />}
              {streamingText && (
                <div className="dai-msg-enter" style={{ display: "flex", justifyContent: "flex-start", marginBottom: "0.65rem" }}>
                  <div style={{
                    width: 28, height: 28, borderRadius: "50%",
                    background: "linear-gradient(135deg,#134e4a,#0f766e)",
                    display: "flex", alignItems: "center", justifyContent: "center",
                    fontSize: "0.75rem", flexShrink: 0, marginRight: "0.5rem", marginTop: "0.15rem", color: "#fff",
                  }}>📄</div>
                  <div style={{
                    maxWidth: "76%", background: "var(--bg-elevated)",
                    borderRadius: "1rem 1rem 1rem 0.2rem",
                    padding: "0.65rem 0.9rem", fontSize: "0.875rem", lineHeight: 1.65,
                    border: "1px solid var(--border)",
                  }}>
                    <MarkdownContent content={streamingText} isUser={false} />
                    <span style={{ display: "inline-block", width: 2, height: "1em", background: "#0f766e", marginLeft: 2, animation: "dai-cursor 0.8s step-end infinite", verticalAlign: "text-bottom" }} />
                  </div>
                </div>
              )}
            </>
          )}
          <div ref={msgsEndRef} />
        </div>

        {/* Input */}
        <div style={{ marginTop: "auto", paddingTop: "0.65rem", borderTop: "1px solid var(--border)", display: "flex", gap: "0.4rem", alignItems: "flex-end" }}>
          <textarea
            ref={inputRef}
            className="input"
            style={{ marginBottom: 0, flex: 1, resize: "none", minHeight: "2.5rem", maxHeight: "6rem", lineHeight: 1.5, fontSize: "0.875rem" }}
            rows={1}
            placeholder={isReady || isProcessing ? "Ask anything about this document…" : "Document must be indexed before chatting…"}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={handleKeyDown}
            disabled={loading || docLoading}
          />
          <button
            type="button"
            className="btn btn-primary"
            disabled={loading || !query.trim() || docLoading}
            onClick={() => send()}
            style={{
              alignSelf: "flex-end", height: "2.5rem", minWidth: 90,
              background: "linear-gradient(135deg,#134e4a,#0f766e)",
            }}
          >
            {loading ? <span className="spinner" /> : "Send"}
          </button>
        </div>
      </div>
    </>
  );
}
