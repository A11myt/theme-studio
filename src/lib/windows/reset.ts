// „Auf Standard zurücksetzen“ (Windows): alles, was Theme Studio je gesetzt hat, wieder raus –
// zurück auf den Stand vor dem ersten Eingriff (gemerkte Originale), sonst auf den Windows-Standard.
// Fremde Einstellungen bleiben unangetastet; das Zurücksetzen selbst ist wieder eine Sicherung (→ Rückgängig).
import { t as tr } from "../i18n";
import { detectShells, writeShells } from "../shells";
import { CSS_BEGIN, CSS_END, FF_PREF_LINE, OBSIDIAN_SNIPPET, upsertMarked } from "../apps";
import { conflicts, detect, MARK_BEGIN_JSON, MARK_END_JSON, res, SCHEME_NAME, stamp, vscodeCandidates, type TargetResult } from "./apply";
import { join, type Bridge, type RegSet, type RegValue, type WinEnv } from "./bridge";
import { restoreWinKeys, stopWhkd, whkdAutostartOff, winthemeOff } from "./services";
import { parseJsonc } from "./jsonc";

/** Windows-10/11-Standard (Blau #0078D7, hell) – falls kein Original gemerkt ist. */
export const WINDOWS_DEFAULT: Record<string, RegValue> = {
  AccentPalette: { kind: "Binary", value: [0xa6, 0xd8, 0xff, 0, 0x76, 0xb9, 0xed, 0, 0x42, 0x9c, 0xe3, 0, 0x00, 0x78, 0xd7, 0, 0x00, 0x5a, 0x9e, 0, 0x00, 0x42, 0x75, 0, 0x00, 0x26, 0x42, 0, 0xf7, 0x63, 0x0c, 0] },
  AccentColorMenu: { kind: "Dword", value: 0xffd77800 },
  StartColorMenu: { kind: "Dword", value: 0xff9e5a00 },
  AccentColor: { kind: "Dword", value: 0xffd77800 },
  ColorizationColor: { kind: "Dword", value: 0xc40078d7 },
  ColorizationAfterglow: { kind: "Dword", value: 0xc40078d7 },
  ColorPrevalence: { kind: "Dword", value: 0 },
  AppsUseLightTheme: { kind: "Dword", value: 1 },
  SystemUsesLightTheme: { kind: "Dword", value: 1 },
  AutoColorization: { kind: "Dword", value: 0 },
};
// dieselben Werte wie registryValues() in apply.ts (Test prüft das)
const ACCENT = "Software\\Microsoft\\Windows\\CurrentVersion\\Explorer\\Accent";
const DWM = "Software\\Microsoft\\Windows\\DWM";
const THEMES = "Software\\Microsoft\\Windows\\CurrentVersion\\Themes\\Personalize";
export const REG_TARGETS: [string, string][] = [
  [ACCENT, "AccentPalette"], [ACCENT, "AccentColorMenu"], [ACCENT, "StartColorMenu"],
  [DWM, "AccentColor"], [DWM, "ColorizationColor"], [DWM, "ColorizationAfterglow"], [DWM, "ColorPrevalence"],
  [THEMES, "AppsUseLightTheme"], [THEMES, "SystemUsesLightTheme"], ["Control Panel\\Desktop", "AutoColorization"],
];
const DEFAULT_WALLPAPER = "C:\\Windows\\Web\\Wallpaper\\Windows\\img0.jpg";

/** Registry-Werte fürs Zurücksetzen: gemerktes Original (auch „gab es nicht“ → löschen), sonst Windows-Standard. */
export function resetRegistry(orig: Record<string, unknown>): { values: RegSet[]; fromOriginal: number } {
  let fromOriginal = 0;
  const values = REG_TARGETS.map(([key, name]) => {
    const k = `reg|${key}|${name}`;
    if (k in orig) {
      fromOriginal++;
      const v = orig[k] as RegValue | null;
      return { key, name, value: v ?? ({ kind: "Delete" } as RegValue) };
    }
    return { key, name, value: WINDOWS_DEFAULT[name] };
  });
  return { values, fromOriginal };
}

/** Windows-Terminal-Einstellungen ohne Theme Studio: Schema/Theme raus, Standard-Werte zurück. */
export function cleanTerminal(text: string, orig?: { colorScheme: unknown; font: unknown; theme: unknown }): string {
  const data = parseJsonc(text) as Record<string, any>;
  if (Array.isArray(data.schemes)) data.schemes = data.schemes.filter((s: any) => s?.name !== SCHEME_NAME);
  if (Array.isArray(data.themes)) data.themes = data.themes.filter((t: any) => t?.name !== SCHEME_NAME);
  const d = data.profiles?.defaults;
  const put = (o: Record<string, unknown>, k: string, v: unknown) => { if (v === null || v === undefined) delete o[k]; else o[k] = v; };
  if (orig) {
    if (d) { put(d, "colorScheme", orig.colorScheme); put(d, "font", orig.font); }
    put(data, "theme", orig.theme);
  } else {
    if (d?.colorScheme === SCHEME_NAME) delete d.colorScheme;
    if (data.theme === SCHEME_NAME) delete data.theme;
  }
  return JSON.stringify(data, null, 4) + "\n";
}

