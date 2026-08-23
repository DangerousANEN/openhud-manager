// OpenHUD Manager — Tauri application entry (library side).
pub mod db;
pub mod gsi;
pub mod obs;
pub mod packs;
pub mod rcon;
pub mod server;

use gsi::{GsiSnapshot, GsiState};
use serde_json::Value;
use std::path::PathBuf;
use std::sync::Arc;
use tauri::Manager;

const DEFAULT_PORT: u16 = 1349;

pub struct Runtime {
    pub gsi: Arc<GsiState>,
    pub port: u16,
}

fn err<E: std::fmt::Display>(e: E) -> String {
    e.to_string()
}

// ---------- Teams ----------
#[tauri::command]
fn teams_list() -> Result<Vec<db::Team>, String> {
    db::list_teams().map_err(err)
}

#[tauri::command]
fn teams_save(team: db::Team) -> Result<db::Team, String> {
    db::save_team(team).map_err(err)
}

#[tauri::command]
fn teams_delete(id: String) -> Result<(), String> {
    db::delete_team(&id).map_err(err)
}

// ---------- Players ----------
#[tauri::command]
fn players_list() -> Result<Vec<db::Player>, String> {
    db::list_players().map_err(err)
}

#[tauri::command]
fn players_save(player: db::Player) -> Result<db::Player, String> {
    db::save_player(player).map_err(err)
}

#[tauri::command]
fn players_delete(id: String) -> Result<(), String> {
    db::delete_player(&id).map_err(err)
}

// ---------- Matches ----------
#[tauri::command]
fn matches_list() -> Result<Vec<db::Match>, String> {
    db::list_matches().map_err(err)
}

#[tauri::command]
fn matches_save(match_: db::Match) -> Result<db::Match, String> {
    db::save_match(match_).map_err(err)
}

#[tauri::command]
fn matches_delete(id: String) -> Result<(), String> {
    db::delete_match(&id).map_err(err)
}

#[tauri::command]
fn matches_current() -> Result<Option<db::Match>, String> {
    db::current_match().map_err(err)
}

// ---------- Sponsors ----------
#[tauri::command]
fn sponsors_list() -> Result<Vec<db::Sponsor>, String> {
    db::list_sponsors().map_err(err)
}

#[tauri::command]
fn sponsors_save(sponsor: db::Sponsor) -> Result<db::Sponsor, String> {
    db::save_sponsor(sponsor).map_err(err)
}

#[tauri::command]
fn sponsors_delete(id: String) -> Result<(), String> {
    db::delete_sponsor(&id).map_err(err)
}

// ---------- Tournaments ----------
#[tauri::command]
fn tournaments_list() -> Result<Vec<db::Tournament>, String> {
    db::list_tournaments().map_err(err)
}

#[tauri::command]
fn tournaments_save(tournament: db::Tournament) -> Result<db::Tournament, String> {
    db::save_tournament(tournament).map_err(err)
}

#[tauri::command]
fn tournaments_delete(id: String) -> Result<(), String> {
    db::delete_tournament(&id).map_err(err)
}

// ---------- Settings ----------
#[tauri::command]
fn setting_get(key: String) -> Result<Option<String>, String> {
    db::get_setting(&key).map_err(err)
}

#[tauri::command]
fn setting_set(key: String, value: String) -> Result<(), String> {
    db::set_setting(&key, &value).map_err(err)
}

// ---------- HUD Layouts ----------
#[tauri::command]
fn list_hud_layouts() -> Result<Vec<db::HudLayoutMeta>, String> {
    db::list_hud_layouts().map_err(err)
}

#[tauri::command]
fn save_hud_layout(layout: db::HudLayout) -> Result<db::HudLayout, String> {
    db::save_hud_layout(layout).map_err(err)
}

#[tauri::command]
fn load_hud_layout(id: String) -> Result<Option<db::HudLayout>, String> {
    db::get_hud_layout(&id).map_err(err)
}

#[tauri::command]
fn delete_hud_layout(id: String) -> Result<(), String> {
    db::delete_hud_layout(&id).map_err(err)
}

// ---------- GSI / server ----------
#[tauri::command]
fn gsi_snapshot(state: tauri::State<Runtime>) -> GsiSnapshot {
    state.gsi.snapshot.read().clone()
}

