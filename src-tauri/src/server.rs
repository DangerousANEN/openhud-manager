// Axum HTTP server: CS2 GSI ingest, WebSocket fan-out, OBS overlay hosting,
// cs-hud theme runtime support, and Lexogrine LHM Socket.io emulation.
use axum::{
    extract::{
        ws::{Message, WebSocket, WebSocketUpgrade},
        Path as AxumPath, Query, State,
    },
    http::{header, StatusCode},
    response::{IntoResponse, Response},
    routing::{get, post},
    Json, Router,
};
use serde::Deserialize;
use serde_json::{json, Value};
use std::net::SocketAddr;
use std::path::PathBuf;
use std::sync::Arc;
use tower_http::cors::CorsLayer;
use tower_http::services::ServeDir;

use crate::gsi::GsiState;

#[derive(Clone)]
pub struct AppState {
    pub gsi: Arc<GsiState>,
}

/// Directory the OBS browser sources are served from.
pub fn overlays_dir() -> PathBuf {
    let base = dirs::data_dir().unwrap_or_else(|| PathBuf::from("."));
    let p1 = base.join("PROTOKOL HUD").join("overlays");
    let p2 = base.join("OpenHUD").join("overlays");

    // The product rename moved the data dir from "OpenHUD" to "PROTOKOL HUD".
    // A bare `p1.exists()` is not enough: Tauri creates an EMPTY "PROTOKOL HUD"
    // dir on first launch, so the new path wins while every real pack still
    // lives under the legacy dir -> every /overlay/<pack> request 404s and all
    // OBS browser sources go blank. Migrate legacy packs once, then prefer p1.
    let pack_count = |p: &PathBuf| -> usize {
        std::fs::read_dir(p)
            .map(|rd| {
                rd.filter_map(|e| e.ok())
                    .filter(|e| e.path().join("index.html").exists())
                    .count()
            })
            .unwrap_or(0)
    };

    if p2.exists() && pack_count(&p2) > pack_count(&p1) {
        let _ = std::fs::create_dir_all(&p1);
        if let Ok(rd) = std::fs::read_dir(&p2) {
            for entry in rd.filter_map(|e| e.ok()) {
                let src = entry.path();
                if !src.join("index.html").exists() {
                    continue;
                }
                let Some(name) = src.file_name() else { continue };
                let dst = p1.join(name);
                if dst.join("index.html").exists() {
                    continue; // already migrated / newer copy present
                }
                copy_dir_recursive(&src, &dst);
            }
        }
    }

    if p1.exists() {
        return p1;
    }
    if p2.exists() {
        return p2;
    }
    let _ = std::fs::create_dir_all(&p1);
    p1
}

/// Recursively copy `src` into `dst`, ignoring individual failures.
fn copy_dir_recursive(src: &PathBuf, dst: &PathBuf) {
    if std::fs::create_dir_all(dst).is_err() {
        return;
    }
    let Ok(rd) = std::fs::read_dir(src) else { return };
    for entry in rd.filter_map(|e| e.ok()) {
        let from = entry.path();
        let to = dst.join(entry.file_name());
        if from.is_dir() {
            copy_dir_recursive(&from, &to);
        } else {
            let _ = std::fs::copy(&from, &to);
        }
    }
}

/// Directory where shared cs-hud client libraries live.
pub fn dependencies_dir() -> PathBuf {
    let base = dirs::data_dir().unwrap_or_else(|| PathBuf::from("."));
    let p1 = base.join("PROTOKOL HUD").join("dependencies");
    if p1.exists() {
        return p1;
    }
    let p2 = base.join("OpenHUD").join("dependencies");
    if p2.exists() {
        return p2;
    }
    let p3 = PathBuf::from("public").join("dependencies");
    if p3.exists() {
        return p3;
    }
    p1
}

/// Active HUD directory (prefers fennec-official if present, else overlays root).
pub fn active_hud_dir() -> PathBuf {
    let root = overlays_dir();
    let fennec = root.join("fennec-official");
    if fennec.exists() {
        return fennec;
    }
    let fennec_pro = root.join("fennec-pro");
    if fennec_pro.exists() {
        return fennec_pro;
    }
    root
}

