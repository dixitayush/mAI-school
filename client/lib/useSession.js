"use client";

import { useEffect, useSyncExternalStore } from "react";
import { useRouter } from "next/navigation";
import { resolveSignInPath } from "@/lib/tenant";

const EMPTY = Object.freeze({ user: null, role: null });

let cacheKey = "";
let cacheVal = EMPTY;

function readSession() {
  try {
    const raw = localStorage.getItem("user");
    const role = localStorage.getItem("role") || null;
    const key = `${raw ?? ""}\0${role ?? ""}`;
    if (key !== cacheKey) {
      cacheKey = key;
      cacheVal = Object.freeze({
        user: raw ? JSON.parse(raw) : null,
        role,
      });
    }
    return cacheVal;
  } catch {
    return EMPTY;
  }
}

function subscribe(onStoreChange) {
  const handler = () => {
    cacheKey = "";
    onStoreChange();
  };
  window.addEventListener("storage", handler);
  window.addEventListener("mai-session", handler);
  return () => {
    window.removeEventListener("storage", handler);
    window.removeEventListener("mai-session", handler);
  };
}

/** Notify listeners after login/logout updates localStorage in this tab. */
export function notifySessionChanged() {
  if (typeof window !== "undefined") {
    cacheKey = "";
    window.dispatchEvent(new Event("mai-session"));
  }
}

/** Sync session from localStorage (client) without waiting for useEffect. */
export function useSession() {
  return useSyncExternalStore(subscribe, readSession, () => EMPTY);
}

/**
 * Require one of the given roles. Redirects if missing/invalid.
 * Returns session immediately on the client so queries can start without a blank gate.
 */
export function useRequireRole(allowed) {
  const router = useRouter();
  const session = useSession();
  const rolesKey = Array.isArray(allowed) ? allowed.join("|") : String(allowed);
  const roles = rolesKey.split("|");
  const ok = Boolean(session.user && roles.includes(session.role));

  useEffect(() => {
    // Read directly in the effect so we never redirect from the SSR empty snapshot.
    const current = readSession();
    if (!current.user || !roles.includes(current.role)) {
      router.replace(resolveSignInPath());
    }
  }, [router, rolesKey]);

  return { ...session, ready: ok };
}
