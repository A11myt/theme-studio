// Theme auf diesem Rechner anwenden: zeigt vorher, was passiert, danach das Protokoll der Programme.
import { useEffect, useRef, useState } from "react";
import { useDialog } from "../lib/useDialog";
import { effectiveSource, SCHEMES, type ThemeSettings } from "../lib/color";
import { FONT_PRESETS, type Fonts } from "../lib/fonts";
import { ompTemplate, p10kOverlay, type PromptOptions } from "../lib/prompt";
import { applyTheme, errText, imageToDisk } from "../lib/platform";
import type { StoredImage } from "../lib/store";

interface Props {
  settings: ThemeSettings;
  fonts: Fonts;
  prompt: PromptOptions;
  image?: StoredImage;
  wallpaperDir: string;
  onClose: () => void;
}

const isWindows = navigator.userAgent.includes("Windows");

export function ApplyDialog({ settings, fonts, prompt, image, wallpaperDir, onClose }: Props) {
  const sheetRef = useRef<HTMLDivElement>(null);
  useDialog(sheetRef);
  const [state, setState] = useState<"ready" | "running" | "done" | "error">("ready");
  const [log, setLog] = useState("");
  const [withFonts, setWithFonts] = useState(true);
  const closeRef = useRef(onClose);
  closeRef.current = onClose;
  useEffect(() => {
    const esc = (e: KeyboardEvent) => e.key === "Escape" && closeRef.current();
    window.addEventListener("keydown", esc);
    return () => window.removeEventListener("keydown", esc);
  }, []);

  const src = effectiveSource(settings);
  const overrides = Object.fromEntries(Object.entries(settings.overrides ?? {}).filter(([, v]) => v)) as Record<string, string>;
  const preset = Object.entries(FONT_PRESETS).find(([, p]) => JSON.stringify(p) === JSON.stringify(fonts))?.[0];

  const run = async () => {
    setState("running");
    setLog("");
    try {
      const path = image && wallpaperDir ? await imageToDisk(image.blob, image.name, wallpaperDir) : undefined;
      const out = await applyTheme({
        image: path, source: src, scheme: settings.scheme, mode: settings.mode, contrast: settings.contrast,
        overrides, fonts: withFonts ? fonts : undefined, fontProfile: withFonts ? preset : undefined,
        prompt: { enabled: prompt.enabled, p10k: p10kOverlay(prompt), omp: ompTemplate(prompt) },
      });
      setLog(out);
      setState("done");
    } catch (e) {
      setLog(errText(e));
      setState("error");
    }
  };

  return (
    <div className="overlay" role="dialog" aria-modal="true" aria-label="Theme anwenden" onClick={() => state !== "running" && onClose()}>
      <div ref={sheetRef} tabIndex={-1} className="sheet settings" onClick={(e) => e.stopPropagation()}>
        <div className="wh-head">
          <h2>Auf diesem Rechner anwenden</h2>
          <span className="grow" />
          <button type="button" className="ghost" onClick={onClose} disabled={state === "running"} aria-label="Schließen">✕</button>
        </div>
        <div className="pad form">
          <ul className="apply-list">
            <li><b>Wallpaper</b>{image ? image.name : "bleibt (aktuelles Wallpaper wird neu eingefärbt)"}</li>
            <li><b>Farben</b><span><i className="sw inline" style={{ background: src }} /> {src} · {SCHEMES[settings.scheme].label} · {settings.mode === "dark" ? "dunkel" : "hell"}
              {settings.contrast ? ` · Kontrast ${settings.contrast}` : ""}{Object.keys(overrides).length ? ` · ${Object.keys(overrides).length} überschrieben` : ""}</span></li>
            <li><b>Prompt</b>{prompt.enabled ? `aus dem Studio (${prompt.style}, ${prompt.lines} Zeile${prompt.lines > 1 ? "n" : ""})` : "dein eigener (Studio-Prompt wird entfernt, falls gesetzt)"}</li>
            <li><b>Über</b>{isWindows ? "wintheme: Windows-Akzent, Terminal, VS Code, oh-my-posh, komorebi"
              : "wallthemes: alle matugen-Vorlagen + Hooks (Leiste, Terminal, GTK, VS Code …)"}</li>
          </ul>
          <label className="check">
            <input type="checkbox" checked={withFonts} onChange={(e) => setWithFonts(e.target.checked)} />
            <span>Schrift mit anwenden – {isWindows ? `Terminal: ${fonts.mono}` : preset ? `fontgen-Profil „${preset}“` : "als fontgen-Profil „studio“"}</span>
          </label>
          {log && <pre className={`apply-log ${state}`}>{log}</pre>}
        </div>
        <div className="wh-foot">
          <small className="empty">{state === "running" ? "läuft … (Hooks brauchen ein paar Sekunden)" : state === "done" ? "Fertig." : state === "error" ? "Es gab Fehler – siehe oben." : ""}</small>
          <span className="grow" />
          <button type="button" className="ghost" onClick={onClose} disabled={state === "running"}>{state === "done" ? "Schließen" : "Abbrechen"}</button>
          {state !== "done" && <button type="button" className="primary" onClick={run} disabled={state === "running"}>
            {state === "running" ? "Wird angewendet …" : state === "error" ? "Nochmal" : "Anwenden"}</button>}
        </div>
      </div>
    </div>
  );
}
