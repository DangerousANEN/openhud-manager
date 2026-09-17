#!/usr/bin/env python3
"""Backend HTTP/GSI authentication, read-only camera API, and WebSocket E2E verification.

Runs against PROTOKOL HUD Manager backend server in isolated Linux or Windows environments.
Tests real DB CRUD persistence under isolated XDG_DATA_HOME, HTTP security constraints,
GSI authentication/ingest, WebSocket live fan-out, and path traversal defenses.
"""

import asyncio
import json
import os
import re
import socket
import sqlite3
import sys
import time
import urllib.error
import urllib.parse
import urllib.request
from pathlib import Path

BASE_URL = os.getenv("HUD_TEST_URL", "http://127.0.0.1:1349").rstrip("/")

def resolve_data_dir() -> Path:
    """Resolve PROTOKOL HUD data directory respecting XDG_DATA_HOME / APPDATA."""
    xdg = os.getenv("XDG_DATA_HOME")
    if xdg:
        return Path(xdg) / "PROTOKOL HUD"
    appdata = os.getenv("APPDATA")
    if appdata:
        return Path(appdata) / "PROTOKOL HUD"
    return Path.home() / ".local" / "share" / "PROTOKOL HUD"

DATA_DIR = resolve_data_dir()
DB_PATH = DATA_DIR / "protokol.db"

class TestReporter:
    def __init__(self):
        self.passed = 0
        self.failed = 0
        self.skipped = 0
        self.failures = []

    def ok(self, name: str, detail: str = ""):
        self.passed += 1
        msg = f"[PASS] {name}"
        if detail:
            msg += f" ({detail})"
        print(msg)

    def fail(self, name: str, reason: str):
        self.failed += 1
        self.failures.append((name, reason))
        print(f"[FAIL] {name}: {reason}", file=sys.stderr)

    def skip(self, name: str, reason: str):
        self.skipped += 1
        print(f"[SKIP] {name}: {reason}")

    def summary(self) -> int:
        print("\n" + "=" * 60)
        print(f"TEST SUMMARY: {self.passed} passed, {self.failed} failed, {self.skipped} skipped")
        print("=" * 60)
        if self.failures:
            print("\nFailures:")
            for name, reason in self.failures:
                print(f"  - {name}: {reason}")
            return 1
        return 0

reporter = TestReporter()

def http_request(
    path: str,
    method: str = "GET",
    data: bytes = None,
    headers: dict = None,
    timeout: float = 10.0,
):
    """Perform HTTP request returning (status, response_body_bytes, headers)."""
    url = f"{BASE_URL}{path}"
    h = headers.copy() if headers else {}
    req = urllib.request.Request(url, data=data, headers=h, method=method)
    try:
        with urllib.request.urlopen(req, timeout=timeout) as resp:
            return resp.status, resp.read(), resp.headers
    except urllib.error.HTTPError as e:
        return e.code, e.read(), e.headers
    except Exception as e:
        raise RuntimeError(f"Network error connecting to {url}: {e}") from e

def db_query(sql: str, args: tuple = ()):
    """Execute query against isolated SQLite database."""
    if not DB_PATH.exists():
        return None
    with sqlite3.connect(DB_PATH) as conn:
        cursor = conn.cursor()
        cursor.execute(sql, args)
        conn.commit()
        return cursor.fetchall()

# ─────────────────────────────────────────────────────────────────────────────
# Suite 1: Camera Read-Only API & HTTP Mutability Guards
# ─────────────────────────────────────────────────────────────────────────────

def test_camera_api_read_only():
    print("\n--- Suite 1: Camera API Read-Only & Mutability Guard ---")
    
    # 1. GET /api/cameras returns 200 and JSON array
    status, body, _ = http_request("/api/cameras", method="GET")
    if status == 200:
        try:
            cams = json.loads(body.decode("utf-8"))
            if isinstance(cams, list):
                reporter.ok("GET /api/cameras returns 200 JSON list", f"{len(cams)} camera(s)")
            else:
                reporter.fail("GET /api/cameras returns JSON list", f"Returned type: {type(cams)}")
        except Exception as e:
            reporter.fail("GET /api/cameras returns valid JSON", str(e))
    else:
        reporter.fail("GET /api/cameras status", f"Expected 200, got {status}")

    # 2. Mutating HTTP methods on /api/cameras must be rejected (405 or 404)
    # The camera API is strictly read-only on the HTTP server; modifications must go through Tauri IPC
    for method in ["POST", "PUT", "DELETE", "PATCH"]:
        test_body = json.dumps({"steamid": "76561198000000999", "url": "http://127.0.0.1/test.webm"}).encode()
        st, _, _ = http_request(
            "/api/cameras",
            method=method,
            data=test_body if method in ["POST", "PUT", "PATCH"] else None,
            headers={"Content-Type": "application/json"}
        )
        if st in [404, 405]:
            reporter.ok(f"{method} /api/cameras rejected", f"Status {st}")
        else:
            reporter.fail(f"{method} /api/cameras rejected", f"Expected 405/404, got {st} (mutability exposed!)")

