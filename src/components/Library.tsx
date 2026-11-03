// Seitenleiste: Bilder hochladen/auswählen, gespeicherte Themes, matugen-Vorlagen.
import { useRef, useState, type DragEvent } from "react";
import { hasWallhaven } from "../lib/platform";
import type { StoredImage, StoredTemplate, StoredTheme } from "../lib/store";

interface Props {
  images: StoredImage[];
  urls: Record<string, string>;
  themes: StoredTheme[];
  templates: StoredTemplate[];
  selectedImage?: string;
  busy: boolean;
  onAddImages: (files: File[]) => void;
  onWallhaven: () => void;
  onSelectImage: (id: string) => void;
  onDeleteImage: (id: string) => void;
  onOpenTheme: (t: StoredTheme) => void;
  onDeleteTheme: (id: string) => void;
  onAddTemplates: (files: File[]) => void;
  onDeleteTemplate: (id: string) => void;
}

export function Library(p: Props) {
  const imgInput = useRef<HTMLInputElement>(null);
  const tplInput = useRef<HTMLInputElement>(null);
  const [drag, setDrag] = useState(false);

  const drop = (e: DragEvent) => {
    e.preventDefault();
    setDrag(false);
    const files = [...e.dataTransfer.files];
    const imgs = files.filter((f) => f.type.startsWith("image/"));
    const rest = files.filter((f) => !f.type.startsWith("image/"));
    if (imgs.length) p.onAddImages(imgs);
    if (rest.length) p.onAddTemplates(rest);
  };

  return (
    <aside className="library">
      <section>
        <h2>Bilder</h2>
        <button type="button" className={`drop ${drag ? "over" : ""}`}
          onClick={() => imgInput.current?.click()}
          onDragOver={(e) => { e.preventDefault(); setDrag(true); }}
          onDragLeave={() => setDrag(false)} onDrop={drop}>
          {p.busy ? "Farben werden berechnet …" : <>Bilder hierher ziehen<br /><small>oder klicken · Vorlagen auch</small></>}
        </button>
        {hasWallhaven
          ? <button type="button" className="ghost wide" onClick={p.onWallhaven}>Auf wallhaven suchen</button>
          : <p className="empty">wallhaven-Suche gibt es in der App (oder lokal mit <code>pnpm dev</code>).</p>}
        <input ref={imgInput} type="file" accept="image/*" multiple hidden
          onChange={(e) => { p.onAddImages([...(e.target.files ?? [])]); e.target.value = ""; }} />
        {p.images.length === 0 && <p className="empty">Noch keine Bilder. Wallpaper hochladen, um Themes daraus zu bauen.</p>}
        <ul className="thumbs">
          {p.images.map((i) => (
            <li key={i.id} className={i.id === p.selectedImage ? "sel" : ""}>
              <button type="button" className="thumb" onClick={() => p.onSelectImage(i.id)} title={i.name}
                aria-label={`Bild ${i.name} auswählen`} aria-pressed={i.id === p.selectedImage}>
                <img src={p.urls[i.id]} alt="" />
                <span className="dots">{i.sources.map((s) => <i key={s} style={{ background: s }} />)}</span>
              </button>
              <button type="button" className="x" aria-label={`${i.name} entfernen`} onClick={() => p.onDeleteImage(i.id)}>✕</button>
            </li>
          ))}
        </ul>
      </section>

      <section>
        <h2>Gespeicherte Themes</h2>
        {p.themes.length === 0 && <p className="empty">Noch keine. Oben rechts „Speichern“.</p>}
        <ul className="list">
          {p.themes.map((t) => (
            <li key={t.id}>
              <button type="button" className="row" onClick={() => p.onOpenTheme(t)}>
                <i className="sw" style={{ background: t.settings.source }} />
                <span>{t.name}<small>{t.settings.scheme} · {t.settings.mode === "dark" ? "dunkel" : "hell"}</small></span>
              </button>
              <button type="button" className="x" aria-label={`${t.name} löschen`} onClick={() => p.onDeleteTheme(t.id)}>✕</button>
            </li>
          ))}
        </ul>
      </section>

      <section>
        <h2>Vorlagen <small>(matugen)</small></h2>
        <p className="empty">Deine matugen-Vorlagen hochladen (z. B. alacritty.toml) – sie werden mit dem Theme ausgefüllt.</p>
        <button type="button" className="ghost" onClick={() => tplInput.current?.click()}>Vorlage hinzufügen</button>
        <input ref={tplInput} type="file" multiple hidden
          onChange={(e) => { p.onAddTemplates([...(e.target.files ?? [])]); e.target.value = ""; }} />
        <ul className="list">
          {p.templates.map((t) => (
            <li key={t.id}>
              <span className="row static"><code>{t.name}</code></span>
              <button type="button" className="x" aria-label={`${t.name} entfernen`} onClick={() => p.onDeleteTemplate(t.id)}>✕</button>
            </li>
          ))}
        </ul>
      </section>
    </aside>
  );
}
