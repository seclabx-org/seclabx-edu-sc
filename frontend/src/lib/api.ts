const API_BASE = process.env.NEXT_PUBLIC_API_BASE || "http://localhost:8000/api/v1";

export type HttpMethod = "GET" | "POST" | "PATCH" | "DELETE";

function getToken() {
  if (typeof window === "undefined") return null;
  return localStorage.getItem("token");
}

export async function apiFetch(path: string, options: RequestInit = {}) {
  const token = getToken();
  const hasToken = Boolean(token);
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    ...(options.headers as Record<string, string>),
  };
  if (token) {
    headers["Authorization"] = `Bearer ${token}`;
  }
  const resp = await fetch(`${API_BASE}${path}`, { ...options, headers, cache: "no-store" });
  const data = await resp.json().catch(() => null);
  if (!resp.ok) {
    const isAuthEndpoint = path.startsWith("/auth/");
    if ((resp.status === 401 || resp.status === 403) && typeof window !== "undefined" && hasToken && !isAuthEndpoint) {
      localStorage.removeItem("token");
      window.dispatchEvent(new Event("auth-changed"));
      if (!(window as any).__auth_notified) {
        alert("登录已过期，请重新登录");
        (window as any).__auth_notified = true;
        setTimeout(() => {
          (window as any).__auth_notified = false;
        }, 3000);
      }
    }
    let msg = data?.error?.message;
    const detail = data?.error?.details;
    const firstErr = Array.isArray(detail?.errors) && detail.errors.length > 0 ? detail.errors[0] : null;
    if (!msg && firstErr?.msg) {
      msg = firstErr.msg;
    }
    throw new Error(msg || `请求失败(${resp.status})`);
  }
  return data?.data;
}

export async function login(username: string, password: string) {
  const data = await apiFetch("/auth/login", {
    method: "POST",
    body: JSON.stringify({ username, password }),
  });
  if (typeof window !== "undefined") {
    localStorage.setItem("token", data.access_token);
    window.dispatchEvent(new Event("auth-changed"));
  }
  return data;
}

export async function changePassword(old_password: string, new_password: string) {
  return apiFetch("/auth/change-password", {
    method: "POST",
    body: JSON.stringify({ old_password, new_password }),
  });
}

export const metaApi = {
  groups: () => apiFetch("/meta/groups"),
  majors: (groupId?: number) => apiFetch(`/meta/majors${groupId ? `?group_id=${groupId}` : ""}`),
  courses: (majorId?: number) => apiFetch(`/meta/courses${majorId ? `?major_id=${majorId}` : ""}`),
  tags: () => apiFetch("/meta/tags"),
};

export const resourceApi = {
  list: (params: Record<string, string | number | boolean | undefined> = {}) => {
    const query = new URLSearchParams();
    Object.entries(params).forEach(([k, v]) => {
      if (v !== undefined && v !== null) query.append(k, String(v));
    });
    return apiFetch(`/resources${query.toString() ? `?${query.toString()}` : ""}`);
  },
  detail: (id: number) => apiFetch(`/resources/${id}`),
  update: (id: number, payload: any) =>
    apiFetch(`/resources/${id}`, { method: "PATCH", body: JSON.stringify(payload) }),
  summary: (params: Record<string, string | number | undefined> = {}) => {
    const query = new URLSearchParams();
    Object.entries(params).forEach(([k, v]) => {
      if (v !== undefined && v !== null) query.append(k, String(v));
    });
    return apiFetch(`/resources/summary${query.toString() ? `?${query.toString()}` : ""}`);
  },
  tagsCloud: (params: Record<string, string | number | undefined> = {}) => {
    const query = new URLSearchParams();
    Object.entries(params).forEach(([k, v]) => {
      if (v !== undefined && v !== null) query.append(k, String(v));
    });
    return apiFetch(`/resources/tags-cloud${query.toString() ? `?${query.toString()}` : ""}`);
  },
  create: (payload: any) =>
    apiFetch("/resources", {
      method: "POST",
      body: JSON.stringify(payload),
    }),
  patch: (id: number, payload: any) =>
    apiFetch(`/resources/${id}`, {
      method: "PATCH",
      body: JSON.stringify(payload),
    }),
  download: (id: number) => apiFetch(`/resources/${id}/download`),
  preview: (id: number) => apiFetch(`/resources/${id}/preview`),
  publish: (id: number) => apiFetch(`/resources/${id}/publish`, { method: "POST" }),
  archive: (id: number) => apiFetch(`/resources/${id}/archive`, { method: "POST" }),
  remove: (id: number) => apiFetch(`/resources/${id}`, { method: "DELETE" }),
  myFilters: () => apiFetch("/resources/my-filters"),
  downloadAttachment: (id: number, attachmentId: number) =>
    apiFetch(`/resources/${id}/attachments/${attachmentId}/download`),
  deleteAttachment: (id: number, attachmentId: number) =>
    apiFetch(`/resources/${id}/attachments/${attachmentId}`, { method: "DELETE" }),
};

