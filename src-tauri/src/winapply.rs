//! Bausteine für „Anwenden“ unter Windows (die Abläufe selbst stehen in src/lib/windows/*.ts):
//! Umgebung erkennen, Dateien lesen/schreiben mit Sicherung, Registry mit Sicherung, Wallpaper,
//! Farbwechsel melden, komorebic starten, Protokoll, Rückgängig.
//! Jede Änderung landet vorher in einer Sicherung (%APPDATA%\theme-studio\backups\<zeit>\) – Rückgängig stellt sie her.
use serde::{Deserialize, Serialize};
use std::collections::BTreeMap;
use std::io::Write;
use std::path::{Path, PathBuf};

fn env_path(k: &str) -> Option<PathBuf> {
    std::env::var_os(k).filter(|v| !v.is_empty()).map(PathBuf::from)
}

/// Daten-Ordner der App: Windows %APPDATA%\theme-studio, sonst ~/.local/share/theme-studio
fn data_dir() -> PathBuf {
    if cfg!(windows) {
        env_path("APPDATA").unwrap_or_default().join("theme-studio")
    } else {
        env_path("XDG_DATA_HOME").unwrap_or_else(|| env_path("HOME").unwrap_or_default().join(".local/share")).join("theme-studio")
    }
}

// ── Umgebung ────────────────────────────────────────────────────────────────

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct WinEnv {
    os: String,
    home: String,
    appdata: String,
    localappdata: String,
    documents: String,                 // echter Dokumente-Ordner (auch wenn OneDrive ihn umgeleitet hat)
    komorebi_config_home: String,      // %KOMOREBI_CONFIG_HOME% oder leer
    tools: BTreeMap<String, String>,   // gefundene Programme → Pfad
    log_file: String,
    windows_build: String,
}

/// Programm im PATH oder an typischen Installationsorten (scoop, winget, VS Code Benutzer-Installation).
fn find_tool(name: &str) -> Option<PathBuf> {
    let exts: &[&str] = if cfg!(windows) { &[".exe", ".cmd", ".bat"] } else { &[""] };
    let mut dirs: Vec<PathBuf> = std::env::var_os("PATH").map(|p| std::env::split_paths(&p).collect()).unwrap_or_default();
    if cfg!(windows) {
        let home = env_path("USERPROFILE").unwrap_or_default();
        let local = env_path("LOCALAPPDATA").unwrap_or_default();
        dirs.extend([
            home.join("scoop").join("shims"),
            local.join("Microsoft").join("WindowsApps"),
            local.join("Programs").join("oh-my-posh").join("bin"),
            local.join("Programs").join("Microsoft VS Code").join("bin"),
            local.join("Programs").join("Microsoft VS Code Insiders").join("bin"),
            local.join("Programs").join("VSCodium").join("bin"),
            PathBuf::from(r"C:\Program Files\Microsoft VS Code\bin"),
            PathBuf::from(r"C:\Program Files\komorebi\bin"),
        ]);
    }
    for d in dirs {
        for e in exts {
            let p = d.join(format!("{name}{e}"));
            if p.is_file() {
                return Some(p);
            }
        }
    }
    None
}

#[cfg(windows)]
fn documents_dir() -> String {
    // „User Shell Folders\Personal“ zeigt auch auf OneDrive, wenn Windows die Dokumente dorthin umleitet
    use winreg::{enums::HKEY_CURRENT_USER, RegKey};
    let raw: Option<String> = RegKey::predef(HKEY_CURRENT_USER)
        .open_subkey(r"Software\Microsoft\Windows\CurrentVersion\Explorer\User Shell Folders")
        .and_then(|k| k.get_value("Personal"))
        .ok();
    let expand = |s: String| {
        let mut out = s.clone();
        for (k, v) in std::env::vars() {
            out = out.replace(&format!("%{k}%"), &v).replace(&format!("%{}%", k.to_uppercase()), &v);
        }
        out
    };
    raw.map(expand)
        .unwrap_or_else(|| env_path("USERPROFILE").unwrap_or_default().join("Documents").to_string_lossy().into_owned())
}
#[cfg(not(windows))]
fn documents_dir() -> String {
    env_path("HOME").unwrap_or_default().join("Documents").to_string_lossy().into_owned()
}

