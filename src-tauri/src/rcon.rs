// Source RCON client module for CS2 servers
use crate::db;
use std::time::Duration;
use tokio::time::timeout;

fn err<E: std::fmt::Display>(e: E) -> String {
    e.to_string()
}

pub async fn test_connection_raw(host: &str, port: u16, password: &str) -> Result<String, String> {
    let addr = format!("{}:{}", host, port);
    let connect_future = rcon::Connection::builder().connect(&addr, password);

    match timeout(Duration::from_secs(5), connect_future).await {
        Ok(Ok(_conn)) => Ok(format!("Успешное подключение к RCON {}:{}", host, port)),
        Ok(Err(e)) => Err(format!("Ошибка RCON авторизации или подключения: {}", e)),
        Err(_) => Err(format!("Таймаут подключения к RCON {}:{}", host, port)),
    }
}

pub async fn exec_raw(host: &str, port: u16, password: &str, command: &str) -> Result<String, String> {
    let addr = format!("{}:{}", host, port);
    let connect_future = rcon::Connection::builder().connect(&addr, password);

    let mut conn = match timeout(Duration::from_secs(5), connect_future).await {
        Ok(Ok(c)) => c,
        Ok(Err(e)) => return Err(format!("Ошибка RCON подключения: {}", e)),
        Err(_) => return Err(format!("Таймаут подключения к RCON {}:{}", host, port)),
    };

    let cmd_future = conn.cmd(command);
    match timeout(Duration::from_secs(10), cmd_future).await {
        Ok(Ok(response)) => Ok(response),
        Ok(Err(e)) => Err(format!("Ошибка выполнения RCON-команды: {}", e)),
        Err(_) => Err("Таймаут ожидания ответа RCON-команды".to_string()),
    }
}

#[tauri::command]
pub async fn list_servers() -> Result<Vec<db::Server>, String> {
    db::list_servers().map_err(err)
}

#[tauri::command]
pub async fn save_server(server: db::Server) -> Result<db::Server, String> {
    db::save_server(server).map_err(err)
}

#[tauri::command]
pub async fn delete_server(id: String) -> Result<(), String> {
    db::delete_server(&id).map_err(err)
}

#[tauri::command]
pub async fn rcon_test_connection(server_id: String) -> Result<String, String> {
    let s = db::get_server_secret(&server_id).map_err(err)?;
    test_connection_raw(&s.host, s.port, &s.rcon_password).await
}

#[tauri::command]
pub async fn rcon_exec(server_id: String, command: String) -> Result<String, String> {
    let s = db::get_server_secret(&server_id).map_err(err)?;
    exec_raw(&s.host, s.port, &s.rcon_password, &command).await
}

#[tauri::command]
pub async fn rcon_changelevel(server_id: String, map_name: String) -> Result<String, String> {
    let cmd = format!("changelevel {}", map_name.trim());
    rcon_exec(server_id, cmd).await
}
