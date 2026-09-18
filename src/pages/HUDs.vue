<template>
  <div class="p-6 space-y-6">
    <!-- Header -->
    <div class="flex items-center justify-between">
      <div>
        <div class="section-label">Продакшн & Эфир</div>
        <h1 class="text-2xl font-bold text-white">Турнирные HUD-паки</h1>
      </div>
      <div class="flex gap-3">
        <button @click="reload" class="btn-outline flex items-center gap-2">
          <RefreshCw :size="14" :class="loading ? 'animate-spin' : ''" /> Обновить
        </button>
        <button @click="copy(overlaysFolder)" class="btn-outline flex items-center gap-2">
          <FolderOpen :size="14" /> {{ copiedKey === overlaysFolder ? 'Путь скопирован' : 'Папка оверлеев' }}
        </button>
      </div>
    </div>

    <!-- Operator Direct Game Overlay Control -->
    <div class="card bg-gradient-to-r from-gold/10 via-bg-card to-bg-card border-gold/40 space-y-4 p-5">
      <div class="flex items-center justify-between flex-wrap gap-4">
        <div class="space-y-1">
          <div class="flex items-center gap-2">
            <Tv :size="18" class="text-gold" />
            <h2 class="text-base font-bold text-white">HUD поверх игры для оператора (In-Game Overlay)</h2>
            <span class="text-[10px] uppercase font-bold tracking-wider px-2 py-0.5 rounded bg-gold/20 text-gold border border-gold/40">
              Click-Through
            </span>
          </div>
          <p class="text-xs text-text-secondary max-w-2xl leading-relaxed">
            Запускает прозрачное аппаратное окно с активным HUD поверх экрана 1920×1080.
            Все клики мыши и нажатия клавиш <b>проходят насквозь в CS2 без перехвата управления</b> и задержек.
          </p>
        </div>

        <button @click="toggleGameOverlay"
          :class="['px-5 py-2.5 rounded-btn font-bold text-xs transition-all flex items-center gap-2 shadow-lg cursor-pointer',
            overlayActive 
              ? 'bg-status-success text-black hover:bg-status-success/90 shadow-status-success/20' 
              : 'bg-gold text-black hover:bg-gold-light shadow-gold/20']">
          <span :class="['w-2.5 h-2.5 rounded-full', overlayActive ? 'bg-black animate-ping' : 'bg-black/40']"></span>
          {{ overlayActive ? 'HUD активен поверх CS2 (Закрыть)' : 'Включить HUD поверх CS2' }}
        </button>
      </div>

      <!-- Instructions Grid -->
      <div class="grid grid-cols-1 md:grid-cols-3 gap-3 pt-2 text-xs border-t border-gold/15">
        <div class="p-3 rounded-lg bg-bg-base/70 border border-bg-border space-y-1">
          <div class="text-white font-semibold flex items-center gap-1.5">
            <span class="w-4 h-4 rounded-full bg-gold/20 text-gold text-[10px] flex items-center justify-center font-bold">1</span>
            Режим экрана в CS2
          </div>
          <div class="text-text-muted text-[11px]">
            Настройки графики CS2 $\rightarrow$ Режим отображения: <b>В окне без рамки</b> (Fullscreen Windowed).
          </div>
        </div>

        <div class="p-3 rounded-lg bg-bg-base/70 border border-bg-border space-y-1">
          <div class="text-white font-semibold flex items-center gap-1.5">
            <span class="w-4 h-4 rounded-full bg-gold/20 text-gold text-[10px] flex items-center justify-center font-bold">2</span>
            Скрыть стандартный худ игры
          </div>
          <div class="text-text-muted text-[11px]">
            В консоли CS2 ввести: <code class="text-gold font-mono">cl_drawhud 0</code> (или <code class="text-gold font-mono">cl_draw_only_deathnotices 1</code>).
          </div>
        </div>

        <div class="p-3 rounded-lg bg-bg-base/70 border border-bg-border space-y-1">
          <div class="text-white font-semibold flex items-center gap-1.5">
            <span class="w-4 h-4 rounded-full bg-status-success/20 text-status-success text-[10px] flex items-center justify-center font-bold">3</span>
            Безопасность VAC
          </div>
          <div class="text-text-muted text-[11px]">
            <b>100% безопасно</b>: чистое внешнее веб-окно без внедрения DLL в память процесса игры.
          </div>
        </div>
      </div>
    </div>

    <!-- Active pack card -->
    <div v-if="activePack" class="card border-gold/40 bg-gold/5 space-y-4">
      <div class="flex items-center justify-between gap-4 flex-wrap">
        <div class="flex items-center gap-3 min-w-0">
          <div class="w-12 h-12 rounded-xl bg-gold/15 border border-gold/40 flex items-center justify-center flex-shrink-0">
            <Layers :size="24" class="text-gold" />
          </div>
          <div class="min-w-0">
            <div class="flex items-center gap-2 mb-0.5">
              <span class="text-[10px] text-gold uppercase tracking-widest font-bold">Активный турнирный стиль</span>
              <span v-if="getPackMeta(activePack.id).tag" class="text-[9px] uppercase font-mono px-1.5 py-0.2 rounded border bg-gold/20 text-gold border-gold/40">
                {{ getPackMeta(activePack.id).tag }}
              </span>
            </div>
            <div class="font-bold text-white text-lg truncate">{{ getPackMeta(activePack.id).title || activePack.name }}</div>
            <div class="text-text-muted text-xs font-mono truncate">{{ activePack.url_path }}</div>
          </div>
        </div>

        <div class="flex gap-2 flex-shrink-0 flex-wrap">
          <button @click="copy(activePack.url_path)" class="btn-outline text-xs py-2 flex items-center gap-1.5">
            <Link :size="13" /> {{ copiedKey === activePack.url_path ? 'Скопировано!' : 'Копировать OBS URL' }}
          </button>
          <button @click="exportObsScene(activePack)" class="btn-outline text-xs py-2 flex items-center gap-1.5">
            <Download :size="13" /> Пресет OBS (.json)
          </button>
          <button @click="preview(activePack)" class="text-xs px-3.5 py-2 rounded-btn bg-bg-elevated border border-gold/30 text-gold hover:bg-gold/10 transition-all font-medium flex items-center gap-1.5">
            <MonitorPlay :size="13" /> Открыть превью
          </button>
        </div>
      </div>

      <div class="grid grid-cols-2 sm:grid-cols-4 gap-3 border-t border-gold/15 pt-3">
        <div v-for="opt in hudOptions" :key="opt.id"
          class="flex items-center justify-between bg-bg-base/60 rounded-lg px-3 py-2 border border-bg-border/60">
          <span class="text-xs text-text-secondary">{{ opt.label }}</span>
          <button @click="toggleOption(opt.id)"
            :class="['w-8 h-4 rounded-full transition-all relative flex-shrink-0 cursor-pointer', opt.enabled ? 'bg-gold' : 'bg-bg-border']">
            <span :class="['absolute top-0.5 w-3 h-3 rounded-full bg-white transition-all shadow',
              opt.enabled ? 'left-[18px]' : 'left-0.5']"></span>
          </button>
        </div>
      </div>
    </div>

    <!-- Available Packs Header -->
    <div class="flex items-center justify-between pt-2">
      <div class="text-sm font-semibold text-white">Доступные стили оформления</div>
      <div class="text-xs text-text-muted">Все паки поддерживают 60/144/240 Гц радар и веб-камеры</div>
    </div>

    <!-- All packs list -->
    <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
      <div v-for="pack in displayedPacks" :key="pack.id"
        :class="['card transition-all group relative space-y-3', 
          activeHudId === pack.id ? 'border-gold/50 bg-gold/5 shadow-md shadow-gold/5' : 'hover:border-gold/30']">
        
        <div class="flex items-start gap-3">
          <div class="w-10 h-10 rounded-lg bg-bg-elevated border border-bg-border flex items-center justify-center group-hover:border-gold/30 transition-colors flex-shrink-0 mt-0.5">
            <Layers :size="18" :class="activeHudId === pack.id ? 'text-gold' : 'text-text-secondary'" />
          </div>
          <div class="flex-1 min-w-0">
            <div class="flex items-center gap-2">
              <div class="font-bold text-white text-base truncate">{{ getPackMeta(pack.id).title }}</div>
              <span class="text-[9px] uppercase font-mono px-1.5 py-0.2 rounded border bg-bg-elevated text-gold border-gold/30">
                {{ getPackMeta(pack.id).tag }}
              </span>
            </div>
            <div class="text-xs text-text-secondary mt-1 leading-snug">{{ getPackMeta(pack.id).desc }}</div>
            <div class="text-[11px] font-mono text-text-muted truncate mt-1.5">{{ pack.url_path }}</div>
          </div>
        </div>

        <div class="flex gap-2 pt-1 border-t border-bg-border/40">
          <button @click="activate(pack)"
            :class="['flex-1 text-xs py-2 rounded-btn border font-semibold transition-all flex items-center justify-center gap-1.5 cursor-pointer',
              activeHudId === pack.id
                ? 'bg-gold/15 border-gold/50 text-gold'
                : 'border-bg-border text-text-secondary hover:border-gold/40 hover:text-white']">
            <CheckCircle :size="13" />
            {{ activeHudId === pack.id ? 'Выбран' : 'Выбрать' }}
          </button>

          <button @click="copy(pack.url_path)" title="Скопировать ссылку для OBS"
            class="text-xs px-3 py-2 rounded-btn border border-bg-border text-text-secondary hover:text-white hover:border-gold/30 transition-colors flex items-center gap-1 cursor-pointer">
            <Link :size="13" />
            <span>OBS</span>
          </button>

          <button @click="preview(pack)" title="Открыть превью в браузере"
            class="text-xs px-3 py-2 rounded-btn border border-bg-border text-text-secondary hover:text-gold hover:border-gold/30 transition-colors flex items-center gap-1 cursor-pointer">
            <ExternalLink :size="13" />
            <span>Превью</span>
          </button>
        </div>
      </div>
    </div>

    <!-- Error notice -->
    <div v-if="error" class="card border-brand-red/30 bg-brand-red/5 text-xs text-brand-red flex items-center gap-2">
      <AlertTriangle :size="13" /> {{ error }}
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import {
  Layers, FolderOpen, RefreshCw, Link, MonitorPlay, CheckCircle,
  ExternalLink, AlertTriangle, Download, Tv
} from 'lucide-vue-next'
import { openUrl } from '@tauri-apps/plugin-opener'
import { huds, overlay, settings, obs, operatorOverlay, isDesktop, type HudPack } from '../api'

