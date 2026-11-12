// „Anwenden“ unter Windows – alles aus der App, ohne Python/Skripte:
// Wallpaper + Akzentfarbe/Hell-Dunkel (Registry), Windows Terminal, VS Code, oh-my-posh (PowerShell 5.1 + 7), komorebi.
// Jedes Ziel: erkennen → anwenden → verständliche Meldung (was fehlt, was zu tun ist). Alles wird protokolliert,
// jede Änderung vorher gesichert (Rückgängig). Die Abläufe hier sind mit nachgebautem Windows getestet (test/windows.test.ts).
import { buildScheme, effectiveSource, palette, type Palette, type ThemeSettings } from "../color";
import { base16, renderTemplate, terminalScheme } from "../exporters";
import type { Fonts } from "../fonts";
import { ompTemplate, type PromptOptions } from "../prompt";
import { vscodeTheme } from "../vscode";
import { join, type Bridge, type RegSet, type WinEnv } from "./bridge";
import { parseJsonc, upsertBlock } from "./jsonc";
import OMP_DEFAULT from "./ohmyposh-default.json?raw";
import { CSS_BEGIN, CSS_END, FF_PREF_LINE, firefoxCss, firefoxProfiles, OBSIDIAN_SNIPPET, obsidianCss, obsidianVaults, upsertMarked } from "../apps";
import { chosenShells, detectShells, effectivePolicy, initLines, promptDir, writeShells } from "../shells";
import { t as tr } from "../i18n";

export type TargetId = "windows" | "terminal" | "vscode" | "ohmyposh" | "komorebi" | "obsidian" | "firefox" | "autostart" | "hotkeys";
export type Status = "ok" | "warn" | "skipped" | "error";

export interface Detection {
  id: TargetId;
  label: string;
  found: boolean;
  where: string[];      // gefundene Dateien/Programme
  hint?: string;        // wenn nicht gefunden: was zu tun ist
}

export interface TargetResult {
  id: TargetId;
  label: string;
  status: Status;
  message: string;      // für den Nutzer
  details: string[];    // fürs Protokoll
}

export interface ApplyOptions {
  name: string;
  settings: ThemeSettings;
  fonts: Fonts;
  prompt: PromptOptions;
  imagePath?: string;   // Wallpaper auf der Platte (sonst bleibt das aktuelle)
  titlebars: boolean;   // Akzentfarbe auch in Titelleisten
  withFonts: boolean;
  only?: TargetId[];    // nur diese Ziele
}

export const LABELS: Record<TargetId, string> = {
  windows: "Windows (Wallpaper, Akzent, Hell/Dunkel)",
  terminal: "Windows Terminal",
  vscode: "VS Code",
  ohmyposh: "oh-my-posh (PowerShell-Prompt)",
  komorebi: "komorebi (Rahmen + Leiste)",
  obsidian: "Obsidian (CSS-Snippet)",
  firefox: "Firefox (Tableiste, Menüs)",
  autostart: "Autostart (Farb-Automatik, whkd)",
  hotkeys: "Win-Tastenkombinationen",
};

export const SCHEME_NAME = "Theme Studio";
export const MARK_BEGIN_JSON = "  // >>> theme-studio (wird beim Anwenden ersetzt)";
export const MARK_END_JSON = "  // <<< theme-studio";
const MARK_BEGIN_PS = "# >>> theme-studio (wird beim Anwenden ersetzt)";
const MARK_END_PS = "# <<< theme-studio";

// ── Fundorte ────────────────────────────────────────────────────────────────

