// Ausgangsfarben eines Bildes: das WebAssembly-Modul (matugens Rust-Code) muss dieselben 4 Farben liefern wie
// `matugen image test/fixtures/sample.png --show-source-colors`.
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import init, { sourceColors } from "../src/wasm/studio_color.js";

describe("Ausgangsfarben (WebAssembly)", () => {
  it("wie matugen", async () => {
    await init({ module_or_path: readFileSync(new URL("../src/wasm/studio_color_bg.wasm", import.meta.url)) });
    const img = new Uint8Array(readFileSync(new URL("./fixtures/sample.png", import.meta.url)));
    expect(sourceColors(img)).toEqual(["#4b51ae", "#c4477a", "#46a05a", "#b79463"]);
  });
  it("kaputte Datei → Fehler statt Absturz", async () => {
    await init({ module_or_path: readFileSync(new URL("../src/wasm/studio_color_bg.wasm", import.meta.url)) });
    expect(() => sourceColors(new Uint8Array([1, 2, 3]))).toThrow();
  });
});
