import { NextResponse } from "next/server";

const ROOT = (process.env.NEXT_PUBLIC_ROOT_DOMAIN || "localhost").split(":")[0];

export function middleware(request) {
  const host = (request.headers.get("host") || "").split(":")[0];
  let slug = "";
  if (host && host !== ROOT && host !== `www.${ROOT}` && host.endsWith(`.${ROOT}`)) {
    const sub = host.slice(0, -(ROOT.length + 1));
    if (sub && sub !== "www") slug = sub.toLowerCase();
  }

  const requestHeaders = new Headers(request.headers);
  requestHeaders.set("x-tenant-slug", slug);

  return NextResponse.next({
    request: { headers: requestHeaders },
  });
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)"],
};
