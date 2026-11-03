// wallhaven.cc ohne Anmeldung – gleiche Filter wie der Launcher auf dem Laptop (scripts/wallhaven.py):
// nur jugendfrei, mind. 1920×1080, 16:9/16:10, Allgemein/Anime/Personen; leer = Toplist des letzten Monats.
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
  const r = await fetch(`/wallhaven/api/search?${params}`);
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

/** Originalbild als Datei laden (über den lokalen Server, wegen CORS). */
export async function download(item: WallhavenItem): Promise<File> {
  const u = new URL(item.full);
  if (u.hostname !== "w.wallhaven.cc" || !u.pathname.startsWith("/full/")) throw new Error("unerwartete Bildadresse");
  const r = await fetch(`/wallhaven${u.pathname}`);
  if (!r.ok) throw new Error(`Download fehlgeschlagen (${r.status})`);
  const blob = await r.blob();
  if (!blob.type.startsWith("image/")) throw new Error("kein Bild erhalten");
  return new File([blob], `wallhaven-${item.id}${u.pathname.slice(u.pathname.lastIndexOf("."))}`, { type: blob.type });
}
