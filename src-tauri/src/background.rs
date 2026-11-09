//! Hintergrundbetrieb: Symbol im Infobereich (Öffnen, Theme anwenden, Automatisch einfärben, Beenden),
//! Schließen → im Infobereich weiterlaufen, Wallpaper-Wächter (Windows) und Autostart (nur installierte Version).
//! Beschriftungen und Theme-Liste kommen von der Oberfläche (Sprache!), Klicks gehen als Ereignisse zurück.
use serde::Deserialize;
use std::sync::atomic::{AtomicBool, Ordering};
use std::sync::Mutex;
use tauri::menu::{CheckMenuItem, Menu, MenuItem, PredefinedMenuItem, Submenu};
use tauri::tray::{MouseButton, MouseButtonState, TrayIconBuilder, TrayIconEvent};
use tauri::{AppHandle, Emitter, Manager, WindowEvent};

static CLOSE_TO_TRAY: AtomicBool = AtomicBool::new(false);
/// Wallpaper, das die App gerade selbst gesetzt hat – dessen Wechsel löst kein automatisches Einfärben aus.
static OWN_WALLPAPER: Mutex<String> = Mutex::new(String::new());

pub fn note_own_wallpaper(path: &str) {
    if let Ok(mut w) = OWN_WALLPAPER.lock() {
        *w = path.to_lowercase();
    }
}

#[derive(Deserialize)]
pub struct TrayTheme {
    id: String,
    name: String,
}
#[derive(Deserialize)]
pub struct TrayLabels {
    open: String,
    apply: String,
    no_themes: String,
    auto: String,
    quit: String,
    tooltip: String,
}

fn show_main(app: &AppHandle) {
    if let Some(w) = app.get_webview_window("main") {
        let _ = w.show();
        let _ = w.unminimize();
        let _ = w.set_focus();
    }
}

/// Beim Start: Symbol anlegen (erst mit Platzhalter-Menü, die Oberfläche liefert gleich das echte), Schließen abfangen.
pub fn setup(app: &tauri::App, start_hidden: bool) -> tauri::Result<()> {
    // Infobereich nur unter Windows (unter Linux macht das die eigene Leiste, und appindicator fehlt oft)
    if cfg!(windows) {
        build_tray(app)?;
    }
    if let Some(w) = app.get_webview_window("main") {
        let win = w.clone();
        w.on_window_event(move |ev| {
            if let WindowEvent::CloseRequested { api, .. } = ev
                && CLOSE_TO_TRAY.load(Ordering::Relaxed)
            {
                api.prevent_close();
                let _ = win.hide();
            }
        });
        if start_hidden && cfg!(windows) {
            let _ = w.hide();
        }
    }
    #[cfg(windows)]
    watch_wallpaper(app.handle().clone());
    Ok(())
}

fn build_tray(app: &tauri::App) -> tauri::Result<()> {
    let h = app.handle();
    let open = MenuItem::with_id(h, "open", "Theme Studio", true, None::<&str>)?;
    let quit = MenuItem::with_id(h, "quit", "Quit", true, None::<&str>)?;
    let menu = Menu::with_items(h, &[&open, &quit])?;
    let mut tray = TrayIconBuilder::with_id("main").menu(&menu).show_menu_on_left_click(false).tooltip("Theme Studio");
    if let Some(icon) = app.default_window_icon() {
        tray = tray.icon(icon.clone());
    }
    tray.on_menu_event(|app, ev| {
        let id = ev.id().as_ref();
        match id {
            "open" => show_main(app),
            "quit" => app.exit(0),
            "auto" => {
                let _ = app.emit("tray-auto", ());
            }
            _ if id.starts_with("theme:") => {
                let _ = app.emit("tray-apply-theme", id.trim_start_matches("theme:").to_string());
            }
            _ => {}
        }
    })
    .on_tray_icon_event(|tray, ev| {
        if let TrayIconEvent::Click { button: MouseButton::Left, button_state: MouseButtonState::Up, .. } = ev {
            show_main(tray.app_handle());
        }
    })
    .build(app)?;
    Ok(())
}

/// Menü neu aufbauen (Sprache, gespeicherte Themes, Haken bei „Automatisch einfärben“).
#[tauri::command]
pub fn tray_update(app: AppHandle, labels: TrayLabels, themes: Vec<TrayTheme>, auto: bool) -> Result<(), String> {
    let e = |x: tauri::Error| x.to_string();
    let open = MenuItem::with_id(&app, "open", &labels.open, true, None::<&str>).map_err(e)?;
    let sub = Submenu::with_id(&app, "themes", &labels.apply, true).map_err(e)?;
    if themes.is_empty() {
        sub.append(&MenuItem::with_id(&app, "none", &labels.no_themes, false, None::<&str>).map_err(e)?).map_err(e)?;
    }
    for t in themes.iter().take(25) {
        sub.append(&MenuItem::with_id(&app, format!("theme:{}", t.id), &t.name, true, None::<&str>).map_err(e)?).map_err(e)?;
    }
    let auto_item = CheckMenuItem::with_id(&app, "auto", &labels.auto, cfg!(windows), auto, None::<&str>).map_err(e)?;
    let sep = PredefinedMenuItem::separator(&app).map_err(e)?;
    let sep2 = PredefinedMenuItem::separator(&app).map_err(e)?;
    let quit = MenuItem::with_id(&app, "quit", &labels.quit, true, None::<&str>).map_err(e)?;
    let menu = Menu::with_items(&app, &[&open, &sep, &sub, &auto_item, &sep2, &quit]).map_err(e)?;
    if let Some(tray) = app.tray_by_id("main") {
        tray.set_menu(Some(menu)).map_err(e)?;
        tray.set_tooltip(Some(&labels.tooltip)).map_err(e)?;
    }
    Ok(())
}

