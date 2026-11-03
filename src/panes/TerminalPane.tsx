import { TerminalPreview } from "../components/TerminalPreview";
import { ompTemplate, p10kOverlay, RIGHT_LABELS } from "../lib/prompt";
import type { Studio } from "../useStudio";

export function TerminalPane({ s }: { s: Studio }) {
  const { settings, fonts, prompt, setPrompt, setShowWizard, setTab, pal, copy, saveFile } = s;
  return (
    <div className="pane">
          <section className="card terminal-pane">
            <div className="detail-head">
              <h2>Prompt</h2>
              <label className="switch">
                <input type="checkbox" role="switch" checked={prompt.enabled} onChange={(e) => setPrompt({ ...prompt, enabled: e.target.checked })} />
                <span>Eigenen Prompt aus dem Studio verwenden</span>
              </label>
              <span className="grow" />
              <button type="button" className="primary" onClick={() => setShowWizard(true)}>Prompt-Assistent …</button>
            </div>
            <p className="empty">{prompt.enabled
              ? "Beim „Anwenden“ wird dieser Prompt gesetzt – Linux als Ergänzung zu ~/.p10k.zsh, Windows als oh-my-posh-Vorlage für wintheme. Farben folgen dem Wallpaper."
              : "Aus: dein bisheriger Prompt bleibt. Beim „Anwenden“ wird ein früher gesetzter Studio-Prompt wieder entfernt."}</p>
            <TerminalPreview c={pal} t={settings} fonts={fonts} prompt={prompt.enabled ? prompt : undefined} />
            {prompt.enabled && (
              <div className="prompt-summary">
                <span className="chip">{{ lean: "Lean", classic: "Classic", rainbow: "Rainbow", pure: "Pure" }[prompt.style]}</span>
                <span className="chip">{prompt.lines} Zeile{prompt.lines > 1 ? "n" : ""}{prompt.lines === 2 && prompt.frame ? " mit Rahmen" : ""}</span>
                <span className="chip">Symbole {prompt.icons ? "an" : "aus"}</span>
                <span className="chip">Zeichen {prompt.char}</span>
                <span className="chip">rechts: {prompt.right.map((r) => RIGHT_LABELS[r]).join(", ") || "nichts"}</span>
                <span className="chip">{prompt.transient ? "zusammenfalten" : "nicht zusammenfalten"}</span>
              </div>
            )}
          </section>
          {prompt.enabled && (
            <section className="card export">
              <h2>Prompt-Dateien</h2>
              <ul className="files">
                <li>
                  <span><b>powerlevel10k (Linux)</b><small>nach ~/.config/theme-studio/p10k.zsh – deine .zshrc lädt sie nach ~/.p10k.zsh</small></span>
                  <button type="button" className="ghost" onClick={() => copy(p10kOverlay(prompt))}>Kopieren</button>
                  <button type="button" className="ghost" onClick={() => saveFile("p10k.zsh", p10kOverlay(prompt))}>Speichern</button>
                </li>
                <li>
                  <span><b>oh-my-posh-Vorlage (Windows)</b><small>nach %APPDATA%\wintheme\ohmyposh.studio.json – wintheme färbt sie ein</small></span>
                  <button type="button" className="ghost" onClick={() => copy(ompTemplate(prompt))}>Kopieren</button>
                  <button type="button" className="ghost" onClick={() => saveFile("ohmyposh.studio.json", ompTemplate(prompt))}>Speichern</button>
                </li>
              </ul>
            </section>
          )}
          <div className="pane-foot"><button type="button" className="primary" onClick={() => setTab("vorschau")}>Weiter: Vorschau →</button></div>
    </div>
  );
}
