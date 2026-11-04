// Shells erkennen und einbinden – Linux (zsh/bash/fish, Frameworks, Symlink-dotfiles) und Windows (PowerShell, Git Bash).
import { describe, expect, it } from "vitest";
import type { Bridge, WinEnv } from "../src/lib/windows/bridge";
import { chosenShells, detectShells, initLines, MARK_BEGIN, upsertShellBlock, writeShells } from "../src/lib/shells";

const LINUX: WinEnv = { os: "linux", home: "/home/u", appdata: "", localappdata: "", documents: "", komorebiConfigHome: "", logFile: "", windowsBuild: "",
  shell: "/usr/bin/zsh", zdotdir: "", tools: { zsh: "/usr/bin/zsh", bash: "/usr/bin/bash", fish: "/usr/bin/fish", "oh-my-posh": "/usr/bin/oh-my-posh" } };

function fake(files: Record<string, string>, dirs: string[] = []) {
  const fs = new Map(Object.entries(files));
  const b = {
    exists: async (p: string) => fs.has(p) || dirs.includes(p),
    read: async (p: string) => fs.get(p) ?? null,
    write: async (_s: string, p: string, text: string) => { fs.set(p, text); },
  } as unknown as Bridge;
  return { b, fs };
}

describe("Shells", () => {
  it("erkennt Login-Shell, oh-my-zsh, powerlevel10k, oh-my-fish, starship", async () => {
    const { b } = fake({
      "/home/u/.zshrc": "export ZSH=~/.oh-my-zsh\nsource $ZSH/oh-my-zsh.sh\n[[ -f ~/.p10k.zsh ]] && source ~/.p10k.zsh\n",
      "/home/u/.bashrc": 'eval "$(starship init bash)"\n',
    }, ["/home/u/.local/share/omf"]);
    const all = await detectShells(b, LINUX);
    const zsh = all.find((s) => s.id === "zsh")!;
    expect(zsh.isDefault).toBe(true);
    expect(zsh.p10k).toBe(true);
    expect(zsh.notes.join(" ")).toMatch(/oh-my-zsh/);
    expect(all.find((s) => s.id === "bash")!.notes.join(" ")).toMatch(/starship/);
    expect(all.find((s) => s.id === "fish")!.notes.join(" ")).toMatch(/oh-my-fish/);
    expect(all.find((s) => s.id === "fish")!.rc).toBe("/home/u/.config/fish/conf.d/theme-studio.fish");
  });

  it("Vorschlag: Linux nur Login-Shell, Windows beide PowerShells ohne Git Bash; gespeicherte Wahl gewinnt", async () => {
    const all = await detectShells(fake({}).b, LINUX);
    expect(chosenShells(all).map((s) => s.id)).toEqual(["zsh"]);
    expect(chosenShells(all, ["fish", "bash"]).map((s) => s.id)).toEqual(["bash", "fish"]);
    const W: WinEnv = { ...LINUX, os: "windows", home: "C:\\Users\\u", documents: "C:\\Users\\u\\Documents", shell: "",
      tools: { pwsh: "C:\\pwsh.exe", "git-bash": "C:\\Git\\bin\\bash.exe" } };
    const wall = await detectShells(fake({}).b, W);
    expect(wall.map((s) => s.id)).toEqual(["pwsh", "powershell", "bash"]);
    expect(chosenShells(wall).map((s) => s.id)).toEqual(["pwsh", "powershell"]);
    expect(wall.find((s) => s.id === "bash")!.rc).toBe("C:\\Users\\u\\.bashrc");
  });

  it("Block wird angehängt, beim zweiten Mal ersetzt, beim Ausschalten entfernt – Fremdes bleibt", () => {
    const orig = "alias ll='ls -l'\n";
    const on = upsertShellBlock(orig, initLines("bash", "omp", "/c.json", ""), false);
    expect(on.startsWith(orig)).toBe(true);
    expect(on).toContain("oh-my-posh init bash --config '/c.json'");
    expect(upsertShellBlock(on, initLines("bash", "omp", "/c.json", ""), false)).toBe(on);
    expect(upsertShellBlock(on, null, false)).toBe(orig);
  });

  it("zsh mit eigenen dotfiles (lädt p10k.zsh schon) bleibt unangetastet; fish bekommt eigene Datei", async () => {
    const zshrc = "source ~/.p10k.zsh\n[[ -r ~/.config/theme-studio/p10k.zsh ]] && source ~/.config/theme-studio/p10k.zsh\n";
    const { b, fs } = fake({ "/home/u/.zshrc": zshrc });
    const all = await detectShells(b, LINUX);
    const w = await writeShells(b, "s", chosenShells(all, ["zsh", "fish"]), { enabled: true, engine: "p10k", config: "/home/u/.config/theme-studio/prompt.omp.json", p10kFile: "/home/u/.config/theme-studio/p10k.zsh" });
    expect(fs.get("/home/u/.zshrc")).toBe(zshrc);
    expect(fs.get("/home/u/.config/fish/conf.d/theme-studio.fish")).toContain("oh-my-posh init fish");
    expect(w.done).toEqual(["zsh", "fish"]);
  });

  it("zsh ohne Einbindung + p10k → Block nach ~/.p10k.zsh; Prompt aus + nie gesetzt → keine neue Datei", async () => {
    const { b, fs } = fake({ "/home/u/.zshrc": "source ~/.p10k.zsh\n" });
    const all = await detectShells(b, LINUX);
    await writeShells(b, "s", chosenShells(all), { enabled: true, engine: "p10k", config: "", p10kFile: "/home/u/.config/theme-studio/p10k.zsh" });
    const z = fs.get("/home/u/.zshrc")!;
    expect(z.indexOf(MARK_BEGIN)).toBeGreaterThan(z.indexOf("source ~/.p10k.zsh"));
    await writeShells(b, "s", chosenShells(all, ["bash"]), { enabled: false, engine: "omp", config: "", p10kFile: "" });
    expect(fs.has("/home/u/.bashrc")).toBe(false);
  });
});