#[cfg(windows)]
fn windows_build() -> String {
    use winreg::{enums::HKEY_LOCAL_MACHINE, RegKey};
    RegKey::predef(HKEY_LOCAL_MACHINE)
        .open_subkey(r"SOFTWARE\Microsoft\Windows NT\CurrentVersion")
        .map(|k| {
            let name: String = k.get_value("ProductName").unwrap_or_default();
            let build: String = k.get_value("CurrentBuild").unwrap_or_default();
            let display: String = k.get_value("DisplayVersion").unwrap_or_default();
            // Windows 11 meldet sich als „Windows 10“ im ProductName – Build ≥ 22000 ist Windows 11
            let name = if build.parse::<u32>().unwrap_or(0) >= 22000 { name.replace("Windows 10", "Windows 11") } else { name };
            format!("{name} {display} (Build {build})")
        })
        .unwrap_or_default()
}
#[cfg(not(windows))]
fn windows_build() -> String {
    String::new()
}

/// Betriebssystem, auf dem die App läuft: ("windows" | "linux" | …, lesbarer Name mit Version).
#[tauri::command]
pub fn host_system() -> (String, String) {
    let os = std::env::consts::OS.to_string();
    let name = if cfg!(windows) {
        windows_build()
    } else {
        std::fs::read_to_string("/etc/os-release")
            .ok()
            .and_then(|t| t.lines().find_map(|l| l.strip_prefix("PRETTY_NAME=").map(|v| v.trim_matches('"').to_string())))
            .unwrap_or_default()
    };
    (os, name)
}

#[tauri::command]
pub fn win_env() -> WinEnv {
    let s = |p: Option<PathBuf>| p.map(|x| x.to_string_lossy().into_owned()).unwrap_or_default();
    let mut tools = BTreeMap::new();
    for t in ["komorebic", "oh-my-posh", "code", "code-insiders", "codium", "wt", "pwsh", "powershell", "whkd"] {
        if let Some(p) = find_tool(t) {
            tools.insert(t.to_string(), p.to_string_lossy().into_owned());
        }
    }
    WinEnv {
        os: std::env::consts::OS.to_string(),
        home: s(env_path(if cfg!(windows) { "USERPROFILE" } else { "HOME" })),
        appdata: s(env_path("APPDATA")),
        localappdata: s(env_path("LOCALAPPDATA")),
        documents: documents_dir(),
        komorebi_config_home: s(env_path("KOMOREBI_CONFIG_HOME")),
        tools,
        log_file: data_dir().join("logs").join("apply.log").to_string_lossy().into_owned(),
        windows_build: windows_build(),
    }
}

// ── Dateien ─────────────────────────────────────────────────────────────────

#[tauri::command]
pub fn fs_exists(path: String) -> bool {
    Path::new(&path).exists()
}

/// Textdatei lesen (BOM wird entfernt); None, wenn es sie nicht gibt.
#[tauri::command]
pub fn fs_read(path: String) -> Result<Option<String>, String> {
    match std::fs::read(&path) {
        Ok(b) => {
            let b = b.strip_prefix(&[0xEF, 0xBB, 0xBF]).unwrap_or(&b);
            String::from_utf8(b.to_vec()).map(Some).map_err(|_| format!("{path}: keine UTF-8-Textdatei"))
        }
        Err(e) if e.kind() == std::io::ErrorKind::NotFound => Ok(None),
        Err(e) => Err(format!("{path}: {e}")),
    }
}

