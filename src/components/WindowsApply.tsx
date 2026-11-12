// Anwenden unter Windows: vorher zeigen, was gefunden wurde (und was fehlt), dann je Ziel ein klares Ergebnis.
// Diagnose kopieren (für Hilfe), Protokolldatei, Rückgängig.
import { useEffect, useRef, useState } from "react";
import { effectiveSource, SCHEMES, type ThemeSettings } from "../lib/color";
import type { Fonts } from "../lib/fonts";
import { t } from "../lib/i18n";
import { copyText, errText, imageToDisk } from "../lib/platform";
import type { PromptOptions } from "../lib/prompt";
import type { StoredImage } from "../lib/store";
import { useDialog } from "../lib/useDialog";
import { applyAll, conflicts, detect, diagnose, LABELS, type Detection, type TargetId, type TargetResult } from "../lib/windows/apply";
import { tauriBridge, type Bridge, type WinEnv } from "../lib/windows/bridge";
import { resetAll } from "../lib/windows/reset";
import { rememberApply } from "../lib/background";
import { ServicesPanel } from "./ServicesPanel";

// Ziele, die der Nutzer abgewählt hat – bleiben abgewählt (z. B. komorebi nie einfärben)
const OFF_KEY = "theme-studio-win-off";
const loadOff = (): TargetId[] => { try { const v = JSON.parse(localStorage.getItem(OFF_KEY) ?? "[]"); return Array.isArray(v) ? v : []; } catch { return []; } };
const storeOff = (ids: TargetId[]) => { try { localStorage.setItem(OFF_KEY, JSON.stringify(ids)); } catch { /* egal */ } };

interface Props {
  name: string;
  settings: ThemeSettings;
  fonts: Fonts;
  prompt: PromptOptions;
  image?: StoredImage;
  wallpaperDir: string;
  onClose: () => void;
}

const ICON = { ok: "✓", warn: "⚠", skipped: "–", error: "✗" } as const;

