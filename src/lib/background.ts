// Hintergrundbetrieb (Desktop-App, Windows): Symbol im Infobereich mit gespeicherten Themes,
// automatisch einfärben, wenn sich das Windows-Wallpaper ändert, im Infobereich weiterlaufen.
import { useEffect, useRef } from "react";
import type { ThemeSettings } from "./color";
import { sourceColors } from "./color";
import type { Fonts } from "./fonts";
import { t } from "./i18n";
import { imageToDisk, isTauri } from "./platform";
import type { PromptOptions } from "./prompt";
import { loadSettings } from "./settings";
import { db, type StoredTheme } from "./store";
import { applyAll, type TargetId } from "./windows/apply";
import { tauriBridge } from "./windows/bridge";

/** Was beim automatischen Einfärben gilt: die Einstellungen vom letzten „Anwenden“ (nur die Ausgangsfarbe kommt neu aus dem Wallpaper). */
export interface AutoOptions {
  enabled: boolean;          // bei Wallpaper-Wechsel einfärben
  closeToTray: boolean;      // Fenster schließen → im Infobereich weiterlaufen
  last?: {
    scheme: ThemeSettings["scheme"]; mode: ThemeSettings["mode"]; contrast: number;
    fonts: Fonts; prompt: PromptOptions; titlebars: boolean; withFonts: boolean; only: TargetId[];
  };
}

const KEY = "theme-studio-auto";
export function loadAuto(): AutoOptions {
  try { return { enabled: false, closeToTray: false, ...JSON.parse(localStorage.getItem(KEY) ?? "{}") }; }
  catch { return { enabled: false, closeToTray: false }; }
}
export function storeAuto(a: AutoOptions) {
  try { localStorage.setItem(KEY, JSON.stringify(a)); } catch { /* egal */ }
  if (typeof window !== "undefined") window.dispatchEvent(new Event("theme-studio-auto"));
}
/** Nach jedem erfolgreichen „Anwenden“ merken, womit – das nutzt dann das automatische Einfärben. */
export function rememberApply(last: NonNullable<AutoOptions["last"]>) {
  storeAuto({ ...loadAuto(), last });
}

/** Farben aus dem aktuellen Windows-Wallpaper holen und mit den gemerkten Einstellungen anwenden. */
export async function recolorFromWallpaper(): Promise<string> {
  const a = loadAuto();
  if (!a.last) throw new Error(t("Erst einmal von Hand „Anwenden“ – dann weiß die App, welche Variante und welche Ziele sie nehmen soll."));
  const { invoke } = await import("@tauri-apps/api/core");
  const bytes = await invoke<ArrayBuffer>("wallpaper_bytes");
  const { colors } = await sourceColors(new Blob([bytes]));
  const settings: ThemeSettings = { source: colors[0], scheme: a.last.scheme, mode: a.last.mode, contrast: a.last.contrast };
  const b = await tauriBridge();
  const r = await applyAll(b, { name: t("Automatisch"), settings, fonts: a.last.fonts, prompt: a.last.prompt, titlebars: a.last.titlebars,
    withFonts: a.last.withFonts, only: a.last.only });
  const bad = r.results.filter((x) => x.status === "error").length;
  return bad ? t("Automatisch eingefärbt ({c}) – {n} Fehler, siehe Protokoll", { c: colors[0], n: bad }) : t("Automatisch eingefärbt: {c}", { c: colors[0] });
}

