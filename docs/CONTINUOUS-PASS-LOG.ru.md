# Журнал непрерывного прохода (6-часовое окно)

Старт: 2026-09-18 03:54 (+07). Дедлайн: 09:54 (+07).
Правило цикла: один пункт = правка + целевой тест (exit 0) + коммит + push + запись здесь.

## Приоритеты (следующие пункты)

1. **Bomb timer в fennec-broadcast** — 40-секундная шкала с цветом green→yellow→red в score bug.
   Данные уже есть в `GsiSnapshot` (`bomb_state`, `bomb_countdown`); в universal WS-поле
   добавлены `bomb_state`/`bomb_countdown` (gsi.rs:155-156, НЕ закоммичено на момент старта).
   Стандарт: hud-research §3.4 / §5 (строка 182), планка в bug-mid, таймер вместо clock на фазе bomb.
2. **Re-check неудобных утверждений HUD-RESEARCH** (категоричные «зрители единогласно»,
   «золотой стандарт» без прямых ссылок в тексте) — снизить категоричность или добавить URL.
3. **Отчет субагента про 7 гэпов продакшена** — перенести в OPERATOR-GUIDE или README.
4. **Win condition: idle-кадр не пустой** — если данных нет, HUD показывает LAST STATE / WAITING FOR GSI.
5. Дальше — по находкам E2E (только реальные дефекты, без косметики).

## Лог циклов

### Цикл 0 (родительская сессия, 03:00-05:10)
- Broadcast: phase labels, clockText (65.2→1:05), alive-counter всегда видим,
  экономика только на freezetime. Тесты: broadcast_clock 10/10 (node, песочница),
  broadcast_alive_e2e 3/3 фазы через реальный GSI→WS, 0 ошибок браузера,
  камера/радар-регрессии зелены. Коммит `301766f` запушен.
- **Цикл 0b — Bomb timer (завершён, коммит `ead51b8`):**
  - `gsi.rs`: в universal WS payload добавлены `bomb_state`/`bomb_countdown`
    (доказано голым WS-пробником `ws_bomb_probe.py`: ключи реально приходят).
  - Broadcast HUD: на planted бомбе clock заменяется на C4-таймер с 40s заливкой,
    green (>20s) → yellow (≤20s) → красный пульсирующий (≤10s).
  - E2E `broadcast_bomb_e2e.py`: 4/4 через реальный GSI→WS→HUD
    (40/12/3.5s + скрыт на live), ширина заливки asserted (±2%), 0 ошибок браузера.
  - Регрессии зелены: broadcast_clock 10/10, alive 3/3, agent_radar 3/3, camera_e2e 3/3.
- **Цикл 0c — Score rollover (коммит `8b387e5`):** E2E смены счёта 8→9 через фазу
  `over` (R12→R13): сервер /api/state, WS-payload и DOM сходятся, 0 ошибок.
- **Цикл 0d — Gap-аудит (коммит `ce6cf5e`):** docs/PRODUCTION-GAPS.ru.md —
  7 честных гэпов (P0/P1/P2) без выдачи существующего за отсутствующее.
