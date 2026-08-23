// Axum HTTP server: CS2 GSI ingest, WebSocket fan-out, OBS overlay hosting.
use axum::{
    extract::{
        ws::{Message, WebSocket, WebSocketUpgrade},
        State,
    },
    http::StatusCode,
    response::IntoResponse,
    routing::{get, post},
    Json, Router,
};
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
    let dir = base.join("OpenHUD").join("overlays");
    let _ = std::fs::create_dir_all(&dir);
    dir
}

pub fn router(state: AppState) -> Router {
    let overlays = overlays_dir();

    Router::new()
        .route("/api/gsi", post(gsi_ingest))
        .route("/api/status", get(status))
        .route("/api/state", get(current_state))
        .route("/ws", get(ws_upgrade))
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

    // Optional shared-key check: only enforced when a token is configured.
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

async fn ws_upgrade(ws: WebSocketUpgrade, State(st): State<AppState>) -> impl IntoResponse {
    ws.on_upgrade(move |socket| ws_loop(socket, st))
}

/// Push the current snapshot immediately, then stream every update.
async fn ws_loop(mut socket: WebSocket, st: AppState) {
    let mut rx = st.gsi.tx.subscribe();

    // Clone out of the lock first: the guard must not live across an await.
    let initial = {
        let snap = st.gsi.snapshot.read().clone();
        serde_json::to_string(&snap).ok()
    };
    if let Some(initial) = initial {
        if socket.send(Message::Text(initial)).await.is_err() {
            return;
        }
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

/// Bind and serve. Returns the error if the port is already taken.
pub async fn serve(state: AppState, port: u16) -> anyhow::Result<()> {
    let addr = SocketAddr::from(([0, 0, 0, 0], port));
    let listener = tokio::net::TcpListener::bind(addr).await?;
    println!("[openhud] GSI + overlay server listening on http://{addr}");
    axum::serve(listener, router(state)).await?;
    Ok(())
}

/// Cheap probe: can this process currently bind `port`?
/// Used by the setup hook to walk to a free port instead of dying.
pub fn can_bind(port: u16) -> bool {
    std::net::TcpListener::bind(("0.0.0.0", port)).is_ok()
}