/** Gespeichertes Theme (aus dem Infobereich) anwenden – mit seinem Bild als Wallpaper, falls es eins hat. */
export async function applyStoredTheme(theme: StoredTheme, fallback: { fonts: Fonts; prompt: PromptOptions }): Promise<string> {
  const a = loadAuto();
  const app = await loadSettings();
  let imagePath: string | undefined;
  if (theme.imageId && app.wallpaperDir) {
    const img = (await db.images()).find((i) => i.id === theme.imageId);
    if (img) imagePath = await imageToDisk(img.blob, img.name, app.wallpaperDir);
  }
  const fonts = theme.fonts ?? a.last?.fonts ?? fallback.fonts;
  const prompt = a.last?.prompt ?? fallback.prompt;
  const titlebars = a.last?.titlebars ?? false, withFonts = a.last?.withFonts ?? true;
  const only = a.last?.only ?? ["windows", "terminal", "vscode", "ohmyposh", "komorebi"];
  const b = await tauriBridge();
  const r = await applyAll(b, { name: theme.name, settings: theme.settings, fonts, prompt, imagePath, titlebars, withFonts, only });
  rememberApply({ scheme: theme.settings.scheme, mode: theme.settings.mode, contrast: theme.settings.contrast, fonts, prompt, titlebars, withFonts, only });
  const bad = r.results.filter((x) => x.status === "error").length;
  return bad ? t("„{name}“ angewendet – {n} Fehler, siehe Protokoll", { name: theme.name, n: bad }) : t("„{name}“ angewendet", { name: theme.name });
}

/** In der App: Infobereich-Menü aktuell halten, Klicks und Wallpaper-Wechsel verarbeiten. */
export function useBackground(opts: { themes: StoredTheme[]; lang: string; windows: boolean; fonts: Fonts; prompt: PromptOptions; flash: (m: string, ms?: number) => void }) {
  const ref = useRef(opts);
  ref.current = opts;

  // Menü + Hintergrund-Schalter bei jeder Änderung (Sprache, Themes, Auto an/aus)
  useEffect(() => {
    if (!isTauri) return;
    const push = async () => {
      const { invoke } = await import("@tauri-apps/api/core");
      const a = loadAuto();
      await invoke("bg_close_to_tray", { on: a.closeToTray }).catch(() => undefined);
      await invoke("tray_update", {
        labels: { open: t("Theme Studio öffnen"), apply: t("Theme anwenden"), no_themes: t("(noch keine gespeichert)"),
          auto: t("Automatisch einfärben"), quit: t("Beenden"), tooltip: a.enabled ? t("Theme Studio – färbt automatisch ein") : "Theme Studio" },
        themes: [...opts.themes].sort((x, y) => Number(!!y.favorite) - Number(!!x.favorite) || y.created - x.created).map((x) => ({ id: x.id, name: (x.favorite ? "★ " : "") + x.name })),
        auto: a.enabled,
      }).catch(() => undefined);
    };
    void push();
    window.addEventListener("theme-studio-auto", push);
    return () => window.removeEventListener("theme-studio-auto", push);
  }, [opts.themes, opts.lang]);

  // Ereignisse aus Rust
  useEffect(() => {
    if (!isTauri) return;
    let off: (() => void)[] = [];
    let timer: ReturnType<typeof setTimeout> | undefined;
    void (async () => {
      const { listen } = await import("@tauri-apps/api/event");
      off.push(await listen("tray-auto", () => {
        const a = loadAuto();
        storeAuto({ ...a, enabled: !a.enabled });
        ref.current.flash(!a.enabled ? t("Automatisch einfärben: an") : t("Automatisch einfärben: aus"));
      }));
      off.push(await listen<string>("tray-apply-theme", async (e) => {
        const th = ref.current.themes.find((x) => x.id === e.payload);
        if (!th || !ref.current.windows) return;
        try { ref.current.flash(await applyStoredTheme(th, ref.current), 4000); }
        catch (err) { ref.current.flash(String(err), 6000); }
      }));
      off.push(await listen<string>("wallpaper-changed", () => {
        if (!loadAuto().enabled || !ref.current.windows) return;
        clearTimeout(timer);       // Diashow/mehrere Bildschirme: kurz warten, dann einmal einfärben
        timer = setTimeout(async () => {
          try { ref.current.flash(await recolorFromWallpaper(), 4000); }
          catch (err) { ref.current.flash(String(err), 6000); }
        }, 2000);
      }));
    })();
    return () => { off.forEach((f) => f()); off = []; clearTimeout(timer); };
  }, []);
}
