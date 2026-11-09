import { useRef } from "react";
import { SCHEMES } from "../lib/color";
import { renderTemplate } from "../lib/exporters";
import { ompTemplate, p10kOverlay } from "../lib/prompt";
import { isTauri } from "../lib/platform";
import { vscodeTheme } from "../lib/vscode";
import type { Studio } from "../useStudio";
import { t } from "../lib/i18n";

export function ExportPane({ s }: { s: Studio }) {
  const tplInput = useRef<HTMLInputElement>(null);
  const { prompt, templates, addTemplates, deleteTemplate, settings, setShowApply, fonts, app, group, setGroup, image, pal, copy, saveFile, saveVsix, themeName, effSource, overrideCount, cmds, files, vsSettings } = s;
  return (
    <div className="pane export-pane">
        <section className="card summary">
          <span className="sum-strip">{[pal.primary, pal.secondary, pal.tertiary, pal.surface_container_high, pal.surface].map((x, i) => <i key={i} style={{ background: x }} />)}</span>
          <span><b>{themeName}</b><small>{SCHEMES[settings.scheme].label} · {settings.mode === "dark" ? t("dunkel") : t("hell")} · {effSource}{overrideCount ? t(" · {n} überschrieben", { n: overrideCount }) : ""}{fonts.mono ? ` · ${fonts.mono}` : ""}</small></span>
          <span className="grow" />
          {isTauri && <button type="button" className="primary" onClick={() => setShowApply(true)}>{t("Anwenden")}</button>}
        </section>
        <div className="export-grid">
          <div className="export-col">
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

        </section>
        <section className="card export">
          <h2>VS Code</h2>
          <ul className="files">
            <li>
              <span><b>{t("Erweiterung (.vsix)")}</b><small>{t("installieren: {cmd} oder Erweiterungen → … → „Aus VSIX installieren“", { cmd: "code --install-extension …vsix" })}</small></span>
              <button type="button" className="primary" onClick={saveVsix}>{t("Speichern")}</button>
            </li>
            <li>
              <span><b>settings.json</b><small>{fonts.mono ? t("Theme auswählen + Schrift „{font}“ für Editor und Terminal", { font: fonts.mono }) : t("Theme auswählen (Schrift bleibt)")}</small></span>
              <button type="button" className="ghost" onClick={() => copy(vsSettings)}>{t("Kopieren")}</button>
            </li>
            <li>
              <span><b>{t("Farbschema als JSON")}</b><small>{t("nur das VS-Code-Farbschema – für eigene Erweiterungen")}</small></span>
              <button type="button" className="ghost" onClick={() => copy(JSON.stringify(vscodeTheme(themeName, settings, pal), null, 2))}>{t("Kopieren")}</button>
              <button type="button" className="ghost" onClick={() => saveFile(`${themeName}.vscode-theme.json`, JSON.stringify(vscodeTheme(themeName, settings, pal), null, 2) + "\n")}>{t("Speichern")}</button>
            </li>
          </ul>

        </section>
        <section className="card export">
          <div className="detail-head">
            <h2>{t("Eigene Vorlagen")}<small>{t("deine Konfig-Dateien mit Platzhaltern wie {{colors.primary.default.hex}} – werden mit dem Theme ausgefüllt")}</small></h2>
            <span className="grow" />
            <button type="button" className="ghost" onClick={() => tplInput.current?.click()}>{t("Vorlage hinzufügen …")}</button>
            <input ref={tplInput} type="file" multiple hidden onChange={(e) => { void addTemplates([...(e.target.files ?? [])]); e.target.value = ""; }} />
          </div>
          {templates.length === 0
            ? <p className="empty">{t("Noch keine. Zum Beispiel eine alacritty.toml oder kitty.conf mit Platzhaltern – die fertigen Dateien erscheinen dann oben in der Liste.")}</p>
            : <ul className="files">{templates.map((tpl) => (
                <li key={tpl.id}><span><b><code>{tpl.name}</code></b><small>→ {tpl.output}</small></span>
                  <button type="button" className="ghost" onClick={() => deleteTemplate(tpl.id)} aria-label={t("{name} entfernen", { name: tpl.name })}>{t("Entfernen")}</button></li>
              ))}</ul>}
        </section>
          </div>
        <section className="card export files-card">
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
            {prompt.enabled && (group === "alle" || group === "linux") && (
              <li>
                <span><b>{t("Prompt: powerlevel10k")}</b><small>{t("nach ~/.config/theme-studio/p10k.zsh – deine .zshrc lädt sie nach ~/.p10k.zsh")}</small></span>
                <button type="button" className="ghost" onClick={() => copy(p10kOverlay(prompt))}>{t("Kopieren")}</button>
                <button type="button" className="ghost" onClick={() => saveFile("p10k.zsh", p10kOverlay(prompt))}>{t("Speichern")}</button>
              </li>
            )}
            {prompt.enabled && group !== "linux" && (
              <li>
                <span><b>{t("Prompt: oh-my-posh")}</b><small>{t("für jede Shell (PowerShell, bash, zsh, fish) – Farben als Platzhalter")}</small></span>
                <button type="button" className="ghost" onClick={() => copy(ompTemplate(prompt))}>{t("Kopieren")}</button>
                <button type="button" className="ghost" onClick={() => saveFile("ohmyposh.studio.json", ompTemplate(prompt))}>{t("Speichern")}</button>
              </li>
            )}
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
    </div>
  );
}