export function terminalCandidates(e: WinEnv): string[] {
  const pk = join(e.localappdata, "Packages");
  return [
    join(pk, "Microsoft.WindowsTerminal_8wekyb3d8bbwe", "LocalState", "settings.json"),
    join(pk, "Microsoft.WindowsTerminalPreview_8wekyb3d8bbwe", "LocalState", "settings.json"),
    join(e.localappdata, "Microsoft", "Windows Terminal", "settings.json"),          // ohne Store (scoop, zip)
  ];
}
export function vscodeCandidates(e: WinEnv): { dir: string; file: string }[] {
  return ["Code", "Code - Insiders", "VSCodium"].map((n) => ({ dir: join(e.appdata, n, "User"), file: join(e.appdata, n, "User", "settings.json") }));
}
export function psProfiles(e: WinEnv): { file: string; label: string }[] {
  return [
    { file: join(e.documents, "WindowsPowerShell", "Microsoft.PowerShell_profile.ps1"), label: "Windows PowerShell 5.1" },
    { file: join(e.documents, "PowerShell", "Microsoft.PowerShell_profile.ps1"), label: "PowerShell 7" },
  ];
}
export function komorebiDir(e: WinEnv): string {
  return e.komorebiConfigHome || e.home;
}

// ── Erkennen ────────────────────────────────────────────────────────────────

export async function detect(b: Bridge, e: WinEnv): Promise<Detection[]> {
  const exists = async (ps: string[]) => (await Promise.all(ps.map(async (p) => ((await b.exists(p)) ? p : null)))).filter(Boolean) as string[];
  const wt = await exists(terminalCandidates(e));
  const vs = await exists(vscodeCandidates(e).map((c) => c.dir));
  const kd = komorebiDir(e);
  const vaults = await exists(obsidianVaults((await b.read(join(e.appdata, "obsidian", "obsidian.json")).catch(() => null)) ?? ""));
  const ffBase = join(e.appdata, "Mozilla", "Firefox");
  const ffProfiles = await exists(firefoxProfiles((await b.read(join(ffBase, "profiles.ini")).catch(() => null)) ?? "", ffBase, "\\"));
  const kfiles = await exists([join(kd, "komorebi.json"), join(kd, "komorebi.bar.json"), ...[1, 2, 3].map((i) => join(kd, `komorebi.bar.${i}.json`))]);
  return [
    { id: "windows", label: LABELS.windows, found: e.os === "windows", where: e.windowsBuild ? [e.windowsBuild] : [],
      hint: e.os === "windows" ? undefined : tr("nur unter Windows") },
    { id: "terminal", label: LABELS.terminal, found: wt.length > 0, where: wt,
      hint: tr("Windows Terminal einmal öffnen – erst dann legt es seine settings.json an. Installieren: winget install Microsoft.WindowsTerminal") },
    { id: "vscode", label: LABELS.vscode, found: vs.length > 0, where: vs,
      hint: tr("VS Code nicht gefunden (kein %APPDATA%\\Code\\User). Installieren: winget install Microsoft.VisualStudioCode") },
    { id: "ohmyposh", label: LABELS.ohmyposh, found: !!e.tools["oh-my-posh"], where: e.tools["oh-my-posh"] ? [e.tools["oh-my-posh"]] : [],
      hint: tr("oh-my-posh nicht installiert. Installieren: winget install JanDeDobbeleer.OhMyPosh (danach Theme Studio neu starten)") },
    { id: "komorebi", label: LABELS.komorebi, found: !!e.tools.komorebic && kfiles.some((f) => f.endsWith("komorebi.json")),
      where: [...(e.tools.komorebic ? [e.tools.komorebic] : []), ...kfiles],
      hint: !e.tools.komorebic
        ? tr("komorebi nicht installiert (komorebic nicht gefunden). Installieren: scoop install komorebi")
        : tr("komorebi.json nicht gefunden in {dir} – einmal „komorebic quickstart“ ausführen oder KOMOREBI_CONFIG_HOME setzen", { dir: kd }) },
    { id: "obsidian", label: LABELS.obsidian, found: vaults.length > 0, where: vaults,
      hint: tr("Obsidian nicht gefunden (kein Vault in %APPDATA%\\obsidian\\obsidian.json)") },
    { id: "firefox", label: LABELS.firefox, found: ffProfiles.length > 0, where: ffProfiles,
      hint: tr("Firefox nicht gefunden (kein Profil in %APPDATA%\\Mozilla\\Firefox)") },
  ];
}