/// Schließen → im Infobereich weiterlaufen (an/aus).
#[tauri::command]
pub fn bg_close_to_tray(on: bool) {
    CLOSE_TO_TRAY.store(on, Ordering::Relaxed);
}

/// Aktuelles Windows-Wallpaper als Bytes (für die Ausgangsfarben) – roh, nicht als JSON-Zahlenliste.
#[tauri::command]
pub fn wallpaper_bytes() -> Result<tauri::ipc::Response, String> {
    let path = current_wallpaper().ok_or("kein Wallpaper gefunden")?;
    std::fs::read(&path).map(tauri::ipc::Response::new).map_err(|e| format!("{path}: {e}"))
}

/// Pfad des aktuellen Wallpapers (Diashow/Spotlight: die von Windows umgerechnete Kopie).
pub fn current_wallpaper() -> Option<String> {
    #[cfg(windows)]
    {
        use windows_sys::Win32::UI::WindowsAndMessaging::{SystemParametersInfoW, SPI_GETDESKWALLPAPER};
        let mut buf = [0u16; 1024];
        let ok = unsafe { SystemParametersInfoW(SPI_GETDESKWALLPAPER, buf.len() as u32, buf.as_mut_ptr().cast(), 0) };
        let p = if ok != 0 { String::from_utf16_lossy(&buf[..buf.iter().position(|&c| c == 0).unwrap_or(0)]) } else { String::new() };
        if !p.is_empty() && std::path::Path::new(&p).is_file() {
            return Some(p);
        }
        let t = std::env::var("APPDATA").ok()? + r"\Microsoft\Windows\Themes\TranscodedWallpaper";
        std::path::Path::new(&t).is_file().then_some(t)
    }
    #[cfg(not(windows))]
    None
}

/// Alle 3 s schauen, ob sich das Wallpaper geändert hat (Pfad oder Datei) → Ereignis „wallpaper-changed“.
#[cfg(windows)]
fn watch_wallpaper(app: AppHandle) {
    std::thread::spawn(move || {
        let stamp = || {
            let p = current_wallpaper()?;
            let m = std::fs::metadata(&p).ok()?.modified().ok()?;
            Some((p, m))
        };
        let mut last = stamp();
        loop {
            std::thread::sleep(std::time::Duration::from_secs(3));
            let now = stamp();
            if now.is_some() && now != last {
                let path = now.as_ref().map(|(p, _)| p.clone()).unwrap_or_default();
                let own = OWN_WALLPAPER.lock().map(|w| *w == path.to_lowercase()).unwrap_or(false);
                if !own {
                    let _ = app.emit("wallpaper-changed", path);
                }
                last = now;
            }
        }
    });
}

// ── Autostart (nur installierte Version: die portable exe kann umziehen) ──────

#[cfg_attr(not(windows), allow(dead_code))]
const RUN_KEY: &str = r"Software\Microsoft\Windows\CurrentVersion\Run";
#[cfg_attr(not(windows), allow(dead_code))]
const RUN_NAME: &str = "Theme Studio";

/// Läuft diese exe aus der Installation (Uninstall-Eintrag zeigt auf ihren Ordner)?
#[tauri::command]
pub fn is_installed() -> bool {
    #[cfg(windows)]
    {
        use winreg::{enums::*, RegKey};
        let exe_dir = std::env::current_exe().ok().and_then(|p| p.parent().map(|d| d.to_string_lossy().to_lowercase())).unwrap_or_default();
        for hive in [HKEY_CURRENT_USER, HKEY_LOCAL_MACHINE] {
            let Ok(un) = RegKey::predef(hive).open_subkey(r"Software\Microsoft\Windows\CurrentVersion\Uninstall") else { continue };
            for name in un.enum_keys().flatten() {
                let Ok(k) = un.open_subkey(&name) else { continue };
                let disp: String = k.get_value("DisplayName").unwrap_or_default();
                let loc: String = k.get_value("InstallLocation").unwrap_or_default();
                if disp == "Theme Studio" && !loc.is_empty() && exe_dir.starts_with(loc.trim_matches('"').trim_end_matches('\\').to_lowercase().as_str()) {
                    return true;
                }
            }
        }
        false
    }
    #[cfg(not(windows))]
    false
}

#[tauri::command]
pub fn autostart_get() -> bool {
    #[cfg(windows)]
    {
        use winreg::{enums::*, RegKey};
        RegKey::predef(HKEY_CURRENT_USER).open_subkey(RUN_KEY).and_then(|k| k.get_value::<String, _>(RUN_NAME)).is_ok()
    }
    #[cfg(not(windows))]
    false
}

/// Mit Windows starten (unsichtbar im Infobereich) an/aus.
#[tauri::command]
pub fn autostart_set(on: bool) -> Result<(), String> {
    #[cfg(windows)]
    {
        use winreg::{enums::*, RegKey};
        let (k, _) = RegKey::predef(HKEY_CURRENT_USER).create_subkey(RUN_KEY).map_err(|e| e.to_string())?;
        if on {
            if !is_installed() {
                return Err("nur in der installierten Version".into());
            }
            let exe = std::env::current_exe().map_err(|e| e.to_string())?;
            k.set_value(RUN_NAME, &format!("\"{}\" --background", exe.display())).map_err(|e| e.to_string())
        } else {
            let _ = k.delete_value(RUN_NAME);
            Ok(())
        }
    }
    #[cfg(not(windows))]
    {
        let _ = on;
        Err("nur unter Windows".into())
    }
}