#[derive(Serialize, Deserialize, Default)]
struct Manifest {
    created: String,
    label: String,
    files: Vec<FileBackup>,
    registry: Vec<RegBackup>,
}
#[derive(Serialize, Deserialize, Clone)]
struct FileBackup {
    path: String,
    backup: Option<String>, // None = Datei gab es vorher nicht → bei Rückgängig löschen
}
#[derive(Serialize, Deserialize, Clone)]
struct RegBackup {
    key: String,
    name: String,
    old: Option<RegValue>, // None = Wert gab es vorher nicht
}
#[derive(Serialize, Deserialize, Clone)]
#[serde(tag = "kind", content = "value")]
pub enum RegValue {
    Dword(u32),
    Binary(Vec<u8>),
    String(String),
}

fn manifest_path(session: &str) -> Result<PathBuf, String> {
    if session.is_empty() || !session.chars().all(|c| c.is_ascii_alphanumeric() || c == '-' || c == '_') {
        return Err("ungültige Sicherung".into());
    }
    Ok(data_dir().join("backups").join(session).join("manifest.json"))
}
fn load_manifest(session: &str) -> Result<Manifest, String> {
    let p = manifest_path(session)?;
    let text = std::fs::read_to_string(&p).map_err(|e| format!("Sicherung {session}: {e}"))?;
    serde_json::from_str(&text).map_err(|e| e.to_string())
}
fn save_manifest(session: &str, m: &Manifest) -> Result<(), String> {
    let p = manifest_path(session)?;
    std::fs::create_dir_all(p.parent().unwrap()).map_err(|e| e.to_string())?;
    std::fs::write(&p, serde_json::to_string_pretty(m).unwrap()).map_err(|e| e.to_string())
}

/// Neue Sicherung anlegen → ID (Zeitstempel). Alte Sicherungen über 20 werden entfernt.
#[tauri::command]
pub fn backup_begin(label: String) -> Result<String, String> {
    let now = std::time::SystemTime::now().duration_since(std::time::UNIX_EPOCH).unwrap_or_default();
    let id = format!("{}", now.as_millis());
    save_manifest(&id, &Manifest { created: id.clone(), label, ..Default::default() })?;
    let dir = data_dir().join("backups");
    if let Ok(rd) = std::fs::read_dir(&dir) {
        let mut all: Vec<_> = rd.flatten().map(|e| e.path()).filter(|p| p.is_dir()).collect();
        all.sort();
        while all.len() > 20 {
            let _ = std::fs::remove_dir_all(all.remove(0));
        }
    }
    Ok(id)
}

/// Textdatei schreiben; vorher (einmal je Sicherung) das Original sichern. `bom` für PowerShell-Profile.
#[tauri::command]
pub fn fs_write(session: String, path: String, text: String, bom: bool) -> Result<(), String> {
    let mut m = load_manifest(&session)?;
    if !m.files.iter().any(|f| f.path == path) {
        let target = Path::new(&path);
        let backup = if target.is_file() {
            let name = format!("{}-{}", m.files.len(), target.file_name().map(|n| n.to_string_lossy().into_owned()).unwrap_or_default());
            let dest = manifest_path(&session)?.with_file_name(&name);
            std::fs::copy(target, &dest).map_err(|e| format!("Sicherung von {path}: {e}"))?;
            Some(dest.to_string_lossy().into_owned())
        } else {
            None
        };
        m.files.push(FileBackup { path: path.clone(), backup });
        save_manifest(&session, &m)?;
    }
    let p = Path::new(&path);
    if let Some(dir) = p.parent() {
        std::fs::create_dir_all(dir).map_err(|e| format!("Ordner {}: {e}", dir.display()))?;
    }
    // erst daneben schreiben, dann ersetzen: nie eine halbe Datei (auch nicht bei vollem Datenträger)
    let tmp = p.with_extension("theme-studio-tmp");
    let mut data = Vec::new();
    if bom {
        data.extend_from_slice(&[0xEF, 0xBB, 0xBF]);
    }
    data.extend_from_slice(text.as_bytes());
    std::fs::write(&tmp, &data).map_err(|e| format!("{path}: {e}"))?;
    std::fs::rename(&tmp, p).map_err(|e| {
        let _ = std::fs::remove_file(&tmp);
        format!("{path}: {e} (Datei gesperrt oder schreibgeschützt?)")
    })
}

