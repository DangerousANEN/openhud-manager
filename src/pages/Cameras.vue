<template>
  <div class="p-6 space-y-6">
    <div class="flex items-center justify-between">
      <div>
        <div class="section-label">Продакшн</div>
        <h1 class="text-2xl font-bold text-white">Веб-камеры игроков</h1>
      </div>
      <div class="flex gap-3">
        <button @click="reload" class="btn-outline flex items-center gap-2">
          <RefreshCw :size="14" :class="loading ? 'animate-spin' : ''" /> Обновить
        </button>
        <button @click="openCreate" class="btn-gold flex items-center gap-2">
          <Plus :size="14" /> Добавить камеру
        </button>
      </div>
    </div>

    <!-- Instructions & Architecture Card -->
    <div class="card bg-bg-elevated/40 border-gold/20 space-y-3">
      <div class="flex items-start gap-3">
        <div class="w-8 h-8 rounded-lg bg-gold/10 border border-gold/30 flex items-center justify-center flex-shrink-0 mt-0.5">
          <CameraIcon :size="16" class="text-gold" />
        </div>
        <div class="space-y-1.5 flex-1 min-w-0">
          <div class="text-sm font-semibold text-white flex items-center gap-2">
            Реальные видеопотоки веб-камер по SteamID64
            <span class="badge-gold text-[10px]">API: /api/cameras</span>
          </div>
          <div class="text-xs text-text-muted leading-relaxed">
            HUD отображает реальный видеопоток камеры того игрока, за которым в данный момент наблюдает спектатор (focused player),
            в нижней карточке фокуса. Рамки в оверлее — это только оформление; видео воспроизводится через настроенные здесь источники.
          </div>
          <div class="grid grid-cols-1 md:grid-cols-2 gap-2 pt-1 text-[11px] text-text-secondary">
            <div class="flex items-start gap-1.5">
              <Info :size="13" class="text-gold shrink-0 mt-0.5" />
              <span>
                <strong>Прямой URL источника:</strong> Указывайте чистую ссылку на видеопоток (Direct Video) или URL для встраивания (<code class="text-gold font-mono">&lt;iframe&gt;</code> view-ссылку VDO.Ninja/OBS-ninja), а <em>не ссылку на комнату режиссёра/директора</em>.
              </span>
            </div>
            <div class="flex items-start gap-1.5">
              <AlertTriangle :size="13" class="text-brand-red shrink-0 mt-0.5" />
              <span>
                <strong>Ограничения встраивания:</strong> Сторонние сервисы могут блокировать iframe через заголовок <code class="text-white font-mono">X-Frame-Options</code> или CSP. Прямое видео запускается <strong class="text-white">без звука</strong>. Для iframe отключите звук в самом источнике; у VDO.Ninja используется параметр muted.
              </span>
            </div>
          </div>
        </div>
      </div>
    </div>

    <div v-if="error" class="card border-brand-red/40 text-brand-red text-sm flex items-center gap-2">
      <AlertTriangle :size="15" /> {{ error }}
    </div>

    <div v-if="loading" class="text-text-muted text-sm">Загрузка камер...</div>

    <!-- Empty State -->
    <div v-else-if="camList.length === 0" class="card text-center py-12 space-y-3">
      <CameraIcon :size="36" class="text-text-muted mx-auto" />
      <div class="text-text-secondary text-sm">Веб-камеры игроков пока не настроены</div>
      <div class="text-xs text-text-muted max-w-md mx-auto">
        Привяжите URL видеопотока или VDO.Ninja iframe к SteamID игрока, чтобы камера автоматически активировалась при переключении спектатора на него.
      </div>
      <button @click="openCreate" class="btn-gold text-sm mx-auto flex items-center gap-2">
        <Plus :size="14" /> Добавить первую камеру
      </button>
    </div>

    <!-- Camera List Table -->
    <div v-else class="card overflow-hidden p-0">
      <div class="overflow-x-auto">
        <table class="w-full">
        <thead>
          <tr class="border-b border-bg-border">
            <th class="text-left px-5 py-3 text-text-muted text-xs font-semibold uppercase tracking-wider">Игрок / SteamID</th>
            <th class="text-left px-5 py-3 text-text-muted text-xs font-semibold uppercase tracking-wider">Тип</th>
            <th class="text-left px-5 py-3 text-text-muted text-xs font-semibold uppercase tracking-wider">URL источника</th>
            <th class="text-center px-5 py-3 text-text-muted text-xs font-semibold uppercase tracking-wider">Статус</th>
            <th class="text-right px-5 py-3 text-text-muted text-xs font-semibold uppercase tracking-wider">Действия</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="cam in camList" :key="cam.steamid"
            class="border-b border-bg-border/50 hover:bg-bg-elevated/50 transition-colors group">
            <td class="px-5 py-3">
              <div class="flex items-center gap-3">
                <div class="w-8 h-8 rounded-full bg-bg-elevated border border-bg-border flex items-center justify-center overflow-hidden">
                  <img v-if="playerForSteamId(cam.steamid)?.avatar" :src="playerForSteamId(cam.steamid)?.avatar" class="w-full h-full object-cover" />
                  <UserCircle v-else :size="18" class="text-text-muted" />
                </div>
                <div>
                  <div class="font-semibold text-white text-sm flex items-center gap-2">
                    {{ playerForSteamId(cam.steamid)?.nickname || 'Не привязан к профилю' }}
                    <span v-if="playerTeamName(cam.steamid)" class="text-[11px] text-gold font-normal">
                      [{{ playerTeamName(cam.steamid) }}]
                    </span>
                  </div>
                  <div class="text-text-muted font-mono text-xs">{{ cam.steamid }}</div>
                </div>
              </div>
            </td>

            <td class="px-5 py-3">
              <span :class="[
                'text-[11px] uppercase font-mono px-2 py-0.5 rounded border font-medium',
                cam.kind === 'iframe'
                  ? 'bg-purple-500/10 text-purple-400 border-purple-500/30'
                  : 'bg-cyan-500/10 text-cyan-400 border-cyan-500/30'
              ]">
                {{ cam.kind === 'iframe' ? 'iframe / embed' : 'direct video' }}
              </span>
            </td>

            <td class="px-5 py-3">
              <div class="text-xs font-mono text-text-secondary truncate max-w-xs md:max-w-md" :title="cam.url">
                {{ cam.url }}
              </div>
            </td>

            <td class="px-5 py-3 text-center">
              <button @click="toggleEnabled(cam)"
                :title="cam.enabled ? 'Камера включена (кликните для отключения)' : 'Камера выключена (кликните для включения)'"
                :class="['px-2.5 py-1 rounded-full text-xs font-medium border inline-flex items-center gap-1.5 transition-colors',
                  cam.enabled
                    ? 'bg-status-success/10 border-status-success/30 text-status-success'
                    : 'bg-bg-elevated border-bg-border text-text-muted']">
                <span :class="['w-1.5 h-1.5 rounded-full', cam.enabled ? 'bg-status-success animate-pulse' : 'bg-text-muted']"></span>
                {{ cam.enabled ? 'Активна' : 'Отключена' }}
              </button>
            </td>

            <td class="px-5 py-3 text-right">
              <div class="flex gap-2 justify-end">
                <button @click="openPreview(cam)" title="Проверить воспроизведение потока"
                  class="text-xs px-2.5 py-1.5 rounded bg-bg-elevated border border-bg-border text-text-secondary hover:text-white hover:border-gold/30 transition-colors flex items-center gap-1">
                  <Play :size="12" /> Превью
                </button>
                <button @click="openEdit(cam)" title="Редактировать"
                  class="p-1.5 text-text-secondary hover:text-white transition-colors">
                  <Pencil :size="14" />
                </button>
                <button @click="remove(cam)" title="Удалить"
                  class="p-1.5 text-text-secondary hover:text-brand-red transition-colors">
                  <Trash2 :size="14" />
                </button>
              </div>
            </td>
          </tr>
        </tbody>
      </table>
      </div>
    </div>

    <!-- Create / Edit Modal -->
    <div v-if="draft" class="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div class="card w-full max-w-lg space-y-5">
        <div class="flex items-center justify-between">
          <h2 class="text-lg font-bold text-white flex items-center gap-2">
            <CameraIcon :size="18" class="text-gold" />
            {{ isEditing ? 'Редактировать камеру' : 'Добавить камеру игрока' }}
          </h2>
          <button @click="draft = null" class="text-text-muted hover:text-white transition-colors">
            <X :size="20" />
          </button>
        </div>

        <div v-if="formError" class="p-3 bg-brand-red/10 border border-brand-red/30 rounded-lg text-brand-red text-xs flex items-center gap-2">
          <AlertTriangle :size="14" class="shrink-0" />
          <span>{{ formError }}</span>
        </div>

        <div class="space-y-4">
          <!-- Quick player selection -->
          <div v-if="!isEditing">
            <label class="text-text-secondary text-xs mb-1.5 block">Выбрать зарегистрированного игрока (опционально)</label>
            <select v-model="selectedPlayerId" @change="onPlayerSelected" class="input-field text-sm">
              <option value="">— Выберите игрока для автозаполнения SteamID —</option>
              <option v-for="p in playerList" :key="p.id" :value="p.id">
                {{ p.nickname }} {{ p.steamid ? `(${p.steamid})` : '(нет SteamID)' }}
              </option>
            </select>
          </div>

          <!-- SteamID input -->
          <div>
            <label class="text-text-secondary text-xs mb-1.5 block">SteamID64 игрока *</label>
            <input v-model="draft.steamid" :disabled="isEditing"
              class="input-field font-mono text-sm disabled:opacity-60"
              placeholder="76561198000000000">
            <div class="text-[11px] text-text-muted mt-1">
              Уникальный цифровой SteamID64, передаваемый игрой CS2 через GSI при спектаторстве.
            </div>
          </div>

          <!-- Stream Kind -->
          <div>
            <label class="text-text-secondary text-xs mb-1.5 block">Тип воспроизведения источника *</label>
            <div class="grid grid-cols-2 gap-3">
              <label :class="['card p-3 cursor-pointer border flex flex-col gap-1 transition-all',
                draft.kind === 'video' ? 'border-gold bg-gold/5' : 'border-bg-border hover:border-bg-border/80']">
                <div class="flex items-center gap-2">
                  <input type="radio" v-model="draft.kind" value="video" class="accent-gold">
                  <span class="text-xs font-semibold text-white">Прямое видео (Video tag)</span>
                </div>
                <div class="text-[11px] text-text-muted pl-5">
                  MP4 или WebM в поддерживаемом браузером кодеке. Для WebRTC/VDO.Ninja используйте iframe; MJPEG и HLS здесь не поддерживаются.
                </div>
              </label>

              <label :class="['card p-3 cursor-pointer border flex flex-col gap-1 transition-all',
                draft.kind === 'iframe' ? 'border-gold bg-gold/5' : 'border-bg-border hover:border-bg-border/80']">
                <div class="flex items-center gap-2">
                  <input type="radio" v-model="draft.kind" value="iframe" class="accent-gold">
                  <span class="text-xs font-semibold text-white">Встраивание (Iframe embed)</span>
                </div>
                <div class="text-[11px] text-text-muted pl-5">
                  VDO.Ninja view-ссылка или сторонний плеер с поддержкой встраивания.
                </div>
              </label>
            </div>
          </div>

          <!-- URL input -->
          <div>
            <label class="text-text-secondary text-xs mb-1.5 block">URL источника камеры *</label>
            <input v-model="draft.url" class="input-field font-mono text-sm"
              placeholder="https://vdo.ninja/?view=cameraRoomId or http://192.168.1.50:8080/video">
            <div class="text-[11px] text-text-muted mt-1 space-y-0.5">
              <div>• Разрешены только протоколы <code class="text-gold font-mono">http://</code> и <code class="text-gold font-mono">https://</code>.</div>
              <div>• Указывайте прямую ссылку на трансляцию/view, <strong>не ссылку на управление/режиссера</strong>.</div>
            </div>
          </div>

          <!-- Enabled checkbox -->
          <div class="flex items-center gap-2 pt-1">
            <input type="checkbox" id="cam-enabled" v-model="draft.enabled" class="accent-gold w-4 h-4 rounded">
            <label for="cam-enabled" class="text-xs text-white select-none cursor-pointer">
              Камера активна (включена в ротации и спектаторе)
            </label>
          </div>
        </div>

        <div class="flex justify-end gap-3 pt-3 border-t border-bg-border">
          <button @click="draft = null" class="btn-outline text-xs px-4 py-2">
            Отмена
          </button>
          <button @click="save" :disabled="saving" class="btn-gold text-xs px-5 py-2 flex items-center gap-2 disabled:opacity-50">
            <Save :size="14" /> {{ saving ? 'Сохранение...' : 'Сохранить' }}
          </button>
        </div>
      </div>
    </div>

    <!-- Live Preview Modal -->
    <div v-if="previewCam" class="fixed inset-0 bg-black/75 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div class="card w-full max-w-2xl space-y-4">
        <div class="flex items-center justify-between">
          <div class="flex items-center gap-2">
            <Play :size="18" class="text-gold" />
            <h2 class="text-base font-bold text-white">Превью источника камеры</h2>
            <span class="text-xs font-mono text-text-muted">({{ previewCam.steamid }})</span>
          </div>
          <button @click="closePreview" class="text-text-muted hover:text-white transition-colors">
            <X :size="20" />
          </button>
        </div>

        <div class="text-xs text-text-secondary flex items-center justify-between bg-bg-elevated px-3 py-2 rounded-lg">
          <div class="truncate max-w-lg font-mono text-xs text-gold">{{ previewCam.url }}</div>
          <span class="text-[10px] uppercase font-mono px-2 py-0.5 rounded border border-bg-border bg-bg-card">
            {{ previewCam.kind }} · muted
          </span>
        </div>

        <!-- Video Player / Iframe Canvas -->
        <div class="relative w-full aspect-video bg-black rounded-lg overflow-hidden border border-bg-border flex items-center justify-center">
          <iframe
            v-if="previewCam.kind === 'iframe'"
            :src="previewUrl"
            class="w-full h-full border-0"
            allow="autoplay; fullscreen"
            sandbox="allow-scripts allow-same-origin"
            referrerpolicy="no-referrer"
            title="Предпросмотр камеры"
          ></iframe>

          <video
            v-else
            :src="previewUrl"
            autoplay
            muted
            playsinline
            controls
            class="w-full h-full object-contain"
            @error="onVideoError"
            @loadeddata="videoLoaded = true"
          ></video>

          <div v-if="videoError" class="absolute inset-0 bg-black/80 flex flex-col items-center justify-center p-6 text-center space-y-2">
            <AlertTriangle :size="28" class="text-brand-red" />
            <div class="text-sm font-semibold text-white">Ошибка загрузки видеопотока</div>
            <div class="text-xs text-text-muted max-w-md">
              Браузер не смог декодировать видео по этому URL. Убедитесь, что сервер доступен и отдаёт MP4/WebM с поддерживаемым кодеком. WebRTC требует iframe-плеера; обычный video-тег не принимает MJPEG или HLS.
            </div>
          </div>
        </div>

        <div class="text-xs text-text-muted flex items-start gap-2 bg-bg-base/50 p-3 rounded-lg">
          <Info :size="14" class="text-gold shrink-0 mt-0.5" />
          <span>
            Если в окне выше отображается белый экран или сообщение об отказе в соединении, данный сервис запрещает отображение внутри <code class="text-white font-mono">&lt;iframe&gt;</code> по соображениям безопасности (CSP/X-Frame-Options).
          </span>
        </div>

        <div class="flex justify-end">
          <button @click="closePreview" class="btn-outline text-xs px-4 py-2">
            Закрыть
          </button>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import {
  Camera as CameraIcon, Plus, RefreshCw, Pencil, Trash2,
  AlertTriangle, Info, X, Play, Save, UserCircle
} from 'lucide-vue-next'
import {
  cameras, players, teams,
  type Camera, type Player, type Team
} from '../api'

