const API_BASE = process.env.NEXT_PUBLIC_API_BASE || "http://localhost:8000/api/v1";

export type HttpMethod = "GET" | "POST" | "PATCH" | "DELETE";

function getToken() {
  if (typeof window === "undefined") return null;
  return localStorage.getItem("token");
}

export async function apiFetch(path: string, options: RequestInit = {}) {
  const token = getToken();
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
    throw new Error(data?.error?.message || `请求失败(${resp.status})`);
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

export const metaApi = {
  groups: () => apiFetch("/meta/groups"),
  majors: (groupId?: number) => apiFetch(`/meta/majors${groupId ? `?group_id=${groupId}` : ""}`),
  courses: (majorId?: number) => apiFetch(`/meta/courses${majorId ? `?major_id=${majorId}` : ""}`),
  tags: () => apiFetch("/meta/tags"),
};

export const resourceApi = {
  list: (params: Record<string, string | number | undefined> = {}) => {
    const query = new URLSearchParams();
    Object.entries(params).forEach(([k, v]) => {
      if (v !== undefined && v !== null) query.append(k, String(v));
    });
    return apiFetch(`/resources${query.toString() ? `?${query.toString()}` : ""}`);
  },
  detail: (id: number) => apiFetch(`/resources/${id}`),
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
  publish: (id: number) => apiFetch(`/resources/${id}/publish`, { method: "POST" }),
  archive: (id: number) => apiFetch(`/resources/${id}/archive`, { method: "POST" }),
  remove: (id: number) => apiFetch(`/resources/${id}`, { method: "DELETE" }),
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

export const adminApi = {
  users: (page = 1, pageSize = 20, keyword?: string) =>
    apiFetch(`/admin/users?page=${page}&page_size=${pageSize}${keyword ? `&keyword=${keyword}` : ""}`),
};
