// Bridge between the Vue UI and the Rust backend (Tauri commands + live WS feed).
import { invoke } from '@tauri-apps/api/core'
import { ref, type Ref } from 'vue'

export interface Team {
  id: string
  name: string
  short_name: string
  country: string
  logo: string
}

export interface Player {
  id: string
  steamid: string
  nickname: string
  first_name: string
  last_name: string
  country: string
  team_id: string | null
  avatar: string
}

export interface Match {
  id: string
  left_team_id: string | null
  right_team_id: string | null
  left_score: number
  right_score: number
  match_type: string
  current: boolean
}

export interface Sponsor {
  id: string
  name: string
  image: string
  url: string
  weight: number
  active: boolean
}

export interface Tournament {
  id: string
  name: string
  logo: string
  entry_fee: number
  prize_pool: number
}

export interface PlayerSnap {
  steamid: string
  name: string
  team: string
  health: number
  armor: number
  money: number
  kills: number
  deaths: number
  assists: number
  adr: number
  observer_slot: number
}

export interface GsiSnapshot {
  map: string
  phase: string
  round: number
  ct_score: number
  t_score: number
  ct_name: string
  t_name: string
  bomb: string
  round_time: string
  players: PlayerSnap[]
  updated_at: string
}

export interface GsiStatus {
  connected: boolean
  seconds_since_update: number | null
  listeners: number
  port: number
  gsi_url: string
  overlay_url: string
}

/** True when running inside the Tauri shell (false in a plain browser tab). */
export const isDesktop = typeof window !== 'undefined' && '__TAURI_INTERNALS__' in window

export const teams = {
  list: () => invoke<Team[]>('teams_list'),
  save: (team: Partial<Team>) => invoke<Team>('teams_save', { team }),
  remove: (id: string) => invoke<void>('teams_delete', { id }),
}

export const players = {
  list: () => invoke<Player[]>('players_list'),
  save: (player: Partial<Player>) => invoke<Player>('players_save', { player }),
  remove: (id: string) => invoke<void>('players_delete', { id }),
}

export const matches = {
  list: () => invoke<Match[]>('matches_list'),
  // The Rust arg is `match_`; Tauri exposes it to JS as camelCase `match`.
  save: (m: Partial<Match>) => invoke<Match>('matches_save', { match: m }),
  remove: (id: string) => invoke<void>('matches_delete', { id }),
  current: () => invoke<Match | null>('matches_current'),
}

export const sponsors = {
  list: () => invoke<Sponsor[]>('sponsors_list'),
  save: (sponsor: Partial<Sponsor>) => invoke<Sponsor>('sponsors_save', { sponsor }),
  remove: (id: string) => invoke<void>('sponsors_delete', { id }),
}

export const tournaments = {
  list: () => invoke<Tournament[]>('tournaments_list'),
  save: (tournament: Partial<Tournament>) =>
    invoke<Tournament>('tournaments_save', { tournament }),
  remove: (id: string) => invoke<void>('tournaments_delete', { id }),
}

export const settings = {
  get: (key: string) => invoke<string | null>('setting_get', { key }),
  set: (key: string, value: string) => invoke<void>('setting_set', { key, value }),
}

export const gsi = {
  snapshot: () => invoke<GsiSnapshot>('gsi_snapshot'),
  status: () => invoke<GsiStatus>('gsi_status'),
  /** Contents of gamestate_integration_openhud.cfg for the CS2 cfg folder. */
  cfgText: () => invoke<string>('gsi_cfg_text'),
  /** Write the cfg into the discovered (or provided) CS2 cfg folder. */
  cfgInstall: (cs2CfgPath?: string | null) =>
    invoke<string>('gsi_cfg_install', { cs2_cfg_path: cs2CfgPath ?? null }),
  /** Probe whether the CS2 cfg folder is discoverable. */
  cfgProbe: () => invoke<{ found: boolean; path: string }>('gsi_cfg_probe'),
}

