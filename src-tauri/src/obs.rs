// obs-websocket v5 client for OBS Studio.
//
// Protocol notes (obs-websocket 5.x):
//   - Server sends Hello (op 0) with optional `authentication` {challenge, salt}.
//   - Client replies Identify (op 1) with rpcVersion and, if required,
//     auth = base64(sha256( base64(sha256(password + salt)) + challenge )).
//   - Server confirms with Identified (op 2).
//   - Requests are op 6 {requestType, requestId, requestData},
//     responses op 7 {requestType, requestId, requestStatus, responseData}.
//
// Each command opens a short-lived connection: OBS control actions are rare
// (scene switches between rounds), so a persistent socket would add reconnect
// bookkeeping for no real gain.

use crate::db;
use base64::{engine::general_purpose::STANDARD as B64, Engine as _};
use futures_util::{SinkExt, StreamExt};
use serde::{Deserialize, Serialize};
use serde_json::{json, Value};
use sha2::{Digest, Sha256};
use std::time::Duration;
use tokio::net::TcpStream;
use tokio::time::timeout;
use tokio_tungstenite::tungstenite::Message;
use tokio_tungstenite::{connect_async, MaybeTlsStream, WebSocketStream};

const CONNECT_TIMEOUT: Duration = Duration::from_secs(5);
const REQUEST_TIMEOUT: Duration = Duration::from_secs(8);

type Socket = WebSocketStream<MaybeTlsStream<TcpStream>>;

