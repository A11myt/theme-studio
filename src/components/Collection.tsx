// Sammlung: alle gespeicherten Themes als Karten – Favoriten, Suche, Sortierung, Umbenennen, Duplizieren, Löschen.
import { useMemo, useState } from "react";
import { argbFromHex, effectiveSource, palette, SCHEMES } from "../lib/color";
import { Hct } from "@material/material-color-utilities";
import { DEFAULT_FONTS } from "../lib/fonts";
import type { StoredTheme } from "../lib/store";
import { Desktop, type Os } from "./Desktop";

interface Props {
  themes: StoredTheme[];
  urls: Record<string, string>;      // Bild-URLs nach Bild-ID
  os: Os;
  onOpen: (t: StoredTheme) => void;
  onUpdate: (t: StoredTheme) => void;
  onDuplicate: (t: StoredTheme) => void;
  onDelete: (id: string) => void;
}

type Sort = "neu" | "name" | "farbe";

export function Collection({ themes, urls, os, onOpen, onUpdate, onDuplicate, onDelete }: Props) {
  const [q, setQ] = useState("");
  const [favOnly, setFavOnly] = useState(false);
  const [sort, setSort] = useState<Sort>("neu");
  const [renaming, setRenaming] = useState<string>();
  const [confirmDel, setConfirmDel] = useState<string>();

  const shown = useMemo(() => {
    const hue = (t: StoredTheme) => Hct.fromInt(argbFromHex(effectiveSource(t.settings))).hue;
    const list = themes.filter((t) => (!favOnly || t.favorite) && t.name.toLowerCase().includes(q.toLowerCase()));
    return list.sort((a, b) =>
      (Number(!!b.favorite) - Number(!!a.favorite)) ||
      (sort === "name" ? a.name.localeCompare(b.name) : sort === "farbe" ? hue(a) - hue(b) : b.created - a.created));
  }, [themes, q, favOnly, sort]);

  if (!themes.length) {
    return (
      <section className="card empty-state">
        <h2>Noch keine Themes gespeichert</h2>
        <p className="empty">Bau dir im Bereich Farbe ein Theme und drück oben „Speichern“ (Strg+S) – dann taucht es hier auf.</p>
      </section>
    );
  }

  return (
    <section className="collection">
      <div className="detail-head">
        <h2>Sammlung <small>{themes.length} Theme{themes.length > 1 ? "s" : ""}</small></h2>
        <span className="grow" />
        <input className="name" value={q} onChange={(e) => setQ(e.target.value)} placeholder="Suchen …" aria-label="Themes suchen" />
        <label className="check"><input type="checkbox" checked={favOnly} onChange={(e) => setFavOnly(e.target.checked)} /> nur ★</label>
        <div className="seg" role="group" aria-label="Sortieren">
          {(["neu", "name", "farbe"] as Sort[]).map((s) => (
            <button key={s} type="button" aria-pressed={sort === s} onClick={() => setSort(s)}>{{ neu: "Neu", name: "Name", farbe: "Farbe" }[s]}</button>
          ))}
        </div>
      </div>
      {!shown.length && <p className="empty">Nichts gefunden.</p>}
      <ul className="theme-grid">
        {shown.map((t) => {
          const c = palette(t.settings);
          const f = t.fonts ?? DEFAULT_FONTS;
          return (
            <li key={t.id} className="theme-card">
              <button type="button" className="tc-preview" onClick={() => onOpen(t)} title="Öffnen">
                <Desktop c={c} os={os} image={t.imageId ? urls[t.imageId] : undefined} fonts={f} />
              </button>
              <div className="tc-body">
                <button type="button" className={`star ${t.favorite ? "on" : ""}`} aria-pressed={!!t.favorite}
                  aria-label={t.favorite ? "Aus Favoriten entfernen" : "Zu Favoriten"} onClick={() => onUpdate({ ...t, favorite: !t.favorite })}>
                  {t.favorite ? "★" : "☆"}
                </button>
                {renaming === t.id ? (
                  <input className="name" autoFocus defaultValue={t.name} aria-label="Neuer Name"
                    onKeyDown={(e) => {
                      if (e.key === "Enter") { onUpdate({ ...t, name: e.currentTarget.value.trim() || t.name }); setRenaming(undefined); }
                      if (e.key === "Escape") setRenaming(undefined);
                    }}
                    onBlur={(e) => { onUpdate({ ...t, name: e.currentTarget.value.trim() || t.name }); setRenaming(undefined); }} />
                ) : (
                  <span className="tc-name" onDoubleClick={() => setRenaming(t.id)}>
                    <b>{t.name}</b>
                    <small>{SCHEMES[t.settings.scheme].label} · {t.settings.mode === "dark" ? "dunkel" : "hell"} · {f.mono}</small>
                  </span>
                )}
                <span className="strip">{[c.primary, c.secondary, c.tertiary, c.surface].map((x, i) => <i key={i} style={{ background: x }} />)}</span>
              </div>
              <div className="tc-actions">
                <button type="button" className="primary" onClick={() => onOpen(t)}>Öffnen</button>
                <button type="button" className="ghost" onClick={() => setRenaming(t.id)}>Umbenennen</button>
                <button type="button" className="ghost" onClick={() => onDuplicate(t)}>Duplizieren</button>
                <span className="grow" />
                {confirmDel === t.id
                  ? <button type="button" className="ghost danger" onClick={() => { onDelete(t.id); setConfirmDel(undefined); }}>Löschen?</button>
                  : <button type="button" className="ghost" onClick={() => setConfirmDel(t.id)} aria-label={`${t.name} löschen`} title="Löschen">✕</button>}
              </div>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
