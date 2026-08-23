<template>
  <div class="p-6 space-y-6">
    <div class="flex items-center justify-between">
      <div>
        <div class="section-label">Продакшн</div>
        <h1 class="text-2xl font-bold text-white">HUD-паки</h1>
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

    <!-- Folder hint -->
    <div class="card bg-bg-elevated/40 space-y-2">
      <div class="text-xs text-text-secondary flex items-center gap-1.5">
        <Info :size="12" /> HUD-паки — это подпапки с <span class="font-mono text-gold">index.html</span> внутри папки оверлеев.
      </div>
      <div class="text-xs font-mono text-text-muted break-all">{{ overlaysFolder || '—' }}</div>
    </div>

    <div v-if="!loading && packs.length === 0" class="card text-center py-12 space-y-2">
      <Layers :size="28" class="text-text-muted mx-auto" />
      <div class="text-text-secondary text-sm">HUD-паков не найдено</div>
      <div class="text-text-muted text-xs">
        Положите папку с index.html в папку оверлеев и нажмите «Обновить».
      </div>
    </div>

    <!-- Import pack -->
    <div v-if="isDesktop" class="card space-y-3">
      <div class="section-label mb-0">Импорт пака из ZIP</div>
      <div class="flex gap-2">
        <input v-model="importPath" placeholder="C:\путь\к\пак.zip" class="input-field flex-1 font-mono text-sm" @keydown.enter="importPack" />
        <button @click="importPack" :disabled="loading || !importPath.trim()" class="btn-primary flex items-center gap-2">
          <FolderOpen :size="14" /> Установить
        </button>
      </div>
      <div v-if="importResult" :class="['text-xs px-3 py-2 rounded-lg border', importResult.has_index ? 'bg-status-success/10 border-status-success/30 text-status-success' : 'bg-gold/10 border-gold/30 text-gold']">
        {{ importResult.message }}
      </div>
    </div>

    <!-- Active pack -->
    <div v-if="activePack" class="card border-gold/30 bg-gold/5 space-y-4">
      <div class="flex items-center justify-between gap-4">
        <div class="flex items-center gap-3 min-w-0">
          <div class="w-10 h-10 rounded-lg bg-gold/10 border border-gold/30 flex items-center justify-center flex-shrink-0">
            <Layers :size="20" class="text-gold" />
          </div>
          <div class="min-w-0">
            <div class="text-xs text-gold uppercase tracking-wider font-semibold mb-0.5">Активный HUD</div>
            <div class="font-bold text-white text-base truncate">{{ activePack.name }}</div>
            <div class="text-text-muted text-xs font-mono truncate">{{ activePack.url_path }}</div>
          </div>
        </div>
        <div class="flex gap-2 flex-shrink-0">
          <button @click="copy(activePack.url_path)" class="btn-outline text-xs py-1.5 flex items-center gap-1.5">
            <Link :size="13" /> {{ copiedKey === activePack.url_path ? 'Скопировано' : 'OBS URL' }}
          </button>
          <button @click="preview(activePack)" class="text-xs px-3 py-1.5 rounded-btn bg-bg-elevated border border-gold/30 text-gold hover:bg-gold/10 transition-all font-medium flex items-center gap-1.5">
            <MonitorPlay :size="13" /> Превью
          </button>
        </div>
      </div>

      <div class="grid grid-cols-4 gap-3 border-t border-gold/10 pt-3">
        <div v-for="opt in hudOptions" :key="opt.id"
          class="flex items-center justify-between bg-bg-base/60 rounded-lg px-3 py-2">
          <span class="text-xs text-text-secondary">{{ opt.label }}</span>
          <button @click="toggleOption(opt.id)"
            :class="['w-8 h-4 rounded-full transition-all relative flex-shrink-0', opt.enabled ? 'bg-gold' : 'bg-bg-border']">
            <span :class="['absolute top-0.5 w-3 h-3 rounded-full bg-white transition-all shadow',
              opt.enabled ? 'left-[18px]' : 'left-0.5']"></span>
          </button>
        </div>
      </div>
    </div>

    <!-- All packs -->
    <div v-if="packs.length" class="grid grid-cols-2 gap-4">
      <div v-for="pack in packs" :key="pack.id"
        :class="['card transition-all group', activeHudId === pack.id ? 'border-gold/30 bg-gold/5' : 'hover:border-gold/20']">
        <div class="flex items-center gap-3 mb-3">
          <div class="w-10 h-10 rounded-lg bg-bg-elevated border border-bg-border flex items-center justify-center group-hover:border-gold/30 transition-colors flex-shrink-0">
            <Layers :size="18" :class="activeHudId === pack.id ? 'text-gold' : 'text-text-secondary'" />
          </div>
          <div class="flex-1 min-w-0">
            <div class="font-semibold text-white text-sm truncate">{{ pack.name }}</div>
            <div class="text-xs font-mono text-text-muted truncate">{{ pack.url_path }}</div>
          </div>
          <span v-if="activeHudId === pack.id" class="badge-gold flex-shrink-0">Активен</span>
        </div>

        <div v-if="!pack.has_index"
          class="text-xs text-brand-red/90 flex items-center gap-1.5 mb-3">
          <AlertTriangle :size="12" /> Нет index.html — OBS покажет пустую страницу
        </div>
        <div v-else class="text-xs text-text-muted mb-3 font-mono truncate">{{ pack.path }}</div>

        <div class="flex gap-2">
          <button @click="activate(pack)"
            :class="['flex-1 text-xs py-2 rounded-btn border font-medium transition-all flex items-center justify-center gap-1.5',
              activeHudId === pack.id
                ? 'bg-gold/10 border-gold/40 text-gold'
                : 'border-bg-border text-text-secondary hover:border-gold/30 hover:text-gold']">
            <CheckCircle :size="13" />
            {{ activeHudId === pack.id ? 'Активен' : 'Активировать' }}
          </button>
          <button @click="copy(pack.url_path)" title="Скопировать URL"
            class="text-xs px-3 py-2 rounded-btn border border-bg-border text-text-secondary hover:text-white transition-colors">
            <Link :size="13" />
          </button>
          <button @click="preview(pack)" title="Открыть превью"
            class="text-xs px-3 py-2 rounded-btn border border-bg-border text-text-secondary hover:text-white transition-colors">
            <ExternalLink :size="13" />
          </button>
          <button v-if="isDesktop" @click="removePack(pack)" title="Удалить пак"
            class="text-xs px-3 py-2 rounded-btn border border-bg-border text-brand-red/60 hover:text-brand-red hover:border-brand-red/30 transition-colors">
            <X :size="13" />
          </button>
        </div>
      </div>
    </div>

    <div v-if="error" class="card border-brand-red/30 bg-brand-red/5 text-xs text-brand-red flex items-center gap-2">
      <AlertTriangle :size="13" /> {{ error }}
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import {
  Layers, FolderOpen, RefreshCw, Link, MonitorPlay, CheckCircle,
  ExternalLink, AlertTriangle, Info
} from 'lucide-vue-next'
import { huds, overlay, settings, isDesktop, type HudPack, type HudImportResult } from '../api'

