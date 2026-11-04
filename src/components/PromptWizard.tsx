// Prompt-Assistent wie `p10k configure`: eine Frage pro Schritt, jede Antwort mit Live-Vorschau im Theme.
import { useEffect, useRef, useState } from "react";
import { useDialog } from "../lib/useDialog";
import type { Palette } from "../lib/color";
import { cssFont, type Fonts } from "../lib/fonts";
import { CHARS, RIGHT_LABELS, type PromptOptions, type RightItem } from "../lib/prompt";
import { PromptView } from "./PromptView";
import { t } from "../lib/i18n";

interface Props {
  value: PromptOptions;
  c: Palette;
  fonts: Fonts;
  onDone: (o: PromptOptions) => void;
  onClose: () => void;
}

interface Choice { label: string; hint?: string; patch: Partial<PromptOptions> }
interface Step { id: string; title: string; when?: (o: PromptOptions) => boolean; choices?: (o: PromptOptions) => Choice[]; multi?: true }

export const STEPS: Step[] = [
  { id: "style", title: "Welcher Stil?", choices: () => [
    { label: "Lean", hint: "ohne Hintergründe, wie jetzt", patch: { style: "lean" } },
    { label: "Classic", hint: "dunkle Blöcke mit Trennern", patch: { style: "classic" } },
    { label: "Rainbow", hint: "farbige Blöcke", patch: { style: "rainbow" } },
    { label: "Pure", hint: "minimal, eine Zeile", patch: { style: "pure", lines: 1, frame: false, icons: false, right: ["exec"] } },
  ] },
  { id: "lines", title: "Wie viele Zeilen?", when: (o) => o.style !== "pure", choices: () => [
    { label: "Zwei Zeilen", hint: "Eingabe immer links, viel Platz", patch: { lines: 2 } },
    { label: "Eine Zeile", hint: "kompakt", patch: { lines: 1 } },
  ] },
  { id: "frame", title: "Rahmen um die zwei Zeilen?", when: (o) => o.lines === 2, choices: () => [
    { label: "Mit Rahmen", hint: "╭─ / ╰─", patch: { frame: true } },
    { label: "Ohne", patch: { frame: false } },
  ] },
  { id: "separator", title: "Form der Trenner?", when: (o) => o.style === "classic" || o.style === "rainbow", choices: () => [
    { label: "Spitz", patch: { separator: "angled" } },
    { label: "Rund", patch: { separator: "round" } },
    { label: "Schräg", patch: { separator: "slanted" } },
    { label: "Flach", patch: { separator: "flat" } },
  ] },
  { id: "icons", title: "Symbole?", choices: () => [
    { label: "Wenige", hint: "nur Text", patch: { icons: false } },
    { label: "Viele", hint: "Ordner, Branch, Uhr … (Nerd Font nötig)", patch: { icons: true } },
  ] },
  { id: "char", title: "Prompt-Zeichen?", choices: () => CHARS.map((ch) => ({ label: ch, patch: { char: ch } })) },
  { id: "right", title: "Was soll rechts stehen?", multi: true },
  { id: "time", title: "Uhrzeit?", choices: (o) => [
    { label: "10:24:37", patch: { time: "24s", right: [...new Set<RightItem>([...o.right, "time"])] } },
    { label: "10:24", patch: { time: "24", right: [...new Set<RightItem>([...o.right, "time"])] } },
    { label: "10:24 AM", patch: { time: "12", right: [...new Set<RightItem>([...o.right, "time"])] } },
    { label: "Keine", patch: { right: o.right.filter((r) => r !== "time") } },
  ] },
  { id: "transient", title: "Ältere Prompts zusammenfalten?", choices: () => [
    { label: "Ja", hint: "nur „{char}“ bleibt stehen – übersichtlicher Verlauf", patch: { transient: true } },
    { label: "Nein", hint: "jeder Prompt bleibt vollständig", patch: { transient: false } },
  ] },
];

