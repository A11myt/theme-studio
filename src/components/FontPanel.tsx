// Schrift-Bereich: fontgen-Profile als Vorlage, drei Schriften mit Vorschau, Größen, Liste installierter Schriften.
// Gespeichert wird nur der Name (Verweis) – keine Schriftdateien im Projekt.
import { useEffect, useState } from "react";
import { cssFont, FONT_PRESETS, type Fonts } from "../lib/fonts";
import { isTauri, systemFonts } from "../lib/platform";
import { t } from "../lib/i18n";

interface Props {
  fonts: Fonts;
  onChange: (f: Fonts) => void;
  onNerdFonts: () => void;
  refreshKey: number;     // nach Installation neu laden
}

export const ROLES: { key: "ui" | "mono" | "accent"; label: string; hint: string; sample: string; fallback: string }[] = [
  { key: "ui", label: "Oberfläche", hint: "Leiste, Menüs, Fenster", sample: "Einstellungen · Bluetooth · 10:24", fallback: "sans-serif" },
  { key: "mono", label: "Mono", hint: "Terminal & Code", sample: "fn main() { println!(\"0O 1lI\"); }", fallback: "monospace" },
  { key: "accent", label: "Akzent", hint: "Überschriften, Uhr", sample: "10:24 — Montag", fallback: "sans-serif" },
];

export function FontPanel({ fonts, onChange, onNerdFonts, refreshKey }: Props) {
  const [installed, setInstalled] = useState<string[]>([]);
  useEffect(() => { void systemFonts().then(setInstalled); }, [refreshKey]);

  const known = new Set(installed);
  const set = (patch: Partial<Fonts>) => onChange({ ...fonts, ...patch });
  const preset = Object.entries(FONT_PRESETS).find(([, p]) => JSON.stringify(p) === JSON.stringify(fonts))?.[0];

  return (
    <section className="card fonts">
      <div className="fonts-head">
        <h2>{t("Schrift")}</h2>
        <div className="seg" role="group" aria-label={t("fontgen-Profil")}>
          {Object.keys(FONT_PRESETS).map((k) => (
            <button key={k} type="button" aria-pressed={preset === k} onClick={() => onChange(FONT_PRESETS[k])}>{k}</button>
          ))}
        </div>
        <span className="grow" />
        {isTauri
          ? <button type="button" className="ghost" onClick={onNerdFonts}>{t("Nerd Fonts von GitHub …")}</button>
          : <small className="empty">{t("Nerd Fonts installieren: in der App")}</small>}
      </div>
      <datalist id="installed-fonts">{installed.map((f) => <option key={f} value={f} />)}</datalist>
      <div className="font-rows">
        {ROLES.map((r) => (
          <div key={r.key} className="font-row">
            <label>
              <span>{t(r.label)}<small>{t(r.hint)}</small></span>
              <input className="name" list="installed-fonts" value={fonts[r.key]}
                onChange={(e) => set({ [r.key]: e.target.value } as Partial<Fonts>)} />
            </label>
            <p className="sample" style={{ fontFamily: cssFont(fonts[r.key], r.fallback) }}>{t(r.sample)}</p>
            {installed.length > 0 && !known.has(fonts[r.key]) &&
              <small className="warn">{t("nicht installiert – Vorschau mit Ersatzschrift")}</small>}
          </div>
        ))}
        <div className="font-sizes">
          <label>{t("Oberfläche")}{" "}<input type="number" min={6} max={24} step={0.5} value={fonts.uiSize}
            onChange={(e) => set({ uiSize: Number(e.target.value) })} /> pt</label>
          <label>Mono <input type="number" min={6} max={24} step={0.5} value={fonts.monoSize}
            onChange={(e) => set({ monoSize: Number(e.target.value) })} /> pt</label>
        </div>
      </div>
    </section>
  );
}
