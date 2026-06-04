/**
 * Helpers for the REST API (separate from GraphQL/Apollo). All REST endpoints
 * under /api/* require the same Bearer token as GraphQL.
 */

export function apiBase() {
  return process.env.NEXT_PUBLIC_API_URL || "http://localhost:5001";
}

export function getToken() {
  if (typeof window === "undefined") return null;
  return localStorage.getItem("token");
}

export function authHeaders(extra = {}) {
  const token = getToken();
  return { ...(token ? { Authorization: `Bearer ${token}` } : {}), ...extra };
}

/** JSON fetch with auth. Throws on non-2xx with the server's error message. */
export async function apiFetch(path, { method = "GET", body, headers } = {}) {
  const res = await fetch(`${apiBase()}${path}`, {
    method,
    headers: authHeaders({ "Content-Type": "application/json", ...(headers || {}) }),
    body: body ? JSON.stringify(body) : undefined,
  });
  const text = await res.text();
  const data = text ? JSON.parse(text) : null;
  if (!res.ok) throw new Error(data?.error || `Request failed (${res.status})`);
  return data;
}

/** Upload a File/Blob to /api/files, returns { id, filename, mime_type, byte_size }. */
export async function uploadFile(file, kind = "generic") {
  const form = new FormData();
  form.append("file", file);
  form.append("kind", kind);
  const res = await fetch(`${apiBase()}/api/files`, {
    method: "POST",
    headers: authHeaders(),
    body: form,
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data?.error || "Upload failed");
  return data.file;
}

/** POST a file + extra string fields (multipart) to an authed endpoint. */
export async function apiUpload(path, file, fields = {}) {
  const form = new FormData();
  form.append("file", file);
  Object.entries(fields).forEach(([k, v]) => {
    if (v != null) form.append(k, v);
  });
  const res = await fetch(`${apiBase()}${path}`, {
    method: "POST",
    headers: authHeaders(),
    body: form,
  });
  const text = await res.text();
  const data = text ? JSON.parse(text) : null;
  if (!res.ok) throw new Error(data?.error || `Upload failed (${res.status})`);
  return data;
}

/** Fetch a stored file as an object URL (auth header can't ride on <img src>). */
export async function fetchFileObjectUrl(fileId) {
  if (!fileId) return null;
  const res = await fetch(`${apiBase()}/api/files/${fileId}`, { headers: authHeaders() });
  if (!res.ok) return null;
  const blob = await res.blob();
  return URL.createObjectURL(blob);
}

/** Fetch a stored file as a base64 data URL (for embedding in PDFs). */
export async function fetchFileDataUrl(fileId) {
  if (!fileId) return null;
  const res = await fetch(`${apiBase()}/api/files/${fileId}`, { headers: authHeaders() });
  if (!res.ok) return null;
  const blob = await res.blob();
  return await new Promise((resolve) => {
    const reader = new FileReader();
    reader.onloadend = () => resolve(reader.result);
    reader.onerror = () => resolve(null);
    reader.readAsDataURL(blob);
  });
}
