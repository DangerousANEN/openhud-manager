<template>
  <div class="p-6 space-y-6">
    <div>
      <div class="section-label">Система</div>
      <h1 class="text-2xl font-bold text-white">Настройки</h1>
    </div>

    <div v-if="error" class="card border-brand-red/40 text-brand-red text-sm">{{ error }}</div>

    <div class="grid grid-cols-2 gap-6">
      <!-- GSI -->
      <div class="card space-y-4">
        <div class="section-label flex items-center gap-2">
          <Gamepad2 :size="13" /> CS2 Game State Integration
        </div>

        <div class="space-y-3">
          <div>
            <label class="text-text-secondary text-xs mb-1.5 block">GSI порт (текущий: {{ livePort }})</label>
            <input v-model="gsiPort" class="input-field" placeholder="1349" @change="savePort">
          </div>
          <div>
            <label class="text-text-secondary text-xs mb-1.5 block">Токен авторизации</label>
            <div class="flex gap-2">
              <input :type="showToken ? 'text' : 'password'" v-model="gsiToken" class="input-field flex-1"
                placeholder="auto-generated" readonly>
              <button @click="showToken = !showToken" class="btn-outline px-3">
                <component :is="showToken ? EyeOff : Eye" :size="14" />
              </button>
              <button @click="copyToken" class="btn-outline px-3" :title="copied ? 'Скопировано' : 'Копировать'">
                <Copy :size="14" :class="copied ? 'text-status-success' : ''" />
              </button>
            </div>
          </div>
        </div>

        <!-- CS2 cfg path override + auto-discovery status -->
        <div class="space-y-2">
          <label class="text-text-secondary text-xs mb-1.5 block">Папка cfg игры CS2</label>
          <div class="flex gap-2">
            <input v-model="cs2CfgPath" class="input-field flex-1 font-mono text-xs"
              placeholder="C:\Program Files (x86)\Steam\steamapps\common\Counter-Strike Global Offensive\game\csgo\cfg">
            <button @click="browseCs2Cfg" class="btn-outline px-3" title="Выбрать папку вручную">
              <FolderOpen :size="14" />
            </button>
          </div>
          <div v-if="cfgProbe.found" class="text-[11px] text-status-success flex items-center gap-1.5">
            <CheckCircle :size="12" /> CS2 найдена: {{ cfgProbe.path }}
          </div>
          <div v-else-if="probed" class="text-[11px] text-gold flex items-center gap-1.5">
            <AlertTriangle :size="12" /> Папка cfg не найдена автоматически — укажите путь выше
          </div>
        </div>

        <button @click="installCfg" :disabled="installing || !isDesktop"
          class="btn-gold w-full flex items-center justify-center gap-2 disabled:opacity-50">
          <FileText :size="14" />
          {{ installing ? 'Установка...' : 'Установить GSI cfg в CS2' }}
        </button>

        <div v-if="cfgInstalled !== null"
          :class="['flex items-center gap-2 rounded-lg px-3 py-2 text-xs',
            cfgInstalled
              ? 'bg-status-success/10 border border-status-success/20 text-status-success'
              : 'bg-status-error/10 border border-status-error/20 text-status-error']">
          <component :is="cfgInstalled ? CheckCircle : XCircle" :size="13" />
          {{ cfgInstalled ? cfgMessage : cfgError || 'Не удалось установить cfg' }}
        </div>

        <!-- cfg text preview (collapsible) -->
        <button @click="showPreview = !showPreview" class="text-xs text-text-muted hover:text-white flex items-center gap-1.5 transition-colors w-fit">
          <ChevronDown :size="13" :class="showPreview ? 'rotate-0' : '-rotate-90'" class="transition-transform" />
          {{ showPreview ? 'Скрыть' : 'Показать' }} содержимое cfg
        </button>
        <div v-if="showPreview && cfgText" class="bg-bg-elevated rounded-lg p-3 overflow-auto max-h-40">
          <pre class="text-xs font-mono text-text-muted whitespace-pre">{{ cfgText }}</pre>
        </div>
      </div>

      <!-- OBS -->
      <div class="card space-y-4">
        <div class="section-label flex items-center gap-2">
          <MonitorPlay :size="13" /> OBS WebSocket
        </div>
        <div class="space-y-3">
          <div>
            <label class="text-text-secondary text-xs mb-1.5 block">OBS хост</label>
            <input v-model="obsHost" class="input-field" placeholder="localhost" @change="saveObs">
          </div>
          <div>
            <label class="text-text-secondary text-xs mb-1.5 block">Порт</label>
            <input v-model="obsPort" class="input-field" placeholder="4455" @change="saveObs">
          </div>
          <div>
            <label class="text-text-secondary text-xs mb-1.5 block">Пароль</label>
            <input type="password" v-model="obsPassword" class="input-field" placeholder="••••••••" @change="saveObs">
          </div>
        </div>
        <button @click="testObs" :disabled="obsTesting || !isDesktop"
          class="btn-gold w-full flex items-center justify-center gap-2 disabled:opacity-50">
          <Plug :size="14" /> {{ obsTesting ? 'Подключение...' : 'Подключить OBS' }}
        </button>
        <div v-if="obsStatus"
          :class="['rounded-lg px-3 py-2.5 text-xs space-y-1',
            obsStatus.connected
              ? 'bg-status-success/10 border border-status-success/20'
              : 'bg-status-error/10 border border-status-error/20']">
          <div :class="['flex items-center gap-2 font-medium', obsStatus.connected ? 'text-status-success' : 'text-status-error']">
            <component :is="obsStatus.connected ? CheckCircle : XCircle" :size="13" />
            {{ obsStatus.connected ? 'OBS подключён' : 'Нет связи с OBS' }}
          </div>
          <div class="text-text-muted leading-relaxed">{{ obsStatus.message }}</div>
          <div v-if="obsStatus.connected" class="text-text-muted">
            OBS {{ obsStatus.obs_version ?? '—' }} · ws {{ obsStatus.websocket_version ?? '—' }} · сцена «{{ obsStatus.current_scene ?? '—' }}»
            · <span :class="obsStatus.streaming ? 'text-brand-red' : ''">{{ obsStatus.streaming ? 'стрим идёт' : 'стрим выключен' }}</span>
          </div>
        </div>
      </div>

      <!-- Network -->
      <div class="card space-y-4">
        <div class="section-label flex items-center gap-2">
          <Network :size="13" /> Сетевые адреса
        </div>
        <div class="bg-bg-elevated rounded-lg p-4 space-y-3 font-mono text-xs text-text-muted">
          <div class="flex items-center gap-2">
            <Globe :size="11" class="shrink-0 text-text-muted" />
            <span>GSI:</span>
            <span class="text-white select-all">http://127.0.0.1:{{ livePort }}/api/gsi</span>
          </div>
          <div class="flex items-center gap-2">
            <Globe :size="11" class="shrink-0 text-text-muted" />
            <span>OBS URL:</span>
            <span class="text-gold select-all">http://127.0.0.1:{{ livePort }}/overlay/</span>
          </div>
          <div class="flex items-center gap-2">
            <Wifi :size="11" class="shrink-0 text-text-muted" />
            <span>WebSocket:</span>
            <span class="text-white select-all">ws://127.0.0.1:{{ livePort }}/ws</span>
          </div>
          <div class="flex items-center gap-2">
            <Folder :size="11" class="shrink-0 text-text-muted" />
            <span>Оверлеи:</span>
            <span class="text-text-muted truncate select-all text-[10px]">{{ overlaysPath || '…' }}</span>
          </div>
        </div>
        <button @click="openOverlaysFolder" class="btn-outline w-full text-xs flex items-center justify-center gap-2">
          <FolderOpen :size="13" /> Открыть папку оверлеев
        </button>
      </div>

      <!-- DB / about -->
      <div class="card space-y-4">
        <div class="section-label flex items-center gap-2">
          <Database :size="13" /> База данных
        </div>
        <div class="bg-bg-elevated rounded-lg p-3 text-xs font-mono text-text-muted break-all select-all">
          {{ dbPath || '…' }}
        </div>
        <div class="grid grid-cols-2 gap-2 pt-1">
          <button @click="exportDb" :disabled="dbBusy || !isDesktop"
            class="btn-outline text-xs py-2 flex items-center justify-center gap-1.5 disabled:opacity-50">
            <Upload :size="13" /> Экспорт БД
          </button>
          <button @click="importDb" :disabled="dbBusy || !isDesktop"
            class="btn-outline text-xs py-2 flex items-center justify-center gap-1.5 disabled:opacity-50">
            <Download :size="13" /> Импорт БД
          </button>
        </div>
        <div v-if="dbMessage"
          :class="['flex items-start gap-2 rounded-lg px-3 py-2 text-xs',
            dbOk ? 'bg-status-success/10 border border-status-success/20 text-status-success'
                 : 'bg-status-error/10 border border-status-error/20 text-status-error']">
          <component :is="dbOk ? CheckCircle : XCircle" :size="13" class="mt-0.5 shrink-0" />
          {{ dbMessage }}
        </div>

        <div class="border-t border-bg-border pt-4 space-y-1">
          <div class="flex justify-between text-xs">
            <span class="text-text-muted">Версия</span>
            <span class="text-white">0.2.0</span>
          </div>
          <div class="flex justify-between text-xs">
            <span class="text-text-muted">Backend</span>
            <span class="text-white">Axum 0.7 · Rust 2021</span>
          </div>
          <div class="flex justify-between text-xs">
            <span class="text-text-muted">Frontend</span>
            <span class="text-white">Vue 3 · Vite 6 · Tauri 2</span>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue'
