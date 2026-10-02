"use client";

import { useState } from "react";
import { Copy, Check } from "lucide-react";

/**
 * A student's registration id (e.g. DEMO260001) — the one identifier shown for
 * a student on every screen, report card and export. The uuid stays internal.
 *
 * `plain` renders bare text for dense inline spots (a subtitle under a name);
 * the default is a copyable monospace badge.
 */
export default function StudentId({ value, plain = false, className = "" }) {
  const [copied, setCopied] = useState(false);
  if (!value) return <span className="text-zinc-400">—</span>;

  if (plain) {
    return <span className={`font-mono tracking-wide ${className}`}>{value}</span>;
  }

  const copy = async (e) => {
    e.stopPropagation();
    try {
      await navigator.clipboard.writeText(String(value));
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      // Clipboard is unavailable over plain http on some hosts; the id is
      // already fully visible, so there is nothing to fall back to.
    }
  };

  return (
    <button
      type="button"
      onClick={copy}
      title={`Registration ID ${value} (click to copy)`}
      aria-label={`Copy registration ID ${value}`}
      className={`group inline-flex items-center gap-1 rounded-md bg-indigo-50 px-1.5 py-0.5 font-mono text-xs font-semibold tracking-wide text-indigo-700 transition hover:bg-indigo-100 ${className}`}
    >
      {value}
      {copied ? (
        <Check className="h-3 w-3 text-green-600" />
      ) : (
        <Copy className="h-3 w-3 opacity-0 transition group-hover:opacity-60" />
      )}
    </button>
  );
}
