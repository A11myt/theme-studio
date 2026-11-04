//! Nerd Fonts von GitHub (ryanoasis/nerd-fonts, neuestes Release) auflisten und für den Benutzer installieren.
//! Linux: ~/.local/share/fonts/NerdFonts/<Name> + fc-cache · Windows: Benutzer-Schriftordner + Registry (ohne Admin).
//! Nichts davon liegt im Projekt: Liste live von GitHub, installiert wird nur auf Klick und nur 8 Dateien je Schrift.
use serde::Serialize;
use std::io::Read;
use std::path::PathBuf;
use tauri_plugin_http::reqwest;

const API: &str = "https://api.github.com/repos/ryanoasis/nerd-fonts/releases/latest";
const UA: &str = "theme-studio";

#[derive(Serialize)]
pub struct NerdFont {
    name: String,     // z. B. "Hack"
    size: u64,        // Bytes der ZIP
    url: String,
    version: String,
}

#[derive(Serialize)]
pub struct Installed {
    files: usize,
    dir: String,
}

#[tauri::command]
pub async fn nerd_fonts_list() -> Result<Vec<NerdFont>, String> {
    let v: serde_json::Value = reqwest::Client::new()
        .get(API)
        .header("User-Agent", UA)
        .send()
        .await
        .map_err(|e| e.to_string())?
        .error_for_status()
        .map_err(|e| format!("GitHub: {e}"))?
        .text()
        .await
        .map_err(|e| e.to_string())
        .and_then(|t| serde_json::from_str(&t).map_err(|e| e.to_string()))?;
    let version = v["tag_name"].as_str().unwrap_or("").to_string();
    let mut list: Vec<NerdFont> = v["assets"]
        .as_array()
        .into_iter()
        .flatten()
        .filter_map(|a| {
            let file = a["name"].as_str()?;
            let name = file.strip_suffix(".zip")?;
            Some(NerdFont {
                name: name.to_string(),
                size: a["size"].as_u64().unwrap_or(0),
                url: a["browser_download_url"].as_str()?.to_string(),
                version: version.clone(),
            })
        })
        .collect();
    list.sort_by_key(|f| f.name.to_lowercase());
    Ok(list)
}

fn font_dir(name: &str) -> Result<PathBuf, String> {
    #[cfg(target_os = "windows")]
    {
        let base = std::env::var("LOCALAPPDATA").map_err(|e| e.to_string())?;
        let _ = name;
        Ok(PathBuf::from(base).join("Microsoft").join("Windows").join("Fonts"))
    }
    #[cfg(not(target_os = "windows"))]
    {
        let home = std::env::var("HOME").map_err(|e| e.to_string())?;
        Ok(PathBuf::from(home).join(".local/share/fonts/NerdFonts").join(name))
    }
}

#[tauri::command]
pub async fn nerd_font_install(name: String, url: String) -> Result<Installed, String> {
    // nur echte Release-Dateien von nerd-fonts annehmen
    let ok_name = !name.is_empty() && name.chars().all(|c| c.is_ascii_alphanumeric() || c == '-' || c == '_');
    if !ok_name || !url.starts_with("https://github.com/ryanoasis/nerd-fonts/releases/download/") {
        return Err("ungültige Schrift".into());
    }
    let bytes = reqwest::Client::new()
        .get(&url)
        .header("User-Agent", UA)
        .send()
        .await
        .map_err(|e| e.to_string())?
        .error_for_status()
        .map_err(|e| format!("Download: {e}"))?
        .bytes()
        .await
        .map_err(|e| e.to_string())?;

    let dir = font_dir(&name)?;
    std::fs::create_dir_all(&dir).map_err(|e| e.to_string())?;
    let mut zip = zip::ZipArchive::new(std::io::Cursor::new(bytes)).map_err(|e| e.to_string())?;
    let mut written = Vec::new();
    for i in 0..zip.len() {
        let mut entry = zip.by_index(i).map_err(|e| e.to_string())?;
        // nur Schriftdateien, flach (ohne Unterordner aus der ZIP) → kein Pfad außerhalb des Zielordners
        let Some(file) = entry.enclosed_name().and_then(|p| p.file_name().map(|f| f.to_owned())) else { continue };
        if !wanted(&file.to_string_lossy()) {
            continue;
        }
        let mut data = Vec::new();
        entry.read_to_end(&mut data).map_err(|e| e.to_string())?;
        let target = dir.join(&file);
        std::fs::write(&target, data).map_err(|e| e.to_string())?;
        written.push(target);
    }
    if written.is_empty() {
        return Err("keine Schriftdateien in der ZIP".into());
    }
    register(&written)?;
    Ok(Installed { files: written.len(), dir: dir.to_string_lossy().into_owned() })
}

