// App-Einstellungen (pro Rechner, im Browser-Speicher der App): Speicherorte und Verhalten beim Speichern.
import { isTauri } from "./platform";

export interface AppSettings {
  wallpaperDir: string;   // wallhaven-Bilder landen hier (auch für wintheme/wallthemes nutzbar)
  exportDir: string;      // „Herunterladen“ schreibt hierhin …
  askOnSave: boolean;     // … oder fragt jedes Mal per Dialog
}

const KEY = "theme-studio-settings";

export async function loadSettings(): Promise<AppSettings> {
  let saved: Partial<AppSettings> = {};
  try {
    saved = JSON.parse(localStorage.getItem(KEY) ?? "{}");
  } catch {
    /* leer */
  }
  let wallpaperDir = "", exportDir = "";
  if (isTauri) {
    const { invoke } = await import("@tauri-apps/api/core");
    [wallpaperDir, exportDir] = await invoke<[string, string]>("default_dirs");
  }
  return { wallpaperDir, exportDir, askOnSave: false, ...saved };
}

export function storeSettings(s: AppSettings) {
  try {
    localStorage.setItem(KEY, JSON.stringify(s));
  } catch {
    /* Speicher gesperrt – Einstellungen gelten dann nur bis zum Schließen */
  }
}

/** Ordner per Dialog wählen (nur App). */
export async function pickFolder(current: string): Promise<string | null> {
  const { open } = await import("@tauri-apps/plugin-dialog");
  const r = await open({ directory: true, defaultPath: current || undefined });
  return typeof r === "string" ? r : null;
}
