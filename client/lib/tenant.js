/**
 * Multi-tenant helpers: subdomain detection and persisted institution from login.
 */

export function getRootDomain() {
  return (process.env.NEXT_PUBLIC_ROOT_DOMAIN || "localhost").split(":")[0];
}

/**
 * Empty string = MAI / platform login host (apex). Non-empty = tenant subdomain slug.
 * - Apex: `school.com`, `www.school.com`, `localhost`, `127.0.0.1`
 * - Tenant: `greenfield.school.com`, `demo.localhost` (dev)
 */
export function institutionSlugFromHostname(hostname) {
  if (!hostname) return "";
  const root = getRootDomain();
  if (hostname === root || hostname === `www.${root}`) return "";
  if (hostname.endsWith(`.${root}`)) {
    const sub = hostname.slice(0, -(root.length + 1));
    return sub === "www" ? "" : sub.toLowerCase();
  }
  // Dev: `demo.localhost` → slug `demo` (MAI platform uses bare `localhost` only)
  const h = hostname.toLowerCase();
  if (h.endsWith(".localhost") && h !== "localhost") {
    const sub = h.slice(0, -".localhost".length);
    return sub === "www" ? "" : sub;
  }
  if (h === "127.0.0.1") return "";
  return "";
}

export function getInstitutionFromStorage() {
  if (typeof window === "undefined") return null;
  try {
    const raw = localStorage.getItem("institution");
    if (!raw || raw === "null") return null;
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

export function getInstitutionIdFromStorage() {
  const inst = getInstitutionFromStorage();
  return inst?.id ?? null;
}

/**
 * Full URL for an institute admin / tenant login page (`/login` on the institute subdomain).
 * - Optional `NEXT_PUBLIC_INSTITUTE_LOGIN_BASE_URL`: apex origin for tenant links, e.g. `https://school.com`
 *   (builds `https://{slug}.school.com/login`). Use when the MAI dashboard is hosted on a different host
 *   than tenant subdomains.
 * - Otherwise uses `NEXT_PUBLIC_ROOT_DOMAIN` and, in the browser, current protocol/port; dev uses `*.localhost`.
 */
export function instituteLoginPageUrl(slug) {
  if (!slug) return "";
  const root = getRootDomain();
  const base = process.env.NEXT_PUBLIC_INSTITUTE_LOGIN_BASE_URL?.trim();
  if (base) {
    try {
      const u = new URL(base.replace(/\/$/, ""));
      const host = `${slug}.${u.hostname}`;
      const port = u.port ? `:${u.port}` : "";
      return `${u.protocol}//${host}${port}/login`;
    } catch {
      /* fall through */
    }
  }
  if (typeof window !== "undefined") {
    const { protocol, port } = window.location;
    if (root === "localhost" || root === "127.0.0.1") {
      const p = port ? `:${port}` : "";
      return `http://${slug}.localhost${p}/login`;
    }
    const p =
      port && port !== "" && port !== "80" && port !== "443"
        ? `:${port}`
        : "";
    return `${protocol}//${slug}.${root}${p}/login`;
  }
  if (root === "localhost" || root === "127.0.0.1") {
    const portRaw =
      process.env.NEXT_PUBLIC_INSTITUTE_LOGIN_PORT ||
      process.env.NEXT_PUBLIC_PORT ||
      "3000";
    const portNum = String(portRaw).replace(/^:/, "");
    const portPart = portNum ? `:${portNum}` : "";
    return `http://${slug}.localhost${portPart}/login`;
  }
  const proto = process.env.NEXT_PUBLIC_INSTITUTE_LOGIN_PROTOCOL || "https:";
  const portEnv = process.env.NEXT_PUBLIC_INSTITUTE_LOGIN_PORT;
  const p =
    portEnv && String(portEnv).length > 0
      ? String(portEnv).startsWith(":")
        ? portEnv
        : `:${portEnv}`
      : "";
  return `${proto}//${slug}.${root}${p}/login`;
}
