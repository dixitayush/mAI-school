/** @type {import('tailwindcss').Config} */
const plugin = require("tailwindcss/plugin");
const twColors = require("tailwindcss/colors");

/*
 * Light / dark theming without touching every page.
 *
 * Pages are written with plain palette classes (bg-white, text-zinc-900,
 * border-zinc-200, bg-red-50 …). Each colour utility family below reads a CSS
 * variable instead of a fixed hex, and `.dark` on <html> swaps those variables
 * — per family, because a colour means different things in different places:
 *
 *   background  white/zinc light shades → dark surfaces; light tints of a hue
 *               (50–300) → a muted dark tint of that hue; strong shades stay.
 *   text        dark greys → light greys; dark shades of a hue (500–950) → the
 *               light end of the hue, so text-red-700 stays readable.
 *   border      light greys and tints → dark hairlines.
 *
 * Strong fills such as bg-primary-600 and text-white are deliberately left
 * alone, so buttons keep their colour in both themes.
 */

const SHADES = ["50", "100", "200", "300", "400", "500", "600", "700", "800", "900", "950"];
const HUES = [
  "slate", "gray", "neutral", "stone", "red", "orange", "amber", "yellow", "lime", "green", "emerald",
  "teal", "cyan", "sky", "blue", "indigo", "violet", "purple", "fuchsia", "pink", "rose",
];

// Brand palette (kept in sync with --primary-* in globals.css).
const PRIMARY = {
  50: "#f0fdf4", 100: "#dcfce7", 200: "#bbf7d0", 300: "#86efac", 400: "#4ade80", 500: "#88B38A",
  600: "#6FA371", 700: "#4d7c78", 800: "#166534", 900: "#14532d", 950: "#0b2e1a",
};

const palette = { primary: PRIMARY };
for (const h of HUES) palette[h] = twColors[h];
const ZINC = twColors.zinc;

// Dark-theme surfaces.
const SURFACE = "#14161b"; // cards (bg-white)
const PAGE = "#0c0e12"; // page background

