/**
 * Helpers for the REST API (separate from GraphQL/Apollo). All REST endpoints
 * under /api/* require the same Bearer token as GraphQL.
 */

const DEFAULT_TIMEOUT_MS = Number(process.env.NEXT_PUBLIC_API_TIMEOUT_MS) || 20000;
const UPLOAD_TIMEOUT_MS = Number(process.env.NEXT_PUBLIC_UPLOAD_TIMEOUT_MS) || 60000;

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

function abortSignal(timeoutMs) {
  if (typeof AbortSignal !== "undefined" && typeof AbortSignal.timeout === "function") {
    return AbortSignal.timeout(timeoutMs);
  }
  const ctrl = new AbortController();
  setTimeout(() => ctrl.abort(), timeoutMs);
  return ctrl.signal;
}

function errorFromResponse(res, data) {
  if (res.status === 429) {
    const retry = res.headers.get("Retry-After");
    const base = data?.error || "Too many requests. Please slow down.";
    return new Error(retry ? `${base} Retry after ${retry}s.` : base);
  }
  return new Error(data?.error || `Request failed (${res.status})`);
}

/** JSON fetch with auth + timeout. Throws on non-2xx with the server's error message. */
export async function apiFetch(path, { method = "GET", body, headers, timeoutMs = DEFAULT_TIMEOUT_MS } = {}) {
  let res;
  try {
    res = await fetch(`${apiBase()}${path}`, {
      method,
      headers: authHeaders({ "Content-Type": "application/json", ...(headers || {}) }),
      body: body ? JSON.stringify(body) : undefined,
      signal: abortSignal(timeoutMs),
    });
  } catch (err) {
    if (err?.name === "TimeoutError" || err?.name === "AbortError") {
      throw new Error("Request timed out. Please try again.");
    }
    throw err;
  }
  const text = await res.text();
  const data = text ? JSON.parse(text) : null;
  if (!res.ok) throw errorFromResponse(res, data);
  return data;
}

/** Upload a File/Blob to /api/files, returns { id, filename, mime_type, byte_size }. */
export async function uploadFile(file, kind = "generic") {
  const form = new FormData();
  form.append("file", file);
  form.append("kind", kind);
  let res;
  try {
    res = await fetch(`${apiBase()}/api/files`, {
      method: "POST",
      headers: authHeaders(),
      body: form,
      signal: abortSignal(UPLOAD_TIMEOUT_MS),
    });
  } catch (err) {
    if (err?.name === "TimeoutError" || err?.name === "AbortError") {
      throw new Error("Upload timed out. Please try again.");
    }
    throw err;
  }
  const data = await res.json();
  if (!res.ok) throw errorFromResponse(res, data);
  return data.file;
}

/** POST a file + extra string fields (multipart) to an authed endpoint. */
export async function apiUpload(path, file, fields = {}) {
  const form = new FormData();
  form.append("file", file);
  Object.entries(fields).forEach(([k, v]) => {
    if (v != null) form.append(k, v);
  });
  let res;
  try {
    res = await fetch(`${apiBase()}${path}`, {
      method: "POST",
      headers: authHeaders(),
      body: form,
      signal: abortSignal(UPLOAD_TIMEOUT_MS),
    });
  } catch (err) {
    if (err?.name === "TimeoutError" || err?.name === "AbortError") {
      throw new Error("Upload timed out. Please try again.");
    }
    throw err;
  }
  const text = await res.text();
  const data = text ? JSON.parse(text) : null;
  if (!res.ok) throw errorFromResponse(res, data);
  return data;
}

/** Fetch a stored file as an object URL (auth header can't ride on <img src>). */
export async function fetchFileObjectUrl(fileId) {
  if (!fileId) return null;
  try {
    const res = await fetch(`${apiBase()}/api/files/${fileId}`, {
      headers: authHeaders(),
      signal: abortSignal(DEFAULT_TIMEOUT_MS),
    });
    if (!res.ok) return null;
    const blob = await res.blob();
    return URL.createObjectURL(blob);
  } catch {
    return null;
  }
}

/** Fetch a stored file as a base64 data URL (for embedding in PDFs). */
export async function fetchFileDataUrl(fileId) {
  if (!fileId) return null;
  try {
    const res = await fetch(`${apiBase()}/api/files/${fileId}`, {
      headers: authHeaders(),
      signal: abortSignal(DEFAULT_TIMEOUT_MS),
    });
    if (!res.ok) return null;
    const blob = await res.blob();
    return await new Promise((resolve) => {
      const reader = new FileReader();
      reader.onloadend = () => resolve(reader.result);
      reader.onerror = () => resolve(null);
      reader.readAsDataURL(blob);
    });
  } catch {
    return null;
  }
}
