// Vorschau für Linux oder Windows – gehört zur Vorschau, nicht in die Kopfzeile.
import type { Os } from "./Desktop";
import { t } from "../lib/i18n";

export function OsToggle({ os, onChange }: { os: Os; onChange: (o: Os) => void }) {
  return (
    <div className="seg seg-sm" role="group" aria-label={t("Vorschau für")}>
      <button type="button" aria-pressed={os === "windows"} onClick={() => onChange("windows")}>Windows</button>
      <button type="button" aria-pressed={os === "linux"} onClick={() => onChange("linux")}>Linux</button>
    </div>
  );
}
