"use client";

import { useState } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import remarkMath from "remark-math";
import remarkBreaks from "remark-breaks";
import rehypeKatex from "rehype-katex";
import { Check, Copy } from "lucide-react";
import "katex/dist/katex.min.css";

/**
 * Normalise model output before parsing:
 * - unwrap a reply fenced as a whole in ```markdown … ```;
 * - LaTeX \( … \) and \[ … \] delimiters → $ … $ and $$ … $$, which is what
 *   remark-math understands (models use both styles).
 */
export function normalizeMarkdown(text) {
  let s = String(text ?? "").trim();
  const fenced = /^```(?:markdown|md)?\s*\n([\s\S]*?)\n```$/i.exec(s);
  if (fenced) s = fenced[1];
  return s
    .replace(/\\\[([\s\S]*?)\\\]/g, (_, m) => `\n$$\n${m.trim()}\n$$\n`)
    .replace(/\\\((.+?)\\\)/g, (_, m) => `$${m.trim()}$`);
}

function CodeBlock({ children, className }) {
  const [copied, setCopied] = useState(false);
  const code = String(children).replace(/\n$/, "");
  const lang = /language-(\w+)/.exec(className || "")?.[1];
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(code);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch { /* clipboard unavailable over plain http */ }
  };
  return (
    <div className="group relative my-4 overflow-hidden rounded-xl border border-zinc-200 bg-zinc-950">
      <div className="flex items-center justify-between border-b border-zinc-800 px-3 py-1.5">
        <span className="font-mono text-[11px] uppercase tracking-wide text-zinc-400">{lang || "text"}</span>
        <button type="button" onClick={copy} className="flex items-center gap-1 text-[11px] text-zinc-400 hover:text-white">
          {copied ? <Check className="h-3 w-3" /> : <Copy className="h-3 w-3" />} {copied ? "Copied" : "Copy"}
        </button>
      </div>
      <pre className="overflow-x-auto p-4 text-[13px] leading-relaxed text-zinc-100"><code>{code}</code></pre>
    </div>
  );
}

/** Element styles — the app has no typography plugin, so every tag is styled here. */
function components(compact) {
  const gap = compact ? "my-1.5" : "my-3";
  return {
    h1: (p) => <h1 className={`${compact ? "mt-2 text-base" : "mt-6 text-2xl"} mb-3 font-bold tracking-tight text-zinc-900 first:mt-0`} {...p} />,
    h2: (p) => <h2 className={`${compact ? "mt-2 text-[15px]" : "mt-7 border-b border-zinc-100 pb-2 text-xl"} mb-3 font-semibold text-zinc-900 first:mt-0`} {...p} />,
    h3: (p) => <h3 className={`${compact ? "mt-2 text-sm" : "mt-5 text-base"} mb-2 font-semibold text-zinc-900 first:mt-0`} {...p} />,
    h4: (p) => <h4 className="mb-1.5 mt-4 text-sm font-semibold uppercase tracking-wide text-zinc-600 first:mt-0" {...p} />,
    p: (p) => <p className={`${gap} leading-relaxed first:mt-0 last:mb-0`} {...p} />,
    ul: (p) => <ul className={`${gap} list-disc space-y-1 pl-5 marker:text-primary-500`} {...p} />,
    // Lists nested under a numbered item are MCQ options or answer-key notes
    // ("(a) …"), which read better without a second set of bullets.
    ol: (p) => <ol className={`${gap} list-decimal space-y-1.5 pl-5 marker:font-semibold marker:text-primary-700 [&_ul]:my-1 [&_ul]:list-none [&_ul]:space-y-0.5 [&_ul]:pl-1`} {...p} />,
    li: ({ className, ...p }) => (
      <li className={`pl-1 leading-relaxed ${className?.includes("task-list-item") ? "list-none -ml-5" : ""}`} {...p} />
    ),
    input: (p) => <input {...p} disabled className="mr-2 h-3.5 w-3.5 translate-y-0.5 accent-primary-600" />,
    strong: (p) => <strong className="font-semibold text-zinc-900" {...p} />,
    em: (p) => <em className="italic" {...p} />,
    a: ({ href, ...p }) => (
      <a href={href} target="_blank" rel="noopener noreferrer" className="font-medium text-primary-700 underline decoration-primary-300 underline-offset-2 hover:decoration-primary-600" {...p} />
    ),
    blockquote: (p) => (
      <blockquote className={`${gap} rounded-r-xl border-l-4 border-primary-400 bg-primary-50/60 px-4 py-2.5 text-zinc-700 [&>p]:my-1`} {...p} />
    ),
    hr: () => <hr className="my-6 border-zinc-200" />,
    table: (p) => (
      <div className={`${gap} overflow-x-auto rounded-xl border border-zinc-200`}>
        <table className="w-full border-collapse text-sm" {...p} />
      </div>
    ),
    thead: (p) => <thead className="bg-zinc-50" {...p} />,
    th: (p) => <th className="border-b border-zinc-200 px-3 py-2 text-left text-xs font-semibold uppercase tracking-wide text-zinc-600" {...p} />,
    td: (p) => <td className="border-b border-zinc-100 px-3 py-2 align-top" {...p} />,
    pre: ({ children }) => children,
    code: ({ className, children, ...p }) => {
      const block = /language-/.test(className || "") || String(children).includes("\n");
      if (block) return <CodeBlock className={className}>{children}</CodeBlock>;
      return <code className="rounded bg-zinc-100 px-1.5 py-0.5 font-mono text-[0.85em] text-pink-700" {...p}>{children}</code>;
    },
  };
}

/**
 * Renders AI (or any) Markdown: headings, lists, task lists, tables, quotes,
 * code, and LaTeX math ($…$, $$…$$, \(…\), \[…\]). Raw HTML is not rendered.
 * `compact` tightens spacing for chat bubbles.
 */
export default function Markdown({ children, compact = false, className = "" }) {
  return (
    <div className={`min-w-0 break-words text-zinc-700 ${compact ? "text-sm" : "text-[15px]"} [&_.katex-display]:my-4 [&_.katex-display]:overflow-x-auto [&_.katex-display]:overflow-y-hidden [&_.katex-display]:py-1 ${className}`}>
      <ReactMarkdown
        // remark-breaks: models put one item per line (equations, steps) without
        // blank lines between them, which plain Markdown would join into one line.
        remarkPlugins={[remarkGfm, remarkBreaks, [remarkMath, { singleDollarTextMath: true }]]}
        rehypePlugins={[[rehypeKatex, { throwOnError: false, strict: false }]]}
        components={components(compact)}
      >
        {normalizeMarkdown(children)}
      </ReactMarkdown>
    </div>
  );
}
