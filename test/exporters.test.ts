import { describe, expect, it } from "vitest";
import { palette } from "../src/lib/color";
import { commands, exportsFor, parseThemeFile, renderTemplate } from "../src/lib/exporters";
import { FONT_PRESETS } from "../src/lib/fonts";

const t = { source: "#db79a9", scheme: "tonal-spot", mode: "dark", contrast: 0 } as const;
const f = FONT_PRESETS.hack;
const byId = (id: string, s = t) => exportsFor("Zug Abend", s, "zug.jpg", f).find((x) => x.id === id)!;

describe("Exporte", () => {
  it("Theme-Datei lässt sich wieder einlesen (inkl. Feinjustierung, Überschreibungen, Schrift)", () => {
    const s = { ...t, tune: { hue: 12, chroma: 1.2 }, overrides: { surface: "#101010" } };
    const back = parseThemeFile(byId("theme", s).text);
    expect(back.name).toBe("Zug Abend");
    expect(back.settings).toEqual(s);
    expect(back.fonts).toEqual(f);
  });
  it("Import lehnt fremde Dateien ab", () => {
    expect(() => parseThemeFile('{"hello":1}')).toThrow();
    expect(() => parseThemeFile('{"source":"#db79a9","scheme":"x","mode":"dark"}')).toThrow();
  });
  it("Windows Terminal: 16 Farben + Hinter-/Vordergrund", () => {
    const s = JSON.parse(byId("terminal").text);
    const keys = ["black", "red", "green", "yellow", "blue", "purple", "cyan", "white"];
    for (const k of [...keys, ...keys.map((k) => "bright" + k[0].toUpperCase() + k.slice(1)), "background", "foreground"]) {
      expect(s[k], k).toMatch(/^#[0-9a-f]{6}$/);
    }
    expect(s.background).toBe(palette(t).background);
  });
  it("base16: base00 … base0F", () => {
    const y = byId("base16").text;
    for (const k of ["base00", "base05", "base0A", "base0D", "base0F"]) expect(y).toMatch(new RegExp(`${k}: "#[0-9a-f]{6}"`));
  });
  it("pywal: color0 … color15", () => {
    const w = JSON.parse(byId("pywal").text);
    expect(Object.keys(w.colors)).toHaveLength(16);
  });
  it("Befehle enthalten Farbe, Variante, Schrift und Überschreibungen", () => {
    const c = commands({ ...t, overrides: { primary: "#00ff00" } }, f);
    expect(c.windows).toBe('wintheme --color #db79a9 --scheme tonal-spot --mode dark --font "Hack Nerd Font Mono" --override primary=#00ff00');
    expect(c.linux).toBe("wallthemes --color '#db79a9' --scheme tonal-spot --mode dark --override primary='#00ff00'");
  });
});

describe("Vorlagen (matugen/fontgen-Platzhalter)", () => {
  it("füllt Farben, Formate, Schriften und Modus", () => {
    const out = renderTemplate(
      "{{colors.primary.default.hex}} {{ colors.primary.default.hex_stripped }} {{colors.surface.light.hex}} " +
      "{{colors.primary.default.red}} {{fonts.mono}} {{fonts.mono_px}} {{mode}} {{colors.gibtsnicht.default.hex}}", t, "", f);
    expect(out).toBe(`#feb0d3 feb0d3 ${palette({ ...t, mode: "light" }).surface} 254 Hack Nerd Font Mono 12 dark {{colors.gibtsnicht.default.hex}}`);
  });
});
