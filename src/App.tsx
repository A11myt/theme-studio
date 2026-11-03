import type { CSSProperties } from "react";
import { ApplyDialog } from "./components/ApplyDialog";
import { Library } from "./components/Library";
import { NerdFonts } from "./components/NerdFonts";
import { PromptWizard } from "./components/PromptWizard";
import { UpdateBanner } from "./components/UpdateBanner";
import { SettingsDialog } from "./components/SettingsDialog";
import { Wallhaven } from "./components/Wallhaven";
import { isTauri } from "./lib/platform";
import { storeSettings } from "./lib/settings";
import { SammlungPane } from "./panes/SammlungPane";
import { FarbePane } from "./panes/FarbePane";
import { SchriftPane } from "./panes/SchriftPane";
import { TerminalPane } from "./panes/TerminalPane";
import { VorschauPane } from "./panes/VorschauPane";
import { ExportPane } from "./panes/ExportPane";
import { useStudio } from "./useStudio";

export function App() {
  const s = useStudio();
  const { images, themes, templates, imageId, settings, os, setOs, name, setName, busy, toast, wallhaven, setWallhaven, showApply, setShowApply, fonts, app, setApp, showSettings, setShowSettings, showNerd, setShowNerd, setFontsKey, prompt, setPrompt, showWizard, setShowWizard, tab, setTab, past, future, undo, redo, urls, image, pal, flash, selectImage, addImages, deleteImage, saveTheme, openTheme, deleteTheme, importTheme, surprise, addTemplates, deleteTemplate, effSource, importInput, TABS } = s;

  return (
    <div className="app" style={{ "--accent": pal.primary, "--on-accent": pal.on_primary } as CSSProperties}>
      <header className="top">
        <h1>Theme Studio</h1>
        <div className="seg" role="group" aria-label="Vorschau für">
          <button type="button" aria-pressed={os === "linux"} onClick={() => setOs("linux")}>Linux</button>
          <button type="button" aria-pressed={os === "windows"} onClick={() => setOs("windows")}>Windows</button>
        </div>
        <nav className="tabs-nav" role="tablist" aria-label="Bereiche">
          {TABS.map(([id, label], i) => (
            <button key={id} type="button" role="tab" aria-selected={tab === id} onClick={() => setTab(id)}
              title={`${label} (Alt+${i + 1})`}>{label}</button>
          ))}
        </nav>
        <span className="grow" />
        <div className="tools">
          <button type="button" className="ghost" onClick={undo} disabled={!past.current.length} title="Rückgängig (Strg+Z)" aria-label="Rückgängig">↶</button>
          <button type="button" className="ghost" onClick={redo} disabled={!future.current.length} title="Wiederholen (Strg+Y)" aria-label="Wiederholen">↷</button>
          <button type="button" className="ghost" onClick={surprise} title="Zufälliges Theme (Z)">Zufall</button>
          <button type="button" className="ghost" onClick={() => importInput.current?.click()} title=".theme.json einlesen">Import</button>
          <input ref={importInput} type="file" accept=".json,application/json" hidden
            onChange={(e) => { const f = e.target.files?.[0]; if (f) void importTheme(f); e.target.value = ""; }} />
        </div>
        <button type="button" className="ghost icon" onClick={() => setShowSettings(true)} aria-label="Einstellungen" title="Einstellungen">⚙</button>
        <input className="name" value={name} onChange={(e) => setName(e.target.value)} placeholder="Name des Themes" aria-label="Name des Themes" />
        <button type="button" className={isTauri ? "ghost" : "primary"} onClick={saveTheme} title="Im Studio speichern (Strg+S)">Speichern</button>
        {isTauri && <button type="button" className="primary" onClick={() => setShowApply(true)} title="Auf diesem Rechner anwenden">Anwenden</button>}
      </header>

      <Library images={images} urls={urls} themes={themes} templates={templates} selectedImage={imageId} busy={busy}
        onAddImages={addImages} onWallhaven={() => setWallhaven({})} onSelectImage={(id) => { const i = images.find((x) => x.id === id); if (i) selectImage(i); }}
        onDeleteImage={deleteImage} onOpenTheme={openTheme} onDeleteTheme={deleteTheme}
        onAddTemplates={addTemplates} onDeleteTemplate={deleteTemplate} />

      <main className="main">
        <UpdateBanner />
        {tab === "sammlung" && <SammlungPane s={s} />}
        {tab === "farbe" && <FarbePane s={s} />}
        {tab === "schrift" && <SchriftPane s={s} />}
        {tab === "terminal" && <TerminalPane s={s} />}
        {tab === "vorschau" && <VorschauPane s={s} />}
        {tab === "export" && <ExportPane s={s} />}
      </main>

      {wallhaven && <Wallhaven wallpaperDir={app.wallpaperDir} initialColor={wallhaven.color}
        themeColors={[effSource, ...(image?.sources ?? [])]} onClose={() => setWallhaven(false)} onPick={(f) => addImages([f])} />}
      {showWizard && <PromptWizard value={prompt} c={pal} fonts={fonts} onClose={() => setShowWizard(false)}
        onDone={(o) => { setPrompt(o); flash("Prompt übernommen"); }} />}
      {showApply && <ApplyDialog settings={settings} fonts={fonts} image={image} prompt={prompt} wallpaperDir={app.wallpaperDir} onClose={() => setShowApply(false)} />}
      {showNerd && <NerdFonts onClose={() => setShowNerd(false)}
        onInstalled={(fam) => { setFontsKey((k) => k + 1); flash(`${fam} Nerd Font installiert`, 3000); }} />}
      {showSettings && <SettingsDialog value={app} onClose={() => setShowSettings(false)}
        onSave={(s) => { setApp(s); storeSettings(s); flash("Einstellungen gespeichert"); }} />}
      <div className={`toast ${toast ? "show" : ""}`} role="status" aria-live="polite">{toast}</div>
    </div>
  );
}

