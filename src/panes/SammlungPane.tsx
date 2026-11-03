import { Collection } from "../components/Collection";
import { DEFAULT_FONTS } from "../lib/fonts";
import type { Studio } from "../useStudio";

export function SammlungPane({ s }: { s: Studio }) {
  const { themes, os, setTab, urls, openTheme, updateTheme, duplicateTheme, deleteTheme, shareTheme } = s;
  return (
    <div className="pane">
          <Collection themes={themes} urls={urls} os={os} onUpdate={updateTheme} onDuplicate={duplicateTheme} onDelete={deleteTheme} onShare={(t) => shareTheme(t.name, t.settings, t.fonts ?? DEFAULT_FONTS)}
            onOpen={(t) => { openTheme(t); setTab("farbe"); }} />
    </div>
  );
}