const packs = ref<HudPack[]>([])
const overlaysFolder = ref('')
const activeHudId = ref<string | null>(null)
const overlayActive = ref(false)
const loading = ref(false)
const error = ref('')
const copiedKey = ref('')

const activePack = computed(() => packs.value.find(p => p.id === activeHudId.value) ?? packs.value[0] ?? null)

// Filter to tournament broadcast styles only
const displayedPacks = computed(() => {
  const allowed = ['fennec-championship', 'fennec-broadcast', 'fennec-cyber', 'fennec-pro']
  return packs.value.filter(p => allowed.includes(p.id))
})

const packMeta: Record<string, { title: string; desc: string; tag: string }> = {
  'fennec-championship': {
    title: 'Championship Major (Золото и Оникс)',
    desc: 'Премиальный стиль гранд-финалов мейджоров: SVG-индикаторы здоровья, герб турнира, анимация C4 и поддержка вебок.',
    tag: 'Tier 1'
  },
  'fennec-broadcast': {
    title: 'Broadcast Television (ТВ-эфир / Стекло)',
    desc: 'Классический чистый ТВ-стиль с контрастными таблицами, удобный для студийной аналитики и комментирования.',
    tag: 'Broadcast'
  },
  'fennec-cyber': {
    title: 'Cyber Neon (Киберпанк / Неон)',
    desc: 'Динамичный футуристичный стиль с яркими неоновыми рейлами здоровья и акцентной подсветкой.',
    tag: 'Cyber'
  },
  'fennec-pro': {
    title: 'Fennec Official Pro',
    desc: 'Аутентичный турнирный layout Fennec CS-HUD с оригинальной геометрией и чистыми шрифтами.',
    tag: 'Classic'
  }
}

