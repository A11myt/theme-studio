// Paletten: müssen exakt dem entsprechen, was matugen 4.2 für dieselbe Ausgangsfarbe ausgibt
// (Referenzwerte: `matugen color hex '#db79a9' -t scheme-… -m …`).
import { describe, expect, it } from "vitest";
import { effectiveSource, palette } from "../src/lib/color";

const base = { source: "#db79a9", scheme: "tonal-spot", mode: "dark", contrast: 0 } as const;

describe("Palette wie matugen", () => {
  it("tonal-spot dunkel", () => {
    const c = palette(base);
    expect(c.primary).toBe("#feb0d3");
    expect(c.surface).toBe("#191114");
  });
  it("vibrant dunkel", () => {
    const c = palette({ ...base, scheme: "vibrant" });
    expect(c.primary).toBe("#ffafd3");
    expect(c.surface).toBe("#1c1015");
  });
  it("tonal-spot hell", () => {
    const c = palette({ ...base, mode: "light" });
    expect([c.primary, c.surface, c.on_surface, c.tertiary]).toEqual(["#894a69", "#fff8f8", "#21191c", "#7f5539"]);
  });
  it("alle 49 Rollen sind gültige Farben", () => {
    const c = palette(base);
    expect(Object.keys(c)).toHaveLength(49);
    for (const v of Object.values(c)) expect(v).toMatch(/^#[0-9a-f]{6}$/);
  });
});

describe("Feinjustieren", () => {
  it("ohne Regler bleibt die Ausgangsfarbe", () => {
    expect(effectiveSource(base)).toBe("#db79a9");
    expect(effectiveSource({ ...base, tune: { hue: 0, chroma: 1 } })).toBe("#db79a9");
  });
  it("Farbton verschiebt die Ausgangsfarbe", () => {
    const shifted = effectiveSource({ ...base, tune: { hue: 40, chroma: 1 } });
    expect(shifted).not.toBe("#db79a9");
    expect(palette({ ...base, tune: { hue: 40, chroma: 1 } }).primary).toBe(palette({ ...base, source: shifted }).primary);
  });
  it("Überschreibungen ersetzen genau die Rolle", () => {
    const c = palette({ ...base, overrides: { primary: "#00ff00" } });
    expect(c.primary).toBe("#00ff00");
    expect(c.surface).toBe("#191114");
  });
});
