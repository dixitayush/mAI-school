import { NextResponse } from "next/server";
import {
  institutionSlugFromHostname,
  instituteAppPathNeedsCanonicalPrefix,
  sanitizeTenantSlugParam,
  splitInstitutePrefixedPath,
  tenantApexForHostname,
  tenantAppPath,
  tenantLoginPath,
  TENANT_LOGIN_QUERY_KEY,
} from "@/lib/tenant";

/** Edge middleware can read NEXT_PUBLIC_* ; set this to your API (same as client). */
const API_BASE = process.env.NEXT_PUBLIC_API_URL || "http://127.0.0.1:5001";

function apexOrigin(request) {
  const u = request.nextUrl.clone();
  const h = u.hostname.toLowerCase();
  const root = tenantApexForHostname(h);
  if (h.endsWith(".localhost") && h !== "localhost") {
    u.hostname = "localhost";
    return u.origin;
  }
  if (h !== root && h !== `www.${root}` && h.endsWith(`.${root}`)) {
    u.hostname = root;
    return u.origin;
  }
  return u.origin;
}

function tenantNotFoundHtml(host, mainSiteHref) {
  const safeHost = String(host).replace(/</g, "");
  const safeHref = String(mainSiteHref).replace(/"/g, "&quot;");
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8"/>
  <meta name="viewport" content="width=device-width, initial-scale=1"/>
  <title>Institute not found — mAI-school</title>
  <style>
    * { box-sizing: border-box; }
    body { margin: 0; min-height: 100vh; font-family: ui-sans-serif, system-ui, sans-serif;
      background: radial-gradient(900px 480px at 50% -10%, rgba(111, 163, 113, 0.18), transparent 55%), #f4f4f5;
      color: #18181b; display: flex; align-items: center; justify-content: center; padding: 24px; }
    .card { max-width: 420px; background: #fff; border-radius: 1.25rem; padding: 2rem;
      box-shadow: 0 20px 50px -12px rgba(0,0,0,.12); border: 1px solid #e4e4e7; text-align: center; }
    h1 { margin: 0 0 0.5rem; font-size: 1.35rem; font-weight: 800; letter-spacing: -0.02em; }
    p { margin: 0 0 1.25rem; font-size: 0.9rem; line-height: 1.55; color: #52525b; }
    code { font-size: 0.8rem; background: #f4f4f5; padding: 0.2rem 0.45rem; border-radius: 0.35rem; }
    a { display: inline-block; margin-top: 0.5rem; font-size: 0.875rem; font-weight: 600; color: #4d7c78; }
  </style>
</head>
<body>
  <div class="card">
    <h1>Institute not available</h1>
    <p>This address (<code>${safeHost}</code>) is not linked to an active institute on mAI-school. It may not be onboarded yet or may have been removed.</p>
    <a href="${safeHref}">Go to main site</a>
  </div>
</body>
</html>`;
}

/** Paths anyone can open on a tenant host (marketing + self-serve) without an institute record. */
function isTenantPublicMarketingPath(pathname) {
  if (pathname === "/" || pathname === "") return true;
  if (pathname === "/onboarding" || pathname.startsWith("/onboarding/")) return true;
  return false;
}

async function validateInstituteOrError(slug, host, request) {
  let res;
  try {
    res = await fetch(
      `${API_BASE}/api/public/institution/${encodeURIComponent(slug)}`,
      {
        method: "GET",
        headers: { Accept: "application/json" },
        cache: "no-store",
      }
    );
  } catch {
    return new NextResponse(
      `<!DOCTYPE html><html><head><meta charset="utf-8"/><title>Service unavailable</title></head><body style="font-family:sans-serif;padding:2rem;text-align:center"><h1>Unable to verify institute</h1><p>The app could not reach the server. Try again shortly.</p></body></html>`,
      {
        status: 503,
        headers: { "content-type": "text/html; charset=utf-8" },
      }
    );
  }

  const mainHref = apexOrigin(request);

  if (res.status === 404 || res.status === 403 || !res.ok) {
    return new NextResponse(tenantNotFoundHtml(host, mainHref), {
      status: 404,
      headers: { "content-type": "text/html; charset=utf-8" },
    });
  }
  return null;
}

export async function middleware(request) {
  const host = (request.headers.get("host") || "").split(":")[0];
  const url = request.nextUrl.clone();
  const pathname = url.pathname;
  const slugFromQuery = sanitizeTenantSlugParam(
    url.searchParams.get(TENANT_LOGIN_QUERY_KEY)
  );
  const slugFromHost = institutionSlugFromHostname(host);
  const tenantSlug = slugFromHost || slugFromQuery;

  if (slugFromHost && slugFromQuery && slugFromHost !== slugFromQuery) {
    return new NextResponse(tenantNotFoundHtml(host, apexOrigin(request)), {
      status: 404,
      headers: { "content-type": "text/html; charset=utf-8" },
    });
  }

  const split = splitInstitutePrefixedPath(pathname);
  if (split) {
    if (slugFromHost && split.slug !== slugFromHost) {
      return new NextResponse(tenantNotFoundHtml(host, apexOrigin(request)), {
        status: 404,
        headers: { "content-type": "text/html; charset=utf-8" },
      });
    }
    if (slugFromQuery && split.slug !== slugFromQuery) {
      return new NextResponse(tenantNotFoundHtml(host, apexOrigin(request)), {
        status: 404,
        headers: { "content-type": "text/html; charset=utf-8" },
      });
    }
    const err = await validateInstituteOrError(split.slug, host, request);
    if (err) return err;
    const requestHeaders = new Headers(request.headers);
    requestHeaders.set("x-tenant-slug", split.slug);
    const rewriteUrl = request.nextUrl.clone();
    rewriteUrl.pathname = split.rest;
    return NextResponse.rewrite(rewriteUrl, {
      request: { headers: requestHeaders },
    });
  }

  if (
    tenantSlug &&
    (pathname === "/login" || pathname.startsWith("/login/"))
  ) {
    const dest = request.nextUrl.clone();
    dest.pathname = tenantLoginPath(tenantSlug);
    dest.searchParams.delete(TENANT_LOGIN_QUERY_KEY);
    return NextResponse.redirect(dest);
  }

  if (
    tenantSlug &&
    instituteAppPathNeedsCanonicalPrefix(pathname)
  ) {
    const dest = request.nextUrl.clone();
    dest.pathname = tenantAppPath(tenantSlug, pathname);
    return NextResponse.redirect(dest);
  }

  let headerSlug = "";
  if (tenantSlug) {
    if (isTenantPublicMarketingPath(pathname)) {
      headerSlug = tenantSlug;
    } else {
      const err = await validateInstituteOrError(tenantSlug, host, request);
      if (err) return err;
      headerSlug = tenantSlug;
    }
  }

  const requestHeaders = new Headers(request.headers);
  requestHeaders.set("x-tenant-slug", headerSlug);

  return NextResponse.next({
    request: { headers: requestHeaders },
  });
}

export const config = {
  matcher: [
    "/((?!_next/|favicon.ico|favicon\\.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};
