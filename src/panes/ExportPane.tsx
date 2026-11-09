import { SCHEMES } from "../lib/color";
import { renderTemplate } from "../lib/exporters";
import { isTauri } from "../lib/platform";
import { vscodeTheme } from "../lib/vscode";
import type { Studio } from "../useStudio";
import { t } from "../lib/i18n";

export function ExportPane({ s }: { s: Studio }) {
  const { templates, settings, setShowApply, fonts, app, setTab, group, setGroup, image, pal, copy, saveFile, saveVsix, themeName, effSource, overrideCount, cmds, files, vsSettings, shareTheme } = s;
  return (
    <div className="pane">
        <section className="card summary">
          <span className="sum-strip">{[pal.primary, pal.secondary, pal.tertiary, pal.surface_container_high, pal.surface].map((x, i) => <i key={i} style={{ background: x }} />)}</span>
          <span><b>{themeName}</b><small>{SCHEMES[settings.scheme].label} · {settings.mode === "dark" ? t("dunkel") : t("hell")} · {effSource}{overrideCount ? t(" · {n} überschrieben", { n: overrideCount }) : ""} · {fonts.mono}</small></span>
          <span className="grow" />
          <button type="button" className="ghost" onClick={() => setTab("farbe")}>{t("Farbe ändern")}</button>
          <button type="button" className="ghost" onClick={() => setTab("schrift")}>{t("Schrift ändern")}</button>
          <button type="button" className="ghost" onClick={() => shareTheme(themeName, settings, fonts)} title={t("Link mit diesem Theme kopieren")}>{t("Link teilen")}</button>
          {isTauri && <button type="button" className="primary" onClick={() => setShowApply(true)}>{t("Anwenden")}</button>}
        </section>
        <section className="card export" id="export">
          <h2>{t("Anwenden")}</h2>
          <div className="cmd">
            <span>Windows</span>
            <p className="cmd-note">{isTauri
              ? t("Oben rechts auf „Anwenden“ – die App richtet alles selbst ein (Akzent, Wallpaper, Terminal, VS Code, Prompt, komorebi).")
              : t("In der Desktop-App: „Anwenden“ richtet alles selbst ein. Hier im Browser: Dateien unten speichern.")}</p>
          </div>
          <div className="cmd">
            <span>Linux</span><code>{cmds.linux}</code>
            <button type="button" className="ghost" onClick={() => copy(cmds.linux)}>{t("Kopieren")}</button>
          </div>

          <h2>VS Code</h2>
          <ul className="files">
            <li>
              <span><b>{t("Erweiterung (.vsix)")}</b><small>{t("installieren: {cmd} oder Erweiterungen → … → „Aus VSIX installieren“", { cmd: "code --install-extension …vsix" })}</small></span>
              <button type="button" className="primary" onClick={saveVsix}>{t("Speichern")}</button>
            </li>
            <li>
              <span><b>settings.json</b><small>{t("Theme auswählen + Schrift „{font}“ für Editor und Terminal", { font: fonts.mono })}</small></span>
              <button type="button" className="ghost" onClick={() => copy(vsSettings)}>{t("Kopieren")}</button>
            </li>
            <li>
              <span><b>{t("Farbschema als JSON")}</b><small>{t("nur das VS-Code-Farbschema – für eigene Erweiterungen")}</small></span>
              <button type="button" className="ghost" onClick={() => copy(JSON.stringify(vscodeTheme(themeName, settings, pal), null, 2))}>{t("Kopieren")}</button>
              <button type="button" className="ghost" onClick={() => saveFile(`${themeName}.vscode-theme.json`, JSON.stringify(vscodeTheme(themeName, settings, pal), null, 2) + "\n")}>{t("Speichern")}</button>
            </li>
          </ul>

          <div className="detail-head">
            <h2>{t("Dateien")}{" "}{isTauri && app.exportDir && !app.askOnSave && <small>→ {app.exportDir}</small>}</h2>
            <span className="grow" />
            <div className="seg" role="group" aria-label={t("Dateien filtern")}>
              {(["alle", "windows", "linux", "allgemein"] as const).map((g) => (
                <button key={g} type="button" aria-pressed={group === g} onClick={() => setGroup(g)}>
                  {t({ alle: "Alle", windows: "Windows", linux: "Linux", allgemein: "Allgemein" }[g])}
                </button>
              ))}
            </div>
          </div>
          <ul className="files">
            {files.filter((f) => group === "alle" || f.group === group).map((f) => (
              <li key={f.id}>
                <span><b>{t(f.label)}</b><small>{t(f.hint, f.vars)}</small></span>
                <button type="button" className="ghost" onClick={() => copy(f.text)}>{t("Kopieren")}</button>
                <button type="button" className="ghost" onClick={() => saveFile(f.filename, f.text)}>{t("Speichern")}</button>
              </li>
            ))}
            {(group === "alle" || group === "linux") && templates.map((tpl) => {
              const out = () => renderTemplate(tpl.text, settings, image?.name, fonts);
              return (
                <li key={tpl.id}>
                  <span><b>{tpl.name}</b><small>{t("aus deiner Vorlage (Platzhalter für Farben und Schriften)")}</small></span>
                  <button type="button" className="ghost" onClick={() => copy(out())}>{t("Kopieren")}</button>
                  <button type="button" className="ghost" onClick={() => saveFile(tpl.output, out())}>{t("Speichern")}</button>
                </li>
              );
            })}
          </ul>
        </section>
    </div>
  );
}
