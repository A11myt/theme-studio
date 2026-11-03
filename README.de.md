# Theme Studio

[English](README.md) · **Deutsch**

![Theme Studio – Bereich Farbe](docs/screenshots/color.webp)

Themes aus eigenen Bildern bauen, alle Material-You-Varianten nebeneinander vergleichen und für
**Linux (matugen)** und **Windows (wintheme)** übernehmen. Läuft lokal im Browser, alles bleibt auf dem Rechner.

**Ohne Installation:** im Browser unter **https://a11myt.github.io/theme-studio/** (Anwenden, Nerd Fonts und
wallhaven nur in der App) · Windows: `…-portable.exe` aus den [Releases](https://github.com/A11myt/theme-studio/releases)
· Linux: AppImage. **Installiert:** Windows-Setup aus den Releases – aktualisiert sich dann selbst.

```bash
pnpm install
pnpm dev          # im Browser → http://localhost:5173
pnpm app          # als Desktop-App (Tauri, Entwicklungsmodus)
pnpm app:build    # App bauen → src-tauri/target/release/theme-studio
```

## Was es kann

| Vorschau mit Programmen | Prompt-Assistent | Sammlung |
|---|---|---|
| ![Vorschau](docs/screenshots/preview.webp) | ![Prompt-Assistent](docs/screenshots/prompt.webp) | ![Sammlung](docs/screenshots/collection.webp) |

- **Bilder** hochladen (Drag & Drop) oder **auf wallhaven suchen** (nur jugendfrei, ≥ 1920×1080, wie der Launcher)
- **Ausgangsfarben**: die 4 Farben des Bildes – **exakt wie matugen**, weil matugens eigener Rust-Code
  (material-colors 0.4.2) als WebAssembly im Browser läuft; geprüft mit 13 Wallpapern – oder eine eigene Farbe
- **9 Varianten** (tonal-spot, vibrant, expressive …) als Mini-Desktops: Linux-Leiste mit Bubbles oder
  Windows mit komorebi-Leiste und Terminal, jeweils auf dem Wallpaper
- **Hell/Dunkel, Kontrast**, komplette Palette (Klick kopiert die Farbe), auf Wunsch hell + dunkel nebeneinander
- **Lesbarkeit**: WCAG-Kontrast der wichtigsten Paare als Ampel, Punkt an jeder Palettenfarbe
- **Terminal**: 16 ANSI-Farben passend zum Theme (klassische Farbtöne, zur Ausgangsfarbe harmonisiert) mit Vorschau
- **Zufall**, **Rückgängig/Wiederholen** (Strg+Z / Strg+Y), **Import** exportierter `.theme.json` (auch per Drag & Drop)
- **Vier Bereiche** statt einer langen Seite: Farbe → Schrift → Vorschau → Export (Alt+1–4), mit „Weiter“-Knöpfen;
  der Schrift-Bereich zeigt daneben live Desktop und Terminal, der Export-Bereich oben eine Zusammenfassung
- **Themes per Link teilen** (Webseite öffnet sie direkt, in der App Strg+V)
- **Tastenkürzel**: 1–9 Variante (im Bereich Farbe), D/H dunkel/hell, Z Zufall, Strg+S speichern, Alt+1–6 Bereiche
  (Einzeltasten-Kürzel in den Einstellungen abschaltbar)
- **Barrierefrei**: Tastatur überall, Fokus in Dialogen, beschriftete Knöpfe, Kontraste nach WCAG
- **Schrift** wie fontgen: Oberfläche, Mono, Akzent + Größen; deine Profile iosevka/hack/jetbrains als Vorlage,
  Auswahl aus den installierten Schriften, Vorschau in den Mini-Desktops. Gespeichert wird nur der Name.
- **Nerd Fonts von GitHub** (App): Liste des neuesten Releases, Installieren auf Klick – nur Mono + Propo in
  Regular/Bold/Italic/BoldItalic (8 Dateien) in den Benutzer-Schriftordner, nichts im Projekt
- **VS Code**: installierbare Erweiterung (`.vsix`, Oberfläche wie deine matugen-Vorlage + Syntaxfarben),
  `settings.json`-Auszug (Theme + Schrift), Theme-Datei
- **Einstellungen** (App, ⚙): Wallpaper-Ordner (wallhaven-Bilder landen dort), Export-Ordner, „jedes Mal fragen“
- **Sammlung**: alle Themes als Karten mit Vorschau – Favoriten ★, Suche, Sortierung (neu/Name/Farbe),
  Umbenennen (Doppelklick), Duplizieren, Löschen
- **Terminal & Prompt-Assistent** (wie `p10k configure`): Stil lean/classic/rainbow/pure, Zeilen, Rahmen, Trenner,
  Symbole, Prompt-Zeichen, rechte Seite, Uhrzeit, Zusammenfalten – jede Antwort mit Live-Vorschau; Schalter
  „eigenen Prompt verwenden“. Ausgabe: Ergänzung zu `~/.p10k.zsh` (Terminalfarben-Nummern → folgt matugen) und
  oh-my-posh-Vorlage für wintheme; „Anwenden“ setzt bzw. entfernt beides
- **Programm-Vorschauen**: VS Code (Syntax wie die Erweiterung), Firefox, Obsidian, Discord
- **Speichern**: Themes (Farben + Schrift) bleiben lokal (IndexedDB)
- **Anwenden per Knopf** (App): setzt das Theme auf diesem Rechner – Linux über `wallthemes` (Wallpaper,
  alle matugen-Vorlagen, Hooks) und `fontgen`, Windows über `wintheme` (inkl. Terminal-Schrift)
- **Feinjustieren**: Farbton und Buntheit der Ausgangsfarbe verschieben (bleibt überall exakt – es ist wieder eine
  Farbe) und einzelne Rollen überschreiben (Vorschau → Palette anklicken); Überschreibungen gehen als `--override`
  an wallthemes (über `matugen json`, also deine Vorlagen) und wintheme
- **Passende Wallpaper**: wallhaven nach der Ausgangsfarbe bzw. den Bildfarben durchsuchen (29 wallhaven-Farben)
- **Anwenden**: fertige Befehle
  - Windows: `wintheme --color #db79a9 --scheme vibrant --mode dark --font "Iosevka Nerd Font Mono"` (aktuelles Wallpaper)
  - Linux: `wallthemes --color '#db79a9' --scheme vibrant --mode dark` (aktuelles Wallpaper, matugen-Vorlagen + Hooks)
- **Dateien** (nach Windows/Linux/Allgemein filterbar): Theme-Datei, Windows-Terminal-Schema + -Schrift, komorebi-Theme,
  fontgen-Profil, base16-YAML (Stylix, tinted-theming), pywal `colors.json`, Xresources, CSS-Variablen
- **Vorlagen**: eigene matugen- und fontgen-Vorlagen hochladen (z. B. `alacritty.toml`) → mit dem Theme ausgefüllt
  (`{{colors.<rolle>.<default|dark|light>.<hex|hex_stripped|rgb|rgba>}}`, `{{fonts.ui|mono|accent|ui_size|mono_size|ui_px|mono_px}}`, `{{mode}}`, `{{image}}`)

Gleiche Ausgangsfarbe + Variante + Modus ⇒ **identische Palette** in Studio, matugen und wintheme
(material-color-utilities, Spezifikation 2021).

## Technik

Aufbau: `src/useStudio.ts` (Zustand + Aktionen), `src/panes/` (je Bereich eine Datei), `src/components/`, `src/lib/`.
Tests: `pnpm test` (vitest, 29 Tests – u. a. Farben exakt wie matugen), laufen bei jedem Push vor dem Build.


Vite + React + TypeScript, `@material/material-color-utilities` (Paletten), `idb-keyval`.
Der Entwicklungsserver leitet wallhaven weiter (CORS); als statische Seite (`pnpm build`) fehlt nur wallhaven.

**Ausgangsfarben (`color-wasm/`)**: kleines Rust-Modul, das Schritt für Schritt macht, was matugen 4.2 macht
(112×112 Dreiecksfilter, Celebi-Quantisierung, Buntheit ≥ 5, Score), mit material-colors **0.4.2** wie matugen.
In `vendor/` liegt diese Bibliothek mit einer einzigen Änderung: die Debug-Zeitmessung ist unter WebAssembly
ausgeklammert (keine Systemuhr dort). Das fertige Modul liegt in `src/wasm/` im Repo – Rust braucht man nur
zum Neubauen:

```bash
rustup target add wasm32-unknown-unknown
cargo install wasm-bindgen-cli --version 0.2.130 --locked
pnpm build:wasm
cd color-wasm && cargo run --release -- bild.jpg   # Gegenprobe zu: matugen image bild.jpg --show-source-colors
```

## Desktop-App (Tauri 2)

Dieselbe Oberfläche als eigenes Fenster, plus: Einstellungen (Speicherorte), Nerd Fonts, Liste der installierten
Schriften. wallhaven-Bilder lädt die App in Rust direkt in den Wallpaper-Ordner; Exporte schreibt sie selbst
(jeder Ordner möglich, auch `D:\` unter Windows). Rechte der Oberfläche (`src-tauri/capabilities/default.json`):
wallhaven-Suche, Dialoge, Zwischenablage – mehr nicht.

Voraussetzungen unter Arch: Rust (`rustup`) und
`sudo pacman -S --needed webkit2gtk-4.1 libappindicator-gtk3 librsvg`.
Pakete (.deb/.rpm/AppImage): `pnpm tauri build`.

**Windows-Installer** baut GitHub Actions (`.github/workflows/build.yml`) bei jedem Push:
Actions → letzter Lauf → Artefakt `theme-studio-windows` (`.exe` bzw. `.msi`). Ein Tag `v*` legt zusätzlich
einen Release-Entwurf mit allen Installern an.

## Releases & Updates

`git tag v0.2.0 && git push --tags` → `.github/workflows/release.yml` baut Windows (Setup + portable .exe) und Linux
(AppImage, .deb), signiert die Updates und veröffentlicht das Release samt `latest.json`. Die installierte
Windows-App prüft beim Start dort und bietet „Jetzt aktualisieren“ an.
Signatur: privater Schlüssel `~/.tauri/theme-studio.key` (nie ins Repo, **sichern!** – ohne ihn keine Updates mehr),
als Repository-Geheimnis `TAURI_SIGNING_PRIVATE_KEY`; der öffentliche steht in `src-tauri/tauri.conf.json`.

## Lizenz

MIT – siehe `LICENSE`. `color-wasm/vendor/material-colors` steht unter MIT oder Apache-2.0 (Lizenzdateien dort).