import {
  Gamepad2, Eye, EyeOff, FileText, CheckCircle, XCircle,
  MonitorPlay, Plug, Network, Globe, Wifi, FolderOpen, Folder,
  Database, Upload, Download, Copy, AlertTriangle, ChevronDown,
} from 'lucide-vue-next'
import {
  gsi, settings, overlay, obs, dbLocation, dbExport, dbImport,
  pickFile, pickSaveFile, isDesktop, type ObsStatus,
} from '../api'
import { revealItemInDir } from '@tauri-apps/plugin-opener'

const showToken = ref(false)
const copied = ref(false)
const installing = ref(false)
const cfgInstalled = ref<boolean | null>(null)
const cfgError = ref('')
const cfgMessage = ref('')
const cfgText = ref('')
const showPreview = ref(false)
const error = ref('')

const gsiToken = ref('')
const gsiPort = ref('1349')
const livePort = ref(1349)
const overlaysPath = ref('')
const dbPath = ref('')
const cs2CfgPath = ref('')
const probed = ref(false)
const cfgProbe = ref<{ found: boolean; path: string }>({ found: false, path: '' })

const obsHost = ref('localhost')
const obsPort = ref('4455')
const obsPassword = ref('')
const obsTesting = ref(false)
const obsStatus = ref<ObsStatus | null>(null)

