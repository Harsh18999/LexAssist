import { useEffect, useState } from "react";
import { api, formatTime } from "../api/client";

// const QUICK = [
//   "Explain Article 21 precedents",
//   "Summarize BNSS changes",
//   "Find arrest safeguards in Indian law",
//   "Explain the proportionality test",
// ];

export default function Chat() {
  const [messages, setMessages] = useState([]);
  const [query, setQuery] = useState("");
  const [loading, setLoading] = useState(false);
  const [lastCitations, setLastCitations] = useState([]);
  const [lastTime, setLastTime] = useState(null);

  useEffect(() => {
    api.chatHistory().then((d) => {
      const msgs = d.messages || [];
      setMessages(msgs);
      const last = [...msgs]
        .reverse()
        .find((m) => m.role === "assistant" && m.citations?.length);
      if (last) setLastCitations(last.citations);
    });
  }, []);

  async function send(text) {
    const q = (text || query).trim();
    if (!q || loading) return;
    setLoading(true);
    setQuery("");
    try {
      const res = await api.chat(q);
      setLastCitations(res.citations || []);
      setLastTime(res.response_time_sec);
      const hist = await api.chatHistory();
      setMessages(hist.messages || []);
    } catch (e) {
      alert(e.message);
    } finally {
      setLoading(false);
    }
  }

  async function clearHistory() {
    await api.clearChat();
    setMessages([]);
    setLastCitations([]);
  }

  return (
    <>
      <header className="page-header">
        <h2>AI Legal Chat</h2>
        <p>Research Indian judgments and statutes with cited sources</p>
      </header>

      <div className="suggestions">
        {QUICK.map((q) => (
          <button key={q} type="button" className="chip" onClick={() => send(q)}>
            {q}
          </button>
        ))}
      </div>

      <div className="chat-layout">
        <div>
          <div className="chat-messages card">
            {messages.length === 0 && (
              <p className="empty">Ask your first legal research question.</p>
            )}
            {messages.map((m, i) => (
              <div
                key={i}
                className={`msg ${m.role === "user" ? "msg-user" : "msg-assistant"}`}
              >
                <div className="role">{m.role === "user" ? "You" : "JurisAI"}</div>
                <div style={{ whiteSpace: "pre-wrap" }}>{m.content}</div>
                <div className="time">{formatTime(m.timestamp)}</div>
              </div>
            ))}
          </div>

          <div style={{ display: "flex", gap: "0.5rem" }}>
            <input
              className="input"
              style={{ marginBottom: 0, flex: 1 }}
              placeholder="Ask a legal research question…"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && send()}
            />
            <button
              type="button"
              className="btn btn-primary"
              disabled={loading}
              onClick={() => send()}
            >
              {loading ? <span className="spinner" /> : "Ask"}
            </button>
            <button type="button" className="btn btn-outline" onClick={clearHistory}>
              Clear
            </button>
          </div>

          {lastTime != null && (
            <p className="meta" style={{ marginTop: "0.5rem" }}>
              Response time: {lastTime}s
            </p>
          )}

          <p className="disclaimer">
            For legal research assistance only. Not legal advice.
          </p>
        </div>

        <aside className="card">
          <h3>Citations</h3>
          {(lastCitations.length ? lastCitations : []).map((c, i) => (
            <div key={i} className="citation-card">
              <strong>{c.file_name}</strong>
              <p>{c.snippet}</p>
            </div>
          ))}
          {!lastCitations.length && (
            <p className="empty">Sources appear after each answer.</p>
          )}
        </aside>
      </div>
    </>
  );
}
