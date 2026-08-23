<template>
  <div class="p-6 space-y-6">
    <!-- Header -->
    <div class="flex items-center justify-between">
      <div>
        <div class="section-label">Управление</div>
        <h1 class="text-2xl font-bold text-white flex items-center gap-3">
          <ServerIcon :size="26" class="text-gold" />
          CS2 Серверы
        </h1>
      </div>
      <div class="flex items-center gap-3">
        <button @click="loadServers" class="btn-outline flex items-center gap-2 text-xs py-2" :disabled="loading">
          <RefreshCw :size="14" :class="{ 'animate-spin': loading }" />
          Обновить
        </button>
        <button @click="openCreate" class="btn-gold flex items-center gap-2">
          <Plus :size="14" />
          Добавить сервер
        </button>
      </div>
    </div>

    <!-- Error notice -->
    <div v-if="error" class="card border-brand-red/40 bg-brand-red/5 text-brand-red text-sm flex items-center justify-between">
      <div class="flex items-center gap-2">
        <AlertTriangle :size="16" class="shrink-0" />
        <span>{{ error }}</span>
      </div>
      <button @click="error = ''" class="text-brand-red hover:opacity-70">
        <X :size="16" />
      </button>
    </div>

    <!-- Loading state -->
    <div v-if="loading" class="text-text-muted text-sm flex items-center gap-2 py-8 justify-center">
      <RefreshCw :size="18" class="animate-spin text-gold" />
      Загрузка списка серверов...
    </div>

    <!-- Empty state -->
    <div v-else-if="servers.length === 0" class="card border-dashed border-bg-border text-center py-12 space-y-4">
      <div class="w-12 h-12 rounded-full bg-bg-elevated border border-bg-border flex items-center justify-center mx-auto text-text-muted">
        <ServerIcon :size="24" />
      </div>
      <div class="space-y-1">
        <h3 class="text-white font-semibold text-base">Нет добавленных серверов</h3>
        <p class="text-text-muted text-xs max-w-md mx-auto">
          Добавьте сервер Counter-Strike 2 с активированным RCON-доступом для дистанционного управления картами и матчами.
        </p>
      </div>
      <button @click="openCreate" class="btn-gold inline-flex items-center gap-2">
        <Plus :size="14" />
        Добавить первый сервер
      </button>
    </div>

    <div v-else class="space-y-6">
      <!-- Server cards grid -->
      <div class="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
        <div
          v-for="s in servers"
          :key="s.id"
          :class="[
            'card relative group transition-all duration-200 flex flex-col justify-between space-y-4',
            selectedServerId === s.id ? 'border-gold/60 bg-bg-card shadow-lg shadow-gold/5' : 'hover:border-gold/30'
          ]"
        >
          <div>
            <!-- Top title & badges -->
            <div class="flex items-start justify-between gap-3">
              <div class="min-w-0 flex-1">
                <div class="font-bold text-white text-base truncate flex items-center gap-2">
                  <span class="truncate">{{ s.name }}</span>
                  <span v-if="selectedServerId === s.id" class="badge-gold text-[10px] py-0.5 px-1.5 shrink-0">
                    Активен RCON
                  </span>
                </div>
                <div class="text-xs font-mono text-text-secondary mt-1 tracking-wide">
                  {{ s.host }}:{{ s.port }}
                </div>
              </div>

              <!-- Password status badge -->
              <div
                :class="[
                  'text-[11px] px-2 py-1 rounded border flex items-center gap-1.5 shrink-0 font-medium',
                  s.has_password
                    ? 'border-status-success/30 bg-status-success/10 text-status-success'
                    : 'border-brand-red/30 bg-brand-red/10 text-brand-red'
                ]"
              >
                <ShieldCheck v-if="s.has_password" :size="12" />
                <ShieldAlert v-else :size="12" />
                <span>{{ s.has_password ? 'RCON задан' : 'Без пароля' }}</span>
              </div>
            </div>

            <!-- Test result output -->
            <div v-if="testResults[s.id]" class="mt-3 text-xs">
              <div v-if="testResults[s.id].loading" class="flex items-center gap-1.5 text-text-muted">
                <RefreshCw :size="12" class="animate-spin text-gold" />
                <span>Проверка соединения...</span>
              </div>
              <div v-else-if="testResults[s.id].success" class="flex items-center gap-1.5 text-status-success bg-status-success/10 p-2 rounded border border-status-success/20">
                <CheckCircle2 :size="13" class="shrink-0" />
                <span class="truncate">{{ testResults[s.id].msg }}</span>
              </div>
              <div v-else class="flex items-start gap-1.5 text-brand-red bg-brand-red/10 p-2 rounded border border-brand-red/20">
                <XCircle :size="13" class="shrink-0 mt-0.5" />
                <span class="break-words">{{ testResults[s.id].msg }}</span>
              </div>
            </div>
          </div>

          <!-- Bottom Action Buttons -->
          <div class="pt-3 border-t border-bg-border flex items-center justify-between gap-2">
            <button
              @click="testConnection(s.id)"
              :disabled="testResults[s.id]?.loading"
              class="btn-outline flex-1 text-xs py-1.5 px-2 flex items-center justify-center gap-1.5"
              title="Проверить связь с сервером через RCON"
            >
              <Plug :size="13" />
              Связь
            </button>

            <button
              @click="selectServer(s.id)"
              :class="[
                'text-xs py-1.5 px-3 rounded-btn border font-medium flex items-center gap-1.5 transition-all',
                selectedServerId === s.id
                  ? 'bg-gold/10 border-gold/40 text-gold'
                  : 'border-bg-border text-text-secondary hover:text-white hover:border-gold/40'
              ]"
              title="Выбрать сервер для управления RCON-консолью"
            >
              <Terminal :size="13" />
              Консоль
            </button>

            <button
              @click="openEdit(s)"
              class="p-1.5 rounded-btn border border-bg-border text-text-muted hover:text-white hover:border-gold/40 transition-colors"
              title="Редактировать параметры сервера"
            >
              <Pencil :size="13" />
            </button>

            <button
              @click="removeServer(s)"
              class="p-1.5 rounded-btn border border-bg-border text-text-muted hover:text-brand-red hover:border-brand-red/40 hover:bg-brand-red/10 transition-colors"
              title="Удалить сервер"
            >
              <Trash2 :size="13" />
            </button>
          </div>
        </div>
      </div>

      <!-- RCON Console & Quick Map Change Grid -->
      <div class="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <!-- RCON Console (2 cols) -->
        <div class="lg:col-span-2 card space-y-4 flex flex-col justify-between">
          <div class="space-y-3">
            <div class="flex flex-wrap items-center justify-between gap-3">
              <div class="flex items-center gap-2">
                <Terminal :size="18" class="text-gold" />
                <h2 class="text-lg font-bold text-white">RCON Консоль</h2>
              </div>

              <div class="flex items-center gap-3">
                <!-- Target Server Selector -->
                <div class="flex items-center gap-2">
                  <span class="text-xs text-text-muted">Сервер:</span>
                  <select
                    v-model="selectedServerId"
                    class="input-field text-xs py-1 px-2.5 w-48 font-medium"
                  >
                    <option v-for="srv in servers" :key="srv.id" :value="srv.id">
                      {{ srv.name }} ({{ srv.host }}:{{ srv.port }})
                    </option>
                  </select>
                </div>

                <button
                  @click="clearConsole"
                  class="text-xs text-text-muted hover:text-white flex items-center gap-1 transition-colors px-2 py-1"
                  title="Очистить вывод консоли"
                >
                  <Trash2 :size="12" />
                  Очистить
                </button>
              </div>
            </div>

            <!-- Quick RCON Preset Buttons -->
            <div class="flex flex-wrap gap-1.5 items-center pt-1 border-t border-bg-border/60">
              <span class="text-[11px] text-text-muted mr-1 font-medium">Команды:</span>
              <button
                v-for="preset in quickCommands"
                :key="preset.cmd"
                @click="execCommand(preset.cmd)"
                :disabled="executingCommand"
                class="text-[11px] px-2 py-0.5 rounded bg-bg-elevated border border-bg-border text-text-secondary hover:text-gold hover:border-gold/40 transition-colors disabled:opacity-40"
              >
                {{ preset.label }}
              </button>
            </div>

            <!-- Log Terminal Area -->
            <div
              ref="logContainerRef"
              class="bg-bg-base border border-bg-border rounded-lg p-4 font-mono text-xs text-text-secondary h-72 overflow-y-auto space-y-2 select-text"
            >
              <div v-if="consoleLogs.length === 0" class="text-text-muted italic text-center py-16">
                Консоль RCON готова к работе. Введите команду или выберите из быстрых пресетов.
              </div>
              <div v-for="log in consoleLogs" :key="log.id" class="leading-relaxed">
                <template v-if="log.type === 'cmd'">
                  <div class="text-gold font-semibold flex items-start gap-2">
                    <span class="text-text-muted shrink-0">[{{ log.timestamp }}]</span>
                    <span class="break-all">{{ log.text }}</span>
                  </div>
                </template>
                <template v-else-if="log.type === 'output'">
                  <pre class="text-white/90 whitespace-pre-wrap break-all font-mono pl-4 border-l-2 border-gold/30 mt-0.5">{{ log.text }}</pre>
                </template>
                <template v-else-if="log.type === 'error'">
                  <div class="text-brand-red font-medium flex items-start gap-2 pl-4 border-l-2 border-brand-red/50 mt-0.5">
                    <span class="break-all">{{ log.text }}</span>
                  </div>
                </template>
                <template v-else-if="log.type === 'sys'">
                  <div class="text-text-muted italic flex items-center gap-2">
                    <span class="shrink-0">[{{ log.timestamp }}]</span>
                    <span>{{ log.text }}</span>
                  </div>
                </template>
              </div>
            </div>
          </div>

          <!-- Command Input Form -->
          <form @submit.prevent="execCommand()" class="flex gap-2">
            <input
              v-model="commandInput"
              type="text"
              class="input-field font-mono"
              placeholder="Введите RCON-команду (например: status, mp_restartgame 1)..."
              :disabled="executingCommand || !selectedServerId"
            />
            <button
              type="submit"
              :disabled="executingCommand || !commandInput.trim() || !selectedServerId"
              class="btn-gold shrink-0 flex items-center gap-2 disabled:opacity-40"
            >
              <RefreshCw v-if="executingCommand" :size="14" class="animate-spin" />
              <Send v-else :size="14" />
              <span>{{ executingCommand ? 'Выполнение...' : 'Выполнить' }}</span>
            </button>
          </form>
        </div>

        <!-- Quick Change Map Section (1 col) -->
        <div class="card space-y-4 flex flex-col justify-between">
          <div class="space-y-4">
            <div class="flex items-center gap-2">
              <MapPin :size="18" class="text-gold" />
              <h2 class="text-lg font-bold text-white">Смена карты</h2>
            </div>

            <p class="text-xs text-text-muted">
              Быстрая отправка команды <code class="text-gold font-mono">changelevel</code> на выбранный RCON-сервер.
            </p>

            <!-- Map Chip Selector -->
            <div>
              <label class="text-xs text-text-secondary mb-2 block font-medium">Популярные карты CS2:</label>
              <div class="flex flex-wrap gap-1.5">
                <button
                  v-for="m in cs2Maps"
                  :key="m"
                  @click="mapInput = m"
                  :class="[
                    'text-xs px-2.5 py-1 rounded border transition-all font-mono',
                    mapInput === m
                      ? 'bg-gold/15 border-gold text-gold font-semibold'
                      : 'bg-bg-elevated border-bg-border text-text-secondary hover:text-white hover:border-gold/30'
                  ]"
                >
                  {{ m }}
                </button>
              </div>
            </div>

            <!-- Custom Map Name Input -->
            <div class="space-y-2">
              <label class="text-xs text-text-secondary block font-medium">Имя карты</label>
              <div class="flex gap-2">
                <input
                  v-model="mapInput"
                  type="text"
                  class="input-field font-mono"
                  placeholder="de_dust2"
                  :disabled="changingMap || !selectedServerId"
                  @keyup.enter="execChangeLevel()"
                />
                <button
                  @click="execChangeLevel()"
                  :disabled="changingMap || !mapInput.trim() || !selectedServerId"
                  class="btn-gold shrink-0 flex items-center gap-1.5 py-2 px-4 disabled:opacity-40"
                >
                  <RefreshCw v-if="changingMap" :size="13" class="animate-spin" />
                  <Play v-else :size="13" />
                  <span>Сменить</span>
                </button>
              </div>
            </div>
          </div>

          <!-- Warning banner about changelevel -->
          <div class="p-3 rounded-lg border border-amber-500/30 bg-amber-500/10 text-amber-300 text-xs space-y-1">
            <div class="flex items-center gap-1.5 font-semibold text-amber-200">
              <AlertTriangle :size="15" class="shrink-0 text-amber-400" />
              <span>Предупреждение</span>
            </div>
            <p class="leading-relaxed opacity-90">
              Команда <code class="font-mono font-bold">changelevel</code> незамедлительно перезапускает карту и сбрасывает счёт текущей игры. Не нажимайте во время прямого эфира или текущего раунда!
            </p>
          </div>
        </div>
      </div>
    </div>

    <!-- Modal Form: Add / Edit Server -->
    <div v-if="showForm" class="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div class="card w-full max-w-md space-y-5">
        <div class="flex items-center justify-between">
          <h2 class="text-lg font-bold text-white flex items-center gap-2">
            <ServerIcon :size="18" class="text-gold" />
            <span>{{ draft.id ? 'Изменить сервер' : 'Новый CS2 сервер' }}</span>
          </h2>
          <button @click="showForm = false" class="text-text-muted hover:text-white transition-colors">
            <X :size="20" />
          </button>
        </div>

        <div v-if="formError" class="p-2.5 rounded bg-brand-red/10 border border-brand-red/30 text-brand-red text-xs">
          {{ formError }}
        </div>

        <div class="space-y-3">
          <div>
            <label class="text-text-secondary text-xs mb-1.5 block font-medium">Название сервера *</label>
            <input
              v-model="draft.name"
              type="text"
              class="input-field"
              placeholder="Main CS2 Tournament Server"
              @keyup.enter="saveServer"
            />
          </div>

          <div class="grid grid-cols-3 gap-3">
            <div class="col-span-2">
              <label class="text-text-secondary text-xs mb-1.5 block font-medium">IP / Хост *</label>
              <input
                v-model="draft.host"
                type="text"
                class="input-field font-mono"
                placeholder="127.0.0.1"
              />
            </div>
            <div>
              <label class="text-text-secondary text-xs mb-1.5 block font-medium">Порт</label>
              <input
                v-model.number="draft.port"
                type="number"
                min="1"
                max="65535"
                class="input-field font-mono"
                placeholder="27015"
              />
            </div>
          </div>

          <div>
            <label class="text-text-secondary text-xs mb-1.5 block font-medium">Пароль RCON</label>
            <input
              v-model="draft.rcon_password"
              type="password"
              class="input-field font-mono"
              placeholder="••••••••"
              autocomplete="off"
            />
            <p v-if="draft.id" class="text-[11px] text-text-muted mt-1">
              Оставьте поле пустым, чтобы сохранить текущий пароль RCON.
            </p>
          </div>
        </div>

        <div class="flex gap-3 pt-2 border-t border-bg-border">
          <button @click="showForm = false" class="btn-outline flex-1">
            Отмена
          </button>
          <button
            @click="saveServer"
            :disabled="!draft.name.trim() || !draft.host.trim() || saving"
            class="btn-gold flex-1 disabled:opacity-40 flex items-center justify-center gap-2"
          >
            <RefreshCw v-if="saving" :size="14" class="animate-spin" />
            <span>{{ saving ? 'Сохранение...' : 'Сохранить' }}</span>
          </button>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, nextTick } from 'vue'
