import { TerminalPreview } from "../components/TerminalPreview";
import { ShellPicker } from "../components/ShellPicker";
import { RIGHT_LABELS } from "../lib/prompt";
import type { Studio } from "../useStudio";
import { t } from "../lib/i18n";

export function TerminalPane({ s }: { s: Studio }) {
  const { settings, fonts, prompt, setPrompt, setShowWizard, setTab, pal } = s;
  return (
    <div className="pane">
          <section className="card terminal-pane">
            <div className="detail-head">
              <h2>{t("Prompt")}</h2>
              <label className="switch">
                <input type="checkbox" role="switch" checked={prompt.enabled} onChange={(e) => setPrompt({ ...prompt, enabled: e.target.checked })} />
                <span>{t("Eigenen Prompt aus dem Studio verwenden")}</span>
              </label>
              <span className="grow" />
              <button type="button" className="ghost" onClick={() => setShowWizard(true)}>{t("Prompt-Assistent …")}</button>
              <button type="button" className="primary" onClick={() => setTab("vorschau")}>{t("Weiter: Vorschau →")}</button>
            </div>
            <p className="empty">{prompt.enabled
              ? t("Beim „Anwenden“ wird dieser Prompt in den gewählten Shells eingebunden (oh-my-posh, bei zsh wahlweise powerlevel10k). Farben kommen aus dem Theme.")
              : t("Aus: dein bisheriger Prompt bleibt. Beim „Anwenden“ wird ein früher gesetzter Studio-Prompt wieder entfernt.")}</p>
            <ShellPicker prompt={prompt} onChange={setPrompt} />
            <TerminalPreview c={pal} t={settings} fonts={fonts} prompt={prompt.enabled ? prompt : undefined} />
            {prompt.enabled && (
              <div className="prompt-summary">
                <span className="chip">{{ lean: "Lean", classic: "Classic", rainbow: "Rainbow", pure: "Pure" }[prompt.style]}</span>
                <span className="chip">{prompt.lines === 1 ? t("1 Zeile") : prompt.frame ? t("2 Zeilen mit Rahmen") : t("2 Zeilen")}</span>
                <span className="chip">{prompt.icons ? t("Symbole an") : t("Symbole aus")}</span>
                <span className="chip">{t("Zeichen {c}", { c: prompt.char })}</span>
                <span className="chip">{t("rechts: {list}", { list: prompt.right.map((r) => t(RIGHT_LABELS[r])).join(", ") || t("nichts") })}</span>
                <span className="chip">{prompt.transient ? t("zusammenfalten") : t("nicht zusammenfalten")}</span>
              </div>
            )}
          </section>
    </div>
  );
}
