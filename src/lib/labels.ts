// Палитра меток. Имя цвета хранится в `Label.color` строкой —
// фронт превращает в hex для светлой и тёмной тем.

export const LABEL_COLORS = [
  "red",
  "orange",
  "amber",
  "yellow",
  "lime",
  "emerald",
  "teal",
  "cyan",
  "sky",
  "blue",
  "indigo",
  "violet",
  "fuchsia",
  "pink",
  "rose",
  "slate",
  "gray",
  "zinc",
] as const;

export type LabelColor = (typeof LABEL_COLORS)[number];

// hex для светлой и тёмной темы. Подбираем чуть менее насыщенные оттенки
// для тёмной — чтобы не «жгли» глаза на тёмном фоне.
const PALETTE: Record<LabelColor, { light: string; dark: string }> = {
  red: { light: "#dc2626", dark: "#f87171" },
  orange: { light: "#ea580c", dark: "#fb923c" },
  amber: { light: "#d97706", dark: "#fbbf24" },
  yellow: { light: "#ca8a04", dark: "#facc15" },
  lime: { light: "#65a30d", dark: "#a3e635" },
  emerald: { light: "#059669", dark: "#34d399" },
  teal: { light: "#0d9488", dark: "#2dd4bf" },
  cyan: { light: "#0891b2", dark: "#22d3ee" },
  sky: { light: "#0284c7", dark: "#38bdf8" },
  blue: { light: "#2563eb", dark: "#60a5fa" },
  indigo: { light: "#4f46e5", dark: "#818cf8" },
  violet: { light: "#7c3aed", dark: "#a78bfa" },
  fuchsia: { light: "#c026d3", dark: "#e879f9" },
  pink: { light: "#db2777", dark: "#f472b6" },
  rose: { light: "#e11d48", dark: "#fb7185" },
  slate: { light: "#475569", dark: "#94a3b8" },
  gray: { light: "#4b5563", dark: "#9ca3af" },
  zinc: { light: "#52525b", dark: "#a1a1aa" },
};

export function isLabelColor(value: string): value is LabelColor {
  return (LABEL_COLORS as readonly string[]).includes(value);
}

export function labelHex(color: string, theme: "light" | "dark" = "light") {
  if (!isLabelColor(color)) return theme === "dark" ? "#94a3b8" : "#475569";
  return PALETTE[color][theme];
}
