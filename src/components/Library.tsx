// Seitenleiste: Bilder hochladen/auswählen, gespeicherte Themes, matugen-Vorlagen.
import { useRef, useState, type DragEvent } from "react";
import { hasWallhaven } from "../lib/platform";
import type { StoredImage, StoredTemplate, StoredTheme } from "../lib/store";
import { t, t as tr } from "../lib/i18n";

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
        <h2>{t("Bilder")}</h2>
        <button type="button" className={`drop ${drag ? "over" : ""}`}
          onClick={() => imgInput.current?.click()}
          onDragOver={(e) => { e.preventDefault(); setDrag(true); }}
          onDragLeave={() => setDrag(false)} onDrop={drop}>
          {p.busy ? t("Farben werden berechnet …") : <>{t("Bilder hierher ziehen")}<br /><small>{t("oder klicken · Vorlagen auch")}</small></>}
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

      <section>
        <h2>{t("Gespeicherte Themes")}</h2>
        {p.themes.length === 0 && <p className="empty">{t("Noch keine. Oben rechts „Speichern“.")}</p>}
        <ul className="list">
          {p.themes.map((t) => (
            <li key={t.id}>
              <button type="button" className="row" onClick={() => p.onOpenTheme(t)}>
                <i className="sw" style={{ background: t.settings.source }} />
                <span>{t.name}<small>{t.settings.scheme} · {t.settings.mode === "dark" ? tr("dunkel") : tr("hell")}</small></span>
              </button>
              <button type="button" className="x" aria-label={tr("{name} löschen", { name: t.name })} onClick={() => p.onDeleteTheme(t.id)}>✕</button>
            </li>
          ))}
        </ul>
      </section>

      <section>
        <h2>{t("Vorlagen")}{" "}<small>{t("(matugen)")}</small></h2>
        <p className="empty">{t("Deine matugen-Vorlagen hochladen (z. B. alacritty.toml) – sie werden mit dem Theme ausgefüllt.")}</p>
        <button type="button" className="ghost" onClick={() => tplInput.current?.click()}>{t("Vorlage hinzufügen")}</button>
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