const getPackMeta = (id: string) => {
  return packMeta[id] || {
    title: id,
    desc: 'Турнирный оверлей с поддержкой GSI и веб-камер.',
    tag: 'Custom'
  }
}

const hudOptions = ref([
  { id: 'avatars', label: 'Аватары / Агенты', enabled: true },
  { id: 'radar', label: 'Плавный радар', enabled: true },
  { id: 'economy', label: 'Экономика', enabled: false },
  { id: 'logos', label: 'Логотипы команд', enabled: true },
])

const reload = async () => {
  if (!isDesktop) return
  loading.value = true
  error.value = ''
  try {
    packs.value = await huds.list()
    overlaysFolder.value = await overlay.path()
    overlayActive.value = await operatorOverlay.status()
  } catch (e) {
    error.value = String(e)
  } finally {
    loading.value = false
  }
}

const toggleGameOverlay = async () => {
  if (!isDesktop) return
  try {
    const url = activePack.value?.url_path
    overlayActive.value = await operatorOverlay.toggle(url)
  } catch (e) {
    error.value = `Ошибка переключения оверлея: ${e}`
  }
}

const activate = async (pack: HudPack) => {
  activeHudId.value = pack.id
  if (!isDesktop) return
  try {
    await settings.set('active_hud', pack.id)
    await overlay.broadcast('hud_activated', { id: pack.id, url: pack.url_path })
    if (overlayActive.value) {
      await operatorOverlay.toggle(pack.url_path)
      await operatorOverlay.toggle(pack.url_path)
    }
  } catch (e) {
    error.value = String(e)
  }
}

