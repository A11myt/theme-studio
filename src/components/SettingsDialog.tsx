// Einstellungen der App (pro Rechner): Speicherorte für Wallpaper und Exporte.
import { useEffect, useRef, useState } from "react";
import { isTauri } from "../lib/platform";
import { pickFolder, type AppSettings } from "../lib/settings";

interface Props {
  value: AppSettings;
  onSave: (s: AppSettings) => void;
  onClose: () => void;
}

export function SettingsDialog({ value, onSave, onClose }: Props) {
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
      <div className="sheet settings" onClick={(e) => e.stopPropagation()}>
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
        <div className="wh-foot">
          <span className="grow" />
          <button type="button" className="ghost" onClick={onClose}>Abbrechen</button>
          {isTauri && <button type="button" className="primary" onClick={() => { onSave(s); onClose(); }}>Übernehmen</button>}
        </div>
      </div>
    </div>
  );
}
