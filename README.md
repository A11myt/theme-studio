# Theme Studio

Themes aus eigenen Bildern bauen, alle Material-You-Varianten nebeneinander vergleichen und für
**Linux (matugen)** und **Windows (wintheme)** übernehmen. Läuft lokal im Browser, alles bleibt auf dem Rechner.

```bash
pnpm install
pnpm dev          # → http://localhost:5173
```

## Was es kann

- **Bilder** hochladen (Drag & Drop) oder **auf wallhaven suchen** (nur jugendfrei, ≥ 1920×1080, wie der Launcher)
- **Ausgangsfarben**: die 4 Farben des Bildes – **exakt wie matugen**, weil matugens eigener Rust-Code
  (material-colors 0.4.2) als WebAssembly im Browser läuft; geprüft mit 13 Wallpapern – oder eine eigene Farbe
- **9 Varianten** (tonal-spot, vibrant, expressive …) als Mini-Desktops: Linux-Leiste mit Bubbles oder
  Windows mit komorebi-Leiste und Terminal, jeweils auf dem Wallpaper
- **Hell/Dunkel, Kontrast**, komplette Palette (Klick kopiert die Farbe)
- **Speichern**: Themes bleiben im Browser (IndexedDB)
- **Anwenden**: fertige Befehle
  - Windows: `wintheme --color #db79a9 --scheme vibrant --mode dark` (färbt das aktuelle Wallpaper)
  - Linux: `matugen color hex '#db79a9' -t scheme-vibrant -m dark`
- **Dateien**: Theme-Datei, Windows-Terminal-Schema, komorebi-Theme, CSS-Variablen
- **Vorlagen**: eigene matugen-Vorlagen hochladen (z. B. `alacritty.toml`) → mit dem Theme ausgefüllt
  (`{{colors.<rolle>.<default|dark|light>.<hex|hex_stripped|rgb|rgba>}}`, `{{mode}}`, `{{image}}`)

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

## Später: Tauri

Der Server-Teil (wallhaven, matugen) wird dann zu Tauri-Befehlen; Port 5173 ist fest eingestellt,
damit `tauri dev` ihn direkt nutzen kann. Unter Arch zusätzlich:
`sudo pacman -S --needed webkit2gtk-4.1 libappindicator-gtk3 librsvg`.
