mod apply;
mod files;
mod nerdfonts;

/// Installierte Schriftfamilien (für die Schriftauswahl): Linux über fc-list, Windows über .NET.
#[tauri::command]
fn list_fonts() -> Vec<String> {
  use std::process::Command;
  #[cfg(target_os = "windows")]
  let out = Command::new("powershell")
    .args(["-NoProfile", "-Command",
      "Add-Type -AssemblyName System.Drawing; (New-Object System.Drawing.Text.InstalledFontCollection).Families.Name"])
    .output();
  #[cfg(not(target_os = "windows"))]
  let out = Command::new("fc-list").args([":", "family"]).output();
  let Ok(out) = out else { return Vec::new() };
  let mut names: Vec<String> = String::from_utf8_lossy(&out.stdout)
    .lines()
    .flat_map(|l| l.split(',').next())           // fc-list: "Name,Lokalisierter Name"
    .map(|n| n.trim().to_string())
    .filter(|n| !n.is_empty())
    .collect();
  names.sort_by_key(|n| n.to_lowercase());
  names.dedup();
  names
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
      files::default_dirs, files::wallhaven_download, files::save_text, files::save_bytes, apply::apply_theme
    ])
    .run(tauri::generate_context!())
    .expect("error while building tauri application");
}
