// Prompt-Assistent (wie `p10k configure`): Optionen → Vorschau, powerlevel10k-Ergänzung (Linux) und
// oh-my-posh-Vorlage (Windows/wintheme). Farben laufen über Rollen:
// - p10k: Terminalfarben-Nummern (deine Alacritty-Vorlage: 4/2 = primary, 6 = secondary, 5 = tertiary,
//   1 = error, 3 = inverse_primary, 8 = grau) → folgt jedem matugen-Wechsel automatisch
// - oh-my-posh: {{colors.<rolle>.default.hex}} → wintheme färbt bei jedem Wallpaper-Wechsel neu ein
import type { Palette } from "./color";
import type { ShellId, ZshEngine } from "./shells";

export type PromptStyle = "lean" | "classic" | "rainbow" | "pure";
export type Separator = "angled" | "round" | "slanted" | "flat";
export type RightItem = "status" | "exec" | "jobs" | "python" | "node" | "time";
export type TimeFormat = "24s" | "24" | "12";

export interface PromptOptions {
  enabled: boolean;         // Schalter: eigenen Prompt verwenden (sonst bleibt dein bisheriger)
  style: PromptStyle;
  lines: 1 | 2;
  frame: boolean;           // ╭─ / ╰─ bei zwei Zeilen
  separator: Separator;     // nur classic/rainbow
  icons: boolean;
  right: RightItem[];
  time: TimeFormat;
  char: string;             // Prompt-Zeichen
  transient: boolean;       // ältere Prompts zu einem schlichten ❯ zusammenfalten
  shells?: ShellId[];       // wohin einbinden (fehlt = alle gefundenen)
  zshEngine?: ZshEngine;    // zsh: powerlevel10k-Ergänzung oder oh-my-posh (fehlt = p10k, wenn vorhanden)
}

// entspricht deinem jetzigen .p10k.zsh (lean, 2 Zeilen, Rahmen, wenige Symbole, Transient)
export const DEFAULT_PROMPT: PromptOptions = {
  enabled: false, style: "lean", lines: 2, frame: true, separator: "angled", icons: false,
  right: ["status", "exec", "time"], time: "24s", char: "❯", transient: true,
};

export const RIGHT_LABELS: Record<RightItem, string> = {
  status: "Fehlercode", exec: "Dauer (ab 3 s)", jobs: "Hintergrund-Jobs", python: "Python-venv", node: "Node-Version", time: "Uhrzeit",
};
export const CHARS = ["❯", "→", "λ", "$", "➜"];

// Powerline-Glyphen (Nerd Font, privater Bereich – als Escape, damit sie beim Schreiben nicht verloren gehen)
export const SEP: Record<Separator, { l: string; r: string; ls: string; rs: string }> = {
  angled: { l: "", r: "", ls: "", rs: "" },
  round: { l: "", r: "", ls: "", rs: "" },
  slanted: { l: "", r: "", ls: "", rs: "" },
  flat: { l: "", r: "", ls: "|", rs: "|" },
};
export const ICON = { dir: "", branch: "", time: "", python: "", node: "", exec: "", jobs: "" };

const TIME_FMT: Record<TimeFormat, { p10k: string; omp: string; demo: string }> = {
  "24s": { p10k: "%D{%H:%M:%S}", omp: "15:04:05", demo: "10:24:37" },
  "24": { p10k: "%D{%H:%M}", omp: "15:04", demo: "10:24" },
  "12": { p10k: "%D{%I:%M %p}", omp: "03:04 PM", demo: "10:24 AM" },
};

