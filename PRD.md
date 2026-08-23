# OpenHUD Manager — Product Requirements Document (PRD)
**Версия:** 2.0  
**Дата:** 2026-07-27  
**Статус:** Draft → Review

---

## 1. Обзор продукта

**OpenHUD Manager** — коммерческое десктопное приложение для профессионального и полупрофессионального проведения CS2-трансляций. Полный аналог и улучшенная замена Lexogrine HUD Manager (LHM), реализованная на современном лёгком стеке без бандлинга Chromium.

### Основное ценностное предложение
| | LHM (Electron) | OpenHUD Manager (Tauri v2) |
|---|---|---|
| Размер инсталлятора | ~200 MB | ~10–15 MB |
| RAM (idle) | ~300 MB | ~30–60 MB |
| Runtime | Bundled Chromium | System WebView2 (Edge) |
| Backend | Node.js (JS) | Rust (Axum, быстро, безопасно) |
| База данных | NeDB (файловый JSON) | SQLite (WAL, индексы, транзакции) |
| Онлайн-функции | LHM Cloud (проприетарный) | Собственный сервис / self-hosted |
| Лицензия | Бесплатно (OSS core) | Платная лицензия (Freemium) |

---

## 2. Целевая аудитория

- **Организаторы киберспортивных турниров** — BO1/BO3/BO5, вето, управление сетками
- **Стримеры и продакшн-команды** — OBS интеграция, оверлеи, веб-камеры, реплеи
- **Разработчики HUD-паков** — dev-режим с HMR, hot-reload конфигов
- **Клубы и академии** — база игроков, команд, спонсоры, матчи

---

## 3. Технический стек

### Frontend (UI панели управления)
- **Vue 3** (Composition API + `<script setup>`)
- **Vite 5** — сборщик, HMR в dev-режиме
- **Pinia** — state management
- **Tailwind CSS 3** — utility-first стили
- **Vue Router 4** — навигация между разделами
- **VueUse** — утилиты (hotkeys, event listeners, storage)

### Backend (Rust / Tauri v2)
- **Tauri v2** — десктопный shell, IPC мост Rust ↔ Vue
- **Axum** — встроенный HTTP/WebSocket сервер (GSI endpoint + Overlay server)
- **tokio** — async runtime
- **rusqlite** + **sqlx** — SQLite с WAL, async queries
- **serde / serde_json** — сериализация, парсинг GSI JSON
- **zip** crate — работа с HUD-паками (.zip)
- **notify** crate — watch файловой системы (авто-обнаружение HUD-паков)
- **winreg** crate — поиск пути CS2 в Windows Registry (Steam)

### HUD-паки (Оверлеи)
- Независимые **Vite + Vue 3 / React** приложения
- Связь через **WebSocket** (Axum WS endpoint `/ws/gsi`)
- Опциональный **WebRTC** (`simple-peer`) для веб-камер игроков

---

## 4. Архитектура системы

```
                        [ CS2 Game Engine ]
                                │
                        HTTP POST JSON (GSI, 10-60 Hz)
                                │
┌───────────────────────────────▼──────────────────────────────────┐
│ OpenHUD Manager — Rust Backend (Tauri v2 Core Process)           │
│                                                                   │
│  ┌─────────────────┐    ┌──────────────────┐    ┌─────────────┐  │
│  │  Axum HTTP      │───►│  GSI Parser      │───►│  SQLite DB  │  │
│  │  POST /gsi      │    │  (Rust structs)  │    │  (Teams,    │  │
│  │  GET /overlay/* │    │  Data Enrichment │    │   Players,  │  │
│  └─────────────────┘    └────────┬─────────┘    │   Matches,  │  │
│                                  │              │   Sponsors) │  │
│                         ┌────────▼─────────┐    └─────────────┘  │
│                         │  WebSocket Hub   │                      │
│                         │  /ws/gsi         │                      │
│                         └────────┬─────────┘                      │
└─────────────────────────────────┼──────────────────────────────--┘
                                  │
              ┌───────────────────┴──────────────────────┐
              │                                          │
              ▼                                          ▼
┌─────────────────────────────┐          ┌──────────────────────────────────┐
│ Vue 3 Control Panel (UI)    │          │ Active HUD Pack (Vite App)        │
│ - Tauri WebView2 Window     │          │ - OBS Browser Source             │
│ - Tauri IPC (commands)      │          │ - WebSocket /ws/gsi              │
│ - Матчи, команды, плеёры   │          │ - Renders overlay at 60 FPS      │
└─────────────────────────────┘          └──────────────────────────────────┘
```

### Поток данных GSI
1. CS2 → `HTTP POST /gsi` (JSON, до 60 Hz)
2. Rust парсит JSON, обогащает данными из SQLite (логотипы, флаги, ники)
3. Обогащённый объект → `broadcast` через Axum WebSocket Hub всем подписчикам
4. HUD-паки в OBS / превью-окне реагируют и перерисовывают оверлей

