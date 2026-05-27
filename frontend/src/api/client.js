const API = "/api";

function getToken() {
  return localStorage.getItem("jurisai_token");
}

async function request(path, options = {}) {
  const headers = { ...(options.headers || {}) };
  const token = getToken();
  if (token) headers.Authorization = `Bearer ${token}`;
  if (!(options.body instanceof FormData)) {
    headers["Content-Type"] = headers["Content-Type"] || "application/json";
  }

  const res = await fetch(`${API}${path}`, { ...options, headers });
  if (res.status === 401) {
    localStorage.removeItem("jurisai_token");
    localStorage.removeItem("jurisai_user");
    window.location.href = "/login";
    throw new Error("Session expired");
  }
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    const detail = err.detail;
    const msg = Array.isArray(detail)
      ? detail.map((d) => d.msg).join(", ")
      : detail || res.statusText;
    throw new Error(msg);
  }
  const type = res.headers.get("content-type") || "";
  if (type.includes("application/json")) return res.json();
  return res;
}

export const api = {
  register: (data) =>
    request("/auth/register", { method: "POST", body: JSON.stringify(data) }),
  login: (data) =>
    request("/auth/login", { method: "POST", body: JSON.stringify(data) }),
  me: () => request("/me"),
  dashboard: () => request("/dashboard"),
  clients: (search = "") => request(`/clients?search=${encodeURIComponent(search)}`),
  createClient: (data) => request("/clients", { method: "POST", body: JSON.stringify(data) }),
  getClient: (id) => request(`/clients/${id}`),
  cases: (search = "", clientId = "") => {
    let q = `/cases?search=${encodeURIComponent(search)}`;
    if (clientId) q += `&client_id=${clientId}`;
    return request(q);
  },
  getCase: (id) => request(`/cases/${id}`),
  createCase: (data) => request("/cases", { method: "POST", body: JSON.stringify(data) }),
  updateCase: (id, data) => request(`/cases/${id}`, { method: "PATCH", body: JSON.stringify(data) }),
  uploadCaseDoc: (caseId, file) => {
    const fd = new FormData();
    fd.append("file", file);
    return request(`/cases/${caseId}/documents`, { method: "POST", body: fd });
  },
  caseBrief: (caseId, file) => {
    const fd = new FormData();
    if (file) fd.append("file", file);
    return request(`/cases/${caseId}/brief`, { method: "POST", body: fd });
  },
  addNote: (caseId, content) =>
    request(`/cases/${caseId}/notes`, { method: "POST", body: JSON.stringify({ content }) }),
  addTimeline: (caseId, data) =>
    request(`/cases/${caseId}/timeline`, { method: "POST", body: JSON.stringify(data) }),
  chatHistory: (caseId) =>
    request(caseId ? `/chat/history?case_id=${caseId}` : "/chat/history"),
  clearChat: (caseId) =>
    request(caseId ? `/chat/history?case_id=${caseId}` : "/chat/history", { method: "DELETE" }),
  chat: (query, caseId) => {
    let url = "/chat";
    if (caseId) url += `?case_id=${caseId}`;
    return request(url, { method: "POST", body: JSON.stringify({ query }) });
  },
  upload: (file) => {
    const fd = new FormData();
    fd.append("file", file);
    return request("/upload", { method: "POST", body: fd });
  },
  rebuildIndex: () => request("/index/rebuild", { method: "POST" }),
  knowledge: (search = "") =>
    request(`/knowledge-base?search=${encodeURIComponent(search)}`),
  insights: () => request("/insights"),
  search: (q) => request(`/search?q=${encodeURIComponent(q)}`),
  generateBrief: (file) => {
    const fd = new FormData();
    fd.append("file", file);
    return request("/brief/generate", { method: "POST", body: fd });
  },
  downloadBriefPdf: async (file) => {
    const fd = new FormData();
    fd.append("file", file);
    const token = getToken();
    const res = await fetch(`${API}/brief/pdf`, {
      method: "POST",
      headers: token ? { Authorization: `Bearer ${token}` } : {},
      body: fd,
    });
    if (!res.ok) throw new Error("PDF failed");
    return res.blob();
  },
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