// ── Rollen je Element (für Vorschau + oh-my-posh) und ihre Terminalfarbe (für p10k) ──
type Role = keyof Palette;
const ANSI: Partial<Record<Role, number>> = {
  primary: 4, secondary: 6, tertiary: 5, error: 1, inverse_primary: 3, outline: 8, outline_variant: 8,
};
const ROLE = {
  dir: "primary", vcs: "secondary", vcsDirty: "tertiary", status: "error", exec: "outline", time: "outline",
  jobs: "secondary", python: "secondary", node: "tertiary", frame: "outline_variant", ok: "primary", err: "error",
} as const satisfies Record<string, Role>;
// Hintergründe im Stil „rainbow“
const RAINBOW = { dir: "primary", vcs: "secondary", right: "surface_container_highest" } as const satisfies Record<string, Role>;

// ── Vorschau: Teile einer Prompt-Zeile (Text + Farbe + Hintergrund) ──
export interface Piece { text: string; fg?: string; bg?: string; bold?: boolean }
export interface PreviewLines { left: Piece[][]; right: Piece[]; transient: Piece[] }

/** Prompt in Farben der Palette – `failed` zeigt den Zustand nach einem Fehler. */
export function previewPrompt(o: PromptOptions, c: Palette, failed = false): PreviewLines {
  const col = (r: Role) => c[r];
  const ic = (i: string) => (o.icons ? `${i} ` : "");
  const lean = o.style === "lean" || o.style === "pure";
  const sep = SEP[o.separator];
  const seg = (text: string, fg: Role, bgRole?: Role): Piece[] => {
    if (lean || !bgRole) return [{ text, fg: col(fg) }];
    return [{ text: ` ${text} `, fg: o.style === "rainbow" ? c.surface : col(fg), bg: col(bgRole) }];
  };
  const bgDir: Role | undefined = o.style === "rainbow" ? RAINBOW.dir : o.style === "classic" ? "surface_container_highest" : undefined;
  const bgVcs: Role | undefined = o.style === "rainbow" ? RAINBOW.vcs : o.style === "classic" ? "surface_container_highest" : undefined;

  // links: Ordner + git
  const dir = seg(`${ic(ICON.dir)}~/dotfiles`, ROLE.dir, bgDir);
  const vcs = seg(`${ic(ICON.branch)}main !2`, ROLE.vcsDirty, bgVcs);
  let first: Piece[];
  if (lean) first = [...dir, { text: " " }, ...vcs];
  else {
    const bridge: Piece = o.style === "rainbow"
      ? { text: sep.l || " ", fg: col(bgDir!), bg: col(bgVcs!) }
      : { text: ` ${sep.ls} `.replace("  ", " "), fg: c.outline, bg: col(bgDir!) };
    first = [...dir, bridge, ...vcs, { text: sep.l || " ", fg: col(bgVcs!) }];
  }
  const charP: Piece = { text: `${o.char} `, fg: failed ? col(ROLE.err) : col(ROLE.ok), bold: true };
  const frameTop: Piece[] = o.lines === 2 && o.frame ? [{ text: "╭─ ", fg: col(ROLE.frame) }] : [];
  const frameBot: Piece[] = o.lines === 2 && o.frame ? [{ text: "╰─", fg: col(ROLE.frame) }] : [];

  // rechts
  const right: Piece[] = [];
  for (const it of o.right) {
    if (it === "status" && !failed) continue;
    const text = {
      status: "✘ 1", exec: `${ic(ICON.exec)}4s`, jobs: `${ic(ICON.jobs)}1`, python: `${ic(ICON.python)}venv`,
      node: `${ic(ICON.node)}v24.2`, time: `${ic(ICON.time)}${TIME_FMT[o.time].demo}`,
    }[it];
    const fg = { status: ROLE.status, exec: ROLE.exec, jobs: ROLE.jobs, python: ROLE.python, node: ROLE.node, time: ROLE.time }[it];
    if (lean) right.push({ text: `${text} `, fg: col(fg) });
    else right.push({ text: ` ${text} `, fg: o.style === "rainbow" ? c.on_surface : col(fg), bg: c.surface_container_highest });
  }

  const left = o.lines === 2
    ? [[...frameTop, ...first], [...frameBot, ...charP.text ? [charP] : []]]
    : [[...first, { text: " " }, charP]];
  return { left, right, transient: [{ ...charP }] };
}

