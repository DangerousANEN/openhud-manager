// CS2 Game State Integration: ingest + normalize + fan-out
use parking_lot::RwLock;
use serde::{Deserialize, Serialize};
use serde_json::Value;
use std::sync::Arc;
use tokio::sync::broadcast;

#[derive(Clone, Debug, Serialize, Deserialize, Default)]
pub struct PlayerSnap {
    pub steamid: String,
    pub name: String,
    pub team: String,
    pub health: i64,
    pub armor: i64,
    pub money: i64,
    pub kills: i64,
    pub deaths: i64,
    pub assists: i64,
    pub adr: i64,
    pub observer_slot: i64,
    /// World position X (GSI "position": "x, y, z") — drives the radar.
    pub pos_x: f64,
    /// World position Y.
    pub pos_y: f64,
    /// Active weapon id, e.g. "ak47" (icon: assets/weapons/<id>.svg).
    pub weapon: String,
    pub ammo_clip: i64,
    pub ammo_reserve: i64,
}

#[derive(Clone, Debug, Serialize, Deserialize, Default)]
pub struct GsiSnapshot {
    pub map: String,
    pub phase: String,
    pub round: i64,
    pub ct_score: i64,
    pub t_score: i64,
    pub ct_name: String,
    pub t_name: String,
    pub bomb: String,
    pub round_time: String,
    /// SteamID of the currently spectated player (drives webcam framing).
    pub focused_steamid: String,
    pub players: Vec<PlayerSnap>,
    pub updated_at: String,
}

pub struct GsiState {
    pub raw: RwLock<Option<Value>>,
    pub snapshot: RwLock<GsiSnapshot>,
    pub last_seen: RwLock<Option<i64>>,
    pub token: RwLock<String>,
    pub tx: broadcast::Sender<String>,
}

impl GsiState {
    pub fn new(token: String) -> Arc<Self> {
        let (tx, _rx) = broadcast::channel::<String>(128);
        Arc::new(Self {
            raw: RwLock::new(None),
            snapshot: RwLock::new(GsiSnapshot::default()),
            last_seen: RwLock::new(None),
            token: RwLock::new(token),
            tx,
        })
    }

    /// Accept a raw GSI POST body from CS2.
    pub fn ingest(&self, payload: Value) {
        let snap = normalize(&payload);
        *self.snapshot.write() = snap.clone();
        *self.raw.write() = Some(payload.clone());
        *self.last_seen.write() = Some(chrono::Utc::now().timestamp());
        if let Ok(json) = serde_json::to_string(&snap) {
            let _ = self.tx.send(json);
        }
        // Forward the untouched GSI payload to a native cs-hud server (Eidetic
        // port) so its own HUD renders 1:1. Best-effort: never blocks ingest.
        tokio::spawn(async move {
            forward_to_eidetic(payload).await;
        });
    }

    /// Push an arbitrary control event to every overlay (veto, replay, sponsor...).
    pub fn broadcast_event(&self, kind: &str, data: Value) {
        let msg = serde_json::json!({ "type": kind, "data": data });
        if let Ok(json) = serde_json::to_string(&msg) {
            let _ = self.tx.send(json);
        }
    }

    pub fn connected(&self) -> bool {
        match *self.last_seen.read() {
            Some(t) => chrono::Utc::now().timestamp() - t < 10,
            None => false,
        }
    }

    pub fn seconds_since_update(&self) -> Option<i64> {
        self.last_seen
            .read()
            .map(|t| chrono::Utc::now().timestamp() - t)
    }
}

/// Forward the raw GSI payload to a locally running cs-hud server (Eidetic
/// port). It validates Valve's User-Agent and its own hardcoded auth token
/// (see its src/server/gsi.js), so we spoof both here.
async fn forward_to_eidetic(payload: Value) {
    use std::time::Duration;
    const EIDETIC_TOKEN: &str = "7ATvXUzTfBYyMLrA";

    let mut p = payload;
    // cs-hud's parser expects these keys to always exist (it does
    // Object.entries on them without a guard).
    if let Some(obj) = p.as_object_mut() {
        obj.entry("grenades".to_string())
            .or_insert(Value::Object(Default::default()));
        obj.entry("bomb".to_string())
            .or_insert(Value::Object(Default::default()));
    }
    match p.get_mut("auth").and_then(|a| a.as_object_mut()) {
        Some(auth) => {
            auth.insert("token".into(), Value::String(EIDETIC_TOKEN.into()));
        }
        None => {
            if let Some(obj) = p.as_object_mut() {
                obj.insert("auth".into(), serde_json::json!({ "token": EIDETIC_TOKEN }));
            }
        }
    }

    let client = match reqwest::Client::builder()
        .timeout(Duration::from_secs(2))
        .build()
    {
        Ok(c) => c,
        Err(_) => return,
    };
    let _ = client
        .post("http://127.0.0.1:31982/gsi")
        .header("User-Agent", "Valve/Steam HTTP Client 1.0")
        .json(&p)
        .send()
        .await;
}

