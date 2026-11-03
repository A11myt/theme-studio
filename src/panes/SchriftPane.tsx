import { Desktop } from "../components/Desktop";
import { FontPanel } from "../components/FontPanel";
import { TerminalPreview } from "../components/TerminalPreview";
import type { Studio } from "../useStudio";

export function SchriftPane({ s }: { s: Studio }) {
  const { settings, os, fonts, setFonts, setShowNerd, fontsKey, prompt, setTab, pal, bg } = s;
  return (
    <div className="pane schrift-pane">
          <FontPanel fonts={fonts} onChange={setFonts} onNerdFonts={() => setShowNerd(true)} refreshKey={fontsKey} />
          <aside className="card mini-preview">
            <h3>So sieht es aus</h3>
            <Desktop c={pal} os={os} image={bg} size="large" fonts={fonts} />
            <TerminalPreview c={pal} t={settings} fonts={fonts} prompt={prompt.enabled ? prompt : undefined} />
          </aside>
          <div className="pane-foot"><button type="button" className="primary" onClick={() => setTab("terminal")}>Weiter: Terminal →</button></div>
    </div>
  );
}
