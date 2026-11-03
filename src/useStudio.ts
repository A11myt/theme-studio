import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { Os } from "./components/Desktop";
import { effectiveSource, NO_TUNE, palette, SCHEMES, sourceColors, type SchemeName, type ThemeSettings } from "./lib/color";
import { commands, exportsFor, parseThemeFile } from "./lib/exporters";
import { DEFAULT_FONTS, type Fonts } from "./lib/fonts";
import { DEFAULT_PROMPT, type PromptOptions } from "./lib/prompt";
import { copyText, errText, isTauri, saveBytes, saveText } from "./lib/platform";
import { loadSettings, type AppSettings } from "./lib/settings";
import { vscodeSettings, vscodeVsix } from "./lib/vscode";
import { readShareLink, shareLink } from "./lib/share";
import { db, uid, type StoredImage, type StoredTemplate, type StoredTheme } from "./lib/store";
import { t as tr } from "./lib/i18n";


export const DEFAULT: ThemeSettings = { source: "#6750a4", scheme: "tonal-spot", mode: "dark", contrast: 0 };
export const PALETTE_GROUPS: [string, string[]][] = [
  ["Akzente", ["primary", "on_primary", "primary_container", "secondary", "secondary_container", "tertiary", "tertiary_container", "inverse_primary"]],
  ["Flächen", ["background", "surface", "surface_container_low", "surface_container", "surface_container_high", "surface_container_highest", "surface_variant", "inverse_surface"]],
  ["Text & Linien", ["on_surface", "on_surface_variant", "outline", "outline_variant", "error", "error_container"]],
];

export type Tab = "sammlung" | "farbe" | "schrift" | "terminal" | "vorschau" | "export";
export const TAB_IDS: Tab[] = ["sammlung", "farbe", "schrift", "terminal", "vorschau", "export"];