const camList = ref<Camera[]>([])
const playerList = ref<Player[]>([])
const teamList = ref<Team[]>([])

const loading = ref(false)
const saving = ref(false)
const error = ref('')
const formError = ref('')

const draft = ref<Camera | null>(null)
const isEditing = ref(false)
const selectedPlayerId = ref('')

const previewCam = ref<Camera | null>(null)
const previewUrl = computed(() => {
  if (!previewCam.value) return ''
  const u = new URL(previewCam.value.url)
  if (previewCam.value.kind === 'iframe' && /(^|\.)vdo\.ninja$/i.test(u.hostname)) u.searchParams.set('muted', '')
  return u.href
})
const videoLoaded = ref(false)
const videoError = ref(false)

const playerMap = computed(() => {
  const map: Record<string, Player> = {}
  for (const p of playerList.value) {
    if (p.steamid) {
      map[p.steamid.trim()] = p
    }
  }
  return map
})

const teamMap = computed(() => {
  const map: Record<string, Team> = {}
  for (const t of teamList.value) {
    map[t.id] = t
  }
  return map
})

const playerForSteamId = (steamid: string): Player | undefined => {
  return playerMap.value[steamid.trim()]
}

const playerTeamName = (steamid: string): string => {
  const p = playerForSteamId(steamid)
  if (!p || !p.team_id) return ''
  const t = teamMap.value[p.team_id]
  return t ? (t.short_name || t.name) : ''
}

