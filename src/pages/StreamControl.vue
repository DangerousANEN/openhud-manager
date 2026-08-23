<template>
  <div class="p-6 space-y-6">
    <div class="flex items-center justify-between">
      <div>
        <div class="section-label">Продакшн</div>
        <h1 class="text-2xl font-bold text-white">Управление трансляцией</h1>
      </div>
      <div :class="['flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-medium border',
        wsConnected ? 'bg-status-success/10 border-status-success/30 text-status-success'
                    : 'bg-red-500/10 border-red-500/30 text-red-400']">
        <span :class="['w-1.5 h-1.5 rounded-full', wsConnected ? 'bg-status-success animate-pulse' : 'bg-red-400']"></span>
        Оверлеи {{ wsConnected ? 'на связи' : 'нет связи' }}
        <span v-if="status" class="opacity-60">· {{ status.listeners }}</span>
      </div>
    </div>

    <div class="grid grid-cols-2 gap-6">
      <!-- Scenes -->
      <div class="card space-y-4">
        <div class="flex items-center justify-between">
          <div class="section-label mb-0">Сцены оверлея</div>
          <span class="text-[10px] text-text-muted uppercase tracking-wider">
            событие: scene_change
          </span>
        </div>
        <div class="space-y-2">
          <div v-for="scene in scenes" :key="scene.id"
            @click="setScene(scene.id)"
            :class="['flex items-center gap-3 px-4 py-3 rounded-lg border cursor-pointer transition-all',
              activeScene === scene.id ? 'bg-gold/10 border-gold/40' : 'border-bg-border hover:border-bg-elevated']">
            <component :is="scene.icon" :size="16"
              :class="activeScene === scene.id ? 'text-gold' : 'text-text-muted'" />
            <div class="flex-1">
              <div :class="['font-medium text-sm', activeScene === scene.id ? 'text-gold' : 'text-white']">
                {{ scene.name }}
              </div>
              <div class="text-text-muted text-xs">{{ scene.desc }}</div>
            </div>
            <span v-if="activeScene === scene.id" class="w-2 h-2 rounded-full bg-gold animate-pulse"></span>
          </div>
        </div>
        <div class="text-xs text-text-muted flex items-center gap-1.5">
          <Info :size="12" />
          Сцена рассылается всем подключённым оверлеям по WebSocket.
        </div>
      </div>

      <div class="space-y-5">
        <!-- Replay -->
        <div class="card space-y-3">
          <div class="section-label">Replay и хайлайты</div>
          <div class="grid grid-cols-2 gap-2">
            <button v-for="t in replayTriggers" :key="t.id" @click="fireReplay(t.id)"
              :class="['btn-outline text-xs py-2.5 flex items-center gap-1.5 justify-center transition-all',
                lastEvent === 'replay:' + t.id ? 'border-gold/50 text-gold' : '']">
              <Film :size="13" /> {{ t.label }}
            </button>
          </div>
        </div>

        <!-- Live scoreboard push -->
        <div class="card space-y-3">
          <div class="section-label">Текущее состояние CS2</div>
          <div v-if="snap && snap.map" class="space-y-2">
            <div class="flex items-center justify-between bg-bg-elevated rounded-lg px-3 py-2">
              <span class="text-xs text-text-secondary">{{ snap.map }} · {{ snap.phase || '—' }}</span>
              <span class="text-sm font-bold text-white tabular-nums">
                {{ snap.ct_score }} : {{ snap.t_score }}
              </span>
            </div>
            <div class="text-xs text-text-muted">
              Раунд {{ (snap.round ?? 0) + 1 }} · игроков в игре: {{ snap.players.length }}
            </div>
          </div>
          <div v-else class="text-xs text-text-muted py-2">
            CS2 не отдаёт данные. Импортируйте GSI-конфиг в Настройках.
          </div>
          <button @click="pushLower" class="btn-outline w-full text-xs flex items-center justify-center gap-2">
            <Send :size="13" /> Отправить счёт в нижнюю плашку
          </button>
        </div>
      </div>
    </div>

    <!-- OBS Studio -->
    <div class="card space-y-4">
      <div class="flex items-center justify-between">
        <div class="section-label mb-0">OBS Studio</div>
        <div class="flex items-center gap-2">
          <div :class="['flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-medium border',
            obsStatus.connected ? 'bg-status-success/10 border-status-success/30 text-status-success'
                                : 'bg-red-500/10 border-red-500/30 text-red-400']">
            <span :class="['w-1.5 h-1.5 rounded-full', obsStatus.connected ? 'bg-status-success animate-pulse' : 'bg-red-400']"></span>
            {{ obsStatus.connected ? 'подключён' : 'нет связи' }}
          </div>
          <button @click="reloadObsScenes" class="btn-outline text-xs py-1.5 flex items-center gap-1.5">
            <RotateCcw :size="13" /> Обновить сцены
          </button>
        </div>
      </div>

      <div v-if="!obsStatus.connected" class="text-xs text-text-muted">
        {{ obsStatus.message || 'OBS недоступен.' }}
        Включите в OBS: Инструменты → WebSocket Server Settings, затем укажите порт и пароль в Настройках.
      </div>

      <template v-else>
        <div class="grid grid-cols-3 gap-2">
          <button @click="toggleStream"
            :class="['btn-outline text-xs py-2.5 flex items-center gap-1.5 justify-center',
              obsStatus.streaming ? 'border-brand-red/50 text-brand-red' : '']">
            <Radio :size="13" /> {{ obsStatus.streaming ? 'Остановить стрим' : 'Начать стрим' }}
          </button>
          <button @click="toggleRecord"
            :class="['btn-outline text-xs py-2.5 flex items-center gap-1.5 justify-center',
              obsStatus.recording ? 'border-brand-red/50 text-brand-red' : '']">
            <Disc :size="13" /> {{ obsStatus.recording ? 'Остановить запись' : 'Начать запись' }}
          </button>
          <button @click="saveObsReplay" class="btn-outline text-xs py-2.5 flex items-center gap-1.5 justify-center">
            <Film :size="13" /> Сохранить реплей
          </button>
        </div>

        <div class="space-y-2 pt-1">
          <div class="text-xs text-text-muted flex items-center gap-1.5">
            <Cast :size="12" />
            Привязка сцен: при выборе сцены оверлея OBS переключится на указанную сцену.
          </div>
          <div v-for="scene in scenes" :key="'map-' + scene.id"
            class="flex items-center gap-4 bg-bg-elevated rounded-lg px-4 py-2.5">
            <component :is="scene.icon" :size="14" class="text-text-muted flex-shrink-0" />
            <span class="text-xs text-white w-32 flex-shrink-0">{{ scene.name }}</span>
            <ArrowRight :size="14" class="text-text-muted flex-shrink-0" />
            <select v-model="obsMapping[scene.id]" @change="saveMapping"
              class="input-field text-xs py-1 flex-1 max-w-xs">
              <option value="">— не привязано —</option>
              <option v-for="s in obsScenes" :key="s.name" :value="s.name">{{ s.name }}</option>
            </select>
          </div>
        </div>
      </template>
    </div>

    <!-- Auto-switch rules -->
    <div class="card space-y-4">
      <div class="flex items-center justify-between">
        <div class="section-label mb-0">Правила авто-смены сцен</div>
        <button @click="addRule" class="btn-gold text-xs py-1.5 flex items-center gap-1.5">
          <Plus :size="13" /> Добавить правило
        </button>
      </div>

      <div v-if="rules.length === 0" class="text-xs text-text-muted py-2">
        Правил нет. Правило меняет сцену оверлея, когда фаза раунда CS2 совпадает с триггером.
      </div>

      <div class="space-y-2">
        <div v-for="(rule, i) in rules" :key="rule.id"
          class="flex items-center gap-4 bg-bg-elevated rounded-lg px-4 py-3">
          <div class="flex items-center gap-2">
            <span class="text-xs text-text-muted">Когда фаза:</span>
            <select v-model="rule.trigger" @change="saveRules" class="input-field text-xs py-1 w-32">
              <option v-for="p in phases" :key="p" :value="p">{{ p }}</option>
            </select>
          </div>
          <ArrowRight :size="14" class="text-text-muted flex-shrink-0" />
          <div class="flex items-center gap-2">
            <span class="text-xs text-text-muted">Сцена:</span>
            <select v-model="rule.scene" @change="saveRules" class="input-field text-xs py-1 w-40">
              <option v-for="s in scenes" :key="s.id" :value="s.id">{{ s.name }}</option>
            </select>
          </div>
          <button @click="removeRule(i)" class="ml-auto text-text-muted hover:text-brand-red transition-colors">
            <X :size="14" />
          </button>
        </div>
      </div>

      <label class="flex items-center gap-2 text-xs text-text-secondary cursor-pointer pt-1">
        <input type="checkbox" v-model="autoSwitch" @change="saveRules" class="accent-gold">
        Включить авто-смену сцен по фазе раунда
      </label>
    </div>

    <div v-if="error" class="card border-brand-red/30 bg-brand-red/5 text-xs text-brand-red flex items-center gap-2">
      <AlertTriangle :size="13" /> {{ error }}
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, markRaw, watch, onMounted, onUnmounted } from 'vue'
import {
  Clapperboard, Gamepad2, PauseCircle, Award, MapPin,
  Film, Plus, ArrowRight, X, Send, Info, AlertTriangle,
  Radio, Disc, RotateCcw, Cast
} from 'lucide-vue-next'
import {
  useGsiFeed, gsi, overlay, settings, obs, isDesktop,
  type GsiStatus, type ObsStatus, type ObsScene,
} from '../api'