import { invoke } from '@tauri-apps/api/core'
import {
  Server as ServerIcon,
  Plus,
  Pencil,
  Trash2,
  X,
  AlertTriangle,
  RefreshCw,
  Plug,
  Terminal,
  ShieldCheck,
  ShieldAlert,
  Send,
  MapPin,
  Play,
  CheckCircle2,
  XCircle
} from 'lucide-vue-next'

export interface Server {
  id: string
  name: string
  host: string
  port: number
  rcon_password?: string | null
  has_password: boolean
}

interface LogItem {
  id: string
  timestamp: string
  type: 'cmd' | 'output' | 'error' | 'sys'
  text: string
}

const isDesktop = typeof window !== 'undefined' && '__TAURI_INTERNALS__' in window

// State
const servers = ref<Server[]>([])
const loading = ref(true)
const saving = ref(false)
const error = ref('')
const formError = ref('')
const showForm = ref(false)
const selectedServerId = ref<string>('')

// Connection test state map
const testResults = ref<Record<string, { loading: boolean; success?: boolean; msg?: string }>>({})

// RCON Console State
const consoleLogs = ref<LogItem[]>([])
const commandInput = ref('')
const executingCommand = ref(false)
const logContainerRef = ref<HTMLDivElement | null>(null)

// Change Map State
const mapInput = ref('de_dust2')
const changingMap = ref(false)

