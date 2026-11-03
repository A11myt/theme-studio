// wallhaven-Suche als Overlay: suchen, durchblättern, Bild anklicken → wird hochgeladen und ausgewählt.
import { useEffect, useRef, useState, type FormEvent } from "react";
import { download, search, type WallhavenItem } from "../lib/wallhaven";

interface Props {
  onClose: () => void;
  onPick: (file: File) => Promise<void>;
}

export function Wallhaven({ onClose, onPick }: Props) {
  const [query, setQuery] = useState("");
  const [items, setItems] = useState<WallhavenItem[]>([]);
  const [page, setPage] = useState(1);
  const [lastPage, setLastPage] = useState(1);
  const [loading, setLoading] = useState(false);
  const [busyId, setBusyId] = useState<string>();
  const [error, setError] = useState("");
  const input = useRef<HTMLInputElement>(null);

  const load = async (q: string, p: number) => {
    setLoading(true);
    setError("");
    try {
      const r = await search(q, p);
      setItems((prev) => (p === 1 ? r.items : [...prev, ...r.items]));
      setPage(r.page);
      setLastPage(r.lastPage);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void load("", 1);                       // Start: Toplist des Monats
    input.current?.focus();
    const esc = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", esc);
    return () => window.removeEventListener("keydown", esc);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const submit = (e: FormEvent) => { e.preventDefault(); void load(query, 1); };

  const pick = async (it: WallhavenItem) => {
    setBusyId(it.id);
    setError("");
    try {
      await onPick(await download(it));
      onClose();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusyId(undefined);
    }
  };

  return (
    <div className="overlay" role="dialog" aria-modal="true" aria-label="wallhaven durchsuchen" onClick={onClose}>
      <div className="sheet" onClick={(e) => e.stopPropagation()}>
        <form className="wh-head" onSubmit={submit}>
          <h2>wallhaven</h2>
          <input ref={input} className="name grow" value={query} onChange={(e) => setQuery(e.target.value)}
            placeholder="Suchen, z. B. mountains, cyberpunk, wow … (leer = Toplist)" aria-label="Suchbegriff" />
          <button type="submit" className="primary">Suchen</button>
          <button type="button" className="ghost" onClick={onClose} aria-label="Schließen">✕</button>
        </form>
        {error && <p className="error">{error}</p>}
        <ul className="wh-grid">
          {items.map((it) => (
            <li key={it.id}>
              <button type="button" className="wh-item" onClick={() => pick(it)} disabled={!!busyId}>
                <img src={it.thumb} alt="" loading="lazy" />
                <span className="wh-meta">
                  <span className="dots">{it.colors.slice(0, 4).map((c) => <i key={c} style={{ background: c }} />)}</span>
                  <small>{busyId === it.id ? "lädt …" : it.res}</small>
                </span>
              </button>
            </li>
          ))}
        </ul>
        <div className="wh-foot">
          {loading ? <span className="empty">lädt …</span>
            : page < lastPage && <button type="button" className="ghost" onClick={() => load(query, page + 1)}>Mehr laden</button>}
          {!loading && !items.length && !error && <span className="empty">Nichts gefunden.</span>}
          <small className="empty">Nur jugendfreie Bilder, mind. 1920×1080 · Bilder von wallhaven.cc</small>
        </div>
      </div>
    </div>
  );
}
