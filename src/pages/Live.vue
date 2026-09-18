<template>
  <div class="p-6 space-y-6">
    <!-- Header -->
    <div class="flex items-center justify-between">
      <div>
        <div class="section-label">Управление матчем</div>
        <h1 class="text-2xl font-bold text-white">Live</h1>
      </div>
      <div class="flex items-center gap-3">
        <!-- In-Game Overlay Button -->
        <button v-if="isDesktop" @click="toggleGameOverlay"
          :class="['px-3 py-1.5 rounded-full text-xs font-semibold flex items-center gap-2 transition-all border shadow cursor-pointer',
            overlayActive 
              ? 'bg-status-success text-black font-bold border-status-success hover:bg-status-success/90' 
              : 'bg-gold/10 border-gold/40 text-gold hover:bg-gold/20']">
          <span :class="['w-2 h-2 rounded-full', overlayActive ? 'bg-black animate-ping' : 'bg-gold']"></span>
          {{ overlayActive ? 'Выключить худ поверх игры (F10)' : 'Включить худ поверх игры (F10)' }}
        </button>

        <!-- CS2 connection indicator -->
        <div :class="['flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-medium border',
          gsiLive
            ? 'bg-status-success/10 border-status-success/30 text-status-success'
            : 'bg-red-500/10 border-red-500/30 text-red-400']">
          <span :class="['w-1.5 h-1.5 rounded-full', gsiLive ? 'bg-status-success animate-pulse' : 'bg-red-400']"></span>
          {{ gsiLive ? 'CS2 на связи' : 'Нет данных от CS2' }}
        </div>
        <div v-if="wsConnected" class="text-[10px] text-text-muted uppercase tracking-wider font-mono">WS OK</div>
      </div>
    </div>

    <!-- Quick Stream & HUD Links Bar -->
    <div class="card bg-bg-card/70 border-bg-border p-3.5 flex items-center justify-between flex-wrap gap-3">
      <div class="flex items-center gap-3">
        <Radio :size="16" class="text-gold" />
        <div class="text-xs">
          <span class="text-text-muted">Активный стрим HUD: </span>
          <code class="text-white font-mono bg-bg-base px-2 py-0.5 rounded border border-bg-border">{{ activeHudUrl }}</code>
        </div>
      </div>

      <div class="flex items-center gap-2">
        <button @click="copyUrl(localHudUrl)" 
          class="btn-outline text-xs py-1 px-2.5 flex items-center gap-1.5"
          :title="localHudUrl">
          <Copy :size="12" /> {{ copiedType === 'local' ? 'Скопировано!' : 'Копировать Local URL' }}
        </button>
        <button v-if="lanHudUrl" @click="copyUrl(lanHudUrl)" 
          class="btn-outline text-xs py-1 px-2.5 flex items-center gap-1.5 text-gold border-gold/40 hover:bg-gold/10"
          :title="lanHudUrl">
          <Wifi :size="12" /> {{ copiedType === 'lan' ? 'Скопировано!' : `LAN URL (${status?.lan_ip})` }}
        </button>
        <button @click="openInBrowser" class="btn-outline text-xs py-1 px-2.5 flex items-center gap-1.5">
          <ExternalLink :size="12" /> Открыть в браузере
        </button>
      </div>
    </div>

    <div class="grid grid-cols-3 gap-5">
      <!-- Score board & Team management -->
      <div class="col-span-2 card space-y-5">
        <div class="flex items-center justify-between">
          <div class="flex items-center gap-2">
            <span class="text-text-secondary text-sm">Текущий матч</span>
            <button @click="isEditingTeams = !isEditingTeams" 
              class="px-2 py-0.5 rounded text-[11px] font-medium border border-gold/40 text-gold hover:bg-gold/10 flex items-center gap-1">
              <Edit3 :size="11" /> {{ isEditingTeams ? 'Скрыть редактор' : 'Редактировать команды' }}
            </button>
          </div>
          <div class="flex items-center gap-2">
            <span v-if="activeMatch" class="badge-gold font-bold">
              {{ activeMatch.match_type.toUpperCase() }} · Серия {{ activeMatch.left_score }}:{{ activeMatch.right_score }}
            </span>
            <span v-else class="text-xs text-text-muted">матч не выбран</span>
          </div>
        </div>

        <!-- Inline Live Team Editor Panel -->
        <div v-if="isEditingTeams" class="bg-bg-elevated border border-gold/30 rounded-lg p-4 space-y-3">
          <div class="flex items-center justify-between">
            <span class="text-xs font-bold text-white uppercase tracking-wider">Быстрое редактирование команд в Live</span>
            <span class="text-[11px] text-text-muted">Изменения мгновенно улетают в HUD по WebSocket</span>
          </div>

          <div class="grid grid-cols-2 gap-4">
            <!-- Left team (CT) -->
            <div class="space-y-2">
              <label class="text-[11px] text-blue-400 font-semibold uppercase flex items-center gap-1">
                <Shield :size="12" /> Левая сторона (CT в игре)
              </label>
              <div class="flex gap-2">
                <select v-model="selectedLeftTeamId" @change="onSelectLeftTeam" class="input-field text-xs py-1.5 flex-1">
                  <option value="">— Выбрать из списка —</option>
                  <option v-for="t in allTeams" :key="t.id" :value="t.id">{{ t.name }} ({{ t.short_name }})</option>
                </select>
              </div>
              <input v-model="customLeftName" placeholder="Кастомное имя команды" class="input-field text-xs py-1.5" />
            </div>

            <!-- Right team (T) -->
            <div class="space-y-2">
              <label class="text-[11px] text-orange-400 font-semibold uppercase flex items-center gap-1">
                <Crosshair :size="12" /> Правая сторона (T в игре)
              </label>
              <div class="flex gap-2">
                <select v-model="selectedRightTeamId" @change="onSelectRightTeam" class="input-field text-xs py-1.5 flex-1">
                  <option value="">— Выбрать из списка —</option>
                  <option v-for="t in allTeams" :key="t.id" :value="t.id">{{ t.name }} ({{ t.short_name }})</option>
                </select>
              </div>
              <input v-model="customRightName" placeholder="Кастомное имя команды" class="input-field text-xs py-1.5" />
            </div>
          </div>

          <!-- Series format and scores -->
          <div class="flex items-center justify-between pt-2 border-t border-bg-border">
            <div class="flex items-center gap-3">
              <span class="text-xs text-text-secondary">Формат:</span>
              <div class="flex gap-1">
                <button v-for="ft in ['bo1', 'bo3', 'bo5']" :key="ft"
                  @click="editMatchType = ft"
                  :class="['px-2.5 py-1 rounded text-xs font-semibold uppercase border transition-all',
                    editMatchType === ft ? 'bg-gold text-black border-gold' : 'border-bg-border text-text-secondary hover:text-white']">
                  {{ ft }}
                </button>
              </div>
            </div>

            <div class="flex items-center gap-4">
              <span class="text-xs text-text-secondary">Счет по картам:</span>
              <div class="flex items-center gap-1">
                <button @click="editLeftScore = Math.max(0, editLeftScore - 1)" class="score-btn">−</button>
                <span class="w-6 text-center font-bold text-white text-sm tabular-nums">{{ editLeftScore }}</span>
                <button @click="editLeftScore++" class="score-btn">+</button>
              </div>
              <span class="text-text-muted">:</span>
              <div class="flex items-center gap-1">
                <button @click="editRightScore = Math.max(0, editRightScore - 1)" class="score-btn">−</button>
                <span class="w-6 text-center font-bold text-white text-sm tabular-nums">{{ editRightScore }}</span>
                <button @click="editRightScore++" class="score-btn">+</button>
              </div>
            </div>

            <button @click="saveLiveTeams" class="btn-gold text-xs py-1.5 px-4 flex items-center gap-1.5 shadow">
              <Check :size="13" /> Применить в HUD
            </button>
          </div>
        </div>

        <!-- Teams score display -->
        <div class="flex items-center justify-between gap-4">
          <div class="flex-1 flex items-center gap-3">
            <div class="w-12 h-12 rounded-lg bg-bg-elevated border border-bg-border flex items-center justify-center overflow-hidden">
              <img v-if="leftTeamLogo" :src="leftTeamLogo" alt="" class="w-full h-full object-contain p-1" />
              <Shield v-else :size="22" class="text-blue-400" />
            </div>
            <div>
              <div class="font-bold text-white text-base">{{ displayCtName }}</div>
              <div class="text-xs text-blue-400 font-semibold uppercase tracking-wider">CT</div>
            </div>
          </div>

          <div class="flex items-center gap-4">
            <div class="text-5xl font-black text-white tabular-nums">{{ snap?.ct_score ?? 0 }}</div>
            <div class="text-text-muted text-2xl font-light">:</div>
            <div class="text-5xl font-black text-white tabular-nums">{{ snap?.t_score ?? 0 }}</div>
          </div>

          <div class="flex-1 flex items-center gap-3 justify-end">
            <div class="text-right">
              <div class="font-bold text-white text-base">{{ displayTName }}</div>
              <div class="text-xs text-orange-400 font-semibold uppercase tracking-wider">T</div>
            </div>
            <div class="w-12 h-12 rounded-lg bg-bg-elevated border border-bg-border flex items-center justify-center overflow-hidden">
              <img v-if="rightTeamLogo" :src="rightTeamLogo" alt="" class="w-full h-full object-contain p-1" />
              <Crosshair v-else :size="22" class="text-orange-400" />
            </div>
          </div>
        </div>

        <!-- Round info -->
        <div class="flex items-center gap-4 bg-bg-elevated rounded-lg p-3 flex-wrap">
          <Hash :size="14" class="text-text-muted" />
          <div class="text-sm text-text-secondary">Раунд:</div>
          <div class="text-white font-semibold">{{ (snap?.round ?? 0) + 1 }}</div>

          <div class="w-px h-4 bg-bg-border"></div>
          <Timer :size="14" class="text-text-muted" />
          <div class="text-white font-semibold tabular-nums">{{ roundClock }}</div>

          <div v-if="snap?.bomb" class="flex items-center gap-1.5">
            <div class="w-px h-4 bg-bg-border"></div>
            <Bomb :size="14" :class="bombClass" />
            <span :class="['text-xs font-semibold uppercase', bombClass]">{{ bombLabel }}</span>
          </div>

          <div class="flex-1"></div>
          <MapIcon :size="14" class="text-text-muted" />
          <div class="text-gold font-medium">{{ snap?.map || '—' }}</div>
          <span class="text-[10px] text-text-muted uppercase px-1.5 py-0.5 rounded bg-bg-base">
            {{ snap?.phase || 'idle' }}
          </span>
        </div>

        <!-- Controls -->
        <div class="grid grid-cols-3 gap-2">
          <button @click="reverseSides" class="btn-outline flex items-center justify-center gap-2 text-xs py-2">
            <ArrowLeftRight :size="14" /> Сменить стороны (CT ↔ T)
          </button>
          <button @click="pushScore" class="btn-outline flex items-center justify-center gap-2 text-xs py-2">
            <Save :size="14" /> Счёт CS2 → в матч
          </button>
          <button @click="copyUrl(activeHudUrl)" class="btn-outline flex items-center justify-center gap-2 text-xs py-2">
            <Copy :size="14" /> {{ copiedType === 'active' ? 'Скопировано!' : 'Скопировать HUD URL' }}
          </button>
        </div>
      </div>

      <!-- Quick overlays -->
      <div class="card space-y-3">
        <div class="section-label">Быстрые оверлеи</div>
        <button v-for="ov in quickOverlays" :key="ov.id"
          @click="toggleOverlay(ov.id)"
          :class="['w-full flex items-center gap-3 px-3 py-2.5 rounded-lg border text-sm transition-all',
            activeOverlays.includes(ov.id)
              ? 'bg-gold/10 border-gold/40 text-gold'
              : 'border-bg-border text-text-secondary hover:border-bg-border/80 hover:text-white']">
          <component :is="ov.icon" :size="15" />
          <span class="flex-1 text-left">{{ ov.label }}</span>
          <span v-if="activeOverlays.includes(ov.id)"
            class="text-[10px] bg-gold/20 text-gold px-1.5 py-0.5 rounded font-medium">ON</span>
        </button>
      </div>
    </div>

    <!-- Players -->
    <div class="card">
      <div class="flex items-center justify-between mb-4">
        <div class="section-label mb-0">Игроки на сервере</div>
        <div class="text-xs text-text-muted">{{ snap?.players.length ?? 0 }} игроков в игре</div>
      </div>

      <div v-if="!snap || snap.players.length === 0"
        class="text-center py-10 text-text-muted text-sm">
        Нет данных от CS2. Убедитесь, что игра запущена и GSI-конфиг установлен.
      </div>

      <div v-else class="grid grid-cols-5 gap-3">
        <div v-for="p in snap.players" :key="p.steamid"
          :class="['bg-bg-elevated border rounded-lg p-3 space-y-2 transition-all',
            p.steamid === snap.focused_steamid ? 'border-gold shadow-lg shadow-gold/5' : 'border-bg-border']">
          <div class="flex items-center gap-2">
            <div class="w-8 h-8 rounded-full bg-bg-base border border-bg-border flex items-center justify-center text-xs font-bold text-gold">
              {{ p.observer_slot != null ? (p.observer_slot === 9 ? '0' : p.observer_slot + 1) : '•' }}
            </div>
            <div class="min-w-0 flex-1">
              <div class="text-white text-xs font-semibold truncate">{{ p.name }}</div>
              <div :class="['text-[10px] font-medium uppercase', p.team === 'CT' ? 'text-blue-400' : 'text-orange-400']">
                {{ p.team || '—' }}
              </div>
            </div>
          </div>

          <!-- HP bar -->
          <div class="h-1 rounded-full bg-bg-base overflow-hidden">
            <div class="h-full transition-all"
              :class="p.health > 50 ? 'bg-status-success' : p.health > 20 ? 'bg-gold' : 'bg-brand-red'"
              :style="{ width: p.health + '%' }"></div>
          </div>

          <div class="grid grid-cols-4 gap-1 text-center">
            <div><div class="text-white font-bold text-xs">{{ p.kills }}</div><div class="text-text-muted text-[9px]">K</div></div>
            <div><div class="text-white font-bold text-xs">{{ p.deaths }}</div><div class="text-text-muted text-[9px]">D</div></div>
            <div><div class="text-white font-bold text-xs">{{ p.assists }}</div><div class="text-text-muted text-[9px]">A</div></div>
            <div><div class="text-gold font-bold text-xs">{{ p.money }}</div><div class="text-text-muted text-[9px]">$</div></div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, markRaw, onMounted, onUnmounted } from 'vue'