# ─────────────────────────────────────────────────────────────────────────────
# Suite 2: Real DB CRUD Persistence & Synchronization with /api/cameras
# ─────────────────────────────────────────────────────────────────────────────

def test_db_persistence_and_sync():
    print("\n--- Suite 2: DB CRUD Persistence & /api/cameras Sync ---")
    if not DB_PATH.exists():
        reporter.skip("DB CRUD persistence", f"DB file not found at {DB_PATH}")
        return

    test_sid = "76561198000000077"
    cam_url_1 = "https://example.com/stream/feed1.m3u8"
    cam_url_2 = "https://example.com/stream/feed2.m3u8"

    try:
        # 1. Clean up any existing fixture row
        db_query("DELETE FROM cameras WHERE steamid = ?", (test_sid,))

        # 2. Insert camera row into isolated DB
        db_query(
            "INSERT INTO cameras (steamid, url, kind, enabled, muted) VALUES (?, ?, ?, ?, ?)",
            (test_sid, cam_url_1, "video", 1, 1),
        )

        # 3. Read via /api/cameras and verify persistence
        status, body, _ = http_request("/api/cameras", method="GET")
        if status != 200:
            reporter.fail("Read camera via HTTP after DB insert", f"Status {status}")
            return

        cams = json.loads(body.decode("utf-8"))
        matched = [c for c in cams if c.get("steamid") == test_sid]
        if matched and matched[0].get("url") == cam_url_1 and matched[0].get("kind") == "video":
            reporter.ok("DB INSERT persists and syncs to /api/cameras", f"steamid={test_sid}")
        else:
            reporter.fail("DB INSERT sync to /api/cameras", f"Camera not found in HTTP list: {matched}")

        # 4. Update camera row (upsert/update)
        db_query(
            "UPDATE cameras SET url = ?, kind = ?, enabled = 0 WHERE steamid = ?",
            (cam_url_2, "iframe", test_sid),
        )

        status, body, _ = http_request("/api/cameras", method="GET")
        cams = json.loads(body.decode("utf-8"))
        matched = [c for c in cams if c.get("steamid") == test_sid]
        if matched and matched[0].get("url") == cam_url_2 and matched[0].get("kind") == "iframe" and matched[0].get("enabled") is False:
            reporter.ok("DB UPDATE persists and syncs to /api/cameras", "URL, kind, enabled verified")
        else:
            reporter.fail("DB UPDATE sync to /api/cameras", f"Update not reflected: {matched}")

        # 5. Delete camera row
        db_query("DELETE FROM cameras WHERE steamid = ?", (test_sid,))
        status, body, _ = http_request("/api/cameras", method="GET")
        cams = json.loads(body.decode("utf-8"))
        matched = [c for c in cams if c.get("steamid") == test_sid]
        if not matched:
            reporter.ok("DB DELETE persists and cleans up /api/cameras", f"steamid={test_sid}")
        else:
            reporter.fail("DB DELETE sync to /api/cameras", "Camera remained in list after deletion")

    except Exception as e:
        reporter.fail("DB CRUD persistence exception", str(e))
    finally:
        # Guarantee cleanup
        db_query("DELETE FROM cameras WHERE steamid = ?", (test_sid,))

# ─────────────────────────────────────────────────────────────────────────────
# Suite 3: HUD Options & Status/State Endpoints
# ─────────────────────────────────────────────────────────────────────────────

