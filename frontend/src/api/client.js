import cache from "./cache";

const API = "/api";
const BASE_URL = ""; // same origin

const TTL = {
  dashboard: 60_000,   // 60s
  clients: 30_000,   // 30s
  cases: 30_000,   // 30s
  documents: 30_000,   // 30s
  me: 120_000,  // 2min
  threads: 20_000,   // 20s
};

/** Tracks last observed X-Response-Time from the server */
export const latency = { last: null };

function getToken() {
  return localStorage.getItem("lexassist_token");
}

async function request(path, options = {}) {
  const headers = { ...(options.headers || {}) };
  const token = getToken();
  if (token) headers.Authorization = `Bearer ${token}`;
  if (!(options.body instanceof FormData)) {
    headers["Content-Type"] = headers["Content-Type"] || "application/json";
  }

  const res = await fetch(`${API}${path}`, { ...options, headers });

  // Record server-side latency from middleware header
  const rt = res.headers.get("x-response-time");
  if (rt) latency.last = rt;

  if (!res.ok) {
    // Read error body once for all failure cases
    const err = await res.json().catch(() => ({}));
    const detail = err.detail;
    const msg = Array.isArray(detail)
      ? detail.map((d) => d.msg).join(", ")
      : typeof detail === "string" && detail
        ? detail
        : null;

    if (res.status === 401) {
      // Auth endpoints (login/register) legitimately return 401 for wrong credentials.
      // Don't treat them as session expiry — just surface the error message.
      const isAuthEndpoint = path.startsWith("/auth/");
      if (!isAuthEndpoint) {
        localStorage.removeItem("lexassist_token");
        localStorage.removeItem("lexassist_user");
        window.location.href = "/login";
        throw new Error("Session expired");
      }
      throw new Error(msg || "Invalid email or password");
    }

    throw new Error(msg || res.statusText || "Request failed");
  }
  const type = res.headers.get("content-type") || "";
  if (type.includes("application/json")) return res.json();
  return res;
}

/** Cached GET — returns cached data if fresh, otherwise fetches and caches. */
async function cachedGet(cacheKey, path, ttlMs) {
  const hit = cache.get(cacheKey);
  if (hit !== null) return hit;
  const data = await request(path);
  cache.set(cacheKey, data, ttlMs);
  return data;
}

/**
 * Deduplicated GET — if an identical request is in-flight, returns the same promise.
 * Prevents duplicate concurrent fetches for the same resource.
 */
const _inflightRequests = new Map();
async function deduplicatedGet(cacheKey, path, ttlMs) {
  // Check cache first
  const hit = cache.get(cacheKey);
  if (hit !== null) return hit;
  // Return in-flight request if exists
  if (_inflightRequests.has(cacheKey)) return _inflightRequests.get(cacheKey);
  // Start new request
  const promise = request(path).then((data) => {
    cache.set(cacheKey, data, ttlMs);
    _inflightRequests.delete(cacheKey);
    return data;
  }).catch((err) => {
    _inflightRequests.delete(cacheKey);
    throw err;
  });
  _inflightRequests.set(cacheKey, promise);
  return promise;
}

/**
 * Upload a file with real-time progress reporting via XMLHttpRequest.
 */
export function uploadWithProgress(path, file, onProgress) {
  return new Promise((resolve, reject) => {
    const token = getToken();
    const fd = new FormData();
    fd.append("file", file);

    const xhr = new XMLHttpRequest();
    xhr.open("POST", `${API}${path}`, true);
    if (token) xhr.setRequestHeader("Authorization", `Bearer ${token}`);

    xhr.upload.addEventListener("progress", (e) => {
      if (e.lengthComputable) {
        onProgress(Math.round((e.loaded / e.total) * 100));
      }
    });

    xhr.onload = () => {
      if (xhr.status === 401) {
        localStorage.removeItem("lexassist_token");
        window.location.href = "/login";
        return reject(new Error("Session expired"));
      }
      try {
        const data = JSON.parse(xhr.responseText);
        if (xhr.status >= 200 && xhr.status < 300) {
          resolve(data);
        } else {
          const msg = Array.isArray(data.detail)
            ? data.detail.map((d) => d.msg).join(", ")
            : data.detail || xhr.statusText;
          reject(new Error(msg));
        }
      } catch {
        reject(new Error("Unexpected response from server."));
      }
    };

    xhr.onerror = () => reject(new Error("Network error during upload."));
    xhr.send(fd);
  });
}

