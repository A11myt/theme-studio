import { Wand2 } from "lucide-react";
import { LivePreview } from "../components/LivePreview";
import { ShellPicker } from "../components/ShellPicker";
import { Field, StepLayout } from "../components/StepLayout";
import { RIGHT_LABELS } from "../lib/prompt";
import type { Studio } from "../useStudio";
import { t } from "../lib/i18n";

export function TerminalPane({ s }: { s: Studio }) {
  const { prompt, setPrompt, setShowWizard } = s;
  return (
    <StepLayout s={s} step="terminal"
      hint={t("Optional: ein eigener Prompt, passend zum Theme eingefärbt.")}
      preview={<LivePreview s={s} initial="terminal" />}>

      <Field label={t("Prompt")} hint={prompt.enabled
        ? s.onlyOs === "windows"
          ? t("Beim „Anwenden“ wird dieser Prompt in den gewählten Shells eingebunden (oh-my-posh). Farben kommen aus dem Theme.")
          : t("Beim „Anwenden“ wird dieser Prompt in den gewählten Shells eingebunden (oh-my-posh, bei zsh wahlweise powerlevel10k). Farben kommen aus dem Theme.")
        : t("Aus: dein bisheriger Prompt bleibt. Beim „Anwenden“ wird ein früher gesetzter Studio-Prompt wieder entfernt.")}>
        <label className="switch">
          <input type="checkbox" role="switch" checked={prompt.enabled} onChange={(e) => setPrompt({ ...prompt, enabled: e.target.checked })} />
          <span>{t("Eigenen Prompt aus dem Studio verwenden")}</span>
        </label>
        <button type="button" className="ghost block" onClick={() => setShowWizard(true)}>
          <Wand2 size={15} aria-hidden="true" />{t("Prompt-Assistent …")}
        </button>
      </Field>

      {prompt.enabled && (
        <Field label={t("Aussehen")} hint={t("Zum Ändern auf einen Punkt klicken.")}>
          <div className="prompt-summary" role="group" aria-label={t("Aussehen")}>
            <button type="button" className="chip" title={t("Ändern")} onClick={() => setShowWizard("style")}>{{ lean: "Lean", classic: "Classic", rainbow: "Rainbow", pure: "Pure" }[prompt.style]}</button>
            <button type="button" className="chip" title={t("Ändern")} onClick={() => setShowWizard("lines")}>{prompt.lines === 1 ? t("1 Zeile") : prompt.frame ? t("2 Zeilen mit Rahmen") : t("2 Zeilen")}</button>
            <button type="button" className="chip" title={t("Ändern")} onClick={() => setShowWizard("icons")}>{prompt.icons ? t("Symbole an") : t("Symbole aus")}</button>
            <button type="button" className="chip" title={t("Ändern")} onClick={() => setShowWizard("char")}>{t("Zeichen {c}", { c: prompt.char })}</button>
            <button type="button" className="chip" title={t("Ändern")} onClick={() => setShowWizard("right")}>{t("rechts: {list}", { list: prompt.right.map((r) => t(RIGHT_LABELS[r])).join(", ") || t("nichts") })}</button>
            <button type="button" className="chip" title={t("Ändern")} onClick={() => setShowWizard("transient")}>{prompt.transient ? t("zusammenfalten") : t("nicht zusammenfalten")}</button>
          </div>
        </Field>
      )}

      <ShellPicker prompt={prompt} onChange={setPrompt} />
    </StepLayout>
  );
}
