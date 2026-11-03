// Listet Zeichenketten, die nach sichtbarem deutschem Text aussehen und noch nicht in t("…") stecken.
import fs from "node:fs";
import ts from "typescript";
const looksGerman = (s) => /[äöüßÄÖÜ„“–…]|\b(der|die|das|und|oder|nicht|mit|für|nur|kein|Theme|Bild|Farbe|Schrift|speichern|Speichern|öffnen|Datei|Dateien|wird|ist|aus|an|von|zum|zur|eigene|Vorschau|Kopieren|gespeichert|Fehler)\b/.test(s) && /[a-zäöü]{3}/.test(s);
for (const file of process.argv.slice(2)) {
  const src = fs.readFileSync(file, "utf8");
  const sf = ts.createSourceFile(file, src, ts.ScriptTarget.Latest, true, file.endsWith("x") ? ts.ScriptKind.TSX : ts.ScriptKind.TS);
  const visit = (n, inT) => {
    const isT = ts.isCallExpression(n) && n.expression.getText(sf) === "t";
    if (!inT && (ts.isStringLiteral(n) || ts.isNoSubstitutionTemplateLiteral(n) || ts.isTemplateExpression(n))) {
      const txt = n.getText(sf);
      const parent = n.parent;
      const isImport = ts.isImportDeclaration(parent) || ts.isExportDeclaration(parent);
      const isKey = ts.isPropertyAssignment(parent) && parent.name === n;
      const isClass = ts.isJsxAttribute(parent) && ["className", "key", "id", "type", "role", "href", "list", "accept"].includes(parent.name.getText(sf));
      if (!isImport && !isKey && !isClass && looksGerman(txt)) {
        const { line } = sf.getLineAndCharacterOfPosition(n.getStart(sf));
        console.log(`${file}:${line + 1}  ${txt.slice(0, 140)}`);
      }
    }
    ts.forEachChild(n, (c) => visit(c, inT || isT));
  };
  visit(sf, false);
}