const cs2Maps = [
  'de_dust2',
  'de_mirage',
  'de_inferno',
  'de_nuke',
  'de_anubis',
  'de_ancient',
  'de_vertigo'
]

const quickCommands = [
  { label: 'status', cmd: 'status' },
  { label: 'stats', cmd: 'stats' },
  { label: 'mp_restartgame 1', cmd: 'mp_restartgame 1' },
  { label: 'exec competitive', cmd: 'exec gamemode_competitive' },
  { label: 'mp_pause_match', cmd: 'mp_pause_match' },
  { label: 'mp_unpause_match', cmd: 'mp_unpause_match' }
]

const blankServer = (): Server => ({
  id: '',
  name: '',
  host: '127.0.0.1',
  port: 27015,
  rcon_password: '',
  has_password: false
})

const draft = ref<Server>(blankServer())

const selectedServer = computed(() =>
  servers.value.find(s => s.id === selectedServerId.value)
)

/**
 * Invoke helper with camelCase to snake_case fallback for Tauri v2 compatibility
 */
async function callInvoke<T>(cmd: string, args?: Record<string, any>): Promise<T> {
  if (!isDesktop) {
    throw new Error('Функция доступна только в десктоп-версии приложения')
  }
  // Rust-команды объявлены со snake_case параметрами (server_id, map_name).
  // Tauri v2 приводит camelCase ключи из JS к snake_case, а уже snake_case
  // оставляет как есть — поэтому нормализуем один раз, детерминированно.
  if (!args) {
    return await invoke<T>(cmd)
  }
  const snakeArgs: Record<string, any> = {}
  for (const key of Object.keys(args)) {
    snakeArgs[key.replace(/([A-Z])/g, '_$1').toLowerCase()] = args[key]
  }
  return await invoke<T>(cmd, snakeArgs)
}

