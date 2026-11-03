import { useCallback, useEffect, useMemo, useRef, useState, type CSSProperties } from "react";
import { Desktop, type Os } from "./components/Desktop";
import { FontPanel } from "./components/FontPanel";
import { Library } from "./components/Library";
import { NerdFonts } from "./components/NerdFonts";
import { Readability } from "./components/Readability";
import { TerminalPreview } from "./components/TerminalPreview";
import { SettingsDialog } from "./components/SettingsDialog";
import { Wallhaven } from "./components/Wallhaven";
import { hueName, onColor, palette, SCHEMES, sourceColors, type Mode, type SchemeName, type ThemeSettings } from "./lib/color";
import { grade, PARTNER, ratio } from "./lib/contrast";
import { commands, exportsFor, parseThemeFile, renderTemplate } from "./lib/exporters";
import { DEFAULT_FONTS, type Fonts } from "./lib/fonts";
import { copyText, errText, isTauri, saveBytes, saveText } from "./lib/platform";
import { loadSettings, storeSettings, type AppSettings } from "./lib/settings";
import { vscodeSettings, vscodeTheme, vscodeVsix } from "./lib/vscode";
import { db, uid, type StoredImage, type StoredTemplate, type StoredTheme } from "./lib/store";

const DEFAULT: ThemeSettings = { source: "#6750a4", scheme: "tonal-spot", mode: "dark", contrast: 0 };
const PALETTE_GROUPS: [string, string[]][] = [
  ["Akzente", ["primary", "on_primary", "primary_container", "secondary", "secondary_container", "tertiary", "tertiary_container", "inverse_primary"]],
  ["Flächen", ["background", "surface", "surface_container_low", "surface_container", "surface_container_high", "surface_container_highest", "surface_variant", "inverse_surface"]],
  ["Text & Linien", ["on_surface", "on_surface_variant", "outline", "outline_variant", "error", "error_container"]],
];

