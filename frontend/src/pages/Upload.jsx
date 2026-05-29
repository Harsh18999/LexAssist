import { useState, useRef, useCallback } from "react";
import { api, formatBytes, formatTime } from "../api/client";
import { uploadWithProgress } from "../api/client";

const S = { IDLE: "idle", UPLOADING: "uploading", SUCCESS: "success", ERROR: "error" };

const STATUS_LABEL = {
  [S.IDLE]:     "Queued",
  [S.UPLOADING]:"Uploading…",
  [S.SUCCESS]:  "Stored ✓",
  [S.ERROR]:    "Failed",
};

export default function Upload() {
  const [files, setFiles]     = useState([]);
  const [uploads, setUploads] = useState([]);
  const [dragging, setDragging] = useState(false);
  const [globalLock, setGlobalLock] = useState(false); // prevent concurrent batch
  const inputRef = useRef(null);

  const onDragOver  = useCallback((e) => { e.preventDefault(); setDragging(true); }, []);
  const onDragLeave = useCallback(() => setDragging(false), []);
  const onDrop      = useCallback((e) => {
    e.preventDefault(); setDragging(false);
    const dropped = Array.from(e.dataTransfer.files).filter((f) => f.name.toLowerCase().endsWith(".pdf"));
    if (dropped.length) addFiles(dropped);
  }, []);

  function addFiles(newFiles) {
    const items = newFiles.map((f) => ({
      id: Math.random().toString(36).slice(2),
      file: f,
      state: S.IDLE,
      progress: 0,
      sseStatus: "",   // real-time SSE status text
      error: null,
      result: null,
    }));
    setFiles((prev) => [...prev, ...items]);
  }

  function onFileInput(e) {
    const sel = Array.from(e.target.files).filter((f) => f.name.toLowerCase().endsWith(".pdf"));
    if (sel.length) addFiles(sel);
    e.target.value = "";
  }

  function removeFile(id) {
    setFiles((prev) => prev.filter((f) => f.id !== id));
  }

  function updateFile(id, patch) {
    setFiles((prev) => prev.map((f) => (f.id === id ? { ...f, ...patch } : f)));
  }

  async function uploadOne(item) {
    // SSE-style status messages via progress milestones
    updateFile(item.id, { state: S.UPLOADING, progress: 0, error: null, sseStatus: "Connecting…" });

    // Simulated SSE status stages via progress thresholds
    const sseStages = [
      { at: 5,  msg: "Reading file…" },
      { at: 20, msg: "Uploading to S3…" },
      { at: 60, msg: "Transferring chunks…" },
      { at: 90, msg: "Finalising…" },
      { at: 99, msg: "Almost done…" },
    ];
    let lastStage = -1;

    try {
      const result = await api.upload(item.file, (pct) => {
        // Update progress
        updateFile(item.id, { progress: pct });

        // Fire SSE-style status at milestones
        for (let i = lastStage + 1; i < sseStages.length; i++) {
          if (pct >= sseStages[i].at) {
            lastStage = i;
            updateFile(item.id, { sseStatus: sseStages[i].msg });
          }
        }
      });

      updateFile(item.id, { state: S.SUCCESS, progress: 100, sseStatus: "Stored in S3 ✓", result });
      setUploads((prev) => [{ ...result, uploadedAt: new Date().toISOString() }, ...prev]);
    } catch (err) {
      updateFile(item.id, { state: S.ERROR, sseStatus: "", error: err.message });
    }
  }

  async function uploadAll() {
    if (globalLock) return; // prevent double-click
    setGlobalLock(true);
    const pending = files.filter((f) => f.state === S.IDLE || f.state === S.ERROR);
    for (const item of pending) {
      await uploadOne(item);
    }
    setGlobalLock(false);
  }

  function clearDone() {
    setFiles((prev) => prev.filter((f) => f.state !== S.SUCCESS));
  }

  const hasPending   = files.some((f) => f.state === S.IDLE || f.state === S.ERROR);
  const hasUploading = files.some((f) => f.state === S.UPLOADING);
  const pendingCount = files.filter((f) => f.state === S.IDLE || f.state === S.ERROR).length;

  return (
    <>
      {/* Global upload lock overlay */}
      {globalLock && (
        <div className="page-loader">
          <span className="spinner" />
          Uploading {pendingCount + files.filter((f) => f.state === S.SUCCESS).length} file(s)…
        </div>
      )}

      <header className="page-head">
        <h2>Upload Documents</h2>
        <p>Upload PDF files — stored securely in S3 <code style={{ fontSize: "0.78rem", opacity: 0.7 }}>Documents/</code></p>
      </header>

      {/* Drop zone */}
      <div
        className={`upload-dropzone${dragging ? " dragging" : ""}`}
        onDragOver={onDragOver}
        onDragLeave={onDragLeave}
        onDrop={onDrop}
        onClick={() => inputRef.current?.click()}
      >
        <input ref={inputRef} type="file" accept=".pdf" multiple style={{ display: "none" }} onChange={onFileInput} />
        <div className="upload-dropzone-icon">📄</div>
        <p className="upload-dropzone-label">
          {dragging ? "Drop PDFs here" : "Click or drag & drop PDFs"}
        </p>
        <p className="meta">Only .pdf files · Multiple files supported</p>
      </div>

      {/* File queue */}
      {files.length > 0 && (
        <div className="glass" style={{ marginTop: "1rem" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "0.75rem" }}>
            <span style={{ fontWeight: 600, fontSize: "0.9rem" }}>
              {files.length} file{files.length > 1 ? "s" : ""} queued
            </span>
            <div style={{ display: "flex", gap: "0.5rem" }}>
              {files.some((f) => f.state === S.SUCCESS) && (
                <button className="btn btn-ghost btn-sm" onClick={clearDone} disabled={globalLock}>
                  Clear done
                </button>
              )}
              <button
                className="btn btn-primary btn-sm"
                disabled={!hasPending || globalLock}
                onClick={uploadAll}
              >
                {globalLock
                  ? <><span className="spinner" /> Uploading…</>
                  : `Upload ${pendingCount} file${pendingCount !== 1 ? "s" : ""}`
                }
              </button>
            </div>
          </div>

          <div className="upload-list">
            {files.map((item) => (
              <FileRow key={item.id} item={item} globalLock={globalLock} onRemove={() => removeFile(item.id)} onRetry={() => uploadOne(item)} />
            ))}
          </div>
        </div>
      )}

      {/* Session upload history */}
      {uploads.length > 0 && (
        <div className="glass">
          <h4 style={{ marginBottom: "0.75rem", fontSize: "0.9rem", color: "var(--muted)" }}>
            ✓ Uploaded this session
          </h4>
          {uploads.map((doc, i) => (
            <div key={i} className="list-row">
              <div style={{ display: "flex", alignItems: "center", gap: "0.6rem" }}>
                <span style={{ fontSize: "1.1rem" }}>📄</span>
                <div>
                  <div style={{ fontSize: "0.88rem", fontWeight: 500 }}>{doc.filename}</div>
                  <div className="meta">{formatBytes(doc.size_bytes)} · {formatTime(doc.uploadedAt)}</div>
                </div>
              </div>
              <span className="badge badge-green">Stored</span>
            </div>
          ))}
        </div>
      )}
    </>
  );
}