/** Dinge, die dem Anwenden in die Quere kommen (z. B. das alte wintheme, das bei jedem Wallpaper-Wechsel drüberfärbt). */
export async function conflicts(b: Bridge, e: WinEnv): Promise<string[]> {
  const out: string[] = [];
  const startup = join(e.appdata, "Microsoft", "Windows", "Start Menu", "Programs", "Startup", "wintheme-watch.lnk");
  if (await b.exists(join(e.localappdata, "wintheme")) || (await b.exists(startup))) {
    out.push(tr("Das alte wintheme ist noch installiert und färbt bei jedem Wallpaper-Wechsel mit eigenen Farben drüber. Entfernen (Farben bleiben): in dotfiles-windows .\\install.ps1 -Uninstall -KeepColors"));
  }
  out.push(...(await policyIssues(b, e)));
  return out;
}

// ── PowerShell-Ausführungsrichtlinie ────────────────────────────────────────
// „Restricted“ (Standard bei Windows PowerShell 5.1) oder „AllSigned“ → das Profil wird nicht geladen, der Prompt startet nicht.
// effectivePolicy liegt in shells.ts (wird auch für „blockierte Shells überspringen“ gebraucht) und wird hier re-exportiert.
export { effectivePolicy };

export async function policyIssues(b: Bridge, e: WinEnv): Promise<string[]> {
  if (e.os !== "windows") return [];
  const shells = [
    { tool: "powershell" as const, label: "Windows PowerShell 5.1", fallback: "Restricted" },
    { tool: "pwsh" as const, label: "PowerShell 7", fallback: "RemoteSigned" },
  ];
  const lists = await b.psPolicy().catch(() => ({} as Partial<Record<"powershell" | "pwsh", string>>));
  const out: string[] = [];
  for (const sh of shells) {
    const raw = lists[sh.tool];
    const p = raw ? effectivePolicy(raw, sh.fallback) : null;
    if (!p || !["Restricted", "AllSigned"].includes(p.policy)) continue;
    out.push(p.managed
      ? tr("{shell}: Ausführungsrichtlinie „{p}“ ist per Gruppenrichtlinie vorgegeben (Firma/Admin) – das Profil und damit der Prompt werden dort nicht geladen. Alles andere funktioniert trotzdem.", { shell: sh.label, p: p.policy })
      : tr("{shell}: Ausführungsrichtlinie „{p}“ blockiert das Profil – der Prompt startet nicht. Einmal in PowerShell ausführen: Set-ExecutionPolicy -Scope CurrentUser RemoteSigned", { shell: sh.label, p: p.policy }));
  }
  return out;
}

// ── Windows: Wallpaper, Akzent, Hell/Dunkel ─────────────────────────────────

const rgb = (h: string) => [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16));
const abgr = (h: string, a = 0xff) => { const [r, g, bl] = rgb(h); return ((a << 24) | (bl << 16) | (g << 8) | r) >>> 0; };
const hexOf = (argb: number) => "#" + (argb & 0xffffff).toString(16).padStart(6, "0");

/** Akzentpalette wie die Windows-Einstellungen sie speichert: 7 Stufen der Primärfarbe + 1 Tertiärfarbe. */
export function accentPalette(s: ThemeSettings): string[] {
  const sch = buildScheme(s);
  return [...[90, 77, 62, 50, 42, 28, 14].map((t) => hexOf(sch.primaryPalette.tone(t))), hexOf(sch.tertiaryPalette.tone(60))];
}

