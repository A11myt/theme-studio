// Einheitliches Gerüst für jeden Bereich: links die große Live-Vorschau, rechts die Einstellungen
// mit knappem Kopf (wo bin ich, was mache ich hier). Die Bereiche sind eigenständig – keine Reihenfolge.
import { useState, type ReactNode } from "react";
import { Monitor, SlidersHorizontal } from "lucide-react";
import type { Studio } from "../useStudio";
import { t } from "../lib/i18n";

type Tab = Studio["tab"];
export const STEPS = ["farbe", "schrift", "terminal", "vorschau", "export"] as const satisfies readonly Tab[];
type Step = (typeof STEPS)[number];
const LABEL: Record<Step, string> = { farbe: "Farbe", schrift: "Schrift", terminal: "Terminal", vorschau: "Vorschau", export: "Export" };

export function StepHead({ step, hint, aside }: { step: Step; hint: string; aside?: ReactNode }) {
  return (
    <header className="step-head">
      <div className="step-head-text">
        <h2 id={`step-${step}-title`}>{t(LABEL[step])}</h2>
        <p className="hint">{hint}</p>
      </div>
      {aside}
    </header>
  );
}

interface Props {
  step: Step;
  hint: string;
  preview: ReactNode;
  children: ReactNode;
}

export function StepLayout({ step, hint, preview, children }: Props) {
  const [previewOpen, setPreviewOpen] = useState(false);
  return (
    <div className="pane step-pane" data-preview={previewOpen}>
      <div className="workspace-switch" role="group" aria-label={t('Ansicht')}>
        <button type="button" aria-pressed={!previewOpen} onClick={() => setPreviewOpen(false)}><SlidersHorizontal size={16} aria-hidden="true" />{t('Bearbeiten')}</button>
        <button type="button" aria-pressed={previewOpen} onClick={() => setPreviewOpen(true)}><Monitor size={16} aria-hidden="true" />{t('Live-Vorschau')}</button>
      </div>
      <section className="card stage" aria-label={t("Live-Vorschau")}>{preview}</section>
      <aside className="card inspector" aria-labelledby={`step-${step}-title`}>
        <StepHead step={step} hint={hint} />
        <div className="inspector-body">{children}</div>
      </aside>
    </div>
  );
}

/** Ein Einstellungsblock mit Titel, optionalem Wert rechts und kurzer Erklärung. */
export function Field({ label, value, hint, children }: { label: ReactNode; value?: ReactNode; hint?: string; children: ReactNode }) {
  return (
    <section className="field">
      <div className="field-head">
        <h3>{label}</h3>
        {value}
      </div>
      {hint && <p className="field-hint">{hint}</p>}
      {children}
    </section>
  );
}
