# Theme Studio

Themes aus eigenen Bildern bauen, alle Material-You-Varianten nebeneinander vergleichen und für
**Linux (matugen)** und **Windows (wintheme)** übernehmen. Läuft lokal im Browser, alles bleibt auf dem Rechner.

```bash
pnpm install
pnpm dev          # im Browser → http://localhost:5173
pnpm app          # als Desktop-App (Tauri, Entwicklungsmodus)
pnpm app:build    # App bauen → src-tauri/target/release/theme-studio
```

## Was es kann

- **Bilder** hochladen (Drag & Drop) oder **auf wallhaven suchen** (nur jugendfrei, ≥ 1920×1080, wie der Launcher)
- **Ausgangsfarben**: die 4 Farben des Bildes – **exakt wie matugen**, weil matugens eigener Rust-Code
  (material-colors 0.4.2) als WebAssembly im Browser läuft; geprüft mit 13 Wallpapern – oder eine eigene Farbe
- **9 Varianten** (tonal-spot, vibrant, expressive …) als Mini-Desktops: Linux-Leiste mit Bubbles oder
  Windows mit komorebi-Leiste und Terminal, jeweils auf dem Wallpaper
- **Hell/Dunkel, Kontrast**, komplette Palette (Klick kopiert die Farbe)
- **Schrift** wie fontgen: Oberfläche, Mono, Akzent + Größen; deine Profile iosevka/hack/jetbrains als Vorlage,
  Auswahl aus den installierten Schriften, Vorschau in den Mini-Desktops. Gespeichert wird nur der Name.
- **Nerd Fonts von GitHub** (App): Liste des neuesten Releases, Installieren auf Klick – nur Mono + Propo in
  Regular/Bold/Italic/BoldItalic (8 Dateien) in den Benutzer-Schriftordner, nichts im Projekt
- **VS Code**: installierbare Erweiterung (`.vsix`, Oberfläche wie deine matugen-Vorlage + Syntaxfarben),
  `settings.json`-Auszug (Theme + Schrift), Theme-Datei
- **Einstellungen** (App, ⚙): Wallpaper-Ordner (wallhaven-Bilder landen dort), Export-Ordner, „jedes Mal fragen“
- **Speichern**: Themes (Farben + Schrift) bleiben lokal (IndexedDB)
- **Anwenden**: fertige Befehle
  - Windows: `wintheme --color #db79a9 --scheme vibrant --mode dark --font "Iosevka Nerd Font Mono"` (aktuelles Wallpaper)
  - Linux: `matugen color hex '#db79a9' -t scheme-vibrant -m dark`
- **Dateien**: Theme-Datei, Windows-Terminal-Schema + -Schrift, komorebi-Theme, fontgen-Profil, CSS-Variablen
- **Vorlagen**: eigene matugen- und fontgen-Vorlagen hochladen (z. B. `alacritty.toml`) → mit dem Theme ausgefüllt
  (`{{colors.<rolle>.<default|dark|light>.<hex|hex_stripped|rgb|rgba>}}`, `{{fonts.ui|mono|accent|ui_size|mono_size|ui_px|mono_px}}`, `{{mode}}`, `{{image}}`)

Gleiche Ausgangsfarbe + Variante + Modus ⇒ **identische Palette** in Studio, matugen und wintheme
(material-color-utilities, Spezifikation 2021).

## Technik

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