const copyToken = async () => {
  try {
    await navigator.clipboard.writeText(gsiToken.value)
    copied.value = true
    setTimeout(() => (copied.value = false), 1500)
  } catch { /* ignore */ }
}

const savePort = async () => {
  const n = parseInt(gsiPort.value)
  if (!isDesktop || isNaN(n)) return
  await settings.set('server_port', String(n))
}

const saveObs = async () => {
  if (!isDesktop) return
  await Promise.all([
    settings.set('obs_host', obsHost.value),
    settings.set('obs_port', obsPort.value),
    settings.set('obs_password', obsPassword.value),
  ])
}

const browseCs2Cfg = async () => {
  if (!isDesktop) return
  const picked = await pickFile('Выберите папку cfg игры CS2')
  if (picked) cs2CfgPath.value = picked
  await installCfg()
}

const installCfg = async () => {
  if (!isDesktop) return
  installing.value = true
  cfgInstalled.value = null
  cfgError.value = ''
  try {
    cfgText.value = await gsi.cfgText()
    const msg = await gsi.cfgInstall(cs2CfgPath.value.trim() || null)
    cfgInstalled.value = true
    cfgMessage.value = msg
    // Refresh discovery state after a successful write.
    cfgProbe.value = await gsi.cfgProbe()
    probed.value = true
  } catch (e) {
    cfgError.value = String(e)
    cfgInstalled.value = false
  } finally {
    installing.value = false
  }
}

/** Save OBS settings, then run a real probe against the configured host/port. */
const testObs = async () => {
  if (!isDesktop) return
  obsTesting.value = true
  try {
    await saveObs()
    // Small delay so the settings writes land before the backend re-reads them.
    await new Promise((r) => setTimeout(r, 150))
    obsStatus.value = await obs.status()
  } catch (e) {
    obsStatus.value = {
      connected: false,
      obs_version: null,
      websocket_version: null,
      current_scene: null,
      streaming: false,
      recording: false,
      message: String(e),
    }
  } finally {
    obsTesting.value = false
  }
}

const exportDb = async () => {
  if (!isDesktop) return
  dbBusyStart()
  try {
    const dest = await pickSaveFile('Экспорт базы данных', `openhud-db-${new Date().toISOString().slice(0, 10)}.db`)
    if (!dest) return
    dbOk.value = true
    dbMessage.value = await dbExport(dest)
  } catch (e) {
    fail(String(e))
  } finally {
    dbBusyEnd()
  }
}

const importDb = async () => {
  if (!isDesktop) return
  if (!confirm('Импорт заменит текущую базу (команды, игроки, матчи). Продолжить?')) return
  dbBusyStart()
  try {
    const src = await pickFile('Выберите файл базы (.db)')
    if (!src) return
    dbOk.value = true
    dbMessage.value = await dbImport(src)
  } catch (e) {
    fail(String(e))
  } finally {
    dbBusyEnd()
  }
}

const dbBusy = ref(false)
const dbMessage = ref('')
const dbOk = ref(false)
const dbBusyStart = () => { dbBusy.value = true; dbMessage.value = ''; dbOk.value = false }
const dbBusyEnd = () => { dbBusy.value = false }
const fail = (msg: string) => { dbOk.value = false; dbMessage.value = msg }

const openOverlaysFolder = async () => {
  if (!isDesktop || !overlaysPath.value) return
  try {
    await revealItemInDir(overlaysPath.value)
  } catch { /* ignore */ }
}

onMounted(async () => {
  if (!isDesktop) return
  try {
    const st = await gsi.status()
    gsiToken.value = (await settings.get('gsi_token')) ?? ''
    gsiPort.value = String(st.port)
    livePort.value = st.port
    overlaysPath.value = await overlay.path()
    dbPath.value = await dbLocation()

    cs2CfgPath.value = (await settings.get('cs2_cfg_path')) ?? ''
    cfgProbe.value = await gsi.cfgProbe()
    probed.value = true

    obsHost.value = (await settings.get('obs_host')) ?? 'localhost'
    obsPort.value = (await settings.get('obs_port')) ?? '4455'
    obsPassword.value = (await settings.get('obs_password')) ?? ''
  } catch (e) {
    error.value = String(e)
  }
})
</script>
