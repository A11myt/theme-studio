import { OsToggle } from "../components/OsToggle";
import { Desktop } from "../components/Desktop";
import { FontPanel } from "../components/FontPanel";
import { TerminalPreview } from "../components/TerminalPreview";
import type { Studio } from "../useStudio";
import { t } from "../lib/i18n";

export function SchriftPane({ s }: { s: Studio }) {
  const { settings, os, setOs, fonts, setFonts, setShowNerd, fontsKey, prompt, setTab, pal, bg } = s;
  return (
    <div className="pane schrift-pane">
          <FontPanel fonts={fonts} onChange={setFonts} onNerdFonts={() => setShowNerd(true)} refreshKey={fontsKey} />
          <aside className="card mini-preview">
            <div className="section-head"><h3>{t("So sieht es aus")}</h3><OsToggle os={os} onChange={setOs} /></div>
            <Desktop c={pal} os={os} image={bg} size="large" fonts={fonts} />
            <TerminalPreview c={pal} t={settings} fonts={fonts} prompt={prompt.enabled ? prompt : undefined} />
          </aside>
          <div className="pane-foot"><button type="button" className="primary" onClick={() => setTab("terminal")}>{t("Weiter: Terminal →")}</button></div>
    </div>
  );
}