// ── Registry, Wallpaper, Farbwechsel (nur Windows) ───────────────────────────

#[derive(Deserialize)]
#[cfg_attr(not(windows), allow(dead_code))]
pub struct RegSet {
    key: String,   // unter HKEY_CURRENT_USER
    name: String,
    value: RegValue,
}

#[cfg(windows)]
fn reg_read(key: &str, name: &str) -> Option<RegValue> {
    use winreg::{enums::*, RegKey, RegValue as RV};
    let k = RegKey::predef(HKEY_CURRENT_USER).open_subkey(key).ok()?;
    let v: RV = k.get_raw_value(name).ok()?;
    Some(match v.vtype {
        REG_DWORD => RegValue::Dword(u32::from_le_bytes(v.bytes.get(..4)?.try_into().ok()?)),
        REG_BINARY => RegValue::Binary(v.bytes),
        _ => RegValue::String(k.get_value::<String, _>(name).ok()?),
    })
}

#[cfg(windows)]
fn reg_write(key: &str, name: &str, value: &RegValue) -> Result<(), String> {
    use winreg::{enums::*, RegKey, RegValue as RV};
    let (k, _) = RegKey::predef(HKEY_CURRENT_USER).create_subkey(key).map_err(|e| format!("{key}: {e}"))?;
    match value {
        RegValue::Dword(d) => k.set_value(name, d),
        RegValue::String(s) => k.set_value(name, s),
        RegValue::Binary(b) => k.set_raw_value(name, &RV { vtype: REG_BINARY, bytes: b.clone() }),
    }
    .map_err(|e| format!("{key}\\{name}: {e}"))
}

#[cfg(windows)]
fn reg_delete(key: &str, name: &str) {
    use winreg::{enums::*, RegKey};
    if let Ok(k) = RegKey::predef(HKEY_CURRENT_USER).open_subkey_with_flags(key, KEY_SET_VALUE) {
        let _ = k.delete_value(name);
    }
}

/// Registry-Werte setzen (HKCU) – alte Werte vorher in die Sicherung.
#[tauri::command]
pub fn reg_apply(session: String, values: Vec<RegSet>) -> Result<(), String> {
    #[cfg(windows)]
    {
        let mut m = load_manifest(&session)?;
        for v in &values {
            if !m.registry.iter().any(|r| r.key == v.key && r.name == v.name) {
                m.registry.push(RegBackup { key: v.key.clone(), name: v.name.clone(), old: reg_read(&v.key, &v.name) });
            }
        }
        save_manifest(&session, &m)?;
        for v in &values {
            reg_write(&v.key, &v.name, &v.value)?;
        }
        Ok(())
    }
    #[cfg(not(windows))]
    {
        let _ = (session, values);
        Err("nur unter Windows".into())
    }
}

/// Wallpaper setzen (SPI_SETDESKWALLPAPER, dauerhaft + allen melden).
#[tauri::command]
pub fn set_wallpaper(path: String) -> Result<(), String> {
    if !Path::new(&path).is_file() {
        return Err(format!("Bild nicht gefunden: {path}"));
    }
    #[cfg(windows)]
    {
        use windows_sys::Win32::UI::WindowsAndMessaging::{SystemParametersInfoW, SPI_SETDESKWALLPAPER, SPIF_SENDCHANGE, SPIF_UPDATEINIFILE};
        let mut wide: Vec<u16> = path.encode_utf16().chain(std::iter::once(0)).collect();
        let ok = unsafe { SystemParametersInfoW(SPI_SETDESKWALLPAPER, 0, wide.as_mut_ptr().cast(), SPIF_UPDATEINIFILE | SPIF_SENDCHANGE) };
        if ok == 0 {
            return Err(format!("Windows hat das Wallpaper abgelehnt ({})", std::io::Error::last_os_error()));
        }
        Ok(())
    }
    #[cfg(not(windows))]
    Err("nur unter Windows".into())
}