const loadServers = async () => {
  if (!isDesktop) {
    loading.value = false
    error.value = 'Откройте приложение в десктоп-режиме — управление серверами доступно только там.'
    return
  }
  loading.value = true
  error.value = ''
  try {
    const list = await callInvoke<Server[]>('list_servers')
    servers.value = list
    if (list.length > 0 && !selectedServerId.value) {
      selectedServerId.value = list[0].id
    }
  } catch (e: any) {
    error.value = `Ошибка загрузки серверов: ${String(e)}`
  } finally {
    loading.value = false
  }
}

const openCreate = () => {
  draft.value = blankServer()
  formError.value = ''
  showForm.value = true
}

const openEdit = (s: Server) => {
  draft.value = {
    id: s.id,
    name: s.name,
    host: s.host,
    port: s.port,
    rcon_password: '', // Leave blank so user doesn't rewrite existing unless entered
    has_password: s.has_password
  }
  formError.value = ''
  showForm.value = true
}

const selectServer = (id: string) => {
  selectedServerId.value = id
  const s = servers.value.find(x => x.id === id)
  if (s) {
    addLog('sys', `Выбран сервер "${s.name}" (${s.host}:${s.port})`)
  }
}

const saveServer = async () => {
  if (!draft.value.name.trim() || !draft.value.host.trim()) return
  saving.value = true
  formError.value = ''

  try {
    const payload: Server = {
      id: draft.value.id || crypto.randomUUID(),
      name: draft.value.name.trim(),
      host: draft.value.host.trim(),
      port: Number(draft.value.port) || 27015,
      rcon_password: draft.value.rcon_password || '',
      has_password: draft.value.has_password
    }

    const saved = await callInvoke<Server>('save_server', { server: payload })

    const idx = servers.value.findIndex(x => x.id === saved.id)
    if (idx >= 0) {
      servers.value[idx] = saved
    } else {
      servers.value.push(saved)
    }

    if (!selectedServerId.value) {
      selectedServerId.value = saved.id
    }

    showForm.value = false
  } catch (e: any) {
    formError.value = String(e)
  } finally {
    saving.value = false
  }
}

