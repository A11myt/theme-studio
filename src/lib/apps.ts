// Weitere Programme einfärben: Obsidian (CSS-Snippet je Vault) und Firefox (userChrome.css je Profil).
// Farben nach denselben Rollen wie die Vorschauen im Bereich Vorschau.
import type { Palette } from "./color";
import { cssFont, type Fonts } from "./fonts";

export const CSS_BEGIN = "/* >>> theme-studio (wird beim Anwenden ersetzt) */";
export const CSS_END = "/* <<< theme-studio */";
export const OBSIDIAN_SNIPPET = "theme-studio";
export const FF_PREF_LINE = 'user_pref("toolkit.legacyUserProfileCustomizations.stylesheets", true); // theme-studio';

const esc = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

/** Markierten Block setzen (am Ende) oder entfernen (body = null); alles andere bleibt. */
export function upsertMarked(text: string | null, begin: string, end: string, body: string | null, nl = "\n"): string {
  const re = new RegExp(`\\r?\\n?${esc(begin)}[\\s\\S]*?${esc(end)}\\r?\\n?`);
  let t = (text ?? "").replace(re, nl).replace(/(\r?\n)+$/, "");
  if (body !== null) t = (t ? t + nl + nl : "") + [begin, body, end].join(nl);
  return t ? t + nl : "";
}

/** Obsidian-Snippet: Grundflächen, Text, Akzent, Links, Markierungen, Code, Schriften. */
export function obsidianCss(c: Palette, fonts?: Fonts): string {
  const f = fonts ? `
  --font-interface-override: ${cssFont(fonts.ui, "sans-serif")};
  --font-text-override: ${cssFont(fonts.ui, "sans-serif")};
  --font-monospace-override: ${cssFont(fonts.mono, "monospace")};` : "";
  return `/* Theme Studio – Farben aus deinem Theme. Ausschalten: Einstellungen → Darstellung → CSS-Snippets */
.theme-dark, .theme-light {
  --background-primary: ${c.surface};
  --background-primary-alt: ${c.surface_container_low};
  --background-secondary: ${c.surface_container_low};
  --background-secondary-alt: ${c.surface_container};
  --background-modifier-border: ${c.outline_variant};
  --background-modifier-hover: ${c.surface_container_high};
  --background-modifier-active-hover: ${c.surface_container_highest};
  --text-normal: ${c.on_surface};
  --text-muted: ${c.on_surface_variant};
  --text-faint: ${c.outline};
  --text-accent: ${c.primary};
  --text-accent-hover: ${c.secondary};
  --text-on-accent: ${c.on_primary};
  --text-highlight-bg: ${c.tertiary}55;
  --text-selection: ${c.primary}44;
  --interactive-accent: ${c.primary};
  --interactive-accent-hover: ${c.secondary};
  --link-color: ${c.secondary};
  --link-external-color: ${c.tertiary};
  --code-background: ${c.surface_container_high};
  --code-normal: ${c.tertiary};
  --tag-background: ${c.secondary_container};
  --tag-color: ${c.on_secondary_container};
  --h1-color: ${c.primary};
  --h2-color: ${c.primary};
  --titlebar-background: ${c.surface_container_low};
  --titlebar-background-focused: ${c.surface_container};${f}
}`;
}

/** Firefox userChrome: Tableiste, Werkzeugleiste, Adressleiste, Menüs. */
export function firefoxCss(c: Palette): string {
  return `:root {
  --lwt-accent-color: ${c.surface_container_lowest} !important;
  --lwt-text-color: ${c.on_surface} !important;
  --toolbar-bgcolor: ${c.surface_container_high} !important;
  --toolbar-color: ${c.on_surface} !important;
  --tab-selected-bgcolor: ${c.surface_container_high} !important;
  --tab-selected-textcolor: ${c.on_surface} !important;
  --toolbar-field-background-color: ${c.surface_container_highest} !important;
  --toolbar-field-color: ${c.on_surface} !important;
  --toolbar-field-focus-background-color: ${c.surface_container_highest} !important;
  --toolbar-field-focus-border-color: ${c.primary} !important;
  --focus-outline-color: ${c.primary} !important;
  --arrowpanel-background: ${c.surface_container} !important;
  --arrowpanel-color: ${c.on_surface} !important;
  --button-primary-bgcolor: ${c.primary} !important;
  --button-primary-color: ${c.on_primary} !important;
}`;
}

/** Firefox-Profile aus profiles.ini (relative und absolute Pfade). */
export function firefoxProfiles(ini: string, base: string, sep: string): string[] {
  const out: string[] = [];
  let path = "", rel = true, inProfile = false;
  const flush = () => { if (inProfile && path) out.push(rel ? [base, ...path.split("/")].join(sep) : path.replace(/\//g, sep)); path = ""; rel = true; };
  for (const raw of ini.split(/\r?\n/)) {
    const l = raw.trim();
    if (l.startsWith("[")) { flush(); inProfile = /^\[Profile\d+\]$/i.test(l); continue; }
    const [k, ...v] = l.split("=");
    if (k === "Path") path = v.join("=");
    if (k === "IsRelative") rel = v.join("=") === "1";
  }
  flush();
  return [...new Set(out)];
}

/** Obsidian-Vaults aus obsidian.json. */
export function obsidianVaults(json: string): string[] {
  try {
    const d = JSON.parse(json) as { vaults?: Record<string, { path?: string }> };
    return Object.values(d.vaults ?? {}).map((v) => v.path ?? "").filter(Boolean);
  } catch { return []; }
}