export function PromptWizard({ value, c, fonts, onDone, onClose }: Props) {
  const sheetRef = useRef<HTMLDivElement>(null);
  useDialog(sheetRef);
  const [o, setO] = useState<PromptOptions>({ ...value, enabled: true });
  const [i, setI] = useState(0);
  const closeRef = useRef(onClose);
  closeRef.current = onClose;
  // Tasten: Esc schließt, 1–9 wählt eine Antwort (wie bei p10k configure), ← zurück
  const keyRef = useRef<(e: KeyboardEvent) => void>(() => {});
  useEffect(() => {
    const h = (e: KeyboardEvent) => keyRef.current(e);
    window.addEventListener("keydown", h);
    return () => window.removeEventListener("keydown", h);
  }, []);

  const visible = STEPS.filter((s) => !s.when || s.when(o));
  const done = i >= visible.length;
  const step = visible[Math.min(i, visible.length - 1)];
  const next = (patch?: Partial<PromptOptions>) => { if (patch) setO((x) => ({ ...x, ...patch })); setI((n) => n + 1); };
  keyRef.current = (e: KeyboardEvent) => {
    if (e.key === "Escape") return closeRef.current();
    if (e.key === "ArrowLeft") return setI((n) => Math.max(0, n - 1));
    if (done || step.multi || !/^[1-9]$/.test(e.key)) return;
    const ch = step.choices!(o)[Number(e.key) - 1];
    if (ch) next(ch.patch);
  };
  const term = (opts: PromptOptions) => (
    <div className="wiz-term" style={{ background: c.background, fontFamily: cssFont(fonts.mono, "monospace") }}>
      <PromptView o={opts} c={c} />
    </div>
  );

  return (
    <div className="overlay" role="dialog" aria-modal="true" aria-label={t("Prompt-Assistent")} onClick={onClose}>
      <div ref={sheetRef} tabIndex={-1} className="sheet wizard" onClick={(e) => e.stopPropagation()}>
        <div className="wh-head">
          <h2>{t("Prompt-Assistent")}{" "}<small>{done ? "Fertig" : t("Schritt {i} von {n}", { i: i + 1, n: visible.length })}</small></h2>
          <span className="grow" />
          <button type="button" className="ghost" onClick={onClose} aria-label={t("Schließen")}>✕</button>
        </div>
        <div className="wiz-progress"><i style={{ width: `${(Math.min(i, visible.length) / visible.length) * 100}%` }} /></div>
        <div className="pad">
          {done ? (
            <>
              <h3>{t("So sieht dein Prompt aus")}</h3>
              {term(o)}
              <p className="empty">{t("Mit „Übernehmen“ wird er im Studio eingeschaltet. Auf dem Rechner landet er beim nächsten „Anwenden“ in den gewählten Shells – oder über die Dateien im Bereich Terminal.")}</p>
            </>
          ) : step.multi ? (
            <>
              <h3>{t(step.title)}</h3>
              {term(o)}
              <div className="wiz-multi">
                {(Object.keys(RIGHT_LABELS) as RightItem[]).map((r) => (
                  <label key={r} className="check">
                    <input type="checkbox" checked={o.right.includes(r)}
                      onChange={(e) => setO((x) => ({ ...x, right: e.target.checked ? [...x.right, r] : x.right.filter((y) => y !== r) }))} />
                    {t(RIGHT_LABELS[r])}
                  </label>
                ))}
              </div>
            </>
          ) : (
            <>
              <h3>{t(step.title)}</h3>
              <div className="wiz-choices">
                {step.choices!(o).map((ch, k) => {
                  const preview = { ...o, ...ch.patch };
                  return (
                    <button key={k} type="button" className="wiz-choice" onClick={() => next(ch.patch)}>
                      <span className="wiz-label"><kbd>{k + 1}</kbd><b>{t(ch.label)}</b>{ch.hint && <small>{t(ch.hint, { char: o.char })}</small>}</span>
                      {term(preview)}
                    </button>
                  );
                })}
              </div>
            </>
          )}
        </div>
        <div className="wh-foot">
          <button type="button" className="ghost" onClick={() => setI((n) => Math.max(0, n - 1))} disabled={i === 0}>{t("← Zurück")}</button>
          <span className="grow" />
          {!done && <button type="button" className="ghost" onClick={() => next()}>{step.multi ? t("Weiter →") : t("Überspringen")}</button>}
          {done && <button type="button" className="primary" onClick={() => { onDone(o); onClose(); }}>{t("Übernehmen")}</button>}
        </div>
      </div>
    </div>
  );
}
