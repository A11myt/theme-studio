import { FontPanel } from "../components/FontPanel";
import { LivePreview } from "../components/LivePreview";
import { StepLayout } from "../components/StepLayout";
import type { Studio } from "../useStudio";
import { t } from "../lib/i18n";

export function SchriftPane({ s }: { s: Studio }) {
  const { fonts, setFonts, fontsKey, setFontsKey } = s;
  return (
    <StepLayout step="schrift"
      hint={t("Schriften für Terminal, Oberfläche und Akzente. Leer lassen = bleibt, wie es ist.")}
      preview={<LivePreview s={s} initial="terminal" />}>
      <FontPanel fonts={fonts} onChange={setFonts} refreshKey={fontsKey} onInstalled={() => setFontsKey((k) => k + 1)} />
    </StepLayout>
  );
}