const { snapshot: snap, connected: wsConnected, stop } = useGsiFeed()

const status = ref<GsiStatus | null>(null)
const activeScene = ref('game')
const lastEvent = ref('')
const error = ref('')
const autoSwitch = ref(false)

// OBS state
const obsStatus = ref<ObsStatus>({ connected: false, streaming: false, recording: false, message: 'Загрузка…' })
const obsScenes = ref<ObsScene[]>([])
// Maps app scene id → OBS scene name. Saved in settings as JSON.
const obsMapping = ref<Record<string, string>>({})
let obsPoll: number | undefined

const scenes = [
  { id: 'intro', name: 'Заставка', icon: markRaw(Clapperboard), desc: 'Intro / логотип' },
  { id: 'game', name: 'Игра', icon: markRaw(Gamepad2), desc: 'Основная трансляция' },
  { id: 'break', name: 'Перерыв', icon: markRaw(PauseCircle), desc: 'BRB / break screen' },
  { id: 'results', name: 'Итоги матча', icon: markRaw(Award), desc: 'Результаты карты' },
  { id: 'veto', name: 'Вето', icon: markRaw(MapPin), desc: 'Выбор карт' },
]

const replayTriggers = [
  { id: 'ace', label: 'ACE' },
  { id: '4k', label: '4K' },
  { id: 'clutch', label: 'Клатч 1v3+' },
  { id: 'bomb', label: 'Бомба' },
  { id: 'awp', label: 'AWP дуэль' },
]

