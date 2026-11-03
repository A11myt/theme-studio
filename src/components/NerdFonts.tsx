// Nerd Fonts von GitHub: Liste des neuesten Releases, Suche, installieren auf Klick (nur App).
// Installiert werden nur Mono + Propo in Regular/Bold/Italic/BoldItalic – ins System-Schriftverzeichnis, nicht ins Projekt.
import { useEffect, useMemo, useRef, useState } from "react";
import { useDialog } from "../lib/useDialog";
import { installNerdFont, nerdFonts, type NerdFont } from "../lib/platform";

interface Props {
  onClose: () => void;
  onInstalled: (family: string) => void;   // z. B. "Hack" → Familien „Hack Nerd Font Mono/Propo“
}

const mb = (b: number) => (b >= 1e9 ? `${(b / 1e9).toFixed(1)} GB` : `${Math.max(1, Math.round(b / 1e6))} MB`);

export function NerdFonts({ onClose, onInstalled }: Props) {
  const sheetRef = useRef<HTMLDivElement>(null);
  useDialog(sheetRef);
  const [list, setList] = useState<NerdFont[]>([]);
  const [q, setQ] = useState("");
  const [busy, setBusy] = useState<string>();
  const [done, setDone] = useState<Record<string, string>>({});
  const [error, setError] = useState("");

  // Liste einmal laden
  useEffect(() => { nerdFonts().then(setList).catch((e) => setError(String(e))); }, []);
  // Esc schließt (nicht während einer Installation)
  const busyRef = useRef(busy);
  busyRef.current = busy;
  const closeRef = useRef(onClose);
  closeRef.current = onClose;
  useEffect(() => {
    const esc = (e: KeyboardEvent) => e.key === "Escape" && !busyRef.current && closeRef.current();
    window.addEventListener("keydown", esc);
    return () => window.removeEventListener("keydown", esc);
  }, []);

  const shown = useMemo(() => list.filter((f) => f.name.toLowerCase().includes(q.toLowerCase())), [list, q]);

  const install = async (f: NerdFont) => {
    if (f.size > 150e6) {
      const { ask } = await import("@tauri-apps/plugin-dialog");
      if (!(await ask(`${f.name} ist ${mb(f.size)} groß (Download). Installiert werden davon nur 8 Dateien. Fortfahren?`, { title: "Nerd Fonts" }))) return;
    }
    setBusy(f.name);
    setError("");
    try {
      const r = await installNerdFont(f);
      setDone((d) => ({ ...d, [f.name]: `${r.files} Dateien installiert` }));
      onInstalled(f.name);
    } catch (e) {
      setError(`${f.name}: ${String(e)}`);
    } finally {
      setBusy(undefined);
    }
  };

  return (
    <div className="overlay" role="dialog" aria-modal="true" aria-label="Nerd Fonts" onClick={() => !busy && onClose()}>
      <div ref={sheetRef} tabIndex={-1} className="sheet" onClick={(e) => e.stopPropagation()}>
        <div className="wh-head">
          <h2>Nerd Fonts {list[0] && <small>{list[0].version}</small>}</h2>
          <input className="name grow" value={q} onChange={(e) => setQ(e.target.value)} placeholder="Suchen, z. B. Hack, JetBrains, Fira …" aria-label="Schrift suchen" autoFocus />
          <button type="button" className="ghost" onClick={onClose} disabled={!!busy} aria-label="Schließen">✕</button>
        </div>
        {error && <p className="error">{error}</p>}
        <ul className="nf-list">
          {!list.length && !error && <li className="empty">lädt Liste von GitHub …</li>}
          {shown.map((f) => (
            <li key={f.name}>
              <span><b>{f.name}</b><small>{mb(f.size)} Download</small></span>
              {done[f.name]
                ? <small className="ok">✓ {done[f.name]}</small>
                : <button type="button" className="ghost" disabled={!!busy} onClick={() => install(f)}>
                    {busy === f.name ? "installiert …" : "Installieren"}
                  </button>}
            </li>
          ))}
        </ul>
        <div className="wh-foot">
          <small className="empty">Installiert nur Mono + Propo (Regular, Bold, Italic, Bold Italic) in deinen Benutzer-Schriftordner · ryanoasis/nerd-fonts</small>
        </div>
      </div>
    </div>
  );
}