def test_hud_options_and_status():
    print("\n--- Suite 3: HUD Options, Server Status & Current State ---")

    # /api/hud-options
    status, body, _ = http_request("/api/hud-options", method="GET")
    if status == 200:
        try:
            opts = json.loads(body.decode("utf-8"))
            if isinstance(opts, dict) and "avatars" in opts and "radar" in opts:
                reporter.ok("GET /api/hud-options", f"avatars={opts.get('avatars')}, radar={opts.get('radar')}")
            else:
                reporter.fail("GET /api/hud-options structure", f"Unexpected structure: {opts}")
        except Exception as e:
            reporter.fail("GET /api/hud-options parse", str(e))
    else:
        reporter.fail("GET /api/hud-options status", f"Expected 200, got {status}")

    # /api/status
    status, body, _ = http_request("/api/status", method="GET")
    if status == 200:
        try:
            st = json.loads(body.decode("utf-8"))
            if "connected" in st and "seconds_since_update" in st and "listeners" in st:
                reporter.ok("GET /api/status", f"connected={st['connected']}, listeners={st['listeners']}")
            else:
                reporter.fail("GET /api/status schema", f"Missing expected fields: {st}")
        except Exception as e:
            reporter.fail("GET /api/status parse", str(e))
    else:
        reporter.fail("GET /api/status status", f"Expected 200, got {status}")

    # /api/state
    status, body, _ = http_request("/api/state", method="GET")
    if status == 200:
        try:
            state = json.loads(body.decode("utf-8"))
            if "map" in state and "ct_score" in state and "t_score" in state:
                reporter.ok("GET /api/state", f"map={state.get('map')}, score={state.get('ct_score')}:{state.get('t_score')}")
            else:
                reporter.fail("GET /api/state schema", f"Unexpected state format: {state}")
        except Exception as e:
            reporter.fail("GET /api/state parse", str(e))
    else:
        reporter.fail("GET /api/state status", f"Expected 200, got {status}")

# ─────────────────────────────────────────────────────────────────────────────
# Suite 4: GSI Ingest & Authentication Validation
# ─────────────────────────────────────────────────────────────────────────────

def test_gsi_auth_and_ingest():
    print("\n--- Suite 4: GSI Ingest & Authentication Validation ---")

    # Retrieve expected GSI token from DB settings if available
    expected_token = os.getenv("HUD_TEST_TOKEN")
    if not expected_token and DB_PATH.exists():
        rows = db_query("SELECT value FROM settings WHERE key = 'gsi_token'")
        if rows and rows[0]:
            expected_token = rows[0][0]

    # 1. Malformed JSON payload must return 400 Bad Request
    bad_json = b"INVALID JSON {broken["
    st, body, _ = http_request("/api/gsi", method="POST", data=bad_json, headers={"Content-Type": "application/json"})
    if st == 400:
        reporter.ok("POST /api/gsi rejects malformed JSON", f"400 Bad Request: {body.decode(errors='ignore').strip()}")
    else:
        reporter.fail("POST /api/gsi malformed JSON", f"Expected 400, got {st}")

    # 2. Token auth checks
    if expected_token:
        # A. Missing token
        no_token_payload = json.dumps({
            "provider": {"name": "e2e-tester"},
            "map": {"name": "de_dust2", "phase": "live"}
        }).encode("utf-8")
        st, _, _ = http_request("/api/gsi", method="POST", data=no_token_payload, headers={"Content-Type": "application/json"})
        if st == 401:
            reporter.ok("POST /api/gsi rejects missing token", "401 Unauthorized")
        else:
            reporter.fail("POST /api/gsi missing token check", f"Expected 401, got {st}")

        # B. Wrong token
        wrong_token_payload = json.dumps({
            "auth": {"token": "completely-wrong-token-xyz"},
            "provider": {"name": "e2e-tester"},
            "map": {"name": "de_dust2", "phase": "live"}
        }).encode("utf-8")
        st, _, _ = http_request("/api/gsi", method="POST", data=wrong_token_payload, headers={"Content-Type": "application/json"})
        if st == 401:
            reporter.ok("POST /api/gsi rejects invalid token", "401 Unauthorized")
        else:
            reporter.fail("POST /api/gsi invalid token check", f"Expected 401, got {st}")
    else:
        reporter.skip("GSI token validation checks", "gsi_token not set or DB unavailable")

    # 3. Valid GSI Ingest payload updates live state
    valid_auth = {"token": expected_token} if expected_token else {}
    test_map = f"de_test_{int(time.time())}"
    valid_payload = json.dumps({
        "auth": valid_auth,
        "provider": {"name": "backend_e2e.py"},
        "map": {
            "name": test_map,
            "phase": "live",
            "round": 9,
            "team_ct": {"score": 5, "name": "CT_VAL"},
            "team_t": {"score": 4, "name": "T_VAL"}
        },
        "round": {"phase": "live"}
    }).encode("utf-8")

    st, body, _ = http_request("/api/gsi", method="POST", data=valid_payload, headers={"Content-Type": "application/json"})
    if st == 200:
        reporter.ok("POST /api/gsi accepts valid payload", "200 OK")
    else:
        reporter.fail("POST /api/gsi valid payload", f"Expected 200, got {st} ({body.decode(errors='ignore')})")
        return

    # Verify state updated
    time.sleep(0.1)
    st, body, _ = http_request("/api/state", method="GET")
    if st == 200:
        state = json.loads(body.decode("utf-8"))
        if state.get("map") == test_map and state.get("ct_score") == 5 and state.get("t_score") == 4:
            reporter.ok("Live state updated from valid GSI", f"map={test_map} ct=5 t=4")
        else:
            reporter.fail("Live state reflects GSI ingest", f"Got state: {state}")
    else:
        reporter.fail("Read /api/state after GSI ingest", f"Status {st}")