#[tauri::command]
fn gsi_status(state: tauri::State<Runtime>) -> Value {
    serde_json::json!({
        "connected": state.gsi.connected(),
        "seconds_since_update": state.gsi.seconds_since_update(),
        "listeners": state.gsi.tx.receiver_count(),
        "port": state.port,
        "gsi_url": format!("http://127.0.0.1:{}/api/gsi", state.port),
        "overlay_url": format!("http://127.0.0.1:{}/overlay/", state.port),
    })
}

/// Push a control event (map veto, replay, sponsor rotation...) to every overlay.
#[tauri::command]
fn overlay_broadcast(state: tauri::State<Runtime>, kind: String, data: Value) {
    state.gsi.broadcast_event(&kind, data);
}

#[tauri::command]
fn overlays_path() -> String {
    server::overlays_dir().to_string_lossy().to_string()
}

/// Locate the CS2 `cfg` folder: explicit override first, then the default
/// Steam install path. Returns Err with a human-readable hint when not found.
fn find_cs2_cfg_dir(override_path: Option<String>) -> Result<PathBuf, String> {
    if let Some(p) = override_path {
        let p = PathBuf::from(&p);
        if p.is_dir() {
            return Ok(p);
        }
    }
    for base in [
        PathBuf::from("C:\\Program Files (x86)\\Steam\\steamapps\\common\\Counter-Strike Global Offensive\\game\\csgo\\cfg"),
        PathBuf::from("C:\\Program Files\\Steam\\steamapps\\common\\Counter-Strike Global Offensive\\game\\csgo\\cfg"),
        PathBuf::from("D:\\SteamLibrary\\steamapps\\common\\Counter-Strike Global Offensive\\game\\csgo\\cfg"),
    ] {
        if base.is_dir() {
            return Ok(base);
        }
    }
    // Last resort: scan every drive root for a Steam library pointing at CS2.
    for letter in b'C'..=b'Z' {
        let lib = PathBuf::from(format!(
            "{letter}:\\SteamLibrary\\steamapps\\common\\Counter-Strike Global Offensive\\game\\csgo\\cfg"
        ));
        if lib.is_dir() {
            return Ok(lib);
        }
        let steam = PathBuf::from(format!(
            "{letter}:\\Steam\\steamapps\\common\\Counter-Strike Global Offensive\\game\\csgo\\cfg"
        ));
        if steam.is_dir() {
            return Ok(steam);
        }
    }
    Err(
        "Папка cfg игры CS2 не найдена. Укажи путь вручную в поле ниже \
         (пример: C:\\Program Files (x86)\\Steam\\steamapps\\common\\Counter-Strike Global Offensive\\game\\csgo\\cfg)"
            .to_string(),
    )
}

/// Write gamestate_integration_openhud.cfg straight into the CS2 cfg folder.
#[tauri::command]
fn gsi_cfg_install(state: tauri::State<Runtime>, cs2_cfg_path: Option<String>) -> Result<String, String> {
    let dir = find_cs2_cfg_dir(cs2_cfg_path)?;
    // Remember a working path so future installs skip discovery.
    let _ = db::set_setting("cs2_cfg_path", &dir.to_string_lossy());

    let text = gsi_cfg_text_inner(state.port, &state.gsi.token.read().clone());
    let file = dir.join("gamestate_integration_openhud.cfg");
    std::fs::write(&file, &text).map_err(|e| format!("Не удалось записать {}: {e}", file.display()))?;
    Ok(format!(
        "GSI cfg установлен: {}",
        file.display()
    ))
}

#[derive(serde::Serialize)]
pub struct Cs2CfgProbe {
    pub found: bool,
    pub path: String,
}

/// Probe whether the CS2 cfg folder is discoverable (for UI hints).
#[tauri::command]
fn gsi_cfg_probe() -> Cs2CfgProbe {
    let stored = db::get_setting("cs2_cfg_path").ok().flatten();
    match find_cs2_cfg_dir(stored) {
        Ok(dir) => Cs2CfgProbe {
            found: true,
            path: dir.to_string_lossy().to_string(),
        },
        Err(_) => Cs2CfgProbe {
            found: false,
            path: String::new(),
        },
    }
}

#[tauri::command]
fn db_location() -> String {
    db::db_path().to_string_lossy().to_string()
}

