// Alles bleibt lokal im Browser (IndexedDB): hochgeladene Bilder, gespeicherte Themes, matugen-Vorlagen.
import { createStore, del, entries, set } from "idb-keyval";
import type { ThemeSettings } from "./color";

export interface StoredImage {
  id: string;
  name: string;
  blob: Blob;
  sources: string[];      // Ausgangsfarben (berechnet beim Hochladen)
  engine?: "matugen" | "browser";
  added: number;
}

export interface StoredTheme {
  id: string;
  name: string;
  imageId?: string;       // Bild, aus dem das Theme entstand (optional: auch reine Farbe möglich)
  settings: ThemeSettings;
  created: number;
}

export interface StoredTemplate {
  id: string;
  name: string;           // Dateiname der Vorlage, z. B. alacritty.toml
  output: string;         // Dateiname der Ausgabe
  text: string;
  added: number;
}

const images = createStore("theme-studio-images", "images");
const themes = createStore("theme-studio-themes", "themes");
const templates = createStore("theme-studio-templates", "templates");

const all = async <T>(store: ReturnType<typeof createStore>) =>
  (await entries<string, T>(store)).map(([, v]) => v);

export const uid = () => crypto.randomUUID();

export const db = {
  images: () => all<StoredImage>(images),
  putImage: (i: StoredImage) => set(i.id, i, images),
  deleteImage: (id: string) => del(id, images),
  themes: () => all<StoredTheme>(themes),
  putTheme: (t: StoredTheme) => set(t.id, t, themes),
  deleteTheme: (id: string) => del(id, themes),
  templates: () => all<StoredTemplate>(templates),
  putTemplate: (t: StoredTemplate) => set(t.id, t, templates),
  deleteTemplate: (id: string) => del(id, templates),
};
