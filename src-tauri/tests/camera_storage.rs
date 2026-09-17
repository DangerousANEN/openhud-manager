// Integration tests for PROTOKOL HUD Manager camera storage and validation.
// Tests use real SQLite persistence under an isolated XDG_DATA_HOME/APPDATA sandbox.

use std::fs;
use std::path::PathBuf;
use std::sync::Mutex;
use uuid::Uuid;

use protokol_lib::db::{
    self, delete_camera, get_camera, list_cameras, open, save_camera, validate_camera, Camera,
};

static TEST_LOCK: Mutex<()> = Mutex::new(());

/// Helper to configure an isolated directory for database operations.
struct SandboxGuard {
    dir: PathBuf,
    previous_root: Option<std::ffi::OsString>,
}

impl SandboxGuard {
    fn new() -> Self {
        let unique = format!("test-data-{}", Uuid::new_v4());
        let dir = std::env::temp_dir().join(unique);
        fs::create_dir_all(&dir).expect("failed to create sandbox dir");

        // Use an explicit root on every OS; Windows known folders ignore APPDATA.
        let previous_root = std::env::var_os("PROTOKOL_DATA_DIR");
        let guard = Self { dir, previous_root };
        std::env::set_var("PROTOKOL_DATA_DIR", &guard.dir);
        assert_eq!(db::db_path(), guard.dir.join("PROTOKOL HUD/protokol.db"));
        let _ = open().expect("open() failed to initialize schema");
        guard
    }
}

impl Drop for SandboxGuard {
    fn drop(&mut self) {
        match &self.previous_root {
            Some(value) => std::env::set_var("PROTOKOL_DATA_DIR", value),
            None => std::env::remove_var("PROTOKOL_DATA_DIR"),
        }
        let _ = fs::remove_dir_all(&self.dir);
    }
}

fn sample_valid_cam(steamid: &str) -> Camera {
    Camera {
        steamid: steamid.to_string(),
        url: "https://example.com/cam/feed.m3u8".to_string(),
        kind: "video".to_string(),
        enabled: true,
        muted: true,
    }
}

#[test]
fn test_steamid_17_digits_validation() {
    let _lock = TEST_LOCK.lock().unwrap();

    // 1. Valid 17-digit SteamID
    let valid = sample_valid_cam("76561198000000001");
    assert!(validate_camera(&valid).is_ok());

    // 2. Exact boundary tests: 16 digits and 18 digits must fail
    let mut short = valid.clone();
    short.steamid = "7656119800000000".to_string(); // 16 digits
    let err_short = validate_camera(&short).unwrap_err().to_string();
    assert!(err_short.contains("17 цифр") || err_short.contains("SteamID"));

    let mut long = valid.clone();
    long.steamid = "765611980000000019".to_string(); // 18 digits
    let err_long = validate_camera(&long).unwrap_err().to_string();
    assert!(err_long.contains("17 цифр") || err_long.contains("SteamID"));

    // 3. Non-digit characters: alphabetic, special chars, whitespace
    let invalid_ids = [
        "",                   // empty
        "                 ",  // whitespace only
        "7656119800000000a",  // trailing letter
        "a7656119800000001",  // leading letter
        "76561198 00000001",  // internal space
        "7656119800000000!",  // special char
        "7656119800000000\t", // tab
        "7656119800000000\n", // newline
        "STEAM_0:1:1234567",  // legacy format
        "[U:1:12345678]",     // Steam3 format
        "-7656119800000001",  // negative sign
        "+7656119800000001",  // positive sign
    ];

    for id in invalid_ids {
        let mut cam = valid.clone();
        cam.steamid = id.to_string();
        assert!(
            validate_camera(&cam).is_err(),
            "Expected failure for invalid SteamID: '{id}'"
        );
    }
}