export function registryValues(s: ThemeSettings, titlebars: boolean): RegSet[] {
  const acc = accentPalette(s);
  const [r, g, bl] = rgb(acc[3]);
  const colorization = ((0xc4 << 24) | (r << 16) | (g << 8) | bl) >>> 0;
  const light = s.mode === "light" ? 1 : 0;
  const ACCENT = "Software\\Microsoft\\Windows\\CurrentVersion\\Explorer\\Accent";
  const DWM = "Software\\Microsoft\\Windows\\DWM";
  const THEMES = "Software\\Microsoft\\Windows\\CurrentVersion\\Themes\\Personalize";
  const d = (value: number) => ({ kind: "Dword" as const, value });
  return [
    { key: ACCENT, name: "AccentPalette", value: { kind: "Binary", value: acc.flatMap((c) => [...rgb(c), 0]) } },
    { key: ACCENT, name: "AccentColorMenu", value: d(abgr(acc[3])) },
    { key: ACCENT, name: "StartColorMenu", value: d(abgr(acc[5])) },
    { key: DWM, name: "AccentColor", value: d(abgr(acc[3])) },
    { key: DWM, name: "ColorizationColor", value: d(colorization) },
    { key: DWM, name: "ColorizationAfterglow", value: d(colorization) },
    { key: DWM, name: "ColorPrevalence", value: d(titlebars ? 1 : 0) },
    { key: THEMES, name: "AppsUseLightTheme", value: d(light) },
    { key: THEMES, name: "SystemUsesLightTheme", value: d(light) },
    { key: "Control Panel\\Desktop", name: "AutoColorization", value: d(0) },   // Windows soll nicht selbst wählen
  ];
}

async function applyWindows(b: Bridge, session: string, o: ApplyOptions): Promise<TargetResult> {
  const details: string[] = [];
  const acc = accentPalette(o.settings);
  if (o.imagePath) {
    try {
      await b.setWallpaper(o.imagePath);
      details.push(`Wallpaper gesetzt: ${o.imagePath}`);
    } catch (e) {
      return res("windows", "error", tr("Wallpaper konnte nicht gesetzt werden: {e}", { e: String(e) }), details);
    }
  } else details.push("Wallpaper unverändert (kein Bild gewählt)");
  await b.regApply(session, registryValues(o.settings, o.titlebars));
  details.push(`Registry: Akzent ${acc[3]}, ${o.settings.mode === "dark" ? "dunkel" : "hell"}, Titelleisten ${o.titlebars ? "eingefärbt" : "neutral"}`);
  await b.broadcastColors();
  return res("windows", "ok", tr(o.imagePath ? "Akzent {c}, {mode}, Wallpaper gesetzt" : "Akzent {c}, {mode}", { c: acc[3], mode: o.settings.mode === "dark" ? tr("dunkel") : tr("hell") }), details);
}

// ── Windows Terminal ────────────────────────────────────────────────────────

export function mergeTerminal(text: string | null, c: Palette, o: ApplyOptions, fontInstalled: boolean) {
  const data = parseJsonc(text ?? "{}") as Record<string, any>;
  const scheme = terminalScheme(c, o.settings, SCHEME_NAME);
  data.schemes = [...(Array.isArray(data.schemes) ? data.schemes : []).filter((s: any) => s?.name !== SCHEME_NAME), scheme];
  if (Array.isArray(data.profiles)) data.profiles = { list: data.profiles };   // sehr alte Form
  data.profiles ??= {};
  data.profiles.defaults ??= {};
  const d = data.profiles.defaults;
  d.colorScheme = SCHEME_NAME;
  if (o.withFonts && fontInstalled) d.font = { ...(d.font ?? {}), face: o.fonts.mono, size: o.fonts.monoSize + 1 };
  data.themes = [...(Array.isArray(data.themes) ? data.themes : []).filter((t: any) => t?.name !== SCHEME_NAME), {
    name: SCHEME_NAME,
    window: { applicationTheme: o.settings.mode === "dark" ? "dark" : "light", useMica: false },
    tabRow: { background: c.surface + "ff", unfocusedBackground: c.surface + "ff" },
    tab: { background: c.surface_container_high + "ff", unfocusedBackground: c.surface + "ff", showCloseButton: "hover" },
  }];
  data.theme = SCHEME_NAME;
  return JSON.stringify(data, null, 4) + "\n";
}