import {
  Shield, Crosshair, Hash, Map as MapIcon, ArrowLeftRight, Timer, Bomb,
  BarChart2, Scale, MapPin, Medal, Trophy, Film, Save, Copy,
  Edit3, Check, Radio, Wifi, ExternalLink
} from 'lucide-vue-next'
import {
  useGsiFeed, gsi, matches, teams, overlay, operatorOverlay, isDesktop,
  type Match, type Team, type GsiStatus,
} from '../api'
import { listen, type UnlistenFn } from '@tauri-apps/api/event'

const { snapshot: snap, connected: wsConnected, stop } = useGsiFeed()

const status = ref<GsiStatus | null>(null)
const activeMatch = ref<Match | null>(null)
const allTeams = ref<Team[]>([])
const activeOverlays = ref<string[]>([])
const overlayActive = ref(false)
const copiedType = ref<string | null>(null)

// Live team editor state
const isEditingTeams = ref(false)
const selectedLeftTeamId = ref('')
const selectedRightTeamId = ref('')
const customLeftName = ref('')
const customRightName = ref('')
const editMatchType = ref('bo3')
const editLeftScore = ref(0)
const editRightScore = ref(0)

const gsiLive = computed(() => status.value?.connected ?? false)

const localHudUrl = computed(() => {
  const port = status.value?.port || 1349
  return `http://127.0.0.1:${port}/hud/`
})

