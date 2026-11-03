// Browser oder Tauri-App? In der App laufen Netz, Speichern und Zwischenablage über Tauri-Plugins.
export const isTauri = typeof window !== "undefined" && "__TAURI_INTERNALS__" in window;

/** wallhaven geht in der App und lokal (pnpm dev/preview leiten weiter) – nicht auf der Webseite (CORS). */
export const hasWallhaven = isTauri || ["localhost", "127.0.0.1"].includes(location.hostname);

/** fetch: in der App direkt (keine CORS-Grenze), im Browser über die Weiterleitung des Entwicklungsservers. */
export async function netFetch(url: string): Promise<Response> {
  if (isTauri) {
    const { fetch } = await import("@tauri-apps/plugin-http");
    return fetch(url);
  }
  const u = new URL(url);
  const local = u.hostname === "wallhaven.cc"
    ? `/wallhaven/api${u.pathname.replace(/^\/api\/v1/, "")}${u.search}`
    : u.hostname === "w.wallhaven.cc" ? `/wallhaven${u.pathname}` : url;
  return fetch(local);
}

/** Textdatei speichern. App: in den Export-Ordner (oder per Dialog), Browser: Download.
 *  → gespeicherter Pfad bzw. Dateiname, null = abgebrochen */
export async function saveText(filename: string, text: string, opts: { dir?: string; ask?: boolean } = {}): Promise<string | null> {
  if (isTauri) {
    const { invoke } = await import("@tauri-apps/api/core");
    if (opts.dir && !opts.ask) return invoke<string>("save_text", { dir: opts.dir, name: filename, text });
    const { save } = await import("@tauri-apps/plugin-dialog");
    const path = await save({ defaultPath: opts.dir ? `${opts.dir}/${filename}` : filename });
    return path ? invoke<string>("save_text", { path, text }) : null;
  }
  const a = document.createElement("a");
  a.href = URL.createObjectURL(new Blob([text], { type: "text/plain;charset=utf-8" }));
  a.download = filename;
  a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 1000);
  return filename;
}

/** Binärdatei speichern (VS-Code-Erweiterung) – wie saveText. */
export async function saveBytes(filename: string, bytes: Uint8Array, opts: { dir?: string; ask?: boolean } = {}): Promise<string | null> {
  if (isTauri) {
    const { invoke } = await import("@tauri-apps/api/core");
    const data = Array.from(bytes);
    if (opts.dir && !opts.ask) return invoke<string>("save_bytes", { dir: opts.dir, name: filename, bytes: data });
    const { save } = await import("@tauri-apps/plugin-dialog");
    const path = await save({ defaultPath: opts.dir ? `${opts.dir}/${filename}` : filename });
    return path ? invoke<string>("save_bytes", { path, bytes: data }) : null;
  }
  const a = document.createElement("a");
  a.href = URL.createObjectURL(new Blob([bytes as BlobPart], { type: "application/octet-stream" }));
  a.download = filename;
  a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 1000);
  return filename;
}

export async function copyText(text: string): Promise<void> {
  if (isTauri) {
    const { writeText } = await import("@tauri-apps/plugin-clipboard-manager");
    return writeText(text);
  }
  return navigator.clipboard.writeText(text);
}

/** Installierte Schriften: App → System (fc-list / Windows), Browser → nur Chromium (queryLocalFonts). */
export async function systemFonts(): Promise<string[]> {
  try {
    if (isTauri) {
      const { invoke } = await import("@tauri-apps/api/core");
      return await invoke<string[]>("list_fonts");
    }
    const q = (window as unknown as { queryLocalFonts?: () => Promise<{ family: string }[]> }).queryLocalFonts;
    if (q) return [...new Set((await q()).map((f) => f.family))].sort((a, b) => a.localeCompare(b));
  } catch {
    /* keine Liste – freie Eingabe bleibt */
  }
  return [];
}

export interface NerdFont { name: string; size: number; url: string; version: string }

/** Nerd Fonts des neuesten Releases (nur App). */
export async function nerdFonts(): Promise<NerdFont[]> {
  const { invoke } = await import("@tauri-apps/api/core");
  return invoke<NerdFont[]>("nerd_fonts_list");
}

/** Eine Nerd Font für den Benutzer installieren (nur App) → Anzahl Dateien. */
export async function installNerdFont(f: NerdFont): Promise<{ files: number; dir: string }> {
  const { invoke } = await import("@tauri-apps/api/core");
  return invoke("nerd_font_install", { name: f.name, url: f.url });
}

/** Fehlertext – Tauri liefert Fehler als String, der Browser als Error. */
export const errText = (e: unknown) => (e instanceof Error ? e.message : String(e));

export interface ApplyRequest {
  image?: string;
  source: string;
  scheme: string;
  mode: string;
  contrast: number;
  overrides: Record<string, string>;
  fonts?: { ui: string; mono: string; accent: string; uiSize: number; monoSize: number };
  fontProfile?: string;
}

/** Theme auf diesem Rechner anwenden (nur App) → Protokoll der aufgerufenen Programme. */
export async function applyTheme(req: ApplyRequest): Promise<string> {
  const { invoke } = await import("@tauri-apps/api/core");
  return invoke<string>("apply_theme", { req });
}

/** Bild als Datei in den Wallpaper-Ordner legen (für wallthemes/wintheme) → Pfad. */
export async function imageToDisk(blob: Blob, name: string, dir: string): Promise<string> {
  const safe = name.replace(/[^\p{L}\p{N}\-_. ()]/gu, "-").replace(/^\.+/, "") || "bild.jpg";
  return (await saveBytes(safe, new Uint8Array(await blob.arrayBuffer()), { dir }))!;
}

/** Automatische Updates (Windows-Installer bzw. AppImage): neue Version auf GitHub? */
// Windows-Installer aktualisiert sich selbst; unter Linux baust du lokal (bzw. AppImage manuell)
export const canUpdate = isTauri && navigator.userAgent.includes("Windows");

export async function checkUpdate(): Promise<{ version: string; notes?: string; install: (progress: (p: number) => void) => Promise<void> } | null> {
  const { check } = await import("@tauri-apps/plugin-updater");
  const u = await check();
  if (!u) return null;
  return {
    version: u.version,
    notes: u.body,
    install: async (progress) => {
      let total = 0, done = 0;
      await u.downloadAndInstall((e) => {
        if (e.event === "Started") total = e.data.contentLength ?? 0;
        if (e.event === "Progress") { done += e.data.chunkLength; if (total) progress(done / total); }
      });
      const { relaunch } = await import("@tauri-apps/plugin-process");
      await relaunch();
    },
  };
}