export function App() {
  const [images, setImages] = useState<StoredImage[]>([]);
  const [themes, setThemes] = useState<StoredTheme[]>([]);
  const [templates, setTemplates] = useState<StoredTemplate[]>([]);
  const [imageId, setImageId] = useState<string>();
  const [settings, setSettings] = useState<ThemeSettings>(DEFAULT);
  const [os, setOs] = useState<Os>("linux");
  const [name, setName] = useState("");
  const [busy, setBusy] = useState(false);
  const [toast, setToast] = useState("");
  const [wallhaven, setWallhaven] = useState(false);
  const [fonts, setFonts] = useState<Fonts>(DEFAULT_FONTS);
  const [app, setApp] = useState<AppSettings>({ wallpaperDir: "", exportDir: "", askOnSave: false });
  const [showSettings, setShowSettings] = useState(false);
  const [showNerd, setShowNerd] = useState(false);
  const [fontsKey, setFontsKey] = useState(0);
  const [bothModes, setBothModes] = useState(false);
  const [group, setGroup] = useState<"alle" | "windows" | "linux" | "allgemein">("alle");

  // ── Rückgängig / Wiederholen: Stände von Farbe + Schrift (Änderungen in kurzer Folge = ein Schritt) ──
  const past = useRef<{ settings: ThemeSettings; fonts: Fonts }[]>([]);
  const future = useRef<{ settings: ThemeSettings; fonts: Fonts }[]>([]);
  const last = useRef({ settings, fonts });
  const restoring = useRef(false);
  const [, bump] = useState(0);
  useEffect(() => {
    if (restoring.current) { restoring.current = false; last.current = { settings, fonts }; return; }
    const prev = last.current;
    if (prev.settings === settings && prev.fonts === fonts) return;
    const id = setTimeout(() => {
      past.current = [...past.current.slice(-49), prev];
      future.current = [];
      last.current = { settings, fonts };
      bump((n) => n + 1);
    }, 400);
    return () => clearTimeout(id);
  }, [settings, fonts]);
  const travel = (from: typeof past, to: typeof future) => {
    const s = from.current.pop();
    if (!s) return;
    to.current.push({ settings, fonts });
    restoring.current = true;
    setSettings(s.settings);
    setFonts(s.fonts);
    bump((n) => n + 1);
  };
  const undo = () => travel(past, future);
  const redo = () => travel(future, past);

  useEffect(() => { void loadSettings().then(setApp); }, []);

  // Laden aus IndexedDB
  useEffect(() => {
    void Promise.all([db.images(), db.themes(), db.templates()]).then(([i, t, tp]) => {
      i.sort((a, b) => b.added - a.added);
      setImages(i);
      setThemes(t.sort((a, b) => b.created - a.created));
      setTemplates(tp.sort((a, b) => a.name.localeCompare(b.name)));
      if (i[0]) selectImage(i[0]);
    });
  }, []);

  // Objekt-URLs für Vorschaubilder: einmal je Bild anlegen, erst beim Löschen freigeben
  const urlCache = useRef(new Map<string, string>());
  const urls = useMemo(() => {
    const out: Record<string, string> = {};
    for (const i of images) {
      if (!urlCache.current.has(i.id)) urlCache.current.set(i.id, URL.createObjectURL(i.blob));
      out[i.id] = urlCache.current.get(i.id)!;
    }
    return out;
  }, [images]);

  const image = images.find((i) => i.id === imageId);
  const pal = useMemo(() => palette(settings), [settings]);

  const flash = (msg: string, ms = 1800) => { setToast(msg); setTimeout(() => setToast(""), ms); };
  const update = (patch: Partial<ThemeSettings>) => setSettings((s) => ({ ...s, ...patch }));

  function selectImage(i: StoredImage) {
    setImageId(i.id);
    setSettings((s) => ({ ...s, source: i.sources[0] ?? s.source }));
    setName(i.name.replace(/\.[^.]+$/, ""));
  }

  const addImages = useCallback(async (files: File[]) => {
    if (!files.length) return;
    setBusy(true);
    try {
      const added: StoredImage[] = [];
      for (const f of files) {
        const { colors, engine } = await sourceColors(f);
        const img: StoredImage = { id: uid(), name: f.name, blob: f, sources: colors, engine, added: Date.now() };
        await db.putImage(img);
        added.push(img);
      }
      setImages((prev) => [...added, ...prev]);
      selectImage(added[0]);
    } catch (e) {
      flash(`Bild konnte nicht gelesen werden: ${errText(e)}`, 4000);
    } finally {
      setBusy(false);
    }
  }, []);

  const deleteImage = async (id: string) => {
    await db.deleteImage(id);
    const u = urlCache.current.get(id);
    if (u) { URL.revokeObjectURL(u); urlCache.current.delete(id); }
    setImages((prev) => prev.filter((i) => i.id !== id));
    if (id === imageId) setImageId(undefined);
  };

  const saveTheme = async () => {
    const t: StoredTheme = { id: uid(), name: name.trim() || "Theme", imageId, settings, fonts, created: Date.now() };
    await db.putTheme(t);
    setThemes((prev) => [t, ...prev]);
    flash(`„${t.name}“ gespeichert`);
  };

  const openTheme = (t: StoredTheme) => {
    setSettings(t.settings);
    setFonts(t.fonts ?? DEFAULT_FONTS);
    setName(t.name);
    setImageId(t.imageId && images.some((i) => i.id === t.imageId) ? t.imageId : undefined);
  };

  const deleteTheme = async (id: string) => {
    await db.deleteTheme(id);
    setThemes((prev) => prev.filter((t) => t.id !== id));
  };

  // Theme-Datei (.theme.json) einlesen – z. B. vom anderen Rechner
  const importTheme = async (f: File) => {
    try {
      const t = parseThemeFile(await f.text());
      setSettings(t.settings);
      if (t.fonts) setFonts(t.fonts);
      setName(t.name);
      flash(`„${t.name}“ importiert`);
    } catch (e) {
      flash(`Import fehlgeschlagen: ${errText(e)}`, 5000);
    }
  };

  // Zufall: zufälliges Bild aus der Sammlung (oder Farbe), Ausgangsfarbe und Variante
  const surprise = () => {
    const pick = <T,>(xs: T[]) => xs[Math.floor(Math.random() * xs.length)];
    const schemes = Object.keys(SCHEMES) as SchemeName[];
    if (images.length) {
      const i = pick(images);
      setImageId(i.id);
      setName(i.name.replace(/\.[^.]+$/, ""));
      update({ source: pick(i.sources), scheme: pick(schemes) });
    } else {
      update({ source: "#" + Math.floor(Math.random() * 0xffffff).toString(16).padStart(6, "0"), scheme: pick(schemes) });
    }
  };

  const addTemplates = async (files: File[]) => {
    const themeFiles = files.filter((f) => /\.theme\.json$/i.test(f.name));
    for (const f of themeFiles) await importTheme(f);
    files = files.filter((f) => !themeFiles.includes(f));
    const added: StoredTemplate[] = [];
    for (const f of files) {
      const t: StoredTemplate = { id: uid(), name: f.name, output: f.name, text: await f.text(), added: Date.now() };
      await db.putTemplate(t);
      added.push(t);
    }
    setTemplates((prev) => [...prev, ...added].sort((a, b) => a.name.localeCompare(b.name)));
    if (added.length) flash(`${added.length} Vorlage${added.length > 1 ? "n" : ""} hinzugefügt`);
  };

  const deleteTemplate = async (id: string) => {
    await db.deleteTemplate(id);
    setTemplates((prev) => prev.filter((t) => t.id !== id));
  };

  const copy = async (text: string) => {
    try {
      await copyText(text);
      flash("Kopiert");
    } catch {
      flash("Kopieren nicht möglich");
    }
  };

  // Speichern in den Export-Ordner (App) bzw. als Download (Browser)
  const saveOpts = { dir: app.exportDir, ask: app.askOnSave };
  const report = (where: string | null) => where && flash(isTauri ? `Gespeichert: ${where}` : "Heruntergeladen", 3500);
  const saveFile = (filename: string, text: string) =>
    void saveText(filename, text, saveOpts).then(report).catch((e) => flash(`Speichern fehlgeschlagen: ${errText(e)}`, 5000));
  const saveVsix = () => {
    const v = vscodeVsix(themeName, settings, pal);
    void saveBytes(v.filename, v.bytes, saveOpts).then(report).catch((e) => flash(`Speichern fehlgeschlagen: ${errText(e)}`, 5000));
  };

  const themeName = name.trim() || "Theme";
  const cmds = commands(settings, fonts);
  const files = exportsFor(themeName, settings, image?.name, fonts);
  const vsSettings = JSON.stringify(vscodeSettings(themeName, fonts), null, 2);

  // Tastenkürzel (nicht beim Tippen): Strg+Z/Strg+Y, Strg+S speichern, 1–9 Variante, D/H Modus, Z Zufall
  const keys = useRef<(e: KeyboardEvent) => void>(() => {});
  keys.current = (e: KeyboardEvent) => {
    const typing = e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement;
    const mod = e.ctrlKey || e.metaKey;
    if (mod && e.key.toLowerCase() === "s") { e.preventDefault(); void saveTheme(); return; }
    if (typing || document.querySelector(".overlay")) return;
    if (mod && e.key.toLowerCase() === "z") { e.preventDefault(); if (e.shiftKey) redo(); else undo(); return; }
    if (mod && e.key.toLowerCase() === "y") { e.preventDefault(); redo(); return; }
    if (mod || e.altKey) return;
    const schemes = Object.keys(SCHEMES) as SchemeName[];
    if (/^[1-9]$/.test(e.key)) update({ scheme: schemes[Number(e.key) - 1] });
    else if (e.key === "d") update({ mode: "dark" });
    else if (e.key === "h") update({ mode: "light" });
    else if (e.key === "z") surprise();
  };
  useEffect(() => {
    const h = (e: KeyboardEvent) => keys.current(e);
    window.addEventListener("keydown", h);
    return () => window.removeEventListener("keydown", h);
  }, []);

  const importInput = useRef<HTMLInputElement>(null);
  const NAV: [string, string][] = [["farbe", "Farbe"], ["schrift", "Schrift"], ["varianten", "Varianten"], ["vorschau", "Vorschau"], ["export", "Export"]];
  const bg = image ? urls[image.id] : undefined;

  return (
    <div className="app" style={{ "--accent": pal.primary, "--on-accent": pal.on_primary } as CSSProperties}>
      <header className="top">
        <h1>Theme Studio</h1>
        <div className="seg" role="group" aria-label="Vorschau für">
          <button type="button" aria-pressed={os === "linux"} onClick={() => setOs("linux")}>Linux</button>
          <button type="button" aria-pressed={os === "windows"} onClick={() => setOs("windows")}>Windows</button>
        </div>
        <nav className="jump" aria-label="Abschnitte">
          {NAV.map(([id, label]) => <a key={id} href={`#${id}`}>{label}</a>)}
        </nav>
        <span className="grow" />
        <div className="tools">
          <button type="button" className="ghost" onClick={undo} disabled={!past.current.length} title="Rückgängig (Strg+Z)" aria-label="Rückgängig">↶</button>
          <button type="button" className="ghost" onClick={redo} disabled={!future.current.length} title="Wiederholen (Strg+Y)" aria-label="Wiederholen">↷</button>
          <button type="button" className="ghost" onClick={surprise} title="Zufälliges Theme (Z)">Zufall</button>
          <button type="button" className="ghost" onClick={() => importInput.current?.click()} title=".theme.json einlesen">Import</button>
          <input ref={importInput} type="file" accept=".json,application/json" hidden
            onChange={(e) => { const f = e.target.files?.[0]; if (f) void importTheme(f); e.target.value = ""; }} />
        </div>
        <button type="button" className="ghost icon" onClick={() => setShowSettings(true)} aria-label="Einstellungen" title="Einstellungen">⚙</button>
        <input className="name" value={name} onChange={(e) => setName(e.target.value)} placeholder="Name des Themes" aria-label="Name des Themes" />
        <button type="button" className="primary" onClick={saveTheme}>Speichern</button>
      </header>

      <Library images={images} urls={urls} themes={themes} templates={templates} selectedImage={imageId} busy={busy}
        onAddImages={addImages} onWallhaven={() => setWallhaven(true)} onSelectImage={(id) => { const i = images.find((x) => x.id === id); if (i) selectImage(i); }}
        onDeleteImage={deleteImage} onOpenTheme={openTheme} onDeleteTheme={deleteTheme}
        onAddTemplates={addTemplates} onDeleteTemplate={deleteTemplate} />

      <main className="main">
        {/* Ausgangsfarbe & Einstellungen */}
        <section className="card setup" id="farbe">
          <div className="hero">
            {bg ? <img src={bg} alt={image?.name} /> : <div className="noimg">Kein Bild – nur Farbe</div>}
          </div>
          <div className="controls">
            <h2>Ausgangsfarbe</h2>
            <div className="sources">
              {(image?.sources ?? []).map((s, i) => (
                <button key={s} type="button" className="source" aria-pressed={settings.source === s}
                  style={{ background: s, color: onColor(s) }} onClick={() => update({ source: s })}>
                  <b>{i + 1}</b><small>{hueName(s)}</small>
                </button>
              ))}
              <label className="source custom" title="Eigene Farbe">
                <input type="color" value={settings.source} onChange={(e) => update({ source: e.target.value })} />
                <small>eigene</small>
              </label>
            </div>
            <code className="hex">{settings.source}</code>
            {image && <small className="engine" title={image.engine === "matugen"
              ? "Mit matugens eigenem Rust-Code berechnet – exakt wie dein System"
              : "Näherung im Browser – kann leicht von matugen abweichen"}>
              {image.engine === "matugen" ? "· exakt wie matugen" : "· Näherung"}</small>}

            <h2>Modus</h2>
            <div className="seg">
              {(["dark", "light"] as Mode[]).map((m) => (
                <button key={m} type="button" aria-pressed={settings.mode === m} onClick={() => update({ mode: m })}>
                  {m === "dark" ? "Dunkel" : "Hell"}
                </button>
              ))}
            </div>

            <h2>Kontrast <code>{settings.contrast.toFixed(1)}</code></h2>
            <input type="range" min={-1} max={1} step={0.1} value={settings.contrast}
              onChange={(e) => update({ contrast: Number(e.target.value) })} aria-label="Kontrast" />
          </div>
        </section>

        <div id="schrift" />
        <FontPanel fonts={fonts} onChange={setFonts} onNerdFonts={() => setShowNerd(true)} refreshKey={fontsKey} />

        {/* Alle Varianten nebeneinander */}
        <section id="varianten">
          <h2 className="section-title">Varianten <small>anklicken oder Taste 1–9</small></h2>
          <div className="variants">
            {(Object.keys(SCHEMES) as SchemeName[]).map((k) => {
              const c = palette({ ...settings, scheme: k });
              return (
                <button key={k} type="button" className="variant" aria-pressed={settings.scheme === k} onClick={() => update({ scheme: k })}>
                  <Desktop c={c} os={os} image={bg} fonts={fonts} />
                  <span className="vname"><kbd>{(Object.keys(SCHEMES) as SchemeName[]).indexOf(k) + 1}</kbd>{SCHEMES[k].label}<small>{SCHEMES[k].hint}</small></span>
                  <span className="strip">{[c.primary, c.secondary, c.tertiary, c.surface_container_high].map((x, i) => <i key={i} style={{ background: x }} />)}</span>
                </button>
              );
            })}
          </div>
        </section>

        {/* Gewählte Variante groß + Palette */}
        <section className="card detail" id="vorschau">
          <div className="detail-head">
            <h2>Vorschau <small>{SCHEMES[settings.scheme].label} · {settings.mode === "dark" ? "dunkel" : "hell"}</small></h2>
            <span className="grow" />
            <label className="check"><input type="checkbox" checked={bothModes} onChange={(e) => setBothModes(e.target.checked)} /> Hell und dunkel nebeneinander</label>
          </div>
          {bothModes ? (
            <div className="big">
              {(["light", "dark"] as Mode[]).map((m) => (
                <Desktop key={m} c={palette({ ...settings, mode: m })} os={os} image={bg} size="large" fonts={fonts} />
              ))}
            </div>
          ) : (
            <div className="big">
              <Desktop c={pal} os="linux" image={bg} size="large" fonts={fonts} />
              <Desktop c={pal} os="windows" image={bg} size="large" fonts={fonts} />
            </div>
          )}
          <div className="split">
            <TerminalPreview c={pal} t={settings} fonts={fonts} />
            <Readability c={pal} />
          </div>
          <div className="palette">
            {PALETTE_GROUPS.map(([title, roles]) => (
              <div key={title}>
                <h3>{title}</h3>
                <div className="swatches">
                  {roles.map((r) => {
                    const hex = (pal as Record<string, string>)[r];
                    const partner = PARTNER[r] ? (pal as Record<string, string>)[PARTNER[r]] : undefined;
                    const cr = partner ? ratio(hex, partner) : 0;
                    return (
                      <button key={r} type="button" className="swatch" style={{ background: hex, color: partner ?? onColor(hex) }}
                        onClick={() => copy(hex)} title={`Klicken zum Kopieren${partner ? ` · Kontrast zu ${PARTNER[r].replace(/_/g, " ")}: ${cr.toFixed(1)}` : ""}`}>
                        <span>{r.replace(/_/g, " ")}</span>
                        <code>{hex}{partner && <b className={`dot ${grade(cr)}`} />}</code>
                      </button>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>
        </section>

        {/* Export */}
        <section className="card export" id="export">
          <h2>Anwenden</h2>
          <div className="cmd">
            <span>Windows</span><code>{cmds.windows}</code>
            <button type="button" className="ghost" onClick={() => copy(cmds.windows)}>Kopieren</button>
          </div>
          <div className="cmd">
            <span>Linux</span><code>{cmds.linux}</code>
            <button type="button" className="ghost" onClick={() => copy(cmds.linux)}>Kopieren</button>
          </div>

          <h2>VS Code</h2>
          <ul className="files">
            <li>
              <span><b>Erweiterung (.vsix)</b><small>installieren: <code>code --install-extension …vsix</code> oder Erweiterungen → … → „Aus VSIX installieren“</small></span>
              <button type="button" className="primary" onClick={saveVsix}>Speichern</button>
            </li>
            <li>
              <span><b>settings.json</b><small>Theme auswählen + Schrift „{fonts.mono}“ für Editor und Terminal</small></span>
              <button type="button" className="ghost" onClick={() => copy(vsSettings)}>Kopieren</button>
            </li>
            <li>
              <span><b>Theme-Datei</b><small>für eigene Erweiterungen oder zum Teilen</small></span>
              <button type="button" className="ghost" onClick={() => copy(JSON.stringify(vscodeTheme(themeName, settings, pal), null, 2))}>Kopieren</button>
              <button type="button" className="ghost" onClick={() => saveFile(`${themeName}.vscode-theme.json`, JSON.stringify(vscodeTheme(themeName, settings, pal), null, 2) + "\n")}>Speichern</button>
            </li>
          </ul>

          <div className="detail-head">
            <h2>Dateien {isTauri && app.exportDir && !app.askOnSave && <small>→ {app.exportDir}</small>}</h2>
            <span className="grow" />
            <div className="seg" role="group" aria-label="Dateien filtern">
              {(["alle", "windows", "linux", "allgemein"] as const).map((g) => (
                <button key={g} type="button" aria-pressed={group === g} onClick={() => setGroup(g)}>
                  {{ alle: "Alle", windows: "Windows", linux: "Linux", allgemein: "Allgemein" }[g]}
                </button>
              ))}
            </div>
          </div>
          <ul className="files">
            {files.filter((f) => group === "alle" || f.group === group).map((f) => (
              <li key={f.id}>
                <span><b>{f.label}</b><small>{f.hint}</small></span>
                <button type="button" className="ghost" onClick={() => copy(f.text)}>Kopieren</button>
                <button type="button" className="ghost" onClick={() => saveFile(f.filename, f.text)}>Speichern</button>
              </li>
            ))}
            {(group === "alle" || group === "linux") && templates.map((t) => {
              const out = () => renderTemplate(t.text, settings, image?.name, fonts);
              return (
                <li key={t.id}>
                  <span><b>{t.name}</b><small>aus deiner Vorlage (matugen-/fontgen-Platzhalter)</small></span>
                  <button type="button" className="ghost" onClick={() => copy(out())}>Kopieren</button>
                  <button type="button" className="ghost" onClick={() => saveFile(t.output, out())}>Speichern</button>
                </li>
              );
            })}
          </ul>
        </section>
      </main>

      {wallhaven && <Wallhaven wallpaperDir={app.wallpaperDir} onClose={() => setWallhaven(false)} onPick={(f) => addImages([f])} />}
      {showNerd && <NerdFonts onClose={() => setShowNerd(false)}
        onInstalled={(fam) => { setFontsKey((k) => k + 1); flash(`${fam} Nerd Font installiert`, 3000); }} />}
      {showSettings && <SettingsDialog value={app} onClose={() => setShowSettings(false)}
        onSave={(s) => { setApp(s); storeSettings(s); flash("Einstellungen gespeichert"); }} />}
      <div className={`toast ${toast ? "show" : ""}`} role="status" aria-live="polite">{toast}</div>
    </div>
  );
}