fn s(v: &Value, path: &[&str]) -> String {
    let mut cur = v;
    for k in path {
        match cur.get(*k) {
            Some(next) => cur = next,
            None => return String::new(),
        }
    }
    match cur {
        Value::String(x) => x.clone(),
        Value::Number(n) => n.to_string(),
        _ => String::new(),
    }
}

fn i(v: &Value, path: &[&str]) -> i64 {
    let mut cur = v;
    for k in path {
        match cur.get(*k) {
            Some(next) => cur = next,
            None => return 0,
        }
    }
    cur.as_i64().unwrap_or(0)
}

fn f(v: &Value, path: &[&str]) -> f64 {
    // Positions arrive as "x, y, z" under player.position; path selects the axis.
    if path == ["position", "x"] || path == ["position", "y"] {
        let raw = s(v, &["position"]);
        let axis = if path[1] == "x" { 0 } else { 1 };
        return raw
            .split(',')
            .nth(axis)
            .and_then(|n| n.trim().parse::<f64>().ok())
            .unwrap_or(0.0);
    }
    let mut cur = v;
    for k in path {
        match cur.get(*k) {
            Some(next) => cur = next,
            None => return 0.0,
        }
    }
    cur.as_f64().unwrap_or(0.0)
}

/// Map GSI weapon name to our icon id (assets/weapons/<id>.svg).
fn weapon_id(p: &Value) -> String {
    let raw = s(p, &["weapons", "active", "name"]);
    let id = raw.rsplit('_').next().unwrap_or("").to_lowercase();
    match id.as_str() {
        "deagle" => "deserteagle".into(),
        "c4" => "".into(), // bomb is drawn by the bomb layer
        "flashbang" | "he" | "smoke" | "molotov" | "incendiary" | "decoy" => id.clone(),
        "" => "".into(),
        _ => id,
    }
}

/// Flatten the CS2 GSI payload into a stable shape the overlays consume.
fn normalize(v: &Value) -> GsiSnapshot {
    let mut players: Vec<PlayerSnap> = Vec::new();

    if let Some(map) = v.get("allplayers").and_then(|p| p.as_object()) {
        for (steamid, p) in map {
            players.push(PlayerSnap {
                steamid: steamid.clone(),
                name: s(p, &["name"]),
                team: s(p, &["team"]),
                health: i(p, &["state", "health"]),
                armor: i(p, &["state", "armor"]),
                money: i(p, &["state", "money"]),
                kills: i(p, &["match_stats", "kills"]),
                deaths: i(p, &["match_stats", "deaths"]),
                assists: i(p, &["match_stats", "assists"]),
                adr: i(p, &["state", "round_totaldmg"]),
                observer_slot: i(p, &["observer_slot"]),
                pos_x: f(p, &["position", "x"]),
                pos_y: f(p, &["position", "y"]),
                weapon: weapon_id(p),
                ammo_clip: i(p, &["weapons", "active", "ammo_clip"]),
                ammo_reserve: i(p, &["weapons", "active", "ammo_reserve"]),
            });
        }
        players.sort_by_key(|p| (p.team.clone(), p.observer_slot));
    }

    GsiSnapshot {
        map: s(v, &["map", "name"]),
        phase: s(v, &["round", "phase"]),
        round: i(v, &["map", "round"]),
        ct_score: i(v, &["map", "team_ct", "score"]),
        t_score: i(v, &["map", "team_t", "score"]),
        ct_name: s(v, &["map", "team_ct", "name"]),
        t_name: s(v, &["map", "team_t", "name"]),
        bomb: s(v, &["round", "bomb"]),
        round_time: s(v, &["phase_countdowns", "phase_ends_in"]),
        focused_steamid: {
            let sid = s(v, &["player", "steamid"]);
            if sid.is_empty() { s(v, &["player", "getSteamID"]) } else { sid }
        },
        players,
        updated_at: chrono::Utc::now().to_rfc3339(),
    }
}