pub fn router(state: AppState) -> Router {
    let overlays = overlays_dir();
    let deps = dependencies_dir();

    Router::new()
        .route("/api/gsi", post(gsi_ingest))
        .route("/api/status", get(status))
        .route("/api/state", get(current_state))
        // Universal WebSocket endpoints
        .route("/ws", get(ws_upgrade))
        .route("/", get(root_handler))
        // Lexogrine LHM Socket.io emulation
        .route("/socket.io/", get(socketio_handler).post(socketio_post))
        .route("/socket.io", get(socketio_handler).post(socketio_post))
        // cs-hud dynamic dependencies & theme serving
        .nest_service("/dependencies", ServeDir::new(deps))
        .route("/hud", get(hud_root))
        .route("/hud/", get(hud_root))
        .route("/hud/*path", get(hud_file_handler))
        // Static overlay packs hosting
        .nest_service("/overlay", ServeDir::new(overlays))
        .layer(CorsLayer::permissive())
        .with_state(state)
}

/// CS2 POSTs the full game state here on every tick.
async fn gsi_ingest(State(st): State<AppState>, body: String) -> impl IntoResponse {
    let payload: Value = match serde_json::from_str(&body) {
        Ok(v) => v,
        Err(e) => return (StatusCode::BAD_REQUEST, format!("bad json: {e}")),
    };

    let expected = st.gsi.token.read().clone();
    if !expected.is_empty() {
        let got = payload
            .get("auth")
            .and_then(|a| a.get("token"))
            .and_then(|t| t.as_str())
            .unwrap_or("");
        if got != expected {
            return (StatusCode::UNAUTHORIZED, "bad token".to_string());
        }
    }

    st.gsi.ingest(payload);
    (StatusCode::OK, "ok".to_string())
}

async fn status(State(st): State<AppState>) -> Json<Value> {
    Json(json!({
        "connected": st.gsi.connected(),
        "seconds_since_update": st.gsi.seconds_since_update(),
        "listeners": st.gsi.tx.receiver_count(),
    }))
}

async fn current_state(State(st): State<AppState>) -> Json<Value> {
    Json(json!(*st.gsi.snapshot.read()))
}

/// Root handler: WebSocket upgrade if requested, otherwise redirect to /hud/ or /overlay/
async fn root_handler(
    ws: Option<WebSocketUpgrade>,
    State(st): State<AppState>,
) -> impl IntoResponse {
    if let Some(ws) = ws {
        return ws.on_upgrade(move |socket| ws_loop(socket, st)).into_response();
    }
    axum::response::Redirect::temporary("/hud/index.html").into_response()
}

async fn ws_upgrade(ws: WebSocketUpgrade, State(st): State<AppState>) -> impl IntoResponse {
    ws.on_upgrade(move |socket| ws_loop(socket, st))
}

/// Build universal JSON snapshot containing both cs-hud event and flat properties.
fn make_universal_snapshot(st: &AppState) -> String {
    let snap = st.gsi.snapshot.read().clone();
    let raw = st.gsi.raw.read().clone().unwrap_or(Value::Null);

    let active = active_hud_dir();
    let radars: Value = std::fs::read_to_string(active.join("radars.json"))
        .ok()
        .and_then(|s| serde_json::from_str(&s).ok())
        .unwrap_or_else(|| json!({}));
    let bombsites: Value = std::fs::read_to_string(active.join("bombsites.json"))
        .ok()
        .and_then(|s| serde_json::from_str(&s).ok())
        .unwrap_or_else(|| json!({}));

    let msg = json!({
        "event": "state",
        "body": {
            "gsiState": raw,
            "additionalState": {
                "lastKnownMapName": snap.map,
                "lastKnownBombPlantedCountdown": {},
                "lastKnownPlayerObserverSlot": {},
                "moneyAtStartOfRound": {},
                "roundDamages": {}
            },
            "bombsites": bombsites,
            "options": {},
            "radars": radars,
            "unixTimestamp": chrono::Utc::now().timestamp_millis()
        },
        "snapshot": snap,
        "map": snap.map,
        "phase": snap.phase,
        "round": snap.round,
        "ct_score": snap.ct_score,
        "t_score": snap.t_score,
        "ct_name": snap.ct_name,
        "t_name": snap.t_name,
        "bomb": snap.bomb,
        "round_time": snap.round_time,
        "focused_steamid": snap.focused_steamid,
        "players": snap.players,
        "updated_at": snap.updated_at
    });

    serde_json::to_string(&msg).unwrap_or_default()
}

