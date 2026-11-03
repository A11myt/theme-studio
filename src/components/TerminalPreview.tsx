// Terminal mit den 16 harmonisierten ANSI-Farben – so sieht ls, git und ein Prompt im Theme aus.
import { ansi, ANSI_NAMES } from "../lib/ansi";
import type { Palette, ThemeSettings } from "../lib/color";
import { cssFont, type Fonts } from "../lib/fonts";

export function TerminalPreview({ c, t, fonts }: { c: Palette; t: ThemeSettings; fonts: Fonts }) {
  const a = ansi(c, t);
  const [, red, green, yellow, blue, magenta, cyan] = a.normal;
  const S = (color: string, text: string, bold = false) => <span style={{ color, fontWeight: bold ? 600 : undefined }}>{text}</span>;
  return (
    <div className="terminal-preview">
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
