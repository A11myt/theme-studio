// Mini-Desktop in den Farben eines Themes: Hintergrundbild, Leiste, zwei gekachelte Fenster.
// „linux“ = Hyprland + Quickshell-Leiste (Bubbles), „windows“ = komorebi + komorebi-Leiste + Windows Terminal.
import type { CSSProperties } from "react";
import type { Palette } from "../lib/color";
import { cssFont, type Fonts } from "../lib/fonts";
import { t } from "../lib/i18n";

export type Os = "linux" | "windows";

interface Props {
  c: Palette;
  os: Os;
  image?: string;     // Objekt-URL des Wallpapers
  size?: "small" | "large";
  fonts?: Fonts;
}

export function Desktop({ c, os, image, size = "small", fonts }: Props) {
  const vars = {
    "--s": c.surface, "--sc": c.surface_container, "--sch": c.surface_container_high,
    "--p": c.primary, "--op": c.on_primary, "--t": c.tertiary, "--sec": c.secondary,
    "--os": c.on_surface, "--osv": c.on_surface_variant, "--ov": c.outline_variant, "--err": c.error,
    backgroundImage: image ? `url(${image})` : undefined,
    "--font-ui": fonts ? cssFont(fonts.ui, "var(--sans)") : "var(--mono)",
    "--font-mono": fonts ? cssFont(fonts.mono, "monospace") : "var(--mono)",
  } as CSSProperties;

  return (
    <div className={`desk desk-${os} desk-${size}`} style={vars} role="img"
      aria-label={t("{os}-Vorschau, Akzent {c}", { os: os === "linux" ? "Linux" : "Windows", c: c.primary })}>
      {os === "linux" ? <LinuxBar /> : <WindowsBar />}
      <div className="tiles">
        <div className="win focused">
          {os === "windows" && <div className="tabs"><span className="tab on">pwsh</span><span className="tab">+</span></div>}
          <div className="term">
            <span className="l1">{os === "linux" ? "╭─ ~/dotfiles  main" : "╭─ ~\\dotfiles  main"}</span>
            <span className="l2">╰─❯ <b>{t("wallthemes")}</b> ✓</span>
            <span className="l3">{t("3 Dateien eingefärbt")}</span>
          </div>
          <span className="btn">{t("Öffnen")}</span>
        </div>
        <div className="win">
          <div className="lines"><i style={{ width: "70%" }} /><i style={{ width: "45%" }} /><i style={{ width: "60%" }} /></div>
        </div>
      </div>
    </div>
  );
}

function LinuxBar() {
  return (
    <div className="bar">
      <span className="pill">10:24</span>
      <span className="pill ws"><b className="on">1 ●●</b><b>2 ●</b><b>4 ●</b></span>
      <span className="grow" />
      <span className="pill opt">Vol 72%</span>
      <span className="pill">88%</span>
    </div>
  );
}

function WindowsBar() {
  return (
    <div className="bar">
      <span className="pill">10:24</span>
      <span className="pill opt">03.11.</span>
      <span className="pill ws"><b className="on">1 ▣▣</b><b>2 ▣</b></span>
      <span className="grow" />
      <span className="pill opt">CPU 12%</span>
      <span className="pill">88%</span>
    </div>
  );
}
