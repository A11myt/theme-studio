// 16 Terminalfarben passend zum Theme: klassische ANSI-Farbtöne werden zur Ausgangsfarbe „harmonisiert“
// (Material: Blend.harmonize – Farbton rückt ein Stück Richtung Theme) und auf hell/dunkel abgestimmt.
// Rot bleibt rot, Grün grün – aber sie passen zum Rest statt fremd zu wirken.
import { argbFromHex, Blend, Hct, hexFromArgb } from "@material/material-color-utilities";
import { effectiveSource, type Palette, type ThemeSettings } from "./color";

const BASE = { red: "#e0544f", green: "#5fb95c", yellow: "#d8b23a", blue: "#4f86d9", magenta: "#b65fc8", cyan: "#3fb4c2" };
export const ANSI_NAMES = ["black", "red", "green", "yellow", "blue", "magenta", "cyan", "white"] as const;

export interface Ansi {
  normal: string[];   // 0–7
  bright: string[];   // 8–15
}

export function ansi(c: Palette, t: ThemeSettings): Ansi {
  const dark = t.mode === "dark";
  const src = argbFromHex(effectiveSource(t));
  const tone = (hex: string, tn: number, maxChroma = 60) => {
    const h = Hct.fromInt(Blend.harmonize(argbFromHex(hex), src));
    return hexFromArgb(Hct.from(h.hue, Math.min(h.chroma, maxChroma), tn).toInt());
  };
  const [n, b] = dark ? [72, 82] : [42, 32];
  const hues = Object.values(BASE);
  return {
    normal: [c.surface_container_highest, ...hues.map((x) => tone(x, n)), c.on_surface_variant],
    bright: [c.outline, ...hues.map((x) => tone(x, b, 48)), c.on_surface],
  };
}
