import { AppPreviews } from "../components/AppPreviews";
import { Desktop } from "../components/Desktop";
import { Readability } from "../components/Readability";
import { TerminalPreview } from "../components/TerminalPreview";
import { onColor, palette, SCHEMES, type Mode } from "../lib/color";
import { grade, PARTNER, ratio } from "../lib/contrast";
import { PALETTE_GROUPS, type Studio } from "../useStudio";

export function VorschauPane({ s }: { s: Studio }) {
  const { settings, os, editRole, setEditRole, fonts, bothModes, setBothModes, prompt, setTab, pal, copy, setOverride, bg } = s;
  return (
    <div className="pane" role="tabpanel">
        <section className="card detail" id="vorschau">
          <div className="detail-head">
            <h2>Vorschau <small>{SCHEMES[settings.scheme].label} · {settings.mode === "dark" ? "dunkel" : "hell"}</small></h2>
            <span className="grow" />
            <label className="check"><input type="checkbox" checked={bothModes} onChange={(e) => setBothModes(e.target.checked)} /> Hell und dunkel nebeneinander</label>
          </div>
          {bothModes ? (
            <div className="big">
              {(["light", "dark"] as Mode[]).map((m) => (
                <Desktop key={m} c={palette({ ...settings, mode: m })} os={os} image={bg} size="large" fonts={fonts} />
              ))}
            </div>
          ) : (
            <div className="big">
              <Desktop c={pal} os="linux" image={bg} size="large" fonts={fonts} />
              <Desktop c={pal} os="windows" image={bg} size="large" fonts={fonts} />
            </div>
          )}
          <div className="split">
            <TerminalPreview c={pal} t={settings} fonts={fonts} prompt={prompt.enabled ? prompt : undefined} />
            <Readability c={pal} />
          </div>
          <h3>Programme</h3>
          <AppPreviews c={pal} fonts={fonts} />
          {editRole && (() => {
            const cur = (pal as Record<string, string>)[editRole];
            const orig = (palette({ ...settings, overrides: undefined }) as Record<string, string>)[editRole];
            const partner = PARTNER[editRole] ? (pal as Record<string, string>)[PARTNER[editRole]] : undefined;
            return (
              <div className="role-editor">
                <b>{editRole.replace(/_/g, " ")}</b>
                <input type="color" value={cur} onChange={(e) => setOverride(editRole, e.target.value)} aria-label="Farbe wählen" />
                <code>{cur}</code>
                {settings.overrides?.[editRole] && <small className="empty">vorher <i className="sw inline" style={{ background: orig }} /> {orig}</small>}
                {partner && <span className={`badge ${grade(ratio(cur, partner))}`}>Kontrast {ratio(cur, partner).toFixed(1)}</span>}
                <span className="grow" />
                <button type="button" className="ghost" onClick={() => copy(cur)}>Kopieren</button>
                {settings.overrides?.[editRole] && <button type="button" className="ghost" onClick={() => setOverride(editRole, undefined)}>Zurücksetzen</button>}
                <button type="button" className="ghost" onClick={() => setEditRole(undefined)} aria-label="Schließen">✕</button>
              </div>
            );
          })()}
          <div className="palette">
            {PALETTE_GROUPS.map(([title, roles]) => (
              <div key={title}>
                <h3>{title}</h3>
                <div className="swatches">
                  {roles.map((r) => {
                    const hex = (pal as Record<string, string>)[r];
                    const partner = PARTNER[r] ? (pal as Record<string, string>)[PARTNER[r]] : undefined;
                    const cr = partner ? ratio(hex, partner) : 0;
                    return (
                      <button key={r} type="button" className={`swatch ${editRole === r ? "editing" : ""}`} style={{ background: hex, color: partner ?? onColor(hex) }}
                        onClick={() => setEditRole(editRole === r ? undefined : r)} aria-pressed={editRole === r}
                        title={`Klicken zum Bearbeiten${partner ? ` · Kontrast zu ${PARTNER[r].replace(/_/g, " ")}: ${cr.toFixed(1)}` : ""}`}>
                        <span>{settings.overrides?.[r] ? "✎ " : ""}{r.replace(/_/g, " ")}</span>
                        <code>{hex}{partner && <b className={`dot ${grade(cr)}`} />}</code>
                      </button>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>
        </section>
        <div className="pane-foot"><button type="button" className="primary" onClick={() => setTab("export")}>Weiter: Exportieren →</button></div>
    </div>
  );
}