/** Theme-Studio-Block aus einer JSONC-Datei (VS Code) entfernen; der Rest bleibt Zeichen für Zeichen. */
export function removeJsonBlock(text: string): string {
  const esc = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const out = text.replace(new RegExp(`,?\\s*${esc(MARK_BEGIN_JSON)}[\\s\\S]*?${esc(MARK_END_JSON)}`), "");
  parseJsonc(out);                      // nie kaputt schreiben
  return out;
}

export async function resetAll(b: Bridge): Promise<{ results: TargetResult[]; session: string; logFile: string }> {
  const e: WinEnv = await b.env();
  const dets = await detect(b, e);
  const orig = await b.origGet().catch(() => ({} as Record<string, unknown>));
  const session = await b.backupBegin("Auf Standard zurückgesetzt");
  const results: TargetResult[] = [];
  const run = async (id: TargetResult["id"], f: (details: string[]) => Promise<TargetResult>) => {
    try { results.push(await f([])); }
    catch (err) { results.push(res(id, "error", tr("unerwarteter Fehler: {e}", { e: String(err).replace(/^Error: /, "") }), [String(err)])); }
  };

  // Windows: Akzent, Hell/Dunkel, Wallpaper
  if (e.os === "windows") await run("windows", async (details) => {
    const { values, fromOriginal } = resetRegistry(orig);
    await b.regApply(session, values);
    details.push(`Registry: ${fromOriginal}/${values.length} Werte aus dem Original, Rest Windows-Standard`);
    const wp = typeof orig.wallpaper === "string" && orig.wallpaper && (await b.exists(orig.wallpaper)) ? orig.wallpaper
      : (await b.exists(DEFAULT_WALLPAPER)) ? DEFAULT_WALLPAPER : "";
    if (wp) { await b.setWallpaper(wp); details.push(`Wallpaper: ${wp}`); }
    await b.broadcastColors();
    return res("windows", "ok", fromOriginal ? tr("Akzent, Hell/Dunkel und Wallpaper wie vor Theme Studio") : tr("Windows-Standard (Blau, hell) – kein gemerktes Original"), details);
  });

  // Windows Terminal
  const wt = dets.find((d) => d.id === "terminal");
  if (wt?.found) await run("terminal", async (details) => {
    for (const f of wt.where) {
      const text = await b.read(f);
      if (text === null) continue;
      const o = orig[`wt|${f}`] as Parameters<typeof cleanTerminal>[1];
      const out = cleanTerminal(text, o);
      if (out !== text) { await b.write(session, f, out); details.push(`${o ? "Original" : "bereinigt"}: ${f}`); }
    }
    return res("terminal", "ok", tr("Schema „{s}“ entfernt, Standard-Farben wieder aktiv", { s: SCHEME_NAME }), details);
  });

  // VS Code
  const vs = dets.find((d) => d.id === "vscode");
  if (vs?.found) await run("vscode", async (details) => {
    for (const { dir, file } of vscodeCandidates(e)) {
      if (!vs.where.includes(dir)) continue;
      const text = await b.read(file);
      if (!text?.includes(MARK_BEGIN_JSON)) continue;
      await b.write(session, file, removeJsonBlock(text));
      details.push(`Block entfernt: ${file}`);
    }
    return res("vscode", "ok", details.length ? tr("Farben und Schrift aus Theme Studio entfernt") : tr("nichts zu tun"), details);
  });

  // Prompt: aus allen Shells austragen (nicht nur den gewählten)
  await run("ohmyposh", async (details) => {
    const shells = (await detectShells(b, e)).filter((s) => s.found);
    const w = await writeShells(b, session, shells.filter((s) => !s.linked), { enabled: false, engine: "omp", config: "", p10kFile: "" });
    details.push(...w.details);
    return res("ohmyposh", "ok", w.details.some((d) => d.includes("entfernt")) ? tr("Studio-Prompt aus den Profilen entfernt – neue Fenster zeigen deinen alten Prompt") : tr("nichts zu tun"), details);
  });

  // komorebi
  const ko = dets.find((d) => d.id === "komorebi");
  if (ko?.found) await run("komorebi", async (details) => {
    for (const f of ko.where.filter((p) => p.endsWith(".json"))) {
      const text = await b.read(f);
      if (text === null) continue;
      const data = parseJsonc(text) as Record<string, any>;
      const key = `komorebi|${f}`;
      if (key in orig) {
        const t = (orig[key] as { theme: unknown }).theme;
        if (t === null || t === undefined) delete data.theme; else data.theme = t;
      } else if (data.theme?.palette === "Custom") delete data.theme;
      else continue;
      await b.write(session, f, JSON.stringify(data, null, 2) + "\n");
      details.push(`${key in orig ? "Original" : "Theme entfernt"}: ${f}`);
    }
    const st = await b.runTool("komorebic", ["state"]).catch(() => ({ code: -1, output: "" }));
    if (st.code === 0) await b.runTool("komorebic", ["reload-configuration"]).catch(() => undefined);
    return res("komorebi", "ok", details.length ? tr("Rahmen und Leiste wieder mit Standard-Farben") : tr("nichts zu tun"), details);
  });

  // Obsidian: Snippet ausschalten und entfernen
  const ob = dets.find((d) => d.id === "obsidian");
  if (ob?.found) await run("obsidian", async (details) => {
    for (const vault of ob.where) {
      const dir = join(vault, ".obsidian");
      const appFile = join(dir, "appearance.json");
      const text = await b.read(appFile);
      try {
        const data = text ? JSON.parse(text) : null;
        if (data && Array.isArray(data.enabledCssSnippets) && data.enabledCssSnippets.includes(OBSIDIAN_SNIPPET)) {
          data.enabledCssSnippets = data.enabledCssSnippets.filter((x: string) => x !== OBSIDIAN_SNIPPET);
          await b.write(session, appFile, JSON.stringify(data, null, 2));
        }
      } catch { /* unlesbar → nur Datei entfernen */ }
      if (await b.remove(session, join(dir, "snippets", `${OBSIDIAN_SNIPPET}.css`))) details.push(`Snippet entfernt: ${vault}`);
    }
    return res("obsidian", "ok", details.length ? tr("Theme-Studio-Snippet entfernt") : tr("nichts zu tun"), details);
  });

  // Firefox: Block aus userChrome.css und unsere Zeile aus user.js
  const ff = dets.find((d) => d.id === "firefox");
  if (ff?.found) await run("firefox", async (details) => {
    for (const prof of ff.where) {
      const css = join(prof, "chrome", "userChrome.css");
      const t = await b.read(css);
      if (t?.includes(CSS_BEGIN)) { await b.write(session, css, upsertMarked(t, CSS_BEGIN, CSS_END, null)); details.push(`userChrome.css bereinigt: ${prof}`); }
      const userJs = join(prof, "user.js");
      const uj = await b.read(userJs);
      if (uj?.includes(FF_PREF_LINE)) await b.write(session, userJs, uj.split(/\r?\n/).filter((l) => l !== FF_PREF_LINE).join("\n"));
    }
    return res("firefox", "ok", details.length ? tr("Firefox-Farben entfernt – wirkt nach dem nächsten Start") : tr("nichts zu tun"), details);
  });

  if (e.os === "windows") {
    // Autostart: Farb-Automatik (wintheme --watch) aus, whkd aus dem komorebi-Autostart nehmen und beenden
    await run("autostart", async (details) => {
      await winthemeOff(b, e, session, details);
      const failed = await whkdAutostartOff(b, e, session, details);
      await stopWhkd(b, details);
      if (failed) return res("autostart", "warn", failed, details);
      return res("autostart", "ok", details.length ? tr("Farb-Automatik und Tasten-Dienst whkd aus – komorebi startet weiter, nur ohne whkd") : tr("nichts zu tun"), details);
    });

    // Win-Tastenkombinationen: wie vor install.ps1 (Sicherung), sonst unsere Buchstaben aus DisabledHotkeys und Andocken wieder an
    await run("hotkeys", async (details) =>
      (await restoreWinKeys(b, e, session, details))
        ? res("hotkeys", "ok", tr("Win-Tasten wieder bei Windows (Win+1–7, Q, C, F, D, O, W, Andocken)"), details)
        : res("hotkeys", "skipped", tr("nicht verändert (kein whkd-Setup gefunden)"), details));
  }

  const warn = await conflicts(b, e).catch(() => [] as string[]);
  const log = ["", `=== ${stamp()} Auf Standard zurückgesetzt – Sicherung ${session}`, ...warn.map((w) => `[WARNUNG] ${w}`)];
  for (const r of results) log.push(`[${r.status.toUpperCase().padEnd(7)}] ${r.label}: ${r.message}`, ...r.details.map((x) => `           ${x}`));
  const logFile = await b.log(log).catch(() => e.logFile);
  return { results, session, logFile };
}
