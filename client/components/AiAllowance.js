"use client";

import { useCallback, useEffect, useState } from "react";
import { Hourglass, Sparkles } from "lucide-react";
import { apiFetch } from "@/lib/api";

/**
 * A student's daily AI allowance (shared by AI Tutor and Study Planner).
 * `track(usage)` takes the usage returned with each answer; `trackError(err)`
 * takes it from a 429 so the reset timer appears without another request.
 */
export function useAiAllowance() {
  const [usage, setUsage] = useState(null);

  const reload = useCallback(() => {
    apiFetch("/api/ai/student-usage")
      .then((d) => setUsage(d.usage || null))
      .catch(() => {}); // staff opening a student page simply see no allowance bar
  }, []);

  useEffect(() => { reload(); }, [reload]);

  const track = useCallback((u) => { if (u) setUsage(u); }, []);
  const trackError = useCallback((err) => {
    if (err?.status === 429 && err.data?.usage) setUsage(err.data.usage);
  }, []);

  return { usage, reload, track, trackError, exhausted: Boolean(usage && usage.remaining <= 0) };
}

function useCountdown(target, onDone) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    if (!target) return undefined;
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, [target]);
  const ms = target ? new Date(target).getTime() - now : 0;
  useEffect(() => {
    if (target && ms <= 0) onDone?.();
  }, [target, ms <= 0]); // eslint-disable-line react-hooks/exhaustive-deps
  return Math.max(ms, 0);
}

const pad = (n) => String(n).padStart(2, "0");
function formatCountdown(ms) {
  const s = Math.floor(ms / 1000);
  return `${pad(Math.floor(s / 3600))}:${pad(Math.floor((s % 3600) / 60))}:${pad(s % 60)}`;
}

/**
 * Attempts left today as dots, and — once they are used up — a banner with a
 * live countdown to midnight in the school's time zone.
 */
export function AiAllowanceBar({ usage, onReset, className = "" }) {
  const ms = useCountdown(usage?.resets_at, onReset);
  if (!usage) return null;
  const { limit, used, remaining } = usage;

  if (remaining <= 0) {
    return (
      <div className={`flex flex-col gap-3 rounded-2xl border border-amber-200 bg-gradient-to-r from-amber-50 to-orange-50 p-4 sm:flex-row sm:items-center ${className}`}>
        <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-amber-100 text-amber-700">
          <Hourglass className="h-5 w-5" />
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-sm font-semibold text-amber-900">You&apos;ve used all {limit} AI attempts for today</p>
          <p className="text-xs text-amber-800/80">
            Your attempts refill at midnight. Meanwhile, try solving on your own — then check with AI tomorrow!
          </p>
        </div>
        <div className="shrink-0 rounded-xl bg-white/80 px-4 py-2 text-center shadow-sm ring-1 ring-amber-200">
          <p className="text-[10px] font-semibold uppercase tracking-wider text-amber-700">Resets in</p>
          <p className="font-mono text-xl font-bold tabular-nums text-amber-900" aria-live="polite">{formatCountdown(ms)}</p>
        </div>
      </div>
    );
  }

  return (
    <div className={`flex flex-wrap items-center gap-x-3 gap-y-1.5 rounded-2xl border border-zinc-200 bg-white px-4 py-2.5 text-sm shadow-sm ${className}`}>
      <Sparkles className="h-4 w-4 text-violet-500" />
      <span className="font-medium text-zinc-800">
        {remaining} of {limit} AI attempts left today
      </span>
      <span className="flex gap-1" aria-hidden>
        {Array.from({ length: limit }, (_, i) => (
          <span key={i} className={`h-2 w-2 rounded-full ${i < used ? "bg-zinc-200" : "bg-violet-500"}`} />
        ))}
      </span>
      <span className="ml-auto text-xs text-zinc-400" title={`Resets at midnight (${usage.timezone})`}>
        Resets in <span className="font-mono tabular-nums">{formatCountdown(ms)}</span>
      </span>
    </div>
  );
}