/** Terminal-Original merken (nur wenn es noch nicht von Theme Studio ist). */
async function rememberTerminal(b: Bridge, f: string, text: string | null) {
  const data = parseJsonc(text ?? "{}") as Record<string, any>;
  const d = (Array.isArray(data.profiles) ? {} : data.profiles?.defaults) ?? {};
  if (d.colorScheme === SCHEME_NAME || data.theme === SCHEME_NAME) return;
  await b.origSetOnce(`wt|${f}`, { colorScheme: d.colorScheme ?? null, font: d.font ?? null, theme: data.theme ?? null }).catch(() => false);
}

async function applyTerminal(b: Bridge, session: string, o: ApplyOptions, det: Detection, c: Palette): Promise<TargetResult> {
  const details: string[] = [];
  const list = o.withFonts ? await b.fonts().catch(() => [] as string[]) : [];
  const installed = new Set(list);
  // Liste leer = Schriften ließen sich nicht abfragen → Schrift trotzdem setzen, statt fälschlich „nicht installiert“ zu melden
  const fontOk = installed.has(o.fonts.mono) || (o.withFonts && list.length === 0);
  if (o.withFonts && list.length === 0) details.push("Schriftliste nicht abfragbar – Schrift ungeprüft gesetzt");
  let done = 0;
  for (const f of det.where) {
    const text = await b.read(f);
    try {
      await rememberTerminal(b, f, text);
      const out = mergeTerminal(text, c, o, fontOk);
      await b.write(session, f, out);
      details.push(`geschrieben: ${f}`);
      done++;
    } catch (e) {
      details.push(`FEHLER ${f}: ${String(e)}`);
      return res("terminal", "error", tr("settings.json konnte nicht gelesen werden – {e}. Nichts geändert.", { e: String(e).replace(/^Error: /, "") }), details);
    }
  }
  if (o.withFonts && !fontOk) {
    return res("terminal", "warn", tr("Farben gesetzt. Schrift „{font}“ ist nicht installiert – im Bereich Schrift → Nerd Fonts installieren, dann erneut anwenden.", { font: o.fonts.mono }), details);
  }
  return res("terminal", "ok", tr(o.withFonts ? "Schema „{s}“, Schrift {font} ({n}×) – wirkt sofort" : "Schema „{s}“ ({n}×) – wirkt sofort", { s: SCHEME_NAME, font: o.fonts.mono, n: done }), details);
}

// ── VS Code ─────────────────────────────────────────────────────────────────

export function mergeVscode(text: string | null, c: Palette, o: ApplyOptions) {
  const th = vscodeTheme(o.name, o.settings, c);
  const entries: Record<string, unknown> = {
    "workbench.colorCustomizations": th.colors,
    "editor.tokenColorCustomizations": { textMateRules: th.tokenColors },
    "editor.semanticTokenColorCustomizations": { enabled: true, rules: th.semanticTokenColors },
  };
  if (o.withFonts) {
    const px = Math.round((o.fonts.monoSize * 4) / 3);
    Object.assign(entries, {
      "editor.fontFamily": `'${o.fonts.mono}', Consolas, monospace`,
      "editor.fontSize": px,
      "terminal.integrated.fontFamily": `'${o.fonts.mono}'`,
      "terminal.integrated.fontSize": px,
    });
  }
  parseJsonc(text ?? "{}");                       // vorher prüfen: kaputte Datei nicht anfassen
  const out = upsertBlock(text ?? "{\n}", MARK_BEGIN_JSON, MARK_END_JSON, entries);
  parseJsonc(out);                                // nachher prüfen: nie kaputt schreiben
  return out;
}

