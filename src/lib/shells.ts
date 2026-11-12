// Shells erkennen und den Studio-Prompt dort einbinden – Windows (PowerShell 5.1/7, Git Bash) und Linux (bash, zsh, fish).
// Ausgelesen wird, was da ist (Shell installiert? oh-my-zsh, powerlevel10k, oh-my-fish, starship?) – der Nutzer kann
// die Auswahl im Bereich Terminal korrigieren. Der Prompt selbst kommt von oh-my-posh (läuft in jeder Shell),
// bei zsh wahlweise von powerlevel10k.
import type { Bridge, WinEnv } from "./windows/bridge";
import { t as tr } from "./i18n";

export type ShellId = "pwsh" | "powershell" | "bash" | "zsh" | "fish";
export type ZshEngine = "p10k" | "omp";

export interface ShellInfo {
  id: ShellId;
  label: string;
  found: boolean;
  isDefault: boolean;     // Login-Shell ($SHELL)
  rc: string;             // Datei, in die der Block kommt
  notes: string[];        // erkannte Frameworks / Hinweise (übersetzt)
  p10k?: boolean;         // zsh: powerlevel10k vorhanden
  linked?: boolean;       // rc bindet den Studio-Prompt schon selbst ein (z. B. eigene dotfiles)
  blocked?: boolean;      // Ausführungsrichtlinie (Restricted/AllSigned) lädt das Profil nicht → Prompt startet dort nicht
}

export const SHELL_LABELS: Record<ShellId, string> = {
  pwsh: "PowerShell 7", powershell: "Windows PowerShell 5.1", bash: "bash", zsh: "zsh", fish: "fish",
};

export const MARK_BEGIN = "# >>> theme-studio (wird beim Anwenden ersetzt)";
export const MARK_END = "# <<< theme-studio";

const win = (e: WinEnv) => e.os === "windows";
const sep = (e: WinEnv) => (win(e) ? "\\" : "/");
const j = (e: WinEnv, ...p: string[]) => p.filter(Boolean).join(sep(e)).replace(/[\\/]+/g, sep(e));

/** Ort der Prompt-Dateien (oh-my-posh-Theme, p10k-Ergänzung). */
export const promptDir = (e: WinEnv) => j(e, e.home, ".config", "theme-studio");

export function rcFile(e: WinEnv, id: ShellId): string {
  switch (id) {
    case "powershell": return j(e, e.documents, "WindowsPowerShell", "Microsoft.PowerShell_profile.ps1");
    case "pwsh": return j(e, e.documents, "PowerShell", "Microsoft.PowerShell_profile.ps1");
    case "bash": return j(e, e.home, ".bashrc");
    case "zsh": return j(e, e.zdotdir || e.home, ".zshrc");
    case "fish": return j(e, e.home, ".config", "fish", "conf.d", "theme-studio.fish");   // eigene Datei – fish lädt conf.d von selbst
  }
}

// ── PowerShell-Ausführungsrichtlinie ────────────────────────────────────────
// „Restricted“ (Standard bei Windows PowerShell 5.1) oder „AllSigned“ → das Profil wird nicht geladen, der Prompt startet nicht.
const SCOPES = ["MachinePolicy", "UserPolicy", "Process", "CurrentUser", "LocalMachine"];

/** Ausgabe von Get-ExecutionPolicy -List → wirksame Richtlinie; managed = per Gruppenrichtlinie (Firma/Admin) vorgegeben. */
export function effectivePolicy(output: string, fallback: string): { policy: string; scope: string; managed: boolean } | null {
  const m = new Map(output.split(/\r?\n/).map((l) => l.trim().split("=")).filter((x) => x.length === 2 && SCOPES.includes(x[0])) as [string, string][]);
  if (!m.size) return null;                                   // nicht lesbar → nichts behaupten
  const scope = SCOPES.find((sc) => m.get(sc) && m.get(sc) !== "Undefined");
  return scope ? { policy: m.get(scope)!, scope, managed: scope.endsWith("Policy") } : { policy: fallback, scope: "Standard", managed: false };
}

const POLICY_FALLBACK: Partial<Record<ShellId, string>> = { powershell: "Restricted", pwsh: "RemoteSigned" };

