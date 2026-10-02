"use client";

import { useSyncExternalStore } from "react";

/**
 * Light / dark / system theme, applied as the `dark` class on <html>.
 * The choice is remembered in localStorage; "system" follows the OS setting
 * live. THEME_INIT_SCRIPT applies it before first paint (see app/layout.js).
 */

const KEY = "theme";
const listeners = new Set();

function readPref() {
  try {
    const v = localStorage.getItem(KEY);
    return v === "light" || v === "dark" ? v : "system";
  } catch {
    return "system";
  }
}

function systemDark() {
  return typeof window !== "undefined" && window.matchMedia("(prefers-color-scheme: dark)").matches;
}

function apply(pref) {
  const dark = pref === "dark" || (pref === "system" && systemDark());
  const root = document.documentElement;
  root.classList.toggle("dark", dark);
  root.style.colorScheme = dark ? "dark" : "light";
  document.querySelector('meta[name="theme-color"]')?.setAttribute("content", dark ? "#0c0e12" : "#f5f7fa");
}

let state = null;
function snapshot() {
  if (typeof window === "undefined") return "light|system";
  if (!state) {
    const pref = readPref();
    const dark = pref === "dark" || (pref === "system" && systemDark());
    state = `${dark ? "dark" : "light"}|${pref}`;
    window.matchMedia("(prefers-color-scheme: dark)").addEventListener("change", () => {
      if (readPref() === "system") setTheme("system");
    });
  }
  return state;
}

function subscribe(fn) {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

export function setTheme(pref) {
  try {
    if (pref === "system") localStorage.removeItem(KEY);
    else localStorage.setItem(KEY, pref);
  } catch { /* private mode: still apply for this page */ }
  apply(pref);
  const dark = pref === "dark" || (pref === "system" && systemDark());
  state = `${dark ? "dark" : "light"}|${pref}`;
  listeners.forEach((fn) => fn());
}

/** { resolved: "light" | "dark", preference: "light" | "dark" | "system", setTheme } */
export function useTheme() {
  const snap = useSyncExternalStore(subscribe, snapshot, () => "light|system");
  const [resolved, preference] = snap.split("|");
  return { resolved, preference, setTheme };
}
