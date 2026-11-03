// Sammelt alle Übersetzungs-Schlüssel aus dem Code: Zeichenketten in t("…") bzw. tr("…")
// (auch in Bedingungen wie t(a ? "x" : "y")). Genutzt von test/i18n.test.ts.
import fs from "node:fs";
import path from "node:path";
import ts from "typescript";

export function sourceKeys(dir) {
  const keys = new Set();
  const walk = (d) => {
    for (const e of fs.readdirSync(d, { withFileTypes: true })) {
      const p = path.join(d, e.name);
      if (e.isDirectory()) { if (e.name !== "wasm") walk(p); continue; }
      if (!/\.(ts|tsx)$/.test(e.name) || e.name.startsWith("i18n")) continue;
      const sf = ts.createSourceFile(p, fs.readFileSync(p, "utf8"), ts.ScriptTarget.Latest, true, p.endsWith("x") ? ts.ScriptKind.TSX : ts.ScriptKind.TS);
      const collect = (n) => {
        if (ts.isStringLiteral(n) || ts.isNoSubstitutionTemplateLiteral(n)) keys.add(n.text);
        // nur die Textauswahl, nicht die Platzhalter-Werte ({ name: … })
        if (ts.isObjectLiteralExpression(n) && !n.properties.every((pr) => ts.isPropertyAssignment(pr) && ts.isStringLiteral(pr.initializer))) return;
        ts.forEachChild(n, collect);
      };
      const visit = (n) => {
        if (ts.isCallExpression(n) && ["t", "tr"].includes(n.expression.getText(sf)) && n.arguments[0]) collect(n.arguments[0]);
        ts.forEachChild(n, visit);
      };
      visit(sf);
    }
  };
  walk(dir);
  return keys;
}
