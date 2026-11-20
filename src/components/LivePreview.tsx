// Große Live-Vorschau für jeden Schritt: Desktop, Terminal oder Programme – jede Änderung sofort sichtbar.
import { useState, type DragEvent, type ReactNode } from "react";
import { AppWindow, Monitor, SquareTerminal } from "lucide-react";
import { AppPreviews } from "./AppPreviews";
import { Desktop } from "./Desktop";
import { OsToggle } from "./OsToggle";
import { TerminalPreview } from "./TerminalPreview";
import { SCHEMES } from "../lib/color";
import type { Studio } from "../useStudio";
import { t } from "../lib/i18n";

export type PreviewView = "desktop" | "terminal" | "apps";

interface Props {
  s: Studio;
  initial: PreviewView;
  /** Zusätzliche Knöpfe rechts im Kopf (z. B. passende Wallpaper suchen). */
  actions?: ReactNode;
  /** Hinweis zwischen Kopf und Vorschau (z. B. „noch kein Wallpaper“). */
  notice?: ReactNode;
  /** Unter der Vorschau (z. B. Varianten-Leiste). */
  footer?: ReactNode;
  onDropFiles?: (files: File[]) => void;
}

export function LivePreview({ s, initial, actions, notice, footer, onDropFiles }: Props) {
  const { settings, os, setOs, onlyOs, fonts, prompt, pal, bg } = s;
  const [view, setView] = useState<PreviewView>(initial);
  const [over, setOver] = useState(false);
  const views: [PreviewView, typeof Monitor, string][] = [
    ["desktop", Monitor, t("Desktop")],
    ["terminal", SquareTerminal, t("Terminal")],
    ["apps", AppWindow, t("Programme")],
  ];

  const drop = onDropFiles && {
    onDragOver: (e: DragEvent) => { e.preventDefault(); setOver(true); },
    onDragLeave: () => setOver(false),
    onDrop: (e: DragEvent) => {
      e.preventDefault(); setOver(false);
      const f = [...e.dataTransfer.files].filter((x) => x.type.startsWith("image/"));
      if (f.length) onDropFiles(f);
    },
  };

  return (
    <>
      <header className="canvas-heading"><div><span className="eyebrow"><i aria-hidden="true" />{t('Live-Vorschau')}</span><h2>{s.name.trim() || SCHEMES[settings.scheme].label}</h2></div><span className="canvas-meta">{settings.mode === 'dark' ? t('Dunkel') : t('Hell')}<i aria-hidden="true" />{s.effSource.toUpperCase()}</span></header>
      <div className="stage-head">
        <div className="seg" role="group" aria-label={t("Vorschau-Ansicht")}>
          {views.map(([v, Icon, label]) => (
            <button key={v} type="button" aria-pressed={view === v} onClick={() => setView(v)}>
              <Icon size={15} aria-hidden="true" />{label}
            </button>
          ))}
        </div>
        <p className="stage-title">
          <b>{SCHEMES[settings.scheme].label}</b>
          <span>{settings.mode === "dark" ? t("dunkel") : t("hell")}</span>
        </p>
        <span className="grow" />
        {actions}
        {view === "desktop" && !onlyOs && <OsToggle os={os} onChange={setOs} />}
      </div>
      {notice}
      <div className={`stage-view stage-${view} ${over ? "over" : ""}`} {...drop}>
        {view === "desktop" && <Desktop c={pal} os={onlyOs ?? os} image={bg} size="large" fonts={fonts} />}
        {view === "terminal" && <TerminalPreview c={pal} t={settings} fonts={fonts} prompt={prompt.enabled ? prompt : undefined} os={onlyOs} />}
        {view === "apps" && <AppPreviews c={pal} fonts={fonts} />}
      </div>
      {footer}
    </>
  );
}