#[derive(Debug, Serialize, Deserialize)]
pub struct ObsScene {
    pub name: String,
    pub index: i64,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct ObsStatus {
    pub connected: bool,
    pub obs_version: Option<String>,
    pub websocket_version: Option<String>,
    pub current_scene: Option<String>,
    pub streaming: bool,
    pub recording: bool,
    pub message: String,
}

/// Config read from the settings table (filled in by the Config page).
struct ObsConfig {
    host: String,
    port: u16,
    password: String,
}

fn load_config() -> Result<ObsConfig, String> {
    let host = db::get_setting("obs_host")
        .map_err(|e| e.to_string())?
        .filter(|s| !s.trim().is_empty())
        .unwrap_or_else(|| "localhost".to_string());

    let port = db::get_setting("obs_port")
        .map_err(|e| e.to_string())?
        .and_then(|s| s.trim().parse::<u16>().ok())
        .unwrap_or(4455);

    let password = db::get_setting("obs_password")
        .map_err(|e| e.to_string())?
        .unwrap_or_default();

    Ok(ObsConfig {
        host,
        port,
        password,
    })
}

/// base64(sha256( base64(sha256(password + salt)) + challenge ))
fn build_auth(password: &str, salt: &str, challenge: &str) -> String {
    let mut h = Sha256::new();
    h.update(password.as_bytes());
    h.update(salt.as_bytes());
    let secret = B64.encode(h.finalize());

    let mut h2 = Sha256::new();
    h2.update(secret.as_bytes());
    h2.update(challenge.as_bytes());
    B64.encode(h2.finalize())
}

async fn next_json(sock: &mut Socket) -> Result<Value, String> {
    loop {
        let msg = match timeout(REQUEST_TIMEOUT, sock.next()).await {
            Ok(Some(Ok(m))) => m,
            Ok(Some(Err(e))) => return Err(format!("Ошибка WebSocket: {e}")),
            Ok(None) => return Err("OBS закрыл соединение".to_string()),
            Err(_) => return Err("Таймаут ожидания ответа от OBS".to_string()),
        };
        match msg {
            Message::Text(t) => {
                return serde_json::from_str(&t)
                    .map_err(|e| format!("OBS вернул некорректный JSON: {e}"))
            }
            Message::Binary(_) | Message::Ping(_) | Message::Pong(_) | Message::Frame(_) => {
                continue
            }
            Message::Close(_) => return Err("OBS закрыл соединение".to_string()),
        }
    }
}

/// Connect + perform the Hello/Identify handshake.
async fn connect() -> Result<Socket, String> {
    let cfg = load_config()?;
    let url = format!("ws://{}:{}", cfg.host, cfg.port);

    let mut sock = match timeout(CONNECT_TIMEOUT, connect_async(&url)).await {
        Ok(Ok((s, _resp))) => s,
        Ok(Err(e)) => {
            return Err(format!(
                "Не удалось подключиться к OBS на {}:{} — {e}. Проверь, что OBS запущен и \
                 включён WebSocket-сервер (Инструменты → WebSocket Server Settings).",
                cfg.host, cfg.port
            ))
        }
        Err(_) => {
            return Err(format!(
                "Таймаут подключения к OBS на {}:{}",
                cfg.host, cfg.port
            ))
        }
    };

    // op 0 — Hello
    let hello = next_json(&mut sock).await?;
    if hello.get("op").and_then(Value::as_i64) != Some(0) {
        return Err("OBS не прислал Hello — неожиданный ответ сервера".to_string());
    }

    let rpc_version = hello
        .pointer("/d/rpcVersion")
        .and_then(Value::as_i64)
        .unwrap_or(1);

    let mut identify = json!({
        "op": 1,
        "d": { "rpcVersion": rpc_version }
    });

    // Authentication block is present only when OBS has a password set.
    if let Some(auth) = hello.pointer("/d/authentication") {
        let challenge = auth
            .get("challenge")
            .and_then(Value::as_str)
            .ok_or("OBS не прислал challenge для авторизации")?;
        let salt = auth
            .get("salt")
            .and_then(Value::as_str)
            .ok_or("OBS не прислал salt для авторизации")?;

        if cfg.password.is_empty() {
            return Err(
                "OBS требует пароль WebSocket, а в настройках приложения он пустой. \
                 Задай его на странице «Настройки»."
                    .to_string(),
            );
        }
        identify["d"]["authentication"] = json!(build_auth(&cfg.password, salt, challenge));
    }

    sock.send(Message::Text(identify.to_string().into()))
        .await
        .map_err(|e| format!("Не удалось отправить Identify: {e}"))?;

    // op 2 — Identified
    let identified = next_json(&mut sock).await?;
    match identified.get("op").and_then(Value::as_i64) {
        Some(2) => Ok(sock),
        _ => Err(
            "OBS отклонил авторизацию. Скорее всего, неверный пароль WebSocket в настройках."
                .to_string(),
        ),
    }
}

/// Send one request (op 6) and wait for its matching response (op 7).
async fn request(
    sock: &mut Socket,
    request_type: &str,
    data: Value,
) -> Result<Value, String> {
    let request_id = uuid::Uuid::new_v4().to_string();
    let payload = json!({
        "op": 6,
        "d": {
            "requestType": request_type,
            "requestId": request_id,
            "requestData": data,
        }
    });

    sock.send(Message::Text(payload.to_string().into()))
        .await
        .map_err(|e| format!("Не удалось отправить запрос {request_type}: {e}"))?;

    // Events (op 5) may arrive interleaved — skip until our requestId shows up.
    loop {
        let msg = next_json(sock).await?;
        if msg.get("op").and_then(Value::as_i64) != Some(7) {
            continue;
        }
        if msg.pointer("/d/requestId").and_then(Value::as_str) != Some(request_id.as_str()) {
            continue;
        }

        let ok = msg
            .pointer("/d/requestStatus/result")
            .and_then(Value::as_bool)
            .unwrap_or(false);

        if !ok {
            let comment = msg
                .pointer("/d/requestStatus/comment")
                .and_then(Value::as_str)
                .unwrap_or("без пояснения");
            return Err(format!("OBS отклонил {request_type}: {comment}"));
        }

        return Ok(msg
            .pointer("/d/responseData")
            .cloned()
            .unwrap_or(Value::Null));
    }
}

// ---------- Tauri commands ----------

/// Probe OBS: version, current scene, stream/record state.
#[tauri::command]
pub async fn obs_status() -> Result<ObsStatus, String> {
    let mut sock = match connect().await {
        Ok(s) => s,
        Err(e) => {
            return Ok(ObsStatus {
                connected: false,
                obs_version: None,
                websocket_version: None,
                current_scene: None,
                streaming: false,
                recording: false,
                message: e,
            })
        }
    };

    let version = request(&mut sock, "GetVersion", json!({})).await?;
    let scene = request(&mut sock, "GetCurrentProgramScene", json!({}))
        .await
        .ok();
    let stream_status = request(&mut sock, "GetStreamStatus", json!({})).await.ok();
    let record_status = request(&mut sock, "GetRecordStatus", json!({})).await.ok();

    let _ = sock.close(None).await;

    Ok(ObsStatus {
        connected: true,
        obs_version: version
            .get("obsVersion")
            .and_then(Value::as_str)
            .map(str::to_string),
        websocket_version: version
            .get("obsWebSocketVersion")
            .and_then(Value::as_str)
            .map(str::to_string),
        current_scene: scene
            .as_ref()
            .and_then(|s| {
                s.get("currentProgramSceneName")
                    .or_else(|| s.get("sceneName"))
            })
            .and_then(Value::as_str)
            .map(str::to_string),
        streaming: stream_status
            .as_ref()
            .and_then(|s| s.get("outputActive"))
            .and_then(Value::as_bool)
            .unwrap_or(false),
        recording: record_status
            .as_ref()
            .and_then(|s| s.get("outputActive"))
            .and_then(Value::as_bool)
            .unwrap_or(false),
        message: "Подключено".to_string(),
    })
}

/// List scenes in the current OBS collection, ordered as OBS reports them.
#[tauri::command]
pub async fn obs_scenes() -> Result<Vec<ObsScene>, String> {
    let mut sock = connect().await?;
    let data = request(&mut sock, "GetSceneList", json!({})).await?;
    let _ = sock.close(None).await;

    let mut out: Vec<ObsScene> = data
        .get("scenes")
        .and_then(Value::as_array)
        .map(|arr| {
            arr.iter()
                .filter_map(|s| {
                    Some(ObsScene {
                        name: s.get("sceneName").and_then(Value::as_str)?.to_string(),
                        index: s.get("sceneIndex").and_then(Value::as_i64).unwrap_or(0),
                    })
                })
                .collect()
        })
        .unwrap_or_default();

    // OBS returns scenes bottom-up; present them top-down like the OBS UI.
    out.sort_by_key(|s| -s.index);
    Ok(out)
}

/// Switch the program scene.
#[tauri::command]
pub async fn obs_set_scene(scene_name: String) -> Result<String, String> {
    let mut sock = connect().await?;
    request(
        &mut sock,
        "SetCurrentProgramScene",
        json!({ "sceneName": scene_name }),
    )
    .await?;
    let _ = sock.close(None).await;
    Ok(format!("Сцена переключена на «{scene_name}»"))
}

/// Toggle streaming; returns the new state.
#[tauri::command]
pub async fn obs_toggle_stream() -> Result<bool, String> {
    let mut sock = connect().await?;
    let data = request(&mut sock, "ToggleStream", json!({})).await?;
    let _ = sock.close(None).await;
    Ok(data
        .get("outputActive")
        .and_then(Value::as_bool)
        .unwrap_or(false))
}

/// Toggle recording; returns the new state.
#[tauri::command]
pub async fn obs_toggle_record() -> Result<bool, String> {
    let mut sock = connect().await?;
    let data = request(&mut sock, "ToggleRecord", json!({})).await?;
    let _ = sock.close(None).await;
    Ok(data
        .get("outputActive")
        .and_then(Value::as_bool)
        .unwrap_or(false))
}

/// Trigger the replay buffer save (instant replay). Requires the buffer to be
/// enabled and running in OBS.
#[tauri::command]
pub async fn obs_save_replay() -> Result<String, String> {
    let mut sock = connect().await?;
    let active = request(&mut sock, "GetReplayBufferStatus", json!({}))
        .await
        .ok()
        .and_then(|d| d.get("outputActive").and_then(Value::as_bool))
        .unwrap_or(false);

    if !active {
        let _ = sock.close(None).await;
        return Err(
            "Буфер повторов в OBS не запущен. Включи его: Настройки → Вывод → Буфер повторов, \
             затем «Запустить буфер повторов»."
                .to_string(),
        );
    }

    request(&mut sock, "SaveReplayBuffer", json!({})).await?;
    let _ = sock.close(None).await;
    Ok("Повтор сохранён".to_string())
}

/// Set the visibility of a source inside a scene (used for lower thirds).
#[tauri::command]
pub async fn obs_set_source_visible(
    scene_name: String,
    source_name: String,
    visible: bool,
) -> Result<String, String> {
    let mut sock = connect().await?;

    let items = request(
        &mut sock,
        "GetSceneItemList",
        json!({ "sceneName": scene_name }),
    )
    .await?;

    let item_id = items
        .get("sceneItems")
        .and_then(Value::as_array)
        .and_then(|arr| {
            arr.iter().find_map(|it| {
                if it.get("sourceName").and_then(Value::as_str) == Some(source_name.as_str()) {
                    it.get("sceneItemId").and_then(Value::as_i64)
                } else {
                    None
                }
            })
        })
        .ok_or_else(|| format!("Источник «{source_name}» не найден в сцене «{scene_name}»"))?;

    request(
        &mut sock,
        "SetSceneItemEnabled",
        json!({
            "sceneName": scene_name,
            "sceneItemId": item_id,
            "sceneItemEnabled": visible,
        }),
    )
    .await?;
    let _ = sock.close(None).await;

    Ok(format!(
        "Источник «{source_name}» {}",
        if visible { "показан" } else { "скрыт" }
    ))
}

// ─── Unit tests ──────────────────────────────────────────────────────────────

#[cfg(test)]
mod tests {
    use super::build_auth;

