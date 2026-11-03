// Lesbarkeit nach WCAG 2.x: Kontrastverhältnis Text/Hintergrund (1–21).
// ≥ 7 sehr gut (AAA) · ≥ 4,5 gut (AA) · ≥ 3 nur für große Schrift/Symbole · darunter schlecht.
const lin = (c: number) => (c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4);

export function luminance(hex: string): number {
  const [r, g, b] = [1, 3, 5].map((i) => lin(parseInt(hex.slice(i, i + 2), 16) / 255));
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

export function ratio(a: string, b: string): number {
  const [x, y] = [luminance(a), luminance(b)].sort((p, q) => q - p);
  return (x + 0.05) / (y + 0.05);
}

export type Grade = "aaa" | "aa" | "large" | "fail";
export function grade(r: number): Grade {
  return r >= 7 ? "aaa" : r >= 4.5 ? "aa" : r >= 3 ? "large" : "fail";
}
export const GRADE_LABEL: Record<Grade, string> = { aaa: "sehr gut", aa: "gut", large: "nur groß", fail: "schlecht" };

// Wichtige Paare, die im Alltag nebeneinander stehen (Text auf Fläche)
export const PAIRS: [fg: string, bg: string, label: string][] = [
  ["on_surface", "surface", "Text auf Hintergrund"],
  ["on_surface_variant", "surface_container", "Nebentext auf Leiste/Karte"],
  ["on_primary", "primary", "Text auf Akzent-Knopf"],
  ["primary", "surface", "Akzent auf Hintergrund (Links, Rahmen)"],
  ["on_primary_container", "primary_container", "Text auf Akzent-Fläche"],
  ["tertiary", "surface", "Strings im Code"],
  ["outline", "surface", "Kommentare / Linien"],
  ["on_error", "error", "Fehlermeldung"],
];

// Gegenstück für die Palette (Rolle → passende Text- bzw. Hintergrundrolle)
export const PARTNER: Record<string, string> = {
  primary: "on_primary", on_primary: "primary", primary_container: "on_primary_container",
  secondary: "on_secondary", secondary_container: "on_secondary_container",
  tertiary: "on_tertiary", tertiary_container: "on_tertiary_container",
  error: "on_error", error_container: "on_error_container",
  background: "on_background", surface: "on_surface", surface_container_low: "on_surface",
  surface_container: "on_surface", surface_container_high: "on_surface", surface_container_highest: "on_surface",
  surface_variant: "on_surface_variant", inverse_surface: "inverse_on_surface", inverse_primary: "inverse_surface",
  on_surface: "surface", on_surface_variant: "surface", outline: "surface", outline_variant: "surface",
};