// ── powerlevel10k: Ergänzung, die nach ~/.p10k.zsh geladen wird ──
const z = (s: string) => "$'" + [...s].map((ch) => {
  const cp = ch.codePointAt(0)!;
  return cp > 0x7e ? (cp > 0xffff ? `\\U${cp.toString(16).padStart(8, "0")}` : `\\u${cp.toString(16).padStart(4, "0")}`)
    : ch === "'" || ch === "\\" ? `\\${ch}` : ch;
}).join("") + "'";
const a = (r: Role) => ANSI[r] ?? 7;

export function p10kOverlay(o: PromptOptions): string {
  const L: string[] = [];
  const set = (k: string, v: string | number) => L.push(`  typeset -g POWERLEVEL9K_${k}=${v}`);
  const left = ["dir", "vcs", ...(o.lines === 2 ? ["newline"] : []), "prompt_char"];
  const rightMap: Record<RightItem, string> = { status: "status", exec: "command_execution_time", jobs: "background_jobs", python: "virtualenv", node: "node_version", time: "time" };
  L.push(`  typeset -g POWERLEVEL9K_LEFT_PROMPT_ELEMENTS=(${left.join(" ")})`);
  L.push(`  typeset -g POWERLEVEL9K_RIGHT_PROMPT_ELEMENTS=(${o.right.map((r) => rightMap[r]).join(" ")}${o.lines === 2 ? " newline" : ""})`);
  // Rahmen
  set("MULTILINE_FIRST_PROMPT_PREFIX", o.lines === 2 && o.frame ? z(`%${a(ROLE.frame)}F╭─`) : "''");
  set("MULTILINE_LAST_PROMPT_PREFIX", o.lines === 2 && o.frame ? z(`%${a(ROLE.frame)}F╰─`) : "''");
  set("MULTILINE_NEWLINE_PROMPT_PREFIX", o.lines === 2 && o.frame ? z(`%${a(ROLE.frame)}F├─`) : "''");
  // Stil
  const lean = o.style === "lean" || o.style === "pure";
  const s = SEP[o.separator];
  if (lean) {
    set("BACKGROUND", "''");
    for (const k of ["LEFT_SEGMENT_SEPARATOR", "RIGHT_SEGMENT_SEPARATOR", "LEFT_PROMPT_LAST_SEGMENT_END_SYMBOL",
      "RIGHT_PROMPT_FIRST_SEGMENT_START_SYMBOL", "LEFT_PROMPT_FIRST_SEGMENT_START_SYMBOL", "RIGHT_PROMPT_LAST_SEGMENT_END_SYMBOL"]) set(k, "''");
    set("LEFT_SUBSEGMENT_SEPARATOR", "' '");
    set("RIGHT_SUBSEGMENT_SEPARATOR", "' '");
  } else {
    set("BACKGROUND", 0);
    set("LEFT_SEGMENT_SEPARATOR", z(s.l));
    set("RIGHT_SEGMENT_SEPARATOR", z(s.r));
    set("LEFT_SUBSEGMENT_SEPARATOR", z(s.ls));
    set("RIGHT_SUBSEGMENT_SEPARATOR", z(s.rs));
    set("LEFT_PROMPT_LAST_SEGMENT_END_SYMBOL", z(s.l));
    set("RIGHT_PROMPT_FIRST_SEGMENT_START_SYMBOL", z(s.r));
    set("LEFT_PROMPT_FIRST_SEGMENT_START_SYMBOL", "''");
    set("RIGHT_PROMPT_LAST_SEGMENT_END_SYMBOL", "''");
    // Prompt-Zeichen ohne Hintergrund
    set("PROMPT_CHAR_BACKGROUND", "''");
    set("PROMPT_CHAR_LEFT_PROMPT_LAST_SEGMENT_END_SYMBOL", "''");
    set("PROMPT_CHAR_LEFT_PROMPT_FIRST_SEGMENT_START_SYMBOL", "''");
    set("PROMPT_CHAR_LEFT_LEFT_WHITESPACE", "''");
  }
  const rainbow = o.style === "rainbow";
  // Farben (Terminalfarben → folgen matugen)
  set("DIR_FOREGROUND", rainbow ? 0 : a(ROLE.dir));
  set("DIR_ANCHOR_FOREGROUND", rainbow ? 0 : a(ROLE.dir));
  set("DIR_SHORTENED_FOREGROUND", rainbow ? 0 : 8);
  if (rainbow) set("DIR_BACKGROUND", a(RAINBOW.dir));
  for (const st of ["CLEAN", "MODIFIED", "UNTRACKED"]) {
    set(`VCS_${st}_FOREGROUND`, rainbow ? 0 : st === "CLEAN" ? a(ROLE.vcs) : a(ROLE.vcsDirty));
    if (rainbow) set(`VCS_${st}_BACKGROUND`, st === "CLEAN" ? a(RAINBOW.vcs) : a("tertiary"));
  }
  set("STATUS_ERROR_FOREGROUND", a(ROLE.status));
  set("COMMAND_EXECUTION_TIME_FOREGROUND", a(ROLE.exec));
  set("TIME_FOREGROUND", a(ROLE.time));
  set("TIME_FORMAT", `'${TIME_FMT[o.time].p10k}'`);
  set("VIRTUALENV_FOREGROUND", a(ROLE.python));
  set("NODE_VERSION_FOREGROUND", a(ROLE.node));
  set("BACKGROUND_JOBS_FOREGROUND", a(ROLE.jobs));
  set("PROMPT_CHAR_OK_{VIINS,VICMD,VIVIS,VIOWR}_FOREGROUND", a(ROLE.ok));
  set("PROMPT_CHAR_ERROR_{VIINS,VICMD,VIVIS,VIOWR}_FOREGROUND", a(ROLE.err));
  set("PROMPT_CHAR_{OK,ERROR}_VIINS_CONTENT_EXPANSION", z(o.char));
  // Symbole
  set("VISUAL_IDENTIFIER_EXPANSION", o.icons ? "'${P9K_VISUAL_IDENTIFIER}'" : "''");
  set("VCS_BRANCH_ICON", o.icons ? z(`${ICON.branch} `) : "''");
  set("TRANSIENT_PROMPT", o.transient ? "always" : "off");
  return `# Theme Studio – Prompt-Ergänzung zu ~/.p10k.zsh (erzeugt, wird beim Anwenden ersetzt).
# Farben sind Terminalfarben-Nummern → folgen automatisch matugen/wallthemes.
# Stil: ${o.style}, ${o.lines} Zeile(n), Trenner ${o.separator}, Symbole ${o.icons ? "an" : "aus"}
() {
  emulate -L zsh -o extended_glob
${L.join("\n")}
}
(( ! $+functions[p10k] )) || p10k reload
`;
}

