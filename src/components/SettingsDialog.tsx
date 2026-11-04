// Einstellungen der App (pro Rechner): Speicherorte für Wallpaper und Exporte.
import { useEffect, useRef, useState } from "react";
import { useDialog } from "../lib/useDialog";
import { isTauri } from "../lib/platform";
import { pickFolder, type AppSettings } from "../lib/settings";
import { setLang, t, useLang } from "../lib/i18n";
import type { Detected, SystemChoice } from "../lib/system";

interface Props {
  value: AppSettings;
  singleKeys: boolean;
  onSingleKeys: (on: boolean) => void;
  system: SystemChoice;
  detected?: Detected;
  onSystem: (c: SystemChoice) => void;
  onSave: (s: AppSettings) => void;
  onClose: () => void;
}

export function SettingsDialog({ value, singleKeys, onSingleKeys, system, detected, onSystem, onSave, onClose }: Props) {
  const sheetRef = useRef<HTMLDivElement>(null);
  useDialog(sheetRef);
  const [s, setS] = useState(value);
  const lang = useLang();
  const closeRef = useRef(onClose);
  closeRef.current = onClose;
  useEffect(() => {
    const esc = (e: KeyboardEvent) => e.key === "Escape" && closeRef.current();
    window.addEventListener("keydown", esc);
    return () => window.removeEventListener("keydown", esc);
  }, []);

  const choose = async (key: "wallpaperDir" | "exportDir") => {
    const dir = await pickFolder(s[key]);
    if (dir) setS({ ...s, [key]: dir });
  };

  return (
    <div className="overlay" role="dialog" aria-modal="true" aria-label={t("Einstellungen")} onClick={onClose}>
      <div ref={sheetRef} tabIndex={-1} className="sheet settings" onClick={(e) => e.stopPropagation()}>
        <div className="wh-head">
          <h2>{t("Einstellungen")}</h2>
          <span className="grow" />
          <button type="button" className="ghost" onClick={onClose} aria-label={t("Schließen")}>✕</button>
        </div>
        {!isTauri ? (
          <p className="empty pad">{t("Speicherorte gibt es in der Desktop-App. Im Browser landen Dateien im Download-Ordner des Browsers.")}</p>
        ) : (
          <div className="pad form">
            <label>
              <span>{t("Wallpaper-Ordner")}<small>{t("wallhaven-Bilder werden hier gespeichert")}</small></span>
              <div className="pick">
                <input className="name" value={s.wallpaperDir} onChange={(e) => setS({ ...s, wallpaperDir: e.target.value })} />
                <button type="button" className="ghost" onClick={() => choose("wallpaperDir")}>{t("Wählen …")}</button>
              </div>
            </label>
            <label>
              <span>{t("Export-Ordner")}<small>{t("„Herunterladen“ speichert Theme-Dateien, VS-Code-Erweiterung usw. hier")}</small></span>
              <div className="pick">
                <input className="name" value={s.exportDir} onChange={(e) => setS({ ...s, exportDir: e.target.value })} />
                <button type="button" className="ghost" onClick={() => choose("exportDir")}>{t("Wählen …")}</button>
              </div>
            </label>
            <label className="check">
              <input type="checkbox" checked={s.askOnSave} onChange={(e) => setS({ ...s, askOnSave: e.target.checked })} />
              <span>{t("Beim Speichern jedes Mal nach dem Ort fragen")}</span>
            </label>
          </div>
        )}
        <div className="pad form">
          <div className="lang-row">
            <span>{t("System")}<small>{t("wofür „Anwenden“ Themes einrichtet")}</small></span>
            <div className="seg" role="group" aria-label={t("System")}>
              <button type="button" aria-pressed={system === "auto"} onClick={() => onSystem("auto")}
                title={detected ? t("erkannt: {name}", { name: detected.name }) : undefined}>
                {t("Automatisch")}{detected ? ` (${detected.system === "windows" ? "Windows" : "Linux"})` : ""}</button>
              <button type="button" aria-pressed={system === "windows"} onClick={() => onSystem("windows")}>Windows</button>
              <button type="button" aria-pressed={system === "linux"} onClick={() => onSystem("linux")}>Linux</button>
            </div>
          </div>
          {detected && system !== "auto" && system !== detected.system &&
            <small className="warn">{t("Achtung: Die App läuft auf {name} – Anwenden für {sys} wird hier vermutlich nicht funktionieren.", { name: detected.name, sys: system === "windows" ? "Windows" : "Linux" })}</small>}
          <div className="lang-row">
            <span>{t("Sprache")}</span>
            <div className="seg" role="group" aria-label={t("Sprache")}>
              <button type="button" aria-pressed={lang === "de"} onClick={() => setLang("de")}>Deutsch</button>
              <button type="button" aria-pressed={lang === "en"} onClick={() => setLang("en")}>English</button>
            </div>
          </div>
          <label className="check">
            <input type="checkbox" checked={singleKeys} onChange={(e) => onSingleKeys(e.target.checked)} />
            <span>{t("Einzeltasten-Kürzel (1–9 Variante, D/H dunkel/hell, Z Zufall)")}<small>{" "}{t("– ausschalten, falls du Spracheingabe oder einen Screenreader nutzt")}</small></span>
          </label>
        </div>
        <div className="wh-foot">
          <span className="grow" />
          <button type="button" className="ghost" onClick={onClose}>{isTauri ? t("Abbrechen") : t("Schließen")}</button>
          {isTauri && <button type="button" className="primary" onClick={() => { onSave(s); onClose(); }}>{t("Übernehmen")}</button>}
        </div>
      </div>
    </div>
  );
}