/// Export the SQLite database to a user-chosen file via VACUUM INTO
/// (consistent snapshot, no locks held on the copy).
#[tauri::command]
fn db_export(dest: String) -> Result<String, String> {
    if dest.trim().is_empty() {
        return Err("Не указан файл назначения".into());
    }
    let conn = db::open().map_err(err)?;
    // VACUUM INTO refuses to overwrite; remove a stale target first.
    let path = PathBuf::from(&dest);
    if path.exists() {
        std::fs::remove_file(&path).map_err(|e| format!("Не удалось перезаписать {dest}: {e}"))?;
    }
    conn.execute("VACUUM INTO ?1", rusqlite::params![dest])
        .map_err(|e| format!("Ошибка экспорта: {e}"))?;
    Ok(format!("База экспортирована: {dest}"))
}

/// Import (restore) a database file previously written by db_export.
/// Replaces the live DB, then rewrites both WAL/SHM sidecars so the app
/// keeps working without a restart.
#[tauri::command]
fn db_import(src: String) -> Result<String, String> {
    let src_path = PathBuf::from(&src);
    if !src_path.is_file() {
        return Err(format!("Файл не найден: {src}"));
    }
    // Sanity check: it must open as SQLite and contain our settings table.
    let check = rusqlite::Connection::open_with_flags(
        &src_path,
        rusqlite::OpenFlags::SQLITE_OPEN_READ_ONLY,
    )
    .map_err(|e| format!("Это не похоже на базу SQLite: {e}"))?;
    let ok: i64 = check
        .query_row(
            "SELECT COUNT(*) FROM sqlite_master WHERE type='table' AND name IN ('teams','players','matches','settings')",
            [],
            |r| r.get(0),
        )
        .map_err(|_| "В файле нет таблиц OpenHUD — импорт отменён".to_string())?;
    if ok < 2 {
        return Err("В файле нет таблиц OpenHUD — импорт отменён".into());
    }

    let dst = db::db_path();
    for ext in ["", "-wal", "-shm"] {
        let p = PathBuf::from(format!("{}{ext}", dst.to_string_lossy()));
        if p.exists() {
            std::fs::remove_file(&p).map_err(|e| format!("База занята приложением: {e}"))?;
        }
    }
    std::fs::copy(&src_path, &dst).map_err(|e| format!("Не удалось заменить базу: {e}"))?;
    Ok("База импортирована. Перезапусти приложение для применения.".into())
}

/// Pick a file with the native dialog and return its absolute path.
/// None = the user cancelled the dialog.
#[tauri::command]
fn pick_file(title: String) -> Option<String> {
    rfd::FileDialog::new()
        .set_title(&title)
        .pick_file()
        .map(|p| p.to_string_lossy().to_string())
}

/// Pick a save location with the native dialog. None = cancelled.
#[tauri::command]
fn pick_save_file(title: String, default_name: String) -> Option<String> {
    rfd::FileDialog::new()
        .set_title(&title)
        .set_file_name(&default_name)
        .save_file()
        .map(|p| p.to_string_lossy().to_string())
}

#[derive(serde::Serialize)]
pub struct HudPack {
    pub id: String,
    pub name: String,
    pub path: String,
    pub url_path: String,
    pub has_index: bool,
}

/// Scan the overlays folder: the root itself plus every immediate subfolder
/// counts as a HUD pack when it contains an index.html.
#[tauri::command]
fn huds_list(state: tauri::State<Runtime>) -> Vec<HudPack> {
    let root = server::overlays_dir();
    let mut out = Vec::new();

    if root.join("index.html").is_file() {
        out.push(HudPack {
            id: "__root".into(),
            name: "Корневой оверлей".into(),
            path: root.to_string_lossy().to_string(),
            url_path: format!("http://127.0.0.1:{}/overlay/", state.port),
            has_index: true,
        });
    }

    if let Ok(entries) = std::fs::read_dir(&root) {
        for entry in entries.flatten() {
            let p = entry.path();
            if !p.is_dir() {
                continue;
            }
            let name = entry.file_name().to_string_lossy().to_string();
            out.push(HudPack {
                id: name.clone(),
                name: name.clone(),
                path: p.to_string_lossy().to_string(),
                url_path: format!("http://127.0.0.1:{}/overlay/{}/", state.port, name),
                has_index: p.join("index.html").is_file(),
            });
        }
    }

    out
}

