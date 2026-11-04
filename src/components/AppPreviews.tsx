// Mini-Ansichten echter Programme im Theme: VS Code (Syntax wie die exportierte Erweiterung), Firefox,
// Obsidian, Discord. Farben nach denselben Rollen wie in eigenen Vorlagen.
import type { CSSProperties, ReactNode } from "react";
import type { Palette } from "../lib/color";
import { cssFont, type Fonts } from "../lib/fonts";
import { t } from "../lib/i18n";

interface Props {
  c: Palette;
  fonts: Fonts;
}

function Frame({ title, children, c, style }: { title: string; children: ReactNode; c: Palette; style?: CSSProperties }) {
  return (
    <figure className="app-prev">
      <div className="app-win" style={{ background: c.surface, color: c.on_surface, borderColor: c.outline_variant, ...style }}>{children}</div>
      <figcaption>{title}</figcaption>
    </figure>
  );
}

export function AppPreviews({ c, fonts }: Props) {
  const mono = cssFont(fonts.mono, "monospace");
  const ui = cssFont(fonts.ui, "sans-serif");
  // Syntax wie src/lib/vscode.ts → tokenColors
  const K = (t: string) => <span style={{ color: c.primary }}>{t}</span>;
  const F = (t: string) => <span style={{ color: c.secondary }}>{t}</span>;
  const S = (t: string) => <span style={{ color: c.tertiary }}>{t}</span>;
  const T = (t: string) => <span style={{ color: c.primary_fixed_dim }}>{t}</span>;
  const N = (t: string) => <span style={{ color: c.tertiary_fixed_dim }}>{t}</span>;
  const P = (t: string) => <span style={{ color: c.secondary_fixed_dim }}>{t}</span>;
  const C = (t: string) => <span style={{ color: c.outline, fontStyle: "italic" }}>{t}</span>;

  return (
    <div className="app-previews">
      {/* VS Code */}
      <Frame title="VS Code" c={c} style={{ fontFamily: ui }}>
        <div className="vs">
          <div className="vs-activity" style={{ background: c.surface_container_lowest }}>
            {[0, 1, 2, 3].map((i) => <i key={i} style={{ background: i === 0 ? c.primary : c.outline }} />)}
          </div>
          <div className="vs-side" style={{ background: c.surface_container_low, color: c.on_surface_variant, borderColor: c.outline_variant }}>
            <b>EXPLORER</b>
            <span>▾ theme-studio</span>
            <span style={{ background: `${c.primary}30`, color: c.on_surface }}>  App.tsx</span>
            <span>  color.ts</span>
            <span>  styles.css</span>
          </div>
          <div className="vs-main">
            <div className="vs-tabs" style={{ background: c.surface_container_low }}>
              <span style={{ background: c.surface, color: c.on_surface, borderTop: `2px solid ${c.primary}` }}>App.tsx</span>
              <span style={{ color: c.outline }}>color.ts</span>
            </div>
            <pre className="vs-code" style={{ fontFamily: mono }}>
              {C(t("// Palette aus der Ausgangsfarbe"))}{"\n"}
              {K("export function ")}{F("palette")}({P("t")}: {T("ThemeSettings")}) {"{"}{"\n"}
              {"  "}{K("const ")}s ={" "}{K("new ")}{T("Scheme")}({P("t")}.{P("source")}, {N("0.5")});{"\n"}
              {"  "}{K("return ")}{F("format")}(s,{" "}{S('"#rrggbb"')});{"\n"}
              {"}"}
            </pre>
            <div className="vs-status" style={{ background: c.primary, color: c.on_primary }}>⎇ main · TypeScript</div>
          </div>
        </div>
      </Frame>

      {/* Firefox */}
      <Frame title="Firefox" c={c} style={{ fontFamily: ui }}>
        <div className="ff-tabs" style={{ background: c.surface_container_lowest }}>
          <span style={{ background: c.surface_container_high, color: c.on_surface }}>wallhaven.cc</span>
          <span style={{ color: c.on_surface_variant }}>GitHub</span>
          <span style={{ color: c.outline }}>+</span>
        </div>
        <div className="ff-bar" style={{ background: c.surface_container_high }}>
          <span style={{ color: c.on_surface_variant }}>← → ⟳</span>
          <span className="ff-url" style={{ background: c.surface_container_highest, color: c.on_surface }}>github.com/A11myt/theme-studio</span>
        </div>
        <div className="ff-page" style={{ background: c.background }}>
          <b style={{ color: c.on_surface }}>theme-studio</b>
          <span style={{ color: c.on_surface_variant }}>{t("Themes aus eigenen Bildern bauen")}</span>
          <span><a style={{ color: c.primary }}>README.md</a> · <a style={{ color: c.primary }}>LICENSE</a></span>
          <span className="ff-btn" style={{ background: c.primary, color: c.on_primary }}>Code ▾</span>
        </div>
      </Frame>

      {/* Obsidian */}
      <Frame title="Obsidian" c={c} style={{ fontFamily: ui }}>
        <div className="ob">
          <div className="ob-side" style={{ background: c.surface_container_low, color: c.on_surface_variant }}>
            <span>{t("📁 Termine")}</span>
            <span style={{ background: c.surface_container_high, color: c.on_surface }}>{t("📄 Ideen")}</span>
            <span>{t("📄 Einkauf")}</span>
          </div>
          <div className="ob-note">
            <b style={{ color: c.primary, fontFamily: cssFont(fonts.accent, "sans-serif") }}>{t("Ideen")}</b>
            <span style={{ color: c.on_surface }}>{t("Mehr Farbe ins")}{" "}<a style={{ color: c.secondary, textDecoration: "underline" }}>[[Theme Studio]]</a>.</span>
            <span style={{ color: c.on_surface }}><mark style={{ background: `${c.tertiary}55`, color: c.on_surface }}>{t("markiert")}</mark>{" "}{t("und")}{" "}<code style={{ background: c.surface_container_high, color: c.tertiary, fontFamily: mono }}>code</code></span>
            <span style={{ color: c.on_surface_variant }}>☑ <s>{t("Nerd Fonts")}</s>{" "}{t("☐ Release")}</span>
            <span className="ob-tag" style={{ background: c.secondary_container, color: c.on_secondary_container }}>#projekt</span>
          </div>
        </div>
      </Frame>

      {/* Discord */}
      <Frame title="Discord" c={c} style={{ fontFamily: ui }}>
        <div className="dc">
          <div className="dc-servers" style={{ background: c.surface_container_lowest }}>
            {[c.primary, c.tertiary, c.secondary].map((x, i) => <i key={i} style={{ background: x, borderRadius: i === 0 ? 8 : 99 }} />)}
          </div>
          <div className="dc-channels" style={{ background: c.surface_container_low, color: c.on_surface_variant }}>
            <b style={{ color: c.on_surface }}>Dotfiles</b>
            <span># allgemein</span>
            <span style={{ background: c.surface_container_high, color: c.on_surface }}># themes</span>
            <span># hilfe</span>
          </div>
          <div className="dc-chat">
            <span><b style={{ color: c.primary }}>A11myt</b> <small style={{ color: c.outline }}>{t("heute")}</small></span>
            <span style={{ color: c.on_surface }}>{t("neues Theme ist live 🎨")}</span>
            <span><b style={{ color: c.tertiary }}>Gast</b></span>
            <span style={{ color: c.on_surface }}>{t("sieht gut aus")}{" "}<span style={{ background: `${c.primary}33`, color: c.primary, borderRadius: 3, padding: "0 3px" }}>@A11myt</span></span>
            <span className="dc-input" style={{ background: c.surface_container_high, color: c.outline }}>{t("Nachricht an #themes")}</span>
          </div>
        </div>
      </Frame>
    </div>
  );
}
