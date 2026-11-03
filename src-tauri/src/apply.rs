//! Theme auf diesem Rechner anwenden.
//! Linux: wallthemes (Wallpaper, matugen-Vorlagen, Hooks) + fontgen (Schriften).
//! Windows: wintheme (Akzent, Terminal, VS Code, oh-my-posh, komorebi) inkl. Terminal-Schrift.
//! Programme werden direkt gestartet (ohne Shell) – Namen/Farben werden vorher geprüft.
use serde::Deserialize;
use std::collections::BTreeMap;
use std::path::PathBuf;
use std::process::Command;

const SCHEMES: [&str; 9] = ["tonal-spot", "vibrant", "expressive", "fidelity", "content", "fruit-salad", "rainbow", "neutral", "monochrome"];

#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct Fonts {
    ui: String,
    mono: String,
    accent: String,
    ui_size: f64,
    mono_size: f64,
}

#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ApplyRequest {
    image: Option<String>,               // Bilddatei auf der Platte (sonst: aktuelles Wallpaper)
    source: String,                      // tatsächliche Ausgangsfarbe (#rrggbb)
    scheme: String,
    mode: String,
    contrast: f64,
    overrides: BTreeMap<String, String>, // rolle → #rrggbb
    fonts: Option<Fonts>,
    font_profile: Option<String>,        // vorhandenes fontgen-Profil (iosevka/hack/jetbrains) oder None
}

fn is_hex(s: &str) -> bool {
    s.len() == 7 && s.starts_with('#') && s[1..].chars().all(|c| c.is_ascii_hexdigit())
}
fn is_role(s: &str) -> bool {
    !s.is_empty() && s.len() < 40 && s.chars().all(|c| c.is_ascii_lowercase() || c == '_')
}
fn is_font(s: &str) -> bool {
    !s.trim().is_empty() && s.len() < 120 && !s.chars().any(|c| c.is_control())
}

fn validate(r: &ApplyRequest) -> Result<(), String> {
    if !is_hex(&r.source) { return Err(format!("ungültige Farbe {}", r.source)); }
    if !SCHEMES.contains(&r.scheme.as_str()) { return Err(format!("unbekannte Variante {}", r.scheme)); }
    if r.mode != "dark" && r.mode != "light" { return Err(format!("ungültiger Modus {}", r.mode)); }
    if !(-1.0..=1.0).contains(&r.contrast) { return Err("Kontrast außerhalb -1 … 1".into()); }
    for (k, v) in &r.overrides {
        if !is_role(k) || !is_hex(v) { return Err(format!("ungültige Überschreibung {k}={v}")); }
    }
    if let Some(f) = &r.fonts {
        for n in [&f.ui, &f.mono, &f.accent] {
            if !is_font(n) { return Err(format!("ungültiger Schriftname „{n}“")); }
        }
    }
    if let Some(img) = &r.image {
        if !PathBuf::from(img).is_file() { return Err(format!("Bild nicht gefunden: {img}")); }
    }
    Ok(())
}

/// Programm im Benutzerordner bevorzugen (Desktop-Starter haben ~/.local/bin oft nicht im PATH).
#[cfg(not(target_os = "windows"))]
fn tool(name: &str) -> PathBuf {
    let local = PathBuf::from(std::env::var("HOME").unwrap_or_default()).join(".local/bin").join(name);
    if local.is_file() { local } else { PathBuf::from(name) }
}

fn run(cmd: &mut Command, label: &str, log: &mut Vec<String>) -> bool {
    #[cfg(target_os = "windows")]
    {
        use std::os::windows::process::CommandExt;
        cmd.creation_flags(0x0800_0000); // CREATE_NO_WINDOW
    }
    match cmd.output() {
        Ok(o) => {
            let text = String::from_utf8_lossy(&o.stdout).to_string() + &String::from_utf8_lossy(&o.stderr);
            let text = text.trim();
            log.push(format!("{} {label}{}", if o.status.success() { "✓" } else { "✗" },
                if text.is_empty() { String::new() } else { format!("\n{text}") }));
            o.status.success()
        }
        Err(e) => {
            log.push(format!("✗ {label}: {e} (installiert?)"));
            false
        }
    }
}

