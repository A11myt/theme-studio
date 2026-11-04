mod apply;
mod winapply;
mod files;
mod nerdfonts;

/// Installierte Schriftfamilien (für die Schriftauswahl): Linux über fc-list, Windows über .NET.
#[tauri::command]
fn list_fonts() -> Vec<String> {
  use std::process::Command;
  #[cfg(target_os = "windows")]
  let out = {
    use std::os::windows::process::CommandExt;
    Command::new("powershell")
      .args(["-NoProfile", "-NonInteractive", "-Command",
        "[Console]::OutputEncoding=[Text.Encoding]::UTF8; Add-Type -AssemblyName System.Drawing; (New-Object System.Drawing.Text.InstalledFontCollection).Families.Name"])
      .creation_flags(0x0800_0000)   // CREATE_NO_WINDOW: kein aufblitzendes Konsolenfenster
      .output()
  };
  #[cfg(not(target_os = "windows"))]
  let out = Command::new("fc-list").args([":", "family"]).output();
  let Ok(out) = out else { return Vec::new() };
  let mut names: Vec<String> = String::from_utf8_lossy(&out.stdout)
    .lines()
    .flat_map(|l| l.split(',').next())           // fc-list: "Name,Lokalisierter Name"
    .map(|n| n.trim().to_string())
    .filter(|n| !n.is_empty())
    .collect();
  // PowerShell gesperrt (z. B. Firmenrichtlinie)? Dann aus der Registry: "Hack Nerd Font Mono Bold (TrueType)" → Familie
  #[cfg(target_os = "windows")]
  if names.is_empty() {
    names = registry_fonts();
  }
  names.sort_by_key(|n| n.to_lowercase());
  names.dedup();
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
      winapply::host_system, winapply::win_env, winapply::fs_exists, winapply::fs_read, winapply::fs_write, winapply::backup_begin,
      winapply::reg_apply, winapply::set_wallpaper, winapply::broadcast_colors, winapply::run_tool,
      winapply::log_append, winapply::log_tail, winapply::backup_list, winapply::backup_restore
    ])
    .run(tauri::generate_context!())
    .expect("error while building tauri application");
}
