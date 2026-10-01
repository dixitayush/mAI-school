"use client";

import { useState } from "react";
import { Copy, Check } from "lucide-react";

/**
 * A record's uuid, shown short enough to scan but copyable in full.
 *
 * Admins and teachers need the real id to cross-reference exports, imports and
 * support requests, but a full uuid in every table row is unreadable — so the
 * first segment is shown with the full value on hover and one click to copy.
 */
export default function Uuid({ value, label = "ID", className = "" }) {
  const [copied, setCopied] = useState(false);
  if (!value) return <span className="text-zinc-400">—</span>;

  const short = String(value).split("-")[0];

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(String(value));
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      // Clipboard is unavailable over plain http on some hosts; the title
      // attribute still exposes the full value for manual selection.
    }
  };

  return (
    <button
      type="button"
      onClick={copy}
      title={`${label}: ${value} (click to copy)`}
      aria-label={`Copy ${label} ${value}`}
      className={`group inline-flex items-center gap-1 rounded-md bg-zinc-100 px-1.5 py-0.5 font-mono text-[11px] text-zinc-600 transition hover:bg-zinc-200 ${className}`}
    >
      {short}…
      {copied ? (
        <Check className="h-3 w-3 text-green-600" />
      ) : (
        <Copy className="h-3 w-3 opacity-0 transition group-hover:opacity-60" />
      )}
    </button>
  );
}
