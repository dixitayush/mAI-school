/**
 * Multi-tenant helpers: subdomain detection and persisted institution from login.
 */

export function getRootDomain() {
  return (process.env.NEXT_PUBLIC_ROOT_DOMAIN || "localhost").split(":")[0];
}

/**
 * Apex hostname for tenant subdomains when `NEXT_PUBLIC_ROOT_DOMAIN` is unset (defaults to localhost).
 * - `tenant.mai-school.netlify.app` → `mai-school.netlify.app`
 * - `mai-school.netlify.app` → `mai-school.netlify.app`
 * - `tenant.example.com` → `example.com`
 * - `demo.localhost` / dev → `localhost`
 */
export function inferApexFromHost(hostname) {
  if (!hostname) return null;
  const h = hostname.toLowerCase();
  if (h === "localhost" || h === "127.0.0.1") return h;
  if (h.endsWith(".localhost") && h !== "localhost") return "localhost";

  let parts = h.split(".");
  while (parts[0] === "www" && parts.length > 1) parts = parts.slice(1);
  const len = parts.length;
  if (len <= 2) return h;

  const multiLevelPlatform =
    len >= 3 &&
    ((parts[len - 2] === "netlify" && parts[len - 1] === "app") ||
      (parts[len - 2] === "vercel" && parts[len - 1] === "app") ||
      (parts[len - 2] === "onrender" && parts[len - 1] === "com"));

  if (multiLevelPlatform) {
    if (len <= 3) return parts.join(".");
    return parts.slice(1).join(".");
  }

  if (len === 3) return parts.slice(1).join(".");
  return parts.slice(1).join(".");
}

/** Apex used for `slug.<apex>` when resolving tenants and login URLs. */
export function tenantApexForHostname(hostname) {
  const configured = getRootDomain();
  if (configured !== "localhost" && configured !== "127.0.0.1") {
    return configured;
  }
  return inferApexFromHost(hostname) || configured;
}

function tenantApexForSsr() {
  const configured = getRootDomain();
  if (configured !== "localhost" && configured !== "127.0.0.1") {
    return configured;
  }
  const deployUrl =
    process.env.URL ||
    process.env.DEPLOY_PRIME_URL ||
    process.env.DEPLOY_URL ||
    process.env.NEXT_PUBLIC_SITE_URL ||
    process.env.NEXT_PUBLIC_DEPLOY_URL;
  if (!deployUrl) return configured;
  try {
    const h = new URL(deployUrl).hostname;
    return inferApexFromHost(h) || configured;
  } catch {
    return configured;
  }
}

/**
 * Empty string = MAI / platform login host (apex). Non-empty = tenant subdomain slug.
 * - Apex: `school.com`, `www.school.com`, `localhost`, `127.0.0.1`
 * - Tenant: `greenfield.school.com`, `demo.localhost` (dev)
 */
export function institutionSlugFromHostname(hostname) {
  if (!hostname) return "";
  const root = tenantApexForHostname(hostname);
  const h = hostname.toLowerCase();
  if (h === root || h === `www.${root}`) return "";
  if (h.endsWith(`.${root}`)) {
    const sub = hostname.slice(0, -(root.length + 1));
    return sub === "www" ? "" : sub.toLowerCase();
  }
  // Dev: `demo.localhost` → slug `demo` (MAI platform uses bare `localhost` only)
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
 * - Otherwise uses tenant apex from `NEXT_PUBLIC_ROOT_DOMAIN`, the current browser host, or deploy URL
 *   (Netlify `URL` / `DEPLOY_PRIME_URL`) so production links are not `*.localhost` when env is unset.
 */
export function instituteLoginPageUrl(slug) {
  if (!slug) return "";
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
  const apex =
    typeof window !== "undefined"
      ? tenantApexForHostname(window.location.hostname)
      : tenantApexForSsr();
  if (typeof window !== "undefined") {
    const { protocol, port } = window.location;
    if (apex === "localhost" || apex === "127.0.0.1") {
      const p = port ? `:${port}` : "";
      return `http://${slug}.localhost${p}/login`;
    }
    const p =
      port && port !== "" && port !== "80" && port !== "443"
        ? `:${port}`
        : "";
    return `${protocol}//${slug}.${apex}${p}/login`;
  }
  if (apex === "localhost" || apex === "127.0.0.1") {
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
  return `${proto}//${slug}.${apex}${p}/login`;
}