const removeServer = async (s: Server) => {
  if (!confirm(`Удалить сервер "${s.name}"?`)) return
  try {
    await callInvoke<void>('delete_server', { id: s.id })
    servers.value = servers.value.filter(x => x.id !== s.id)
    delete testResults.value[s.id]
    if (selectedServerId.value === s.id) {
      selectedServerId.value = servers.value[0]?.id || ''
    }
  } catch (e: any) {
    error.value = `Ошибка удаления: ${String(e)}`
  }
}

const testConnection = async (serverId: string) => {
  testResults.value[serverId] = { loading: true }
  try {
    const msg = await callInvoke<string>('rcon_test_connection', { serverId })
    testResults.value[serverId] = { loading: false, success: true, msg }
  } catch (e: any) {
    testResults.value[serverId] = { loading: false, success: false, msg: String(e) }
  }
}

const addLog = (type: LogItem['type'], text: string) => {
  const time = new Date().toLocaleTimeString()
  consoleLogs.value.push({
    id: crypto.randomUUID(),
    timestamp: time,
    type,
    text
  })
  nextTick(() => {
    if (logContainerRef.value) {
      logContainerRef.value.scrollTop = logContainerRef.value.scrollHeight
    }
  })
}

const clearConsole = () => {
  consoleLogs.value = []
}

