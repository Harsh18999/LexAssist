import { useEffect, useState } from "react";
import { api, formatTime } from "../api/client";

export default function Research() {
  const [messages, setMessages] = useState([]);
  const [query, setQuery] = useState("");
  const [loading, setLoading] = useState(false);
  const [citations, setCitations] = useState([]);

  useEffect(() => {
    api.chatHistory().then((d) => setMessages(d.messages || []));
  }, []);

  async function send() {
    const q = query.trim();
    if (!q || loading) return;
    setLoading(true);
    setQuery("");
    try {
      const res = await api.chat(q);
      setCitations(res.citations || []);
      const h = await api.chatHistory();
      setMessages(h.messages || []);
    } catch (e) {
      alert(e.message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <>
      <header className="page-head">
        <h2>AI Legal Research</h2>
        <p>Global knowledge base · citation-aware RAG</p>
      </header>

      <div className="case-layout">
        <div className="glass">
          <div className="chat-msgs" style={{ maxHeight: 420 }}>
            {messages.map((m, i) => (
              <div key={i} className={`chat-msg ${m.role === "user" ? "user" : "ai"}`}>{m.content}</div>
            ))}
          </div>
          <div style={{ display: "flex", gap: "0.5rem" }}>
            <input className="input" style={{ marginBottom: 0 }} placeholder="Ask about Indian law, judgments, statutes…" value={query} onChange={(e) => setQuery(e.target.value)} onKeyDown={(e) => e.key === "Enter" && send()} />
            <button type="button" className="btn btn-primary" disabled={loading} onClick={send}>{loading ? <span className="spinner" /> : "Research"}</button>
          </div>
        </div>
        <div className="glass">
          <h3 style={{ fontSize: "1rem", marginBottom: "0.75rem" }}>Citations</h3>
          {citations.length ? citations.map((c, i) => (
            <div key={i} className="cite"><strong>{c.file_name}</strong><p>{c.snippet}</p></div>
          )) : <p className="meta">Sources appear after each response</p>}
        </div>
      </div>
    </>
  );
}
