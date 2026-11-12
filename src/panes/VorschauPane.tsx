import { useState } from "react";
import { OsToggle } from "../components/OsToggle";

type View = "desktop" | "apps" | "palette";
import { AppPreviews } from "../components/AppPreviews";
import { Desktop, type Os } from "../components/Desktop";
import { Readability } from "../components/Readability";
import { TerminalPreview } from "../components/TerminalPreview";
import { onColor, palette, SCHEMES, type Mode } from "../lib/color";
import { grade, PARTNER, ratio } from "../lib/contrast";
import { PALETTE_GROUPS, type Studio } from "../useStudio";
import { t } from "../lib/i18n";

export function VorschauPane({ s }: { s: Studio }) {
  const { settings, os, setOs, onlyOs, editRole, setEditRole, fonts, bothModes, setBothModes, prompt, setTab, pal, copy, setOverride, bg } = s;
  const [view, setViewState] = useState<View>(() => { try { return (localStorage.getItem("theme-studio-preview") as View) || "desktop"; } catch { return "desktop"; } });
  const setView = (v: View) => { setViewState(v); try { localStorage.setItem("theme-studio-preview", v); } catch { /* egal */ } };
  return (
    <div className="pane vorschau-pane">
        <section className="card detail" id="vorschau">
          <div className="detail-head">
            <h2>{t("Vorschau")}{" "}<small>{SCHEMES[settings.scheme].label} · {settings.mode === "dark" ? t("dunkel") : t("hell")}</small></h2>
            <div className="seg" role="tablist" aria-label={t("Ansicht")}>
              {([["desktop", t("Desktop")], ["apps", t("Programme")], ["palette", t("Palette & Lesbarkeit")]] as [View, string][]).map(([v, l]) => (
                <button key={v} type="button" role="tab" aria-selected={view === v} aria-pressed={view === v} onClick={() => setView(v)}>{l}</button>
              ))}
            </div>
            <span className="grow" />
            {view === "desktop" && bothModes && !onlyOs && <OsToggle os={os} onChange={setOs} />}
            {view === "desktop" && <label className="check"><input type="checkbox" checked={bothModes} onChange={(e) => setBothModes(e.target.checked)} />{" "}{t("Hell und dunkel nebeneinander")}</label>}
            <button type="button" className="primary" onClick={() => setTab("export")}>{t("Weiter: Exportieren →")}</button>
          </div>
          <div className="view-body">
          {view === "desktop" && (bothModes ? (
            <div className="big">
              {(["light", "dark"] as Mode[]).map((m) => (
                <Desktop key={m} c={palette({ ...settings, mode: m })} os={onlyOs ?? os} image={bg} size="large" fonts={fonts} />
              ))}
            </div>
          ) : (
            <div className="big">
              {(onlyOs ? [onlyOs] : ["linux", "windows"] as Os[]).map((o) => <Desktop key={o} c={pal} os={o} image={bg} size="large" fonts={fonts} />)}
            </div>
          ))}
          {view === "apps" && (
            <div className="apps-view">
              <TerminalPreview c={pal} t={settings} fonts={fonts} prompt={prompt.enabled ? prompt : undefined} os={s.onlyOs} />
              <AppPreviews c={pal} fonts={fonts} />
            </div>
          )}
          {view === "palette" && (
          <div className="palette-view">
          <Readability c={pal} />
          <div>
          {editRole && (() => {
            const cur = (pal as Record<string, string>)[editRole];
            const orig = (palette({ ...settings, overrides: undefined }) as Record<string, string>)[editRole];
            const partner = PARTNER[editRole] ? (pal as Record<string, string>)[PARTNER[editRole]] : undefined;
            return (
              <div className="role-editor">
                <b>{editRole.replace(/_/g, " ")}</b>
                <input type="color" value={cur} onChange={(e) => setOverride(editRole, e.target.value)} aria-label={t("Farbe wählen")} />
                <code>{cur}</code>
                {settings.overrides?.[editRole] && <small className="empty">{t("vorher")}{" "}<i className="sw inline" style={{ background: orig }} /> {orig}</small>}
                {partner && <span className={`badge ${grade(ratio(cur, partner))}`}>{t("Kontrast")}{" "}{ratio(cur, partner).toFixed(1)}</span>}
                <span className="grow" />
                <button type="button" className="ghost" onClick={() => copy(cur)}>{t("Kopieren")}</button>
                {settings.overrides?.[editRole] && <button type="button" className="ghost" onClick={() => setOverride(editRole, undefined)}>{t("Zurücksetzen")}</button>}
                <button type="button" className="ghost" onClick={() => setEditRole(undefined)} aria-label={t("Schließen")}>✕</button>
              </div>
            );
          })()}
          <div className="palette">
            {PALETTE_GROUPS.map(([title, roles]) => (
              <div key={title}>
                <h3>{t(title)}</h3>
                <div className="swatches">
                  {roles.map((r) => {
                    const hex = (pal as Record<string, string>)[r];
                    const partner = PARTNER[r] ? (pal as Record<string, string>)[PARTNER[r]] : undefined;
                    const cr = partner ? ratio(hex, partner) : 0;
                    return (
                      <button key={r} type="button" className={`swatch ${editRole === r ? "editing" : ""}`} style={{ background: hex, color: partner ?? onColor(hex) }}
                        onClick={() => setEditRole(editRole === r ? undefined : r)} aria-pressed={editRole === r}
                        title={t("Klicken zum Bearbeiten") + (partner ? t(" · Kontrast zu {role}: {r}", { role: PARTNER[r].replace(/_/g, " "), r: cr.toFixed(1) }) : "")}>
                        <span>{settings.overrides?.[r] ? "✎ " : ""}{r.replace(/_/g, " ")}</span>
                        <code>{hex}{partner && <b className={`dot ${grade(cr)}`} />}</code>
                      </button>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>
          </div>
          </div>
          )}
          </div>
        </section>
    </div>
  );
}
