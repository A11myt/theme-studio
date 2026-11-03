import { Collection } from "../components/Collection";
import type { Studio } from "../useStudio";

export function SammlungPane({ s }: { s: Studio }) {
  const { themes, os, setTab, urls, openTheme, updateTheme, duplicateTheme, deleteTheme } = s;
  return (
    <div className="pane" role="tabpanel">
          <Collection themes={themes} urls={urls} os={os} onUpdate={updateTheme} onDuplicate={duplicateTheme} onDelete={deleteTheme}
            onOpen={(t) => { openTheme(t); setTab("farbe"); }} />
    </div>
  );
}
