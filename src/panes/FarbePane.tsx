import { useRef } from "react";
import { HexField } from '../components/HexField';
import { ImagePlus, Search } from "lucide-react";
import { LivePreview } from "../components/LivePreview";
import { Field, StepLayout } from "../components/StepLayout";
import { hueName, onColor, palette, SCHEMES, type Mode, type SchemeName } from "../lib/color";
import { hasWallhaven } from "../lib/platform";
import { nearestWallhavenColor } from "../lib/wallhaven";
import type { Studio } from "../useStudio";
import { t } from "../lib/i18n";

export function FarbePane({ s }: { s: Studio }) {
  const { settings, setWallhaven, image, update, tune, effSource, overrideCount, bg, addImages, pal } = s;
  const fileInput = useRef<HTMLInputElement>(null);
  const schemes = Object.keys(SCHEMES) as SchemeName[];

  const notice = !bg && (
    <div className="stage-notice">
      <ImagePlus size={18} aria-hidden="true" />
      <p><b>{t("Noch kein Wallpaper")}</b>{" "}<span>{t("Die Vorschau nutzt die Ausgangsfarbe. Bild hierher ziehen oder:")}</span></p>
      <span className="grow" />
      <button type="button" className="primary" onClick={() => fileInput.current?.click()}>{t("Bild wählen …")}</button>
      {hasWallhaven && <button type="button" className="ghost" onClick={() => setWallhaven({})}>{t("Auf wallhaven suchen")}</button>}
      <input ref={fileInput} type="file" accept="image/*" multiple hidden
        onChange={(e) => { const f = [...(e.target.files ?? [])]; if (f.length) void addImages(f); e.target.value = ""; }} />
    </div>
  );

  const actions = hasWallhaven && bg && (
    <button type="button" className="ghost" onClick={() => setWallhaven({ color: nearestWallhavenColor(effSource) })}
      title={t("wallhaven nach Bildern in der Ausgangsfarbe durchsuchen")}>
      <Search size={15} aria-hidden="true" />{t("Passende Wallpaper suchen")}
    </button>
  );

  const variants = (
    <div className="stage-foot">
      <div className="field-head">
        <h3>{t("Variante")}</h3>
        <span className="field-hint">{SCHEMES[settings.scheme].label} – {t(SCHEMES[settings.scheme].hint)}</span>
        <span className="grow" />
        <kbd>1–9</kbd>
      </div>
      <div className="vstrip" role="radiogroup" aria-label={t("Varianten – anklicken oder Taste 1–9")}>
        {schemes.map((k, i) => {
          const c = palette({ ...settings, scheme: k });
          const on = settings.scheme === k;
          return (
            <button key={k} type="button" role="radio" aria-checked={on} className={`vchip ${on ? "on" : ""}`} tabIndex={on ? 0 : -1} onClick={() => update({ scheme: k })}
              onKeyDown={e => {
                const n = { ArrowRight: i + 1, ArrowDown: i + 1, ArrowLeft: i - 1, ArrowUp: i - 1, Home: 0, End: schemes.length - 1 }[e.key];
                if (n === undefined) return;
                e.preventDefault(); const next = (n + schemes.length) % schemes.length;
                update({ scheme: schemes[next] }); e.currentTarget.parentElement?.querySelectorAll('button')[next]?.focus();
              }}
              title={`${SCHEMES[k].label} – ${t(SCHEMES[k].hint)} (${i + 1})`}>
              <span className="vchip-swatch" style={{ background: c.surface }}>
                {[c.primary, c.secondary, c.tertiary].map((x, j) => <i key={j} style={{ background: x }} />)}
              </span>
              <span className="vchip-name">{SCHEMES[k].label}</span>
            </button>
          );
        })}
      </div>
    </div>
  );

  return (
    <StepLayout s={s} step="farbe"
      hint={t("Wähle Ausgangsfarbe und Variante – die Vorschau zeigt jede Änderung sofort.")}
      preview={<LivePreview s={s} initial="desktop" notice={notice} actions={actions} footer={variants} onDropFiles={(f) => void addImages(f)} />}>

      <Field label={t("Ausgangsfarbe")} hint={image ? t("Aus dem Wallpaper erkannt – oder eine eigene wählen.") : t("Eine eigene Farbe wählen – oder ein Wallpaper hinzufügen.")}
        value={<code className="value">{settings.source}{image && <small title={image.engine === "matugen"
          ? t("Mit der Rust-Bibliothek material-colors berechnet (WebAssembly)")
          : t("Näherung im Browser – kann leicht abweichen")}>
          {image.engine === "matugen" ? t("· exakt") : t("· Näherung")}</small>}</code>}>
        <div className="sources">
          {(image?.sources ?? []).map((src, i) => (
            <button key={src} type="button" className="source" aria-pressed={settings.source === src}
              style={{ background: src, color: onColor(src) }} onClick={() => update({ source: src })}
              aria-label={`${t("Ausgangsfarbe")} ${i + 1}: ${t(hueName(src))}`}>
              <b>{i + 1}</b><small>{t(hueName(src))}</small>
            </button>
          ))}
          <label className="source custom" title={t("Eigene Farbe")}>
            <input type="color" value={settings.source} onChange={(e) => update({ source: e.target.value })} aria-label={t("Eigene Farbe")} />
            <small>{t("eigene")}</small>
          </label>
          <HexField color={settings.source} onChange={source => update({ source })} />
        </div>
      </Field>

      <Field label={t("Modus")}>
        <div className="seg seg-full">
          {(["dark", "light"] as Mode[]).map((m) => (
            <button key={m} type="button" aria-pressed={settings.mode === m} onClick={() => update({ mode: m })}>
              {m === "dark" ? t("Dunkel") : t("Hell")}
            </button>
          ))}
        </div>
      </Field>

      <Field label={t("Kontrast")} hint={t("Höher = besser lesbar, niedriger = weicher.")}
        value={<code className="value">{settings.contrast > 0 ? "+" : ""}{settings.contrast.toFixed(1)}</code>}>
        <input type="range" min={-1} max={1} step={0.1} value={settings.contrast}
          onChange={(e) => update({ contrast: Number(e.target.value) })} aria-label={t("Kontrast")} />
      </Field>

      <Field label={t("Feinjustieren")} hint={t("Farbton drehen und Buntheit anpassen.")}
        value={(tune.hue !== 0 || tune.chroma !== 1) && <button type="button" className="link" onClick={() => update({ tune: undefined })}>{t("zurücksetzen")}</button>}>
        <label className="slider">
          <span className="tune-row"><span>{t("Farbton")}</span><code>{tune.hue > 0 ? "+" : ""}{tune.hue}°</code></span>
          <input type="range" min={-60} max={60} step={1} value={tune.hue}
            onChange={(e) => update({ tune: { ...tune, hue: Number(e.target.value) } })} aria-label={t("Farbton verschieben")} />
        </label>
        <label className="slider">
          <span className="tune-row"><span>{t("Buntheit")}</span><code>{Math.round(tune.chroma * 100)} %</code></span>
          <input type="range" min={0.4} max={1.6} step={0.05} value={tune.chroma}
            onChange={(e) => update({ tune: { ...tune, chroma: Number(e.target.value) } })} aria-label={t("Buntheit")} />
        </label>
        {(effSource !== settings.source || overrideCount > 0) && <p className="tune-result">
          <i className="sw inline" style={{ background: settings.source }} /> → <i className="sw inline" style={{ background: effSource }} />
          <code>{effSource}</code>
          {overrideCount > 0 && <span> · {overrideCount}{" "}{t("Farbe")}{overrideCount > 1 ? "n" : ""}{" "}{t("überschrieben")}
            <button type="button" className="link" onClick={() => update({ overrides: undefined })}>{t("zurücksetzen")}</button></span>}
        </p>}
      </Field>

      <Field label={t("Palette")} hint={t("Die wichtigsten Farben dieser Variante.")}>
        <ul className="palette-peek" aria-label={t("Palette dieser Variante")}>
          {([[t("Primär"), pal.primary, pal.on_primary], [t("Sekundär"), pal.secondary, pal.on_secondary], [t("Tertiär"), pal.tertiary, pal.on_tertiary],
             [t("Fläche"), pal.surface, pal.on_surface], [t("Karte"), pal.surface_container_high, pal.on_surface], [t("Fehler"), pal.error, pal.on_error]] as [string, string, string][]).map(([n, bgc, fg]) => (
            <li key={n} style={{ background: bgc, color: fg }}><span>{n}</span><code>{bgc}</code></li>
          ))}
        </ul>
      </Field>
    </StepLayout>
  );
}
