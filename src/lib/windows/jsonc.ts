// JSON mit Kommentaren (Windows Terminal, VS Code): lesen und gezielt einen Block einfügen, ohne den Rest anzufassen.

/** Kommentare (// und /* *\/) außerhalb von Strings und Kommas vor } bzw. ] entfernen. */
export function stripJsonc(text: string): string {
  let out = "", i = 0, inStr = false;
  while (i < text.length) {
    const c = text[i];
    if (inStr) {
      out += c;
      if (c === "\\" && i + 1 < text.length) { out += text[i + 1]; i += 2; continue; }
      if (c === '"') inStr = false;
    } else if (c === '"') { inStr = true; out += c; }
    else if (text.startsWith("//", i)) { while (i < text.length && text[i] !== "\n") i++; continue; }
    else if (text.startsWith("/*", i)) { const j = text.indexOf("*/", i + 2); i = j < 0 ? text.length : j + 2; continue; }
    else out += c;
    i++;
  }
  return out.replace(/,(\s*[}\]])/g, "$1");
}

/** JSONC lesen → Objekt; Fehler mit Zeilennummer für eine verständliche Meldung. */
export function parseJsonc(text: string): Record<string, unknown> {
  const clean = stripJsonc(text.replace(/^\uFEFF/, ""));
  try {
    const v = JSON.parse(clean.trim() || "{}");
    if (!v || typeof v !== "object" || Array.isArray(v)) throw new Error("oberste Ebene ist kein Objekt");
    return v as Record<string, unknown>;
  } catch (e) {
    const m = String((e as Error).message).match(/position (\d+)/);
    const line = m ? clean.slice(0, Number(m[1])).split("\n").length : undefined;
    throw new Error(`kein gültiges JSON${line ? ` (etwa Zeile ${line})` : ""}: ${(e as Error).message}`);
  }
}

/**
 * Markierten Block (BEGIN … END) als letzte Einträge ins oberste Objekt setzen – ersetzt einen alten Block.
 * Am Ende, damit unsere Werte gleichnamige Einträge davor überstimmen. Kommentare und Rest bleiben erhalten.
 */
export function upsertBlock(text: string, begin: string, end: string, entries: Record<string, unknown>): string {
  const body = Object.entries(entries)
    .map(([k, v]) => `  ${JSON.stringify(k)}: ${JSON.stringify(v, null, 2).replace(/\n/g, "\n  ")}`)
    .join(",\n");
  const block = `${begin}\n${body}\n${end}`;
  const esc = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  let t = (text || "{\n}").replace(/^\uFEFF/, "");
  // alten Block (samt evtl. Komma davor) entfernen
  t = t.replace(new RegExp(`,?\\s*${esc(begin)}[\\s\\S]*?${esc(end)}`), "");
  const close = t.lastIndexOf("}");
  if (close < 0) throw new Error("keine schließende Klammer gefunden");
  const before = t.slice(0, close);
  // Komma direkt hinter das letzte echte Zeichen (nicht in einen Kommentar dahinter)
  const last = lastSignificant(before);
  const ch = last >= 0 ? before[last] : "{";
  const head = ch === "{" || ch === "," ? before : before.slice(0, last + 1) + "," + before.slice(last + 1);
  return `${head.replace(/\s*$/, "")}\n${block}\n}\n`;
}

/** Position des letzten Zeichens außerhalb von Kommentaren und Leerraum (Strings zählen mit). */
function lastSignificant(text: string): number {
  let last = -1, i = 0, inStr = false;
  while (i < text.length) {
    const c = text[i];
    if (inStr) {
      if (c === "\\") { i += 2; last = i - 1; continue; }
      if (c === '"') inStr = false;
      last = i;
    } else if (c === '"') { inStr = true; last = i; }
    else if (text.startsWith("//", i)) { while (i < text.length && text[i] !== "\n") i++; continue; }
    else if (text.startsWith("/*", i)) { const j = text.indexOf("*/", i + 2); i = j < 0 ? text.length : j + 2; continue; }
    else if (!/\s/.test(c)) last = i;
    i++;
  }
  return last;
}
