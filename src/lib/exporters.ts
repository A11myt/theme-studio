// Ausgaben für Linux (matugen/Alacritty) und Windows (wintheme, Windows Terminal, komorebi).
// Zuordnungen wie in dotfiles (matugen-Vorlagen) und dotfiles-windows (wintheme.py).
import { palette, type Palette, type ThemeSettings } from "./color";

export interface ExportFile {
  id: string;
  label: string;
  hint: string;
  filename: string;
  text: string;
}

const json = (v: unknown) => JSON.stringify(v, null, 2) + "\n";
const slug = (s: string) => s.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") || "theme";

/** Rendert eine matugen-Vorlage: {{colors.<rolle>.<default|dark|light>.<format>}}, {{mode}}, {{image}}. */
export function renderTemplate(text: string, t: ThemeSettings, imageName = ""): string {
  const pals: Record<string, Palette> = {
    default: palette(t),
    dark: palette({ ...t, mode: "dark" }),
    light: palette({ ...t, mode: "light" }),
  };
  const fmt = (hex: string, f: string): string => {
    const [r, g, b] = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16));
    switch (f) {
      case "hex": return hex;
      case "hex_stripped": return hex.slice(1);
      case "rgb": return `rgb(${r}, ${g}, ${b})`;
      case "rgba": return `rgba(${r}, ${g}, ${b}, 1)`;
      case "red": return String(r);
      case "green": return String(g);
      case "blue": return String(b);
      default: return hex;
    }
  };
  return text
    .replace(/\{\{\s*colors\.([a-z_]+)\.(default|dark|light)\.([a-z_]+)\s*\}\}/g, (m, role: string, variant: string, f: string) => {
      const hex = (pals[variant] as Record<string, string>)[role];
      return hex ? fmt(hex, f) : m;
    })
    .replace(/\{\{\s*mode\s*\}\}/g, t.mode)
    .replace(/\{\{\s*image\s*\}\}/g, imageName);
}

function terminalScheme(c: Palette, name: string) {
  return {
    name,
    background: c.background, foreground: c.on_surface,
    cursorColor: c.on_surface_variant, selectionBackground: c.primary,
    black: "#181818", red: c.error, green: c.primary, yellow: c.inverse_primary,
    blue: c.primary, purple: c.tertiary, cyan: c.secondary, white: "#BAC2DE",
    brightBlack: "#585B70", brightRed: "#F38BA8", brightGreen: "#A6E3A1", brightYellow: "#F9E2AF",
    brightBlue: "#89B4FA", brightPurple: "#F5C2E7", brightCyan: "#94E2D5", brightWhite: "#A6ADC8",
  };
}

function base16(c: Palette, dark: boolean) {
  return {
    base_00: c.surface, base_01: c.surface_container_low, base_02: c.surface_container_high,
    base_03: c.outline_variant, base_04: c.outline, base_05: c.on_surface,
    base_06: c.on_surface_variant, base_07: dark ? c.inverse_surface : c.on_surface,
    base_08: c.error, base_09: c.tertiary, base_0a: c.secondary, base_0b: c.primary_fixed_dim,
    base_0c: c.tertiary_fixed_dim, base_0d: c.primary, base_0e: c.secondary_fixed_dim, base_0f: c.outline,
  };
}

/** Befehle, die genau dieses Theme anwenden (gleiche Ausgangsfarbe → identische Palette). */
export function commands(t: ThemeSettings) {
  return {
    // färbt das aktuelle Windows-Wallpaper mit dieser Ausgangsfarbe
    windows: `wintheme --color ${t.source} --scheme ${t.scheme} --mode ${t.mode}` +
      (t.contrast ? ` --contrast ${t.contrast}` : ""),
    linux: `matugen color hex '${t.source}' -t scheme-${t.scheme} -m ${t.mode}` +
      (t.contrast ? ` --contrast ${t.contrast}` : ""),
  };
}

export function exportsFor(name: string, t: ThemeSettings, imageName?: string): ExportFile[] {
  const c = palette(t);
  const s = slug(name);
  const css = Object.entries(c).map(([k, v]) => `  --${k.replace(/_/g, "-")}: ${v};`).join("\n");
  return [
    {
      id: "theme", label: "Theme-Datei", hint: "alles in einer Datei – zum Aufheben und Teilen",
      filename: `${s}.theme.json`,
      text: json({ name, ...t, image: imageName ?? null, colors: c, commands: commands(t) }),
    },
    {
      id: "terminal", label: "Windows Terminal", hint: "in settings.json unter „schemes“ einfügen",
      filename: `${s}.windows-terminal.json`, text: json(terminalScheme(c, name)),
    },
    {
      id: "komorebi", label: "komorebi", hint: "als „theme“ in komorebi.json / komorebi.bar.json",
      filename: `${s}.komorebi-theme.json`,
      text: json({
        palette: "Custom", colours: base16(c, t.mode === "dark"), single_border: "Base0D", stack_border: "Base0E",
        monocle_border: "Base09", floating_border: "Base0C", unfocused_border: "Base02", bar_accent: "Base0D",
      }),
    },
    {
      id: "css", label: "CSS-Variablen", hint: "für Webseiten, Obsidian-Snippets, Firefox userChrome",
      filename: `${s}.css`, text: `/* ${name} – ${t.scheme}, ${t.mode} */\n:root {\n${css}\n}\n`,
    },
  ];
}

export function download(filename: string, text: string) {
  const a = document.createElement("a");
  a.href = URL.createObjectURL(new Blob([text], { type: "text/plain;charset=utf-8" }));
  a.download = filename;
  a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 1000);
}