/// Push universal snapshot immediately, then stream every update.
async fn ws_loop(mut socket: WebSocket, st: AppState) {
    let mut rx = st.gsi.tx.subscribe();

    let initial = make_universal_snapshot(&st);
    if !initial.is_empty() {
        let _ = socket.send(Message::Text(initial)).await;
    }

    loop {
        tokio::select! {
            msg = rx.recv() => match msg {
                Ok(text) => {
                    if socket.send(Message::Text(text)).await.is_err() {
                        break;
                    }
                }
                Err(tokio::sync::broadcast::error::RecvError::Lagged(_)) => continue,
                Err(_) => break,
            },
            incoming = socket.recv() => match incoming {
                Some(Ok(Message::Close(_))) | None => break,
                Some(Err(_)) => break,
                _ => {}
            }
        }
    }
}

// ─── Lexogrine LHM Socket.io Emulation ──────────────────────────────────────

#[derive(Deserialize, Debug, Default)]
struct SocketIoQuery {
    #[serde(rename = "EIO")]
    _eio: Option<String>,
    transport: Option<String>,
    _sid: Option<String>,
}

async fn socketio_handler(
    Query(query): Query<SocketIoQuery>,
    ws: Option<WebSocketUpgrade>,
    State(st): State<AppState>,
) -> Response {
    if let Some(ws) = ws {
        return ws
            .on_upgrade(move |socket| socketio_loop(socket, st))
            .into_response();
    }

    if query.transport.as_deref() == Some("polling") {
        let sid = uuid::Uuid::new_v4().to_string();
        let handshake = json!({
            "sid": sid,
            "upgrades": ["websocket"],
            "pingInterval": 25000,
            "pingTimeout": 20000,
            "maxPayload": 1000000
        });
        return (
            [(header::CONTENT_TYPE, "text/plain; charset=UTF-8")],
            format!("0{}", handshake),
        )
            .into_response();
    }

    StatusCode::BAD_REQUEST.into_response()
}

async fn socketio_post() -> impl IntoResponse {
    (StatusCode::OK, "ok")
}

