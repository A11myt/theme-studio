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

// wallhaven filtert nur nach diesen 29 Farben → die nächstliegende wählen
export const WALLHAVEN_COLORS = ["660000", "990000", "cc0000", "cc3333", "ea4c88", "993399", "663399", "333399", "0066cc",
  "0099cc", "66cccc", "77cc33", "669900", "336600", "666600", "999900", "cccc33", "ffff00", "ffcc33", "ff9900", "ff6600",
  "cc6633", "996633", "663300", "000000", "999999", "cccccc", "ffffff", "424153"];

/** Nächste wallhaven-Farbe (Abstand im Lab-Raum, wie das Auge Farben unterscheidet). */
export function nearestWallhavenColor(hex: string): string {
  const lab = (h: string) => {
    const [r, g, b] = [0, 2, 4].map((i) => {
      const c = parseInt(h.replace("#", "").slice(i, i + 2), 16) / 255;
      return c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
    });
    const [x, y, z] = [(0.4124 * r + 0.3576 * g + 0.1805 * b) / 0.9505, 0.2126 * r + 0.7152 * g + 0.0722 * b, (0.0193 * r + 0.1192 * g + 0.9505 * b) / 1.089];
    const f = (t: number) => (t > 0.008856 ? Math.cbrt(t) : 7.787 * t + 16 / 116);
    return [116 * f(y) - 16, 500 * (f(x) - f(y)), 200 * (f(y) - f(z))];
  };
  const [l, a, b] = lab(hex);
  let best = WALLHAVEN_COLORS[0], dist = Infinity;
  for (const c of WALLHAVEN_COLORS) {
    const [l2, a2, b2] = lab(c);
    const d = (l - l2) ** 2 + (a - a2) ** 2 + (b - b2) ** 2;
    if (d < dist) { dist = d; best = c; }
  }
  return best;
}

export async function search(query: string, page = 1, color?: string): Promise<WallhavenPage> {
  const params = new URLSearchParams({
    categories: "111", purity: "100", atleast: "1920x1080", ratios: "16x9,16x10", page: String(page),
  });
  if (color) params.set("colors", color.replace("#", ""));
  if (query.trim()) {
    params.set("q", query.trim());
    params.set("sorting", "relevance");
  } else if (color) {
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
