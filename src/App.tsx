import { useCallback, useEffect, useMemo, useRef, useState, type CSSProperties } from "react";
import { Desktop, type Os } from "./components/Desktop";
import { Library } from "./components/Library";
import { Wallhaven } from "./components/Wallhaven";
import { hueName, onColor, palette, SCHEMES, sourceColors, type Mode, type SchemeName, type ThemeSettings } from "./lib/color";
import { commands, download, exportsFor, renderTemplate } from "./lib/exporters";
import { copyText } from "./lib/platform";
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

  const flash = (msg: string) => { setToast(msg); setTimeout(() => setToast(""), 1800); };
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
      flash(`Bild konnte nicht gelesen werden: ${(e as Error).message}`);
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
    const t: StoredTheme = { id: uid(), name: name.trim() || "Theme", imageId, settings, created: Date.now() };
    await db.putTheme(t);
    setThemes((prev) => [t, ...prev]);
    flash(`„${t.name}“ gespeichert`);
  };

  const openTheme = (t: StoredTheme) => {
    setSettings(t.settings);
    setName(t.name);
    setImageId(t.imageId && images.some((i) => i.id === t.imageId) ? t.imageId : undefined);
  };

  const deleteTheme = async (id: string) => {
    await db.deleteTheme(id);
    setThemes((prev) => prev.filter((t) => t.id !== id));
  };

  const addTemplates = async (files: File[]) => {
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

  const cmds = commands(settings);
  const files = exportsFor(name || "Theme", settings, image?.name);
  const bg = image ? urls[image.id] : undefined;

  return (
    <div className="app" style={{ "--accent": pal.primary, "--on-accent": pal.on_primary } as CSSProperties}>
      <header className="top">
        <h1>Theme Studio</h1>
        <div className="seg" role="group" aria-label="Vorschau für">
          <button type="button" aria-pressed={os === "linux"} onClick={() => setOs("linux")}>Linux</button>
          <button type="button" aria-pressed={os === "windows"} onClick={() => setOs("windows")}>Windows</button>
        </div>
        <span className="grow" />
        <input className="name" value={name} onChange={(e) => setName(e.target.value)} placeholder="Name des Themes" aria-label="Name des Themes" />
        <button type="button" className="primary" onClick={saveTheme}>Speichern</button>
      </header>

      <Library images={images} urls={urls} themes={themes} templates={templates} selectedImage={imageId} busy={busy}
        onAddImages={addImages} onWallhaven={() => setWallhaven(true)} onSelectImage={(id) => { const i = images.find((x) => x.id === id); if (i) selectImage(i); }}
        onDeleteImage={deleteImage} onOpenTheme={openTheme} onDeleteTheme={deleteTheme}
        onAddTemplates={addTemplates} onDeleteTemplate={deleteTemplate} />

      <main className="main">
        {/* Ausgangsfarbe & Einstellungen */}
        <section className="card setup">
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

        {/* Alle Varianten nebeneinander */}
        <section>
          <h2 className="section-title">Varianten <small>anklicken zum Auswählen</small></h2>
          <div className="variants">
            {(Object.keys(SCHEMES) as SchemeName[]).map((k) => {
              const c = palette({ ...settings, scheme: k });
              return (
                <button key={k} type="button" className="variant" aria-pressed={settings.scheme === k} onClick={() => update({ scheme: k })}>
                  <Desktop c={c} os={os} image={bg} />
                  <span className="vname">{SCHEMES[k].label}<small>{SCHEMES[k].hint}</small></span>
                  <span className="strip">{[c.primary, c.secondary, c.tertiary, c.surface_container_high].map((x, i) => <i key={i} style={{ background: x }} />)}</span>
                </button>
              );
            })}
          </div>
        </section>

        {/* Gewählte Variante groß + Palette */}
        <section className="card detail">
          <div className="big">
            <Desktop c={pal} os="linux" image={bg} size="large" />
            <Desktop c={pal} os="windows" image={bg} size="large" />
          </div>
          <div className="palette">
            {PALETTE_GROUPS.map(([title, roles]) => (
              <div key={title}>
                <h3>{title}</h3>
                <div className="swatches">
                  {roles.map((r) => {
                    const hex = (pal as Record<string, string>)[r];
                    return (
                      <button key={r} type="button" className="swatch" style={{ background: hex, color: onColor(hex) }}
                        onClick={() => copy(hex)} title="Klicken zum Kopieren">
                        <span>{r.replace(/_/g, " ")}</span><code>{hex}</code>
                      </button>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>
        </section>

        {/* Export */}
        <section className="card export">
          <h2>Anwenden</h2>
          <div className="cmd">
            <span>Windows</span><code>{cmds.windows}</code>
            <button type="button" className="ghost" onClick={() => copy(cmds.windows)}>Kopieren</button>
          </div>
          <div className="cmd">
            <span>Linux</span><code>{cmds.linux}</code>
            <button type="button" className="ghost" onClick={() => copy(cmds.linux)}>Kopieren</button>
          </div>

          <h2>Dateien</h2>
          <ul className="files">
            {files.map((f) => (
              <li key={f.id}>
                <span><b>{f.label}</b><small>{f.hint}</small></span>
                <button type="button" className="ghost" onClick={() => copy(f.text)}>Kopieren</button>
                <button type="button" className="ghost" onClick={() => void download(f.filename, f.text).then((ok) => ok && flash("Gespeichert"))}>Herunterladen</button>
              </li>
            ))}
            {templates.map((t) => {
              const out = () => renderTemplate(t.text, settings, image?.name);
              return (
                <li key={t.id}>
                  <span><b>{t.name}</b><small>aus deiner matugen-Vorlage</small></span>
                  <button type="button" className="ghost" onClick={() => copy(out())}>Kopieren</button>
                  <button type="button" className="ghost" onClick={() => void download(t.output, out()).then((ok) => ok && flash("Gespeichert"))}>Herunterladen</button>
                </li>
              );
            })}
          </ul>
        </section>
      </main>

      {wallhaven && <Wallhaven onClose={() => setWallhaven(false)} onPick={(f) => addImages([f])} />}
      <div className={`toast ${toast ? "show" : ""}`} role="status" aria-live="polite">{toast}</div>
    </div>
  );
}