const lanHudUrl = computed(() => {
  if (status.value?.lan_overlay_url) return status.value.lan_overlay_url
  if (status.value?.lan_ip) return `http://${status.value.lan_ip}:${status.value.port || 1349}/hud/`
  return ''
})

const activeHudUrl = computed(() => lanHudUrl.value || localHudUrl.value)

const leftTeam = computed(() => allTeams.value.find(t => t.id === activeMatch.value?.left_team_id))
const rightTeam = computed(() => allTeams.value.find(t => t.id === activeMatch.value?.right_team_id))

const displayCtName = computed(() => {
  return snap.value?.ct_name?.trim() || leftTeam.value?.name || activeMatch.value?.left_team_id || 'CT'
})

const displayTName = computed(() => {
  return snap.value?.t_name?.trim() || rightTeam.value?.name || activeMatch.value?.right_team_id || 'T'
})

const leftTeamLogo = computed(() => leftTeam.value?.logo || '')
const rightTeamLogo = computed(() => rightTeam.value?.logo || '')

const roundClock = computed(() => {
  const raw = parseFloat(snap.value?.round_time ?? '')
  if (Number.isNaN(raw)) return '--:--'
  const total = Math.max(0, Math.round(raw))
  return `${Math.floor(total / 60)}:${String(total % 60).padStart(2, '0')}`
})