export const aiApi = {
  chat: (payload: { messages: Array<{ role: string; content: string }>; model?: string; session_id?: number | null }) =>
    apiFetch("/ai/chat", { method: "POST", body: JSON.stringify(payload) }),
  sessions: () => apiFetch("/ai/sessions"),
  session: (id: number) => apiFetch(`/ai/sessions/${id}`),
  createSession: (title?: string) =>
    apiFetch("/ai/sessions", { method: "POST", body: JSON.stringify({ title }) }),
  deleteSession: (id: number) => apiFetch(`/ai/sessions/${id}`, { method: "DELETE" }),
};

export async function uploadFile(resourceId: number, file: File) {
  const token = getToken();
  const form = new FormData();
  form.append("file", file);
  const resp = await fetch(`${API_BASE}/resources/${resourceId}/upload`, {
    method: "POST",
    body: form,
    headers: token ? { Authorization: `Bearer ${token}` } : undefined,
  });
  const data = await resp.json().catch(() => null);
  if (!resp.ok) throw new Error(data?.error?.message || "上传失败");
  return data.data;
}

export async function uploadCover(resourceId: number, file: File) {
  const token = getToken();
  const form = new FormData();
  form.append("file", file);
  const resp = await fetch(`${API_BASE}/resources/${resourceId}/cover`, {
    method: "POST",
    body: form,
    headers: token ? { Authorization: `Bearer ${token}` } : undefined,
  });
  const data = await resp.json().catch(() => null);
  if (!resp.ok) throw new Error(data?.error?.message || "封面上传失败");
  return data.data;
}

export async function uploadAttachment(resourceId: number, file: File) {
  const token = getToken();
  const form = new FormData();
  form.append("file", file);
  const resp = await fetch(`${API_BASE}/resources/${resourceId}/attachments`, {
    method: "POST",
    body: form,
    headers: token ? { Authorization: `Bearer ${token}` } : undefined,
  });
  const data = await resp.json().catch(() => null);
  if (!resp.ok) throw new Error(data?.error?.message || "附件上传失败");
  return data.data;
}

export const adminApi = {
  users: (params: Record<string, string | number | boolean | undefined> = {}) => {
    const query = new URLSearchParams();
    const defaults = { page: 1, page_size: 20 };
    Object.entries({ ...defaults, ...params }).forEach(([k, v]) => {
      if (v !== undefined && v !== null) query.append(k, String(v));
    });
    return apiFetch(`/admin/users${query.toString() ? `?${query.toString()}` : ""}`);
  },
  createUser: (payload: any) =>
    apiFetch(`/admin/users`, {
      method: "POST",
      body: JSON.stringify(payload),
    }),
  updateUser: (id: number, payload: any) =>
    apiFetch(`/admin/users/${id}`, {
      method: "PATCH",
      body: JSON.stringify(payload),
    }),
  resetPassword: (id: number) => apiFetch(`/admin/users/${id}/reset-password`, { method: "POST" }),
  metaGroups: () => apiFetch("/admin/meta/groups"),
  metaMajors: () => apiFetch("/admin/meta/majors"),
  metaCourses: () => apiFetch("/admin/meta/courses"),
  metaTags: () => apiFetch("/admin/meta/tags"),
  createGroup: (payload: any) =>
    apiFetch("/admin/meta/groups", { method: "POST", body: JSON.stringify(payload) }),
  updateGroup: (id: number, payload: any) =>
    apiFetch(`/admin/meta/groups/${id}`, { method: "PATCH", body: JSON.stringify(payload) }),
  createMajor: (payload: any) =>
    apiFetch("/admin/meta/majors", { method: "POST", body: JSON.stringify(payload) }),
  updateMajor: (id: number, payload: any) =>
    apiFetch(`/admin/meta/majors/${id}`, { method: "PATCH", body: JSON.stringify(payload) }),
  createCourse: (payload: any) =>
    apiFetch("/admin/meta/courses", { method: "POST", body: JSON.stringify(payload) }),
  updateCourse: (id: number, payload: any) =>
    apiFetch(`/admin/meta/courses/${id}`, { method: "PATCH", body: JSON.stringify(payload) }),
  createTag: (payload: any) =>
    apiFetch("/admin/meta/tags", { method: "POST", body: JSON.stringify(payload) }),
  updateTag: (id: number, payload: any) =>
    apiFetch(`/admin/meta/tags/${id}`, { method: "PATCH", body: JSON.stringify(payload) }),
};
