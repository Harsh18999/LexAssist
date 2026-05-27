import { useEffect, useState } from "react";
import { api, formatTime } from "../api/client";

export default function Knowledge() {
  const [search, setSearch] = useState("");
  const [data, setData] = useState(null);

  useEffect(() => {
    api.knowledge(search).then(setData);
  }, [search]);

  const docs = data?.documents || [];

  return (
    <>
      <header className="page-head">
        <h2>Knowledge Base</h2>
        <p>Global legal corpus and judgments</p>
      </header>
      <input className="input" placeholder="Search documents…" value={search} onChange={(e) => setSearch(e.target.value)} />
      <div className="glass">
        <span className="badge">Index: {data?.index_status || "—"}</span>
        <span className="meta" style={{ marginLeft: "0.75rem" }}>{docs.length} documents</span>
        {docs.map((d, i) => (
          <div key={i} className="list-row">
            <strong>{d.filename}</strong>
            <span className="meta">{d.size_label || ""} {d.upload_date ? formatTime(d.upload_date) : ""}</span>
          </div>
        ))}
        {!docs.length && <p className="empty">Upload documents to build your corpus</p>}
      </div>
    </>
  );
}
