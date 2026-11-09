import { Collection } from "../components/Collection";
import { DEFAULT_FONTS } from "../lib/fonts";
import type { Studio } from "../useStudio";
import { applyStoredTheme } from "../lib/background";
import { isTauri } from "../lib/platform";

export function SammlungPane({ s }: { s: Studio }) {
  const { themes, os, setTab, urls, openTheme, updateTheme, duplicateTheme, deleteTheme, shareTheme, system, fonts, prompt, flash } = s;
  return (
    <div className="pane">
          <Collection themes={themes} urls={urls} os={os} onUpdate={updateTheme} onDuplicate={duplicateTheme} onDelete={deleteTheme} onShare={(t) => shareTheme(t.name, t.settings, t.fonts ?? DEFAULT_FONTS)}
            onOpen={(t) => { openTheme(t); setTab("farbe"); }}
            onApply={isTauri && system === "windows" ? async (t) => { try { flash(await applyStoredTheme(t, { fonts, prompt }), 4000); } catch (e) { flash(String(e), 6000); } } : undefined} />
    </div>
  );
}
