import { useState, useRef, useCallback, useEffect } from "react";
import { Link } from "react-router-dom";
import { api, formatBytes } from "../api/client";

const S = { IDLE: "idle", UPLOADING: "uploading", PROCESSING: "processing", SUCCESS: "success", ERROR: "error" };

const PIPELINE_STEPS = [
  { key: "upload",    label: "Uploading to S3",         icon: "☁️" },
  { key: "parse",     label: "Parsing document (fitz)",  icon: "📖" },
  { key: "chunk",     label: "Chunking text (1000/200)", icon: "✂️" },
  { key: "embed",     label: "Generating embeddings",    icon: "🧠" },
  { key: "index",     label: "Indexing into vector DB",  icon: "📊" },
  { key: "done",      label: "Ready for AI queries",     icon: "✅" },
];

// Map backend status → pipeline step index
function statusToStep(status) {
  if (status === "pending")     return 0;
  if (status === "processing")  return 2; // parsing + chunking + embedding happening
  if (status === "completed")   return 5;
  if (status === "error")       return -1;
  return 0;
}

export default function Upload() {
  const [cases, setCases]           = useState([]);
  const [casesLoading, setCasesLoading] = useState(true);
  const [selectedCase, setSelectedCase] = useState(null);
  const [caseSearch, setCaseSearch] = useState("");
  const [files, setFiles]           = useState([]);
  const [dragging, setDragging]     = useState(false);
  const [globalLock, setGlobalLock] = useState(false);
  const inputRef = useRef(null);

  // Load cases on mount
  useEffect(() => {
    api.cases("", "", 1, 100)
      .then((r) => setCases(r.cases || []))
      .catch(() => setCases([]))
      .finally(() => setCasesLoading(false));
  }, []);

  const filteredCases = cases.filter((c) =>
    !caseSearch || c.title.toLowerCase().includes(caseSearch.toLowerCase()) ||
    (c.case_number || "").toLowerCase().includes(caseSearch.toLowerCase())
  );

  const onDragOver  = useCallback((e) => { e.preventDefault(); setDragging(true); }, []);
  const onDragLeave = useCallback(() => setDragging(false), []);
  const onDrop      = useCallback((e) => {
    e.preventDefault(); setDragging(false);
    if (!selectedCase) return;
    const dropped = Array.from(e.dataTransfer.files).filter((f) => f.name.toLowerCase().endsWith(".pdf"));
    if (dropped.length) addFiles(dropped);
  }, [selectedCase]);

  function addFiles(newFiles) {
    const items = newFiles.map((f) => ({
      id: Math.random().toString(36).slice(2),
      file: f,
      state: S.IDLE,
      progress: 0,
      pipelineStep: -1,  // -1 = not started
      docId: null,
      error: null,
      statusCtrl: null,
    }));
    setFiles((prev) => [...prev, ...items]);
  }

  function onFileInput(e) {
    const sel = Array.from(e.target.files).filter((f) => f.name.toLowerCase().endsWith(".pdf"));
    if (sel.length) addFiles(sel);
    e.target.value = "";
  }

  function removeFile(id) {
    setFiles((prev) => {
      const f = prev.find((f) => f.id === id);
      f?.statusCtrl?.abort();
      return prev.filter((f) => f.id !== id);
    });
  }

  function updateFile(id, patch) {
    setFiles((prev) => prev.map((f) => (f.id === id ? { ...f, ...patch } : f)));
  }

  async function uploadOne(item) {
    if (!selectedCase) return;
    updateFile(item.id, { state: S.UPLOADING, progress: 0, error: null, pipelineStep: 0 });

    let docId = null;
    try {
      const result = await api.uploadCaseDoc(selectedCase.id, item.file, (pct) => {
        updateFile(item.id, { progress: pct });
      });
      docId = result.id;
      updateFile(item.id, { state: S.PROCESSING, progress: 100, pipelineStep: 1, docId });
    } catch (err) {
      updateFile(item.id, { state: S.ERROR, error: err.message });
      return;
    }

    // Poll processing status via SSE
    const ctrl = api.documentStatus(
      docId,
      (evt) => {
        const step = statusToStep(evt.status);
        if (step >= 0) {
          // Animate through steps gradually
          updateFile(item.id, { pipelineStep: Math.max(step, 1) });
        }
      },
      (evt) => {
        if (!evt || evt.status === "completed") {
          updateFile(item.id, { state: S.SUCCESS, pipelineStep: 5 });
        } else {
          updateFile(item.id, { state: S.ERROR, error: evt?.error || "Processing failed", pipelineStep: -1 });
        }
      }
    );
    updateFile(item.id, { statusCtrl: ctrl });
  }

  async function uploadAll() {
    if (globalLock || !selectedCase) return;
    setGlobalLock(true);
    const pending = files.filter((f) => f.state === S.IDLE || f.state === S.ERROR);
    for (const item of pending) await uploadOne(item);
    setGlobalLock(false);
  }

  function clearDone() {
    setFiles((prev) => prev.filter((f) => f.state !== S.SUCCESS));
  }

  const hasPending   = files.some((f) => f.state === S.IDLE || f.state === S.ERROR);
  const hasActive    = files.some((f) => f.state === S.UPLOADING || f.state === S.PROCESSING);
  const pendingCount = files.filter((f) => f.state === S.IDLE || f.state === S.ERROR).length;

  return (
    <>
      <style>{`
        @keyframes shimmer { 0% { background-position: 200% 0; } 100% { background-position: -200% 0; } }
        @keyframes pipeline-pulse { 0%,100% { opacity:0.6; } 50% { opacity:1; } }
        .pipeline-step-active { animation: pipeline-pulse 1.4s ease-in-out infinite; }
        .case-card { cursor:pointer; border:2px solid transparent; border-radius:0.65rem; padding:0.6rem 0.85rem; transition:all 0.15s; }
        .case-card:hover { background: var(--accent-dim); border-color: var(--border); }
        .case-card.selected { background: rgba(37,99,235,0.08); border-color: rgba(37,99,235,0.35); }
      `}</style>

      <header className="page-head">
        <h2>Upload Documents</h2>
        <p>Upload PDFs to a case — stored in S3 and indexed into AI vector search</p>
      </header>

      {/* ── Step 1: Case selection ──────────────────────────── */}
      <div className="glass" style={{ marginBottom: "1rem" }}>
        <div style={{ display: "flex", alignItems: "center", gap: "0.5rem", marginBottom: "0.75rem" }}>
          <div style={{
            width: 24, height: 24, borderRadius: "50%",
            background: selectedCase ? "var(--accent)" : "var(--bg-elevated)",
            border: `2px solid ${selectedCase ? "var(--accent)" : "var(--border)"}`,
            display: "flex", alignItems: "center", justifyContent: "center",
            fontSize: "0.7rem", color: selectedCase ? "#fff" : "var(--muted)", fontWeight: 700, flexShrink: 0,
          }}>1</div>
          <h4 style={{ margin: 0, fontSize: "0.9rem" }}>Select a Case</h4>
          {selectedCase && (
            <span style={{ marginLeft: "auto", fontSize: "0.78rem", color: "var(--accent)", fontWeight: 600 }}>
              ✓ {selectedCase.title}
            </span>
          )}
        </div>

        {casesLoading ? (
          <div style={{ display: "grid", gap: "0.5rem" }}>
            {[1,2,3].map((i) => (
              <div key={i} style={{
                height: "2.8rem", borderRadius: "0.65rem",
                background: "linear-gradient(90deg, var(--bg-elevated) 25%, var(--border) 50%, var(--bg-elevated) 75%)",
                backgroundSize: "200% 100%", animation: "shimmer 1.4s infinite",
              }} />
            ))}
          </div>
        ) : cases.length === 0 ? (
          <div style={{ textAlign: "center", padding: "2rem 1rem", color: "var(--muted)" }}>
            <div style={{ fontSize: "1.5rem", marginBottom: "0.5rem" }}>⚖️</div>
            <div>No cases found.</div>
            <Link to="/cases" className="btn btn-primary btn-sm" style={{ marginTop: "0.75rem", display: "inline-block" }}>
              Create a Case First
            </Link>
          </div>
        ) : (
          <>
            <input
              className="input"
              style={{ marginBottom: "0.75rem" }}
              placeholder="Search cases…"
              value={caseSearch}
              onChange={(e) => setCaseSearch(e.target.value)}
            />
            <div style={{ display: "grid", gap: "0.4rem", maxHeight: "14rem", overflowY: "auto" }}>
              {filteredCases.map((c) => (
                <div
                  key={c.id}
                  className={`case-card${selectedCase?.id === c.id ? " selected" : ""}`}
                  onClick={() => setSelectedCase(selectedCase?.id === c.id ? null : c)}
                >
                  <div style={{ display: "flex", alignItems: "center", gap: "0.6rem" }}>
                    <div style={{
                      width: 30, height: 30, borderRadius: "0.4rem",
                      background: selectedCase?.id === c.id ? "rgba(37,99,235,0.12)" : "var(--bg-elevated)",
                      display: "flex", alignItems: "center", justifyContent: "center", fontSize: "0.9rem", flexShrink: 0,
                    }}>⚖️</div>
                    <div style={{ minWidth: 0 }}>
                      <div style={{ fontWeight: 600, fontSize: "0.88rem", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                        {c.title}
                      </div>
                      <div className="meta" style={{ fontSize: "0.72rem" }}>
                        {c.client_name}{c.case_number ? ` · #${c.case_number}` : ""}
                      </div>
                    </div>
                    {selectedCase?.id === c.id && (
                      <span style={{ marginLeft: "auto", color: "var(--accent)", flexShrink: 0 }}>✓</span>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </>
        )}
      </div>

      {/* ── Step 2: Drop zone (only active after case selected) ── */}
      <div className="glass" style={{ marginBottom: "1rem", opacity: selectedCase ? 1 : 0.5, transition: "opacity 0.2s" }}>
        <div style={{ display: "flex", alignItems: "center", gap: "0.5rem", marginBottom: "0.75rem" }}>
          <div style={{
            width: 24, height: 24, borderRadius: "50%",
            background: files.length > 0 ? "var(--accent)" : "var(--bg-elevated)",
            border: `2px solid ${files.length > 0 ? "var(--accent)" : "var(--border)"}`,
            display: "flex", alignItems: "center", justifyContent: "center",
            fontSize: "0.7rem", color: files.length > 0 ? "#fff" : "var(--muted)", fontWeight: 700, flexShrink: 0,
          }}>2</div>
          <h4 style={{ margin: 0, fontSize: "0.9rem" }}>Select PDFs</h4>
        </div>

        <div
          className={`upload-dropzone${dragging ? " dragging" : ""}${!selectedCase ? " disabled" : ""}`}
          style={{ pointerEvents: selectedCase ? "auto" : "none" }}
          onDragOver={onDragOver}
          onDragLeave={onDragLeave}
          onDrop={onDrop}
          onClick={() => selectedCase && inputRef.current?.click()}
        >
          <input ref={inputRef} type="file" accept=".pdf" multiple style={{ display: "none" }} onChange={onFileInput} />
          <div className="upload-dropzone-icon">📄</div>
          <p className="upload-dropzone-label">
            {!selectedCase ? "Select a case first" : dragging ? "Drop PDFs here" : "Click or drag & drop PDFs"}
          </p>
          <p className="meta">Only .pdf files · Multiple files supported</p>
        </div>
      </div>

      {/* ── Step 3: File queue + upload ─────────────────────── */}
      {files.length > 0 && (
        <div className="glass" style={{ marginBottom: "1rem" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "0.75rem" }}>
            <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
              <div style={{
                width: 24, height: 24, borderRadius: "50%",
                background: "var(--accent)", border: "2px solid var(--accent)",
                display: "flex", alignItems: "center", justifyContent: "center",
                fontSize: "0.7rem", color: "#fff", fontWeight: 700, flexShrink: 0,
              }}>3</div>
              <h4 style={{ margin: 0, fontSize: "0.9rem" }}>{files.length} file{files.length > 1 ? "s" : ""} queued</h4>
            </div>
            <div style={{ display: "flex", gap: "0.5rem" }}>
              {files.some((f) => f.state === S.SUCCESS) && (
                <button className="btn btn-ghost btn-sm" onClick={clearDone} disabled={globalLock}>Clear done</button>
              )}
              <button
                className="btn btn-primary btn-sm"
                disabled={!hasPending || globalLock || !selectedCase || hasActive}
                onClick={uploadAll}
              >
                {globalLock || hasActive
                  ? <><span className="spinner" /> Processing…</>
                  : `Upload ${pendingCount} PDF${pendingCount !== 1 ? "s" : ""} to ${selectedCase?.title || "case"}`
                }
              </button>
            </div>
          </div>

          <div style={{ display: "flex", flexDirection: "column", gap: "0.6rem" }}>
            {files.map((item) => (
              <FileRow key={item.id} item={item} globalLock={globalLock} onRemove={() => removeFile(item.id)} onRetry={() => uploadOne(item)} />
            ))}
          </div>
        </div>
      )}
    </>
  );
}

function FileRow({ item, globalLock, onRemove, onRetry }) {
  const { file, state, progress, pipelineStep, error, docId } = item;
  const isActive = state === S.UPLOADING || state === S.PROCESSING;

  return (
    <div style={{
      border: "1px solid var(--border)", borderRadius: "0.65rem",
      padding: "0.75rem 1rem", background: "var(--bg)",
    }}>
      {/* Header row */}
      <div style={{ display: "flex", alignItems: "center", gap: "0.6rem" }}>
        <span style={{ fontSize: "1.2rem", flexShrink: 0 }}>
          {state === S.IDLE      && "⏳"}
          {state === S.UPLOADING && <span className="spinner" style={{ width: 18, height: 18, borderWidth: 2 }} />}
          {state === S.PROCESSING && <span className="spinner" style={{ width: 18, height: 18, borderWidth: 2 }} />}
          {state === S.SUCCESS   && "✅"}
          {state === S.ERROR     && "❌"}
        </span>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontWeight: 600, fontSize: "0.88rem", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
            {file.name}
          </div>
          <div className="meta" style={{ fontSize: "0.72rem" }}>{formatBytes(file.size)}</div>
        </div>
        <div style={{ display: "flex", gap: "0.4rem", flexShrink: 0 }}>
          {state === S.SUCCESS && docId && (
            <Link to={`/documents/${docId}/ai`} className="btn btn-ghost btn-sm" style={{ fontSize: "0.75rem" }}>
              Ask AI →
            </Link>
          )}
          {state === S.ERROR && (
            <button className="btn btn-primary btn-sm" onClick={onRetry} disabled={globalLock}>Retry</button>
          )}
          {!isActive && (
            <button className="btn btn-ghost btn-sm" onClick={onRemove} disabled={globalLock}>✕</button>
          )}
        </div>
      </div>

      {/* Upload progress bar */}
      {state === S.UPLOADING && (
        <div style={{ marginTop: "0.6rem" }}>
          <div className="upload-progress-bar-wrap">
            <div className="upload-progress-bar" style={{ width: `${progress}%` }} />
            <span className="upload-progress-pct">{progress}%</span>
          </div>
        </div>
      )}

      {/* Pipeline steps */}
      {(state === S.PROCESSING || state === S.SUCCESS) && (
        <div style={{ marginTop: "0.75rem", display: "flex", flexDirection: "column", gap: "0.3rem" }}>
          {PIPELINE_STEPS.map((step, idx) => {
            const isDone    = pipelineStep > idx;
            const isActive  = pipelineStep === idx;
            const isPending = pipelineStep < idx;
            return (
              <div
                key={step.key}
                className={isActive ? "pipeline-step-active" : ""}
                style={{
                  display: "flex", alignItems: "center", gap: "0.5rem",
                  fontSize: "0.78rem",
                  color: isDone ? "#16a34a" : isActive ? "var(--accent)" : "var(--muted)",
                  opacity: isPending ? 0.4 : 1,
                  transition: "all 0.3s ease",
                }}
              >
                <span style={{ width: 16, textAlign: "center", flexShrink: 0 }}>
                  {isDone ? "✓" : isActive ? <span className="spinner" style={{ width: 12, height: 12, borderWidth: 1.5 }} /> : "○"}
                </span>
                <span>{step.icon} {step.label}</span>
              </div>
            );
          })}
        </div>
      )}

      {/* Error message */}
      {state === S.ERROR && error && (
        <div className="upload-error" style={{ marginTop: "0.5rem" }}>{error}</div>
      )}
    </div>
  );
}
