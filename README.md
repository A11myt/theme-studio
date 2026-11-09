# Theme Studio

**English** · [Deutsch](README.de.md)

![Theme Studio – color view](docs/screenshots/color.webp)

Build desktop themes from your own wallpapers. Compare all nine Material You variants side by side on mini
desktops, tweak them, and apply the result with one click – on **Windows** (accent color, wallpaper, Windows
Terminal, VS Code, PowerShell prompt, komorebi) and on **Linux**. Everything stays on your machine.

| Preview with apps | Prompt wizard | Collection |
|---|---|---|
| ![Preview](docs/screenshots/preview.webp) | ![Prompt wizard](docs/screenshots/prompt.webp) | ![Collection](docs/screenshots/collection.webp) |

## Get it

- **Windows**: installer (updates itself) or `…-portable.exe` (just run it) from
  [Releases](https://github.com/A11myt/theme-studio/releases)
- **Linux**: AppImage or `.deb` from Releases, or build it yourself (see below)
- **In the browser** (no install): https://a11myt.github.io/theme-studio/ – designing and exporting work there;
  applying themes, Nerd Font installs and wallhaven search need the desktop app

The interface is available in **English and German** (follows your system language; switch in ⚙ Settings).
On first start the app asks which system it should apply themes to (detected automatically, changeable later).

## Features

- **Images**: drag & drop your wallpapers or search **wallhaven** (SFW only, ≥ 1920×1080) – also by color,
  to find wallpapers that match your theme
- **Colors**: the image's source colors or your own; **9 variants** (tonal-spot, vibrant, expressive …) as live
  mini desktops; fine-tune hue and chroma or override single roles; WCAG readability check
- **Fonts**: UI, mono and accent font with sizes; **Nerd Fonts** straight from GitHub (only 8 files per font)
- **Prompt wizard** (like `p10k configure`): lean / classic / rainbow / pure, lines, frame, separators, icons,
  prompt char, right side, transient prompt. Detects your shells – PowerShell 5.1/7, Git Bash, bash, zsh, fish –
  and frameworks (oh-my-zsh, powerlevel10k, oh-my-bash, oh-my-fish, starship) and hooks the prompt in via
  oh-my-posh (zsh: powerlevel10k or oh-my-posh)
- **Apply on Windows** – no scripts, no Python: wallpaper, accent color and light/dark, Windows Terminal scheme +
  font, VS Code colors + font, PowerShell prompt, komorebi borders and bar. Shows beforehand what was found and
  what is missing (with install hints), logs every step, **undo** restores the previous state, **reset to default** removes everything Theme Studio ever changed (back to how Windows was before, otherwise Windows defaults),
  **copy diagnostics** for help (user name redacted)
- **Runs in the background** (Windows): icon in the notification area – apply saved themes with one click,
  **recolor automatically** whenever the Windows wallpaper changes, optionally start with Windows (installed version)
- **More apps**: Obsidian (CSS snippet per vault) and Firefox (userChrome.css) are colored too
- **Apply on Linux** via your own `wallthemes` + `fontgen` scripts
- **Previews** of VS Code, Firefox, Obsidian and Discord; 16 ANSI colors harmonized to your theme
- **Exports**: theme file (re-importable), VS Code extension (`.vsix`), Windows Terminal scheme, komorebi theme,
  oh-my-posh and powerlevel10k prompt, base16 YAML, pywal `colors.json`, Xresources, CSS variables, and your own
  templates (`{{colors.<role>.<variant>.<format>}}`, `{{fonts.*}}`, `{{mode}}`)
- **Collection** with favorites, search and sorting; **share themes as links**; undo/redo; random theme
- **Accessible**: full keyboard support, focus handling in dialogs, labelled controls, WCAG contrasts,
  single-key shortcuts can be turned off

## Develop

```bash
pnpm install
pnpm dev          # browser → http://localhost:5173 (also proxies wallhaven)
pnpm test         # vitest
pnpm app          # desktop app (Tauri 2, dev mode)
pnpm app:build    # → src-tauri/target/release/theme-studio
```

Linux needs Rust (`rustup`) and `webkit2gtk-4.1 libappindicator-gtk3 librsvg` for the desktop app.
The WebAssembly color module is prebuilt in `src/wasm/`; rebuild it with `pnpm build:wasm`
(needs `wasm32-unknown-unknown` and `wasm-bindgen-cli 0.2.130`).

Structure: `src/useStudio.ts` (state + actions), `src/panes/` (one file per view), `src/components/`,
`src/lib/` (color math, exporters, prompt, shells, share links …), `src/lib/windows/` (Windows apply),
`color-wasm/` (source colors as WebAssembly), `src-tauri/` (desktop app, Windows building blocks).

### Releases

`git tag v0.2.0 && git push --tags` builds Windows (installer + portable exe) and Linux (AppImage, .deb),
signs the updates and publishes a release with `latest.json`, which the installed app checks on start.

## Credits

- [material-colors](https://github.com/Aiving/material-colors) (MIT or Apache-2.0) – source colors from images,
  compiled to WebAssembly; vendored in `color-wasm/vendor/` with one change (no timing calls under WebAssembly)
- [Material Color Utilities](https://github.com/material-foundation/material-color-utilities) (Apache-2.0) – palettes
- [Nerd Fonts](https://github.com/ryanoasis/nerd-fonts), [wallhaven](https://wallhaven.cc),
  [oh-my-posh](https://ohmyposh.dev), [komorebi](https://github.com/LGUG2Z/komorebi)

## License

MIT – see `LICENSE`. `color-wasm/vendor/material-colors` is MIT or Apache-2.0 (license files included).
