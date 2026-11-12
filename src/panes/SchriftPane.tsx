import { FontPanel } from "../components/FontPanel";
import { TerminalPreview } from "../components/TerminalPreview";
import type { Studio } from "../useStudio";
import { t } from "../lib/i18n";

export function SchriftPane({ s }: { s: Studio }) {
  const { settings, fonts, setFonts, fontsKey, setFontsKey, prompt, setTab, pal } = s;
  return (
    <div className="pane schrift-pane">
      <FontPanel fonts={fonts} onChange={setFonts} refreshKey={fontsKey} onInstalled={() => setFontsKey((k) => k + 1)} />
      <aside className="card mini-preview">
        <div className="section-head"><h3>{t("So sieht es im Terminal aus")}</h3>
          <button type="button" className="primary" onClick={() => setTab("terminal")}>{t("Weiter: Terminal →")}</button></div>
        <TerminalPreview c={pal} t={settings} fonts={fonts} prompt={prompt.enabled ? prompt : undefined} os={s.onlyOs} />
      </aside>
    </div>
  );
}