- **Цикл 0e — SIGNAL LOST watchdog (коммит `9c22561`, гэп #1 закрыт):**
  - core.js: watchdog по УНИКАЛЬНОМУ updated_at — локальные перерисовки
    последнего снапшота (loadConfig тик каждые 5с) НЕ маскируют тишину GSI.
  - Бейдж «SIGNAL LOST» (мигающий, центр) в Broadcast; E2E: тишина 14с → бейдж
    виден, новый кадр → скрыт, 0 ошибок страницы. Регрессии зелены
    (bomb 4/4, alive 3/3, score 3/3, clock 10/10).
- Урок: smoke-сервер поднимать только через `terminal(background=true)`;
  внутри составных команд процесс умирает с shell (SIGTERM, exit 143).

### Цикл 0f — Сериализация перерывов и пауз (гэп #2 закрыт)
- **GSI Backend & State:**
  - `gsi.rs`: добавлено извлечение `timeouts_remaining` для CT и T из `map.team_ct`/`map.team_t` в `GsiSnapshot` (`ct_timeouts_remaining`, `t_timeouts_remaining`).
  - `gsi.rs`, `server.rs`: поля `ct_timeouts_remaining`, `t_timeouts_remaining` и `phase_countdown_phase` сериализуются в универсальный WS payload и отдаются клиентам оверлея.
  - Rust unit-тест `team_timeouts_remaining_extracted_from_map` (cargo test --lib pass).
- **RCON команды оператора:**
  - `rcon.rs`, `lib.rs`: добавлены команды `rcon_pause_match`, `rcon_unpause_match`, `rcon_timeout(server_id, side)`.
  - `src/pages/Servers.vue`: в `quickCommands` добавлены кнопки `timeout_ct_start` и `timeout_t_start`.
- **Broadcast HUD UX:**
  - `fennec-broadcast`: добавлен выделенный блок `#timeout-bar` под score bug с цветовой индикацией сторон (`timeout--ct`, `timeout--t`, `timeout--tech`), названием взявшей паузу команды (`s.ct_name`/`s.t_name`/`ADMIN`), типом паузы (`TACTICAL TIMEOUT`/`TECHNICAL PAUSE`) и счётчиком оставшихся таймаутов (`X REMAINING`).
  - На время паузы таймер раунда/паузы честно форматирует обратный отсчёт, фазовая плашка отображает контекст команды, при возврате в `live` баннер скрывается. Позиции якорных зон оверлея не затронуты.
### Цикл 0g — Мажор-стандарты во всех 3 стилях худов и Bo3 матч-контекст (гэп #3 закрыт)
- **Унификация 3 стилей (`fennec-broadcast`, `fennec-cyber`, `fennec-championship`):**
  - Во все 3 оверлея интегрирован 40-секундный C4-прогресс бар с зонами safe/warn/crit и честным фолбэком `--` при отсутствии countdown (исключен показ ложного 0).
  - Во все 3 оверлея добавлены плашки `#timeout-bar` (тактические таймауты CT/T с подсчётом остатка и технические паузы) и сторожевые бейджи `#signal-lost`.
  - Во всех 3 оверлеях нормализовано отображение времени раунда функцией `clockText` (без сырых дробей).
- **Закрытие гэпа #3 (Матч-контекст Bo3 / турнир):**
  - Бэкенд (`src-tauri/src/server.rs`, `src-tauri/src/gsi.rs`) извлекает активный матч из локальной БД SQLite и обогащает WebSocket payload полями `series_match_type`, `series_left_score`, `series_right_score`, `tournament_name`.
  - В верстку всех 3 стилей добавлены верхние плашки серии (`BO3 · MAP X` / турнир) и индикаторы выигранных карт серии (пипы/бусины `series-pips`).
- **Верификация в sandbox:**
  - Создан и успешно пройден сквозной интеграционный E2E-тест `scripts/huds_tournament_e2e.py`:
    - `fennec-broadcast`: 10/10 тестов passed (часы 1:05, BO3 MAP 1, C4 35s/16s/7s/--, timeouts CT/T, tech pause, normal live), 0 ошибок JS.
    - `fennec-cyber`: 10/10 тестов passed, 0 ошибок JS.
    - `fennec-championship`: 10/10 тестов passed, 0 ошибок JS.
  - Сохранены сквозные скриншоты-доказательства всех трёх стилей: `F:/anen/desktop/hud-evidence/fennec-*-tournament-verified.png`.
  - Все unit-тесты Rust (`cargo test --lib gsi::` 6/6) пройдены.

### Цикл 0h — Pick/Decider статус карт, Side-индикаторы и экспорт OBS-сцен (гэпы #4 и #6 закрыты)
- **Закрытие гэпа #4 (Pick/Decider и смена сторон):**
  - В схему SQLite и структуру `Match` добавлена поддержка поля `vetos` (`m.vetos` JSON).
  - В `server.rs` и `gsi.rs` реализован алгоритм анализа драфта карт: сопоставление имени текущей карты с историей банов/пиков команд. Формируются теги `map_pick_tag` (`[TEAM] PICK` или `DECIDER`).
  - Во всех 3 оверлеях (`fennec-broadcast`, `fennec-cyber`, `fennec-championship`) добавлены side-индикаторы (`CT`/`T`) и динамические бейджи `#ct-pick`/`#t-pick`, корректно отслеживающие сторону выбравшей карту команды даже после смены сторон в 15-м раунде (Halftime swap).
- **Закрытие гэпа #6 (Отказоустойчивость OBS-сцены и экспорт пресетов):**
  - В `obs.rs` и `lib.rs` добавлены команды `obs_sync_browser_source` (прямое обновление/создание Browser Source в OBS Studio через obs-websocket v5) и `obs_export_scene_collection` (генерация валидного JSON коллекции сцен OBS Studio с разрешением 1920x1080, CEF 60 FPS, shutdown=false, restart_when_active=false).
  - В интерфейс `HUDs.vue` и `Config.vue` добавлены кнопки синхронизации с подключенным OBS и экспорта готового `.json` пресета сцен.
  - Написан Rust unit-тест `obs_export_scene_collection_generates_valid_json` (8/8 unit-тестов модуля OBS passed).
- **Сквозная E2E-валидация:**
  - Разработан и пройден сквозной Playwright E2E-тест `scripts/pick_decider_e2e.py` по всем 3 стилям худов:
    - Проверка первой половины: NAVI CT / FaZe T, плашка `BO3 · MAP 1 · NAVI PICK`, бейдж `PICK` на CT стороне.
    - Проверка смены сторон во второй половине: NAVI переходит за T сторону — бейдж `PICK` автоматически переходит на сторону T!
    - Проверка третьей решающей карты: плашка `BO3 · MAP 3 · DECIDER`, бейджи индивидуальных пиков корректно скрыты.
    - 100% успех на всех 3 худах.
  - Сохранены скриншоты-доказательства: `F:/anen/desktop/hud-evidence/fennec-*-verified-major-standards.png`.



