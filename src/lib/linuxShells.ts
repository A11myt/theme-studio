// Linux: Studio-Prompt in die gewählten Shells einbinden (zsh mit powerlevel10k oder oh-my-posh, bash/fish mit oh-my-posh).
// Die p10k-Ergänzung selbst schreibt apply_theme (Rust); hier kommen das oh-my-posh-Theme und die rc-Blöcke dazu.
import type { ThemeSettings } from "./color";
import { renderTemplate } from "./exporters";
import { ompTemplate, type PromptOptions } from "./prompt";
import { chosenShells, detectShells, promptDir, writeShells } from "./shells";
import { tauriBridge } from "./windows/bridge";

export async function applyLinuxShells(settings: ThemeSettings, prompt: PromptOptions): Promise<string[]> {
  const b = await tauriBridge();
  const e = await b.env();
  const all = await detectShells(b, e);
  const shells = chosenShells(all, prompt.shells);
  if (!shells.length) return [];
  const zsh = all.find((x) => x.id === "zsh");
  const engine = prompt.zshEngine ?? (zsh?.p10k ? "p10k" : "omp");
  const dir = promptDir(e);
  const config = `${dir}/prompt.omp.json`;
  const session = await b.backupBegin("Prompt (Shells)");
  const lines: string[] = [];
  const needsOmp = shells.some((x) => x.id !== "zsh" || engine === "omp");
  if (prompt.enabled && needsOmp) {
    if (!e.tools["oh-my-posh"]) lines.push("⚠ oh-my-posh ist nicht installiert – bash/fish behalten ihren Prompt, bis es da ist (z. B. pacman -S oh-my-posh bzw. curl -s https://ohmyposh.dev/install.sh | bash -s)");
    const theme = renderTemplate(ompTemplate(prompt), settings);
    JSON.parse(theme);
    await b.write(session, config, theme);
  }
  const w = await writeShells(b, session, shells, { enabled: prompt.enabled, engine, config, p10kFile: `${dir}/p10k.zsh` });
  lines.push(...w.details.map((d) => `✓ ${d}`));
  await b.log([`=== Prompt-Shells (Sicherung ${session})`, ...lines.map((l) => `           ${l}`)]).catch(() => undefined);
  return lines;
}