export const overlay = {
  broadcast: (kind: string, data: unknown = {}) =>
    invoke<void>('overlay_broadcast', { kind, data }),
  path: () => invoke<string>('overlays_path'),
}

export interface HudPack {
  id: string
  name: string
  path: string
  url_path: string
  has_index: boolean
}

export interface HudImportResult {
  id: string
  name: string
  files: number
  has_index: boolean
  message: string
}

export const huds = {
  list: () => invoke<HudPack[]>('huds_list'),
  /** Распаковать ZIP-пак в папку оверлеев. Только десктоп. */
  import: (zipPath: string, name?: string) =>
    invoke<HudImportResult>('huds_import', { zip_path: zipPath, name: name ?? null }),
  /** Удалить пак вместе с папкой. Только десктоп. */
  remove: (id: string) => invoke<string>('huds_delete', { id }),
}

// ---------- OBS Studio (obs-websocket v5) ----------

export interface ObsStatus {
  connected: boolean
  obs_version?: string | null
  websocket_version?: string | null
  current_scene?: string | null
  streaming: boolean
  recording: boolean
  message: string
}

export interface ObsScene {
  name: string
  index: number
}

const OBS_OFFLINE: ObsStatus = {
  connected: false,
  obs_version: null,
  websocket_version: null,
  current_scene: null,
  streaming: false,
  recording: false,
  message: 'Управление OBS доступно только в десктоп-версии',
}

export const obs = {
  /** Никогда не бросает: возвращает connected=false с текстом причины. */
  status: async (): Promise<ObsStatus> => {
    if (!isDesktop) return { ...OBS_OFFLINE }
    try {
      return await invoke<ObsStatus>('obs_status')
    } catch (e) {
      return { ...OBS_OFFLINE, message: String(e) }
    }
  },
  scenes: async (): Promise<ObsScene[]> => {
    if (!isDesktop) return []
    try {
      return await invoke<ObsScene[]>('obs_scenes')
    } catch {
      return []
    }
  },
  setScene: (sceneName: string) => invoke<string>('obs_set_scene', { scene_name: sceneName }),
  toggleStream: () => invoke<boolean>('obs_toggle_stream'),
  toggleRecord: () => invoke<boolean>('obs_toggle_record'),
  saveReplay: () => invoke<string>('obs_save_replay'),
  setSourceVisible: (sceneName: string, sourceName: string, visible: boolean) =>
    invoke<string>('obs_set_source_visible', {
      scene_name: sceneName,
      source_name: sourceName,
      visible,
    }),
}

export interface HudLayoutMeta {
  id: string
  name: string
  created_at?: string | null
  updated_at?: string | null
}

export interface HudLayout {
  id: string
  name: string
  data: string
  created_at?: string | null
  updated_at?: string | null
}

const LOCAL_STORAGE_HUD_KEY = 'openhud_hud_layouts'

interface LocalStorageHudEntry {
  id: string
  name: string
  updatedAt?: string
  updated_at?: string
  created_at?: string
  blocks?: unknown
  data?: string
}

function getLocalHudLayouts(): LocalStorageHudEntry[] {
  try {
    const raw = localStorage.getItem(LOCAL_STORAGE_HUD_KEY)
    return raw ? JSON.parse(raw) : []
  } catch {
    return []
  }
}

function setLocalHudLayouts(list: LocalStorageHudEntry[]) {
  try {
    localStorage.setItem(LOCAL_STORAGE_HUD_KEY, JSON.stringify(list))
  } catch {
    /* ignore */
  }
}

