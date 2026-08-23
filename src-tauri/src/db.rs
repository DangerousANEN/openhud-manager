// SQLite storage layer for OpenHUD Manager
use anyhow::Result;
use rusqlite::{params, Connection};
use serde::{Deserialize, Serialize};
use std::path::PathBuf;

pub fn db_path() -> PathBuf {
    let mut p = dirs::data_dir().unwrap_or_else(|| PathBuf::from("."));
    p.push("OpenHUD");
    std::fs::create_dir_all(&p).ok();
    p.push("openhud.db");
    p
}

pub fn open() -> Result<Connection> {
    let conn = Connection::open(db_path())?;
    conn.execute_batch(
        r#"
        PRAGMA journal_mode = WAL;

        CREATE TABLE IF NOT EXISTS teams (
            id          TEXT PRIMARY KEY,
            name        TEXT NOT NULL,
            short_name  TEXT NOT NULL DEFAULT '',
            country     TEXT NOT NULL DEFAULT '',
            logo        TEXT NOT NULL DEFAULT '',
            created_at  TEXT NOT NULL DEFAULT (datetime('now'))
        );

        CREATE TABLE IF NOT EXISTS players (
            id          TEXT PRIMARY KEY,
            steamid     TEXT NOT NULL DEFAULT '',
            nickname    TEXT NOT NULL,
            first_name  TEXT NOT NULL DEFAULT '',
            last_name   TEXT NOT NULL DEFAULT '',
            country     TEXT NOT NULL DEFAULT '',
            team_id     TEXT,
            avatar      TEXT NOT NULL DEFAULT '',
            created_at  TEXT NOT NULL DEFAULT (datetime('now'))
        );

        CREATE TABLE IF NOT EXISTS matches (
            id            TEXT PRIMARY KEY,
            left_team_id  TEXT,
            right_team_id TEXT,
            left_score    INTEGER NOT NULL DEFAULT 0,
            right_score   INTEGER NOT NULL DEFAULT 0,
            match_type    TEXT NOT NULL DEFAULT 'bo3',
            current       INTEGER NOT NULL DEFAULT 0,
            vetos         TEXT NOT NULL DEFAULT '[]',
            created_at    TEXT NOT NULL DEFAULT (datetime('now'))
        );

        CREATE TABLE IF NOT EXISTS tournaments (
            id          TEXT PRIMARY KEY,
            name        TEXT NOT NULL,
            logo        TEXT NOT NULL DEFAULT '',
            entry_fee   INTEGER NOT NULL DEFAULT 0,
            prize_pool  INTEGER NOT NULL DEFAULT 0,
            created_at  TEXT NOT NULL DEFAULT (datetime('now'))
        );

        CREATE TABLE IF NOT EXISTS sponsors (
            id          TEXT PRIMARY KEY,
            name        TEXT NOT NULL,
            image       TEXT NOT NULL DEFAULT '',
            url         TEXT NOT NULL DEFAULT '',
            weight      INTEGER NOT NULL DEFAULT 1,
            active      INTEGER NOT NULL DEFAULT 1
        );

        CREATE TABLE IF NOT EXISTS settings (
            key   TEXT PRIMARY KEY,
            value TEXT NOT NULL
        );

        CREATE TABLE IF NOT EXISTS servers (
            id            TEXT PRIMARY KEY,
            name          TEXT NOT NULL,
            host          TEXT NOT NULL DEFAULT '127.0.0.1',
            port          INTEGER NOT NULL DEFAULT 27015,
            rcon_password TEXT NOT NULL DEFAULT '',
            created_at    TEXT NOT NULL DEFAULT (datetime('now'))
        );

        CREATE TABLE IF NOT EXISTS hud_layouts (
            id          TEXT PRIMARY KEY,
            name        TEXT NOT NULL,
            data        TEXT NOT NULL,
            created_at  TEXT NOT NULL DEFAULT (datetime('now')),
            updated_at  TEXT NOT NULL DEFAULT (datetime('now'))
        );
        "#,
    )?;
    Ok(conn)
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct Team {
    #[serde(default)]
    pub id: String,
    pub name: String,
    #[serde(default)]
    pub short_name: String,
    #[serde(default)]
    pub country: String,
    #[serde(default)]
    pub logo: String,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct Player {
    #[serde(default)]
    pub id: String,
    #[serde(default)]
    pub steamid: String,
    pub nickname: String,
    #[serde(default)]
    pub first_name: String,
    #[serde(default)]
    pub last_name: String,
    #[serde(default)]
    pub country: String,
    #[serde(default)]
    pub team_id: Option<String>,
    #[serde(default)]
    pub avatar: String,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct Match {
    #[serde(default)]
    pub id: String,
    #[serde(default)]
    pub left_team_id: Option<String>,
    #[serde(default)]
    pub right_team_id: Option<String>,
    #[serde(default)]
    pub left_score: i64,
    #[serde(default)]
    pub right_score: i64,
    #[serde(default = "default_bo")]
    pub match_type: String,
    #[serde(default)]
    pub current: bool,
}

fn default_bo() -> String {
    "bo3".into()
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct Tournament {
    #[serde(default)]
    pub id: String,
    pub name: String,
    #[serde(default)]
    pub logo: String,
    #[serde(default)]
    pub entry_fee: i64,
    #[serde(default)]
    pub prize_pool: i64,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct Sponsor {
    #[serde(default)]
    pub id: String,
    pub name: String,
    #[serde(default)]
    pub image: String,
    #[serde(default)]
    pub url: String,
    #[serde(default = "one")]
    pub weight: i64,
    #[serde(default = "yes")]
    pub active: bool,
}

fn one() -> i64 {
    1
}
fn yes() -> bool {
    true
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct Server {
    #[serde(default)]
    pub id: String,
    pub name: String,
    #[serde(default = "default_server_host")]
    pub host: String,
    #[serde(default = "default_server_port")]
    pub port: i64,
    #[serde(default)]
    pub rcon_password: Option<String>,
    #[serde(default)]
    pub has_password: bool,
}

fn default_server_host() -> String {
    "127.0.0.1".into()
}

fn default_server_port() -> i64 {
    27015
}

#[allow(dead_code)]
pub struct ServerSecret {
    pub id: String,
    pub name: String,
    pub host: String,
    pub port: u16,
    pub rcon_password: String,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct HudLayout {
    #[serde(default)]
    pub id: String,
    pub name: String,
    pub data: String,
    #[serde(default)]
    pub created_at: Option<String>,
    #[serde(default)]
    pub updated_at: Option<String>,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct HudLayoutMeta {
    pub id: String,
    pub name: String,
    #[serde(default)]
    pub created_at: Option<String>,
    #[serde(default)]
    pub updated_at: Option<String>,
}

// ---------- Teams ----------
pub fn list_teams() -> Result<Vec<Team>> {
    let conn = open()?;
    let mut stmt =
        conn.prepare("SELECT id, name, short_name, country, logo FROM teams ORDER BY name")?;
    let rows = stmt
        .query_map([], |r| {
            Ok(Team {
                id: r.get(0)?,
                name: r.get(1)?,
                short_name: r.get(2)?,
                country: r.get(3)?,
                logo: r.get(4)?,
            })
        })?
        .collect::<Result<Vec<_>, _>>()?;
    Ok(rows)
}

pub fn save_team(mut t: Team) -> Result<Team> {
    let conn = open()?;
    if t.id.is_empty() {
        t.id = uuid::Uuid::new_v4().to_string();
    }
    conn.execute(
        "INSERT INTO teams (id, name, short_name, country, logo) VALUES (?1,?2,?3,?4,?5)
         ON CONFLICT(id) DO UPDATE SET name=?2, short_name=?3, country=?4, logo=?5",
        params![t.id, t.name, t.short_name, t.country, t.logo],
    )?;
    Ok(t)
}

pub fn delete_team(id: &str) -> Result<()> {
    open()?.execute("DELETE FROM teams WHERE id=?1", params![id])?;
    Ok(())
}

// ---------- Players ----------
pub fn list_players() -> Result<Vec<Player>> {
    let conn = open()?;
    let mut stmt = conn.prepare(
        "SELECT id, steamid, nickname, first_name, last_name, country, team_id, avatar
         FROM players ORDER BY nickname",
    )?;
    let rows = stmt
        .query_map([], |r| {
            Ok(Player {
                id: r.get(0)?,
                steamid: r.get(1)?,
                nickname: r.get(2)?,
                first_name: r.get(3)?,
                last_name: r.get(4)?,
                country: r.get(5)?,
                team_id: r.get(6)?,
                avatar: r.get(7)?,
            })
        })?
        .collect::<Result<Vec<_>, _>>()?;
    Ok(rows)
}

pub fn save_player(mut p: Player) -> Result<Player> {
    let conn = open()?;
    if p.id.is_empty() {
        p.id = uuid::Uuid::new_v4().to_string();
    }
    conn.execute(
        "INSERT INTO players (id, steamid, nickname, first_name, last_name, country, team_id, avatar)
         VALUES (?1,?2,?3,?4,?5,?6,?7,?8)
         ON CONFLICT(id) DO UPDATE SET steamid=?2, nickname=?3, first_name=?4,
           last_name=?5, country=?6, team_id=?7, avatar=?8",
        params![
            p.id, p.steamid, p.nickname, p.first_name, p.last_name, p.country, p.team_id, p.avatar
        ],
    )?;
    Ok(p)
}

pub fn delete_player(id: &str) -> Result<()> {
    open()?.execute("DELETE FROM players WHERE id=?1", params![id])?;
    Ok(())
}

// ---------- Matches ----------
pub fn list_matches() -> Result<Vec<Match>> {
    let conn = open()?;
    let mut stmt = conn.prepare(
        "SELECT id, left_team_id, right_team_id, left_score, right_score, match_type, current
         FROM matches ORDER BY created_at DESC",
    )?;
    let rows = stmt
        .query_map([], |r| {
            Ok(Match {
                id: r.get(0)?,
                left_team_id: r.get(1)?,
                right_team_id: r.get(2)?,
                left_score: r.get(3)?,
                right_score: r.get(4)?,
                match_type: r.get(5)?,
                current: r.get::<_, i64>(6)? != 0,
            })
        })?
        .collect::<Result<Vec<_>, _>>()?;
    Ok(rows)
}

pub fn save_match(mut m: Match) -> Result<Match> {
    let conn = open()?;
    if m.id.is_empty() {
        m.id = uuid::Uuid::new_v4().to_string();
    }
    if m.current {
        conn.execute("UPDATE matches SET current = 0", [])?;
    }
    conn.execute(
        "INSERT INTO matches (id, left_team_id, right_team_id, left_score, right_score, match_type, current)
         VALUES (?1,?2,?3,?4,?5,?6,?7)
         ON CONFLICT(id) DO UPDATE SET left_team_id=?2, right_team_id=?3,
           left_score=?4, right_score=?5, match_type=?6, current=?7",
        params![
            m.id, m.left_team_id, m.right_team_id, m.left_score,
            m.right_score, m.match_type, m.current as i64
        ],
    )?;
    Ok(m)
}

pub fn delete_match(id: &str) -> Result<()> {
    open()?.execute("DELETE FROM matches WHERE id=?1", params![id])?;
    Ok(())
}

pub fn current_match() -> Result<Option<Match>> {
    Ok(list_matches()?.into_iter().find(|m| m.current))
}

// ---------- Sponsors ----------
pub fn list_sponsors() -> Result<Vec<Sponsor>> {
    let conn = open()?;
    let mut stmt =
        conn.prepare("SELECT id, name, image, url, weight, active FROM sponsors ORDER BY name")?;
    let rows = stmt
        .query_map([], |r| {
            Ok(Sponsor {
                id: r.get(0)?,
                name: r.get(1)?,
                image: r.get(2)?,
                url: r.get(3)?,
                weight: r.get(4)?,
                active: r.get::<_, i64>(5)? != 0,
            })
        })?
        .collect::<Result<Vec<_>, _>>()?;
    Ok(rows)
}

pub fn save_sponsor(mut s: Sponsor) -> Result<Sponsor> {
    let conn = open()?;
    if s.id.is_empty() {
        s.id = uuid::Uuid::new_v4().to_string();
    }
    conn.execute(
        "INSERT INTO sponsors (id, name, image, url, weight, active) VALUES (?1,?2,?3,?4,?5,?6)
         ON CONFLICT(id) DO UPDATE SET name=?2, image=?3, url=?4, weight=?5, active=?6",
        params![s.id, s.name, s.image, s.url, s.weight, s.active as i64],
    )?;
    Ok(s)
}

pub fn delete_sponsor(id: &str) -> Result<()> {
    open()?.execute("DELETE FROM sponsors WHERE id=?1", params![id])?;
    Ok(())
}

// ---------- Tournaments ----------
pub fn list_tournaments() -> Result<Vec<Tournament>> {
    let conn = open()?;
    let mut stmt = conn
        .prepare("SELECT id, name, logo, entry_fee, prize_pool FROM tournaments ORDER BY name")?;
    let rows = stmt
        .query_map([], |r| {
            Ok(Tournament {
                id: r.get(0)?,
                name: r.get(1)?,
                logo: r.get(2)?,
                entry_fee: r.get(3)?,
                prize_pool: r.get(4)?,
            })
        })?
        .collect::<Result<Vec<_>, _>>()?;
    Ok(rows)
}

pub fn save_tournament(mut t: Tournament) -> Result<Tournament> {
    let conn = open()?;
    if t.id.is_empty() {
        t.id = uuid::Uuid::new_v4().to_string();
    }
    conn.execute(
        "INSERT INTO tournaments (id, name, logo, entry_fee, prize_pool) VALUES (?1,?2,?3,?4,?5)
         ON CONFLICT(id) DO UPDATE SET name=?2, logo=?3, entry_fee=?4, prize_pool=?5",
        params![t.id, t.name, t.logo, t.entry_fee, t.prize_pool],
    )?;
    Ok(t)
}

pub fn delete_tournament(id: &str) -> Result<()> {
    open()?.execute("DELETE FROM tournaments WHERE id=?1", params![id])?;
    Ok(())
}

// ---------- Settings ----------
pub fn get_setting(key: &str) -> Result<Option<String>> {
    let conn = open()?;
    let mut stmt = conn.prepare("SELECT value FROM settings WHERE key=?1")?;
    let mut rows = stmt.query(params![key])?;
    if let Some(row) = rows.next()? {
        Ok(Some(row.get(0)?))
    } else {
        Ok(None)
    }
}

pub fn set_setting(key: &str, value: &str) -> Result<()> {
    open()?.execute(
        "INSERT INTO settings (key, value) VALUES (?1,?2)
         ON CONFLICT(key) DO UPDATE SET value=?2",
        params![key, value],
    )?;
    Ok(())
}

// ---------- Servers ----------
pub fn list_servers() -> Result<Vec<Server>> {
    let conn = open()?;
    let mut stmt = conn.prepare("SELECT id, name, host, port, rcon_password FROM servers ORDER BY name")?;
    let rows = stmt
        .query_map([], |r| {
            let raw_pass: String = r.get(4)?;
            let has_password = !raw_pass.is_empty();
            Ok(Server {
                id: r.get(0)?,
                name: r.get(1)?,
                host: r.get(2)?,
                port: r.get(3)?,
                rcon_password: Some("".to_string()),
                has_password,
            })
        })?
        .collect::<Result<Vec<_>, _>>()?;
    Ok(rows)
}

pub fn save_server(mut s: Server) -> Result<Server> {
    let conn = open()?;
    if s.id.is_empty() {
        s.id = uuid::Uuid::new_v4().to_string();
    }
    let input_pass = s.rcon_password.clone().unwrap_or_default();
    let existing_pass: Option<String> = conn
        .query_row(
            "SELECT rcon_password FROM servers WHERE id = ?1",
            params![s.id],
            |r| r.get(0),
        )
        .ok();

    let pass_to_save = if !input_pass.is_empty() {
        input_pass
    } else {
        existing_pass.unwrap_or_default()
    };

    conn.execute(
        "INSERT INTO servers (id, name, host, port, rcon_password) VALUES (?1, ?2, ?3, ?4, ?5)
         ON CONFLICT(id) DO UPDATE SET name=?2, host=?3, port=?4, rcon_password=?5",
        params![s.id, s.name, s.host, s.port, pass_to_save],
    )?;

    s.has_password = !pass_to_save.is_empty();
    s.rcon_password = Some("".to_string());
    Ok(s)
}

pub fn delete_server(id: &str) -> Result<()> {
    open()?.execute("DELETE FROM servers WHERE id=?1", params![id])?;
    Ok(())
}

pub fn get_server_secret(id: &str) -> Result<ServerSecret> {
    let conn = open()?;
    let mut stmt = conn.prepare("SELECT id, name, host, port, rcon_password FROM servers WHERE id = ?1")?;
    let mut rows = stmt.query(params![id])?;
    if let Some(r) = rows.next()? {
        let port_i64: i64 = r.get(3)?;
        Ok(ServerSecret {
            id: r.get(0)?,
            name: r.get(1)?,
            host: r.get(2)?,
            port: port_i64 as u16,
            rcon_password: r.get(4)?,
        })
    } else {
        Err(anyhow::anyhow!("Сервер с ID '{}' не найден", id))
    }
}

// ---------- HUD Layouts ----------
pub fn list_hud_layouts() -> Result<Vec<HudLayoutMeta>> {
    let conn = open()?;
    let mut stmt = conn.prepare("SELECT id, name, created_at, updated_at FROM hud_layouts ORDER BY updated_at DESC, rowid DESC")?;
    let rows = stmt
        .query_map([], |r| {
            Ok(HudLayoutMeta {
                id: r.get(0)?,
                name: r.get(1)?,
                created_at: r.get(2)?,
                updated_at: r.get(3)?,
            })
        })?
        .collect::<Result<Vec<_>, _>>()?;
    Ok(rows)
}

pub fn get_hud_layout(id: &str) -> Result<Option<HudLayout>> {
    let conn = open()?;
    let mut stmt = conn.prepare("SELECT id, name, data, created_at, updated_at FROM hud_layouts WHERE id = ?1")?;
    let mut rows = stmt.query(params![id])?;
    if let Some(r) = rows.next()? {
        Ok(Some(HudLayout {
            id: r.get(0)?,
            name: r.get(1)?,
            data: r.get(2)?,
            created_at: r.get(3)?,
            updated_at: r.get(4)?,
        }))
    } else {
        Ok(None)
    }
}

pub fn save_hud_layout(mut layout: HudLayout) -> Result<HudLayout> {
    let conn = open()?;
    if layout.id.is_empty() {
        layout.id = uuid::Uuid::new_v4().to_string();
    }
    conn.execute(
        "INSERT INTO hud_layouts (id, name, data, updated_at) VALUES (?1, ?2, ?3, datetime('now'))
         ON CONFLICT(id) DO UPDATE SET name=?2, data=?3, updated_at=datetime('now')",
        params![layout.id, layout.name, layout.data],
    )?;
    if let Some(saved) = get_hud_layout(&layout.id)? {
        Ok(saved)
    } else {
        Ok(layout)
    }
}

pub fn delete_hud_layout(id: &str) -> Result<()> {
    open()?.execute("DELETE FROM hud_layouts WHERE id=?1", params![id])?;
    Ok(())
}
