// Lesbarkeit (WCAG-Kontrast) der wichtigsten Farbpaare – Ampel wie bei Realtime Colors.
import type { Palette } from "../lib/color";
import { grade, GRADE_LABEL, PAIRS, ratio } from "../lib/contrast";
import { t } from "../lib/i18n";

export function Readability({ c }: { c: Palette }) {
  const rows = PAIRS.map(([fg, bg, label]) => {
    const f = (c as Record<string, string>)[fg], b = (c as Record<string, string>)[bg];
    const r = ratio(f, b);
    return { label, f, b, r, g: grade(r) };
  });
  const bad = rows.filter((x) => x.g === "fail").length;
  return (
    <div className="readability">
      <h3>{t("Lesbarkeit")}{" "}{bad ? <span className="badge fail">{bad}{" "}{t("schlecht")}</span> : <span className="badge aaa">{t("alles lesbar")}</span>}</h3>
      <ul>
        {rows.map((x) => (
          <li key={x.label} title={t("Kontrast {r} : 1 – ab 4,5 gut lesbar, ab 7 sehr gut", { r: x.r.toFixed(2) })}>
            <span className="pair" style={{ background: x.b, color: x.f }}>Aa</span>
            <span className="what">{t(x.label)}</span>
            <span className={`badge ${x.g}`}>{x.r.toFixed(1)} · {t(GRADE_LABEL[x.g])}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}