/** CS2 round phases that GSI reports. */
const phases = ['freezetime', 'live', 'over', 'warmup', 'intermission']

interface Rule { id: string; trigger: string; scene: string }
const rules = ref<Rule[]>([])

const setScene = async (id: string) => {
  activeScene.value = id
  if (!isDesktop) return
  try {
    await overlay.broadcast('scene_change', { scene: id })
    await settings.set('active_scene', id)
    // Switch OBS scene if a mapping exists for this app scene.
    const obsSceneName = obsMapping.value[id]
    if (obsSceneName) {
      obs.setScene(obsSceneName).catch((e: unknown) => {
        error.value = `OBS: ${String(e)}`
      })
    }
  } catch (e) {
    error.value = String(e)
  }
}

/** Persist app-scene -> OBS-scene mapping. */
const saveMapping = async () => {
  if (!isDesktop) return
  try {
    await settings.set('obs_scene_mapping', JSON.stringify(obsMapping.value))
  } catch (e) {
    error.value = String(e)
  }
}

/** Re-read the OBS scene list on demand (e.g. after adding scenes in OBS). */
const reloadObsScenes = async () => {
  if (!isDesktop) return
  try {
    obsStatus.value = await obs.status()
    obsScenes.value = obsStatus.value.connected ? await obs.scenes() : []
  } catch (e) {
    error.value = `OBS: ${String(e)}`
  }
}