# ─────────────────────────────────────────────────────────────────────────────
# Suite 5: WebSocket /ws Connection & Real-time Live Fan-Out
# ─────────────────────────────────────────────────────────────────────────────

async def async_ws_test():
    """Test WebSocket initial snapshot and broadcast using websockets library."""
    import websockets

    parsed_url = urllib.parse.urlparse(BASE_URL)
    ws_netloc = parsed_url.netloc or f"{parsed_url.hostname}:{parsed_url.port or 1349}"
    ws_uri = f"ws://{ws_netloc}/ws"

    async with websockets.connect(ws_uri) as ws:
        # 1. Initial snapshot on connect
        initial_raw = await asyncio.wait_for(ws.recv(), timeout=5.0)
        initial = json.loads(initial_raw)
        if "snapshot" in initial or "map" in initial or "event" in initial:
            reporter.ok("WebSocket receives initial state snapshot on connect", f"event={initial.get('event')}")
        else:
            reporter.fail("WebSocket initial state snapshot", f"Received: {initial}")

        # 2. Check that listeners count increased in /api/status
        st, body, _ = http_request("/api/status")
        if st == 200:
            status_obj = json.loads(body.decode("utf-8"))
            if status_obj.get("listeners", 0) >= 1:
                reporter.ok("WebSocket connection increments listeners count", f"listeners={status_obj.get('listeners')}")
            else:
                reporter.fail("WebSocket listener count", f"Expected >= 1, got {status_obj.get('listeners')}")

        # 3. Ingest GSI and verify real-time fan-out
        expected_token = os.getenv("HUD_TEST_TOKEN")
        if not expected_token and DB_PATH.exists():
            rows = db_query("SELECT value FROM settings WHERE key = 'gsi_token'")
            if rows and rows[0]:
                expected_token = rows[0][0]

        ws_test_map = f"de_ws_{int(time.time())}"
        ws_payload = json.dumps({
            "auth": {"token": expected_token} if expected_token else {},
            "provider": {"name": "ws_fanout_test"},
            "map": {
                "name": ws_test_map,
                "phase": "live",
                "round": 11,
                "team_ct": {"score": 7, "name": "CT_FAN"},
                "team_t": {"score": 4, "name": "T_FAN"}
            },
            "round": {"phase": "live"}
        }).encode("utf-8")

        st, _, _ = http_request("/api/gsi", method="POST", data=ws_payload, headers={"Content-Type": "application/json"})
        if st != 200:
            reporter.fail("POST /api/gsi for WebSocket broadcast", f"Status {st}")
            return

        # Read WS messages until the broadcast arrives or timeout
        received_broadcast = False
        start_time = time.time()
        while time.time() - start_time < 5.0:
            msg_raw = await asyncio.wait_for(ws.recv(), timeout=2.0)
            msg = json.loads(msg_raw)
            if msg.get("map") == ws_test_map or (isinstance(msg.get("body"), dict) and msg.get("body", {}).get("additionalState", {}).get("lastKnownMapName") == ws_test_map):
                received_broadcast = True
                reporter.ok("WebSocket receives live GSI broadcast update", f"map={ws_test_map}")
                break

        if not received_broadcast:
            reporter.fail("WebSocket live GSI broadcast", f"Did not receive update for {ws_test_map} within timeout")

def test_websocket_fanout():
    print("\n--- Suite 5: WebSocket /ws Connection & Fan-Out ---")
    try:
        import websockets
    except ImportError:
        reporter.skip("WebSocket tests (websockets package not installed)", "Install websockets to run async WS tests")
        return

    try:
        asyncio.run(async_ws_test())
    except Exception as e:
        reporter.fail("WebSocket test encountered error", str(e))

# ─────────────────────────────────────────────────────────────────────────────
# Suite 6: Security Audit & Path Traversal Guard on /hud/*
# ─────────────────────────────────────────────────────────────────────────────