const execCommand = async (customCmd?: string) => {
  const cmd = (customCmd || commandInput.value).trim()
  if (!cmd) return
  if (!selectedServerId.value) {
    addLog('sys', 'Ошибка: сервер для выполнения RCON-команды не выбран')
    return
  }

  const s = selectedServer.value
  const targetName = s ? s.name : selectedServerId.value
  addLog('cmd', `[${targetName}] > ${cmd}`)

  if (!customCmd) {
    commandInput.value = ''
  }

  executingCommand.value = true
  try {
    const res = await callInvoke<string>('rcon_exec', {
      serverId: selectedServerId.value,
      command: cmd
    })
    addLog('output', res || '(пустой ответ от сервера)')
  } catch (e: any) {
    addLog('error', String(e))
  } finally {
    executingCommand.value = false
  }
}

const execChangeLevel = async (mapName?: string) => {
  const targetMap = (mapName || mapInput.value).trim()
  if (!targetMap) return
  if (!selectedServerId.value) {
    error.value = 'Выберите сервер для смены карты'
    return
  }

  const s = selectedServer.value
  const targetName = s ? s.name : selectedServerId.value
  if (!confirm(`Сменить карту на "${targetMap}" на сервере "${targetName}"?`)) return

  changingMap.value = true
  addLog('sys', `Запрос смены карты на ${targetMap}...`)
  try {
    const res = await callInvoke<string>('rcon_changelevel', {
      serverId: selectedServerId.value,
      mapName: targetMap
    })
    addLog('output', res || `Карта успешно изменена на ${targetMap}`)
  } catch (e: any) {
    addLog('error', `Ошибка смены карты: ${String(e)}`)
  } finally {
    changingMap.value = false
  }
}

onMounted(loadServers)
</script>
