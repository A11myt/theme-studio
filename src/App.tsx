import type { CSSProperties } from "react";
import { ApplyDialog } from "./components/ApplyDialog";
import { WindowsApply } from "./components/WindowsApply";
import { Library } from "./components/Library";
import { NerdFonts } from "./components/NerdFonts";
import { PromptWizard } from "./components/PromptWizard";
import { UpdateBanner } from "./components/UpdateBanner";
import { SettingsDialog } from "./components/SettingsDialog";
import { MoreMenu } from "./components/MoreMenu";
import { FirstRun } from "./components/FirstRun";
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
import { t, useLang } from "./lib/i18n";

export function App() {
  useLang();                       // Sprachwechsel → alles neu zeichnen
  const s = useStudio();
  const { images, themes, templates, imageId, settings, name, setName, busy, toast, wallhaven, setWallhaven, showApply, setShowApply, fonts, app, setApp, showSettings, setShowSettings, showNerd, setShowNerd, setFontsKey, prompt, setPrompt, showWizard, setShowWizard, tab, setTab, past, future, undo, redo, urls, image, pal, flash, selectImage, addImages, deleteImage, saveTheme, openTheme, deleteTheme, importTheme, surprise, addTemplates, deleteTemplate, effSource, importInput, TABS, singleKeys, setSingleKeys, themeName, shareTheme, libOpen, setLibOpen, systemChoice, setSystemChoice, detected, system } = s;

  return (
    <div className={`app ${libOpen ? "" : "lib-closed"}`} style={{ "--accent": pal.primary, "--on-accent": pal.on_primary } as CSSProperties}>
      <a className="skip" href="#bereich">{t("Zum Inhalt springen")}</a>
      <header className="top">
        <h1>Theme Studio</h1>
        <nav className="tabs-nav" role="tablist" aria-label={t("Bereiche")}
          onKeyDown={(e) => {
            // Pfeiltasten/Pos1/Ende wechseln den Bereich (WAI-ARIA Tabs)
            const i = TABS.findIndex(([id]) => id === tab);
            const n = { ArrowRight: i + 1, ArrowLeft: i - 1, Home: 0, End: TABS.length - 1 }[e.key];
            if (n === undefined) return;
            e.preventDefault();
            const id = TABS[(n + TABS.length) % TABS.length][0];
            setTab(id);
            requestAnimationFrame(() => document.getElementById(`tab-${id}`)?.focus());
          }}>
          {TABS.map(([id, label], i) => (
            <button key={id} id={`tab-${id}`} type="button" role="tab" aria-selected={tab === id} aria-controls="bereich"
              className={id === "sammlung" ? "tab-lib" : ""}
              tabIndex={tab === id ? 0 : -1} onClick={() => setTab(id)} title={`${t(label)} (Alt+${i + 1})`}>
              {id !== "sammlung" && <span className="step" aria-hidden="true">{i + 1}</span>}{t(label)}</button>
          ))}
        </nav>
        <span className="grow" />
        <div className="tools">
          <button type="button" className="ghost" onClick={undo} disabled={!past.current.length} title={t("Rückgängig (Strg+Z)")} aria-label={t("Rückgängig")}>↶</button>
          <button type="button" className="ghost" onClick={redo} disabled={!future.current.length} title={t("Wiederholen (Strg+Y)")} aria-label={t("Wiederholen")}>↷</button>
          <MoreMenu items={[
            { label: t("Zufälliges Theme"), hint: "Z", onSelect: surprise },
            { label: t("Theme-Datei importieren …"), onSelect: () => importInput.current?.click() },
            { label: t("Link zu diesem Theme kopieren"), onSelect: () => void shareTheme(themeName, settings, fonts) },
            { label: libOpen ? t("Seitenleiste ausblenden") : t("Seitenleiste einblenden"), hint: "B", onSelect: () => setLibOpen(!libOpen) },
          ]} />
          <input ref={importInput} type="file" accept=".json,application/json" hidden
            onChange={(e) => { const f = e.target.files?.[0]; if (f) void importTheme(f); e.target.value = ""; }} />
        </div>
        <button type="button" className="ghost icon" onClick={() => setShowSettings(true)} aria-label={t("Einstellungen")} title={t("Einstellungen")}>⚙</button>
        <input className="name" value={name} onChange={(e) => setName(e.target.value)} placeholder={t("Name des Themes")} aria-label={t("Name des Themes")} />
        <button type="button" className={isTauri ? "ghost" : "primary"} onClick={saveTheme} title={t("Im Studio speichern (Strg+S)")}>{t("Speichern")}</button>
        {isTauri && <button type="button" className="primary" onClick={() => setShowApply(true)} title={t("Auf diesem Rechner anwenden ({sys})", { sys: system === "windows" ? "Windows" : "Linux" })}>{t("Anwenden")}</button>}
      </header>

      {libOpen && <Library images={images} urls={urls} themes={themes} templates={templates} selectedImage={imageId} busy={busy}
        onAddImages={addImages} onWallhaven={() => setWallhaven({})} onSelectImage={(id) => { const i = images.find((x) => x.id === id); if (i) selectImage(i); }}
        onDeleteImage={deleteImage} onOpenTheme={openTheme} onDeleteTheme={deleteTheme}
        onAddTemplates={addTemplates} onDeleteTemplate={deleteTemplate} />}

      <main className="main" id="bereich" tabIndex={-1} role="tabpanel" aria-labelledby={`tab-${tab}`}>
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
        onDone={(o) => { setPrompt(o); flash(t("Prompt übernommen")); }} />}
      {showApply && (system === "windows"
        ? <WindowsApply name={themeName} settings={settings} fonts={fonts} image={image} prompt={prompt} wallpaperDir={app.wallpaperDir} onClose={() => setShowApply(false)} />
        : <ApplyDialog settings={settings} fonts={fonts} image={image} prompt={prompt} wallpaperDir={app.wallpaperDir} onClose={() => setShowApply(false)} />)}
      {showNerd && <NerdFonts onClose={() => setShowNerd(false)}
        onInstalled={(fam) => { setFontsKey((k) => k + 1); flash(t("{fam} Nerd Font installiert", { fam }), 3000); }} />}
      {showSettings && <SettingsDialog value={app} singleKeys={singleKeys} onSingleKeys={setSingleKeys}
        system={systemChoice ?? "auto"} detected={detected} onSystem={setSystemChoice} onClose={() => setShowSettings(false)}
        onSave={(s) => { setApp(s); storeSettings(s); flash(t("Einstellungen gespeichert")); }} />}
      {isTauri && systemChoice === null && <FirstRun detected={detected} onChoose={setSystemChoice} />}
      <div className={`toast ${toast ? "show" : ""}`} role="status" aria-live="polite">{toast}</div>
    </div>
  );
}

