// Verbindung zu den Windows-Bausteinen in Rust (src-tauri/src/winapply.rs).
// Als Schnittstelle, damit die Tests ein nachgebautes Windows (Dateien, Registry) einsetzen können.
export interface WinEnv {
  os: string;
  home: string;
  appdata: string;
  localappdata: string;
  documents: string;
  komorebiConfigHome: string;
  tools: Record<string, string>;
  logFile: string;
  windowsBuild: string;
  shell?: string;          // Login-Shell ($SHELL), nur Linux/macOS
  zdotdir?: string;
}

export type RegValue = { kind: "Dword"; value: number } | { kind: "Binary"; value: number[] } | { kind: "String"; value: string } | { kind: "Delete" };
export interface RegSet { key: string; name: string; value: RegValue }

export interface Bridge {
  env(): Promise<WinEnv>;
  exists(path: string): Promise<boolean>;
  read(path: string): Promise<string | null>;
  backupBegin(label: string): Promise<string>;
  write(session: string, path: string, text: string, bom?: boolean): Promise<void>;
  regApply(session: string, values: RegSet[]): Promise<void>;
  setWallpaper(path: string): Promise<void>;
  broadcastColors(): Promise<void>;
  runTool(tool: "komorebic" | "oh-my-posh", args: string[]): Promise<{ code: number; output: string }>;
  /** Ausführungsrichtlinie je Shell („Scope=Stufe“-Zeilen), direkt aus Registry/Konfiguration gelesen. */
  psPolicy(): Promise<Partial<Record<"powershell" | "pwsh", string>>>;
  fonts(): Promise<string[]>;
  log(lines: string[]): Promise<string>;
  logTail(maxLines: number): Promise<string>;
  backups(): Promise<{ id: string; label: string; files: number; registry: number }[]>;
  restore(id: string): Promise<string[]>;
  /** Originale (Stand vor dem ersten Theme-Studio-Eingriff), dauerhaft gemerkt. */
  origGet(): Promise<Record<string, unknown>>;
  origSetOnce(key: string, value: unknown): Promise<boolean>;
  regGet(key: string, name: string): Promise<RegValue | null>;
  backupFile(session: string, path: string): Promise<void>;
  remove(session: string, path: string): Promise<boolean>;
  stopProcess(name: "whkd.exe" | "pythonw.exe"): Promise<number>;
  restartExplorer(): Promise<void>;
}

/** Echte Verbindung (Tauri-App). */
export async function tauriBridge(): Promise<Bridge> {
  const { invoke } = await import("@tauri-apps/api/core");
  return {
    env: () => invoke("win_env"),
    exists: (path) => invoke("fs_exists", { path }),
    read: (path) => invoke("fs_read", { path }),
    backupBegin: (label) => invoke("backup_begin", { label }),
    write: (session, path, text, bom = false) => invoke("fs_write", { session, path, text, bom }),
    regApply: (session, values) => invoke("reg_apply", { session, values }),
    setWallpaper: (path) => invoke("set_wallpaper", { path }),
    broadcastColors: () => invoke("broadcast_colors"),
    runTool: (tool, args) => invoke("run_tool", { tool, args }),
    psPolicy: () => invoke("ps_policy"),
    fonts: () => invoke("list_fonts"),
    log: (lines) => invoke("log_append", { lines }),
    logTail: (maxLines) => invoke("log_tail", { maxLines }),
    backups: () => invoke("backup_list"),
    restore: (id) => invoke("backup_restore", { session: id }),
    origGet: () => invoke("orig_get"),
    origSetOnce: (key, value) => invoke("orig_set_once", { key, value }),
    regGet: (key, name) => invoke("reg_get", { key, name }),
    backupFile: (session, path) => invoke("fs_backup", { session, path }),
    remove: (session, path) => invoke("fs_remove", { session, path }),
    stopProcess: (name) => invoke("stop_process", { name }),
    restartExplorer: () => invoke("restart_explorer"),
  };
}

/** Pfade zusammensetzen wie Windows (\) – auch wenn die Tests unter Linux laufen. */
export const join = (...parts: string[]) =>
  parts.filter(Boolean).map((p, i) => (i === 0 ? p.replace(/[\\/]+$/, "") : p.replace(/^[\\/]+|[\\/]+$/g, ""))).join("\\");
