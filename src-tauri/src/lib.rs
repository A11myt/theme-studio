mod apply;
mod winapply;
mod background;
mod files;
mod nerdfonts;

/// Installierte Schriftfamilien (für die Schriftauswahl): Linux über fc-list, Windows über .NET.
#[tauri::command]
fn list_fonts() -> Vec<String> {
  #[cfg(target_os = "windows")]
  let mut names = gdi_fonts();
  #[cfg(not(target_os = "windows"))]
  let mut names: Vec<String> = {
    let Ok(out) = std::process::Command::new("fc-list").args([":", "family"]).output() else { return Vec::new() };
    String::from_utf8_lossy(&out.stdout)
      .lines()
      .flat_map(|l| l.split(',').next())           // fc-list: "Name,Lokalisierter Name"
      .map(|n| n.trim().to_string())
      .filter(|n| !n.is_empty())
      .collect()
  };
  names.sort_by_key(|n| n.to_lowercase());
  names.dedup();
  names
}

/// Alle Schriftfamilien direkt von Windows (GDI) – dieselben Namen, die Terminal und VS Code verwenden.
#[cfg(target_os = "windows")]
fn gdi_fonts() -> Vec<String> {
  use windows_sys::Win32::Foundation::LPARAM;
  use windows_sys::Win32::Graphics::Gdi::{EnumFontFamiliesExW, GetDC, ReleaseDC, DEFAULT_CHARSET, LOGFONTW, TEXTMETRICW};
  unsafe extern "system" fn each(lf: *const LOGFONTW, _tm: *const TEXTMETRICW, _ty: u32, lp: LPARAM) -> i32 {
    let names = &mut *(lp as *mut Vec<String>);
    let face = &(*lf).lfFaceName;
    let len = face.iter().position(|&c| c == 0).unwrap_or(face.len());
    let name = String::from_utf16_lossy(&face[..len]);
    if !name.is_empty() && !name.starts_with('@') { names.push(name); }   // @… = vertikale Varianten
    1
  }
  let mut names: Vec<String> = Vec::new();
  unsafe {
    let dc = GetDC(std::ptr::null_mut());
    let mut lf: LOGFONTW = std::mem::zeroed();
    lf.lfCharSet = DEFAULT_CHARSET as u8;
    EnumFontFamiliesExW(dc, &lf, Some(each), &mut names as *mut Vec<String> as LPARAM, 0);
    ReleaseDC(std::ptr::null_mut(), dc);
  }
  if names.is_empty() { names = registry_fonts(); }
  names
}

#[cfg(target_os = "windows")]
fn registry_fonts() -> Vec<String> {
  use winreg::{enums::*, RegKey};
  let mut out = Vec::new();
  for hive in [HKEY_LOCAL_MACHINE, HKEY_CURRENT_USER] {
    let Ok(k) = RegKey::predef(hive).open_subkey(r"Software\Microsoft\Windows NT\CurrentVersion\Fonts") else { continue };
    for (name, _) in k.enum_values().flatten() {
      out.push(font_family(&name));
    }
  }
  out
}

/// Registry-Name einer Schrift → Familienname (Stil und „(TrueType)“ weg; „A & B“ = zwei Familien → erste).
#[cfg_attr(not(target_os = "windows"), allow(dead_code))]
fn font_family(reg_name: &str) -> String {
  let mut n = reg_name.split(" (").next().unwrap_or(reg_name).split(" & ").next().unwrap_or("").trim().to_string();
  for style in ["Bold Italic", "BoldItalic", "Italic", "Bold", "Regular", "Oblique", "Light", "Medium", "SemiBold", "Thin", "ExtraLight", "ExtraBold", "Black"] {
    if let Some(x) = n.strip_suffix(&format!(" {style}")) { n = x.to_string(); }
  }
  n
}

#[cfg(test)]
mod tests {
  #[test]
  fn font_family_from_registry() {
    assert_eq!(super::font_family("Hack Nerd Font Mono Bold Italic (TrueType)"), "Hack Nerd Font Mono");
    assert_eq!(super::font_family("Cascadia Mono Regular (TrueType)"), "Cascadia Mono");
    assert_eq!(super::font_family("Cambria & Cambria Math (TrueType)"), "Cambria");
    assert_eq!(super::font_family("Consolas"), "Consolas");
  }
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
  tauri::Builder::default()
    .plugin(tauri_plugin_http::init())
    .plugin(tauri_plugin_dialog::init())
    .plugin(tauri_plugin_clipboard_manager::init())
    .plugin(tauri_plugin_updater::Builder::new().build())
    .plugin(tauri_plugin_process::init())
    .setup(|app| {
      // Hintergrund: Symbol im Infobereich, Wallpaper-Wächter; „--background“ (Autostart) startet unsichtbar
      background::setup(app, std::env::args().any(|a| a == "--background"))?;
      if cfg!(debug_assertions) {
        app.handle().plugin(
          tauri_plugin_log::Builder::default()
            .level(log::LevelFilter::Info)
            .build(),
        )?;
      }
      Ok(())
    })
    .invoke_handler(tauri::generate_handler![list_fonts, nerdfonts::nerd_fonts_list, nerdfonts::nerd_font_install,
      files::default_dirs, files::wallhaven_download, files::save_text, files::save_bytes, apply::apply_theme,
      background::tray_update, background::bg_close_to_tray, background::wallpaper_bytes, background::is_installed, background::autostart_get, background::autostart_set, winapply::host_system, winapply::orig_get, winapply::orig_set_once, winapply::fs_backup, winapply::fs_remove, winapply::remove_wintheme, winapply::stop_process, winapply::process_count, winapply::restart_explorer, winapply::reg_get, winapply::ps_policy, winapply::win_env, winapply::fs_exists, winapply::fs_read, winapply::fs_write, winapply::backup_begin,
      winapply::reg_apply, winapply::set_wallpaper, winapply::broadcast_colors, winapply::run_tool,
      winapply::log_append, winapply::log_tail, winapply::backup_list, winapply::backup_restore
    ])
    .run(tauri::generate_context!())
    .expect("error while building tauri application");
}