---

## 5. Функциональные требования

### 5.1 Экран «Live» (Управление матчем)

| ID | Функция | Приоритет |
|----|---------|-----------|
| L-01 | Live Preview — предпросмотр активного HUD внутри приложения | P0 |
| L-02 | Reverse Sides (Alt+R) — быстрое переключение CT ↔ T | P0 |
| L-03 | Manual overlays — ручной вывод плашек: статистика игрока, сравнение команд, MVP, победитель раунда, итоги матча | P0 |
| L-04 | GSI Test Mode — воспроизведение записанного GSI-потока (60 FPS симуляция без CS2) | P1 |
| L-05 | Global Hotkeys — настройка глобальных горячих клавиш Windows | P1 |
| L-06 | Round timer override — ручная корректировка таймера и счёта при техрестарте | P1 |
| L-07 | Score Override — ручная коррекция счета карт при рассинхронизации с GSI | P0 |

### 5.2 Экран «Matches» (Матчи и Вето)

| ID | Функция | Приоритет |
|----|---------|-----------|
| M-01 | Создание матчей (BO1, BO3, BO5) | P0 |
| M-02 | Map Veto System — конструктор пиков/банов карт с выбором сторон | P0 |
| M-03 | Привязка команд к слотам Team 1 / Team 2 | P0 |
| M-04 | Авто-определение победителя карты по GSI данным | P1 |
| M-05 | История матчей — архив завершённых матчей с результатами | P1 |
| M-06 | Экспорт результатов матча (JSON/CSV) | P2 |

### 5.3 Экран «Teams» (База команд)

| ID | Функция | Приоритет |
|----|---------|-----------|
| T-01 | CRUD команд: название, тег, страна (флаг), логотип (PNG/SVG/WebP) | P0 |
| T-02 | Поиск и фильтрация | P0 |
| T-03 | Custom Fields — динамические кастомные поля (спонсор, Twitter, рейтинг) | P1 |
| T-04 | Импорт команд из HLTV JSON / CSV | P2 |

### 5.4 Экран «Players» (База игроков)

| ID | Функция | Приоритет |
|----|---------|-----------|
| P-01 | CRUD профилей: SteamID64, никнейм, имя/фамилия, страна, аватар | P0 |
| P-02 | Привязка игрока к команде | P0 |
| P-03 | Авто-поиск пути Steam и заполнение аватаров из Steam API | P1 |
| P-04 | URL веб-камеры игрока (для WebcamGrid overlay) | P1 |
| P-05 | Кастомные поля (роль, соцсети, Twitch) | P1 |

### 5.5 Экран «Tournaments» (Турниры)

| ID | Функция | Приоритет |
|----|---------|-----------|
| TN-01 | Создание турнирных структур (Single/Double elimination, швейцарская система) | P0 |
| TN-02 | Привязка матчей к турниру | P0 |
| TN-03 | Авто-генерация следующего матча при завершении текущего | P1 |
| TN-04 | **Платная регистрация команд** — форма регистрации с реквизитами, оплата (Stripe / ЮKassa) | P1 |
| TN-05 | Публичная страница турнира (веб-ссылка для участников) | P2 |
| TN-06 | Экспорт сетки в PNG/PDF | P2 |

### 5.6 Экран «HUDs» (Менеджер оверлеев)

| ID | Функция | Приоритет |
|----|---------|-----------|
| H-01 | Сканирование папки `~/HUDs` — автообнаружение установленных паков | P0 |
| H-02 | Импорт HUD-пака из `.zip` архива | P0 |
| H-03 | Экспорт HUD-пака в `.zip` | P1 |
| H-04 | HUD Config Panel — динамическая панель настроек активного HUD (цвета, тогглы) | P0 |
| H-05 | Dev HUD Mode — прокси на `localhost:3500` с HMR для разработки оверлеев | P1 |
| H-06 | Launch в прозрачном окне Tauri (поверх игры) | P1 |
| H-07 | OBS URL — копирование ссылки Browser Source для OBS Studio | P0 |
| H-08 | **Visual HUD Editor** — графический редактор позиций/стилей элементов HUD с iframe-превью | P1 |
| H-09 | Слоты HUD — назначение разных HUD-паков на разные сцены (intro, game, break) | P2 |

### 5.7 Экран «Stream Control» (Управление стримом)

