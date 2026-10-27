import type { CSSProperties } from "react";
import { Archivo, Bricolage_Grotesque, EB_Garamond, Figtree, Manrope, Schibsted_Grotesk } from "next/font/google";
import type { Theme } from "@/lib/spec";

// Only the pair a preview uses is applied; preload is off so unused families never download.
const bricolage = Bricolage_Grotesque({ subsets: ["latin"], weight: ["600", "700"], variable: "--f-bricolage", preload: false });
const figtree = Figtree({ subsets: ["latin"], weight: ["400", "500", "600"], variable: "--f-figtree", preload: false });
const manrope = Manrope({ subsets: ["latin"], weight: ["400", "500", "700", "800"], variable: "--f-manrope", preload: false });
const archivo = Archivo({ subsets: ["latin"], weight: ["400", "500", "700", "800"], variable: "--f-archivo", preload: false });
const schibsted = Schibsted_Grotesk({ subsets: ["latin"], weight: ["400", "500", "700", "800"], variable: "--f-schibsted", preload: false });
const garamond = EB_Garamond({ subsets: ["latin"], weight: ["500", "600"], variable: "--f-garamond", preload: false });

const types: Record<Theme["type"], { className: string; heading: string; body: string }> = {
  grotesk: { className: `${bricolage.variable} ${figtree.variable}`, heading: "var(--f-bricolage)", body: "var(--f-figtree)" },
  clean: { className: manrope.variable, heading: "var(--f-manrope)", body: "var(--f-manrope)" },
  sturdy: { className: archivo.variable, heading: "var(--f-archivo)", body: "var(--f-archivo)" },
  modern: { className: schibsted.variable, heading: "var(--f-schibsted)", body: "var(--f-schibsted)" },
  // Reserved for period/heritage specialists (sash windows, restoration), per the spec prompt.
  heritage: { className: `${garamond.variable} ${figtree.variable}`, heading: "var(--f-garamond)", body: "var(--f-figtree)" },
};

type Palette = {
  bg: string; // page
  surface: string; // tinted panels
  ink: string; // body text
  muted: string; // secondary text, AA on bg and surface
  deep: string; // dark blocks (trust strip, CTA); white text on it
  accent: string; // the one accent: buttons, stars, highlights
  onAccent: string; // text on accent buttons, AA
};

// One accent per palette, neutrals of one temperature. Light theme only: these are client previews
// that mimic a finished brand site, so they ship in a single, deliberate mode.
const palettes: Record<Theme["palette"], Palette> = {
  forest: { bg: "#f4f6f2", surface: "#e7ece4", ink: "#17201a", muted: "#4f5b53", deep: "#1c3326", accent: "#e09a3e", onAccent: "#1a1306" },
  cobalt: { bg: "#f6f7fa", surface: "#e8ecf3", ink: "#121722", muted: "#525c70", deep: "#121d38", accent: "#2b55d6", onAccent: "#ffffff" },
  "slate-rust": { bg: "#f4f5f6", surface: "#e6e9ec", ink: "#15181c", muted: "#545d67", deep: "#262d34", accent: "#b9472a", onAccent: "#ffffff" },
  "olive-brick": { bg: "#f3f4ee", surface: "#e5e6da", ink: "#1c1e16", muted: "#585b4c", deep: "#36412a", accent: "#a63d2a", onAccent: "#ffffff" },
  "navy-sun": { bg: "#f5f7fa", surface: "#e5eaf1", ink: "#0f1726", muted: "#4f5a6e", deep: "#0f2440", accent: "#f0b429", onAccent: "#1a1300" },
  "mono-emerald": { bg: "#f7f7f6", surface: "#ebebe9", ink: "#161616", muted: "#575757", deep: "#1b1b1b", accent: "#0d7a55", onAccent: "#ffffff" },
};

const radius: Record<Theme["radius"], string> = { none: "0px", sm: "8px", lg: "20px" };

// Paint-chip names for the swatch-fan hero. Decorative only, never presented as products.
const swatchNames: Record<Theme["palette"], [string, string, string, string, string]> = {
  forest: ["Spruce", "Moss", "Amber", "Fern", "Linen"],
  cobalt: ["Harbour", "Cobalt", "Slate", "Mist", "Chalk"],
  "slate-rust": ["Graphite", "Rust", "Pewter", "Clay", "Fog"],
  "olive-brick": ["Olive", "Brick", "Sage", "Stone", "Oat"],
  "navy-sun": ["Navy", "Sunflower", "Denim", "Haze", "Cloud"],
  "mono-emerald": ["Ink", "Emerald", "Ash", "Pebble", "Paper"],
};

function mix(a: string, b: string, t: number) {
  const pa = a.match(/\w\w/g)!.map((h) => parseInt(h, 16));
  const pb = b.match(/\w\w/g)!.map((h) => parseInt(h, 16));
  return `#${pa.map((v, i) => Math.round(v + (pb[i] - v) * t).toString(16).padStart(2, "0")).join("")}`;
}

export function paletteSwatches(theme: Theme) {
  const p = palettes[theme.palette];
  const names = swatchNames[theme.palette];
  const colors = [p.deep, mix(p.deep, p.bg, 0.35), p.accent, mix(p.accent, p.bg, 0.55), p.surface];
  // Back to front: light chips behind, the brand accent on top of the fan.
  return [4, 3, 1, 0, 2].map((i) => ({ name: names[i], color: colors[i].toUpperCase(), ink: p.ink }));
}

export function themeClassName(theme: Theme) {
  return types[theme.type].className;
}

// Sections style themselves with var(--c-*), var(--r) and var(--f-heading/body).
export function themeStyle(theme: Theme): CSSProperties {
  const p = palettes[theme.palette];
  return {
    "--c-bg": p.bg,
    "--c-surface": p.surface,
    "--c-ink": p.ink,
    "--c-muted": p.muted,
    "--c-deep": p.deep,
    "--c-accent": p.accent,
    "--c-on-accent": p.onAccent,
    "--r": radius[theme.radius],
    "--f-heading": types[theme.type].heading,
    "--f-body": types[theme.type].body,
  } as CSSProperties;
}
