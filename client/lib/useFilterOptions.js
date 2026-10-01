"use client";

import { useEffect, useState } from "react";
import { apiFetch } from "@/lib/api";

const EMPTY = {
  sessions: [],
  current_session_id: null,
  classes: [],
  sections: [],
  exams: [],
  grade_levels: [],
  lifecycle_statuses: [],
};

// The option lists change rarely and several screens mount filter bars at once,
// so the first fetch is shared process-wide rather than repeated per component.
let cache = null;
let inflight = null;

export function invalidateFilterOptions() {
  cache = null;
  inflight = null;
}

/**
 * Session / class / section / exam option lists for the filter bars, loaded once
 * and shared. Returns `EMPTY` shaped data while loading so callers can map over
 * the lists without guarding every one.
 */
export function useFilterOptions() {
  // Seeded from the module cache, so a second filter bar renders populated on
  // its first pass rather than setting state from inside an effect.
  const [options, setOptions] = useState(() => cache || EMPTY);
  const [loading, setLoading] = useState(() => !cache);

  useEffect(() => {
    if (cache) return undefined;
    let alive = true;
    if (!inflight) {
      inflight = apiFetch("/api/academics/filter-options")
        .then((data) => {
          cache = { ...EMPTY, ...data };
          return cache;
        })
        .catch((err) => {
          // A filter bar must not break the page it sits on.
          inflight = null;
          console.error("Failed to load filter options:", err.message);
          return EMPTY;
        });
    }
    inflight.then((data) => {
      if (!alive) return;
      setOptions(data);
      setLoading(false);
    });
    return () => { alive = false; };
  }, []);

  return { options, loading };
}

/** Build a querystring from a filter object, dropping empty values. */
export function toQuery(filters) {
  const params = new URLSearchParams();
  for (const [k, v] of Object.entries(filters || {})) {
    if (v === undefined || v === null || v === "") continue;
    params.set(k, String(v));
  }
  const s = params.toString();
  return s ? `?${s}` : "";
}