async fn socketio_loop(mut socket: WebSocket, st: AppState) {
    let sid = uuid::Uuid::new_v4().to_string();
    let handshake = json!({
        "sid": sid,
        "upgrades": [],
        "pingInterval": 25000,
        "pingTimeout": 20000,
        "maxPayload": 1000000
    });

    if socket
        .send(Message::Text(format!("0{}", handshake)))
        .await
        .is_err()
    {
        return;
    }

    if socket.send(Message::Text("40".into())).await.is_err() {
        return;
    }
    let _ = socket
        .send(Message::Text(r#"42["readyToRegister"]"#.into()))
        .await;

    // Push initial raw GSI if present (drop lock guard before await)
    let raw_initial = { st.gsi.raw.read().clone() };
    if let Some(raw_val) = raw_initial {
        let update_pkt = json!(["update", raw_val, []]);
        let _ = socket.send(Message::Text(format!("42{}", update_pkt))).await;
    }

    let mut rx = st.gsi.tx.subscribe();
    loop {
        tokio::select! {
            msg = rx.recv() => match msg {
                Ok(text) => {
                    if let Ok(val) = serde_json::from_str::<Value>(&text) {
                        let raw = &val["body"]["gsiState"];
                        if !raw.is_null() {
                            let update_pkt = json!(["update", raw, []]);
                            if socket.send(Message::Text(format!("42{}", update_pkt))).await.is_err() {
                                break;
                            }
                        }
                    }
                }
                Err(tokio::sync::broadcast::error::RecvError::Lagged(_)) => continue,
                Err(_) => break,
            },
            incoming = socket.recv() => match incoming {
                Some(Ok(Message::Text(txt))) => {
                    if txt == "2" {
                        let _ = socket.send(Message::Text("3".into())).await;
                    } else if txt.starts_with(r#"42["started""#) || txt.starts_with(r#"42["register""#) {
                        let raw_current = { st.gsi.raw.read().clone() };
                        if let Some(raw_val) = raw_current {
                            let update_pkt = json!(["update", raw_val, []]);
                            let _ = socket.send(Message::Text(format!("42{}", update_pkt))).await;
                        }
                    }
                }
                Some(Ok(Message::Close(_))) | None => break,
                Some(Err(_)) => break,
                _ => {}
            }
        }
    }
}

// ─── cs-hud Theme Runtime Serving (/hud/*) ──────────────────────────────────

fn mime_for_path(p: &std::path::Path) -> &'static str {
    match p.extension().and_then(|s| s.to_str()).unwrap_or("") {
        "html" | "htm" => "text/html; charset=utf-8",
        "css" => "text/css; charset=utf-8",
        "js" | "mjs" => "application/javascript; charset=utf-8",
        "json" => "application/json; charset=utf-8",
        "svg" => "image/svg+xml",
        "png" => "image/png",
        "jpg" | "jpeg" => "image/jpeg",
        "webp" => "image/webp",
        "woff2" => "font/woff2",
        "woff" => "font/woff",
        "ttf" => "font/ttf",
        _ => "application/octet-stream",
    }
}

async fn hud_root(ws: Option<WebSocketUpgrade>, State(st): State<AppState>) -> Response {
    if let Some(ws) = ws {
        return ws.on_upgrade(move |socket| ws_loop(socket, st)).into_response();
    }
    hud_file_handler(AxumPath("index.html".to_string()), ws, State(st)).await
}

async fn hud_file_handler(
    AxumPath(path): AxumPath<String>,
    ws: Option<WebSocketUpgrade>,
    State(st): State<AppState>,
) -> Response {
    // If incoming request is a WebSocket connection to /hud/... upgrade it!
    if let Some(ws) = ws {
        return ws.on_upgrade(move |socket| ws_loop(socket, st)).into_response();
    }

    let active_dir = active_hud_dir();
    let target = active_dir.join(&path);

    if target.is_file() {
        match tokio::fs::read(&target).await {
            Ok(bytes) => {
                let mime = mime_for_path(&target);
                return ([(header::CONTENT_TYPE, mime)], bytes).into_response();
            }
            Err(_) => return StatusCode::INTERNAL_SERVER_ERROR.into_response(),
        }
    }

    // Dynamic Vue SFC synthesis: if <name>.vue requested and doesn't exist,
    // synthesize wrapper pointing to <name>.js, <name>.css, <name>.html
    if path.ends_with(".vue") {
        let p = std::path::Path::new(&path);
        if let Some(stem) = p.file_stem().and_then(|s| s.to_str()) {
            let parent = p.parent().unwrap_or(std::path::Path::new(""));
            let dir_str = parent.to_string_lossy().replace('\\', "/");
            let dir_prefix = if dir_str.is_empty() {
                String::new()
            } else {
                format!("{dir_str}/")
            };

            let synthetic = format!(
                "<!-- generated dynamically by PROTOKOL HUD -->\n\
                 <script src=\"/hud/{dir_prefix}{stem}.js\"></script>\n\
                 <style src=\"/hud/{dir_prefix}{stem}.css\" scoped></style>\n\
                 <template src=\"/hud/{dir_prefix}{stem}.html\"></template>\n"
            );
            return ([(header::CONTENT_TYPE, "text/html; charset=utf-8")], synthetic)
                .into_response();
        }
    }

    StatusCode::NOT_FOUND.into_response()
}

/// Bind and serve. Returns the error if the port is already taken.
pub async fn serve(state: AppState, port: u16) -> anyhow::Result<()> {
    let addr = SocketAddr::from(([0, 0, 0, 0], port));
    let listener = tokio::net::TcpListener::bind(addr).await?;
    println!("[protokol] Universal GSI + overlay server listening on http://{addr}");
    axum::serve(listener, router(state)).await?;
    Ok(())
}

pub fn can_bind(port: u16) -> bool {
    std::net::TcpListener::bind(SocketAddr::from(([0, 0, 0, 0], port))).is_ok()
}
