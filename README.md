<div align="center">

# OpenHUD Manager

### Десктопное приложение для турнирных трансляций CS2 — открытый аналог Lexogrine HUD Manager (LHM)

Tauri 2 · Vue 3 · Rust Axum · SQLite

[![License: MIT](https://img.shields.io/badge/License-MIT-0E0F11?style=flat&labelColor=16181C&color=E6C475)](https://opensource.org/licenses/MIT)
[![Tauri 2](https://img.shields.io/badge/Tauri-2.x-0E0F11?style=flat&labelColor=16181C&color=E6C475)](https://v2.tauri.app)
[![Vue 3](https://img.shields.io/badge/Vue-3.x-0E0F11?style=flat&labelColor=16181C&color=E6C475)](https://vuejs.org)
[![Rust](https://img.shields.io/badge/Rust-stable-0E0F11?style=flat&labelColor=16181C&color=E6C475)](https://www.rust-lang.org)
[![Tests](https://img.shields.io/badge/Tests-22%20passed-brightgreen?style=flat&labelColor=16181C&color=E6C475)](#тесты)

</div>

---

> **OpenHUD Manager** — менеджер киберспортивных трансляций CS2: приём Game State Integration,
> хостинг оверлеев для OBS, каталог команд/игроков/матчей, визуальный редактор HUD, управление
> OBS через obs-websocket v5 и серверами через RCON — всё в одном нативном окне (~15 МБ, без Chromium).

## Почему не LHM (Electron)

| | LHM | OpenHUD Manager |
|---|---|---|
| Инсталлятор | ~200 MB | ~10–15 MB |
| RAM (idle) | ~300 MB | ~30–60 MB |
| Runtime | Bundled Chromium | System WebView2 |
| Backend | Node.js | Rust (Axum) |
| БД | NeDB (JSON) | SQLite (WAL) |

## Возможности

| Модуль | Описание |
|---|---|
| **GSI-сервер** | Приём Game State Integration от CS2, авто-установка cfg в игру, раздача по WebSocket |
| **Оверлеи для OBS** | Хостинг на встроенном HTTP-сервере, Browser Source, импорт/удаление паков из ZIP |
| **Каталог** | Команды, игроки, матчи, турниры, спонсоры — CRUD в SQLite с WAL |
| **Визуальный редактор HUD** | Холст 1920×1080, сетка 8px, экспорт HTML, раскладки в БД |
| **Управление OBS** | obs-websocket v5: сцены, стрим/запись, реплей-буфер, видимость источников |
| **RCON-консоль** | Source RCON по TCP: команды, смена карт, маскирование паролей |
| **Контроль событий** | Плашки статистики/вето/победителя, смена сторон, ротация спонсоров — прямо в оверлеи |

## Быстрый старт

```bash
git clone https://github.com/DangerousANEN/openhud-manager.git
cd openhud-manager
npm install
npm run tauri dev     # разработка
npm run tauri build   # релизный .exe
```

1. Запустите приложение — GSI-сервер поднимется на `http://127.0.0.1:1349`
2. На странице «Настройки» нажмите «Установить GSI cfg в CS2» — cfg запишется в папку игры автоматически
3. Скопируйте URL оверлея в OBS как Browser Source
4. Запустите CS2 — данные пойдут в панель и оверлеи в реальном времени

## Тесты

```bash
cd src-tauri && cargo test   # 22 unit-теста бэкенда
npx vue-tsc --noEmit         # типизация фронтенда
python scripts/ws_smoke_test.py   # интеграционный smoke (нужен запущенный сервер)
```

## Документация

Полная документация — в [docs/](docs/): установка, GSI, RCON, редактор HUD, устранение неполадок.
Продуктовые требования и роадмап — [PRD.md](PRD.md).

## Лицензия

MIT — используйте свободно.
