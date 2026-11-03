// Farbberechnung wie matugen / wintheme: Bild auf 112×112 verkleinern, Celebi-Quantisierung (128 Farben),
// Score → bis zu 4 Ausgangsfarben, daraus ein Material-You-Schema nach Spezifikation 2021.
import {
  DynamicScheme,
  Hct,
  QuantizerCelebi,
  SchemeContent,
  SchemeExpressive,
  SchemeFidelity,
  SchemeFruitSalad,
  SchemeMonochrome,
  SchemeNeutral,
  SchemeRainbow,
  SchemeTonalSpot,
  SchemeVibrant,
  Score,
  hexFromArgb,
} from "@material/material-color-utilities";
import { resizeBilinear } from "./resize";

export const SCHEMES = {
  "tonal-spot": { label: "Tonal Spot", hint: "ruhig, Standard", cls: SchemeTonalSpot },
  vibrant: { label: "Vibrant", hint: "kräftig", cls: SchemeVibrant },
  expressive: { label: "Expressive", hint: "verspielt, Farbton verschoben", cls: SchemeExpressive },
  fidelity: { label: "Fidelity", hint: "nah am Bild", cls: SchemeFidelity },
  content: { label: "Content", hint: "nah am Bild, weicher", cls: SchemeContent },
  "fruit-salad": { label: "Fruit Salad", hint: "bunt", cls: SchemeFruitSalad },
  rainbow: { label: "Rainbow", hint: "bunt, neutrale Flächen", cls: SchemeRainbow },
  neutral: { label: "Neutral", hint: "fast grau", cls: SchemeNeutral },
  monochrome: { label: "Monochrome", hint: "schwarz-weiß", cls: SchemeMonochrome },
} as const;

export type SchemeName = keyof typeof SCHEMES;
export type Mode = "dark" | "light";

export interface ThemeSettings {
  source: string;        // Ausgangsfarbe #rrggbb
  scheme: SchemeName;
  mode: Mode;
  contrast: number;      // -1 … 1
}

// alle Rollen, die matugen ausgibt (snake_case wie in dessen Vorlagen)
const ROLES = [
  "primary", "on_primary", "primary_container", "on_primary_container", "primary_fixed", "primary_fixed_dim",
  "on_primary_fixed", "on_primary_fixed_variant", "inverse_primary",
  "secondary", "on_secondary", "secondary_container", "on_secondary_container", "secondary_fixed",
  "secondary_fixed_dim", "on_secondary_fixed", "on_secondary_fixed_variant",
  "tertiary", "on_tertiary", "tertiary_container", "on_tertiary_container", "tertiary_fixed", "tertiary_fixed_dim",
  "on_tertiary_fixed", "on_tertiary_fixed_variant",
  "error", "on_error", "error_container", "on_error_container",
  "background", "on_background", "surface", "on_surface", "surface_variant", "on_surface_variant",
  "surface_dim", "surface_bright", "surface_container_lowest", "surface_container_low", "surface_container",
  "surface_container_high", "surface_container_highest", "inverse_surface", "inverse_on_surface",
  "outline", "outline_variant", "shadow", "scrim", "surface_tint",
] as const;

export type Role = (typeof ROLES)[number];
export type Palette = Record<Role, string>;

const camel = (s: string) => s.replace(/_([a-z])/g, (_, c: string) => c.toUpperCase());

export function buildScheme(t: ThemeSettings): DynamicScheme {
  const Cls = SCHEMES[t.scheme].cls;
  return new Cls(Hct.fromInt(argbFromHex(t.source)), t.mode === "dark", t.contrast, "2021");
}

export function palette(t: ThemeSettings): Palette {
  const s = buildScheme(t) as unknown as Record<string, number>;
  const out = {} as Palette;
  for (const r of ROLES) out[r] = hexFromArgb(s[camel(r)]);
  return out;
}

export function argbFromHex(hex: string): number {
  const h = hex.replace("#", "");
  return (0xff000000 | parseInt(h.length === 3 ? h.split("").map((c) => c + c).join("") : h, 16)) >>> 0;
}

export type Engine = "matugen" | "browser";

/** Bis zu 4 Ausgangsfarben: per matugen (lokaler Server, exakt wie das System), sonst im Browser. */
export async function sourceColors(blob: Blob): Promise<{ colors: string[]; engine: Engine }> {
  try {
    const r = await fetch("/api/source-colors", { method: "POST", body: blob });
    if (r.ok) {
      const d = await r.json();
      if (Array.isArray(d.colors) && d.colors.length) return { colors: d.colors, engine: "matugen" };
    }
  } catch {
    /* kein Server/matugen → Browser */
  }
  return { colors: await browserSourceColors(blob), engine: "browser" };
}

/** Im Browser: wie matugen/Pillow auf 112×112 verkleinern, Celebi-Quantisierung (128), Score. */
export async function browserSourceColors(blob: Blob): Promise<string[]> {
  const bmp = await createImageBitmap(blob);
  const { width: w, height: h } = bmp;
  const c = new OffscreenCanvas(w, h);
  const ctx = c.getContext("2d", { willReadFrequently: true })!;
  ctx.drawImage(bmp, 0, 0);
  bmp.close();
  const small = resizeBilinear(ctx.getImageData(0, 0, w, h).data, w, h, 112, 112);
  const pixels: number[] = [];
  for (let i = 0; i < small.length; i += 4) {
    if (small[i + 3] < 255) continue;               // durchsichtige Pixel ignorieren
    pixels.push(((small[i + 3] << 24) | (small[i] << 16) | (small[i + 1] << 8) | small[i + 2]) >>> 0);
  }
  const ranked = Score.score(QuantizerCelebi.quantize(pixels, 128), { desired: 4, filter: true });
  return [...new Set(ranked.map(hexFromArgb))];
}

/** Lesbare Textfarbe auf einem Hintergrund. */
export function onColor(hex: string): string {
  return Hct.fromInt(argbFromHex(hex)).tone > 60 ? "#111111" : "#ffffff";
}

/** Grober Farbname für Übersichten. */
export function hueName(hex: string): string {
  const h = Hct.fromInt(argbFromHex(hex));
  if (h.chroma < 12) return "Grau";
  const d = h.hue;
  if (d < 20 || d >= 345) return "Pink";
  if (d < 45) return "Rot";
  if (d < 75) return "Orange";
  if (d < 105) return "Gelb";
  if (d < 160) return "Grün";
  if (d < 220) return "Türkis";
  if (d < 280) return "Blau";
  return "Violett";
}