async function applyVscode(b: Bridge, session: string, o: ApplyOptions, det: Detection, e: WinEnv, c: Palette): Promise<TargetResult> {
  const details: string[] = [];
  const dirs = new Set(det.where);
  let done = 0;
  for (const { dir, file } of vscodeCandidates(e)) {
    if (!dirs.has(dir)) continue;
    const text = await b.read(file);
    try {
      await b.write(session, file, mergeVscode(text, c, o));
      details.push(`${text === null ? "angelegt" : "geschrieben"}: ${file}`);
      done++;
    } catch (err) {
      details.push(`FEHLER ${file}: ${String(err)}`);
      return res("vscode", "error", tr("settings.json ist {e} – nichts geändert. Bitte die Datei in VS Code reparieren.", { e: String(err).replace(/^Error: /, "") }), details);
    }
  }
  return res("vscode", "ok", tr(o.withFonts ? "Farben + Schrift gesetzt ({n}×) – wirkt sofort" : "Farben gesetzt ({n}×) – wirkt sofort", { n: done }), details);
}

// ── oh-my-posh ──────────────────────────────────────────────────────────────

export function profileBlock(configPath: string): string {
  return [MARK_BEGIN_PS, ...initLines("pwsh", "omp", configPath, ""), MARK_END_PS].join("\r\n");
}

export function upsertProfile(text: string | null, block: string | null): string {
  const re = new RegExp(`\\r?\\n?${MARK_BEGIN_PS.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}[\\s\\S]*?${MARK_END_PS}\\r?\\n?`);
  let t = (text ?? "").replace(re, "\r\n").replace(/(\r?\n)+$/, "");
  if (block) t = (t ? t + "\r\n\r\n" : "") + block;     // am Ende: gewinnt gegen ein früheres oh-my-posh init
  return t + "\r\n";
}

async function applyOhmyposh(b: Bridge, session: string, o: ApplyOptions, e: WinEnv): Promise<TargetResult> {
  const details: string[] = [];
  const config = join(promptDir(e), "prompt.omp.json");
  const template = o.prompt.enabled ? ompTemplate(o.prompt) : OMP_DEFAULT;
  const theme = renderTemplate(template, o.settings);
  JSON.parse(theme);
  await b.write(session, config, theme);
  details.push(`Theme: ${config} (${o.prompt.enabled ? "Prompt-Assistent" : "Standard-Prompt"})`);
  const all = await detectShells(b, e);
  const shells = chosenShells(all, o.prompt.shells);
  for (const sh of all.filter((x) => !shells.includes(x))) details.push(`übersprungen: ${sh.label} (${sh.found ? "abgewählt" : "nicht installiert"})`);
  if (!shells.length) return res("ohmyposh", "skipped", tr("keine Shell ausgewählt – im Bereich Terminal wählen"), details);
  const w = await writeShells(b, session, shells, { enabled: true, engine: "omp", config, p10kFile: "" });
  details.push(...w.details);
  const blocked = await policyIssues(b, e);
  details.push(...blocked.map((x) => `Richtlinie: ${x}`));
  if (blocked.length) {
    return res("ohmyposh", "warn", tr("Prompt eingerichtet, startet aber nicht: {why}", { why: blocked[0] }), details);
  }
  return res("ohmyposh", "ok", tr("Prompt in {list} – wirkt in neuen Shell-Fenstern", { list: w.done.join(", ") }), details);
}

// ── komorebi ────────────────────────────────────────────────────────────────

export function komorebiThemes(c: Palette, dark: boolean) {
  const colours = base16(c, dark);
  return {
    main: { palette: "Custom", colours, single_border: "Base0D", stack_border: "Base0E", monocle_border: "Base09",
      floating_border: "Base0C", unfocused_border: "Base02", unfocused_locked_border: "Base08", bar_accent: "Base0D" },
    bar: { palette: "Custom", colours, accent: "Base0D" },
  };
}