const bombLabel = computed(() => {
  switch (snap.value?.bomb) {
    case 'planted': return 'заложена'
    case 'defused': return 'разряжена'
    case 'exploded': return 'взрыв'
    case 'carried': return 'у игрока'
    case 'dropped': return 'на земле'
    default: return snap.value?.bomb ?? ''
  }
})

const bombClass = computed(() =>
  snap.value?.bomb === 'planted' ? 'text-brand-red' : 'text-text-secondary'
)

const quickOverlays = [
  { id: 'player_stats', icon: markRaw(BarChart2), label: 'Статистика игрока' },
  { id: 'team_compare', icon: markRaw(Scale), label: 'Сравнение команд' },
  { id: 'veto', icon: markRaw(MapPin), label: 'Вето карт' },
  { id: 'round_winner', icon: markRaw(Medal), label: 'Победитель раунда' },
  { id: 'match_winner', icon: markRaw(Trophy), label: 'Победитель матча' },
  { id: 'replay', icon: markRaw(Film), label: 'Реплей' },
]

const toggleGameOverlay = async () => {
  if (!isDesktop) return
  try {
    overlayActive.value = await operatorOverlay.toggle(localHudUrl.value)
  } catch (e) {
    console.error('Failed to toggle game overlay', e)
  }
}

