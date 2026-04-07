/**
 * Multi-tenant helpers: subdomain detection and persisted institution from login.
 */

/** Query key for institute login on apex hosts (Netlify/Vercel/Render have no TLS for `slug.apex`). */
export const TENANT_LOGIN_QUERY_KEY = "i";

/** Path prefix so institute is visible on every URL: `/i/{slug}/login`, `/i/{slug}/admin`, … */
export const INSTITUTE_PATH_SEGMENT = "i";

export function getRootDomain() {
  return (process.env.NEXT_PUBLIC_ROOT_DOMAIN || "localhost").split(":")[0];
}

/** Slug from `?i=` (or empty). */
export function sanitizeTenantSlugParam(raw) {
  if (raw == null || typeof raw !== "string") return "";
  const s = raw.trim().toLowerCase();
  if (s.length === 0 || s.length > 64) return "";
  if (!/^[a-z0-9][a-z0-9-]*$/.test(s)) return "";
  return s;
}

/**
 * Hosted platforms only provision TLS for the primary hostname, not `tenant.*.netlify.app`.
 * Use apex `/login?i=slug` instead of subdomain links.
 */
export function tenantLoginUsesQueryForApex(apexHostname) {
  if (process.env.NEXT_PUBLIC_TENANT_LOGIN_SUBDOMAIN === "1") return false;
  if (!apexHostname) return false;
  const h = apexHostname.toLowerCase();
  if (h === "localhost" || h === "127.0.0.1") return false;
  return (
    h.endsWith(".netlify.app") ||
    h.endsWith(".vercel.app") ||
    h.endsWith(".onrender.com")
  );
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

/**
 * Slug from pathname `/i/{slug}/…` (canonical institute URLs).
 */
export function parseSlugFromInstitutePath(pathname) {
  if (!pathname || typeof pathname !== "string") return "";
  const m = pathname.match(
    new RegExp(
      `^\\/${INSTITUTE_PATH_SEGMENT}\\/([a-z0-9][a-z0-9-]*)(?:\\/|$)`,
      "i"
    )
  );
  return m ? m[1].toLowerCase() : "";
}

/**
 * `/i/slug/rest` → `{ slug, rest: "/rest" }` or `null`. Empty rest becomes `/login`.
 */
export function splitInstitutePrefixedPath(pathname) {
  if (!pathname) return null;
  const m = pathname.match(
    new RegExp(
      `^\\/${INSTITUTE_PATH_SEGMENT}\\/([a-z0-9][a-z0-9-]*)(\\/.*)?$`,
      "i"
    )
  );
  if (!m) return null;
  const slug = m[1].toLowerCase();
  let rest = m[2];
  if (!rest || rest === "" || rest === "/") rest = "/login";
  return { slug, rest };
}

export function tenantLoginPath(slug) {
  if (!slug) return "/login";
  return `/${INSTITUTE_PATH_SEGMENT}/${slug}/login`;
}

/**
 * Path under an institute, e.g. `/admin` → `/i/slug/admin`. Empty slug returns `path` unchanged.
 */
export function tenantAppPath(slug, path) {
  const p = path.startsWith("/") ? path : `/${path}`;
  if (!slug) return p;
  return `/${INSTITUTE_PATH_SEGMENT}/${slug}${p}`;
}

/** Dashboard routes that should be prefixed when the user is on a tenant host. */
export function instituteAppPathNeedsCanonicalPrefix(pathname) {
  if (!pathname || pathname === "/") return false;
  const prefixes = [
    "/admin",
    "/teacher",
    "/principal",
    "/student",
    "/exams",
    "/profile",
  ];
  return prefixes.some(
    (prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`)
  );
}

/**
 * Resolve tenant slug: `/i/slug` in pathname, then subdomain, then `?i=` on apex.
 */
export function resolveTenantSlugForLogin(hostname, searchString, pathname) {
  const fromPath = pathname ? parseSlugFromInstitutePath(pathname) : "";
  if (fromPath) return fromPath;
  const fromHost = institutionSlugFromHostname(hostname);
  if (fromHost) return fromHost;
  const q = new URLSearchParams(searchString || "").get(TENANT_LOGIN_QUERY_KEY);
  return sanitizeTenantSlugParam(q);
}

/**
 * Where to send the user to sign in (platform `/login` vs `/i/{slug}/login`).
 */
export function resolveSignInPath() {
  if (typeof window === "undefined") return "/login";
  const fromPath = parseSlugFromInstitutePath(window.location.pathname);
  if (fromPath) return tenantLoginPath(fromPath);
  const fromCtx = resolveTenantSlugForLogin(
    window.location.hostname,
    window.location.search,
    window.location.pathname
  );
  if (fromCtx) return tenantLoginPath(fromCtx);
  try {
    const inst = getInstitutionFromStorage();
    if (inst?.slug) return tenantLoginPath(inst.slug);
  } catch {
    /* ignore */
  }
  return "/login";
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
 * Full URL for an institute admin / tenant login page.
 * - Local dev: `http://{slug}.localhost:port/login`
 * - Netlify / Vercel / Render apex: `https://apex/login?i={slug}` (subdomains are not TLS-valid there)
 * - Custom domain with wildcard TLS: `https://{slug}.apex/login` when apex is not a platform default host
 * - Optional `NEXT_PUBLIC_INSTITUTE_LOGIN_BASE_URL`: base origin (same rules as above)
 */
export function instituteLoginPageUrl(slug) {
  if (!slug) return "";
  const path = tenantLoginPath(slug);
  const base = process.env.NEXT_PUBLIC_INSTITUTE_LOGIN_BASE_URL?.trim();
  if (base) {
    try {
      const u = new URL(base.replace(/\/$/, ""));
      if (tenantLoginUsesQueryForApex(u.hostname)) {
        return `${u.origin}${path}`;
      }
      const host = `${slug}.${u.hostname}`;
      const port = u.port ? `:${u.port}` : "";
      return `${u.protocol}//${host}${port}${path}`;
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
      return `http://${slug}.localhost${p}${path}`;
    }
    if (tenantLoginUsesQueryForApex(apex)) {
      const p =
        port && port !== "" && port !== "80" && port !== "443"
          ? `:${port}`
          : "";
      return `${protocol}//${apex}${p}${path}`;
    }
    const p =
      port && port !== "" && port !== "80" && port !== "443"
        ? `:${port}`
        : "";
    return `${protocol}//${slug}.${apex}${p}${path}`;
  }
  if (apex === "localhost" || apex === "127.0.0.1") {
    const portRaw =
      process.env.NEXT_PUBLIC_INSTITUTE_LOGIN_PORT ||
      process.env.NEXT_PUBLIC_PORT ||
      "3000";
    const portNum = String(portRaw).replace(/^:/, "");
    const portPart = portNum ? `:${portNum}` : "";
    return `http://${slug}.localhost${portPart}${path}`;
  }
  if (tenantLoginUsesQueryForApex(apex)) {
    const proto = process.env.NEXT_PUBLIC_INSTITUTE_LOGIN_PROTOCOL || "https:";
    const normProto = proto.endsWith(":") ? proto : `${proto}:`;
    const portEnv = process.env.NEXT_PUBLIC_INSTITUTE_LOGIN_PORT;
    const p =
      portEnv && String(portEnv).length > 0
        ? String(portEnv).startsWith(":")
          ? portEnv
          : `:${portEnv}`
        : "";
    return `${normProto}//${apex}${p}${path}`;
  }
  const proto = process.env.NEXT_PUBLIC_INSTITUTE_LOGIN_PROTOCOL || "https:";
  const normProto = proto.endsWith(":") ? proto : `${proto}:`;
  const portEnv = process.env.NEXT_PUBLIC_INSTITUTE_LOGIN_PORT;
  const p =
    portEnv && String(portEnv).length > 0
      ? String(portEnv).startsWith(":")
        ? portEnv
        : `:${portEnv}`
      : "";
  return `${normProto}//${slug}.${apex}${p}${path}`;
}
