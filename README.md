# Theme Studio

Themes aus eigenen Bildern bauen, alle Material-You-Varianten nebeneinander vergleichen und für
**Linux (matugen)** und **Windows (wintheme)** übernehmen. Läuft lokal im Browser, alles bleibt auf dem Rechner.

```bash
pnpm install
pnpm dev          # → http://localhost:5173
```

## Was es kann

- **Bilder** hochladen (Drag & Drop) oder **auf wallhaven suchen** (nur jugendfrei, ≥ 1920×1080, wie der Launcher)
- **Ausgangsfarben**: die 4 Farben des Bildes – mit installiertem matugen exakt wie dein System,
  sonst im Browser berechnet (kann leicht abweichen) – oder eine eigene Farbe
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

Vite + React + TypeScript, `@material/material-color-utilities`, `idb-keyval`.
Der Entwicklungsserver leitet wallhaven weiter (CORS) und fragt matugen nach den Ausgangsfarben
(`POST /api/source-colors`). Ohne diesen Server (`pnpm build` als statische Seite) fehlen wallhaven
und matugen – dann rechnet der Browser.

## Später: Tauri

Der Server-Teil (wallhaven, matugen) wird dann zu Tauri-Befehlen; Port 5173 ist fest eingestellt,
damit `tauri dev` ihn direkt nutzen kann. Voraussetzung: Rust (`rustup`), dann `pnpm tauri init`.