const packs = ref<HudPack[]>([])
const overlaysFolder = ref('')
const activeHudId = ref<string | null>(null)
const loading = ref(false)
const error = ref('')
const copiedKey = ref('')
const importResult = ref<HudImportResult | null>(null)
const importPath = ref('')

const activePack = computed(() => packs.value.find(p => p.id === activeHudId.value) ?? null)

const hudOptions = ref([
  { id: 'avatars', label: 'Аватары', enabled: true },
  { id: 'radar', label: 'Радар', enabled: true },
  { id: 'economy', label: 'Экономика', enabled: false },
  { id: 'logos', label: 'Логотипы', enabled: true },
])

const reload = async () => {
  if (!isDesktop) return
  loading.value = true
  error.value = ''
  try {
    packs.value = await huds.list()
    overlaysFolder.value = await overlay.path()
  } catch (e) {
    error.value = String(e)
  } finally {
    loading.value = false
  }
}

const activate = async (pack: HudPack) => {
  activeHudId.value = pack.id
  if (!isDesktop) return
  try {
    await settings.set('active_hud', pack.id)
    await overlay.broadcast('hud_activated', { id: pack.id, url: pack.url_path })
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
    setTimeout(() => (copiedKey.value = ''), 1500)
  } catch { /* clipboard blocked */ }
}

const preview = (pack: HudPack) => window.open(pack.url_path, '_blank')

const importPack = async () => {
  if (!importPath.value.trim()) return
  loading.value = true
  error.value = ''
  importResult.value = null
  try {
    importResult.value = await huds.import(importPath.value.trim())
    importPath.value = ''
    await reload()
  } catch (e) {
    error.value = String(e)
  } finally {
    loading.value = false
  }
}

const removePack = async (pack: HudPack) => {
  if (!confirm(`Удалить пак «${pack.name}»? Это удалит все файлы в папке пака.`)) return
  loading.value = true
  error.value = ''
  try {
    await huds.remove(pack.id)
    if (activeHudId.value === pack.id) activeHudId.value = null
    await reload()
  } catch (e) {
    error.value = String(e)
  } finally {
    loading.value = false
  }
}

onMounted(async () => {
  await reload()
  if (!isDesktop) return
  try {
    activeHudId.value = await settings.get('active_hud')
    const saved = await settings.get('hud_options')
    if (saved) {
      const map = JSON.parse(saved) as Record<string, boolean>
      hudOptions.value.forEach(o => {
        if (o.id in map) o.enabled = map[o.id]
      })
    }
  } catch { /* first launch */ }
})
</script>