function FileRow({ item, globalLock, onRemove, onRetry }) {
  const { file, state, progress, sseStatus, error } = item;

  return (
    <div className="upload-file-row">
      {/* State icon */}
      <span className="upload-file-icon">
        {state === S.IDLE      && "⏳"}
        {state === S.UPLOADING && <span className="spinner" style={{ width: 18, height: 18, borderWidth: 2 }} />}
        {state === S.SUCCESS   && "✅"}
        {state === S.ERROR     && "❌"}
      </span>

      <div className="upload-file-info">
        <div className="upload-file-name">{file.name}</div>
        <div className="upload-file-meta">{formatBytes(file.size)}</div>

        {/* SSE real-time status text */}
        {sseStatus && state === S.UPLOADING && (
          <div style={{ marginTop: "0.2rem" }}>
            <span className={`status-badge uploading`}>
              <span className="spinner" style={{ width: 8, height: 8, borderWidth: 1.5 }} />
              {sseStatus}
            </span>
          </div>
        )}
        {state === S.SUCCESS && sseStatus && (
          <span className="status-badge success">{sseStatus}</span>
        )}

        {/* Progress bar */}
        {state === S.UPLOADING && (
          <div className="upload-progress-bar-wrap" style={{ marginTop: "0.4rem" }}>
            <div className="upload-progress-bar" style={{ width: `${progress}%` }} />
            <span className="upload-progress-pct">{progress}%</span>
          </div>
        )}

        {state === S.ERROR && (
          <div className="upload-error">{error}</div>
        )}
      </div>

      <div className="upload-file-actions">
        {/* Status badge */}
        <span className={`status-badge ${state}`}>{STATUS_LABEL[state]}</span>

        {state === S.ERROR && (
          <button className="btn btn-primary btn-sm" onClick={onRetry} disabled={globalLock}>
            Retry
          </button>
        )}
        {state !== S.UPLOADING && (
          <button className="btn btn-ghost btn-sm" onClick={onRemove} disabled={globalLock}>✕</button>
        )}
      </div>
    </div>
  );
}
