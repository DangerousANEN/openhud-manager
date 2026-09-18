// Operator Game Overlay window controller for PROTOKOL HUD Manager
// Creates an always-on-top, click-through (transparent) overlay directly over CS2.

use std::sync::atomic::{AtomicBool, Ordering};
use tauri::{AppHandle, Emitter, Manager, WebviewUrl, WebviewWindowBuilder};

static HOTKEY_INITIALIZED: AtomicBool = AtomicBool::new(false);

#[tauri::command]
pub fn operator_overlay_status(app: AppHandle) -> bool {
    app.get_webview_window("operator_overlay").is_some()
}

#[cfg(windows)]
unsafe extern "system" fn enum_child_proc(
    hwnd: windows_sys::Win32::Foundation::HWND,
    _lparam: windows_sys::Win32::Foundation::LPARAM,
) -> windows_sys::Win32::Foundation::BOOL {
    use windows_sys::Win32::UI::Input::KeyboardAndMouse::EnableWindow;
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
    // Disable the child window so Windows hit-testing passes straight through to whatever is underneath
    EnableWindow(hwnd, 0);
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
        // Also ensure all child windows (WebView2 controller, Chrome_WidgetWin_0, etc.) are click-through
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
                // Register F10 globally
                RegisterHotKey(
                    std::ptr::null_mut(),
                    HOTKEY_ID_F10,
                    MOD_NOREPEAT,
                    VK_F10 as u32,
                );

                let mut msg: MSG = std::mem::zeroed();
                while GetMessageW(&mut msg, std::ptr::null_mut(), 0, 0) > 0 {
                    if msg.message == WM_HOTKEY && msg.wParam == HOTKEY_ID_F10 as usize {
                        let _ = operator_overlay_toggle(app_handle.clone(), None);
                        let is_active = operator_overlay_status(app_handle.clone());
                        let _ = app_handle.emit("overlay_status_changed", is_active);
                    }
                    DispatchMessageW(&msg);
                }
            }
        });
    }
}

#[tauri::command]
pub fn operator_overlay_toggle(app: AppHandle, url: Option<String>) -> Result<bool, String> {
    ensure_global_hotkey(app.clone());

    if let Some(win) = app.get_webview_window("operator_overlay") {
        win.close().map_err(|e| e.to_string())?;
        let _ = app.emit("overlay_status_changed", false);
        return Ok(false);
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

            // Periodically re-apply click-through to ensure WebView2 child window gets WS_EX_TRANSPARENT as soon as it initializes
            std::thread::spawn(move || {
                for _ in 0..12 {
                    std::thread::sleep(std::time::Duration::from_millis(250));
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
    if let Some(win) = app.get_webview_window("operator_overlay") {
        win.close().map_err(|e| e.to_string())?;
    }
    let _ = app.emit("overlay_status_changed", false);
    Ok(())
}