#[test]
fn test_url_schemes_and_credentials_validation() {
    let _lock = TEST_LOCK.lock().unwrap();

    let valid = sample_valid_cam("76561198000000002");

    // 1. Valid URLs: http and https
    let valid_urls = [
        "http://127.0.0.1:1349/overlay/_test/cam-a.webm",
        "https://vdo.ninja/?view=sample123",
        "https://cam.tournament.gg:8443/hls/stream.m3u8?token=xyz",
        "http://localhost:8080/feed",
        "https://sub.domain.example.com/stream/index.html#anchor",
    ];
    for u in valid_urls {
        let mut cam = valid.clone();
        cam.url = u.to_string();
        assert!(validate_camera(&cam).is_ok(), "Valid URL rejected: '{u}'");
    }

    // 2. Reject credentials in URLs (security requirement)
    let cred_urls = [
        "http://admin:secret@127.0.0.1:8080/cam.m3u8",
        "https://user:password@example.com/feed",
        "http://admin@example.com/stream",
        "https://:emptyuserpassword@example.com/stream",
    ];
    for u in cred_urls {
        let mut cam = valid.clone();
        cam.url = u.to_string();
        let res = validate_camera(&cam);
        assert!(
            res.is_err(),
            "URL with credentials unexpectedly allowed: '{u}'"
        );
        let msg = res.unwrap_err().to_string();
        assert!(
            msg.contains("логин") || msg.contains("пароль") || msg.contains("хост"),
            "Expected credentials error message, got: '{msg}'"
        );
    }

    // 3. Reject forbidden schemes and dangerous inputs
    let forbidden_schemes = [
        "javascript:alert(1)",
        "file:///etc/passwd",
        "file:///C:/Windows/win.ini",
        "ftp://example.com/feed",
        "rtsp://192.168.1.100:554/live",
        "data:text/html,<script>alert(1)</script>",
        "ws://127.0.0.1:1349/ws",
        "wss://example.com/ws",
        "gsi://token@localhost",
        "//example.com/no-scheme",
        "http://",
        "https://",
        "http://\\bad-backslash/path",
        "http://:8080/missing-host",
    ];
    for u in forbidden_schemes {
        let mut cam = valid.clone();
        cam.url = u.to_string();
        assert!(
            validate_camera(&cam).is_err(),
            "Forbidden/invalid URL was accepted: '{u}'"
        );
    }
}

#[test]
fn test_camera_kind_validation() {
    let _lock = TEST_LOCK.lock().unwrap();

    let mut cam = sample_valid_cam("76561198000000003");

    cam.kind = "video".to_string();
    assert!(validate_camera(&cam).is_ok());

    cam.kind = "iframe".to_string();
    assert!(validate_camera(&cam).is_ok());

    // Case-insensitivity check
    cam.kind = "VIDEO".to_string();
    assert!(validate_camera(&cam).is_ok());

    cam.kind = "IFrame ".to_string();
    assert!(validate_camera(&cam).is_ok());

    // Invalid kinds
    for bad_kind in ["image", "rtmp", "audio", "embed", "webcam", ""] {
        cam.kind = bad_kind.to_string();
        assert!(
            validate_camera(&cam).is_err(),
            "Bad camera kind '{bad_kind}' was accepted"
        );
    }
}

