// Sammlung: alle gespeicherten Themes als Karten – Favoriten, Suche, Sortierung, Umbenennen, Duplizieren, Löschen.
import { useMemo, useState } from "react";
import { argbFromHex, effectiveSource, palette, SCHEMES } from "../lib/color";
import { Hct } from "@material/material-color-utilities";
import { DEFAULT_FONTS } from "../lib/fonts";
import type { StoredTheme } from "../lib/store";
import { Desktop, type Os } from "./Desktop";
import { t } from "../lib/i18n";

interface Props {
  themes: StoredTheme[];
  urls: Record<string, string>;      // Bild-URLs nach Bild-ID
  os: Os;
  onOpen: (t: StoredTheme) => void;
  onUpdate: (t: StoredTheme) => void;
  onDuplicate: (t: StoredTheme) => void;
  onDelete: (id: string) => void;
  onShare: (t: StoredTheme) => void;
  onApply?: (t: StoredTheme) => Promise<void>;   // direkt anwenden (Desktop-App unter Windows)
}

type Sort = "neu" | "name" | "farbe";

export function Collection({ themes, urls, os, onOpen, onUpdate, onDuplicate, onDelete, onShare, onApply }: Props) {
  const [applying, setApplying] = useState<string>();
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
        <h2>{t("Noch keine Themes gespeichert")}</h2>
        <p className="empty">{t("Bau dir im Bereich Farbe ein Theme und drück oben „Speichern“ (Strg+S) – dann taucht es hier auf.")}</p>
      </section>
    );
  }

  return (
    <section className="collection">
      <div className="detail-head">
        <h2>{t("Sammlung")}{" "}<small>{themes.length}{" "}{t("Theme")}{themes.length > 1 ? "s" : ""}</small></h2>
        <span className="grow" />
        <input className="name" value={q} onChange={(e) => setQ(e.target.value)} placeholder={t("Suchen …")} aria-label={t("Themes suchen")} />
        <label className="check"><input type="checkbox" checked={favOnly} onChange={(e) => setFavOnly(e.target.checked)} />{" "}{t("nur ★")}</label>
        <div className="seg" role="group" aria-label={t("Sortieren")}>
          {(["neu", "name", "farbe"] as Sort[]).map((s) => (
            <button key={s} type="button" aria-pressed={sort === s} onClick={() => setSort(s)}>{t({ neu: "Neu", name: "Name", farbe: "Farbe" }[s])}</button>
          ))}
        </div>
      </div>
      {!shown.length && <p className="empty">{t("Nichts gefunden.")}</p>}
      <ul className="theme-grid">
        {shown.map((th) => {
          const c = palette(th.settings);
          const f = th.fonts ?? DEFAULT_FONTS;
          return (
            <li key={th.id} className="theme-card">
              <button type="button" className="tc-preview" onClick={() => onOpen(th)} title={t("Öffnen")} aria-label={t("Theme {name} öffnen", { name: th.name })}>
                <Desktop c={c} os={os} image={th.imageId ? urls[th.imageId] : undefined} fonts={f} />
              </button>
              <div className="tc-body">
                <button type="button" className={`star ${th.favorite ? "on" : ""}`} aria-pressed={!!th.favorite}
                  aria-label={th.favorite ? t("Aus Favoriten entfernen") : t("Zu Favoriten")} onClick={() => onUpdate({ ...th, favorite: !th.favorite })}>
                  {th.favorite ? "★" : "☆"}
                </button>
                {renaming === th.id ? (
                  <input className="name" autoFocus defaultValue={th.name} aria-label={t("Neuer Name")}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") { onUpdate({ ...th, name: e.currentTarget.value.trim() || th.name }); setRenaming(undefined); }
                      if (e.key === "Escape") setRenaming(undefined);
                    }}
                    onBlur={(e) => { onUpdate({ ...th, name: e.currentTarget.value.trim() || th.name }); setRenaming(undefined); }} />
                ) : (
                  <span className="tc-name" onDoubleClick={() => setRenaming(th.id)}>
                    <b>{th.name}</b>
                    <small>{SCHEMES[th.settings.scheme].label} · {th.settings.mode === "dark" ? t("dunkel") : t("hell")} · {f.mono}</small>
                  </span>
                )}
                <span className="strip">{[c.primary, c.secondary, c.tertiary, c.surface].map((x, i) => <i key={i} style={{ background: x }} />)}</span>
              </div>
              <div className="tc-actions">
                {onApply
                  ? <button type="button" className="primary" disabled={!!applying} onClick={async () => { setApplying(th.id); try { await onApply(th); } finally { setApplying(undefined); } }}>
                      {applying === th.id ? t("Wird angewendet …") : t("Anwenden")}</button>
                  : null}
                <button type="button" className={onApply ? "ghost" : "primary"} onClick={() => onOpen(th)}>{t("Öffnen")}</button>
                <button type="button" className="ghost" onClick={() => setRenaming(th.id)}>{t("Umbenennen")}</button>
                <button type="button" className="ghost" onClick={() => onDuplicate(th)}>{t("Duplizieren")}</button>
                <button type="button" className="ghost" onClick={() => onShare(th)} title={t("Link mit diesem Theme kopieren")}>{t("Link")}</button>
                <span className="grow" />
                {confirmDel === th.id
                  ? <button type="button" className="ghost danger" onClick={() => { onDelete(th.id); setConfirmDel(undefined); }}>{t("Löschen?")}</button>
                  : <button type="button" className="ghost" onClick={() => setConfirmDel(th.id)} aria-label={t("{name} löschen", { name: th.name })} title={t("Löschen")}>✕</button>}
              </div>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
