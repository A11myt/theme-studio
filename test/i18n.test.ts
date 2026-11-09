// Jeder sichtbare Text braucht eine englische Übersetzung – sonst erscheint er auf Englisch als Deutsch.
import { describe, expect, it } from "vitest";
// @ts-expect-error – Hilfsskript ohne Typen
import { sourceKeys } from "../scripts/i18n-keys.mjs";
import { SCHEMES } from "../src/lib/color";
import { GRADE_LABEL, PAIRS } from "../src/lib/contrast";
import { exportsFor } from "../src/lib/exporters";
import { FONT_PRESETS } from "../src/lib/fonts";
import { EN } from "../src/lib/i18n.en";
import { RIGHT_LABELS } from "../src/lib/prompt";
import { PALETTE_GROUPS } from "../src/useStudio";
import { ROLES } from "../src/components/FontPanel";
import { STEPS } from "../src/components/PromptWizard";
import { DEFAULT_PROMPT } from "../src/lib/prompt";
import { LABELS } from "../src/lib/windows/apply";

function allKeys(): string[] {
  const keys = new Set<string>(sourceKeys("src"));
  for (const s of Object.values(SCHEMES)) keys.add(s.hint);
  for (const g of Object.values(GRADE_LABEL)) keys.add(g);
  for (const [, , label] of PAIRS) keys.add(label);
  for (const f of exportsFor("x", { source: "#db79a9", scheme: "tonal-spot", mode: "dark", contrast: 0 }, undefined, FONT_PRESETS.iosevka)) { keys.add(f.label); keys.add(f.hint); }
  for (const l of Object.values(RIGHT_LABELS)) keys.add(l);
  for (const [title] of PALETTE_GROUPS) keys.add(title);
  for (const r of ROLES) { keys.add(r.label); keys.add(r.hint); keys.add(r.sample); }
  for (const s of STEPS) {
    keys.add(s.title);
    for (const c of s.choices?.(DEFAULT_PROMPT) ?? []) { keys.add(c.label); if (c.hint) keys.add(c.hint); }
  }
  for (const h of ["Grau", "Pink", "Rot", "Orange", "Gelb", "Grün", "Türkis", "Blau", "Violett"]) keys.add(h);
  for (const l of Object.values(LABELS)) keys.add(l);
  for (const tab of ["Sammlung", "Farbe", "Schrift", "Terminal", "Vorschau", "Export"]) keys.add(tab);
  return [...keys].filter((k) => /[A-Za-zÄÖÜäöüß]/.test(k)).sort();
}

describe("Übersetzungen", () => {
  it("jeder Text hat eine englische Fassung", () => {
    const missing = allKeys().filter((k) => !(k in EN));
    if (missing.length) console.log(JSON.stringify(missing, null, 1));
    expect(missing).toEqual([]);
  });
  it("Platzhalter stimmen überein", () => {
    const bad = Object.entries(EN).filter(([de, en]) =>
      JSON.stringify((de.match(/\{\w+\}/g) ?? []).sort()) !== JSON.stringify((en.match(/\{\w+\}/g) ?? []).sort()));
    expect(bad).toEqual([]);
  });
  it("kein veralteter Eintrag", () => {
    const keys = new Set(allKeys());
    expect(Object.keys(EN).filter((k) => !keys.has(k))).toEqual([]);
  });
});
