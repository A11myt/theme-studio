// Themes per Link teilen: das ganze Theme (Farbe, Variante, Feinjustierung, Überschreibungen, Schrift – ohne Bild)
// steckt kodiert hinter #t= in der Adresse. Die Webseite öffnet es direkt; in der App einfach einfügen (Strg+V).
import type { ThemeSettings } from "./color";
import { parseThemeFile } from "./exporters";
import type { Fonts } from "./fonts";
import { isTauri } from "./platform";

export const WEB_URL = "https://a11myt.github.io/theme-studio/";

const toB64Url = (s: string) => btoa(String.fromCharCode(...new TextEncoder().encode(s))).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
const fromB64Url = (s: string) => new TextDecoder().decode(Uint8Array.from(atob(s.replace(/-/g, "+").replace(/_/g, "/")), (c) => c.charCodeAt(0)));

export function shareLink(name: string, settings: ThemeSettings, fonts: Fonts): string {
  const base = isTauri || typeof location === "undefined" || !location.protocol.startsWith("http")
    ? WEB_URL : location.origin + location.pathname;
  return `${base}#t=${toB64Url(JSON.stringify({ v: 1, name, ...settings, fonts }))}`;
}

/** Theme aus einem Link (oder nur dem #t=…-Teil) – geprüft wie eine Theme-Datei. */
export function readShareLink(text: string): ReturnType<typeof parseThemeFile> | null {
  const m = text.match(/#t=([A-Za-z0-9_-]{10,4000})/);
  if (!m) return null;
  return parseThemeFile(fromB64Url(m[1]));
}
