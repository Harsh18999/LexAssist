import { useEffect, useState } from "react";
import { api } from "../api/client";

const SUGGESTIONS = [
  "Explain this judgment simply",
  "What precedent was cited?",
  "What was the final ruling?",
  "Explain Article 21 implication",
];

export default function CaseChatPanel({ caseId }) {
  const [messages, setMessages] = useState([]);
  const [query, setQuery] = useState("");
  const [loading, setLoading] = useState(false);
  const [citations, setCitations] = useState([]);

  useEffect(() => {
    api.chatHistory(caseId).then((d) => setMessages(d.messages || []));
  }, [caseId]);

  async function send(text) {
    const q = (text || query).trim();
    if (!q || loading) return;
    setLoading(true);
    setQuery("");
    try {
      const res = await api.chat(q, caseId);
      setCitations(res.citations || []);
      const h = await api.chatHistory(caseId);
      setMessages(h.messages || []);
    } catch (e) {
      alert(e.message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="glass chat-panel">
      <h3 style={{ marginBottom: "0.75rem", fontSize: "1rem" }}>Case AI Co-pilot</h3>
      <p className="meta" style={{ marginBottom: "0.75rem" }}>Research within this case context only</p>
      <div style={{ display: "flex", flexWrap: "wrap", gap: "0.35rem", marginBottom: "0.75rem" }}>
        {SUGGESTIONS.map((s) => (
          <button key={s} type="button" className="btn btn-ghost btn-sm" onClick={() => send(s)}>
            {s}
          </button>
        ))}
      </div>
      <div className="chat-msgs">
        {messages.length === 0 && <p className="meta">Ask about this case…</p>}
        {messages.map((m, i) => (
          <div key={i} className={`chat-msg ${m.role === "user" ? "user" : "ai"}`}>
            {m.content}
          </div>
        ))}
      </div>
      <div style={{ display: "flex", gap: "0.5rem" }}>
        <input
          className="input"
          style={{ marginBottom: 0 }}
          placeholder="Legal research question…"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && send()}
        />
        <button type="button" className="btn btn-primary" disabled={loading} onClick={() => send()}>
          {loading ? <span className="spinner" /> : "Ask"}
        </button>
      </div>
      {citations.length > 0 && (
        <div style={{ marginTop: "0.75rem" }}>
          <div className="label">Citations</div>
          {citations.map((c, i) => (
            <div key={i} className="cite">
              <strong>{c.file_name}</strong>
              <p>{c.snippet}</p>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
