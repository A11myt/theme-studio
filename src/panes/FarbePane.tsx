import { Desktop } from "../components/Desktop";
import { hueName, onColor, palette, SCHEMES, type Mode, type SchemeName } from "../lib/color";
import { hasWallhaven } from "../lib/platform";
import { nearestWallhavenColor } from "../lib/wallhaven";
import type { Studio } from "../useStudio";

export function FarbePane({ s }: { s: Studio }) {
  const { settings, os, setWallhaven, fonts, setTab, image, update, tune, effSource, overrideCount, bg } = s;
  return (
    <div className="pane">
        <section className="card setup" id="farbe">
          <div className="hero">
            {bg ? <img src={bg} alt={image?.name} /> : <div className="noimg">Kein Bild – nur Farbe</div>}
            {hasWallhaven && <button type="button" className="ghost match" onClick={() => setWallhaven({ color: nearestWallhavenColor(effSource) })}
              title="wallhaven nach Bildern in der Ausgangsfarbe durchsuchen">
              <i className="sw inline" style={{ background: `#${nearestWallhavenColor(effSource)}` }} /> Passende Wallpaper suchen
            </button>}
          </div>
          <div className="controls">
            <h2>Ausgangsfarbe</h2>
            <div className="sources">
              {(image?.sources ?? []).map((s, i) => (
                <button key={s} type="button" className="source" aria-pressed={settings.source === s}
                  style={{ background: s, color: onColor(s) }} onClick={() => update({ source: s })}>
                  <b>{i + 1}</b><small>{hueName(s)}</small>
                </button>
              ))}
              <label className="source custom" title="Eigene Farbe">
                <input type="color" value={settings.source} onChange={(e) => update({ source: e.target.value })} />
                <small>eigene</small>
              </label>
            </div>
            <code className="hex">{settings.source}</code>
            {image && <small className="engine" title={image.engine === "matugen"
              ? "Mit matugens eigenem Rust-Code berechnet – exakt wie dein System"
              : "Näherung im Browser – kann leicht von matugen abweichen"}>
              {image.engine === "matugen" ? "· exakt wie matugen" : "· Näherung"}</small>}

            <h2>Modus</h2>
            <div className="seg">
              {(["dark", "light"] as Mode[]).map((m) => (
                <button key={m} type="button" aria-pressed={settings.mode === m} onClick={() => update({ mode: m })}>
                  {m === "dark" ? "Dunkel" : "Hell"}
                </button>
              ))}
            </div>

            <h2>Kontrast <code>{settings.contrast.toFixed(1)}</code></h2>
            <input type="range" min={-1} max={1} step={0.1} value={settings.contrast}
              onChange={(e) => update({ contrast: Number(e.target.value) })} aria-label="Kontrast" />

            <div className="tune">
              <h2>Feinjustieren
                {(tune.hue !== 0 || tune.chroma !== 1) && <button type="button" className="link" onClick={() => update({ tune: undefined })}>zurücksetzen</button>}
              </h2>
              <label>Farbton <code>{tune.hue > 0 ? "+" : ""}{tune.hue}°</code>
                <input type="range" min={-60} max={60} step={1} value={tune.hue}
                  onChange={(e) => update({ tune: { ...tune, hue: Number(e.target.value) } })} aria-label="Farbton verschieben" />
              </label>
              <label>Buntheit <code>{Math.round(tune.chroma * 100)} %</code>
                <input type="range" min={0.4} max={1.6} step={0.05} value={tune.chroma}
                  onChange={(e) => update({ tune: { ...tune, chroma: Number(e.target.value) } })} aria-label="Buntheit" />
              </label>
              <p className="tune-result">
                <i className="sw inline" style={{ background: settings.source }} /> → <i className="sw inline" style={{ background: effSource }} />
                <code>{effSource}</code>
                {overrideCount > 0 && <span> · {overrideCount} Farbe{overrideCount > 1 ? "n" : ""} überschrieben
                  <button type="button" className="link" onClick={() => update({ overrides: undefined })}>zurücksetzen</button></span>}
              </p>
            </div>
          </div>
        </section>


        {/* Alle Varianten nebeneinander */}
        <section id="varianten">
          <h2 className="section-title">Varianten <small>anklicken oder Taste 1–9</small></h2>
          <div className="variants">
            {(Object.keys(SCHEMES) as SchemeName[]).map((k) => {
              const c = palette({ ...settings, scheme: k });
              return (
                <button key={k} type="button" className="variant" aria-pressed={settings.scheme === k} onClick={() => update({ scheme: k })}>
                  <Desktop c={c} os={os} image={bg} fonts={fonts} />
                  <span className="vname"><kbd>{(Object.keys(SCHEMES) as SchemeName[]).indexOf(k) + 1}</kbd>{SCHEMES[k].label}<small>{SCHEMES[k].hint}</small></span>
                  <span className="strip">{[c.primary, c.secondary, c.tertiary, c.surface_container_high].map((x, i) => <i key={i} style={{ background: x }} />)}</span>
                </button>
              );
            })}
          </div>
        </section>
        <div className="pane-foot"><button type="button" className="primary" onClick={() => setTab("schrift")}>Weiter: Schrift →</button></div>
    </div>
  );
}
