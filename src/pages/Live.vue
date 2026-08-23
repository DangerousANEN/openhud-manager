<template>
  <div class="p-6 space-y-6">
    <!-- Header -->
    <div class="flex items-center justify-between">
      <div>
        <div class="section-label">Управление матчем</div>
        <h1 class="text-2xl font-bold text-white">Live</h1>
      </div>
      <div class="flex items-center gap-3">
        <div :class="['flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-medium border',
          gsiLive
            ? 'bg-status-success/10 border-status-success/30 text-status-success'
            : 'bg-red-500/10 border-red-500/30 text-red-400']">
          <span :class="['w-1.5 h-1.5 rounded-full', gsiLive ? 'bg-status-success animate-pulse' : 'bg-red-400']"></span>
          {{ gsiLive ? 'CS2 подключён' : 'Нет данных от CS2' }}
        </div>
        <div v-if="wsConnected" class="text-[10px] text-text-muted uppercase tracking-wider">WS OK</div>
      </div>
    </div>

    <div class="grid grid-cols-3 gap-5">
      <!-- Score board -->
      <div class="col-span-2 card space-y-5">
        <div class="flex items-center justify-between">
          <span class="text-text-secondary text-sm">Текущий матч</span>
          <span v-if="activeMatch" class="badge-gold">
            {{ activeMatch.match_type.toUpperCase() }} · {{ activeMatch.left_score }}-{{ activeMatch.right_score }}
          </span>
          <span v-else class="text-xs text-text-muted">матч не выбран</span>
        </div>

        <!-- Teams score -->
        <div class="flex items-center justify-between gap-4">
          <div class="flex-1 flex items-center gap-3">
            <div class="w-12 h-12 rounded-lg bg-bg-elevated border border-bg-border flex items-center justify-center">
              <Shield :size="22" class="text-blue-400" />
            </div>
            <div>
              <div class="font-bold text-white">{{ ctName }}</div>
              <div class="text-xs text-blue-400 font-medium uppercase">CT</div>
            </div>
          </div>

          <div class="flex items-center gap-4">
            <div class="text-5xl font-black text-white tabular-nums">{{ snap?.ct_score ?? 0 }}</div>
            <div class="text-text-muted text-2xl font-light">:</div>
            <div class="text-5xl font-black text-white tabular-nums">{{ snap?.t_score ?? 0 }}</div>
          </div>

          <div class="flex-1 flex items-center gap-3 justify-end">
            <div class="text-right">
              <div class="font-bold text-white">{{ tName }}</div>
              <div class="text-xs text-orange-400 font-medium uppercase">T</div>
            </div>
            <div class="w-12 h-12 rounded-lg bg-bg-elevated border border-bg-border flex items-center justify-center">
              <Crosshair :size="22" class="text-orange-400" />
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
          <button @click="reverseSides" class="btn-outline flex items-center justify-center gap-2">
            <ArrowLeftRight :size="14" /> Сменить стороны
          </button>
          <button @click="pushScore" class="btn-outline flex items-center justify-center gap-2">
            <Save :size="14" /> Счёт → в матч
          </button>
          <button @click="copyOverlayUrl" class="btn-outline flex items-center justify-center gap-2">
            <Copy :size="14" /> {{ copied ? 'Скопировано' : 'URL оверлея' }}
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
        <div class="section-label">Состав</div>
        <div class="text-xs text-text-muted">{{ snap?.players.length ?? 0 }} игроков в игре</div>
      </div>

      <div v-if="!snap || snap.players.length === 0"
        class="text-center py-10 text-text-muted text-sm">
        Нет данных от CS2. Импортируйте GSI-конфиг в разделе Настройки и запустите игру.
      </div>

      <div v-else class="grid grid-cols-5 gap-3">
        <div v-for="p in snap.players" :key="p.steamid"
          class="bg-bg-elevated border border-bg-border rounded-lg p-3 space-y-2">
          <div class="flex items-center gap-2">
            <div class="w-8 h-8 rounded-full bg-bg-base border border-bg-border flex items-center justify-center">
              <User :size="14" class="text-text-muted" />
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
            <div><div class="text-white font-bold text-sm">{{ p.kills }}</div><div class="text-text-muted text-[10px]">K</div></div>
            <div><div class="text-white font-bold text-sm">{{ p.deaths }}</div><div class="text-text-muted text-[10px]">D</div></div>
            <div><div class="text-white font-bold text-sm">{{ p.assists }}</div><div class="text-text-muted text-[10px]">A</div></div>
            <div><div class="text-gold font-bold text-sm">{{ p.money }}</div><div class="text-text-muted text-[10px]">$</div></div>
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
  BarChart2, Scale, MapPin, Medal, Trophy, Film, User, Save, Copy
} from 'lucide-vue-next'
import {
  useGsiFeed, gsi, matches, overlay, isDesktop,
  type Match, type GsiStatus,
} from '../api'

const { snapshot: snap, connected: wsConnected, stop } = useGsiFeed()

const status = ref<GsiStatus | null>(null)
const activeMatch = ref<Match | null>(null)
const activeOverlays = ref<string[]>([])
const copied = ref(false)

/** GSI is "live" when CS2 posted something in the last 10s. */
const gsiLive = computed(() => status.value?.connected ?? false)

const ctName = computed(() => snap.value?.ct_name?.trim() || 'CT')
const tName = computed(() => snap.value?.t_name?.trim() || 'T')

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

/** Swap the stored match score (used after CS2 side switch). */
const reverseSides = async () => {
  if (!activeMatch.value || !isDesktop) return
  const m = activeMatch.value
  const swapped: Match = { ...m, left_score: m.right_score, right_score: m.left_score }
  activeMatch.value = await matches.save(swapped)
  await overlay.broadcast('sides_reversed', { match_id: m.id })
}

/** Persist the live CS2 score onto the current match record. */
const pushScore = async () => {
  if (!activeMatch.value || !snap.value || !isDesktop) return
  activeMatch.value = await matches.save({
    ...activeMatch.value,
    left_score: snap.value.ct_score,
    right_score: snap.value.t_score,
  })
}

const copyOverlayUrl = async () => {
  const url = status.value?.overlay_url ?? 'http://127.0.0.1:1349/overlay/'
  try {
    await navigator.clipboard.writeText(url)
    copied.value = true
    setTimeout(() => (copied.value = false), 1500)
  } catch {
    /* clipboard blocked — ignore */
  }
}

let poll: number | undefined

onMounted(async () => {
  if (!isDesktop) return
  try {
    status.value = await gsi.status()
    activeMatch.value = await matches.current()
  } catch (e) {
    console.error('live init failed', e)
  }
  // Status is cheap; poll it so the connection badge stays honest.
  poll = window.setInterval(async () => {
    try {
      status.value = await gsi.status()
    } catch { /* backend restarting */ }
  }, 2000)
})

onUnmounted(() => {
  if (poll) clearInterval(poll)
  stop()
})
</script>
