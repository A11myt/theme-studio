// „Hintergrund-Programme“ im Anwenden-Dialog (Windows): Autostart und Dienste einzeln abschalten –
// Theme Studio selbst, Farb-Automatik, komorebi, whkd, altes wintheme, Win-Tastenkombinationen.
import { useCallback, useEffect, useState } from "react";
import { loadAuto, storeAuto } from "../lib/background";
import { t } from "../lib/i18n";
import { errText } from "../lib/platform";
import { stamp } from "../lib/windows/apply";
import type { Bridge, WinEnv } from "../lib/windows/bridge";
import { komorebiAutostartOff, restoreWinKeys, serviceStatus, startKomorebi, stopKomorebi, stopWhkd, whkdAutostartOff, winthemeOff, type ServiceStatus } from "../lib/windows/services";

interface Props {
  bridge: Bridge;
  env: WinEnv;
  busy: boolean;
  onSession: (session: string) => void;   // für „Rückgängig“
  onNote: (note: string) => void;
}

export function ServicesPanel({ bridge: b, env: e, busy, onSession, onNote }: Props) {
  const [st, setSt] = useState<ServiceStatus>();
  const [studio, setStudio] = useState(false);
  const [auto, setAuto] = useState(() => loadAuto().enabled);
  const [working, setWorking] = useState("");

  const refresh = useCallback(async () => {
    setSt(await serviceStatus(b, e).catch(() => undefined));
    const { invoke } = await import("@tauri-apps/api/core");
    setStudio(await invoke<boolean>("autostart_get").catch(() => false));
    setAuto(loadAuto().enabled);
  }, [b, e]);
  useEffect(() => { void refresh(); }, [refresh]);
  // Status alle 5 Sekunden aktualisieren (solange kein Vorgang läuft)
  useEffect(() => {
    if (busy || working) return;
    const id = setInterval(() => { void refresh(); }, 5000);
    return () => clearInterval(id);
  }, [busy, working, refresh]);

  /** Eine Aktion mit eigener Sicherung, Protokoll und Meldung. */
  const act = async (id: string, label: string, f: (session: string, details: string[]) => Promise<string | void>) => {
    setWorking(id);
    const details: string[] = [];
    try {
      const session = await b.backupBegin(label);
      const msg = await f(session, details);
      await b.log(["", `=== ${stamp()} ${label} – Sicherung ${session}`, ...details.map((x) => `           ${x}`)]).catch(() => undefined);
      onSession(session);
      onNote(msg || t("{what}: erledigt", { what: label }));
    } catch (err) {
      onNote(t("{what} fehlgeschlagen: {e}", { what: label, e: errText(err) }));
    }
    await refresh();
    setWorking("");
  };

  const studioOff = async () => {
    setWorking("studio");
    try {
      const { invoke } = await import("@tauri-apps/api/core");
      await invoke("autostart_set", { on: false });
      onNote(t("Theme Studio startet nicht mehr mit Windows"));
    } catch (err) { onNote(errText(err)); }
    await refresh();
    setWorking("");
  };
  const autoOff = () => { storeAuto({ ...loadAuto(), enabled: false }); setAuto(false); onNote(t("Automatisch einfärben: aus")); };

  const dis = busy || !!working;
  const state = (running: boolean, autostart: boolean) =>
    [running ? t("läuft") : t("läuft nicht"), autostart ? t("startet mit Windows") : t("kein Autostart")].join(" · ");

  return (
    <details className="win-services">
      <summary>{t("Hintergrund-Programme und Autostart")}</summary>
      <ul className="win-targets">
        <li>
          <span><b>Theme Studio</b><small>{studio ? t("startet mit Windows") : t("kein Autostart")}</small></span>
          <button type="button" className="ghost" disabled={dis || !studio} onClick={studioOff}>{t("Autostart aus")}</button>
        </li>
        <li>
          <span><b>{t("Automatisch einfärben")}</b><small>{auto ? t("an – färbt bei jedem Wallpaper-Wechsel ein") : t("aus")}</small></span>
          <button type="button" className="ghost" disabled={dis || !auto} onClick={autoOff}>{t("Ausschalten")}</button>
        </li>
        {st?.komorebi.installed && (
          <li>
            <span><b>komorebi</b><small>{state(st.komorebi.running, st.komorebi.autostart)}</small></span>
            {!st.komorebi.running
              ? <button type="button" className="ghost" disabled={dis}
                  onClick={() => act("komorebi-start", t("komorebi starten"), async (_s, d) => { await startKomorebi(b, e, d); })}>{t("Starten")}</button>
              : <button type="button" className="ghost" disabled={dis}
                  onClick={() => act("komorebi-stop", t("komorebi beenden"), async (_s, d) => { await stopKomorebi(b, d); })}>{t("Beenden")}</button>}
            <button type="button" className="ghost" disabled={dis || !st.komorebi.autostart}
              onClick={() => act("komorebi-auto", t("komorebi aus dem Autostart"), async (s, d) => { await komorebiAutostartOff(b, e, s, d); })}>{t("Autostart aus")}</button>
          </li>
        )}
        {st?.whkd.installed && (
          <li>
            <span><b>whkd</b><small>{state(st.whkd.running, st.whkd.autostart)}</small></span>
            <button type="button" className="ghost" disabled={dis || !st.whkd.running}
              onClick={() => act("whkd-stop", t("whkd beenden"), async (_s, d) => { await stopWhkd(b, d); })}>{t("Beenden")}</button>
            <button type="button" className="ghost" disabled={dis || !st.whkd.autostart}
              onClick={() => act("whkd-auto", t("whkd aus dem Autostart"), async (s, d) => whkdAutostartOff(b, e, s, d))}>{t("Autostart aus")}</button>
          </li>
        )}
        {st?.wintheme.present && (
          <li>
            <span><b>{t("Altes wintheme")}</b><small>{st.wintheme.running ? t("Farb-Automatik läuft") : t("im Autostart")}</small></span>
            <button type="button" className="ghost" disabled={dis}
              onClick={() => act("wintheme", t("wintheme abschalten"), async (s, d) => { await winthemeOff(b, e, s, d); })}>{t("Abschalten")}</button>
          </li>
        )}
        {st?.hotkeys.taken && (
          <li>
            <span><b>{t("Win-Tastenkombinationen")}</b><small>{t("an whkd abgegeben (Win+1–7, Q, C, F, D, O, W)")}</small></span>
            <button type="button" className="ghost" disabled={dis}
              onClick={() => act("hotkeys", t("Win-Tasten zurück an Windows"), async (s, d) => { if (!(await restoreWinKeys(b, e, s, d))) return t("nichts zu tun"); })}>{t("Zurück an Windows")}</button>
          </li>
        )}
        {st && !st.komorebi.installed && !st.whkd.installed && !st.wintheme.present && !st.hotkeys.taken &&
          <li className="missing"><span><small>{t("komorebi, whkd und wintheme sind nicht installiert.")}</small></span></li>}
      </ul>
    </details>
  );
}