/** Blockiert die Ausführungsrichtlinie das Profil dieser PowerShell? (Restricted/AllSigned) */
function policyBlocks(id: ShellId, lists: Partial<Record<"powershell" | "pwsh", string>>): boolean {
  if (id !== "powershell" && id !== "pwsh") return false;
  const raw = lists[id];
  const p = raw ? effectivePolicy(raw, POLICY_FALLBACK[id]!) : null;
  return !!p && ["Restricted", "AllSigned"].includes(p.policy);
}

/** Was ist installiert, was läuft schon im Prompt? Liest nur. */
export async function detectShells(b: Bridge, e: WinEnv): Promise<ShellInfo[]> {
  const ids: ShellId[] = win(e) ? ["pwsh", "powershell", "bash"] : ["zsh", "bash", "fish"];
  const login = (e.shell ?? "").split("/").pop() ?? "";
  const policy = win(e) ? await b.psPolicy().catch(() => ({} as Partial<Record<"powershell" | "pwsh", string>>)) : {};
  const out: ShellInfo[] = [];
  for (const id of ids) {
    const rc = rcFile(e, id);
    const text = (await b.read(rc).catch(() => null)) ?? "";
    const found = id === "powershell" ? win(e)
      : id === "pwsh" ? !!e.tools.pwsh
      : id === "bash" ? (win(e) ? !!e.tools["git-bash"] : !!e.tools.bash)
      : !!e.tools[id];
    const notes: string[] = [];
    const own = text.replace(new RegExp(`${esc(MARK_BEGIN)}[\\s\\S]*?${esc(MARK_END)}`), "");   // ohne unseren Block
    if (/starship init/.test(own)) notes.push(tr("starship ist eingebunden – der Studio-Prompt steht danach und gewinnt"));
    if (/oh-my-posh init/.test(own)) notes.push(tr("eigenes oh-my-posh init gefunden – der Studio-Prompt steht danach und gewinnt"));
    let p10k: boolean | undefined;
    if (id === "zsh") {
      if (/oh-my-zsh\.sh/.test(own) || (await b.exists(j(e, e.home, ".oh-my-zsh")))) notes.push(tr("oh-my-zsh: bleibt, nur das Theme wird vom Studio-Prompt überdeckt"));
      p10k = /powerlevel10k|\.p10k\.zsh/.test(own) || (await b.exists(j(e, e.home, ".p10k.zsh")));
      if (p10k) notes.push(tr("powerlevel10k gefunden"));
    }
    if (id === "bash" && (/oh-my-bash/.test(own) || (await b.exists(j(e, e.home, ".oh-my-bash"))))) notes.push(tr("oh-my-bash: bleibt, nur das Theme wird überdeckt"));
    if (id === "fish") {
      if (await b.exists(j(e, e.home, ".local", "share", "omf"))) notes.push(tr("oh-my-fish: bleibt, der Studio-Prompt ersetzt nur fish_prompt"));
      if (await b.exists(j(e, e.home, ".config", "fish", "functions", "_tide_item_pwd.fish"))) notes.push(tr("tide gefunden – der Studio-Prompt ersetzt ihn"));
    }
    if (id === "bash" && win(e) && found) notes.push(tr("Git Bash"));
    const linked = id === "zsh" && /theme-studio\/p10k\.zsh/.test(own);
    if (linked) notes.push(tr("lädt die Studio-Ergänzung schon selbst (eigene dotfiles) – wird nicht verändert"));
    const blocked = found && policyBlocks(id, policy);
    if (blocked) notes.push(tr("Ausführungsrichtlinie blockiert das Profil – der Prompt startet hier nicht (übersprungen)"));
    out.push({ id, label: SHELL_LABELS[id], found, isDefault: !!login && login === id, rc, notes, p10k, linked, blocked });
  }
  return out;
}

const esc = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

