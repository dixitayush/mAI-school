"use client";

import { AnimatePresence, motion } from "framer-motion";
import { Monitor, Moon, Sun } from "lucide-react";
import { useTheme } from "@/lib/theme";

/**
 * `variant="icon"` — one button that flips light ↔ dark (header use).
 * `variant="segmented"` — Light / System / Dark choice (settings, menus).
 */
export default function ThemeToggle({ variant = "icon", block = false, className = "" }) {
  const { resolved, preference, setTheme } = useTheme();

  if (variant === "segmented") {
    const options = [
      ["light", "Light", Sun],
      ["system", "System", Monitor],
      ["dark", "Dark", Moon],
    ];
    return (
      <div role="radiogroup" aria-label="Theme" className={`${block ? "flex w-full" : "inline-flex"} rounded-xl bg-zinc-100 p-1 ${className}`}>
        {options.map(([value, label, Icon]) => {
          const on = preference === value;
          return (
            <button
              key={value}
              role="radio"
              aria-checked={on}
              onClick={() => setTheme(value)}
              className={`relative flex items-center justify-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-medium transition ${block ? "flex-1" : ""} ${on ? "text-zinc-900" : "text-zinc-500 hover:text-zinc-700"}`}
            >
              {on && <motion.span layoutId="theme-pill" className="absolute inset-0 rounded-lg bg-white shadow-sm" transition={{ type: "spring", bounce: 0.2, duration: 0.4 }} />}
              <Icon className="relative h-3.5 w-3.5" />
              <span className="relative">{label}</span>
            </button>
          );
        })}
      </div>
    );
  }

  const dark = resolved === "dark";
  return (
    <button
      type="button"
      onClick={() => setTheme(dark ? "light" : "dark")}
      aria-label={dark ? "Switch to light mode" : "Switch to dark mode"}
      title={dark ? "Light mode" : "Dark mode"}
      className={`relative flex h-10 w-10 items-center justify-center overflow-hidden rounded-xl text-zinc-600 transition hover:bg-zinc-100 hover:text-zinc-900 ${className}`}
    >
      <AnimatePresence mode="wait" initial={false}>
        <motion.span
          key={dark ? "moon" : "sun"}
          initial={{ y: 14, opacity: 0, rotate: -45 }}
          animate={{ y: 0, opacity: 1, rotate: 0 }}
          exit={{ y: -14, opacity: 0, rotate: 45 }}
          transition={{ duration: 0.2 }}
        >
          {dark ? <Moon className="h-5 w-5" /> : <Sun className="h-5 w-5" />}
        </motion.span>
      </AnimatePresence>
    </button>
  );
}
