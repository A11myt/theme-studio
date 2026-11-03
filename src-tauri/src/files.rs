//! Dateien der App: wallhaven-Bilder in den Wallpaper-Ordner laden, Exporte in einen Ordner schreiben,
//! Standardordner je System. Läuft in Rust → jeder Ordner möglich (auch D:\ unter Windows), keine fs-Rechte nötig.
use std::path::{Path, PathBuf};
use tauri_plugin_http::reqwest;

fn home() -> PathBuf {
    std::env::var_os(if cfg!(windows) { "USERPROFILE" } else { "HOME" }).map(PathBuf::from).unwrap_or_default()
}

/// Vorschläge für die Einstellungen: Wallpaper- und Export-Ordner.
#[tauri::command]
pub fn default_dirs() -> (String, String) {
    let h = home();
    let wall = if cfg!(windows) { h.join("Pictures").join("Wallpapers") } else { h.join("Pictures/wallpapers") };
    (wall.to_string_lossy().into_owned(), h.join("Downloads").to_string_lossy().into_owned())
}

fn safe_name(name: &str) -> bool {
    !name.is_empty() && !name.starts_with('.') && name.len() < 200
        && name.chars().all(|c| c.is_alphanumeric() || "-_. ()".contains(c))
}

/// wallhaven-Originalbild in `dir` speichern (vorhanden → nicht erneut laden) und die Bytes zurückgeben.
#[tauri::command]
pub async fn wallhaven_download(url: String, dir: String) -> Result<tauri::ipc::Response, String> {
    let Some(rest) = url.strip_prefix("https://w.wallhaven.cc/full/") else { return Err("keine wallhaven-Adresse".into()) };
    let file = rest.rsplit('/').next().unwrap_or("");
    if !safe_name(file) || !file.starts_with("wallhaven-") {
        return Err("unerwarteter Dateiname".into());
    }
    let dir = PathBuf::from(dir);
    std::fs::create_dir_all(&dir).map_err(|e| format!("Ordner {}: {e}", dir.display()))?;
    let target = dir.join(file);
    if let Ok(bytes) = std::fs::read(&target) {
        return Ok(tauri::ipc::Response::new(bytes));
    }
    let bytes = reqwest::Client::new()
        .get(&url)
        .header("User-Agent", "theme-studio")
        .send()
        .await
        .map_err(|e| e.to_string())?
        .error_for_status()
        .map_err(|e| format!("wallhaven: {e}"))?
        .bytes()
        .await
        .map_err(|e| e.to_string())?;
    let looks_like_image = bytes.starts_with(&[0xff, 0xd8, 0xff]) || bytes.starts_with(b"\x89PNG") || bytes.starts_with(b"RIFF");
    if !looks_like_image {
        return Err("wallhaven hat kein Bild geliefert".into());
    }
    let tmp = target.with_extension("part");
    std::fs::write(&tmp, &bytes).map_err(|e| e.to_string())?;
    std::fs::rename(&tmp, &target).map_err(|e| e.to_string())?;
    Ok(tauri::ipc::Response::new(bytes.to_vec()))
}

/// Textdatei schreiben: `path` direkt (aus dem Speichern-Dialog) oder `dir` + `name` (Export-Ordner).
#[tauri::command]
pub fn save_text(path: Option<String>, dir: Option<String>, name: Option<String>, text: String) -> Result<String, String> {
    save(path, dir, name, text.as_bytes())
}

/// Binärdatei schreiben (z. B. VS-Code-Erweiterung .vsix) – Ziel wie bei save_text.
#[tauri::command]
pub fn save_bytes(path: Option<String>, dir: Option<String>, name: Option<String>, bytes: Vec<u8>) -> Result<String, String> {
    save(path, dir, name, &bytes)
}

fn save(path: Option<String>, dir: Option<String>, name: Option<String>, data: &[u8]) -> Result<String, String> {
    let target = match (path, dir, name) {
        (Some(p), _, _) => PathBuf::from(p),
        (None, Some(d), Some(n)) if safe_name(&n) => {
            std::fs::create_dir_all(&d).map_err(|e| format!("Ordner {d}: {e}"))?;
            Path::new(&d).join(n)
        }
        _ => return Err("kein gültiges Ziel".into()),
    };
    std::fs::write(&target, data).map_err(|e| format!("{}: {e}", target.display()))?;
    Ok(target.to_string_lossy().into_owned())
}

#[cfg(test)]
mod tests {
    use super::safe_name;
    #[test]
    fn dateinamen() {
        assert!(safe_name("wallhaven-yqkl97.jpg"));
        assert!(safe_name("mein theme.theme.json"));
        assert!(!safe_name("../etc/passwd"));
        assert!(!safe_name("a/b.json"));
        assert!(!safe_name(".bashrc"));
    }
}
