// Schrift wählen: installierte Schriften und Nerd Fonts in einer Liste. Eine Nerd Font, die noch fehlt,
// wird beim Auswählen direkt installiert (nur App). „Standard“ = leer → die Schrift bleibt, wie sie ist.
import { useEffect, useMemo, useRef, useState } from "react";
import { useDialog } from "../lib/useDialog";
import { cssFont } from "../lib/fonts";
import { errText, installNerdFont, isTauri, nerdFonts, type NerdFont } from "../lib/platform";
import { t } from "../lib/i18n";

interface Props {
  role: "ui" | "mono" | "accent";
  title: string;
  installed: string[];
  onPick: (family: string) => void;          // "" = Standard
  onInstalled: () => void;                   // Liste der installierten Schriften neu laden
  onClose: () => void;
}

const mb = (b: number) => `${Math.max(1, Math.round(b / 1e6))} MB`;
/** Nerd Font → Familienname, den Programme sehen (Mono für Terminal/Code, Propo für Oberfläche). */
export const nerdFamily = (name: string, role: Props["role"]) => `${name} Nerd Font ${role === "mono" ? "Mono" : "Propo"}`;

export function FontPicker({ role, title, installed, onPick, onInstalled, onClose }: Props) {
  const sheet = useRef<HTMLDivElement>(null);
  useDialog(sheet);
  const [q, setQ] = useState("");
  const [nerd, setNerd] = useState<NerdFont[]>([]);
  const [busy, setBusy] = useState<string>();
  const [error, setError] = useState("");
  const have = useMemo(() => new Set(installed), [installed]);

  useEffect(() => { if (isTauri) nerdFonts().then(setNerd).catch((e) => setError(errText(e))); }, []);
  useEffect(() => {
    const esc = (e: KeyboardEvent) => e.key === "Escape" && !busy && onClose();
    window.addEventListener("keydown", esc);
    return () => window.removeEventListener("keydown", esc);
  }, [busy, onClose]);

  const needle = q.trim().toLowerCase();
  const local = installed.filter((f) => f.toLowerCase().includes(needle)).slice(0, 200);
  const remote = nerd.filter((n) => n.name.toLowerCase().includes(needle) && !have.has(nerdFamily(n.name, role)));

  const pickNerd = async (n: NerdFont) => {
    setBusy(n.name);
    setError("");
    try {
      await installNerdFont(n);
      onInstalled();
      onPick(nerdFamily(n.name, role));
      onClose();
    } catch (e) {
      setError(t("{name}: {e}", { name: n.name, e: errText(e) }));
    } finally {
      setBusy(undefined);
    }
  };

  return (
    <div className="overlay" role="dialog" aria-modal="true" aria-label={title} onClick={() => !busy && onClose()}>
      <div ref={sheet} tabIndex={-1} className="sheet font-picker" onClick={(e) => e.stopPropagation()}>
        <div className="wh-head">
          <h2>{title}</h2>
          <input className="name grow" autoFocus value={q} onChange={(e) => setQ(e.target.value)} placeholder={t("Schrift suchen …")} aria-label={t("Schrift suchen")} />
          <button type="button" className="ghost icon" onClick={onClose} disabled={!!busy} aria-label={t("Schließen")}>✕</button>
        </div>
        <div className="fp-body">
          {error && <p className="error">{error}</p>}
          <button type="button" className="fp-item fp-default" onClick={() => { onPick(""); onClose(); }}>
            <span><b>{t("Standardschrift")}</b><small>{t("nichts ändern – die Programme behalten ihre Schrift")}</small></span>
          </button>
          {needle && !installed.some((f) => f.toLowerCase() === needle) && (
            <button type="button" className="fp-item" onClick={() => { onPick(q.trim()); onClose(); }}>
              <span><b>{t("„{name}“ verwenden", { name: q.trim() })}</b><small>{t("eigener Name – muss auf dem Rechner installiert sein")}</small></span>
            </button>
          )}
          {local.length > 0 && <h3>{t("Installiert")}</h3>}
          <ul className="fp-list">
            {local.map((f) => (
              <li key={f}><button type="button" className="fp-item" onClick={() => { onPick(f); onClose(); }}>
                <span style={{ fontFamily: cssFont(f, "inherit") }}>{f}</span>
              </button></li>
            ))}
          </ul>
          {isTauri && <h3>{t("Nerd Fonts – werden beim Auswählen installiert")}</h3>}
          {isTauri && !nerd.length && !error && <p className="empty">{t("lädt Liste von GitHub …")}</p>}
          <ul className="fp-list">
            {remote.map((n) => (
              <li key={n.name}><button type="button" className="fp-item" disabled={!!busy} onClick={() => void pickNerd(n)}>
                <span><b>{n.name}</b><small>{nerdFamily(n.name, role)}</small></span>
                <small className="fp-meta">{busy === n.name ? t("wird installiert …") : `${t("installieren")} · ${mb(n.size)}`}</small>
              </button></li>
            ))}
          </ul>
          {!isTauri && <p className="empty">{t("Nerd Fonts installieren geht in der Desktop-App. Hier: Namen einer installierten Schrift suchen.")}</p>}
        </div>
      </div>
    </div>
  );
}
