// Einstellungen „Im Hintergrund“ (Desktop-App unter Windows): automatisch einfärben, im Infobereich weiterlaufen, mit Windows starten.
import { useEffect, useState } from "react";
import { loadAuto, recolorFromWallpaper, storeAuto } from "../lib/background";
import { t } from "../lib/i18n";

export function BackgroundSettings() {
  const [a, setA] = useState(loadAuto);
  const [installed, setInstalled] = useState(false);
  const [autostart, setAutostart] = useState(false);
  const [note, setNote] = useState("");
  useEffect(() => {
    void (async () => {
      const { invoke } = await import("@tauri-apps/api/core");
      setInstalled(await invoke<boolean>("is_installed").catch(() => false));
      setAutostart(await invoke<boolean>("autostart_get").catch(() => false));
    })();
  }, []);
  const set = (patch: Partial<typeof a>) => { const n = { ...a, ...patch }; setA(n); storeAuto(n); };
  const toggleAutostart = async (on: boolean) => {
    const { invoke } = await import("@tauri-apps/api/core");
    try {
      await invoke("autostart_set", { on });
      setAutostart(on);
      if (on && !a.closeToTray) set({ closeToTray: true });   // Autostart ohne Infobereich ergibt keinen Sinn
    } catch (e) { setNote(String(e)); }
  };
  const now = async () => {
    setNote(t("Färbt ein …"));
    try { setNote(await recolorFromWallpaper()); } catch (e) { setNote(String(e)); }
  };

  return (
    <div className="pad form bg-settings">
      <h3>{t("Im Hintergrund")}</h3>
      <label className="check">
        <input type="checkbox" checked={a.enabled} onChange={(e) => set({ enabled: e.target.checked })} />
        <span>{t("Automatisch einfärben, wenn sich das Windows-Wallpaper ändert")}
          <small>{a.last ? t("mit Variante, Modus, Schrift und Zielen vom letzten „Anwenden“") : t("erst einmal von Hand „Anwenden“ – das legt Variante und Ziele fest")}</small></span>
      </label>
      <label className="check">
        <input type="checkbox" checked={a.closeToTray} onChange={(e) => set({ closeToTray: e.target.checked })} />
        <span>{t("Beim Schließen im Infobereich weiterlaufen")}<small>{t("Symbol neben der Uhr: Öffnen, Theme anwenden, Automatisch einfärben, Beenden")}</small></span>
      </label>
      <label className="check">
        <input type="checkbox" checked={autostart} disabled={!installed} onChange={(e) => void toggleAutostart(e.target.checked)} />
        <span>{t("Mit Windows starten (unsichtbar im Infobereich)")}
          <small>{installed ? t("startet beim Anmelden ohne Fenster") : t("nur in der installierten Version – die portable exe kann umziehen")}</small></span>
      </label>
      <div className="bg-actions">
        <button type="button" className="ghost" onClick={now} disabled={!a.last}>{t("Jetzt aus dem Wallpaper einfärben")}</button>
        {note && <small className="empty">{note}</small>}
      </div>
    </div>
  );
}