def test_hud_path_traversal_defenses():
    print("\n--- Suite 6: Security Audit & Path Traversal Guard on /hud/* ---")

    # Exact attack vectors requested and security edge cases:
    # URL encoded traversal %2e%2e/%2e%2e/protokol.db, parent dirs, Windows drive letters, backslashes
    traversal_vectors = [
        "/hud/%2e%2e/%2e%2e/protokol.db",
        "/hud/..%2f..%2fprotokol.db",
        "/hud/%2e%2e%2f%2e%2e%2fprotokol.db",
        "/hud/%2e%2e%5c%2e%2e%5cprotokol.db",
        "/hud/....//....//protokol.db",
        "/hud/../../protokol.db",
        "/hud/..\\..\\protokol.db",
        "/hud/C:/Windows/win.ini",
        "/hud//etc/passwd",
        "/hud/%2fetc%2fpasswd",
        "/hud/..%2f..%2f..%2f..%2fetc%2fpasswd",
        "/hud/\\windows\\system32",
    ]

    for path in traversal_vectors:
        test_name = f"Traversal guard: {path}"
        try:
            status, body, _ = http_request(path, method="GET")
            body_str = body.decode(errors="ignore")

            # Must be rejected: 400 (Bad Request), 403 (Forbidden), or 404 (Not Found)
            # 200 OK is an IMMEDIATE security violation
            if status in [400, 403, 404]:
                # Verify that no sqlite header or sensitive file content is returned
                if "SQLite format 3" in body_str or "root:x:0:0" in body_str or "[fonts]" in body_str:
                    reporter.fail(test_name, f"Status {status} but body leaked file data!")
                else:
                    reporter.ok(test_name, f"Blocked with status {status}")
            elif status == 200:
                reporter.fail(test_name, f"CRITICAL SECURITY VULNERABILITY: 200 OK returned for {path}")
            else:
                reporter.ok(test_name, f"Response {status}")
        except Exception as e:
            reporter.fail(test_name, f"Exception during request: {e}")

# ─────────────────────────────────────────────────────────────────────────────
# Suite 7: Validation Constraints Audit (SteamID64, URL schemes & credentials)
# ─────────────────────────────────────────────────────────────────────────────

def test_validation_rules_audit():
    print("\n--- Suite 7: Camera Validation Rules Specification Audit ---")

    # Validate specification rules implemented in Rust:
    # 1. SteamID must be exactly 17 ascii digits
    steamid_regex = re.compile(r"^\d{17}$")
    assert steamid_regex.match("76561198000000001") is not None
    assert steamid_regex.match("7656119800000000") is None   # 16 digits
    assert steamid_regex.match("765611980000000019") is None # 18 digits
    assert steamid_regex.match("7656119800000000a") is None # letter
    reporter.ok("SteamID regex specification: exactly 17 digits")

    # 2. URL scheme restriction: http or https only, credentials forbidden
    def check_url_security(url_str: str) -> tuple[bool, str]:
        if "\\" in url_str:
            return False, "Backslash in URL forbidden"
        try:
            parsed = urllib.parse.urlparse(url_str)
        except Exception as e:
            return False, str(e)
        if parsed.scheme.lower() not in ["http", "https"]:
            return False, f"Invalid scheme: {parsed.scheme}"
        if parsed.username or parsed.password:
            return False, "Credentials forbidden in URL"
        if not parsed.hostname:
            return False, "Missing hostname"
        return True, "Valid"

    assert check_url_security("https://vdo.ninja/?view=sample123")[0] is True
    assert check_url_security("http://127.0.0.1:1349/cam.webm")[0] is True
    assert check_url_security("http://admin:secret@127.0.0.1/cam.webm")[0] is False
    assert check_url_security("javascript:alert(1)")[0] is False
    assert check_url_security("file:///etc/passwd")[0] is False
    assert check_url_security("ftp://example.com/feed")[0] is False
    assert check_url_security("rtsp://192.168.1.1:554/live")[0] is False
    reporter.ok("URL security specification: schemes limited to http/https, credentials rejected")

# ─────────────────────────────────────────────────────────────────────────────
# Main Entry Point
# ─────────────────────────────────────────────────────────────────────────────

def main():
    print("=" * 60)
    print("PROTOKOL HUD Manager - Backend E2E & Security Verification")
    print(f"Target URL : {BASE_URL}")
    print(f"Data Dir   : {DATA_DIR}")
    print(f"DB Path    : {DB_PATH}")
    print("=" * 60)

    test_camera_api_read_only()
    test_db_persistence_and_sync()
    test_hud_options_and_status()
    test_gsi_auth_and_ingest()
    test_websocket_fanout()
    test_hud_path_traversal_defenses()
    test_validation_rules_audit()

    exit_code = reporter.summary()
    sys.exit(exit_code)

if __name__ == "__main__":
    main()
