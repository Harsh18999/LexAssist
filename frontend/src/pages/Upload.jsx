import { useState } from "react";
import { api } from "../api/client";

export default function Upload() {
  const [file, setFile] = useState(null);
  const [msg, setMsg] = useState("");
  const [indexing, setIndexing] = useState(false);

  async function upload(e) {
    e.preventDefault();
    if (!file) return;
    const res = await api.upload(file);
    setMsg(`Uploaded ${res.filename}`);
    setFile(null);
  }

  async function rebuild() {
    setIndexing(true);
    try {
      await api.rebuildIndex();
      setMsg("Index rebuilt successfully");
    } catch (e) {
      alert(e.message);
    } finally {
      setIndexing(false);
    }
  }

  return (
    <>
      <header className="page-head">
        <h2>Upload Documents</h2>
        <p>Add to your global legal knowledge base</p>
      </header>
      <form className="glass" onSubmit={upload}>
        <input type="file" accept=".pdf" onChange={(e) => setFile(e.target.files?.[0])} />
        <button type="submit" className="btn btn-primary" disabled={!file}>Upload PDF</button>
      </form>
      <div className="glass">
        <p className="meta" style={{ marginBottom: "0.75rem" }}>Rebuild vector index after bulk uploads</p>
        <button type="button" className="btn btn-ghost" disabled={indexing} onClick={rebuild}>{indexing ? "Rebuilding…" : "Rebuild Index"}</button>
        {msg && <p style={{ marginTop: "0.75rem", color: "var(--success)" }}>{msg}</p>}
      </div>
    </>
  );
}
