// Einmal-Werkzeug: sichtbare Texte in TSX mit t("…") umwickeln – über den TypeScript-Parser,
// damit Code (Pfeilfunktionen, Vergleiche, Typen) nie angefasst wird.
// Umwickelt: JSX-Text und String-Attribute title/aria-label/placeholder/alt.
// Gibt die gefundenen Texte als JSON aus (für das Wörterbuch).
import fs from "node:fs";
import ts from "typescript";

const KEEP = new Set(["Linux", "Windows", "pwsh", "README.md", "LICENSE", "main", "EXPLORER", "App.tsx", "color.ts", "styles.css",
  "GitHub", "wallhaven.cc", "theme-studio", "Dotfiles", "A11myt", "Gast", "Lean", "Classic", "Rainbow", "Pure", "Theme Studio",
  "VS Code", "Firefox", "Obsidian", "Discord", "+", "✕", "↶", "↷", "⚙", "★", "☆", "→", "←", "#projekt", "# allgemein", "# themes",
  "# hilfe", "Code ▾", "88%", "10:24", "03.11.", "CPU 12%", "Vol 72%", "Aa", "pt", "Mono", "Import"]);
const ATTRS = new Set(["title", "aria-label", "placeholder", "alt"]);
const found = new Set();

for (const file of process.argv.slice(2)) {
  const src = fs.readFileSync(file, "utf8");
  const sf = ts.createSourceFile(file, src, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
  const edits = [];
  const visit = (n) => {
    if (ts.isJsxText(n)) {
      const raw = n.getFullText(sf);
      const core = raw.trim().replace(/\s+/g, " ");
      if (core && /[A-Za-zÄÖÜäöüß]/.test(core) && !KEEP.has(core)) {
        const lead = raw.match(/^\s*/)[0], trail = raw.match(/\s*$/)[0];
        const keepSpace = (s) => (s.includes("\n") ? s : s ? " " : "");
        // führende/abschließende Leerzeichen im selben Satz erhalten ({" "} wäre sonst weg)
        const l = lead && !lead.includes("\n") ? '{" "}' : lead, r = trail && !trail.includes("\n") ? '{" "}' : trail;
        edits.push([n.getFullStart(), n.getEnd(), `${l}{t(${JSON.stringify(core)})}${r}`]);
        found.add(core);
        void keepSpace;
      }
    }
    if (ts.isJsxAttribute(n) && n.initializer && ts.isStringLiteral(n.initializer) && ATTRS.has(n.name.getText(sf))) {
      const v = n.initializer.text;
      if (/[A-Za-zÄÖÜäöüß]/.test(v) && !KEEP.has(v)) {
        edits.push([n.initializer.getStart(sf), n.initializer.getEnd(), `{t(${JSON.stringify(v)})}`]);
        found.add(v);
      }
    }
    ts.forEachChild(n, visit);
  };
  visit(sf);
  if (!edits.length) continue;
  let out = src;
  for (const [a, b, rep] of edits.sort((x, y) => y[0] - x[0])) out = out.slice(0, a) + rep + out.slice(b);
  if (!/import \{[^}]*\bt\b[^}]*\} from "\.\.?\/lib\/i18n"/.test(out)) {
    const rel = file.includes("/components/") || file.includes("/panes/") ? "../lib/i18n" : "./lib/i18n";
    const lines = out.split("\n");
    let last = 0;
    lines.forEach((l, i) => { if (/^import /.test(l)) last = i; });
    // mehrzeilige Imports: bis zur Zeile mit „from“ weiterspringen
    while (last < lines.length && !/from ".*";$/.test(lines[last])) last++;
    lines.splice(last + 1, 0, `import { t } from "${rel}";`);
    out = lines.join("\n");
  }
  fs.writeFileSync(file, out);
}
console.log(JSON.stringify([...found].sort(), null, 1));