/// Allen Fenstern melden, dass sich Farben geändert haben (Taskleiste, Startmenü, Apps live).
#[tauri::command]
pub fn broadcast_colors() {
    #[cfg(windows)]
    {
        use windows_sys::Win32::UI::WindowsAndMessaging::{SendMessageTimeoutW, HWND_BROADCAST, SMTO_ABORTIFHUNG, WM_SETTINGCHANGE};
        for area in ["ImmersiveColorSet", "WindowsThemeElement"] {
            let w: Vec<u16> = area.encode_utf16().chain(std::iter::once(0)).collect();
            let mut res = 0usize;
            unsafe { SendMessageTimeoutW(HWND_BROADCAST, WM_SETTINGCHANGE, 0, w.as_ptr() as isize, SMTO_ABORTIFHUNG, 3000, &mut res) };
        }
    }
}

// ── Programme starten (nur erlaubte) ────────────────────────────────────────

#[derive(Serialize)]
pub struct RunResult {
    code: i32,
    output: String,
}

/// Erlaubt sind nur komorebic (state, reload-configuration) und oh-my-posh --version.
#[tauri::command]
pub fn run_tool(tool: String, args: Vec<String>) -> Result<RunResult, String> {
    let allowed = match tool.as_str() {
        "komorebic" => matches!(args.iter().map(String::as_str).collect::<Vec<_>>().as_slice(), ["state"] | ["reload-configuration"] | ["--version"]),
        "oh-my-posh" => args == ["--version"],
        _ => false,
    };
    if !allowed {
        return Err(format!("nicht erlaubt: {tool} {}", args.join(" ")));
    }
    let exe = find_tool(&tool).ok_or_else(|| format!("{tool} nicht gefunden"))?;
    let mut cmd = std::process::Command::new(&exe);
    cmd.args(&args);
    #[cfg(windows)]
    {
        use std::os::windows::process::CommandExt;
        cmd.creation_flags(0x0800_0000); // CREATE_NO_WINDOW
    }
    let o = cmd.output().map_err(|e| format!("{tool}: {e}"))?;
    let output = (String::from_utf8_lossy(&o.stdout).to_string() + &String::from_utf8_lossy(&o.stderr)).trim().chars().take(2000).collect();
    Ok(RunResult { code: o.status.code().unwrap_or(-1), output })
}

// ── Protokoll ───────────────────────────────────────────────────────────────

/// Zeilen ans Protokoll anhängen (über 1 MB → apply.log.1).
#[tauri::command]
pub fn log_append(lines: Vec<String>) -> Result<String, String> {
    let file = data_dir().join("logs").join("apply.log");
    std::fs::create_dir_all(file.parent().unwrap()).map_err(|e| e.to_string())?;
    if std::fs::metadata(&file).map(|m| m.len() > 1_048_576).unwrap_or(false) {
        let _ = std::fs::rename(&file, file.with_extension("log.1"));
    }
    let mut f = std::fs::OpenOptions::new().create(true).append(true).open(&file).map_err(|e| e.to_string())?;
    for l in lines {
        writeln!(f, "{l}").map_err(|e| e.to_string())?;
    }
    Ok(file.to_string_lossy().into_owned())
}

/// Ende des Protokolls (für „Diagnose kopieren“).
#[tauri::command]
pub fn log_tail(max_lines: usize) -> String {
    let file = data_dir().join("logs").join("apply.log");
    let text = std::fs::read_to_string(file).unwrap_or_default();
    let lines: Vec<&str> = text.lines().collect();
    lines[lines.len().saturating_sub(max_lines)..].join("\n")
}

