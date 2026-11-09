// Schriften wie fontgen auf dem Laptop: ui (Oberfläche), mono (Terminal/Code), accent (Überschriften), Größen in pt.
export interface Fonts {
  ui: string;
  mono: string;
  accent: string;
  uiSize: number;
  monoSize: number;
}

// deine fontgen-Profile (dotfiles/fontgen/.config/fontgen/config.toml)
export const FONT_PRESETS: Record<string, Fonts> = {
  iosevka: { ui: "Iosevka Nerd Font Propo", mono: "Iosevka Nerd Font Mono", accent: "NDOT 47 (inspired by NOTHING)", uiSize: 10, monoSize: 9 },
  hack: { ui: "Hack Nerd Font Propo", mono: "Hack Nerd Font Mono", accent: "NDOT 47 (inspired by NOTHING)", uiSize: 10, monoSize: 9 },
  jetbrains: { ui: "JetBrainsMono Nerd Font Propo", mono: "JetBrainsMono Nerd Font Mono", accent: "NDOT 47 (inspired by NOTHING)", uiSize: 10, monoSize: 9 },
};
// Standard: nichts festlegen – die Programme behalten ihre Schrift (wird erst gesetzt, wenn du eine wählst)
export const DEFAULT_FONTS: Fonts = { ui: "", mono: "", accent: "", uiSize: 10, monoSize: 9 };
/** Wurde überhaupt eine Schrift gewählt? */
export const hasFonts = (f?: Fonts) => !!f && !!(f.ui || f.mono || f.accent);

/** Platzhalter wie fontgen: {{fonts.ui}}, {{fonts.mono}}, {{fonts.accent}}, {{fonts.ui_size}}, {{fonts.mono_size}}, {{fonts.ui_px}}, {{fonts.mono_px}} */
export function fontValues(f: Fonts): Record<string, string> {
  return {
    ui: f.ui, mono: f.mono, accent: f.accent,
    ui_size: String(f.uiSize), mono_size: String(f.monoSize),
    ui_px: String(Math.round((f.uiSize * 4) / 3)), mono_px: String(Math.round((f.monoSize * 4) / 3)),
  };
}

/** CSS-Schriftliste mit Rückfall. */
export const cssFont = (name: string, fallback: string) => (name ? `"${name}", ${fallback}` : fallback);