    // Expected values computed independently with Python hashlib:
    //   b64(sha256(b64(sha256(password + salt)) + challenge))
    #[test]
    fn build_auth_matches_reference_vector() {
        let got = build_auth("supersecretpassword", "PZVbYpvI3isKgYZ+2gs=", "ztTBnnuqrqaKDzRM3xcVdg==");
        assert_eq!(got, "Nair1lsshVv7LG9Yuq35RD1E/wcjBcj2F4s6ZTHJE00=");
    }

    #[test]
    fn build_auth_empty_password_vector() {
        let got = build_auth("", "salt", "challenge");
        assert_eq!(got, "5fmcrqR0I7snYOpUX/Ac22UdSA81TwCyHqCr6eFQyyI=");
    }

    #[test]
    fn build_auth_simple_vector() {
        let got = build_auth("password", "salt", "challenge");
        assert_eq!(got, "zTM5ki6L2vVvBQiTG9ckH1Lh64AbnCf6XZ226UmnkIA=");
    }

    #[test]
    fn build_auth_is_deterministic() {
        let a = build_auth("pw", "s", "c");
        let b = build_auth("pw", "s", "c");
        assert_eq!(a, b);
    }

    #[test]
    fn build_auth_salt_changes_result() {
        assert_ne!(build_auth("pw", "s1", "c"), build_auth("pw", "s2", "c"));
    }

    #[test]
    fn build_auth_challenge_changes_result() {
        assert_ne!(build_auth("pw", "s", "c1"), build_auth("pw", "s", "c2"));
    }

    #[test]
    fn build_auth_output_is_base64_sha256_length() {
        // 32 raw bytes → 44 chars of standard base64 with padding.
        assert_eq!(build_auth("pw", "s", "c").len(), 44);
    }
}
