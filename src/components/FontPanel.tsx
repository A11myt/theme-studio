// Schriften: Oberfläche, Mono (Terminal & Code), Akzent – je eine Auswahl mit Probezeile, dazu die Größen.
// Leer = Standard: die Programme behalten ihre Schrift. Nerd Fonts werden beim Auswählen installiert (App).
import { useEffect, useState } from "react";
import { cssFont, type Fonts } from "../lib/fonts";
import { systemFonts } from "../lib/platform";
import { FontPicker } from "./FontPicker";
import { t } from "../lib/i18n";

interface Props {
  fonts: Fonts;
  onChange: (f: Fonts) => void;
  refreshKey: number;
  onInstalled: () => void;
}

type Role = "ui" | "mono" | "accent";
export const ROLES: { key: Role; label: string; hint: string; sample: string; fallback: string }[] = [
  { key: "mono", label: "Mono", hint: "Terminal & Code", sample: "fn main() { println!(\"0O 1lI\"); }", fallback: "monospace" },
  { key: "ui", label: "Oberfläche", hint: "Leiste, Menüs, Fenster", sample: "Einstellungen · Bluetooth · 10:24", fallback: "sans-serif" },
  { key: "accent", label: "Akzent", hint: "Überschriften, Uhr", sample: "10:24 — Montag", fallback: "sans-serif" },
];

export function FontPanel({ fonts, onChange, refreshKey, onInstalled }: Props) {
  const [installed, setInstalled] = useState<string[]>([]);
  const [picking, setPicking] = useState<Role>();
  useEffect(() => { void systemFonts().then(setInstalled); }, [refreshKey]);
  const set = (patch: Partial<Fonts>) => onChange({ ...fonts, ...patch });
  const known = new Set(installed);

  return (
    <section className="card fonts">
      <div className="fonts-head">
        <h2>{t("Schrift")}<small>{t("leer = bleibt, wie es ist")}</small></h2>
      </div>
      <div className="font-rows">
        {ROLES.map((r) => {
          const v = fonts[r.key];
          return (
            <div key={r.key} className="font-row">
              <div className="font-label"><b>{t(r.label)}</b><small>{t(r.hint)}</small></div>
              <div className="font-pick">
                <button type="button" className="font-btn" onClick={() => setPicking(r.key)} aria-label={t("{role}-Schrift wählen", { role: t(r.label) })}>
                  <span style={v ? { fontFamily: cssFont(v, r.fallback) } : undefined}>{v || t("Standardschrift")}</span>
                  <small>{t("ändern")}</small>
                </button>
                {v && <button type="button" className="ghost icon" onClick={() => set({ [r.key]: "" } as Partial<Fonts>)} aria-label={t("Zurück auf Standard")} title={t("Zurück auf Standard")}>✕</button>}
              </div>
              <p className="sample" style={{ fontFamily: cssFont(v, r.fallback) }}>{t(r.sample)}</p>
              {v && installed.length > 0 && !known.has(v) && <small className="warn">{t("nicht installiert – Vorschau mit Ersatzschrift")}</small>}
            </div>
          );
        })}
        <div className="font-sizes">
          <label>{t("Oberfläche")}{" "}<input type="number" min={6} max={24} step={0.5} value={fonts.uiSize}
            onChange={(e) => set({ uiSize: Number(e.target.value) })} /> pt</label>
          <label>Mono <input type="number" min={6} max={24} step={0.5} value={fonts.monoSize}
            onChange={(e) => set({ monoSize: Number(e.target.value) })} /> pt</label>
        </div>
      </div>
      {picking && <FontPicker role={picking} title={t("{role}-Schrift wählen", { role: t(ROLES.find((r) => r.key === picking)!.label) })}
        installed={installed} onPick={(f) => set({ [picking]: f } as Partial<Fonts>)}
        onInstalled={() => { void systemFonts().then(setInstalled); onInstalled(); }} onClose={() => setPicking(undefined)} />}
    </section>
  );
}
