// Erster Start (nur App): einmal fragen, für welches System die App Themes anwendet. Später änderbar unter ⚙.
import { useRef } from "react";
import { useDialog } from "../lib/useDialog";
import { t } from "../lib/i18n";
import type { Detected, System, SystemChoice } from "../lib/system";

interface Props {
  detected?: Detected;
  onChoose: (c: SystemChoice) => void;
}

const LABEL: Record<System, string> = { windows: "Windows", linux: "Linux" };

const isWin = (s: System) => s === "windows";

export function FirstRun({ detected, onChoose }: Props) {
  const sheetRef = useRef<HTMLDivElement>(null);
  useDialog(sheetRef);
  const pick = (sys: System) => onChoose(detected?.system === sys ? "auto" : sys);

  return (
    <div className="overlay" role="dialog" aria-modal="true" aria-label={t("Willkommen")}>
      <div ref={sheetRef} tabIndex={-1} className="sheet settings first-run">
        <div className="wh-head"><h2>{t("Willkommen bei Theme Studio")}</h2></div>
        <div className="pad form">
          <p>{detected
            ? t("Erkannt: {name}. Für welches System soll „Anwenden“ Themes einrichten?", { name: detected.name })
            : t("Für welches System soll „Anwenden“ Themes einrichten?")}</p>
          <div className="first-run-choices">
            {(["windows", "linux"] as System[]).map((sys) => (
              <button key={sys} type="button" className={detected?.system === sys ? "primary" : "ghost"} onClick={() => pick(sys)}
                autoFocus={detected?.system === sys}>
                <b>{LABEL[sys]}{detected?.system === sys ? ` · ${t("erkannt")}` : ""}</b>
                <small>{t(isWin(sys)
                  ? "Wallpaper, Akzentfarbe, Windows Terminal, VS Code, oh-my-posh, komorebi – direkt aus der App"
                  : "über deine Skripte wallthemes + fontgen (matugen, Hyprland, Quickshell …)")}</small>
              </button>
            ))}
          </div>
          <small className="empty">{t("Später änderbar unter ⚙ Einstellungen → System.")}</small>
        </div>
      </div>
    </div>
  );
}