const toggleOption = async (id: string) => {
  const opt = hudOptions.value.find(o => o.id === id)
  if (!opt) return
  opt.enabled = !opt.enabled
  if (!isDesktop) return
  try {
    const map = Object.fromEntries(hudOptions.value.map(o => [o.id, o.enabled]))
    await settings.set('hud_options', JSON.stringify(map))
    await overlay.broadcast('hud_options', map)
  } catch (e) {
    error.value = String(e)
  }
}

const copy = async (text: string) => {
  if (!text) return
  try {
    await navigator.clipboard.writeText(text)
    copiedKey.value = text
    setTimeout(() => (copiedKey.value = ''), 2000)
  } catch { /* clipboard blocked */ }
}

const preview = async (pack: HudPack) => {
  if (isDesktop) {
    try {
      await openUrl(pack.url_path)
      return
    } catch {
      /* fallback */
    }
  }
  window.open(pack.url_path, '_blank')
}

const exportObsScene = async (pack: HudPack) => {
  if (!isDesktop) return
  try {
    const collectionJson = await obs.exportSceneCollection(pack.url_path, `PROTOKOL - ${getPackMeta(pack.id).title}`)
    const blob = new Blob([collectionJson], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `obs-scene-${pack.id}.json`
    a.click()
    URL.revokeObjectURL(url)
  } catch (e) {
    error.value = `Ошибка экспорта сцены OBS: ${e}`
  }
}

onMounted(async () => {
  await reload()
  if (!isDesktop) return
  try {
    const savedHud = await settings.get('active_hud')
    if (savedHud) {
      activeHudId.value = savedHud
    } else if (packs.value.length > 0) {
      activeHudId.value = packs.value[0].id
    }
    const saved = await settings.get('hud_options')
    if (saved) {
      const map = JSON.parse(saved) as Record<string, boolean>
      hudOptions.value.forEach(o => {
        if (o.id in map) o.enabled = map[o.id]
      })
    }
    overlayActive.value = await operatorOverlay.status()
  } catch { /* first launch */ }
})
</script>
