// Operator Game Overlay window controller for PROTOKOL HUD Manager
// Creates an always-on-top, click-through (transparent) overlay directly over CS2.

use std::sync::atomic::{AtomicBool, Ordering};
use std::sync::Mutex;
use tauri::{AppHandle, Emitter, Manager, WebviewUrl, WebviewWindowBuilder};

static HOTKEY_INITIALIZED: AtomicBool = AtomicBool::new(false);
static TOGGLE_LOCK: Mutex<()> = Mutex::new(());

#[tauri::command]
pub fn operator_overlay_status(app: AppHandle) -> bool {
    if let Some(win) = app.get_webview_window("operator_overlay") {
        win.is_visible().unwrap_or(false)
    } else {
        false
    }
}

#[cfg(windows)]
unsafe extern "system" fn enum_child_proc(
    hwnd: windows_sys::Win32::Foundation::HWND,
    _lparam: windows_sys::Win32::Foundation::LPARAM,
) -> windows_sys::Win32::Foundation::BOOL {
    use windows_sys::Win32::UI::WindowsAndMessaging::{
        GetWindowLongPtrW, SetWindowLongPtrW, SetWindowPos, GWL_EXSTYLE, SWP_FRAMECHANGED,
        SWP_NOACTIVATE, SWP_NOMOVE, SWP_NOSIZE, SWP_NOZORDER, WS_EX_LAYERED, WS_EX_TRANSPARENT,
    };
    let ex = GetWindowLongPtrW(hwnd, GWL_EXSTYLE);
    SetWindowLongPtrW(
        hwnd,
        GWL_EXSTYLE,
        ex | (WS_EX_TRANSPARENT as isize) | (WS_EX_LAYERED as isize),
    );
    SetWindowPos(
        hwnd,
        std::ptr::null_mut(),
        0,
        0,
        0,
        0,
        SWP_NOMOVE | SWP_NOSIZE | SWP_NOZORDER | SWP_FRAMECHANGED | SWP_NOACTIVATE,
    );
    1 // TRUE (continue enumeration)
}

#[cfg(windows)]
pub fn apply_click_through(hwnd_usize: usize) {
    use windows_sys::Win32::UI::WindowsAndMessaging::{
        EnumChildWindows, GetWindowLongPtrW, SetWindowLongPtrW, SetWindowPos, GWL_EXSTYLE,
        SWP_FRAMECHANGED, SWP_NOACTIVATE, SWP_NOMOVE, SWP_NOSIZE, SWP_NOZORDER, WS_EX_LAYERED,
        WS_EX_NOACTIVATE, WS_EX_TRANSPARENT,
    };
    let hwnd = hwnd_usize as windows_sys::Win32::Foundation::HWND;
    unsafe {
        let ex = GetWindowLongPtrW(hwnd, GWL_EXSTYLE);
        SetWindowLongPtrW(
            hwnd,
            GWL_EXSTYLE,
            ex | (WS_EX_TRANSPARENT as isize)
                | (WS_EX_LAYERED as isize)
                | (WS_EX_NOACTIVATE as isize),
        );
        SetWindowPos(
            hwnd,
            std::ptr::null_mut(),
            0,
            0,
            0,
            0,
            SWP_NOMOVE | SWP_NOSIZE | SWP_NOZORDER | SWP_FRAMECHANGED | SWP_NOACTIVATE,
        );
        // Ensure child windows pass cursor events without disabling their message queues
        EnumChildWindows(hwnd, Some(enum_child_proc), 0);
    }
}

/// Spawns a background thread listening for global hotkey F10 to toggle the overlay on/off
fn ensure_global_hotkey(app: AppHandle) {
    if HOTKEY_INITIALIZED.swap(true, Ordering::SeqCst) {
        return;
    }

    #[cfg(windows)]
    {
        let app_handle = app.clone();
        std::thread::spawn(move || {
            use windows_sys::Win32::UI::Input::KeyboardAndMouse::{
                RegisterHotKey, MOD_NOREPEAT, VK_F10,
            };
            use windows_sys::Win32::UI::WindowsAndMessaging::{
                DispatchMessageW, GetMessageW, MSG, WM_HOTKEY,
            };

            const HOTKEY_ID_F10: i32 = 1349;
            unsafe {
                RegisterHotKey(
                    std::ptr::null_mut(),
                    HOTKEY_ID_F10,
                    MOD_NOREPEAT,
                    VK_F10 as u32,
                );

                let mut msg: MSG = std::mem::zeroed();
                while GetMessageW(&mut msg, std::ptr::null_mut(), 0, 0) > 0 {
                    if msg.message == WM_HOTKEY && msg.wParam == HOTKEY_ID_F10 as usize {
                        let h = app_handle.clone();
                        let _ = app_handle.run_on_main_thread(move || {
                            let _ = operator_overlay_toggle(h.clone(), None);
                            let is_active = operator_overlay_status(h.clone());
                            let _ = h.emit("overlay_status_changed", is_active);
                        });
                    }
                    DispatchMessageW(&msg);
                }
            }
        });
    }
}

#[tauri::command]
pub fn operator_overlay_toggle(app: AppHandle, url: Option<String>) -> Result<bool, String> {
    let _lock = TOGGLE_LOCK.lock().map_err(|e| e.to_string())?;
    ensure_global_hotkey(app.clone());

    // If overlay window already exists, toggle visibility without destroying or recreating it
    if let Some(win) = app.get_webview_window("operator_overlay") {
        let is_visible = win.is_visible().unwrap_or(false);
        if is_visible {
            win.hide().map_err(|e| e.to_string())?;
            let _ = app.emit("overlay_status_changed", false);
            return Ok(false);
        } else {
            win.show().map_err(|e| e.to_string())?;
            let _ = win.set_always_on_top(true);
            let _ = app.emit("overlay_status_changed", true);
            return Ok(true);
        }
    }

    let raw_url = url.unwrap_or_else(|| "http://127.0.0.1:1349/hud/".to_string());
    let target_url = if raw_url.starts_with("http://") || raw_url.starts_with("https://") {
        raw_url
    } else {
        format!(
            "http://127.0.0.1:1349{}",
            if raw_url.starts_with('/') {
                raw_url
            } else {
                format!("/{}", raw_url)
            }
        )
    };

    let parsed_url: url::Url = target_url
        .parse()
        .map_err(|e: url::ParseError| e.to_string())?;

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

    let _ = win.set_ignore_cursor_events(true);

    #[cfg(windows)]
    {
        if let Ok(raw_hwnd) = win.hwnd() {
            let hwnd_usize = raw_hwnd.0 as usize;
            apply_click_through(hwnd_usize);

            // Re-apply click-through styling as child WebView surfaces initialize
            std::thread::spawn(move || {
                for _ in 0..6 {
                    std::thread::sleep(std::time::Duration::from_millis(300));
                    apply_click_through(hwnd_usize);
                }
            });
        }
    }

    let _ = app.emit("overlay_status_changed", true);
    Ok(true)
}

#[tauri::command]
pub fn operator_overlay_close(app: AppHandle) -> Result<(), String> {
    let _lock = TOGGLE_LOCK.lock().map_err(|e| e.to_string())?;
    if let Some(win) = app.get_webview_window("operator_overlay") {
        let _ = win.hide();
    }
    let _ = app.emit("overlay_status_changed", false);
    Ok(())
}
