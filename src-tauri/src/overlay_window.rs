// Operator Game Overlay window controller for PROTOKOL HUD Manager
// Creates an always-on-top, click-through (transparent) overlay directly over CS2.

use tauri::{AppHandle, Manager, WebviewUrl, WebviewWindowBuilder};

#[tauri::command]
pub fn operator_overlay_status(app: AppHandle) -> bool {
    app.get_webview_window("operator_overlay").is_some()
}

#[tauri::command]
pub fn operator_overlay_toggle(app: AppHandle, url: Option<String>) -> Result<bool, String> {
    if let Some(win) = app.get_webview_window("operator_overlay") {
        win.close().map_err(|e| e.to_string())?;
        return Ok(false);
    }

    let target_url = url.unwrap_or_else(|| "http://127.0.0.1:1349/overlay/fennec-championship/".to_string());
    let parsed_url: url::Url = target_url.parse().map_err(|e: url::ParseError| e.to_string())?;

    let win = WebviewWindowBuilder::new(&app, "operator_overlay", WebviewUrl::External(parsed_url))
        .title("PROTOKOL Game Overlay")
        .inner_size(1920.0, 1080.0)
        .position(0.0, 0.0)
        .resizable(false)
        .decorations(false)
        .transparent(true)
        .always_on_top(true)
        .skip_taskbar(true)
        .shadow(false)
        .build()
        .map_err(|e| e.to_string())?;

    // Enable click-through: all mouse clicks pass straight through to CS2 / Desktop
    win.set_ignore_cursor_events(true).map_err(|e| e.to_string())?;

    Ok(true)
}

#[tauri::command]
pub fn operator_overlay_close(app: AppHandle) -> Result<(), String> {
    if let Some(win) = app.get_webview_window("operator_overlay") {
        win.close().map_err(|e| e.to_string())?;
    }
    Ok(())
}