async function applyKomorebi(b: Bridge, session: string, o: ApplyOptions, det: Detection, c: Palette): Promise<TargetResult> {
  const details: string[] = [];
  const th = komorebiThemes(c, o.settings.mode === "dark");
  for (const f of det.where.filter((p) => p.endsWith(".json"))) {
    const text = await b.read(f);
    try {
      const data = parseJsonc(text ?? "{}");
      const prev = data.theme as { palette?: string } | undefined;
      if (prev?.palette !== "Custom") await b.origSetOnce(`komorebi|${f}`, { theme: prev ?? null }).catch(() => false);
      data.theme = f.endsWith("komorebi.json") ? th.main : th.bar;
      await b.write(session, f, JSON.stringify(data, null, 2) + "\n");
      details.push(`geschrieben: ${f}`);
    } catch (e) {
      details.push(`FEHLER ${f}: ${String(e)}`);
      return res("komorebi", "error", tr("{file} ist {e} – nichts geändert.", { file: f.split("\\").pop() ?? f, e: String(e).replace(/^Error: /, "") }), details);
    }
  }
  const state = await b.runTool("komorebic", ["state"]).catch((e) => ({ code: -1, output: String(e) }));
  if (state.code !== 0) {
    details.push(`komorebic state → ${state.code}: ${state.output.slice(0, 200)}`);
    return res("komorebi", "ok", tr("Farben gespeichert – komorebi läuft gerade nicht, sie gelten beim nächsten Start"), details);
  }
  const reload = await b.runTool("komorebic", ["reload-configuration"]);
  details.push(`komorebic reload-configuration → ${reload.code}${reload.output ? `: ${reload.output.slice(0, 300)}` : ""}`);
  if (reload.code !== 0) {
    return res("komorebi", "error", tr("Farben gespeichert, aber komorebi hat die Konfiguration abgelehnt: {msg}", { msg: reload.output.split("\n")[0] || `Code ${reload.code}` }), details);
  }
  return res("komorebi", "ok", tr("Rahmen und Leiste neu eingefärbt"), details);
}

// ── Obsidian + Firefox ──────────────────────────────────────────────────────

async function applyObsidian(b: Bridge, session: string, o: ApplyOptions, det: Detection, c: Palette): Promise<TargetResult> {
  const details: string[] = [];
  for (const vault of det.where) {
    const dir = join(vault, ".obsidian");
    await b.write(session, join(dir, "snippets", `${OBSIDIAN_SNIPPET}.css`), obsidianCss(c, o.withFonts ? o.fonts : undefined) + "\n");
    const appFile = join(dir, "appearance.json");
    const text = await b.read(appFile);
    let data: Record<string, any> = {};
    try { data = text ? JSON.parse(text) : {}; } catch { details.push(`appearance.json unlesbar, Snippet nur abgelegt: ${appFile}`); continue; }
    const list: string[] = Array.isArray(data.enabledCssSnippets) ? data.enabledCssSnippets : [];
    if (!list.includes(OBSIDIAN_SNIPPET)) { data.enabledCssSnippets = [...list, OBSIDIAN_SNIPPET]; await b.write(session, appFile, JSON.stringify(data, null, 2)); }
    details.push(`Snippet: ${vault}`);
  }
  return res("obsidian", "ok", tr("Snippet in {n} Vault(s) – wirkt sofort, sonst Obsidian neu laden", { n: det.where.length }), details);
}

async function applyFirefox(b: Bridge, session: string, det: Detection, c: Palette): Promise<TargetResult> {
  const details: string[] = [];
  for (const prof of det.where) {
    const css = join(prof, "chrome", "userChrome.css");
    await b.write(session, css, upsertMarked(await b.read(css), CSS_BEGIN, CSS_END, firefoxCss(c)));
    const userJs = join(prof, "user.js");
    const uj = await b.read(userJs);
    if (!uj?.includes("toolkit.legacyUserProfileCustomizations.stylesheets")) await b.write(session, userJs, (uj ? uj.replace(/\s*$/, "\n") : "") + FF_PREF_LINE + "\n");
    details.push(`userChrome.css: ${prof}`);
  }
  return res("firefox", "ok", tr("userChrome in {n} Profil(en) – wirkt nach dem nächsten Firefox-Start", { n: det.where.length }), details);
}

// ── Ablauf ──────────────────────────────────────────────────────────────────

export function res(id: TargetId, status: Status, message: string, details: string[]): TargetResult {
  return { id, label: LABELS[id], status, message, details };
}