/** Einbinde-Zeilen je Shell (ohne Marker). config = Pfad zum oh-my-posh-Theme. */
export function initLines(id: ShellId, engine: ZshEngine, config: string, p10kFile: string): string[] {
  const q = (s: string) => s.replace(/'/g, "''");
  switch (id) {
    case "powershell":
    case "pwsh":
      return ["if (Get-Command oh-my-posh -ErrorAction SilentlyContinue) {",
        `  oh-my-posh init $(if ($PSVersionTable.PSVersion.Major -ge 6) { 'pwsh' } else { 'powershell' }) --config '${q(config)}' | Invoke-Expression`,
        "}"];
    case "bash":
      return [`if command -v oh-my-posh >/dev/null 2>&1; then eval "$(oh-my-posh init bash --config '${config}')"; fi`];
    case "zsh":
      return engine === "p10k"
        ? [`[[ -r '${p10kFile}' ]] && source '${p10kFile}'   # nach ~/.p10k.zsh – überschreibt nur Stil und Farben`]
        : [`if (( $+commands[oh-my-posh] )); then eval "$(oh-my-posh init zsh --config '${config}')"; fi`];
    case "fish":
      return [`if type -q oh-my-posh; oh-my-posh init fish --config '${config}' | source; end`];
  }
}

/** Block in eine rc-Datei setzen (am Ende, damit er gegen frühere Prompts gewinnt) oder entfernen (lines = null). */
export function upsertShellBlock(text: string | null, lines: string[] | null, crlf: boolean): string {
  const nl = crlf ? "\r\n" : "\n";
  const re = new RegExp(`\\r?\\n?${esc(MARK_BEGIN)}[\\s\\S]*?${esc(MARK_END)}\\r?\\n?`);
  let t = (text ?? "").replace(re, nl).replace(/(\r?\n)+$/, "");
  if (lines) t = (t ? t + nl + nl : "") + [MARK_BEGIN, ...lines, MARK_END].join(nl);
  return t ? t + nl : "";
}

/** Ausgewählte Shells: gespeicherte Wahl – sonst Vorschlag: Windows = beide PowerShells (Git Bash nur auf Wunsch),
 *  Linux = nur die Login-Shell (fremde rc-Dateien nicht ungefragt anfassen). */
export function chosenShells(all: ShellInfo[], saved?: ShellId[]): ShellInfo[] {
  if (saved) return all.filter((s) => s.found && saved.includes(s.id));
  const found = all.filter((s) => s.found && !s.blocked);   // blockierte (z. B. PS 5.1 mit Restricted) nicht vorschlagen
  if (found.some((s) => s.id === "powershell")) return found.filter((s) => s.id !== "bash");
  const login = found.filter((s) => s.isDefault);
  return login.length ? login : found.slice(0, 1);
}

/** Die Studio-Einbindung in alle gewählten Shells schreiben. Gibt Protokollzeilen zurück. */
export async function writeShells(b: Bridge, session: string, shells: ShellInfo[], o: {
  enabled: boolean; engine: ZshEngine; config: string; p10kFile: string;
}): Promise<{ done: string[]; details: string[] }> {
  const done: string[] = [], details: string[] = [];
  for (const sh of shells) {
    // zsh mit p10k, die den Studio-Prompt schon selbst lädt (eigene dotfiles): nichts anfassen
    if (sh.id === "zsh" && o.engine === "p10k" && sh.linked) { details.push(`${sh.label}: ${sh.rc} lädt den Studio-Prompt schon selbst – unverändert`); done.push(sh.label); continue; }
    const ps = sh.id === "powershell" || sh.id === "pwsh";
    const text = await b.read(sh.rc);
    const lines = o.enabled ? initLines(sh.id, o.engine, o.config, o.p10kFile) : null;
    if (!lines && text === null) continue;                                   // aus + nie gesetzt → nichts tun
    const out = sh.id === "fish" ? (lines ? [MARK_BEGIN, ...lines, MARK_END, ""].join("\n") : "# theme-studio: Prompt ausgeschaltet\n")
      : upsertShellBlock(text, lines, ps);
    if (out === (text ?? "")) { details.push(`${sh.label}: unverändert (${sh.rc})`); done.push(sh.label); continue; }
    await b.write(session, sh.rc, out, ps);
    details.push(`${sh.label}: ${lines ? (text === null ? "angelegt" : "eingebunden") : "Studio-Prompt entfernt"} – ${sh.rc}`);
    done.push(sh.label);
  }
  return { done, details };
}
