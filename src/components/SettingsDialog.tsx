// Einstellungen der App (pro Rechner): Speicherorte für Wallpaper und Exporte.
import { useEffect, useRef, useState } from "react";
import { useDialog } from "../lib/useDialog";
import { isTauri } from "../lib/platform";
import { pickFolder, type AppSettings } from "../lib/settings";

interface Props {
  value: AppSettings;
  singleKeys: boolean;
  onSingleKeys: (on: boolean) => void;
  onSave: (s: AppSettings) => void;
  onClose: () => void;
}

export function SettingsDialog({ value, singleKeys, onSingleKeys, onSave, onClose }: Props) {
  const sheetRef = useRef<HTMLDivElement>(null);
  useDialog(sheetRef);
  const [s, setS] = useState(value);
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
    <div className="overlay" role="dialog" aria-modal="true" aria-label="Einstellungen" onClick={onClose}>
      <div ref={sheetRef} tabIndex={-1} className="sheet settings" onClick={(e) => e.stopPropagation()}>
        <div className="wh-head">
          <h2>Einstellungen</h2>
          <span className="grow" />
          <button type="button" className="ghost" onClick={onClose} aria-label="Schließen">✕</button>
        </div>
        {!isTauri ? (
          <p className="empty pad">Speicherorte gibt es in der Desktop-App. Im Browser landen Dateien im Download-Ordner des Browsers.</p>
        ) : (
          <div className="pad form">
            <label>
              <span>Wallpaper-Ordner<small>wallhaven-Bilder werden hier gespeichert – auch für wintheme / wallthemes nutzbar</small></span>
              <div className="pick">
                <input className="name" value={s.wallpaperDir} onChange={(e) => setS({ ...s, wallpaperDir: e.target.value })} />
                <button type="button" className="ghost" onClick={() => choose("wallpaperDir")}>Wählen …</button>
              </div>
            </label>
            <label>
              <span>Export-Ordner<small>„Herunterladen“ speichert Theme-Dateien, VS-Code-Erweiterung usw. hier</small></span>
              <div className="pick">
                <input className="name" value={s.exportDir} onChange={(e) => setS({ ...s, exportDir: e.target.value })} />
                <button type="button" className="ghost" onClick={() => choose("exportDir")}>Wählen …</button>
              </div>
            </label>
            <label className="check">
              <input type="checkbox" checked={s.askOnSave} onChange={(e) => setS({ ...s, askOnSave: e.target.checked })} />
              <span>Beim Speichern jedes Mal nach dem Ort fragen</span>
            </label>
          </div>
        )}
        <div className="pad form">
          <label className="check">
            <input type="checkbox" checked={singleKeys} onChange={(e) => onSingleKeys(e.target.checked)} />
            <span>Einzeltasten-Kürzel (1–9 Variante, D/H dunkel/hell, Z Zufall)<small> – ausschalten, falls du Spracheingabe oder einen Screenreader nutzt</small></span>
          </label>
        </div>
        <div className="wh-foot">
          <span className="grow" />
          <button type="button" className="ghost" onClick={onClose}>{isTauri ? "Abbrechen" : "Schließen"}</button>
          {isTauri && <button type="button" className="primary" onClick={() => { onSave(s); onClose(); }}>Übernehmen</button>}
        </div>
      </div>
    </div>
  );
}
