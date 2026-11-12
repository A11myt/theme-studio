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
    shell: String,                     // Login-Shell ($SHELL, nur Linux/macOS)
    zdotdir: String,                   // $ZDOTDIR (zsh liest dann dort .zshrc)
}

/// Programm im PATH oder an typischen Installationsorten (scoop, winget, VS Code Benutzer-Installation).
fn find_tool(name: &str) -> Option<PathBuf> {
    let exts: &[&str] = if cfg!(windows) { &[".exe", ".cmd", ".bat"] } else { &[""] };
    let mut dirs: Vec<PathBuf> = std::env::var_os("PATH").map(|p| std::env::split_paths(&p).collect()).unwrap_or_default();
    // Frisch aus der Registry: findet auch Programme, die nach dem Start der App installiert wurden (winget/scoop ändern nur die Registry)
    dirs.extend(registry_path());
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
            PathBuf::from(r"C:\Program Files (x86)\oh-my-posh\bin"),   // winget, maschinenweit
            PathBuf::from(r"C:\Program Files\oh-my-posh\bin"),
            PathBuf::from(r"C:\ProgramData\scoop\shims"),             // scoop --global
            PathBuf::from(r"C:\Program Files\PowerShell\7"),
        ]);
        if let Some(sc) = env_path("SCOOP") { dirs.push(sc.join("shims")); }
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