| ID | Функция | Приоритет |
|----|---------|-----------|
| SC-01 | **OBS WebSocket интеграция** (obs-websocket v5) — смена сцен, источников, фильтров | P0 |
| SC-02 | Scene Switcher — правила авто-смены сцен по GSI событиям (warmup → game → break) | P1 |
| SC-03 | **WebcamGrid Overlay** — сетка веб-камер игроков через WebRTC / RTMP ссылки | P1 |
| SC-04 | RTMP сервер — встроенный node-media-server аналог на Rust (реламинг камер) | P2 |
| SC-05 | Replay / Highlight Overlay — плашка хайлайта раунда с авто-триггером по GSI событию (ACE, клатч, бомба) | P1 |
| SC-06 | **Sponsors Manager** — ротация спонсорских баннеров в оверлее, расписание, слоты карт | P1 |

### 5.8 Экран «ACO» (AI Observer — Автоматический оператор)

| ID | Функция | Приоритет |
|----|---------|-----------|
| ACO-01 | Разметка 2D-зон карт (A, B, mid, spawn) | P2 |
| ACO-02 | Алгоритм приоритетов камер (дуэли, бомба, клатч) | P2 |
| ACO-03 | Интеграция HLAE/MIRV через PGL-протокол | P2 |

### 5.9 Экран «Config» (Настройки)

| ID | Функция | Приоритет |
|----|---------|-----------|
| C-01 | Авто-поиск пути CS2 в Windows Registry / Steam | P0 |
| C-02 | Генерация и установка `gamestate_integration_openhud.cfg` | P0 |
| C-03 | Настройка сетевых портов (GSI, WebSocket, Overlay HTTP) | P0 |
| C-04 | Управление токенами авторизации GSI | P0 |
| C-05 | Импорт/Экспорт БД (SQLite dump, JSON) | P1 |
| C-06 | Переключение языков интерфейса (RU / EN) | P1 |
| C-07 | Управление лицензией (активация, проверка онлайн) | P1 |
| C-08 | Авто-обновление приложения (`tauri-plugin-updater`) | P1 |

---

## 6. Нефункциональные требования

| Категория | Требование |
|-----------|------------|
| Производительность | GSI latency < 5 ms от POST до WebSocket broadcast |
| Память | Idle RAM < 80 MB (Tauri WebView2 + Rust backend) |
| Размер | Инсталлятор ≤ 20 MB |
| Совместимость | Windows 10 21H2+ (WebView2 предустановлен), Windows 11 |
| Надёжность | SQLite WAL mode, транзакции, авто-резервное копирование БД |
| Безопасность | GSI токен валидации, CORS только localhost, Tauri CSP |
| Масштабируемость | До 10 одновременных WS подключений (OBS, превью, паки) |
| UX | Тёмная тема по умолчанию, загрузка < 2 сек |

---

## 7. Структура проекта (Tauri v2)

```
openhud-manager/
├── src/                          # Vue 3 + Vite frontend
│   ├── pages/
│   │   ├── Live.vue              # Управление матчем
│   │   ├── Matches.vue           # Матчи и вето
│   │   ├── Teams.vue             # База команд
│   │   ├── Players.vue           # База игроков
│   │   ├── Tournaments.vue       # Турниры
│   │   ├── HUDs.vue              # HUD менеджер
│   │   ├── HudEditor.vue         # Visual HUD Editor
│   │   ├── StreamControl.vue     # OBS + оверлеи
│   │   ├── Sponsors.vue          # Спонсоры и баннеры
│   │   └── Config.vue            # Настройки
│   ├── components/
│   │   ├── overlay/
│   │   │   ├── VetoOverlay.vue
│   │   │   ├── ReplayOverlay.vue
│   │   │   ├── WebcamGrid.vue
│   │   │   └── SponsorBanner.vue
│   │   └── ui/                   # Shared UI компоненты
│   ├── stores/                   # Pinia stores
│   │   ├── gsi.ts               # GSI состояние
│   │   ├── match.ts             # Матч, счёт
│   │   ├── teams.ts             # Команды/игроки
│   │   └── settings.ts          # Настройки приложения
│   └── main.ts
│
├── src-tauri/                    # Rust backend
│   ├── src/
│   │   ├── main.rs
│   │   ├── gsi/
│   │   │   ├── mod.rs           # GSI HTTP endpoint (Axum)
│   │   │   ├── parser.rs        # CS2 GSI JSON → Rust structs
│   │   │   └── enricher.rs     # Обогащение данными из SQLite
│   │   ├── ws/
│   │   │   └── hub.rs           # WebSocket broadcast hub
│   │   ├── db/
│   │   │   ├── mod.rs           # SQLite init, migrations
│   │   │   ├── teams.rs
│   │   │   ├── players.rs
│   │   │   ├── matches.rs
│   │   │   └── tournaments.rs
│   │   ├── overlay/
│   │   │   └── server.rs        # Static file server для HUD-паков
│   │   ├── commands/            # Tauri IPC commands
│   │   │   ├── match_cmds.rs
│   │   │   ├── team_cmds.rs
│   │   │   ├── hud_cmds.rs
│   │   │   └── config_cmds.rs
│   │   └── steam/
│   │       └── detector.rs      # Авто-поиск CS2 через WinReg
│   └── Cargo.toml
│
├── huds/                         # Директория HUD-паков
│   └── default-hud/             # Базовый HUD (Vite + Vue 3)
│       ├── index.html
│       ├── src/
│       └── package.json
│
└── tauri.conf.json
```