export const hudLayouts = {
  list: async (): Promise<HudLayoutMeta[]> => {
    if (isDesktop) {
      return await invoke<HudLayoutMeta[]>('list_hud_layouts')
    }
    const local = getLocalHudLayouts()
    return local.map(l => ({
      id: l.id,
      name: l.name,
      updated_at: l.updated_at || l.updatedAt,
      created_at: l.created_at,
    }))
  },
  load: async (id: string): Promise<HudLayout | null> => {
    if (isDesktop) {
      return await invoke<HudLayout | null>('load_hud_layout', { id })
    }
    const local = getLocalHudLayouts()
    const found = local.find(l => l.id === id)
    if (!found) return null
    const dataStr = typeof found.data === 'string' ? found.data : JSON.stringify(found.blocks || [])
    return {
      id: found.id,
      name: found.name,
      data: dataStr,
      updated_at: found.updated_at || found.updatedAt,
      created_at: found.created_at,
    }
  },
  save: async (layout: Partial<HudLayout>): Promise<HudLayout> => {
    if (isDesktop) {
      return await invoke<HudLayout>('save_hud_layout', { layout })
    }
    const local = getLocalHudLayouts()
    const id = layout.id || `layout_${Date.now()}`
    const now = new Date().toLocaleString('ru-RU')
    const saved: LocalStorageHudEntry = {
      id,
      name: layout.name || 'Безымянный макет',
      data: layout.data || '[]',
      updated_at: now,
      created_at: now,
    }
    const idx = local.findIndex(l => l.id === id)
    if (idx >= 0) {
      local[idx] = saved
    } else {
      local.unshift(saved)
    }
    setLocalHudLayouts(local)
    return {
      id: saved.id,
      name: saved.name,
      data: saved.data || '[]',
      updated_at: saved.updated_at,
      created_at: saved.created_at,
    }
  },
  remove: async (id: string): Promise<void> => {
    if (isDesktop) {
      return await invoke<void>('delete_hud_layout', { id })
    }
    const local = getLocalHudLayouts()
    const filtered = local.filter(l => l.id !== id)
    setLocalHudLayouts(filtered)
  },
}

export const dbLocation = () => invoke<string>('db_location')

/** Native file dialogs; resolve to null when the user cancels. */
export const pickFile = (title: string) => invoke<string | null>('pick_file', { title })
export const pickSaveFile = (title: string, defaultName: string) =>
  invoke<string | null>('pick_save_file', { title, default_name: defaultName })

/** SQLite snapshot export / restore via VACUUM INTO + copy-back. */
export const dbExport = (dest: string) => invoke<string>('db_export', { dest })
export const dbImport = (src: string) => invoke<string>('db_import', { src })

/**
 * Subscribe to the backend WebSocket. Auto-reconnects every 2s while closed.
 * Returns the reactive snapshot, a connected flag, and a stop() to tear down.
 */
export function useGsiFeed(port = 1349): {
  snapshot: Ref<GsiSnapshot | null>
  connected: Ref<boolean>
  stop: () => void
} {
  const snapshot = ref<GsiSnapshot | null>(null)
  const connected = ref(false)

  let socket: WebSocket | null = null
  let timer: number | undefined
  let disposed = false

  const connect = () => {
    if (disposed) return
    socket = new WebSocket(`ws://127.0.0.1:${port}/ws`)

    socket.onopen = () => {
      connected.value = true
    }

    socket.onmessage = (ev) => {
      try {
        const parsed = JSON.parse(ev.data)
        // Control events arrive as { type, data }; game state has a `map` field.
        if (parsed && typeof parsed === 'object' && 'players' in parsed) {
          snapshot.value = parsed as GsiSnapshot
        }
      } catch {
        /* ignore malformed frames */
      }
    }

    socket.onclose = () => {
      connected.value = false
      socket = null
      if (!disposed) timer = window.setTimeout(connect, 2000)
    }

    socket.onerror = () => socket?.close()
  }

  // The backend may have moved off the default port (busy-port fallback),
  // so ask it for the real one before opening the socket.
  if (isDesktop) {
    gsi.status()
      .then((st) => {
        if (disposed) return
        if (st?.port && st.port !== port) {
          port = st.port
          if (timer) clearTimeout(timer)
          connect()
        }
      })
      .catch(() => {/* keep default */})
  }
  connect()

  return {
    snapshot,
    connected,
    stop: () => {
      disposed = true
      if (timer) clearTimeout(timer)
      socket?.close()
    },
  }
}