/// PATH aus HKCU\Environment und HKLM\…\Session Manager\Environment (mit %VAR%-Auflösung).
#[cfg(windows)]
fn registry_path() -> Vec<PathBuf> {
    use winreg::{enums::*, RegKey};
    let expand = |v: String| -> String {
        let mut out = String::new();
        let mut rest = v.as_str();
        while let Some(a) = rest.find('%') {
            out.push_str(&rest[..a]);
            let after = &rest[a + 1..];
            match after.find('%') {
                Some(b) => {
                    let name = &after[..b];
                    out.push_str(&std::env::var(name).unwrap_or_else(|_| format!("%{name}%")));
                    rest = &after[b + 1..];
                }
                None => { out.push_str(&rest[a..]); rest = ""; }
            }
        }
        out.push_str(rest);
        out
    };
    let mut v = Vec::new();
    for (hive, key) in [(HKEY_CURRENT_USER, "Environment"), (HKEY_LOCAL_MACHINE, r"SYSTEM\CurrentControlSet\Control\Session Manager\Environment")] {
        if let Ok(p) = RegKey::predef(hive).open_subkey(key).and_then(|k| k.get_value::<String, _>("Path")) {
            v.extend(expand(p).split(';').filter(|x| !x.trim().is_empty()).map(|x| PathBuf::from(x.trim())));
        }
    }
    v
}
#[cfg(not(windows))]
fn registry_path() -> Vec<PathBuf> {
    Vec::new()
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
    // Shells: unter Windows kein „bash“ suchen (System32\bash.exe startet WSL) – Git Bash gezielt
    let shells: &[&str] = if cfg!(windows) { &[] } else { &["bash", "zsh", "fish"] };
    for t in ["komorebic", "oh-my-posh", "starship", "code", "code-insiders", "codium", "wt", "pwsh", "powershell", "whkd"].iter().chain(shells) {
        if let Some(p) = find_tool(t) {
            tools.insert(t.to_string(), p.to_string_lossy().into_owned());
        }
    }
    if cfg!(windows) {
        // Git for Windows: …\Git\cmd\git.exe → …\Git\bin\bash.exe
        let from_git = find_tool("git").and_then(|g| g.parent()?.parent().map(|d| d.join("bin").join("bash.exe")));
        let gb = from_git.into_iter().chain([PathBuf::from(r"C:\Program Files\Git\bin\bash.exe"),
            env_path("LOCALAPPDATA").unwrap_or_default().join("Programs").join("Git").join("bin").join("bash.exe")])
            .find(|p| p.is_file());
        if let Some(p) = gb { tools.insert("git-bash".into(), p.to_string_lossy().into_owned()); }
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
        shell: if cfg!(windows) { String::new() } else { std::env::var("SHELL").unwrap_or_default() },
        zdotdir: s(env_path("ZDOTDIR")),
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
    Delete, // nur beim Setzen: Wert entfernen (z. B. „gab es vor Theme Studio nicht“)
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

/// Datei (einmal je Sicherung) in die Sicherung kopieren – Rückgängig stellt sie wieder her (oder löscht sie, wenn es sie nicht gab).
fn backup_file(session: &str, path: &str) -> Result<(), String> {
    let mut m = load_manifest(session)?;
    if !m.files.iter().any(|f| f.path == path) {
        let target = Path::new(path);
        let backup = if target.is_file() {
            let name = format!("{}-{}", m.files.len(), target.file_name().map(|n| n.to_string_lossy().into_owned()).unwrap_or_default());
            let dest = manifest_path(session)?.with_file_name(&name);
            std::fs::copy(target, &dest).map_err(|e| format!("Sicherung von {path}: {e}"))?;
            Some(dest.to_string_lossy().into_owned())
        } else {
            None
        };
        m.files.push(FileBackup { path: path.to_string(), backup });
        save_manifest(session, &m)?;
    }
    Ok(())
}

/// Nur sichern (z. B. bevor ein anderes Programm die Datei ändert).
#[tauri::command]
pub fn fs_backup(session: String, path: String) -> Result<(), String> {
    backup_file(&session, &path)
}

/// Datei entfernen – vorher gesichert, Rückgängig legt sie wieder hin.
#[tauri::command]
pub fn fs_remove(session: String, path: String) -> Result<bool, String> {
    if !Path::new(&path).is_file() {
        return Ok(false);
    }
    backup_file(&session, &path)?;
    std::fs::remove_file(&path).map_err(|e| format!("{path}: {e}"))?;
    Ok(true)
}

/// Das alte wintheme restlos entfernen: der Ordner %LOCALAPPDATA%\wintheme wird nicht gelöscht, sondern
/// beiseitegelegt (nach wintheme.themestudio-aus). So ist nichts verloren, aber die Farb-Automatik ist weg.
/// Gibt den neuen Pfad zurück, oder leer, wenn es den Ordner nicht (mehr) gibt.
#[tauri::command]
pub fn remove_wintheme() -> Result<String, String> {
    let dir = match env_path("LOCALAPPDATA") {
        Some(d) => d.join("wintheme"),
        None => return Ok(String::new()),
    };
    if !dir.is_dir() {
        return Ok(String::new());
    }
    let backup = dir.with_file_name("wintheme.themestudio-aus");
    if backup.exists() {
        std::fs::remove_dir_all(&backup).map_err(|e| format!("{}: {e}", backup.display()))?;
    }
    std::fs::rename(&dir, &backup).map_err(|e| format!("{}: {e}", dir.display()))?;
    Ok(backup.to_string_lossy().into_owned())
}

/// Erlaubte Prozesse: whkd, komorebi (+ Leiste), und pythonw nur aus %LOCALAPPDATA%\wintheme (der Farb-Wächter).
fn allowed_proc(name: &str) -> Result<Option<String>, String> {
    match name {
        "whkd.exe" | "komorebi.exe" | "komorebi-bar.exe" => Ok(None),
        "pythonw.exe" => Ok(Some(env_path("LOCALAPPDATA").unwrap_or_default().join("wintheme").to_string_lossy().to_lowercase())),
        _ => Err(format!("nicht erlaubt: {name}")),
    }
}

/// Erlaubte Prozesse beenden → Anzahl.
#[tauri::command]
pub fn stop_process(name: String) -> Result<u32, String> {
    let prefix = allowed_proc(&name)?;
    procs(&name, prefix.as_deref(), true)
}

/// Wie viele davon laufen gerade?
#[tauri::command]
pub fn process_count(name: String) -> Result<u32, String> {
    let prefix = allowed_proc(&name)?;
    procs(&name, prefix.as_deref(), false)
}

/// Prozesse mit diesem Namen zählen bzw. beenden (optional nur aus einem Ordner).
#[cfg(windows)]
fn procs(name: &str, prefix: Option<&str>, kill: bool) -> Result<u32, String> {
    use windows_sys::Win32::Foundation::{CloseHandle, INVALID_HANDLE_VALUE};
    use windows_sys::Win32::System::Diagnostics::ToolHelp::{CreateToolhelp32Snapshot, Process32FirstW, Process32NextW, PROCESSENTRY32W, TH32CS_SNAPPROCESS};
    use windows_sys::Win32::System::Threading::{OpenProcess, QueryFullProcessImageNameW, TerminateProcess, PROCESS_QUERY_LIMITED_INFORMATION, PROCESS_TERMINATE};
    let mut n = 0;
    unsafe {
        let snap = CreateToolhelp32Snapshot(TH32CS_SNAPPROCESS, 0);
        if snap == INVALID_HANDLE_VALUE {
            return Err("Prozessliste nicht lesbar".into());
        }
        let mut e: PROCESSENTRY32W = std::mem::zeroed();
        e.dwSize = std::mem::size_of::<PROCESSENTRY32W>() as u32;
        let mut ok = Process32FirstW(snap, &mut e);
        while ok != 0 {
            let len = e.szExeFile.iter().position(|&c| c == 0).unwrap_or(e.szExeFile.len());
            if String::from_utf16_lossy(&e.szExeFile[..len]).eq_ignore_ascii_case(name) {
                let h = OpenProcess(PROCESS_TERMINATE | PROCESS_QUERY_LIMITED_INFORMATION, 0, e.th32ProcessID);
                if !h.is_null() {
                    let mut buf = [0u16; 1024];
                    let mut sz = buf.len() as u32;
                    let path = if QueryFullProcessImageNameW(h, 0, buf.as_mut_ptr(), &mut sz) != 0 { String::from_utf16_lossy(&buf[..sz as usize]).to_lowercase() } else { String::new() };
                    if prefix.is_none_or(|p| path.starts_with(p)) && (!kill || TerminateProcess(h, 0) != 0) {
                        n += 1;
                    }
                    CloseHandle(h);
                }
            }
            ok = Process32NextW(snap, &mut e);
        }
        CloseHandle(snap);
    }
    Ok(n)
}
#[cfg(not(windows))]
fn procs(_name: &str, _prefix: Option<&str>, _kill: bool) -> Result<u32, String> {
    Ok(0)
}

/// Explorer neu starten (nötig, damit geänderte Win-Tastenkombinationen greifen).
/// Windows startet die Shell nach dem Beenden meist selbst neu – nur wenn nicht, starten wir sie.
#[tauri::command]
pub fn restart_explorer() -> Result<(), String> {
    #[cfg(windows)]
    {
        procs("explorer.exe", None, true)?;
        for _ in 0..10 {
            std::thread::sleep(std::time::Duration::from_millis(300));
            if procs("explorer.exe", None, false)? > 0 {
                return Ok(());
            }
        }
        let windir = env_path("WINDIR").unwrap_or_else(|| PathBuf::from(r"C:\Windows"));
        std::process::Command::new(windir.join("explorer.exe")).spawn().map_err(|e| format!("Explorer: {e}"))?;
        Ok(())
    }
    #[cfg(not(windows))]
    Err("nur unter Windows".into())
}

/// Textdatei schreiben; vorher (einmal je Sicherung) das Original sichern. `bom` für PowerShell-Profile.
#[tauri::command]
pub fn fs_write(session: String, path: String, text: String, bom: bool) -> Result<(), String> {
    backup_file(&session, &path)?;
    // Symlink (z. B. .zshrc aus einem dotfiles-Repo per stow)? Dann das Ziel beschreiben, den Link nicht ersetzen
    let real = match std::fs::symlink_metadata(&path) {
        Ok(m) if m.file_type().is_symlink() => std::fs::canonicalize(&path).map_err(|e| format!("{path}: Link zeigt ins Leere ({e})"))?,
        _ => PathBuf::from(&path),
    };
    let p = real.as_path();
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

// ── Originale (dauerhaft, werden nie aufgeräumt) ─────────────────────────────
// Schlüssel: "reg|<key>|<name>" (Option<RegValue>), "wallpaper" (Pfad), "wt|<datei>", "komorebi|<datei>" (von der Oberfläche)

fn originals_path() -> PathBuf {
    data_dir().join("originals.json")
}
fn load_originals() -> BTreeMap<String, serde_json::Value> {
    std::fs::read_to_string(originals_path()).ok().and_then(|t| serde_json::from_str(&t).ok()).unwrap_or_default()
}
fn save_originals(m: &BTreeMap<String, serde_json::Value>) -> Result<(), String> {
    let p = originals_path();
    std::fs::create_dir_all(p.parent().unwrap()).map_err(|e| e.to_string())?;
    std::fs::write(&p, serde_json::to_string_pretty(m).unwrap()).map_err(|e| e.to_string())
}
/// Ältester gesicherter Registry-Wert (aus Sicherungen vor dieser Version) – besser als der jetzige, der schon von Theme Studio sein kann.
#[cfg_attr(not(windows), allow(dead_code))]
fn earliest_backup_reg(key: &str, name: &str) -> Option<Option<RegValue>> {
    let mut ids: Vec<String> = std::fs::read_dir(data_dir().join("backups")).ok()?.flatten().map(|e| e.file_name().to_string_lossy().into_owned()).collect();
    ids.sort();
    ids.iter().find_map(|id| load_manifest(id).ok()?.registry.into_iter().find(|r| r.key == key && r.name == name).map(|r| r.old))
}

/// Einen Registry-Wert (HKCU) lesen.
#[tauri::command]
pub fn reg_get(key: String, name: String) -> Option<RegValue> {
    #[cfg(windows)]
    return reg_read(&key, &name);
    #[cfg(not(windows))]
    {
        let _ = (key, name);
        None
    }
}

#[tauri::command]
pub fn orig_get() -> BTreeMap<String, serde_json::Value> {
    load_originals()
}
/// Original merken, falls noch keins da ist → true, wenn gemerkt.
#[tauri::command]
pub fn orig_set_once(key: String, value: serde_json::Value) -> Result<bool, String> {
    let mut m = load_originals();
    if m.contains_key(&key) {
        return Ok(false);
    }
    m.insert(key, value);
    save_originals(&m)?;
    Ok(true)
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
        RegValue::Delete => {
            reg_delete(key, name);
            Ok(())
        }
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
        // Original (Stand vor dem allerersten Theme-Studio-Eingriff) dauerhaft merken – für „Auf Standard zurücksetzen“
        let mut orig = load_originals();
        for v in &values {
            let k = format!("reg|{}|{}", v.key, v.name);
            if !orig.contains_key(&k) {
                let old = earliest_backup_reg(&v.key, &v.name).unwrap_or_else(|| reg_read(&v.key, &v.name));
                orig.insert(k, serde_json::to_value(old).unwrap_or_default());
            }
        }
        save_originals(&orig)?;
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
    crate::background::note_own_wallpaper(&path);
    #[cfg(windows)]
    {
        use windows_sys::Win32::UI::WindowsAndMessaging::{SystemParametersInfoW, SPI_GETDESKWALLPAPER, SPI_SETDESKWALLPAPER, SPIF_SENDCHANGE, SPIF_UPDATEINIFILE};
        let mut orig = load_originals();
        if !orig.contains_key("wallpaper") {
            let mut buf = [0u16; 1024];
            let ok = unsafe { SystemParametersInfoW(SPI_GETDESKWALLPAPER, buf.len() as u32, buf.as_mut_ptr().cast(), 0) };
            let cur = if ok != 0 { String::from_utf16_lossy(&buf[..buf.iter().position(|&c| c == 0).unwrap_or(0)]) } else { String::new() };
            orig.insert("wallpaper".into(), serde_json::Value::String(cur));
            save_originals(&orig)?;
        }
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

// ── PowerShell-Ausführungsrichtlinie (direkt gelesen, ohne PowerShell zu starten) ──

/// Je Shell die Stufen wie „Get-ExecutionPolicy -List“: "MachinePolicy=…\nUserPolicy=…\n…" (Undefined = nicht gesetzt).
#[tauri::command]
pub fn ps_policy() -> BTreeMap<String, String> {
    #[allow(unused_mut)] // unter Linux bleibt die Liste leer
    let mut out = BTreeMap::new();
    #[cfg(windows)]
    {
        use winreg::{enums::*, RegKey};
        let reg = |hive, key: &str, val: &str| RegKey::predef(hive).open_subkey(key).and_then(|k| k.get_value::<String, _>(val)).ok();
        // Gruppenrichtlinie „Skriptausführung aktivieren“: EnableScripts 0 → Restricted, 1 → ExecutionPolicy
        let gpo = |hive, key: &str| -> String {
            match RegKey::predef(hive).open_subkey(key).and_then(|k| k.get_value::<u32, _>("EnableScripts")) {
                Ok(0) => "Restricted".into(),
                Ok(_) => reg(hive, key, "ExecutionPolicy").unwrap_or_else(|| "Undefined".into()),
                Err(_) => "Undefined".into(),
            }
        };
        let process = std::env::var("PSExecutionPolicyPreference").ok().filter(|v| !v.is_empty()).unwrap_or_else(|| "Undefined".into());
        let fmt = |v: [String; 5]| ["MachinePolicy", "UserPolicy", "Process", "CurrentUser", "LocalMachine"]
            .iter().zip(v).map(|(k, v)| format!("{k}={v}")).collect::<Vec<_>>().join("\n");

        let ids = r"SOFTWARE\Microsoft\PowerShell\1\ShellIds\Microsoft.PowerShell";
        let wp = r"SOFTWARE\Policies\Microsoft\Windows\PowerShell";
        out.insert("powershell".into(), fmt([gpo(HKEY_LOCAL_MACHINE, wp), gpo(HKEY_CURRENT_USER, wp), process.clone(),
            reg(HKEY_CURRENT_USER, ids, "ExecutionPolicy").unwrap_or_else(|| "Undefined".into()),
            reg(HKEY_LOCAL_MACHINE, ids, "ExecutionPolicy").unwrap_or_else(|| "Undefined".into())]));

        if let Some(pwsh) = find_tool("pwsh") {
            // PowerShell 7: eigene Gruppenrichtlinie, sonst powershell.config.json (Benutzer bzw. neben pwsh.exe)
            let cfg = |p: PathBuf| std::fs::read_to_string(p).ok()
                .and_then(|t| serde_json::from_str::<serde_json::Value>(t.trim_start_matches('\u{feff}')).ok())
                .and_then(|j| j.get("Microsoft.PowerShell:ExecutionPolicy").and_then(|v| v.as_str()).map(String::from))
                .unwrap_or_else(|| "Undefined".into());
            let core = r"SOFTWARE\Policies\Microsoft\PowerShellCore";
            let user = PathBuf::from(documents_dir()).join("PowerShell").join("powershell.config.json");
            let machine = pwsh.parent().map(|d| d.join("powershell.config.json")).unwrap_or_default();
            out.insert("pwsh".into(), fmt([gpo(HKEY_LOCAL_MACHINE, core), gpo(HKEY_CURRENT_USER, core), process, cfg(user), cfg(machine)]));
        }
    }
    out
}

// ── Programme starten (nur erlaubte) ────────────────────────────────────────

#[derive(Serialize)]
pub struct RunResult {
    code: i32,
    output: String,
}

/// Erlaubt sind nur komorebic (state, reload-configuration, enable-autostart, start, stop) und oh-my-posh --version.
#[tauri::command]
pub fn run_tool(tool: String, args: Vec<String>) -> Result<RunResult, String> {
    let allowed = match tool.as_str() {
        "komorebic" => matches!(args.iter().map(String::as_str).collect::<Vec<_>>().as_slice(),
            ["state"] | ["reload-configuration"] | ["--version"] | ["enable-autostart"] | ["enable-autostart", "--bar"]
            | ["start"] | ["start", "--whkd"] | ["start", "--whkd", "--bar"]
            | ["stop"] | ["stop", "--whkd"] | ["stop", "--bar"] | ["stop", "--whkd", "--bar"]),
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
