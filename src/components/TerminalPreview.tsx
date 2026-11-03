// Terminal mit den 16 harmonisierten ANSI-Farben – so sieht ls, git und ein Prompt im Theme aus.
import { ansi, ANSI_NAMES } from "../lib/ansi";
import type { Palette, ThemeSettings } from "../lib/color";
import { cssFont, type Fonts } from "../lib/fonts";
import type { PromptOptions } from "../lib/prompt";
import { PromptView, TransientLine } from "./PromptView";
import { t } from "../lib/i18n";

export function TerminalPreview({ c, t: theme, fonts, prompt }: { c: Palette; t: ThemeSettings; fonts: Fonts; prompt?: PromptOptions }) {
  const a = ansi(c, theme);
  const [, red, green, yellow, blue, magenta, cyan] = a.normal;
  const S = (color: string, text: string, bold = false) => <span style={{ color, fontWeight: bold ? 600 : undefined }}>{text}</span>;
  return (
    <div className="terminal-preview">
      {prompt?.enabled ? (
        <div className="term-box" style={{ background: c.background, color: c.on_surface, fontFamily: cssFont(fonts.mono, "monospace") }}>
          <TransientLine o={prompt} c={c} command="ls" />
          <div><span style={{ color: blue, fontWeight: 600 }}>hypr/</span>  <span style={{ color: blue, fontWeight: 600 }}>quickshell/</span>  <span style={{ color: green, fontWeight: 600 }}>install.sh</span>  <span style={{ color: magenta }}>wall.png</span></div>
          <TransientLine o={prompt} c={c} command="git push" />
          <div><span style={{ color: red }}>fatal:</span>{" "}{t("keine Verbindung")}</div>
          <PromptView o={prompt} c={c} failed />
        </div>
      ) : (
      <pre className="term-box" style={{ background: c.background, color: c.on_surface, fontFamily: cssFont(fonts.mono, "monospace") }}>
        {S(c.primary, "╭─ ~/dotfiles ")}{S(c.secondary, " main ")}{S(yellow, "!2 ?1")}{"\n"}
        {S(c.primary, "╰─❯ ")}ls -la{"\n"}
        {S(blue, "drwxr-xr-x", false)}  {S(blue, "hypr/", true)}   {S(blue, "quickshell/", true)}  {S(green, "install.sh", true)}{"\n"}
        {S(cyan, "lrwxrwxrwx")}  {S(cyan, "zshrc → zsh/.zshrc")}   {S(magenta, "wall.png")}{"\n"}
        {S(c.primary, "╰─❯ ")}git status{"\n"}
        {"  "}{S(green, "modified:   ")}{S(green, "theme.json")}{"\n"}
        {"  "}{S(red, "deleted:    ")}{S(red, "alt.conf")}{"\n"}
        {S(c.error, "✘ 1 ")}{S(c.primary, "╰─❯ ")}<span className="cursor" style={{ background: c.on_surface_variant }}> </span>
      </pre>
      )}
      <div className="ansi">
        {[a.normal, a.bright].map((row, r) => (
          <div key={r} className="ansi-row">
            {row.map((hex, i) => <i key={i} style={{ background: hex }} title={`${r ? "hell " : ""}${ANSI_NAMES[i]} ${hex}`} />)}
          </div>
        ))}
      </div>
    </div>
  );
}
