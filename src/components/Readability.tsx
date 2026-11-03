// Lesbarkeit (WCAG-Kontrast) der wichtigsten Farbpaare – Ampel wie bei Realtime Colors.
import type { Palette } from "../lib/color";
import { grade, GRADE_LABEL, PAIRS, ratio } from "../lib/contrast";

export function Readability({ c }: { c: Palette }) {
  const rows = PAIRS.map(([fg, bg, label]) => {
    const f = (c as Record<string, string>)[fg], b = (c as Record<string, string>)[bg];
    const r = ratio(f, b);
    return { label, f, b, r, g: grade(r) };
  });
  const bad = rows.filter((x) => x.g === "fail").length;
  return (
    <div className="readability">
      <h3>Lesbarkeit {bad ? <span className="badge fail">{bad} schlecht</span> : <span className="badge aaa">alles lesbar</span>}</h3>
      <ul>
        {rows.map((x) => (
          <li key={x.label} title={`Kontrast ${x.r.toFixed(2)} : 1 – ab 4,5 gut lesbar, ab 7 sehr gut`}>
            <span className="pair" style={{ background: x.b, color: x.f }}>Aa</span>
            <span className="what">{x.label}</span>
            <span className={`badge ${x.g}`}>{x.r.toFixed(1)} · {GRADE_LABEL[x.g]}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}
