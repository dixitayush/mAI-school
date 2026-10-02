"use client";

import { ChevronLeft, ChevronRight } from "lucide-react";

/** Page numbers to show around `page`, with "…" gaps: 1 … 4 5 6 … 20. */
export function pageList(page, totalPages) {
  if (totalPages <= 7) return Array.from({ length: totalPages }, (_, i) => i + 1);
  const pages = new Set([1, totalPages, page - 1, page, page + 1]);
  if (page <= 3) [2, 3, 4].forEach((p) => pages.add(p));
  if (page >= totalPages - 2) [totalPages - 3, totalPages - 2, totalPages - 1].forEach((p) => pages.add(p));
  const sorted = [...pages].filter((p) => p >= 1 && p <= totalPages).sort((a, b) => a - b);
  const out = [];
  sorted.forEach((p, i) => {
    if (i > 0 && p - sorted[i - 1] > 1) out.push(`gap-${p}`);
    out.push(p);
  });
  return out;
}

/** Prev · numbered pages · Next. Shared by Pagination and DataTable. */
export function PageButtons({ page, totalPages, onPage }) {
  const navClass =
    "inline-flex h-8 items-center gap-1 rounded-lg px-2.5 text-xs font-medium text-zinc-600 transition hover:bg-zinc-100 hover:text-zinc-900 disabled:pointer-events-none disabled:opacity-40";
  return (
    <nav className="flex items-center gap-1" aria-label="Pagination">
      <button type="button" onClick={() => onPage(page - 1)} disabled={page <= 1} className={navClass}>
        <ChevronLeft className="h-3.5 w-3.5" aria-hidden />
        <span className="hidden xs:inline">Prev</span>
      </button>
      {pageList(page, totalPages).map((p) =>
        typeof p === "string" ? (
          <span key={p} className="px-1 text-xs text-zinc-400" aria-hidden>
            …
          </span>
        ) : (
          <button
            key={p}
            type="button"
            onClick={() => onPage(p)}
            aria-current={p === page ? "page" : undefined}
            className={`h-8 min-w-8 rounded-lg px-2 text-xs font-semibold tabular-nums transition ${
              p === page
                ? "bg-primary-600 text-white shadow-sm shadow-primary-600/30"
                : "text-zinc-600 hover:bg-zinc-100 hover:text-zinc-900"
            }`}
          >
            {p}
          </button>
        )
      )}
      <button type="button" onClick={() => onPage(page + 1)} disabled={page >= totalPages} className={navClass}>
        <span className="hidden xs:inline">Next</span>
        <ChevronRight className="h-3.5 w-3.5" aria-hidden />
      </button>
    </nav>
  );
}

/** Page controls for server-paged lists. Renders nothing for a single page. */
export default function Pagination({ page, totalPages, total, limit, onPage }) {
  if (!totalPages || totalPages <= 1) return null;
  const from = (page - 1) * limit + 1;
  const to = Math.min(page * limit, total);

  return (
    <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
      <p className="text-xs text-zinc-500">
        Showing <span className="font-semibold text-zinc-800">{from}–{to}</span> of{" "}
        <span className="font-semibold text-zinc-800">{total}</span>
      </p>
      <PageButtons page={page} totalPages={totalPages} onPage={onPage} />
    </div>
  );
}
