// wallhaven.cc ohne Anmeldung – gleiche Filter wie der Launcher auf dem Laptop (scripts/wallhaven.py):
// nur jugendfrei, mind. 1920×1080, 16:9/16:10, Allgemein/Anime/Personen; leer = Toplist des letzten Monats.
import { isTauri, netFetch } from "./platform";
export interface WallhavenItem {
  id: string;
  thumb: string;   // Vorschau (direkt von th.wallhaven.cc ladbar)
  full: string;    // Originalbild
  res: string;
  size: number;
  colors: string[];
}

export interface WallhavenPage {
  items: WallhavenItem[];
  page: number;
  lastPage: number;
}

export async function search(query: string, page = 1): Promise<WallhavenPage> {
  const params = new URLSearchParams({
    categories: "111", purity: "100", atleast: "1920x1080", ratios: "16x9,16x10", page: String(page),
  });
  if (query.trim()) {
    params.set("q", query.trim());
    params.set("sorting", "relevance");
  } else {
    params.set("sorting", "toplist");
    params.set("topRange", "1M");
  }
  const r = await netFetch(`https://wallhaven.cc/api/v1/search?${params}`);
  if (!r.ok) throw new Error(r.status === 429 ? "zu viele Anfragen – kurz warten" : `wallhaven antwortet mit ${r.status}`);
  const d = await r.json();
  return {
    items: d.data.map((x: any) => ({
      id: x.id, thumb: x.thumbs.small, full: x.path, res: x.resolution, size: x.file_size, colors: x.colors ?? [],
    })),
    page: d.meta.current_page,
    lastPage: d.meta.last_page,
  };
}

const MIME: Record<string, string> = { jpg: "image/jpeg", jpeg: "image/jpeg", png: "image/png", webp: "image/webp" };

/** Originalbild als Datei laden. App: über Rust direkt in den Wallpaper-Ordner, Browser: über den Entwicklungsserver. */
export async function download(item: WallhavenItem, wallpaperDir?: string): Promise<File> {
  const u = new URL(item.full);
  if (u.hostname !== "w.wallhaven.cc" || !u.pathname.startsWith("/full/")) throw new Error("unerwartete Bildadresse");
  const name = u.pathname.slice(u.pathname.lastIndexOf("/") + 1);
  const type = MIME[name.split(".").pop()!.toLowerCase()] ?? "image/jpeg";
  if (isTauri) {
    const { invoke } = await import("@tauri-apps/api/core");
    const bytes = await invoke<ArrayBuffer>("wallhaven_download", { url: item.full, dir: wallpaperDir ?? "" });
    return new File([bytes], name, { type });
  }
  const r = await netFetch(item.full);
  if (!r.ok) throw new Error(`Download fehlgeschlagen (${r.status})`);
  const blob = await r.blob();
  return new File([blob], name, { type: blob.type.startsWith("image/") ? blob.type : type });
}
