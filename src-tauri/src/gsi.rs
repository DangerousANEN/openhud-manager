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
        *self.raw.write() = Some(payload);
        *self.last_seen.write() = Some(chrono::Utc::now().timestamp());
        if let Ok(json) = serde_json::to_string(&snap) {
            let _ = self.tx.send(json);
        }
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
        focused_steamid: s(v, &["player", "getSteamID"]),
        players,
        updated_at: chrono::Utc::now().to_rfc3339(),
    }
}
