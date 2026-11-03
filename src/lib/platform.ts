// Browser oder Tauri-App? In der App laufen Netz, Speichern und Zwischenablage über Tauri-Plugins.
export const isTauri = typeof window !== "undefined" && "__TAURI_INTERNALS__" in window;

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

/** Textdatei speichern: App → Speichern-Dialog, Browser → Download. */
export async function saveText(filename: string, text: string): Promise<boolean> {
  if (isTauri) {
    const { save } = await import("@tauri-apps/plugin-dialog");
    const { writeTextFile } = await import("@tauri-apps/plugin-fs");
    const path = await save({ defaultPath: filename });
    if (!path) return false;
    await writeTextFile(path, text);
    return true;
  }
  const a = document.createElement("a");
  a.href = URL.createObjectURL(new Blob([text], { type: "text/plain;charset=utf-8" }));
  a.download = filename;
  a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 1000);
  return true;
}

export async function copyText(text: string): Promise<void> {
  if (isTauri) {
    const { writeText } = await import("@tauri-apps/plugin-clipboard-manager");
    return writeText(text);
  }
  return navigator.clipboard.writeText(text);
}