#[tauri::command]
pub async fn apply_theme(req: ApplyRequest) -> Result<String, String> {
    validate(&req)?;
    tauri::async_runtime::spawn_blocking(move || apply_blocking(req))
        .await
        .map_err(|e| e.to_string())?
}

#[cfg(not(target_os = "windows"))]
fn apply_blocking(r: ApplyRequest) -> Result<String, String> {
    let mut log = Vec::new();
    let mut c = Command::new(tool("wallthemes"));
    if let Some(img) = &r.image { c.arg(img); }
    c.args(["--color", &r.source, "--scheme", &r.scheme, "--mode", &r.mode, "--contrast", &r.contrast.to_string()]);
    for (k, v) in &r.overrides { c.args(["--override", &format!("{k}={v}")]); }
    let ok = run(&mut c, "Farben & Wallpaper (wallthemes)", &mut log);

    let mut fonts_ok = true;
    if let Some(p) = &r.font_profile {
        fonts_ok = run(Command::new(tool("fontgen")).args(["use", p]), &format!("Schrift: Profil {p} (fontgen)"), &mut log);
    } else if let Some(f) = &r.fonts {
        fonts_ok = run(Command::new(tool("fontgen")).args(["define", "studio", &f.ui, &f.mono, &f.accent,
            &f.ui_size.to_string(), &f.mono_size.to_string()]), "Schrift: Profil „studio“ (fontgen)", &mut log);
    }
    let text = log.join("\n");
    if ok && fonts_ok { Ok(text) } else { Err(text) }
}

#[cfg(target_os = "windows")]
fn apply_blocking(r: ApplyRequest) -> Result<String, String> {
    let mut log = Vec::new();
    let base = PathBuf::from(std::env::var("LOCALAPPDATA").map_err(|e| e.to_string())?).join("wintheme");
    let py = base.join("venv").join("Scripts").join("python.exe");
    let script = base.join("wintheme.py");
    if !py.is_file() || !script.is_file() {
        return Err("wintheme ist nicht installiert – in dotfiles-windows: .\\install.ps1".into());
    }
    let mut c = Command::new(py);
    c.arg(script);
    if let Some(img) = &r.image { c.arg(img); }
    c.args(["--color", &r.source, "--scheme", &r.scheme, "--mode", &r.mode, "--contrast", &r.contrast.to_string()]);
    if let Some(f) = &r.fonts { c.args(["--font", &f.mono]); }
    for (k, v) in &r.overrides { c.args(["--override", &format!("{k}={v}")]); }
    let ok = run(&mut c, "Windows, Terminal, VS Code, komorebi (wintheme)", &mut log);
    let text = log.join("\n");
    if ok { Ok(text) } else { Err(text) }
}

#[cfg(test)]
mod tests {
    use super::*;
    fn req() -> ApplyRequest {
        ApplyRequest { image: None, source: "#db79a9".into(), scheme: "vibrant".into(), mode: "dark".into(), contrast: 0.0,
            overrides: BTreeMap::new(), fonts: None, font_profile: None }
    }
    #[test]
    fn pruefung() {
        assert!(validate(&req()).is_ok());
        let mut r = req(); r.source = "rot".into(); assert!(validate(&r).is_err());
        let mut r = req(); r.scheme = "x; rm".into(); assert!(validate(&r).is_err());
        let mut r = req(); r.overrides.insert("primary".into(), "#00ff00".into()); assert!(validate(&r).is_ok());
        let mut r = req(); r.overrides.insert("pri mary".into(), "#00ff00".into()); assert!(validate(&r).is_err());
        let mut r = req(); r.contrast = 3.0; assert!(validate(&r).is_err());
        let mut r = req(); r.image = Some("/gibt/es/nicht.jpg".into()); assert!(validate(&r).is_err());
    }
}