export const api = {
  // Auth
  register: (data) =>
    request("/auth/register", { method: "POST", body: JSON.stringify(data) }),
  login: (data) =>
    request("/auth/login", { method: "POST", body: JSON.stringify(data) }),
  me: () => deduplicatedGet("me", "/me", TTL.me),

  // Dashboard — deduplicated + cached 60s
  dashboard: () => deduplicatedGet("dashboard", "/dashboard", TTL.dashboard),

  /**
   * Get cached dashboard data synchronously (null if not cached).
   * Used to render instantly before SSE stream arrives.
   */
  dashboardCached: () => cache.get("dashboard"),

  /**
   * Streaming dashboard via SSE.
   */
  dashboardStream: (onData, onError) => {
    const token = getToken();
    const ctrl = new AbortController();
    fetch(`${API}/dashboard/stream`, {
      headers: { 
        Authorization: `Bearer ${token}`,
        Accept: "text/event-stream"
      },
      signal: ctrl.signal,
    }).then(async (res) => {
      if (!res.ok) { onError && onError(new Error(res.statusText)); return; }
      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buf = "";

      function processLine(line) {
        if (line.startsWith("data: ")) {
          try {
            const d = JSON.parse(line.slice(6));
            cache.set("dashboard", d, TTL.dashboard);
            onData(d);
          } catch { }
        }
      }

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buf += decoder.decode(value, { stream: true });
        const lines = buf.split("\n");
        buf = lines.pop();
        for (const line of lines) {
          processLine(line);
        }
      }
      // Flush remaining buffer
      buf += decoder.decode();
      if (buf.trim()) {
        const remaining = buf.split("\n");
        for (const line of remaining) {
          processLine(line);
        }
      }
    }).catch((err) => {
      if (err.name !== "AbortError") onError && onError(err);
    });
    return ctrl;
  },

  // Clients — deduplicated + cached 30s; invalidated on create
  clients: (search = "", page = 1, pageSize = 10) => {
    const key = `clients:${search}:${page}:${pageSize}`;
    const url = `/clients?search=${encodeURIComponent(search)}&page=${page}&page_size=${pageSize}`;
    return deduplicatedGet(key, url, TTL.clients);
  },
  createClient: async (data) => {
    const result = await request("/clients", { method: "POST", body: JSON.stringify(data) });
    cache.invalidatePrefix("clients");
    cache.invalidate("dashboard");
    return result;
  },
  getClient: (id) => deduplicatedGet(`client:${id}`, `/clients/${id}`, TTL.clients),
  updateClient: async (id, data) => {
    const result = await request(`/clients/${id}`, { method: "PATCH", body: JSON.stringify(data) });
    cache.invalidate(`client:${id}`);
    cache.invalidatePrefix("clients:");
    cache.invalidate("dashboard");
    return result;
  },
  deleteClient: async (id, force = false) => {
    const url = force ? `/clients/${id}?force=true` : `/clients/${id}`;
    const result = await request(url, { method: "DELETE" });
    cache.invalidate(`client:${id}`);
    cache.invalidatePrefix("clients:");
    cache.invalidatePrefix("cases:");
    cache.invalidate("dashboard");
    return result;
  },

  // Cases — deduplicated + cached 30s; invalidated on create/update
  cases: (search = "", clientId = "", page = 1, pageSize = 10) => {
    const key = `cases:${search}:${clientId}:${page}:${pageSize}`;
    let q = `/cases?search=${encodeURIComponent(search)}&page=${page}&page_size=${pageSize}`;
    if (clientId) q += `&client_id=${clientId}`;
    return deduplicatedGet(key, q, TTL.cases);
  },
  getCase: (id) => deduplicatedGet(`case:${id}`, `/cases/${id}`, TTL.cases),
  createCase: async (data) => {
    const result = await request("/cases", { method: "POST", body: JSON.stringify(data) });
    cache.invalidatePrefix("cases");
    cache.invalidate("dashboard");
    return result;
  },
  updateCase: async (id, data) => {
    const result = await request(`/cases/${id}`, { method: "PATCH", body: JSON.stringify(data) });
    cache.invalidate(`case:${id}`);
    cache.invalidatePrefix("cases:");
    cache.invalidate("dashboard");
    return result;
  },
  deleteCase: async (id) => {
    const result = await request(`/cases/${id}`, { method: "DELETE" });
    cache.invalidate(`case:${id}`);
    cache.invalidatePrefix("cases:");
    cache.invalidate("dashboard");
    return result;
  },

  // Documents — deduplicated + cached 30s; invalidated on delete/upload
  documents: (search = "", page = 1, pageSize = 10) => {
    const key = `documents:${search}:${page}:${pageSize}`;
    const url = `/documents?search=${encodeURIComponent(search)}&page=${page}&page_size=${pageSize}`;
    return deduplicatedGet(key, url, TTL.documents);
  },
  getDocument: (id) => request(`/documents/${id}`),
  deleteDocument: async (id) => {
    const result = await request(`/documents/${id}`, { method: "DELETE" });
    cache.invalidatePrefix("documents");
    cache.invalidate("dashboard");
    return result;
  },
  downloadDocument: (id) => request(`/documents/${id}/download`),

  // Case documents
  uploadCaseDoc: async (caseId, file, onProgress = () => { }) => {
    const result = await uploadWithProgress(`/cases/${caseId}/documents`, file, onProgress);
    cache.invalidate(`case:${caseId}`);
    cache.invalidatePrefix("documents");
    cache.invalidate("dashboard");
    return result;
  },

  // Standalone upload
  upload: async (file, onProgress = () => { }) => {
    const result = await uploadWithProgress("/upload", file, onProgress);
    cache.invalidatePrefix("documents");
    cache.invalidate("dashboard");
    return result;
  },

  // List documents for a specific case
  caseDocuments: (caseId) => request(`/cases/${caseId}/documents`),

  /**
   * Stream document processing status via SSE.
   * Calls onUpdate({status, error}) on each event.
   * Calls onDone() when status is completed/error.
   * Returns AbortController.
   */
  documentStatus: (docId, onUpdate, onDone) => {
    const token = getToken();
    const ctrl = new AbortController();
    fetch(`${API}/documents/${docId}/status`, {
      headers: { 
        Authorization: `Bearer ${token}`,
        Accept: "text/event-stream"
      },
      signal: ctrl.signal,
    }).then(async (res) => {
      if (!res.ok) { onDone && onDone(); return; }
      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buf = "";
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buf += decoder.decode(value, { stream: true });
        const lines = buf.split("\n");
        buf = lines.pop();
        for (const line of lines) {
          if (line.startsWith("data: ")) {
            try {
              const evt = JSON.parse(line.slice(6));
              onUpdate && onUpdate(evt);
              if (evt.status === "completed" || evt.status === "error") {
                onDone && onDone(evt);
                return;
              }
            } catch { }
          }
        }
      }
      onDone && onDone();
    }).catch((err) => {
      if (err.name !== "AbortError") onDone && onDone({ status: "error", error: err.message });
    });
    return ctrl;
  },

  /**
   * Stream Document AI chat (answers from a single document).
   */
  documentChat: (docId, query, history, onChunk, onDone, onError, onStatus) => {
    const token = getToken();
    const ctrl = new AbortController();

    function processSSELine(line) {
      if (!line.startsWith("data: ")) return;
      try {
        const evt = JSON.parse(line.slice(6));
        if (evt.type === "chunk") onChunk && onChunk(evt.content);
        else if (evt.type === "status") onStatus && onStatus(evt.content);
        else if (evt.type === "done") onDone && onDone(evt);
        else if (evt.type === "error") onError && onError(new Error(evt.content));
      } catch { }
    }

    fetch(`${API}/documents/${docId}/chat`, {
      method: "POST",
      headers: { 
        "Content-Type": "application/json", 
        Authorization: `Bearer ${token}`,
        Accept: "text/event-stream"
      },
      body: JSON.stringify({ query, history }),
      signal: ctrl.signal,
    }).then(async (res) => {
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        onError && onError(new Error(err.detail || res.statusText));
        return;
      }
      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buf = "";
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buf += decoder.decode(value, { stream: true });
        const lines = buf.split("\n");
        buf = lines.pop();
        for (const line of lines) processSSELine(line);
      }
      buf += decoder.decode();
      if (buf.trim()) buf.split("\n").forEach(processSSELine);
    }).catch((err) => {
      if (err.name !== "AbortError") onError && onError(err);
    });
    return ctrl;
  },

  // Notes & timeline
  addNote: async (caseId, content) => {
    const result = await request(`/cases/${caseId}/notes`, {
      method: "POST",
      body: JSON.stringify({ content }),
    });
    cache.invalidate(`case:${caseId}`);
    return result;
  },
  addTimeline: async (caseId, data) => {
    const result = await request(`/cases/${caseId}/timeline`, {
      method: "POST",
      body: JSON.stringify(data),
    });
    cache.invalidate(`case:${caseId}`);
    return result;
  },

  // Chat / AI Research — legacy (never cached)
  chatHistory: (caseId) =>
    request(caseId ? `/chat/history?case_id=${caseId}` : "/chat/history"),
  clearChat: (caseId) =>
    request(
      caseId ? `/chat/history?case_id=${caseId}` : "/chat/history",
      { method: "DELETE" }
    ),

  // ---------------------------------------------------------------------------
  // Thread management — cached with deduplication
  // ---------------------------------------------------------------------------

  threads: (mode = null, caseId = null) => {
    let url = "/threads";
    const params = [];
    if (mode) params.push(`mode=${encodeURIComponent(mode)}`);
    if (caseId) params.push(`case_id=${encodeURIComponent(caseId)}`);
    if (params.length) url += "?" + params.join("&");
    const key = `threads:${mode || ""}:${caseId || ""}`;
    return deduplicatedGet(key, url, TTL.threads);
  },

  defaultThread: (mode = "MAIN", caseId = null) => {
    let url = `/threads/default?mode=${encodeURIComponent(mode)}`;
    if (caseId) url += `&case_id=${encodeURIComponent(caseId)}`;
    return request(url);
  },

  createThread: async (mode = "MAIN", title = "New Conversation", caseId = null) => {
    const result = await request("/threads", {
      method: "POST",
      body: JSON.stringify({ mode, title, case_id: caseId }),
    });
    // Invalidate cached thread list for this mode
    cache.invalidatePrefix("threads:");
    return result;
  },

  renameThread: async (threadId, title) => {
    const result = await request(`/threads/${threadId}`, {
      method: "PATCH",
      body: JSON.stringify({ title }),
    });
    cache.invalidatePrefix("threads:");
    return result;
  },

  deleteThread: async (threadId) => {
    const result = await request(`/threads/${threadId}`, { method: "DELETE" });
    cache.invalidatePrefix("threads:");
    return result;
  },

  threadHistory: (threadId, mode = "MAIN", caseId = null) => {
    let url = `/threads/${threadId}/history?mode=${encodeURIComponent(mode)}`;
    if (caseId) url += `&case_id=${encodeURIComponent(caseId)}`;
    return request(url);
  },

  /**
   * LangGraph-backed streaming chat (primary path).
   * @param onStatus - called with status string (e.g. "Thinking…", "Searching…")
   */
  streamChatV2: (threadId, mode, query, caseId, onChunk, onDone, onError, onStatus) => {
    const token = getToken();
    const ctrl = new AbortController();

    function processSSELine(line) {
      if (!line.startsWith("data: ")) return;
      try {
        const evt = JSON.parse(line.slice(6));
        if (evt.type === "chunk") onChunk && onChunk(evt.content);
        else if (evt.type === "status") onStatus && onStatus(evt.content);
        else if (evt.type === "done") onDone && onDone(evt);
        else if (evt.type === "error") onError && onError(new Error(evt.content));
      } catch { }
    }

    fetch(`${API}/chat/stream`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
        Accept: "text/event-stream"
      },
      body: JSON.stringify({
        thread_id: threadId,
        mode,
        query,
        case_id: caseId || null,
      }),
      signal: ctrl.signal,
    }).then(async (res) => {
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        onError && onError(new Error(err.detail || res.statusText));
        return;
      }
      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buf = "";
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buf += decoder.decode(value, { stream: true });
        const lines = buf.split("\n");
        buf = lines.pop();
        for (const line of lines) {
          processSSELine(line);
        }
      }
      // Flush any remaining data in the buffer after stream ends
      buf += decoder.decode(); // flush decoder
      if (buf.trim()) {
        const remaining = buf.split("\n");
        for (const line of remaining) {
          processSSELine(line);
        }
      }
    }).catch((err) => {
      if (err.name !== "AbortError") onError && onError(err);
    });
    return ctrl;
  },

  /**
   * Streaming chat via SSE fetch (legacy).
   */
  streamChat: (query, caseId, onChunk, onDone, onError) => {
    const token = getToken();
    const ctrl = new AbortController();
    let url = `${API}/chat`;
    if (caseId) url += `?case_id=${caseId}`;

    function processSSELine(line) {
      if (!line.startsWith("data: ")) return;
      try {
        const evt = JSON.parse(line.slice(6));
        if (evt.type === "chunk") onChunk && onChunk(evt.content);
        else if (evt.type === "done") onDone && onDone(evt);
        else if (evt.type === "error") onError && onError(new Error(evt.content));
      } catch { }
    }

    fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
        Accept: "text/event-stream"
      },
      body: JSON.stringify({ query }),
      signal: ctrl.signal,
    }).then(async (res) => {
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        onError && onError(new Error(err.detail || res.statusText));
        return;
      }
      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buf = "";
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buf += decoder.decode(value, { stream: true });
        const lines = buf.split("\n");
        buf = lines.pop();
        for (const line of lines) {
          processSSELine(line);
        }
      }
      // Flush remaining buffer
      buf += decoder.decode();
      if (buf.trim()) {
        const remaining = buf.split("\n");
        for (const line of remaining) {
          processSSELine(line);
        }
      }
    }).catch((err) => {
      if (err.name !== "AbortError") onError && onError(err);
    });
    return ctrl;
  },

  // Legacy non-streaming chat
  chat: (query, caseId) => {
    let url = "/chat";
    if (caseId) url += `?case_id=${caseId}`;
    return request(url, { method: "POST", body: JSON.stringify({ query }) });
  },

  // Misc
  insights: () => request("/insights"),
  search: (q) => request(`/search?q=${encodeURIComponent(q)}`),
  settings: () => request("/settings"),
};

export function formatTime(iso) {
  if (!iso) return "—";
  try {
    return new Date(iso).toLocaleString("en-IN", {
      dateStyle: "medium",
      timeStyle: "short",
    });
  } catch {
    return iso;
  }
}

export function formatRelativeTime(iso) {
  if (!iso) return "";
  try {
    const now = Date.now();
    const then = new Date(iso).getTime();
    const diff = now - then;
    if (diff < 60_000) return "just now";
    if (diff < 3600_000) return `${Math.floor(diff / 60_000)}m ago`;
    if (diff < 86_400_000) return `${Math.floor(diff / 3600_000)}h ago`;
    if (diff < 604_800_000) return `${Math.floor(diff / 86_400_000)}d ago`;
    return formatTime(iso);
  } catch {
    return iso;
  }
}

export function formatBytes(bytes) {
  if (!bytes) return "—";
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}