---

## 8. Бизнес-модель и монетизация

### Freemium лицензия

| Уровень | Цена | Функции |
|---------|------|---------|
| **Free** | $0 | 1 матч, 2 команды, 5 игроков, 1 HUD-пак, нет платных турниров |
| **Pro** | $49/год или $9/мес | Без лимитов, платные турниры, OBS автоматизация, приоритетная поддержка |
| **Studio** | $149/год | Всё из Pro + White-label брендинг, API доступ, ACO Observer |

### Дополнительный доход
- **Платные HUD-паки** — маркетплейс оверлеев ($5–$30 за пак)
- **Платная регистрация команд в турнирах** — организатор берёт % с команд (Stripe Checkout)
- **Custom License** — для крупных турниров / LANов

---

## 9. Дорожная карта (Milestones)

### MVP — v0.1 (4 недели)
- [ ] Tauri v2 проект (scaffolding)
- [ ] GSI endpoint (Rust/Axum) + WebSocket hub
- [ ] SQLite схема (teams, players, matches)
- [ ] Vue 3 UI: Dashboard, Live, Matches (BO1/BO3/BO5), Teams, Players
- [ ] Базовый HUD-менеджер (сканирование папки, OBS URL)
- [ ] Авто-поиск CS2 и установка GSI cfg

### Beta — v0.3 (8 недель)
- [ ] Map Veto System
- [ ] Visual HUD Editor (iframe + postMessage)
- [ ] OBS WebSocket интеграция
- [ ] Sponsors Manager
- [ ] Dev HUD Mode (proxy + HMR)
- [ ] GSI Test Mode (playback)

### Release — v1.0 (12 недель)
- [ ] Replay/Highlight overlay
- [ ] WebcamGrid overlay
- [ ] Платные турниры (Stripe)
- [ ] Система лицензий
- [ ] Авто-обновление
- [ ] Полный русский + английский UI
- [ ] Инсталлятор .exe (NSIS / WiX)
- [ ] Документация и скрин-записи

---

## 10. CS2 GSI Config

Файл размещается по пути:
`C:\Program Files (x86)\Steam\steamapps\common\Counter-Strike Global Offensive\game\csgo\cfg\gamestate_integration_openhud.cfg`

```
"OpenHUD Manager"
{
  "uri"           "http://127.0.0.1:3000/gsi"
  "timeout"       "5.0"
  "heartbeat"     "10.0"
  "buffer"        "0.0"
  "throttle"      "0.0"
  "auth"          { "token" "openhud_secret_token" }
  "output"
  {
    "precision_time"     "3"
    "precision_position" "1"
    "precision_vector"   "3"
  }
  "data"
  {
    "provider"            "1"
    "map"                 "1"
    "round"               "1"
    "player_id"           "1"
    "player_state"        "1"
    "player_weapons"      "1"
    "player_match_stats"  "1"
    "allplayers_id"       "1"
    "allplayers_state"    "1"
    "allplayers_match_stats" "1"
    "allplayers_weapons"  "1"
    "allplayers_position" "1"
    "phase_countdowns"    "1"
    "allgrenades"         "1"
    "bomb"                "1"
    "grenades"            "1"
  }
}
```

---

## 11. Сравнение с LHM — что делаем лучше

| Функция | LHM | OpenHUD Manager |
|---------|-----|-----------------|
| Стек | Electron + Node.js + NeDB | Tauri v2 + Rust + SQLite |
| Размер | ~200 MB | ~10-15 MB |
| Visual HUD Editor | ❌ Нет | ✅ Полноценный iframe-редактор |
| Платные турниры | ❌ Нет | ✅ Stripe/ЮKassa регистрация |
| Sponsors Manager | ❌ Нет | ✅ Ротация баннеров по картам/раундам |
| Replay Overlay | Базовый | ✅ Авто-триггер по GSI событиям |
| OBS Automation | Базовый | ✅ Полный obs-websocket v5 + правила |
| Авто-обновление | ✅ | ✅ tauri-plugin-updater |
| Русский UI | ❌ | ✅ Полная локализация |
| Self-hosted | ❌ Требует LHM Cloud | ✅ Полностью локально |
| Open source | ✅ OSS core | Freemium (OSS core планируется) |

---

*Документ поддерживается командой OpenHUD. Следующий ревью — после завершения MVP v0.1.*
