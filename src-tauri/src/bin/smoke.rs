// Standalone harness: runs the real Axum router (GSI ingest + WS + overlays)
// so the whole pipeline can be exercised without launching the Tauri shell.
use openhud_lib::gsi::GsiState;
use openhud_lib::server::{self, AppState};

#[tokio::main]
async fn main() -> anyhow::Result<()> {
    let port: u16 = std::env::args()
        .nth(1)
        .and_then(|p| p.parse().ok())
        .unwrap_or(13490);

    let gsi = GsiState::new("smoke-token".into());
    let state = AppState { gsi };
    server::serve(state, port).await?;
    Ok(())
}
