import { SCHEMES } from "../lib/color";
import { renderTemplate } from "../lib/exporters";
import { isTauri } from "../lib/platform";
import { vscodeTheme } from "../lib/vscode";
import type { Studio } from "../useStudio";

export function ExportPane({ s }: { s: Studio }) {
  const { templates, settings, setShowApply, fonts, app, setTab, group, setGroup, image, pal, copy, saveFile, saveVsix, themeName, effSource, overrideCount, cmds, files, vsSettings, shareTheme } = s;
  return (
    <div className="pane">
        <section className="card summary">
          <span className="sum-strip">{[pal.primary, pal.secondary, pal.tertiary, pal.surface_container_high, pal.surface].map((x, i) => <i key={i} style={{ background: x }} />)}</span>
          <span><b>{themeName}</b><small>{SCHEMES[settings.scheme].label} · {settings.mode === "dark" ? "dunkel" : "hell"} · {effSource}{overrideCount ? ` · ${overrideCount} überschrieben` : ""} · {fonts.mono}</small></span>
          <span className="grow" />
          <button type="button" className="ghost" onClick={() => setTab("farbe")}>Farbe ändern</button>
          <button type="button" className="ghost" onClick={() => setTab("schrift")}>Schrift ändern</button>
          <button type="button" className="ghost" onClick={() => shareTheme(themeName, settings, fonts)} title="Link mit diesem Theme kopieren">Link teilen</button>
          {isTauri && <button type="button" className="primary" onClick={() => setShowApply(true)}>Anwenden</button>}
        </section>
        <section className="card export" id="export">
          <h2>Anwenden</h2>
          <div className="cmd">
            <span>Windows</span><code>{cmds.windows}</code>
            <button type="button" className="ghost" onClick={() => copy(cmds.windows)}>Kopieren</button>
          </div>
          <div className="cmd">
            <span>Linux</span><code>{cmds.linux}</code>
            <button type="button" className="ghost" onClick={() => copy(cmds.linux)}>Kopieren</button>
          </div>

          <h2>VS Code</h2>
          <ul className="files">
            <li>
              <span><b>Erweiterung (.vsix)</b><small>installieren: <code>code --install-extension …vsix</code> oder Erweiterungen → … → „Aus VSIX installieren“</small></span>
              <button type="button" className="primary" onClick={saveVsix}>Speichern</button>
            </li>
            <li>
              <span><b>settings.json</b><small>Theme auswählen + Schrift „{fonts.mono}“ für Editor und Terminal</small></span>
              <button type="button" className="ghost" onClick={() => copy(vsSettings)}>Kopieren</button>
            </li>
            <li>
              <span><b>Theme-Datei</b><small>für eigene Erweiterungen oder zum Teilen</small></span>
              <button type="button" className="ghost" onClick={() => copy(JSON.stringify(vscodeTheme(themeName, settings, pal), null, 2))}>Kopieren</button>
              <button type="button" className="ghost" onClick={() => saveFile(`${themeName}.vscode-theme.json`, JSON.stringify(vscodeTheme(themeName, settings, pal), null, 2) + "\n")}>Speichern</button>
            </li>
          </ul>

          <div className="detail-head">
            <h2>Dateien {isTauri && app.exportDir && !app.askOnSave && <small>→ {app.exportDir}</small>}</h2>
            <span className="grow" />
            <div className="seg" role="group" aria-label="Dateien filtern">
              {(["alle", "windows", "linux", "allgemein"] as const).map((g) => (
                <button key={g} type="button" aria-pressed={group === g} onClick={() => setGroup(g)}>
                  {{ alle: "Alle", windows: "Windows", linux: "Linux", allgemein: "Allgemein" }[g]}
                </button>
              ))}
            </div>
          </div>
          <ul className="files">
            {files.filter((f) => group === "alle" || f.group === group).map((f) => (
              <li key={f.id}>
                <span><b>{f.label}</b><small>{f.hint}</small></span>
                <button type="button" className="ghost" onClick={() => copy(f.text)}>Kopieren</button>
                <button type="button" className="ghost" onClick={() => saveFile(f.filename, f.text)}>Speichern</button>
              </li>
            ))}
            {(group === "alle" || group === "linux") && templates.map((t) => {
              const out = () => renderTemplate(t.text, settings, image?.name, fonts);
              return (
                <li key={t.id}>
                  <span><b>{t.name}</b><small>aus deiner Vorlage (matugen-/fontgen-Platzhalter)</small></span>
                  <button type="button" className="ghost" onClick={() => copy(out())}>Kopieren</button>
                  <button type="button" className="ghost" onClick={() => saveFile(t.output, out())}>Speichern</button>
                </li>
              );
            })}
          </ul>
        </section>
    </div>
  );
}
