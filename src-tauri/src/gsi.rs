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
    #[serde(default)]
    pub round_damage: i64,
    pub observer_slot: i64,
    /// World position X (GSI "position": "x, y, z") — drives the radar.
    pub pos_x: f64,
    /// World position Y.
    pub pos_y: f64,
    /// Active weapon id, e.g. "ak47" (icon: assets/weapons/<id>.svg).
    pub weapon: String,
    /// Holstered pistol id — the original fennec card shows it on row 2.
    #[serde(default)]
    pub secondary: String,
    pub ammo_clip: i64,
    pub ammo_reserve: i64,
    /// Kevlar+helmet vs kevlar only — picks the armor icon.
    #[serde(default)]
    pub helmet: bool,
    /// CT defuse kit — shown next to armor in the roster row.
    #[serde(default)]
    pub defusekit: bool,
    /// Carried grenade icon ids, one entry per grenade held.
    #[serde(default)]
    pub grenades: Vec<String>,
    /// True when this player is carrying the C4.
    #[serde(default)]
    pub has_bomb: bool,
    /// Value of everything the player is holding (for the team equipment bar).
    #[serde(default)]
    pub equip_value: i64,
    pub round_kills: i64,
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
    /// Bomb state from top-level `bomb.state` or fallback `round.bomb`.
    #[serde(default)]
    pub bomb_state: String,
    /// Bomb world coordinates from top-level `bomb.position`.
    #[serde(default)]
    pub bomb_x: f64,
    #[serde(default)]
    pub bomb_y: f64,
    /// Bomb countdown remaining (seconds) when planted.
    #[serde(default)]
    pub bomb_countdown: String,
    /// Phase countdown phase name (e.g. "live", "freezetime", "bomb").
    #[serde(default)]
    pub phase_countdown_phase: String,
    /// Team that won the round (if present under round or map).
    #[serde(default)]
    pub win_team: String,
    /// Consecutive round losses per side — drives the Loss Bonus pips.
    #[serde(default)]
    pub ct_loss_streak: i64,
    #[serde(default)]
    pub t_loss_streak: i64,
    /// Tactical timeouts remaining per side (from map.team_ct.timeouts_remaining).
    #[serde(default)]
    pub ct_timeouts_remaining: i64,
    #[serde(default)]
    pub t_timeouts_remaining: i64,
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
        let prev_map = self.snapshot.read().map.clone();
        let new_map = s(&payload, &["map", "name"]);
        let map_changed = !new_map.is_empty() && !prev_map.is_empty() && new_map != prev_map;

        let accumulated = {
            let mut raw_lock = self.raw.write();
            let mut current = if map_changed {
                serde_json::json!({})
            } else {
                raw_lock.take().unwrap_or_else(|| serde_json::json!({}))
            };

            if let (Value::Object(target), Value::Object(patch)) = (&mut current, &payload) {
                for (k, v) in patch {
                    if k == "allplayers" {
                        if let Some(m) = v.as_object() {
                            if !m.is_empty() {
                                target.insert(k.clone(), v.clone());
                            }
                        }
                    } else if let (Some(Value::Object(target_sub)), Value::Object(patch_sub)) = (target.get_mut(k), v) {
                        for (sub_k, sub_v) in patch_sub {
                            target_sub.insert(sub_k.clone(), sub_v.clone());
                        }
                    } else {
                        target.insert(k.clone(), v.clone());
                    }
                }
            } else {
                current = payload.clone();
            }

            *raw_lock = Some(current.clone());
            current
        };

        let snap = normalize(&accumulated);
        *self.snapshot.write() = snap.clone();
        *self.last_seen.write() = Some(chrono::Utc::now().timestamp());

        // Universal multiplexed broadcast payload:
        // Supports cs-hud / EHM (event: "state", body: { gsiState }),
        // native OpenHUD overlays (map, players, ct_score...), and raw GSI.
        let active = crate::server::active_hud_dir();
        let radars: Value = std::fs::read_to_string(active.join("radars.json"))
            .ok()
            .and_then(|s| serde_json::from_str(&s).ok())
            .unwrap_or_else(|| serde_json::json!({}));
        let bombsites: Value = std::fs::read_to_string(active.join("bombsites.json"))
            .ok()
            .and_then(|s| serde_json::from_str(&s).ok())
            .unwrap_or_else(|| serde_json::json!({}));

        let current_match = crate::db::current_match().ok().flatten();
        let (match_type, series_left_score, series_right_score, tournament_name, map_pick_tag, left_team_name, right_team_name) = match current_match {
            Some(m) => {
                let t_name = crate::db::list_tournaments()
                    .ok()
                    .and_then(|tours| tours.into_iter().next().map(|t| t.name))
                    .unwrap_or_default();

                let all_teams = crate::db::list_teams().unwrap_or_default();
                let left_t = m.left_team_id.as_ref().and_then(|id| all_teams.iter().find(|t| &t.id == id));
                let right_t = m.right_team_id.as_ref().and_then(|id| all_teams.iter().find(|t| &t.id == id));
                let left_name = left_t.map(|t| t.name.clone()).unwrap_or_default();
                let right_name = right_t.map(|t| t.name.clone()).unwrap_or_default();

                // Compute map pick / decider status from vetos JSON or map count
                let mut pick_tag = String::new();
                let current_map_clean = snap.map.trim_start_matches("de_").to_lowercase();
                if let Ok(vetos_val) = serde_json::from_str::<Value>(&m.vetos) {
                    if let Some(arr) = vetos_val.as_array() {
                        for item in arr {
                            let map_name = item.get("map").and_then(Value::as_str).unwrap_or("").to_lowercase();
                            let action = item.get("action").and_then(Value::as_str).unwrap_or("").to_lowercase();
                            let team_key = item.get("team_id")
                                .or_else(|| item.get("team"))
                                .and_then(Value::as_str)
                                .unwrap_or("");

                            if map_name == current_map_clean || map_name == snap.map.to_lowercase() {
                                if action == "pick" {
                                    let team_label = if !team_key.is_empty() {
                                        if left_t.as_ref().map(|t| t.id == team_key || t.name == team_key || t.short_name == team_key).unwrap_or(false) {
                                            left_t.as_ref().map(|t| if !t.short_name.is_empty() { t.short_name.clone() } else { t.name.clone() }).unwrap_or_else(|| left_name.clone())
                                        } else if right_t.as_ref().map(|t| t.id == team_key || t.name == team_key || t.short_name == team_key).unwrap_or(false) {
                                            right_t.as_ref().map(|t| if !t.short_name.is_empty() { t.short_name.clone() } else { t.name.clone() }).unwrap_or_else(|| right_name.clone())
                                        } else {
                                            team_key.to_string()
                                        }
                                    } else {
                                        String::new()
                                    };
                                    pick_tag = if !team_label.is_empty() {
                                        format!("{team_label} PICK")
                                    } else {
                                        "PICK".to_string()
                                    };
                                } else if action == "decider" {
                                    pick_tag = "DECIDER".to_string();
                                }
                                break;
                            }
                        }
                    }
                }
                if pick_tag.is_empty() {
                    let total_played = m.left_score + m.right_score;
                    if (m.match_type == "bo3" && total_played >= 2) || (m.match_type == "bo5" && total_played >= 4) {
                        pick_tag = "DECIDER".to_string();
                    }
                }

                (m.match_type, m.left_score, m.right_score, t_name, pick_tag, left_name, right_name)
            }
            None => ("bo3".to_string(), 0, 0, String::new(), String::new(), String::new(), String::new()),
        };

        let universal = serde_json::json!({
            "event": "state",
            "body": {
                "gsiState": payload,
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
            "bomb_state": snap.bomb_state,
            "bomb_countdown": snap.bomb_countdown,
            "phase_countdown_phase": snap.phase_countdown_phase,
            "round_time": snap.round_time,
            "ct_loss_streak": snap.ct_loss_streak,
            "t_loss_streak": snap.t_loss_streak,
            "ct_timeouts_remaining": snap.ct_timeouts_remaining,
            "t_timeouts_remaining": snap.t_timeouts_remaining,
            "series_match_type": match_type,
            "series_left_score": series_left_score,
            "series_right_score": series_right_score,
            "tournament_name": tournament_name,
            "map_pick_tag": map_pick_tag,
            "match_left_name": left_team_name,
            "match_right_name": right_team_name,
            "focused_steamid": snap.focused_steamid,
            "players": snap.players,
            "updated_at": snap.updated_at
        });

        if let Ok(json) = serde_json::to_string(&universal) {
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

/// Locate the player's ACTIVE weapon slot.
///
/// Real CS2 GSI sends `weapons: { weapon_0: {...}, weapon_1: {..., state:"active"} }`
/// — there is NO `weapons.active` key. Reading `weapons.active` silently yields an
/// empty weapon and 0/0 ammo for every player, which blanks the weapon icons and
/// the focused-player ammo slab. Fall back to `weapons.active` only for legacy
/// bridge payloads that pre-flatten it.
fn active_weapon(p: &Value) -> Option<&Value> {
    if let Some(slots) = p.get("weapons").and_then(|w| w.as_object()) {
        // prefer the slot explicitly marked active
        for (_k, w) in slots {
            if w.get("state").and_then(|s| s.as_str()) == Some("active") {
                return Some(w);
            }
        }
        // otherwise fall back to the best non-knife/non-grenade slot
        let mut fallback: Option<&Value> = None;
        for (_k, w) in slots {
            let ty = w.get("type").and_then(|t| t.as_str()).unwrap_or("");
            if ty != "Knife" && ty != "Grenade" && ty != "C4" {
                fallback = Some(w);
            }
        }
        if fallback.is_some() {
            return fallback;
        }
    }
    p.get("weapons").and_then(|w| w.get("active"))
}

/// Grenades the player is carrying, as icon ids (e.g. ["flashbang","smokegrenade"]).
fn grenade_ids(p: &Value) -> Vec<String> {
    let mut out = Vec::new();
    if let Some(slots) = p.get("weapons").and_then(|w| w.as_object()) {
        for (_k, w) in slots {
            if w.get("type").and_then(|t| t.as_str()) == Some("Grenade") {
                let raw = w.get("name").and_then(|n| n.as_str()).unwrap_or("");
                let id = raw.trim_start_matches("weapon_").to_lowercase();
                if !id.is_empty() {
                    let count = w.get("ammo_reserve").and_then(|a| a.as_i64()).unwrap_or(1);
                    for _ in 0..count.max(1) {
                        out.push(id.clone());
                    }
                }
            }
        }
    }
    out.sort();
    out
}

/// Map GSI weapon name to our icon id (assets/weapons/<id>.svg).
fn weapon_id(p: &Value) -> String {
    let raw = active_weapon(p)
        .and_then(|w| w.get("name"))
        .and_then(|n| n.as_str())
        .unwrap_or("")
        .to_string();
    // icon files are named after the full GSI id minus the `weapon_` prefix
    let id = raw.trim_start_matches("weapon_").to_lowercase();
    match id.as_str() {
        "c4" => "".into(), // bomb is drawn by the bomb layer
        "" => "".into(),
        _ => id,
    }
}

/// Top-level `bomb.state` wins; legacy `round.bomb` is the fallback.
fn bomb_state_raw(v: &Value) -> String {
    let top = s(v, &["bomb", "state"]);
    if top.is_empty() { s(v, &["round", "bomb"]) } else { top }
}

/// `bomb.position` is an "x, y, z" string — same format as player positions.
/// Returns (x, y); (0, 0) when absent (callers treat 0,0 as "no data").
fn bomb_position(v: &Value) -> (f64, f64) {
    let raw = s(v, &["bomb", "position"]);
    let mut it = raw.split(',');
    let x = it.next().and_then(|n| n.trim().parse::<f64>().ok()).unwrap_or(0.0);
    let y = it.next().and_then(|n| n.trim().parse::<f64>().ok()).unwrap_or(0.0);
    (x, y)
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
                /* ADR = total damage / rounds played. GSI only exposes damage
                   for the CURRENT round (`round_totaldmg`), so a true ADR needs
                   accumulation across rounds; until that exists, report the
                   round damage this snapshot actually carries. */
                adr: i(p, &["state", "round_totaldmg"]),
                round_damage: i(p, &["state", "round_totaldmg"]),
                observer_slot: i(p, &["observer_slot"]),
                pos_x: f(p, &["position", "x"]),
                pos_y: f(p, &["position", "y"]),
                weapon: weapon_id(p),
                secondary: p
                    .get("weapons")
                    .and_then(|w| w.as_object())
                    .and_then(|slots| {
                        slots.values().find_map(|w| {
                            if w.get("type").and_then(|t| t.as_str()) == Some("Pistol") {
                                w.get("name")
                                    .and_then(|n| n.as_str())
                                    .map(|n| n.trim_start_matches("weapon_").to_lowercase())
                            } else {
                                None
                            }
                        })
                    })
                    .unwrap_or_default(),
                ammo_clip: active_weapon(p)
                    .and_then(|w| w.get("ammo_clip"))
                    .and_then(|a| a.as_i64())
                    .unwrap_or(0),
                ammo_reserve: active_weapon(p)
                    .and_then(|w| w.get("ammo_reserve"))
                    .and_then(|a| a.as_i64())
                    .unwrap_or(0),
                helmet: p
                    .get("state")
                    .and_then(|st| st.get("helmet"))
                    .and_then(|h| h.as_bool())
                    .unwrap_or(false),
                defusekit: p
                    .get("state")
                    .and_then(|st| st.get("defusekit"))
                    .and_then(|d| d.as_bool())
                    .unwrap_or(false),
                grenades: grenade_ids(p),
                has_bomb: p
                    .get("weapons")
                    .and_then(|w| w.as_object())
                    .map(|slots| {
                        slots.values().any(|w| {
                            w.get("name").and_then(|n| n.as_str()) == Some("weapon_c4")
                        })
                    })
                    .unwrap_or(false),
                equip_value: i(p, &["state", "equip_value"]),
                round_kills: i(p, &["state", "round_kills"]),
            });
        }
        players.sort_by_key(|p| (p.team.clone(), p.observer_slot));
    }

    GsiSnapshot {
        map: s(v, &["map", "name"]),
        phase: s(v, &["round", "phase"]),
        round: i(v, &["map", "round"]) + 1 - (s(v, &["phase_countdowns", "phase"]) == "over") as i64,
        ct_score: i(v, &["map", "team_ct", "score"]),
        t_score: i(v, &["map", "team_t", "score"]),
        ct_name: s(v, &["map", "team_ct", "name"]),
        ct_loss_streak: i(v, &["map", "team_ct", "consecutive_round_losses"]),
        t_loss_streak: i(v, &["map", "team_t", "consecutive_round_losses"]),
        ct_timeouts_remaining: i(v, &["map", "team_ct", "timeouts_remaining"]),
        t_timeouts_remaining: i(v, &["map", "team_t", "timeouts_remaining"]),
        t_name: s(v, &["map", "team_t", "name"]),
        bomb: s(v, &["round", "bomb"]),
        round_time: s(v, &["phase_countdowns", "phase_ends_in"]),
        bomb_state: bomb_state_raw(v),
        bomb_x: bomb_position(v).0,
        bomb_y: bomb_position(v).1,
        bomb_countdown: {
            let top = s(v, &["bomb", "countdown"]);
            if !top.is_empty() {
                top
            } else if s(v, &["phase_countdowns", "phase"]) == "bomb" {
                s(v, &["phase_countdowns", "phase_ends_in"])
            } else {
                String::new()
            }
        },
        phase_countdown_phase: s(v, &["phase_countdowns", "phase"]),
        win_team: s(v, &["round", "win_team"]),
        focused_steamid: {
            let sid = s(v, &["player", "steamid"]);
            if sid.is_empty() { s(v, &["player", "getSteamID"]) } else { sid }
        },
        players,
        updated_at: chrono::Utc::now().to_rfc3339(),
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use serde_json::json;

    fn base_payload() -> Value {
        json!({
            "map": {"name": "de_mirage", "round": 7,
                "team_ct": {"score": 5, "name": "ALPHA"}, "team_t": {"score": 3, "name": "BRAVO"}},
            "round": {"phase": "live"},
            "phase_countdowns": {"phase": "live", "phase_ends_in": "65.2"},
            "player": {"steamid": "111"},
            "allplayers": {
                "111": {"name": "p1", "team": "CT", "state": {"health": 100, "armor": 100},
                    "match_stats": {"kills": 3, "deaths": 1, "assists": 0},
                    "weapons": {"weapon_0": {"name": "weapon_ak47", "type": "Rifle",
                        "state": "active", "ammo_clip": 27, "ammo_reserve": 60}}},
                "222": {"name": "p2", "team": "T", "state": {"health": 0},
                    "match_stats": {"kills": 0, "deaths": 2, "assists": 0},
                    "weapons": {"weapon_0": {"name": "weapon_glock", "type": "Pistol",
                        "state": "active", "ammo_clip": 9, "ammo_reserve": 60}}}
            },
            "grenades": {}
        })
    }

    #[test]
    fn round_number_is_one_based_and_drops_back_after_round_end() {
        // During live play map.round is zero-based: round 1 → map.round 0.
        let mut v = base_payload();
        v["map"]["round"] = json!(0);
        v["phase_countdowns"]["phase"] = json!("live");
        assert_eq!(normalize(&v).round, 1);

        // During the phase-over delay CS2 has already bumped map.round
        // (cs-hud semantics: map.round + 1 - Number(phase === 'over')).
        v["map"]["round"] = json!(1);
        v["phase_countdowns"]["phase"] = json!("over");
        assert_eq!(normalize(&v).round, 1);

        v["map"]["round"] = json!(11);
        v["phase_countdowns"]["phase"] = json!("over");
        assert_eq!(normalize(&v).round, 11);
    }

    fn weapon_packet(name: &str, ty: &str, state: Option<&str>) -> Value {
        let mut w = json!({"name": name, "type": ty, "ammo_clip": 1, "ammo_reserve": 1});
        if let Some(st) = state { w["state"] = json!(st); }
        w
    }

    #[test]
    fn active_weapon_prefers_state_active_over_first_slot() {
        let p = json!({"weapons": {
            "weapon_0": weapon_packet("weapon_knife", "Knife", None),
            "weapon_1": weapon_packet("weapon_ak47", "Rifle", Some("active"))
        }});
        assert_eq!(weapon_id(&p), "ak47");
        // No explicit active slot → first non-knife/grenade/C4 slot wins.
        let p2 = json!({"weapons": {
            "weapon_0": weapon_packet("weapon_knife", "Knife", None),
            "weapon_1": weapon_packet("weapon_ak47", "Rifle", None)
        }});
        assert_eq!(weapon_id(&p2), "ak47");
    }

    #[test]
    fn bomb_fields_prefer_top_level_object_with_fallback() {
        // Modern payload: top-level bomb object with real position string.
        let mut v = base_payload();
        v["bomb"] = json!({"state": "planted", "position": "-1432.23, 321.94, 96",
            "countdown": "12.4"});
        let snap = normalize(&v);
        assert_eq!(snap.bomb_state, "planted");
        assert!((snap.bomb_x + 1432.23).abs() < 0.01);
        assert!((snap.bomb_y - 321.94).abs() < 0.01);
        assert_eq!(snap.bomb_countdown, "12.4");

        // Legacy payload: only round.bomb exists.
        let mut v2 = base_payload();
        v2.as_object_mut().unwrap().remove("bomb");
        v2["round"]["bomb"] = json!("planted");
        let snap2 = normalize(&v2);
        assert_eq!(snap2.bomb_state, "planted");
        assert_eq!(snap2.bomb_x, 0.0);
    }

    #[test]
    fn round_damage_and_adr_track_round_totaldmg_without_invention() {
        let mut v = base_payload();
        v["allplayers"]["111"]["state"]["round_totaldmg"] = json!(87);
        let snap = normalize(&v);
        let p1 = snap.players.iter().find(|p| p.steamid == "111").unwrap();
        assert_eq!(p1.adr, 87);
        assert_eq!(p1.round_damage, 87);
    }

    #[test]
    fn grenade_ids_expand_and_exclude_non_grenades() {
        let p = json!({"weapons": {
            "weapon_0": weapon_packet("weapon_flashbang", "Grenade", None),
            "weapon_1": weapon_packet("weapon_ak47", "Rifle", Some("active"))
        }});
        let ids = grenade_ids(&p);
        assert_eq!(ids, vec!["flashbang".to_string()]);
        // ammo_reserve repeats carryable grenades (flash x2).
        let mut p2 = weapon_packet("weapon_flashbang", "Grenade", None);
        p2["weapons"] = json!({"weapon_0": {"name": "weapon_flashbang", "type": "Grenade",
            "ammo_reserve": 2}});
        let ids2 = grenade_ids(&p2);
        assert_eq!(ids2.len(), 2);
    }

    #[test]
    fn team_timeouts_remaining_extracted_from_map() {
        let mut v = base_payload();
        v["map"]["team_ct"]["timeouts_remaining"] = json!(3);
        v["map"]["team_t"]["timeouts_remaining"] = json!(1);
        let snap = normalize(&v);
        assert_eq!(snap.ct_timeouts_remaining, 3);
        assert_eq!(snap.t_timeouts_remaining, 1);
    }
}