/// Nur das Nötige installieren (kein Bloat): Mono- und Propo-Variante, je Regular/Bold/Italic/BoldItalic.
/// Beispiel: HackNerdFontMono-Regular.ttf, IosevkaNerdFontPropo-BoldItalic.ttf
fn wanted(file: &str) -> bool {
    let lower = file.to_lowercase();
    let Some(stem) = lower.strip_suffix(".ttf").or_else(|| lower.strip_suffix(".otf")) else { return false };
    let Some((family, style)) = stem.rsplit_once('-') else { return false };
    (family.ends_with("nerdfontmono") || family.ends_with("nerdfontpropo"))
        && matches!(style, "regular" | "bold" | "italic" | "bolditalic")
}

#[cfg(not(target_os = "windows"))]
fn register(_files: &[PathBuf]) -> Result<(), String> {
    let _ = std::process::Command::new("fc-cache").arg("-f").status();
    Ok(())
}

#[cfg(target_os = "windows")]
fn register(files: &[PathBuf]) -> Result<(), String> {
    // Benutzer-Schriften: HKCU\...\Fonts "<Datei> (TrueType)" = voller Pfad; danach WM_FONTCHANGE senden
    use winreg::{enums::HKEY_CURRENT_USER, RegKey};
    let (key, _) = RegKey::predef(HKEY_CURRENT_USER)
        .create_subkey(r"Software\Microsoft\Windows NT\CurrentVersion\Fonts")
        .map_err(|e| e.to_string())?;
    for f in files {
        let stem = f.file_stem().map(|s| s.to_string_lossy().into_owned()).unwrap_or_default();
        key.set_value(format!("{stem} (TrueType)"), &f.to_string_lossy().into_owned())
            .map_err(|e| e.to_string())?;
    }
    // Sofort in dieser Sitzung verfügbar machen (sonst erst nach Ab-/Anmelden) und alle Programme benachrichtigen
    use windows_sys::Win32::Graphics::Gdi::AddFontResourceW;
    use windows_sys::Win32::UI::WindowsAndMessaging::{SendMessageTimeoutW, HWND_BROADCAST, SMTO_ABORTIFHUNG, WM_FONTCHANGE};
    for f in files {
        let w: Vec<u16> = f.to_string_lossy().encode_utf16().chain(std::iter::once(0)).collect();
        unsafe { AddFontResourceW(w.as_ptr()) };
    }
    let mut res = 0usize;
    unsafe { SendMessageTimeoutW(HWND_BROADCAST, WM_FONTCHANGE, 0, 0, SMTO_ABORTIFHUNG, 1000, &mut res) };
    Ok(())
}

#[cfg(test)]
mod tests {
    use super::wanted;
    #[test]
    fn nur_benoetigte_schnitte() {
        assert!(wanted("HackNerdFontMono-Regular.ttf"));
        assert!(wanted("IosevkaNerdFontPropo-BoldItalic.ttf"));
        assert!(!wanted("HackNerdFont-Regular.ttf"));            // Standard-Variante: nicht nötig
        assert!(!wanted("IosevkaNerdFontMono-ExtraLight.ttf"));
        assert!(!wanted("IosevkaNerdFontMono-SemiBoldObliqueExtended.ttf"));
        assert!(!wanted("README.md"));
    }
}
