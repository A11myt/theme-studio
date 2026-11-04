// „Deine Shells“: was auf dem Rechner gefunden wurde (nur App), vorausgewählt – der Nutzer kann korrigieren.
// Gespeichert in den Prompt-Optionen (shells, zshEngine).
import { useEffect, useState } from "react";
import { isTauri } from "../lib/platform";
import type { PromptOptions } from "../lib/prompt";
import { chosenShells, detectShells, type ShellId, type ShellInfo } from "../lib/shells";
import { tauriBridge } from "../lib/windows/bridge";
import { t } from "../lib/i18n";

interface Props {
  prompt: PromptOptions;
  onChange: (o: PromptOptions) => void;
}

export function ShellPicker({ prompt, onChange }: Props) {
  const [all, setAll] = useState<ShellInfo[]>();
  const [error, setError] = useState("");
  useEffect(() => {
    if (!isTauri) return;
    void (async () => {
      try {
        const b = await tauriBridge();
        setAll(await detectShells(b, await b.env()));
      } catch (e) {
        setError(String(e));
      }
    })();
  }, []);

  if (!isTauri) return <p className="empty small">{t("Shells werden in der Desktop-App erkannt. Hier: Vorlage unten kopieren und selbst einbinden.")}</p>;
  if (error) return <p className="warn small">{t("Shells konnten nicht erkannt werden: {e}", { e: error })}</p>;
  if (!all) return <p className="empty small">{t("Suche Shells …")}</p>;

  const chosen = new Set(chosenShells(all, prompt.shells).map((s) => s.id));
  const toggle = (id: ShellId) => {
    const n = new Set(chosen);
    if (n.has(id)) n.delete(id); else n.add(id);
    onChange({ ...prompt, shells: all.filter((s) => n.has(s.id)).map((s) => s.id) });
  };
  const zsh = all.find((s) => s.id === "zsh" && s.found);
  const engine = prompt.zshEngine ?? (zsh?.p10k ? "p10k" : "omp");

  return (
    <div className="shells" role="group" aria-label={t("Deine Shells")}>
      <span className="shells-title">{t("Einbinden in")}</span>
      <ul>
        {all.map((s) => (
          <li key={s.id} className={s.found ? "" : "missing"}>
            <label className="check">
              <input type="checkbox" disabled={!s.found} checked={chosen.has(s.id)} onChange={() => toggle(s.id)} />
              <span><b>{s.label}</b>{s.isDefault && <em className="tag">{t("Standard")}</em>}
                <small>{s.found ? [s.rc, ...s.notes].join(" · ") : t("nicht gefunden")}</small></span>
            </label>
          </li>
        ))}
      </ul>
      {zsh && chosen.has("zsh") && (
        <div className="lang-row">
          <span>{t("zsh-Prompt über")}</span>
          <div className="seg" role="group" aria-label={t("zsh-Prompt über")}>
            <button type="button" aria-pressed={engine === "p10k"} onClick={() => onChange({ ...prompt, zshEngine: "p10k" })}>powerlevel10k</button>
            <button type="button" aria-pressed={engine === "omp"} onClick={() => onChange({ ...prompt, zshEngine: "omp" })}>oh-my-posh</button>
          </div>
        </div>
      )}
      {prompt.shells && <button type="button" className="ghost small" onClick={() => onChange({ ...prompt, shells: undefined })}>{t("Vorschlag wiederherstellen")}</button>}
    </div>
  );
}