const copyUrl = async (url: string) => {
  if (!url) return
  try {
    await navigator.clipboard.writeText(url)
    if (url === lanHudUrl.value) copiedType.value = 'lan'
    else if (url === localHudUrl.value) copiedType.value = 'local'
    else copiedType.value = 'active'
    setTimeout(() => (copiedType.value = null), 2000)
  } catch { /* ignore */ }
}

const openInBrowser = () => {
  window.open(localHudUrl.value, '_blank')
}

const onSelectLeftTeam = () => {
  const t = allTeams.value.find(team => team.id === selectedLeftTeamId.value)
  if (t) customLeftName.value = t.name
}

const onSelectRightTeam = () => {
  const t = allTeams.value.find(team => team.id === selectedRightTeamId.value)
  if (t) customRightName.value = t.name
}

const saveLiveTeams = async () => {
  if (!isDesktop) return
  try {
    let m = activeMatch.value
    if (!m) {
      m = {
        id: `match_${Date.now()}`,
        match_type: editMatchType.value,
        left_team_id: selectedLeftTeamId.value || null,
        right_team_id: selectedRightTeamId.value || null,
        left_score: editLeftScore.value,
        right_score: editRightScore.value,
        vetos: '[]',
        current: true,
      }
    } else {
      m = {
        ...m,
        match_type: editMatchType.value,
        left_team_id: selectedLeftTeamId.value || m.left_team_id,
        right_team_id: selectedRightTeamId.value || m.right_team_id,
        left_score: editLeftScore.value,
        right_score: editRightScore.value,
        current: true,
      }
    }

    // Also update/create teams if custom names entered and no team selected
    if (customLeftName.value && !selectedLeftTeamId.value) {
      const newLeft = await teams.save({
        id: `team_${Date.now()}_l`,
        name: customLeftName.value,
        short_name: customLeftName.value.substring(0, 4).toUpperCase(),
        country: 'RU',
        logo: '',
      })
      m.left_team_id = newLeft.id
    }
    if (customRightName.value && !selectedRightTeamId.value) {
      const newRight = await teams.save({
        id: `team_${Date.now()}_r`,
        name: customRightName.value,
        short_name: customRightName.value.substring(0, 4).toUpperCase(),
        country: 'RU',
        logo: '',
      })
      m.right_team_id = newRight.id
    }

    activeMatch.value = await matches.save(m)
    allTeams.value = await teams.list()
    isEditingTeams.value = false
  } catch (e) {
    console.error('Failed to save live teams', e)
  }
}