// ── oh-my-posh: Vorlage mit Farb-Platzhaltern (wintheme füllt sie bei jedem Einfärben) ──
const C = (r: Role) => `{{colors.${r}.default.hex}}`;

export function ompTemplate(o: PromptOptions): string {
  const ic = (i: string) => (o.icons ? `${i} ` : "");
  const lean = o.style === "lean" || o.style === "pure";
  const s = SEP[o.separator];
  const pl = (fg: Role, bg: Role) => lean
    ? { style: "plain", foreground: C(fg) }
    : { style: "powerline", powerline_symbol: s.l || "", foreground: o.style === "rainbow" ? C("surface") : C(fg), background: C(bg) };
  const bgDir: Role = o.style === "rainbow" ? RAINBOW.dir : "surface_container_highest";
  const bgVcs: Role = o.style === "rainbow" ? RAINBOW.vcs : "surface_container_highest";
  const pad = lean ? "" : " ";
  const leftSegs = [
    ...(o.lines === 2 && o.frame ? [{ type: "text", style: "plain", foreground: C(ROLE.frame), template: "╭─ " }] : []),
    { type: "path", ...pl(ROLE.dir, bgDir), template: `${pad}${ic(ICON.dir)}{{ .Path }}${pad}`,
      properties: { style: "unique", max_depth: 4, folder_separator_icon: "/", home_icon: "~" } },
    { type: "git", ...pl(ROLE.vcs, bgVcs),
      ...(lean ? { foreground_templates: [`{{ if or (.Working.Changed) (.Staging.Changed) }}${C(ROLE.vcsDirty)}{{ end }}`] } : {}),
      template: `${pad || " "}${ic(ICON.branch)}{{ .HEAD }}{{ if .Working.Changed }} !{{ .Working.Modified }}{{ end }}{{ if gt .Working.Untracked 0 }} ?{{ .Working.Untracked }}{{ end }}${pad}`,
      properties: { fetch_status: true } },
  ];
  const char = {
    type: "status", style: "plain", foreground: C(ROLE.ok),
    foreground_templates: [`{{ if gt .Code 0 }}${C(ROLE.err)}{{ end }}`],
    template: `${o.char}`, properties: { always_enabled: true },
  };
  const rightSegs = o.right.map((it) => {
    const base = lean ? { style: "plain" } : { style: "diamond", leading_diamond: s.r, background: C("surface_container_highest") };
    const fgRole = { status: ROLE.status, exec: ROLE.exec, jobs: ROLE.jobs, python: ROLE.python, node: ROLE.node, time: ROLE.time }[it];
    const seg = {
      status: { type: "status", template: "{{ if gt .Code 0 }}✘ {{ .Code }} {{ end }}" },
      exec: { type: "executiontime", template: `${ic(ICON.exec)}{{ .FormattedMs }} `, properties: { threshold: 3000, style: "austin" } },
      jobs: { type: "text", template: "" },
      python: { type: "python", template: `${ic(ICON.python)}{{ if .Venv }}{{ .Venv }}{{ end }} ` },
      node: { type: "node", template: `${ic(ICON.node)}{{ .Full }} ` },
      time: { type: "time", template: `${ic(ICON.time)}{{ .CurrentDate | date "${TIME_FMT[o.time].omp}" }} ` },
    }[it];
    return { ...base, foreground: C(fgRole), ...seg };
  }).filter((x) => x.template !== "");
  const blocks: unknown[] = [];
  if (o.lines === 2) {
    blocks.push({ type: "prompt", alignment: "left", segments: leftSegs });
    if (rightSegs.length) blocks.push({ type: "prompt", alignment: "right", segments: rightSegs });
    blocks.push({ type: "prompt", alignment: "left", newline: true, segments: [
      ...(o.frame ? [{ type: "text", style: "plain", foreground: C(ROLE.frame), template: "╰─" }] : []), char] });
  } else {
    blocks.push({ type: "prompt", alignment: "left", segments: [...leftSegs, { ...char, template: ` ${o.char}` }] });
    if (rightSegs.length) blocks.push({ type: "rprompt", segments: rightSegs });
  }
  const theme = {
    $schema: "https://raw.githubusercontent.com/JanDeDobbeleer/oh-my-posh/main/themes/schema.json",
    version: 3, final_space: true, console_title_template: "{{ .Folder }}", blocks,
    ...(o.transient ? { transient_prompt: { foreground: C(ROLE.ok), foreground_templates: [`{{ if gt .Code 0 }}${C(ROLE.err)}{{ end }}`], template: `${o.char} ` } } : {}),
  };
  return JSON.stringify(theme, null, 2) + "\n";
}
