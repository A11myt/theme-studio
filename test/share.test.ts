import { describe, expect, it } from "vitest";
import { FONT_PRESETS } from "../src/lib/fonts";
import { readShareLink, shareLink, WEB_URL } from "../src/lib/share";

describe("Theme-Links", () => {
  const s = { source: "#db79a9", scheme: "vibrant", mode: "light", contrast: 0.2, tune: { hue: -8, chroma: 1.1 }, overrides: { primary: "#00ff00" } } as const;
  it("hin und zurück – inkl. Umlauten im Namen", () => {
    const link = shareLink("Zug Abend – Grün", s, FONT_PRESETS.jetbrains);
    expect(link.startsWith(WEB_URL + "#t=")).toBe(true);
    const back = readShareLink(link)!;
    expect(back.name).toBe("Zug Abend – Grün");
    expect(back.settings).toEqual(s);
    expect(back.fonts).toEqual(FONT_PRESETS.jetbrains);
  });
  it("kein Link → null, kaputter Link → Fehler", () => {
    expect(readShareLink("hallo")).toBeNull();
    expect(() => readShareLink(WEB_URL + "#t=bm9wZW5vcGVub3Blbm9wZQ")).toThrow();
  });
});