const toggleOverlay = async (id: string) => {
  const idx = activeOverlays.value.indexOf(id)
  const on = idx < 0
  if (on) activeOverlays.value.push(id)
  else activeOverlays.value.splice(idx, 1)

  if (!isDesktop) return
  try {
    await overlay.broadcast('overlay_toggle', { id, active: on })
  } catch (e) {
    console.error('overlay broadcast failed', e)
  }
}

const reverseSides = async () => {
  if (!activeMatch.value || !isDesktop) return
  const m = activeMatch.value
  const swapped: Match = { 
    ...m, 
    left_team_id: m.right_team_id,
    right_team_id: m.left_team_id,
    left_score: m.right_score, 
    right_score: m.left_score 
  }
  activeMatch.value = await matches.save(swapped)
  await overlay.broadcast('sides_reversed', { match_id: m.id })
}

const pushScore = async () => {
  if (!activeMatch.value || !snap.value || !isDesktop) return
  activeMatch.value = await matches.save({
    ...activeMatch.value,
    left_score: snap.value.ct_score,
    right_score: snap.value.t_score,
  })
}

let poll: number | undefined
let unlistenOverlay: UnlistenFn | null = null

onMounted(async () => {
  if (!isDesktop) return
  try {
    status.value = await gsi.status()
    overlayActive.value = await operatorOverlay.status()
    allTeams.value = await teams.list()
    activeMatch.value = await matches.current()

    try {
      unlistenOverlay = await listen<boolean>('overlay_status_changed', (event) => {
        overlayActive.value = event.payload
      })
    } catch (_) {}

    if (activeMatch.value) {
      selectedLeftTeamId.value = activeMatch.value.left_team_id || ''
      selectedRightTeamId.value = activeMatch.value.right_team_id || ''
      editMatchType.value = activeMatch.value.match_type || 'bo3'
      editLeftScore.value = activeMatch.value.left_score || 0
      editRightScore.value = activeMatch.value.right_score || 0
      customLeftName.value = leftTeam.value?.name || ''
      customRightName.value = rightTeam.value?.name || ''
    }
  } catch (e) {
    console.error('live init failed', e)
  }

  poll = window.setInterval(async () => {
    try {
      status.value = await gsi.status()
      overlayActive.value = await operatorOverlay.status()
    } catch { /* backend restarting */ }
  }, 2000)
})

onUnmounted(() => {
  stop()
  if (poll) clearInterval(poll)
  if (unlistenOverlay) unlistenOverlay()
})
</script>