export function WindowsApply({ name, settings, fonts, prompt, image, wallpaperDir, onClose }: Props) {
  const sheetRef = useRef<HTMLDivElement>(null);
  useDialog(sheetRef);
  const [bridge, setBridge] = useState<Bridge>();
  const [env, setEnv] = useState<WinEnv>();
  const [dets, setDets] = useState<Detection[]>([]);
  const [chosen, setChosen] = useState<Set<TargetId>>(new Set());
  const [setWall, setSetWall] = useState(!!image);
  useEffect(() => { if (image) setSetWall(true); }, [image]);   // Bild kam erst nach dem Öffnen → trotzdem vorschlagen
  const [titlebars, setTitlebars] = useState(false);
  const [withFonts, setWithFonts] = useState(true);
  const [state, setState] = useState<"detecting" | "ready" | "running" | "done">("detecting");
  const [results, setResults] = useState<TargetResult[]>([]);
  const [session, setSession] = useState<string>();
  const [logFile, setLogFile] = useState("");
  const [note, setNote] = useState("");
  const [warnings, setWarnings] = useState<string[]>([]);

  useEffect(() => {
    void (async () => {
      try {
        const b = await tauriBridge();
        const env = await b.env();
        const d = await detect(b, env);
        setWarnings(await conflicts(b, env));
        setBridge(b);
        setEnv(env);
        setDets(d);
        const off = loadOff();
        setChosen(new Set(d.filter((x) => x.found && !off.includes(x.id)).map((x) => x.id)));
        setLogFile(env.logFile);
        setState("ready");
      } catch (e) {
        setNote(t("Erkennung fehlgeschlagen: {e}", { e: errText(e) }));
        setState("ready");
      }
    })();
  }, []);

  const run = async () => {
    if (!bridge) return;
    setState("running");
    setNote("");
    try {
      const imagePath = setWall && image && wallpaperDir ? await imageToDisk(image.blob, image.name, wallpaperDir) : undefined;
      const r = await applyAll(bridge, { name, settings, fonts, prompt, imagePath, titlebars, withFonts, only: [...chosen] });
      setResults(r.results);
      setSession(r.session);
      setLogFile(r.logFile);
      // fürs automatische Einfärben merken, womit angewendet wurde
      rememberApply({ scheme: settings.scheme, mode: settings.mode, contrast: settings.contrast, fonts, prompt, titlebars, withFonts, only: [...chosen] });
    } catch (e) {
      setNote(t("Anwenden abgebrochen: {e}", { e: errText(e) }));
    }
    setState("done");
  };

  const reset = async () => {
    if (!bridge) return;
    const { ask } = await import("@tauri-apps/plugin-dialog");
    if (!(await ask(t("Alles wird zurückgesetzt: Akzentfarbe, Hell/Dunkel und Wallpaper wie vorher (sonst Windows-Standard), Terminal- und VS-Code-Farben, Prompt in den Shells, komorebi-Farben. Außerdem: Farb-Automatik und Tasten-Dienst whkd aus dem Autostart, Win-Tastenkombinationen zurück an Windows (Explorer startet dabei kurz neu). Deine eigenen Einstellungen bleiben. Fortfahren?"),
      { title: t("Auf Standard zurücksetzen"), kind: "warning" }))) return;
    setState("running");
    setNote("");
    try {
      const r = await resetAll(bridge);
      setResults(r.results);
      setSession(r.session);
      setLogFile(r.logFile);
      setNote(t("Zurückgesetzt. „Rückgängig“ holt den Stand von eben zurück."));
    } catch (e) {
      setNote(t("Zurücksetzen fehlgeschlagen: {e}", { e: errText(e) }));
    }
    setState("done");
  };

  const undo = async () => {
    if (!bridge || !session) return;
    try {
      const steps = await bridge.restore(session);
      await bridge.log([`=== Rückgängig ${session}`, ...steps.map((s) => `           ${s}`)]);
      setNote(t("Rückgängig gemacht ({n} Änderungen zurückgesetzt).", { n: steps.length }));
      setSession(undefined);
    } catch (e) {
      setNote(t("Rückgängig fehlgeschlagen: {e}", { e: errText(e) }));
    }
  };

  const copyDiag = async () => {
    if (!bridge) return;
    try {
      await copyText(await diagnose(bridge));
      setNote(t("Diagnose kopiert – Benutzername ist darin ersetzt."));
    } catch (e) {
      setNote(t("Diagnose fehlgeschlagen: {e}", { e: errText(e) }));
    }
  };

  const toggle = (id: TargetId) => {
    const n = new Set(chosen);
    const off = new Set(loadOff());
    if (n.has(id)) { n.delete(id); off.add(id); } else { n.add(id); off.delete(id); }
    storeOff([...off]);
    setChosen(n);
  };
  const counts = results.reduce((a, r) => ({ ...a, [r.status]: (a[r.status] ?? 0) + 1 }), {} as Record<string, number>);

  return (
    <div className="overlay" role="dialog" aria-modal="true" aria-label={t("Auf diesem Rechner anwenden")} onClick={() => state !== "running" && onClose()}>
      <div ref={sheetRef} tabIndex={-1} className="sheet settings win-apply" onClick={(e) => e.stopPropagation()}>
        <div className="wh-head">
          <h2>{t("Auf diesem Rechner anwenden")}</h2>
          <span className="grow" />
          <button type="button" className="ghost" onClick={onClose} disabled={state === "running"} aria-label={t("Schließen")}>✕</button>
        </div>
        <div className="pad form">
          <p className="win-summary"><i className="sw inline" style={{ background: effectiveSource(settings) }} /> <b>{name}</b> · {SCHEMES[settings.scheme].label} · {settings.mode === "dark" ? t("dunkel") : t("hell")}</p>

          {state === "detecting" && <p className="empty">{t("Suche installierte Programme …")}</p>}
          {warnings.map((w) => <p key={w} className="win-warn" role="alert">⚠ {w}</p>)}

          {(state === "ready" || state === "running") && (
            <>
              <ul className="win-targets">
                {dets.map((d) => (
                  <li key={d.id} className={d.found ? "" : "missing"}>
                    <label className="check">
                      <input type="checkbox" disabled={!d.found || state === "running"} checked={chosen.has(d.id)} onChange={() => toggle(d.id)} />
                      <span><b>{t(LABELS[d.id])}</b>
                        <small>{d.found ? (d.where.length ? d.where[0] + (d.where.length > 1 ? t(" (+{n} weitere)", { n: d.where.length - 1 }) : "") : "") : d.hint ?? ""}</small>
                      </span>
                    </label>
                  </li>
                ))}
              </ul>
              <label className="check"><input type="checkbox" checked={setWall} disabled={!image} onChange={(e) => setSetWall(e.target.checked)} />
                <span>{image ? t("Wallpaper setzen: {name}", { name: image.name }) : t("Wallpaper bleibt (kein Bild gewählt)")}</span></label>
              <label className="check"><input type="checkbox" checked={titlebars} onChange={(e) => setTitlebars(e.target.checked)} />
                <span>{t("Akzentfarbe auch in Titelleisten")}</span></label>
              <label className="check"><input type="checkbox" checked={withFonts && !!fonts.mono} disabled={!fonts.mono} onChange={(e) => setWithFonts(e.target.checked)} />
                <span>{fonts.mono ? t("Schrift anwenden: {font} (Terminal, VS Code)", { font: fonts.mono }) : t("Keine Schrift gewählt – Schriften bleiben, wie sie sind")}</span></label>
            </>
          )}
          {bridge && env?.os === "windows" && state !== "detecting" &&
            <ServicesPanel bridge={bridge} env={env} busy={state === "running"} onSession={setSession} onNote={setNote} />}

          {state === "done" && (
            <>
              <ul className="win-results" aria-live="polite">
                {results.map((r) => (
                  <li key={r.id} className={r.status}>
                    <span className="st" aria-hidden="true">{ICON[r.status]}</span>
                    <span><b>{t(r.label)}</b><small>{r.message}</small></span>
                  </li>
                ))}
              </ul>
              <p className="empty">{t("{ok} erledigt · {warn} mit Hinweis · {skipped} übersprungen · {error} Fehler",
                { ok: counts.ok ?? 0, warn: counts.warn ?? 0, skipped: counts.skipped ?? 0, error: counts.error ?? 0 })}</p>
            </>
          )}
          {note && <p className="win-note" role="status">{note}</p>}
          {logFile && <p className="empty small">{t("Protokoll: {file}", { file: logFile })}</p>}
        </div>
        <div className="wh-foot">
          <button type="button" className="ghost" onClick={copyDiag} disabled={!bridge}>{t("Diagnose kopieren")}</button>
          <button type="button" className="ghost danger" onClick={reset} disabled={!bridge || state === "running" || state === "detecting"}
            title={t("Alle Änderungen von Theme Studio entfernen – Windows wie vorher")}>{t("Auf Standard zurücksetzen")}</button>
          {session && state !== "running" && <button type="button" className="ghost" onClick={undo}>{t("Rückgängig")}</button>}
          <span className="grow" />
          <button type="button" className="ghost" onClick={onClose} disabled={state === "running"}>{state === "done" ? t("Schließen") : t("Abbrechen")}</button>
          {state !== "done" && <button type="button" className="primary" onClick={run} disabled={state !== "ready" || !chosen.size}>
            {state === "running" ? t("Wird angewendet …") : t("Anwenden")}</button>}
          {state === "done" && <button type="button" className="primary" onClick={() => { setResults([]); setState("ready"); }}>{t("Nochmal")}</button>}
        </div>
      </div>
    </div>
  );
}