#[test]
fn test_camera_crud_persistence_in_sandbox() {
    let _lock = TEST_LOCK.lock().unwrap();
    let _guard = SandboxGuard::new();

    let sid1 = "76561198000000010";
    let sid2 = "76561198000000020";

    // 1. Verify initially empty
    let initial = list_cameras().expect("list_cameras failed");
    assert!(initial.is_empty(), "Expected empty camera list initially");

    // 2. Save first camera
    let cam1 = Camera {
        steamid: sid1.to_string(),
        url: "http://127.0.0.1:1349/overlay/_test/cam-a.webm".to_string(),
        kind: "video".to_string(),
        enabled: true,
        muted: true,
    };
    let saved1 = save_camera(cam1.clone()).expect("failed to save cam1");
    assert_eq!(saved1.steamid, sid1);

    // 3. Save second camera (iframe)
    let cam2 = Camera {
        steamid: sid2.to_string(),
        url: "https://vdo.ninja/?view=room123".to_string(),
        kind: "iframe".to_string(),
        enabled: false,
        muted: false,
    };
    save_camera(cam2.clone()).expect("failed to save cam2");

    // 4. Retrieve single cameras via get_camera
    let fetched1 = get_camera(sid1).expect("get_camera(1) failed");
    assert!(fetched1.is_some());
    let fetched1 = fetched1.unwrap();
    assert_eq!(fetched1.steamid, sid1);
    assert_eq!(fetched1.url, cam1.url);
    assert_eq!(fetched1.kind, "video");
    assert!(fetched1.enabled);
    assert!(fetched1.muted);

    let fetched2 = get_camera(sid2).expect("get_camera(2) failed");
    assert!(fetched2.is_some());
    let fetched2 = fetched2.unwrap();
    assert_eq!(fetched2.steamid, sid2);
    assert_eq!(fetched2.url, cam2.url);
    assert_eq!(fetched2.kind, "iframe");
    assert!(!fetched2.enabled);
    assert!(!fetched2.muted);

    // 5. Verify list_cameras ordering and count
    let list = list_cameras().expect("list_cameras failed");
    assert_eq!(list.len(), 2);
    assert_eq!(list[0].steamid, sid1);
    assert_eq!(list[1].steamid, sid2);

    // 6. Update cam1 (upsert on conflict)
    let mut cam1_updated = cam1.clone();
    cam1_updated.url = "http://127.0.0.1:1349/overlay/_test/cam-updated.webm".to_string();
    cam1_updated.enabled = false;
    save_camera(cam1_updated.clone()).expect("failed to update cam1");

    let fetched1_after = get_camera(sid1).expect("get_camera failed").unwrap();
    assert_eq!(fetched1_after.url, cam1_updated.url);
    assert!(!fetched1_after.enabled);

    // 7. Delete cam2
    delete_camera(sid2).expect("delete_camera failed");
    assert!(get_camera(sid2).expect("get_camera failed").is_none());

    let list_after_delete = list_cameras().expect("list_cameras failed");
    assert_eq!(list_after_delete.len(), 1);
    assert_eq!(list_after_delete[0].steamid, sid1);

    // 8. Delete cam1
    delete_camera(sid1).expect("delete_camera failed");
    assert!(list_cameras().expect("list_cameras failed").is_empty());
}

#[test]
fn test_unchanged_config_on_reject() {
    let _lock = TEST_LOCK.lock().unwrap();
    let _guard = SandboxGuard::new();

    let sid = "76561198000000030";

    // 1. Store valid initial camera state
    let original = Camera {
        steamid: sid.to_string(),
        url: "https://example.com/initial/stream.m3u8".to_string(),
        kind: "video".to_string(),
        enabled: true,
        muted: true,
    };
    save_camera(original.clone()).expect("initial save failed");

    // Verify it is committed in DB
    let current = get_camera(sid).expect("get_camera failed").unwrap();
    assert_eq!(current, original);

    // 2. Attempt update with invalid URL (credentials)
    let bad_url_cam = Camera {
        steamid: sid.to_string(),
        url: "https://admin:pass@example.com/malicious".to_string(),
        kind: "video".to_string(),
        enabled: false,
        muted: false,
    };
    let reject_url = save_camera(bad_url_cam);
    assert!(
        reject_url.is_err(),
        "Expected save_camera to reject invalid credentials URL"
    );

    // Verify DB record remained exactly unchanged
    let post_reject_1 = get_camera(sid).expect("get_camera failed").unwrap();
    assert_eq!(
        post_reject_1, original,
        "DB state was mutated after rejected URL update!"
    );

    // 3. Attempt update with invalid kind
    let bad_kind_cam = Camera {
        steamid: sid.to_string(),
        url: "https://example.com/good_url.m3u8".to_string(),
        kind: "unsupported_kind".to_string(),
        enabled: false,
        muted: false,
    };
    let reject_kind = save_camera(bad_kind_cam);
    assert!(
        reject_kind.is_err(),
        "Expected save_camera to reject invalid kind"
    );

    // Verify DB record remained exactly unchanged
    let post_reject_2 = get_camera(sid).expect("get_camera failed").unwrap();
    assert_eq!(
        post_reject_2, original,
        "DB state was mutated after rejected kind update!"
    );

    // 4. Attempt update with invalid scheme
    let bad_scheme_cam = Camera {
        steamid: sid.to_string(),
        url: "ftp://example.com/ftp_feed".to_string(),
        kind: "video".to_string(),
        enabled: false,
        muted: false,
    };
    let reject_scheme = save_camera(bad_scheme_cam);
    assert!(
        reject_scheme.is_err(),
        "Expected save_camera to reject ftp scheme"
    );

    let post_reject_3 = get_camera(sid).expect("get_camera failed").unwrap();
    assert_eq!(
        post_reject_3, original,
        "DB state was mutated after rejected scheme update!"
    );
}
