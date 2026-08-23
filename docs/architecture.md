# Устройство приложения

[← к оглавлению](README.md)

## Стек

| Слой | Технология |
|---|---|
| Оболочка | Tauri 2 |
| Интерфейс | Vue 3, TypeScript, Tailwind |
| Бэкенд | Rust |
| HTTP-сервер | axum 0.7 с поддержкой WebSocket |
| База | SQLite через rusqlite 0.31 (bundled) |
| RCON | крейт rcon 0.6.0 с фичей rt-tokio |

Всё локально: ни облака, ни внешних сервисов. Приложение сам себе сервер,
поэтому работает в закрытой сети площадки без интернета.

## Модули бэкенда

```
src-tauri/src/
    main.rs      точка входа
    lib.rs       регистрация команд Tauri, запуск сервера
    db.rs        SQLite: схема и CRUD
    gsi.rs       разбор GSI-пакетов от CS2
    server.rs    axum: приём GSI, WebSocket, хостинг оверлеев
    rcon.rs      Source RCON: серверы и команды
```

## Как ходят данные

```
CS2  --HTTP POST /gsi-->  axum (порт 1349)
                              |
                    разбор в gsi.rs
                              |
              +---------------+---------------+
              |                               |
     WebSocket в оверлеи              состояние в память
     (OBS Browser Source)             (страница Live)
```

Оверлеи получают состояние по WebSocket и перерисовываются сами. Событийные
вещи — смена сцены, титры, активация пака — рассылаются той же дорогой через
`overlay_broadcast`.

## Схема базы

Восемь таблиц в `%APPDATA%\OpenHUD\openhud.db`:

| Таблица | Содержимое |
|---|---|
| `teams` | команды: название, тег, логотип, страна |
| `players` | игроки: ник, имя, команда, роль |
| `matches` | матчи: команды, турнир, формат, счёт |
| `tournaments` | турниры: название, даты, призовой фонд |
| `sponsors` | спонсоры: логотип, вес показа, активность |
| `servers` | CS2-серверы: хост, порт, пароль RCON |
| `hud_layouts` | макеты редактора HUD |
| `settings` | настройки ключ-значение |

## Команды Tauri

34 команды. Каталог:

```
teams_list / teams_save / teams_delete
players_list / players_save / players_delete
matches_list / matches_save / matches_delete / matches_current
tournaments_list / tournaments_save / tournaments_delete
sponsors_list / sponsors_save / sponsors_delete
```

GSI и оверлеи:

```
gsi_status / gsi_snapshot / gsi_cfg_text
overlay_broadcast / overlays_path / huds_list
```

Макеты HUD:

```
save_hud_layout / list_hud_layouts / load_hud_layout / delete_hud_layout
```

Серверы и RCON:

```
list_servers / save_server / delete_server
rcon_test_connection / rcon_exec / rcon_changelevel
```

Прочее:

```
setting_get / setting_set / db_location
```

## Порты

| Порт | Назначение |
|---|---|
| 1349 | GSI, WebSocket, оверлеи (меняется в настройках) |
| 1420 | Vite в режиме разработки |
| 27015 | RCON игрового сервера (стандартный) |

Сервер слушает `0.0.0.0`, то есть доступен из локальной сети — это нужно, когда
CS2 и приложение на разных машинах. Аутентификации на нём нет: любой в той же
сети может отправить GSI-пакет или открыть оверлей. Для закрытой сети площадки
это приемлемо, для публичной — порт закрывается брандмауэром.