const toggleStream = async () => {
  if (!isDesktop) return
  try {
    obsStatus.value.streaming = await obs.toggleStream()
  } catch (e) {
    error.value = `OBS: ${String(e)}`
  }
}

const toggleRecord = async () => {
  if (!isDesktop) return
  try {
    obsStatus.value.recording = await obs.toggleRecord()
  } catch (e) {
    error.value = `OBS: ${String(e)}`
  }
}

const saveObsReplay = async () => {
  if (!isDesktop) return
  try {
    await obs.saveReplay()
    lastEvent.value = 'obs:replay'
    setTimeout(() => (lastEvent.value = ''), 1200)
  } catch (e) {
    error.value = `OBS: ${String(e)}`
  }
}

const fireReplay = async (id: string) => {
  lastEvent.value = 'replay:' + id
  setTimeout(() => (lastEvent.value = ''), 1200)
  if (!isDesktop) return
  try {
    await overlay.broadcast('replay', { kind: id })
  } catch (e) {
    error.value = String(e)
  }
}

const pushLower = async () => {
  if (!isDesktop || !snap.value) return
  try {
    await overlay.broadcast('lower_third', {
      ct_name: snap.value.ct_name,
      t_name: snap.value.t_name,
      ct_score: snap.value.ct_score,
      t_score: snap.value.t_score,
      map: snap.value.map,
    })
  } catch (e) {
    error.value = String(e)
  }
}

const addRule = () => {
  rules.value.push({
    id: crypto.randomUUID(),
    trigger: 'live',
    scene: 'game',
  })
  saveRules()
}

const removeRule = (i: number) => {
  rules.value.splice(i, 1)
  saveRules()
}

const saveRules = async () => {
  if (!isDesktop) return
  try {
    await settings.set('scene_rules', JSON.stringify({
      enabled: autoSwitch.value,
      rules: rules.value,
    }))
  } catch (e) {
    error.value = String(e)
  }
}

// Auto-switch: react to CS2 phase changes when enabled.
watch(() => snap.value?.phase, (phase) => {
  if (!autoSwitch.value || !phase) return
  const hit = rules.value.find(r => r.trigger === phase)
  if (hit && hit.scene !== activeScene.value) setScene(hit.scene)
})

let poll: number | undefined

onMounted(async () => {
  if (!isDesktop) return
  try {
    status.value = await gsi.status()
    const savedScene = await settings.get('active_scene')
    if (savedScene) activeScene.value = savedScene

    const savedRules = await settings.get('scene_rules')
    if (savedRules) {
      const parsed = JSON.parse(savedRules) as { enabled: boolean; rules: Rule[] }
      autoSwitch.value = !!parsed.enabled
      rules.value = parsed.rules ?? []
    }

    const savedMapping = await settings.get('obs_scene_mapping')
    if (savedMapping) obsMapping.value = JSON.parse(savedMapping) as Record<string, string>
  } catch (e) {
    error.value = String(e)
  }
  poll = window.setInterval(async () => {
    try { status.value = await gsi.status() } catch { /* backend restarting */ }
  }, 3000)

  // OBS status poll — less frequent, errors are silently swallowed.
  const refreshObs = async () => {
    obsStatus.value = await obs.status()
    if (obsStatus.value.connected && obsScenes.value.length === 0) {
      obsScenes.value = await obs.scenes()
    }
  }
  refreshObs()
  obsPoll = window.setInterval(refreshObs, 5000)
})

onUnmounted(() => {
  if (poll) clearInterval(poll)
  if (obsPoll) clearInterval(obsPoll)
  stop()
})
</script>
