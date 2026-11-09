// Seitenleiste: nur das Ausgangsmaterial – Bilder hochladen, auswählen, wallhaven. (Themes → Sammlung, Vorlagen → Export)
import { useRef, useState, type DragEvent } from "react";
import { hasWallhaven } from "../lib/platform";
import type { StoredImage } from "../lib/store";
import { t } from "../lib/i18n";

interface Props {
  images: StoredImage[];
  urls: Record<string, string>;
  selectedImage?: string;
  busy: boolean;
  onAddImages: (files: File[]) => void;
  onWallhaven: () => void;
  onSelectImage: (id: string) => void;
  onDeleteImage: (id: string) => void;
  onAddTemplates: (files: File[]) => void;
}

export function Library(p: Props) {
  const imgInput = useRef<HTMLInputElement>(null);
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
        <h2>{t("Bilder")}{p.images.length > 0 && <span className="count">{p.images.length}</span>}</h2>
        <button type="button" className={`drop ${drag ? "over" : ""}`}
          onClick={() => imgInput.current?.click()}
          onDragOver={(e) => { e.preventDefault(); setDrag(true); }}
          onDragLeave={() => setDrag(false)} onDrop={drop}>
          {p.busy ? t("Farben werden berechnet …") : <>{t("Bilder hierher ziehen")}<br /><small>{t("oder klicken")}</small></>}
        </button>
        {hasWallhaven
          ? <button type="button" className="ghost wide" onClick={p.onWallhaven}>{t("Auf wallhaven suchen")}</button>
          : <p className="empty">{t("wallhaven-Suche gibt es in der App (oder lokal mit pnpm dev).")}</p>}
        <input ref={imgInput} type="file" accept="image/*" multiple hidden
          onChange={(e) => { p.onAddImages([...(e.target.files ?? [])]); e.target.value = ""; }} />
        {p.images.length === 0 && <p className="empty">{t("Noch keine Bilder. Wallpaper hochladen, um Themes daraus zu bauen.")}</p>}
        <ul className="thumbs">
          {p.images.map((i) => (
            <li key={i.id} className={i.id === p.selectedImage ? "sel" : ""}>
              <button type="button" className="thumb" onClick={() => p.onSelectImage(i.id)} title={i.name}
                aria-label={t("Bild {name} auswählen", { name: i.name })} aria-pressed={i.id === p.selectedImage}>
                <img src={p.urls[i.id]} alt="" />
                <span className="dots">{i.sources.map((s) => <i key={s} style={{ background: s }} />)}</span>
              </button>
              <button type="button" className="x" aria-label={`${i.name} entfernen`} onClick={() => p.onDeleteImage(i.id)}>✕</button>
            </li>
          ))}
        </ul>
      </section>

    </aside>
  );
}