// ── Rückgängig ──────────────────────────────────────────────────────────────

#[derive(Serialize)]
pub struct BackupInfo {
    id: String,
    label: String,
    files: usize,
    registry: usize,
}

#[tauri::command]
pub fn backup_list() -> Vec<BackupInfo> {
    let dir = data_dir().join("backups");
    let mut out: Vec<BackupInfo> = std::fs::read_dir(dir)
        .into_iter()
        .flatten()
        .flatten()
        .filter_map(|e| {
            let id = e.file_name().to_string_lossy().into_owned();
            let m = load_manifest(&id).ok()?;
            (!m.files.is_empty() || !m.registry.is_empty()).then(|| BackupInfo { id, label: m.label, files: m.files.len(), registry: m.registry.len() })
        })
        .collect();
    out.sort_by(|a, b| b.id.cmp(&a.id));
    out
}

/// Stand vor einer Sicherung wiederherstellen → Liste der Schritte (fürs Protokoll).
#[tauri::command]
pub fn backup_restore(session: String) -> Result<Vec<String>, String> {
    let m = load_manifest(&session)?;
    let mut done = Vec::new();
    for f in &m.files {
        match &f.backup {
            Some(b) => std::fs::copy(b, &f.path).map(|_| done.push(format!("wiederhergestellt: {}", f.path))).map_err(|e| format!("{}: {e}", f.path))?,
            None => {
                let _ = std::fs::remove_file(&f.path);
                done.push(format!("entfernt (gab es vorher nicht): {}", f.path));
            }
        }
    }
    #[cfg(windows)]
    for r in &m.registry {
        match &r.old {
            Some(v) => reg_write(&r.key, &r.name, v)?,
            None => reg_delete(&r.key, &r.name),
        }
        done.push(format!("Registry zurück: {}\\{}", r.key, r.name));
    }
    if !m.registry.is_empty() {
        broadcast_colors();
    }
    let _ = std::fs::remove_dir_all(manifest_path(&session)?.parent().unwrap());
    Ok(done)
}

#[cfg(test)]
mod tests {
    use super::*;
    #[test]
    fn sicherung_schreiben_und_zurueck() {
        let tmp = std::env::temp_dir().join(format!("ts-test-{}", std::process::id()));
        unsafe { std::env::set_var("XDG_DATA_HOME", tmp.join("data")) };
        let file = tmp.join("cfg").join("settings.json");
        std::fs::create_dir_all(file.parent().unwrap()).unwrap();
        std::fs::write(&file, "alt").unwrap();
        let neu = tmp.join("cfg").join("neu.txt");
        let s = backup_begin("Test".into()).unwrap();
        fs_write(s.clone(), file.to_string_lossy().into(), "neu".into(), false).unwrap();
        fs_write(s.clone(), file.to_string_lossy().into(), "neuer".into(), false).unwrap(); // zweites Mal: Sicherung bleibt das Original
        fs_write(s.clone(), neu.to_string_lossy().into(), "x".into(), true).unwrap();
        assert_eq!(std::fs::read(&neu).unwrap()[..3], [0xEF, 0xBB, 0xBF]);
        assert_eq!(fs_read(neu.to_string_lossy().into()).unwrap().unwrap(), "x");
        assert_eq!(backup_list().len(), 1);
        backup_restore(s).unwrap();
        assert_eq!(std::fs::read_to_string(&file).unwrap(), "alt");
        assert!(!neu.exists());
        assert!(manifest_path("../x").is_err());
        assert!(run_tool("cmd".into(), vec!["/c".into(), "dir".into()]).is_err());
        assert!(run_tool("komorebic".into(), vec!["stop".into()]).is_err());
        let _ = std::fs::remove_dir_all(tmp);
    }
}
