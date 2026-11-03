import { execFileSync } from "node:child_process";
import { mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { grade, ratio } from "../src/lib/contrast";
import { DEFAULT_PROMPT, ompTemplate, p10kOverlay, type PromptOptions } from "../src/lib/prompt";
import { nearestWallhavenColor } from "../src/lib/wallhaven";

describe("Kontrast (WCAG)", () => {
  it("Schwarz/Weiß = 21, gleiche Farbe = 1", () => {
    expect(ratio("#000000", "#ffffff")).toBeCloseTo(21, 5);
    expect(ratio("#777777", "#777777")).toBe(1);
  });
  it("Stufen", () => {
    expect([grade(8), grade(5), grade(3.2), grade(2)]).toEqual(["aaa", "aa", "large", "fail"]);
  });
});

describe("wallhaven-Farben", () => {
  it("nimmt die nächstliegende der 29 Farben", () => {
    expect(nearestWallhavenColor("#db79a9")).toBe("ea4c88");
    expect(nearestWallhavenColor("#3669cc")).toBe("0066cc");
    expect(nearestWallhavenColor("#000000")).toBe("000000");
  });
});

const zshAvailable = (() => { try { execFileSync("zsh", ["--version"]); return true; } catch { return false; } })();
const styles: PromptOptions["style"][] = ["lean", "classic", "rainbow", "pure"];

describe("Prompt", () => {
  for (const style of styles) {
    const o: PromptOptions = { ...DEFAULT_PROMPT, enabled: true, style, lines: style === "pure" ? 1 : 2, icons: true, separator: "round", right: ["status", "exec", "python", "time"] };
    it(`oh-my-posh-Vorlage ${style}: gültiges JSON mit Farb-Platzhaltern`, () => {
      const t = ompTemplate(o);
      expect(() => JSON.parse(t)).not.toThrow();
      expect(t).toContain("{{colors.primary.default.hex}}");
      expect(t).toContain("{{ .Path }}");
    });
    it.skipIf(!zshAvailable)(`p10k-Ergänzung ${style}: gültiges zsh, setzt die Elemente`, () => {
      const dir = mkdtempSync(join(tmpdir(), "p10k-"));
      const f = join(dir, "p.zsh");
      writeFileSync(f, p10kOverlay(o));
      execFileSync("zsh", ["-n", f]);
      const out = execFileSync("zsh", ["-f", "-c", `source ${f}; print -r -- $POWERLEVEL9K_LEFT_PROMPT_ELEMENTS`]).toString().trim();
      expect(out).toBe(style === "pure" ? "dir vcs prompt_char" : "dir vcs newline prompt_char");
    });
  }
});