const reload = async () => {
  loading.value = true
  error.value = ''
  try {
    const [cams, pls, tms] = await Promise.all([
      cameras.list(),
      players.list().catch(() => []),
      teams.list().catch(() => []),
    ])
    camList.value = cams
    playerList.value = pls
    teamList.value = tms
  } catch (e) {
    error.value = `Ошибка загрузки камер: ${String(e)}`
  } finally {
    loading.value = false
  }
}

const openCreate = () => {
  isEditing.value = false
  selectedPlayerId.value = ''
  formError.value = ''
  draft.value = {
    steamid: '',
    url: '',
    kind: 'video',
    enabled: true,
  }
}

const openEdit = (cam: Camera) => {
  isEditing.value = true
  formError.value = ''
  const p = playerForSteamId(cam.steamid)
  selectedPlayerId.value = p ? p.id : ''
  draft.value = { ...cam }
}

const onPlayerSelected = () => {
  if (!draft.value) return
  const p = playerList.value.find(x => x.id === selectedPlayerId.value)
  if (p && p.steamid) {
    draft.value.steamid = p.steamid.trim()
  }
}

const validateForm = (cam: Camera): string | null => {
  const steamid = cam.steamid.trim()
  if (!steamid) {
    return 'Укажите SteamID64 игрока'
  }
  if (!/^\d{17}$/.test(steamid)) {
    return 'SteamID64 должен содержать ровно 17 цифр'
  }

  const url = cam.url.trim()
  if (!url) {
    return 'Укажите URL источника камеры'
  }

  try {
    const parsed = new URL(url)
    if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
      return 'URL должен начинаться с http:// или https://'
    }
    if (parsed.username || parsed.password) return 'URL не должен содержать логин или пароль'
    if (!parsed.hostname) {
      return 'URL должен содержать корректный хост'
    }
  } catch {
    return 'Некорректный формат URL'
  }

  if (cam.kind !== 'video' && cam.kind !== 'iframe') {
    return 'Тип источника должен быть video или iframe'
  }

  return null
}