export const stamp = () => new Date().toISOString().replace("T", " ").slice(0, 19);

/** Alles anwenden: erkennen → je Ziel anwenden (Fehler eines Ziels stoppen die anderen nicht) → Protokoll. */
export async function applyAll(b: Bridge, opts: ApplyOptions): Promise<{ results: TargetResult[]; session: string; logFile: string }> {
  const o: ApplyOptions = { ...opts, withFonts: opts.withFonts && !!opts.fonts.mono };   // keine Schrift gewählt → Schriften bleiben
  const e = await b.env();
  const dets = await detect(b, e);
  const c = palette(o.settings);
  const session = await b.backupBegin(`${o.name} · ${o.settings.scheme} · ${o.settings.mode}`);
  const warn = await conflicts(b, e);
  const log: string[] = [
    "", `=== ${stamp()} Anwenden „${o.name}“ (${effectiveSource(o.settings)}, ${o.settings.scheme}, ${o.settings.mode}) – Sicherung ${session}`,
    `System: ${e.windowsBuild || e.os} · Programme: ${Object.keys(e.tools).join(", ") || "keine gefunden"}`,
    ...warn.map((w) => `[WARNUNG] ${w}`),
  ];
  const results: TargetResult[] = [];
  for (const d of dets) {
    if (o.only && !o.only.includes(d.id)) continue;
    let r: TargetResult;
    if (!d.found) r = res(d.id, "skipped", d.hint ?? tr("nicht gefunden"), []);
    else {
      try {
        r = d.id === "windows" ? await applyWindows(b, session, o)
          : d.id === "terminal" ? await applyTerminal(b, session, o, d, c)
          : d.id === "vscode" ? await applyVscode(b, session, o, d, e, c)
          : d.id === "ohmyposh" ? await applyOhmyposh(b, session, o, e)
          : d.id === "obsidian" ? await applyObsidian(b, session, o, d, c)
          : d.id === "firefox" ? await applyFirefox(b, session, d, c)
          : await applyKomorebi(b, session, o, d, c);
      } catch (err) {
        r = res(d.id, "error", tr("unerwarteter Fehler: {e}", { e: String(err).replace(/^Error: /, "") }), [String((err as Error)?.stack ?? err)]);
      }
    }
    results.push(r);
    log.push(`[${r.status.toUpperCase().padEnd(7)}] ${r.label}: ${r.message}`, ...r.details.map((x) => `           ${x}`));
  }
  const logFile = await b.log(log).catch(() => e.logFile);
  return { results, session, logFile };
}

/** Diagnose zum Teilen: System, Fundorte, Protokoll – Benutzername durch %USERPROFILE% ersetzt. */
export async function diagnose(b: Bridge): Promise<string> {
  const e = await b.env();
  const dets = await detect(b, e);
  const user = e.home.split("\\").pop() ?? "";
  const redact = (s: string) => (e.home ? s.split(e.home).join("%USERPROFILE%") : s).split(user && user.length > 2 ? user : "\u0000").join("<user>");
  const lines = [
    `Theme Studio – Diagnose ${stamp()}`,
    `System: ${e.windowsBuild || e.os}`,
    `Dokumente: ${e.documents}`,
    `komorebi-Ordner: ${komorebiDir(e)}${e.komorebiConfigHome ? " (KOMOREBI_CONFIG_HOME)" : ""}`,
    "Programme:", ...Object.entries(e.tools).map(([k, v]) => `  ${k.padEnd(14)} ${v}`),
    "Konflikte:", ...((await conflicts(b, e)).map((w) => "  ⚠ " + w)), "",
    "Ziele:", ...dets.map((d) => `  ${d.found ? "✓" : "✗"} ${d.label}${d.where.length ? "\n      " + d.where.join("\n      ") : ""}${!d.found && d.hint ? `\n      → ${d.hint}` : ""}`),
    "", "Protokoll (Ende):", await b.logTail(80),
  ];
  return redact(lines.join("\n"));
}