const hexToRgb = (hex) => {
  const h = hex.replace("#", "");
  const n = parseInt(h.length === 3 ? h.split("").map((c) => c + c).join("") : h, 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
};
const rgb = (hex) => hexToRgb(hex).join(" ");
/** `amount` of `hex` laid over the dark surface. */
const tint = (hex, amount) => {
  const a = hexToRgb(hex);
  const b = hexToRgb(SURFACE);
  return a.map((v, i) => Math.round(v * amount + b[i] * (1 - amount))).join(" ");
};

// Dark greys, per family (zinc is the app's neutral; the other greys follow it).
const DARK_ZINC = {
  bg: { 50: "#1b1e24", 100: "#22252c", 200: "#2b2f37", 300: "#3a3f49", 400: "#52525b", 500: "#71717a", 600: "#5b606b", 700: "#4b5160", 800: "#3d424d", 900: "#353a44", 950: "#2a2e36" },
  fg: { 50: "#18181b", 100: "#27272a", 200: "#3f3f46", 300: "#565660", 400: "#7c7c86", 500: "#8f8f99", 600: "#a8a8b1", 700: "#d0d0d6", 800: "#e4e4e7", 900: "#f2f2f4", 950: "#fafafa" },
  bd: { 50: "#1c1f25", 100: "#23262d", 200: "#2a2e36", 300: "#363b44", 400: "#4b505a", 500: "#61656f", 600: "#71717a", 700: "#a1a1aa", 800: "#d4d4d8", 900: "#e4e4e7", 950: "#f4f4f5" },
};

const FAMILIES = ["bg", "fg", "bd"];
const light = {};
const dark = {};

function defineHue(name, scale, darkFor) {
  for (const fam of FAMILIES) {
    for (const s of SHADES) {
      const v = `--${fam}-${name}-${s}`;
      light[v] = rgb(scale[s]);
      dark[v] = darkFor(fam, s);
    }
  }
}

const GREY_NAMES = new Set(["zinc", "slate", "gray", "neutral", "stone"]);
defineHue("zinc", ZINC, (fam, s) => rgb(DARK_ZINC[fam][s]));
for (const [name, scale] of Object.entries(palette)) {
  if (GREY_NAMES.has(name)) {
    defineHue(name, scale, (fam, s) => rgb(DARK_ZINC[fam][s]));
    continue;
  }
  const base = scale["500"];
  defineHue(name, scale, (fam, s) => {
    const n = Number(s);
    if (fam === "bg") {
      return n <= 300 ? tint(base, { 50: 0.12, 100: 0.18, 200: 0.26, 300: 0.38 }[n]) : rgb(scale[s]);
    }
    if (fam === "bd") {
      return n <= 300 ? tint(base, { 50: 0.2, 100: 0.26, 200: 0.34, 300: 0.48 }[n]) : rgb(scale[s]);
    }
    // fg: dark shades of a hue read as its light end.
    const flip = { 500: "400", 600: "400", 700: "300", 800: "200", 900: "100", 950: "50" }[s];
    return rgb(flip ? (scale[flip] || scale[s]) : scale[s]);
  });
}

// white: a surface when used as a fill or border, still white as text.
light["--bg-white"] = "255 255 255";
dark["--bg-white"] = rgb(SURFACE);
// ring-white / border-white are mostly "cut-out" rings around avatars and
// logos, so in dark they match the card surface rather than drawing a line.
light["--bd-white"] = "255 255 255";
dark["--bd-white"] = rgb(SURFACE);

const NAMES = ["zinc", ...Object.keys(palette)];
function familyColors(fam, { whiteVar = true } = {}) {
  const out = {
    inherit: "inherit",
    current: "currentColor",
    transparent: "transparent",
    black: "#000",
    white: whiteVar ? `rgb(var(--${fam === "fg" ? "bg" : fam}-white) / <alpha-value>)` : "#fff",
  };
  for (const name of NAMES) {
    out[name] = {};
    for (const s of SHADES) out[name][s] = `rgb(var(--${fam}-${name}-${s}) / <alpha-value>)`;
  }
  return out;
}

const bgColors = familyColors("bg");
const fgColors = familyColors("fg", { whiteVar: false });
const bdColors = familyColors("bd");

module.exports = {
  darkMode: "class",
  content: [
    "./pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./components/**/*.{js,ts,jsx,tsx,mdx}",
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
    "./lib/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    screens: {
      xs: "480px",
      sm: "640px",
      md: "768px",
      lg: "1024px",
      xl: "1280px",
      "2xl": "1536px",
    },
    backgroundColor: bgColors,
    gradientColorStops: bgColors,
    textColor: fgColors,
    placeholderColor: fgColors,
    caretColor: fgColors,
    decorationColor: fgColors,
    fill: fgColors,
    stroke: fgColors,
    // DEFAULT is what a bare `border` (and Tailwind's preflight) uses.
    borderColor: { ...bdColors, DEFAULT: bdColors.zinc["200"] },
    divideColor: bdColors,
    outlineColor: bdColors,
    ringColor: { ...bdColors, DEFAULT: bdColors.primary["500"] },
    ringOffsetColor: bgColors,
    // Coloured shadows (shadow-zinc-200/50, shadow-primary-500/30 …): grey
    // glows sink into the dark page instead of glowing light grey.
    boxShadowColor: bgColors,
    extend: {
      colors: {
        // `colors` still feeds utilities not remapped above (accent, shadow…).
        primary: PRIMARY,
      },
      keyframes: {
        "fade-up": {
          "0%": { opacity: "0", transform: "translateY(8px)" },
          "100%": { opacity: "1", transform: "translateY(0)" },
        },
        shimmer: {
          "0%": { backgroundPosition: "-400px 0" },
          "100%": { backgroundPosition: "400px 0" },
        },
        float: {
          "0%, 100%": { transform: "translateY(0)" },
          "50%": { transform: "translateY(-10px)" },
        },
        "gradient-x": {
          "0%, 100%": { backgroundPosition: "0% 50%" },
          "50%": { backgroundPosition: "100% 50%" },
        },
      },
      animation: {
        "fade-up": "fade-up 0.45s cubic-bezier(0.22, 1, 0.36, 1) both",
        shimmer: "shimmer 1.6s linear infinite",
        float: "float 6s ease-in-out infinite",
        "gradient-x": "gradient-x 8s ease infinite",
      },
      boxShadow: {
        soft: "0 1px 2px rgb(16 24 40 / 0.04), 0 1px 3px rgb(16 24 40 / 0.06)",
        lift: "0 10px 30px -12px rgb(16 24 40 / 0.18)",
        glow: "0 0 0 1px rgb(111 163 113 / 0.25), 0 8px 30px -8px rgb(111 163 113 / 0.45)",
      },
    },
  },
  plugins: [
    plugin(({ addBase }) => {
      addBase({
        ":root": { ...light, "--page-bg": "245 247 250", "--surface": "255 255 255" },
        ".dark": { ...dark, "--page-bg": rgb(PAGE), "--surface": rgb(SURFACE), colorScheme: "dark" },
      });
    }),
  ],
};
