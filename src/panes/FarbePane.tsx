import { Desktop } from "../components/Desktop";
import { OsToggle } from "../components/OsToggle";
import { hueName, onColor, palette, SCHEMES, type Mode, type SchemeName } from "../lib/color";
import { useRef, useState } from "react";
import { hasWallhaven } from "../lib/platform";
import { nearestWallhavenColor } from "../lib/wallhaven";
import type { Studio } from "../useStudio";
import { t } from "../lib/i18n";

export function FarbePane({ s }: { s: Studio }) {
  const { settings, os, setOs, setWallhaven, fonts, setTab, image, update, tune, effSource, overrideCount, bg, addImages, pal } = s;
  const fileInput = useRef<HTMLInputElement>(null);
  const [over, setOver] = useState(false);
  const schemes = Object.keys(SCHEMES) as SchemeName[];
  return (
    <div className="pane farbe-pane">
      {/* Bühne: große Vorschau der gewählten Variante, darunter alle Varianten als Leiste */}
      <section className="card stage" aria-label={t("Vorschau und Varianten")}>
        <div className="stage-head">
          <h2>{SCHEMES[settings.scheme].label}<small>{t(SCHEMES[settings.scheme].hint)}</small></h2>
          <span className="grow" />
          {hasWallhaven && bg && <button type="button" className="ghost" onClick={() => setWallhaven({ color: nearestWallhavenColor(effSource) })}
            title={t("wallhaven nach Bildern in der Ausgangsfarbe durchsuchen")}>
            <i className="sw inline" style={{ background: `#${nearestWallhavenColor(effSource)}` }} />{t("Passende Wallpaper suchen")}
          </button>}
          <OsToggle os={os} onChange={setOs} />
        </div>
        <div className="stage-preview">
          {bg ? <Desktop c={pal} os={os} image={bg} size="large" fonts={fonts} /> : (
            <div className={`empty-hero ${over ? "over" : ""}`}
              onDragOver={(e) => { e.preventDefault(); setOver(true); }} onDragLeave={() => setOver(false)}
              onDrop={(e) => { e.preventDefault(); setOver(false); const f = [...e.dataTransfer.files].filter((x) => x.type.startsWith("image/")); if (f.length) void addImages(f); }}>
              <b>{t("Starte mit einem Wallpaper")}</b>
              <span>{t("Bild hierher ziehen – Theme Studio holt die Farben heraus.")}</span>
              <div className="empty-actions">
                <button type="button" className="primary" onClick={() => fileInput.current?.click()}>{t("Bild wählen …")}</button>
                {hasWallhaven && <button type="button" className="ghost" onClick={() => setWallhaven({})}>{t("Auf wallhaven suchen")}</button>}
              </div>
              <small>{t("Oder rechts eine eigene Farbe wählen – das geht auch ohne Bild.")}</small>
              <input ref={fileInput} type="file" accept="image/*" multiple hidden
                onChange={(e) => { const f = [...(e.target.files ?? [])]; if (f.length) void addImages(f); e.target.value = ""; }} />
            </div>
          )}
        </div>
        <div className="vstrip" role="radiogroup" aria-label={t("Varianten – anklicken oder Taste 1–9")}>
          {schemes.map((k, i) => {
            const c = palette({ ...settings, scheme: k });
            const on = settings.scheme === k;
            return (
              <button key={k} type="button" role="radio" aria-checked={on} className={`vchip ${on ? "on" : ""}`} onClick={() => update({ scheme: k })}
                title={`${SCHEMES[k].label} – ${t(SCHEMES[k].hint)} (${i + 1})`}>
                <span className="vchip-swatch" style={{ background: c.surface }}>
                  {[c.primary, c.secondary, c.tertiary].map((x, j) => <i key={j} style={{ background: x }} />)}
                </span>
                <span className="vchip-name">{SCHEMES[k].label}</span>
              </button>
            );
          })}
        </div>
      </section>

      {/* Prüfbereich: alles, was die Farbe bestimmt */}
      <aside className="card inspector controls">
            <h2>{t("Ausgangsfarbe")}</h2>
            <div className="sources">
              {(image?.sources ?? []).map((s, i) => (
                <button key={s} type="button" className="source" aria-pressed={settings.source === s}
                  style={{ background: s, color: onColor(s) }} onClick={() => update({ source: s })}>
                  <b>{i + 1}</b><small>{t(hueName(s))}</small>
                </button>
              ))}
              <label className="source custom" title={t("Eigene Farbe")}>
                <input type="color" value={settings.source} onChange={(e) => update({ source: e.target.value })} />
                <small>{t("eigene")}</small>
              </label>
            </div>
            <code className="hex">{settings.source}</code>
            {image && <small className="engine" title={image.engine === "matugen"
              ? t("Mit der Rust-Bibliothek material-colors berechnet (WebAssembly)")
              : t("Näherung im Browser – kann leicht abweichen")}>
              {image.engine === "matugen" ? t("· exakt") : t("· Näherung")}</small>}

            <h2>{t("Modus")}</h2>
            <div className="seg">
              {(["dark", "light"] as Mode[]).map((m) => (
                <button key={m} type="button" aria-pressed={settings.mode === m} onClick={() => update({ mode: m })}>
                  {m === "dark" ? t("Dunkel") : t("Hell")}
                </button>
              ))}
            </div>

            <h2>{t("Kontrast")}{" "}<code>{settings.contrast.toFixed(1)}</code></h2>
            <input type="range" min={-1} max={1} step={0.1} value={settings.contrast}
              onChange={(e) => update({ contrast: Number(e.target.value) })} aria-label={t("Kontrast")} />

            <div className="tune">
              <h2>{t("Feinjustieren")}
                {(tune.hue !== 0 || tune.chroma !== 1) && <button type="button" className="link" onClick={() => update({ tune: undefined })}>{t("zurücksetzen")}</button>}
              </h2>
              <label><span className="tune-row"><span>{t("Farbton")}</span><code>{tune.hue > 0 ? "+" : ""}{tune.hue}°</code></span>
                <input type="range" min={-60} max={60} step={1} value={tune.hue}
                  onChange={(e) => update({ tune: { ...tune, hue: Number(e.target.value) } })} aria-label={t("Farbton verschieben")} />
              </label>
              <label><span className="tune-row"><span>{t("Buntheit")}</span><code>{Math.round(tune.chroma * 100)} %</code></span>
                <input type="range" min={0.4} max={1.6} step={0.05} value={tune.chroma}
                  onChange={(e) => update({ tune: { ...tune, chroma: Number(e.target.value) } })} aria-label={t("Buntheit")} />
              </label>
              <p className="tune-result">
                <i className="sw inline" style={{ background: settings.source }} /> → <i className="sw inline" style={{ background: effSource }} />
                <code>{effSource}</code>
                {overrideCount > 0 && <span> · {overrideCount}{" "}{t("Farbe")}{overrideCount > 1 ? "n" : ""}{" "}{t("überschrieben")}
                  <button type="button" className="link" onClick={() => update({ overrides: undefined })}>{t("zurücksetzen")}</button></span>}
              </p>
            </div>

        <ul className="palette-peek" aria-label={t("Palette dieser Variante")}>
          {([[t("Primär"), pal.primary, pal.on_primary], [t("Sekundär"), pal.secondary, pal.on_secondary], [t("Tertiär"), pal.tertiary, pal.on_tertiary],
             [t("Fläche"), pal.surface, pal.on_surface], [t("Karte"), pal.surface_container_high, pal.on_surface], [t("Fehler"), pal.error, pal.on_error]] as [string, string, string][]).map(([n, bgc, fg]) => (
            <li key={n} style={{ background: bgc, color: fg }}><span>{n}</span><code>{bgc}</code></li>
          ))}
        </ul>
        <button type="button" className="primary next" onClick={() => setTab("schrift")}>{t("Weiter: Schrift →")}</button>
      </aside>
    </div>
  );
}
