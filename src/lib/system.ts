// Zielsystem fürs Anwenden: Windows (direkt aus der App) oder Linux (wallthemes/fontgen).
// „auto“ = das System, auf dem die App läuft. Gemerkt im Browser-Speicher der App; fehlt der Eintrag, ist es der erste Start.
import { isTauri } from "./platform";

export type System = "windows" | "linux";
export type SystemChoice = "auto" | System;
export interface Detected { system: System; name: string }

const KEY = "theme-studio-system";

export function loadSystemChoice(): SystemChoice | null {
  try {
    const v = localStorage.getItem(KEY);
    return v === "auto" || v === "windows" || v === "linux" ? v : null;
  } catch {
    return "auto";            // Speicher gesperrt → nicht bei jedem Start fragen
  }
}

export function storeSystemChoice(c: SystemChoice) {
  try { localStorage.setItem(KEY, c); } catch { /* gilt dann nur bis zum Schließen */ }
}

const fromAgent = (ua: string): System => (/windows/i.test(ua) ? "windows" : "linux");

/** Erkennen: in der App fragt Rust das Betriebssystem (inkl. Name/Version), im Browser der User-Agent. */
export async function detectSystem(): Promise<Detected> {
  const ua = typeof navigator !== "undefined" ? navigator.userAgent : "";
  if (isTauri) {
    try {
      const { invoke } = await import("@tauri-apps/api/core");
      const [os, name] = await invoke<[string, string]>("host_system");
      const system: System = os === "windows" ? "windows" : "linux";
      return { system, name: name || (system === "windows" ? "Windows" : "Linux") };
    } catch { /* fällt auf den User-Agent zurück */ }
  }
  const system = fromAgent(ua);
  return { system, name: system === "windows" ? "Windows" : "Linux" };
}

export const resolveSystem = (choice: SystemChoice | null, detected: System): System =>
  !choice || choice === "auto" ? detected : choice;