/// Write the cfg file CS2 needs so the game starts POSTing state to us.
/// Build the GSI cfg body for the given port/token (shared by preview + install).
fn gsi_cfg_text_inner(port: u16, token: &str) -> String {
    format!(
        r#""OpenHUD Manager"
{{
    "uri" "http://127.0.0.1:{port}/api/gsi"
    "timeout" "5.0"
    "buffer" "0.1"
    "throttle" "0.1"
    "heartbeat" "10.0"
    "auth"
    {{
        "token" "{token}"
    }}
    "data"
    {{
        "provider"            "1"
        "map"                 "1"
        "round"               "1"
        "player_id"           "1"
        "player_state"        "1"
        "player_weapons"      "1"
        "player_match_stats"  "1"
        "allplayers_id"       "1"
        "allplayers_state"    "1"
        "allplayers_match_stats" "1"
        "allplayers_weapons"  "1"
        "allplayers_position"  "1"
        "phase_countdowns"    "1"
        "bomb"                "1"
    }}
}}
"#
    )
}

#[tauri::command]
fn gsi_cfg_text(state: tauri::State<Runtime>) -> String {
    let token = state.gsi.token.read().clone();
    gsi_cfg_text_inner(state.port, &token)
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    // Persisted token, or a fresh one on first launch.
    let token = match db::get_setting("gsi_token") {
        Ok(Some(t)) if !t.is_empty() => t,
        _ => {
            let t = uuid::Uuid::new_v4().to_string();
            let _ = db::set_setting("gsi_token", &t);
            t
        }
    };

    let port: u16 = db::get_setting("server_port")
        .ok()
        .flatten()
        .and_then(|p| p.parse().ok())
        .unwrap_or(DEFAULT_PORT);

    let gsi = GsiState::new(token);
    let gsi_for_server = gsi.clone();

    tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .setup(move |app| {
            // Try the configured port first; if it is taken (a second app
            // instance, a leftover process), walk up to 10 ports higher so the
            // server still comes up instead of dying silently.
            let mut chosen: Option<u16> = None;
            for candidate in port..port + 10 {
                if server::can_bind(candidate) {
                    chosen = Some(candidate);
                    break;
                }
            }

            match chosen {
                Some(p) => {
                    if p != port {
                        eprintln!(
                            "[openhud] port {port} busy — GSI + overlay server moved to {p}"
                        );
                    }
                    app.manage(Runtime {
                        gsi: gsi.clone(),
                        port: p,
                    });
                    let state = server::AppState { gsi: gsi_for_server.clone() };
                    // GSI ingest + overlay hosting run for the app's whole lifetime.
                    tauri::async_runtime::spawn(async move {
                        if let Err(e) = server::serve(state, p).await {
                            eprintln!("[openhud] server failed on port {p}: {e}");
                        }
                    });
                }
                None => {
                    eprintln!(
                        "[openhud] no free port in {port}..={} — GSI/overlay disabled",
                        port + 9
                    );
                    app.manage(Runtime {
                        gsi: gsi.clone(),
                        port,
                    });
                }
            }

            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            teams_list,
            teams_save,
            teams_delete,
            players_list,
            players_save,
            players_delete,
            matches_list,
            matches_save,
            matches_delete,
            matches_current,
            sponsors_list,
            sponsors_save,
            sponsors_delete,
            tournaments_list,
            tournaments_save,
            tournaments_delete,
            setting_get,
            setting_set,
            list_hud_layouts,
            save_hud_layout,
            load_hud_layout,
            delete_hud_layout,
            gsi_snapshot,
            gsi_status,
            gsi_cfg_text,
            gsi_cfg_install,
            gsi_cfg_probe,
            overlay_broadcast,
            overlays_path,
            huds_list,
            db_location,
            db_export,
            db_import,
            pick_file,
            pick_save_file,
            rcon::list_servers,
            rcon::save_server,
            rcon::delete_server,
            rcon::rcon_test_connection,
            rcon::rcon_exec,
            rcon::rcon_changelevel,
            obs::obs_status,
            obs::obs_scenes,
            obs::obs_set_scene,
            obs::obs_toggle_stream,
            obs::obs_toggle_record,
            obs::obs_save_replay,
            obs::obs_set_source_visible,
            packs::huds_import,
            packs::huds_delete,
        ])
        .run(tauri::generate_context!())
        .expect("error while running OpenHUD Manager");
}