/** Zustand und Aktionen des Studios – die Bereiche (src/panes) und App.tsx lesen daraus. */
export function useStudio() {
  const [images, setImages] = useState<StoredImage[]>([]);
  const [themes, setThemes] = useState<StoredTheme[]>([]);
  const [templates, setTemplates] = useState<StoredTemplate[]>([]);
  const [imageId, setImageId] = useState<string>();
  const [settings, setSettings] = useState<ThemeSettings>(DEFAULT);
  const [os, setOs] = useState<Os>("linux");
  const [name, setName] = useState("");
  const [busy, setBusy] = useState(false);
  const [toast, setToast] = useState("");
  const [wallhaven, setWallhaven] = useState<false | { color?: string }>(false);
  const [showApply, setShowApply] = useState(false);
  const [editRole, setEditRole] = useState<string>();
  const [fonts, setFonts] = useState<Fonts>(DEFAULT_FONTS);
  const [app, setApp] = useState<AppSettings>({ wallpaperDir: "", exportDir: "", askOnSave: false });
  const [showSettings, setShowSettings] = useState(false);
  const [showNerd, setShowNerd] = useState(false);
  const [fontsKey, setFontsKey] = useState(0);
  const [bothModes, setBothModes] = useState(false);
  // Prompt (Assistent): gilt für den Rechner, nicht pro Theme – gemerkt im Browser-Speicher der App
  const [prompt, setPromptState] = useState<PromptOptions>(() => {
    try { return { ...DEFAULT_PROMPT, ...JSON.parse(localStorage.getItem("theme-studio-prompt") ?? "{}") }; } catch { return DEFAULT_PROMPT; }
  });
  const setPrompt = (o: PromptOptions) => { setPromptState(o); try { localStorage.setItem("theme-studio-prompt", JSON.stringify(o)); } catch { /* egal */ } };
  const [showWizard, setShowWizard] = useState(false);
  // Einzeltasten-Kürzel (1–9, D, H, Z) – abschaltbar, z. B. für Spracheingabe/Screenreader (WCAG 2.1.4)
  const [singleKeys, setSingleKeysState] = useState(() => { try { return localStorage.getItem("theme-studio-single-keys") !== "0"; } catch { return true; } });
  const setSingleKeys = (on: boolean) => { setSingleKeysState(on); try { localStorage.setItem("theme-studio-single-keys", on ? "1" : "0"); } catch { /* egal */ } };
  const [tab, setTabState] = useState<Tab>(() => {
    try { const t = localStorage.getItem("theme-studio-tab"); if (t && TAB_IDS.includes(t as Tab)) return t as Tab; } catch { /* egal */ }
    return "farbe";
  });
  const setTab = (t: Tab) => { setTabState(t); try { localStorage.setItem("theme-studio-tab", t); } catch { /* egal */ } window.scrollTo(0, 0); };
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

  // Mit einem Theme-Link gestartet? Dann nicht das erste Bild auswählen (würde die Link-Farben überschreiben)
  const openedFromLink = useRef(typeof location !== "undefined" && location.hash.startsWith("#t="));

  // Laden aus IndexedDB
  useEffect(() => {
    void Promise.all([db.images(), db.themes(), db.templates()]).then(([i, t, tp]) => {
      i.sort((a, b) => b.added - a.added);
      setImages(i);
      setThemes(t.sort((a, b) => b.created - a.created));
      setTemplates(tp.sort((a, b) => a.name.localeCompare(b.name)));
      if (i[0] && !openedFromLink.current) selectImage(i[0]);   // ein geöffneter Link hat Vorrang
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
    // neues Bild → Feinjustierung und Überschreibungen gehören zum alten Theme
    setSettings((s) => ({ ...s, source: i.sources[0] ?? s.source, tune: undefined, overrides: undefined }));
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
      flash(tr("Bild konnte nicht gelesen werden: {e}", { e: errText(e) }), 4000);
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
    flash(tr("„{name}“ gespeichert", { name: t.name }));
  };

  const openTheme = (t: StoredTheme) => {
    setSettings(t.settings);
    setFonts(t.fonts ?? DEFAULT_FONTS);
    setName(t.name);
    setImageId(t.imageId && images.some((i) => i.id === t.imageId) ? t.imageId : undefined);
  };

  const updateTheme = async (t: StoredTheme) => {
    await db.putTheme(t);
    setThemes((prev) => prev.map((x) => (x.id === t.id ? t : x)));
  };

  const duplicateTheme = async (t: StoredTheme) => {
    const copy: StoredTheme = { ...t, id: uid(), name: tr("{name} (Kopie)", { name: t.name }), favorite: false, created: Date.now() };
    await db.putTheme(copy);
    setThemes((prev) => [copy, ...prev]);
    flash(tr("„{name}“ angelegt", { name: copy.name }));
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
      flash(tr("„{name}“ importiert", { name: t.name }));
    } catch (e) {
      flash(tr("Import fehlgeschlagen: {e}", { e: errText(e) }), 5000);
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
    if (added.length) flash(tr(added.length > 1 ? "{n} Vorlagen hinzugefügt" : "1 Vorlage hinzugefügt", { n: added.length }));
  };

  const deleteTemplate = async (id: string) => {
    await db.deleteTemplate(id);
    setTemplates((prev) => prev.filter((t) => t.id !== id));
  };

  // Geteiltes Theme übernehmen (Link aus der Adresse oder eingefügt)
  const openShared = (text: string) => {
    try {
      const t = readShareLink(text);
      if (!t) return false;
      setSettings(t.settings);
      if (t.fonts) setFonts(t.fonts);
      setName(t.name);
      setImageId(undefined);
      setTab("farbe");
      flash(tr("Geteiltes Theme „{name}“ geöffnet", { name: t.name }), 3000);
    } catch (e) {
      flash(tr("Link ungültig: {e}", { e: errText(e) }), 5000);
    }
    return true;
  };
  useEffect(() => {
    if (location.hash.startsWith("#t=")) {
      openShared(location.hash);
      history.replaceState(null, "", location.pathname + location.search);
    }
    // Strg+V mit einem Theme-Link (nicht in Eingabefeldern)
    const paste = (e: ClipboardEvent) => {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;
      const text = e.clipboardData?.getData("text") ?? "";
      if (text.includes("#t=") && openShared(text)) e.preventDefault();
    };
    window.addEventListener("paste", paste);
    return () => window.removeEventListener("paste", paste);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  const shareTheme = async (n: string, st: ThemeSettings, f: Fonts) => {
    try {
      await copyText(shareLink(n, st, f));
      flash(tr("Link kopiert – wer ihn öffnet, sieht genau dieses Theme (ohne Bild)"), 3500);
    } catch {
      flash(tr("Kopieren nicht möglich"));
    }
  };

  const copy = async (text: string) => {
    try {
      await copyText(text);
      flash(tr("Kopiert"));
    } catch {
      flash(tr("Kopieren nicht möglich"));
    }
  };

  // Speichern in den Export-Ordner (App) bzw. als Download (Browser)
  const saveOpts = { dir: app.exportDir, ask: app.askOnSave };
  const report = (where: string | null) => where && flash(isTauri ? tr("Gespeichert: {where}", { where }) : tr("Heruntergeladen"), 3500);
  const saveFile = (filename: string, text: string) =>
    void saveText(filename, text, saveOpts).then(report).catch((e) => flash(tr("Speichern fehlgeschlagen: {e}", { e: errText(e) }), 5000));
  const saveVsix = () => {
    const v = vscodeVsix(themeName, settings, pal);
    void saveBytes(v.filename, v.bytes, saveOpts).then(report).catch((e) => flash(tr("Speichern fehlgeschlagen: {e}", { e: errText(e) }), 5000));
  };

  const themeName = name.trim() || "Theme";
  const tune = settings.tune ?? NO_TUNE;
  const effSource = effectiveSource(settings);
  const overrideCount = Object.values(settings.overrides ?? {}).filter(Boolean).length;
  const setOverride = (role: string, hex?: string) =>
    update({ overrides: Object.fromEntries(Object.entries({ ...settings.overrides, [role]: hex }).filter(([, v]) => v)) });
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
    if (e.altKey && /^[1-6]$/.test(e.key)) { e.preventDefault(); setTab(TAB_IDS[Number(e.key) - 1]); return; }
    if (mod || e.altKey || !singleKeys) return;
    const schemes = Object.keys(SCHEMES) as SchemeName[];
    if (/^[1-9]$/.test(e.key) && tab === "farbe") update({ scheme: schemes[Number(e.key) - 1] });
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
  const TABS = [["sammlung", "Sammlung"], ["farbe", "Farbe"], ["schrift", "Schrift"], ["terminal", "Terminal"], ["vorschau", "Vorschau"], ["export", "Export"]] as const;
  const bg = image ? urls[image.id] : undefined;


  return {
    images,
    setImages,
    themes,
    setThemes,
    templates,
    setTemplates,
    imageId,
    setImageId,
    settings,
    setSettings,
    os,
    setOs,
    name,
    setName,
    busy,
    setBusy,
    toast,
    setToast,
    wallhaven,
    setWallhaven,
    showApply,
    setShowApply,
    editRole,
    setEditRole,
    fonts,
    setFonts,
    app,
    setApp,
    showSettings,
    setShowSettings,
    showNerd,
    setShowNerd,
    fontsKey,
    setFontsKey,
    bothModes,
    setBothModes,
    prompt,
    setPromptState,
    setPrompt,
    showWizard,
    setShowWizard,
    tab,
    setTabState,
    setTab,
    group,
    setGroup,
    past,
    future,
    last,
    restoring,
    travel,
    undo,
    redo,
    urlCache,
    urls,
    image,
    pal,
    flash,
    update,
    selectImage,
    addImages,
    deleteImage,
    saveTheme,
    openTheme,
    updateTheme,
    duplicateTheme,
    deleteTheme,
    importTheme,
    surprise,
    addTemplates,
    deleteTemplate,
    copy,
    shareTheme,
    singleKeys,
    setSingleKeys,
    saveOpts,
    report,
    saveFile,
    saveVsix,
    themeName,
    tune,
    effSource,
    overrideCount,
    setOverride,
    cmds,
    files,
    vsSettings,
    importInput,
    TABS,
    bg,
  };
}

export type Studio = ReturnType<typeof useStudio>;