const save = async () => {
  if (!draft.value) return
  formError.value = ''

  const vErr = validateForm(draft.value)
  if (vErr) {
    formError.value = vErr
    return
  }

  saving.value = true
  try {
    const payload: Camera = {
      steamid: draft.value.steamid.trim(),
      url: draft.value.url.trim(),
      kind: draft.value.kind,
      enabled: draft.value.enabled,
    }
    await cameras.save(payload)
    draft.value = null
    await reload()
  } catch (e) {
    formError.value = `Ошибка сохранения: ${String(e)}`
  } finally {
    saving.value = false
  }
}

const toggleEnabled = async (cam: Camera) => {
  try {
    const updated: Camera = {
      ...cam,
      enabled: !cam.enabled,
    }
    await cameras.save(updated)
    cam.enabled = updated.enabled
  } catch (e) {
    error.value = `Не удалось переключить статус: ${String(e)}`
  }
}

const remove = async (cam: Camera) => {
  const name = playerForSteamId(cam.steamid)?.nickname || cam.steamid
  if (!confirm(`Удалить конфигурацию веб-камеры для ${name}?`)) return
  try {
    await cameras.remove(cam.steamid)
    await reload()
  } catch (e) {
    error.value = `Ошибка удаления: ${String(e)}`
  }
}

const openPreview = (cam: Camera) => {
  videoLoaded.value = false
  videoError.value = false
  previewCam.value = cam
}

const closePreview = () => {
  previewCam.value = null
  videoLoaded.value = false
  videoError.value = false
}

const onVideoError = () => {
  videoError.value = true
}

onMounted(async () => {
  await reload()
})
</script>
