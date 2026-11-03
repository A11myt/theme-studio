// Übersetzung: der deutsche Text ist der Schlüssel – t("Speichern") → "Save" auf Englisch.
// Fehlt eine Übersetzung, bleibt es Deutsch (der Test test/i18n.test.ts meldet fehlende Einträge).
// Platzhalter: t("„{name}“ gespeichert", { name }) → im Wörterbuch "Saved “{name}”".
import { useSyncExternalStore } from "react";
import { EN } from "./i18n.en";

export type Lang = "de" | "en";
const KEY = "theme-studio-lang";

function detect(): Lang {
  try {
    const saved = localStorage.getItem(KEY);
    if (saved === "de" || saved === "en") return saved;
  } catch { /* kein Speicher */ }
  return typeof navigator !== "undefined" && navigator.language?.toLowerCase().startsWith("de") ? "de" : "en";
}

let lang: Lang = typeof window === "undefined" ? "de" : detect();
const listeners = new Set<() => void>();

export function t(de: string, vars?: Record<string, string | number>): string {
  const s = lang === "en" ? EN[de] ?? de : de;
  return vars ? s.replace(/\{(\w+)\}/g, (_, k: string) => String(vars[k] ?? `{${k}}`)) : s;
}

export const getLang = () => lang;

export function setLang(l: Lang) {
  lang = l;
  try { localStorage.setItem(KEY, l); } catch { /* egal */ }
  document.documentElement.lang = l;
  listeners.forEach((f) => f());
}

/** Komponente neu zeichnen, wenn die Sprache wechselt (in App einmal aufrufen genügt). */
export function useLang(): Lang {
  return useSyncExternalStore((cb) => { listeners.add(cb); return () => listeners.delete(cb); }, () => lang, () => lang);
}
