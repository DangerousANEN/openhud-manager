<template>
  <div class="p-6 space-y-6">
    <div class="flex items-center justify-between">
      <div>
        <div class="section-label">База данных</div>
        <h1 class="text-2xl font-bold text-white">Игроки</h1>
      </div>
      <div class="flex gap-3">
        <div class="relative">
          <Search :size="14" class="absolute left-3 top-1/2 -translate-y-1/2 text-text-muted" />
          <input v-model="search" class="input-field pl-8 w-52" placeholder="Поиск по нику...">
        </div>
        <button @click="openCreate" class="btn-gold flex items-center gap-2">
          <Plus :size="14" /> Добавить
        </button>
      </div>
    </div>

    <div v-if="error" class="card border-brand-red/40 text-brand-red text-sm flex items-center gap-2">
      <AlertTriangle :size="15" /> {{ error }}
    </div>

    <div v-if="loading" class="text-text-muted text-sm">Загрузка...</div>

    <div v-else-if="list.length === 0" class="card text-center py-12 space-y-3">
      <UserCircle :size="32" class="text-text-muted mx-auto" />
      <div class="text-text-secondary text-sm">Игроков пока нет</div>
      <button @click="openCreate" class="btn-gold text-sm mx-auto flex items-center gap-2">
        <Plus :size="14" /> Добавить первого
      </button>
    </div>

    <div v-else class="card overflow-hidden p-0">
      <table class="w-full">
        <thead>
          <tr class="border-b border-bg-border">
            <th class="text-left px-5 py-3 text-text-muted text-xs font-semibold uppercase tracking-wider">Игрок</th>
            <th class="text-left px-5 py-3 text-text-muted text-xs font-semibold uppercase tracking-wider">Команда</th>
            <th class="text-left px-5 py-3 text-text-muted text-xs font-semibold uppercase tracking-wider">Страна</th>
            <th class="text-left px-5 py-3 text-text-muted text-xs font-semibold uppercase tracking-wider">Steam ID</th>
            <th class="text-left px-5 py-3 text-text-muted text-xs font-semibold uppercase tracking-wider">Камера</th>
            <th class="px-5 py-3"></th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="p in filteredPlayers" :key="p.id"
            class="border-b border-bg-border/50 hover:bg-bg-elevated/50 transition-colors group">
            <td class="px-5 py-3">
              <div class="flex items-center gap-3">
                <div class="w-8 h-8 rounded-full bg-bg-elevated border border-bg-border flex items-center justify-center overflow-hidden">
                  <img v-if="p.avatar" :src="p.avatar" :alt="p.nickname" class="w-full h-full object-cover" />
                  <UserCircle v-else :size="18" class="text-text-muted" />
                </div>
                <div>
                  <div class="font-semibold text-white text-sm">{{ p.nickname }}</div>
                  <div class="text-text-muted text-xs">{{ fullName(p) || '—' }}</div>
                </div>
              </div>
            </td>
            <td class="px-5 py-3 text-sm text-text-secondary">{{ teamName(p.team_id) }}</td>
            <td class="px-5 py-3 text-sm text-text-secondary">{{ p.country || '—' }}</td>
            <td class="px-5 py-3 text-xs font-mono text-text-muted">{{ p.steamid || '—' }}</td>
            <td class="px-5 py-3 text-xs">
              <span v-if="p.steamid && camMap[p.steamid]" :class="[
                'inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-mono border',
                camMap[p.steamid].enabled
                  ? 'bg-gold/10 text-gold border-gold/30'
                  : 'bg-bg-elevated text-text-muted border-bg-border'
              ]">
                <Camera :size="11" />
                {{ camMap[p.steamid].kind }}
              </span>
              <span v-else class="text-text-muted text-xs">—</span>
            </td>
            <td class="px-5 py-3 opacity-0 group-hover:opacity-100 transition-opacity">
              <div class="flex gap-3 justify-end">
                <button @click="openEdit(p)" class="text-text-secondary hover:text-white transition-colors">
                  <Pencil :size="13" />
                </button>
                <button @click="remove(p)" class="text-text-secondary hover:text-brand-red transition-colors">
                  <Trash2 :size="13" />
                </button>
              </div>
            </td>
          </tr>
        </tbody>
      </table>
    </div>

    <!-- Editor modal -->
    <div v-if="draft" class="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50">
      <div class="card w-[520px] space-y-5">
        <div class="flex items-center justify-between">
          <h2 class="text-lg font-bold text-white">{{ draft.id ? 'Изменить игрока' : 'Новый игрок' }}</h2>
          <button @click="draft = null" class="text-text-muted hover:text-white transition-colors">
            <X :size="20" />
          </button>
        </div>

        <div class="space-y-3">
          <div class="grid grid-cols-2 gap-3">
            <div>
              <label class="text-text-secondary text-xs mb-1.5 block">Ник *</label>
              <input v-model="draft.nickname" class="input-field" placeholder="s1mple" @keyup.enter="save">
            </div>
            <div>
              <label class="text-text-secondary text-xs mb-1.5 block">Steam ID64</label>
              <input v-model="draft.steamid" class="input-field font-mono text-xs" placeholder="76561198...">
            </div>
          </div>
          <div class="grid grid-cols-2 gap-3">
            <div>
              <label class="text-text-secondary text-xs mb-1.5 block">Имя</label>
              <input v-model="draft.first_name" class="input-field" placeholder="Oleksandr">
            </div>
            <div>
              <label class="text-text-secondary text-xs mb-1.5 block">Фамилия</label>
              <input v-model="draft.last_name" class="input-field" placeholder="Kostyliev">
            </div>
          </div>
          <div class="grid grid-cols-2 gap-3">
            <div>
              <label class="text-text-secondary text-xs mb-1.5 block">Команда</label>
              <select v-model="draft.team_id" class="input-field">
                <option :value="null">— Без команды —</option>
                <option v-for="t in teamList" :key="t.id" :value="t.id">{{ t.name }}</option>
              </select>
            </div>
            <div>
              <label class="text-text-secondary text-xs mb-1.5 block">Страна</label>
              <input v-model="draft.country" class="input-field" placeholder="UA" maxlength="3">
            </div>
          </div>
          <div>
            <div class="flex items-center justify-between mb-1.5">
              <label class="text-text-secondary text-xs block">Аватар или CS2 Агент</label>
              <select @change="(e: any) => { if (e.target.value && draft) draft.avatar = e.target.value }" class="bg-bg-input border border-bg-border/60 text-gold text-xs px-2 py-0.5 rounded cursor-pointer">
                <option value="">— Быстрый выбор CS2 Агента —</option>
                <optgroup label="Counter-Terrorists (CT)">
                  <option value="assets/agents/ct_special_agent_ava_fbi_swat.png">Special Agent Ava | FBI SWAT</option>
                  <option value="assets/agents/ct_cmdr_mae_dead_cold_jamison_swat.png">Cmdr. Mae Jamison | SWAT</option>
                  <option value="assets/agents/ct_1st_lieutenant_farlow_swat.png">1st Lieutenant Farlow | SWAT</option>
                  <option value="assets/agents/ct_michael_syfers_fbi_sniper.png">Michael Syfers | FBI Sniper</option>
                  <option value="assets/agents/ct_markus_delrow_fbi_hrg.png">Markus Delrow | FBI HRT</option>
                  <option value="assets/agents/ct_lieutenant_rex_krikey_nswc_seal.png">Lt. Rex Krikey | SEAL</option>
                  <option value="assets/agents/ct_buckshot_nswc_seal.png">Buckshot | NSWC SEAL</option>
                  <option value="assets/agents/ct_3rd_commando_company_ksk.png">3rd Commando Company | KSK</option>
                  <option value="assets/agents/ct_aspirant_gendarmerie_nationale.png">Aspirant | Gendarmerie</option>
                </optgroup>
                <optgroup label="Terrorists (T)">
                  <option value="assets/agents/t_sir_bloody_miami_darryl_the_professionals.png">Sir Bloody Miami Darryl | The Professionals</option>
                  <option value="assets/agents/t_bloody_darryl_the_strapped_the_professionals.png">Bloody Darryl The Strapped | The Professionals</option>
                  <option value="assets/agents/t_the_doctor_romanov_sabre.png">Doctor Romanov | Sabre</option>
                  <option value="assets/agents/t_rezan_the_ready_sabre.png">Rezan The Ready | Sabre</option>
                  <option value="assets/agents/t_blackwolf_sabre.png">Blackwolf | Sabre</option>
                  <option value="assets/agents/t_maximus_sabre.png">Maximus | Sabre</option>
                  <option value="assets/agents/t_dragomir_sabre.png">Dragomir | Sabre</option>
                  <option value="assets/agents/t_safecracker_voltzmann_the_professionals.png">Safecracker Voltzmann | The Professionals</option>
                  <option value="assets/agents/t_getaway_sally_the_professionals.png">Getaway Sally | The Professionals</option>
                  <option value="assets/agents/t_arno_the_overgrown_guerrilla_warfare.png">Arno The Overgrown | Guerrilla</option>
                  <option value="assets/agents/t_mr_muhlik_elite_crew.png">Mr. Muhlik | Elite Crew</option>
                </optgroup>
              </select>
            </div>
            <div class="flex gap-2">
              <input v-model="draft.avatar" class="input-field text-xs flex-1 font-mono" placeholder="assets/agents/... или https://...">
              <button type="button" @click="fetchSteamAvatar" :disabled="!draft.steamid || fetchingSteam" class="btn-outline text-xs px-2.5 py-1 whitespace-nowrap text-gold hover:text-white" title="Загрузить аватар игрока из профиля Steam">
                {{ fetchingSteam ? '...' : 'Steam 📥' }}
              </button>
            </div>
          </div>

          <div class="border-t border-bg-border/60 pt-3 space-y-2">
            <div class="flex items-center justify-between">
              <label class="text-text-secondary text-xs font-semibold flex items-center gap-1.5">
                <Camera :size="13" class="text-gold" />
                Веб-камера игрока (по SteamID)
              </label>
              <span v-if="draft.steamid && camMap[draft.steamid.trim()]" class="text-[10px] text-status-success font-medium">
                Настроена ({{ camMap[draft.steamid.trim()].kind }})
              </span>
            </div>
            <div class="grid grid-cols-3 gap-2">
              <input v-model="playerCamUrl" class="input-field col-span-2 text-xs font-mono" placeholder="https://vdo.ninja/?view=... или video URL">
              <select v-model="playerCamKind" class="input-field text-xs">
                <option value="video">Direct Video</option>
                <option value="iframe">Iframe Embed</option>
              </select>
            </div>
            <div class="text-[11px] text-text-muted flex items-center justify-between">
              <span>Для сохранения камеры укажите корректный SteamID64 и http/https URL.</span>
              <router-link to="/cameras" class="text-gold hover:underline">Все камеры →</router-link>
            </div>
          </div>
        </div>

        <div class="flex gap-3 pt-1">
          <button @click="draft = null" class="btn-outline flex-1">Отмена</button>
          <button @click="save" :disabled="!draft.nickname.trim() || saving" class="btn-gold flex-1 disabled:opacity-40">
            {{ saving ? 'Сохранение...' : 'Сохранить' }}
          </button>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import { Search, Plus, UserCircle, Pencil, Trash2, X, AlertTriangle, Camera } from 'lucide-vue-next'
import { players as playersApi, teams as teamsApi, cameras as camerasApi, isDesktop, type Player, type Team, type Camera as CameraSource } from '../api'

const search = ref('')
const list = ref<Player[]>([])
const teamList = ref<Team[]>([])
const camList = ref<CameraSource[]>([])
const loading = ref(true)
const saving = ref(false)
const error = ref('')
const draft = ref<Player | null>(null)
const playerCamUrl = ref('')
const playerCamKind = ref<'video' | 'iframe'>('video')
const fetchingSteam = ref(false)

const fetchSteamAvatar = async () => {
  if (!draft.value || !draft.value.steamid) return
  const sid = draft.value.steamid.trim()
  if (!/^\d{17}$/.test(sid)) {
    alert('Укажите корректный 17-значный SteamID64 (начинается с 7656119...)')
    return
  }
  fetchingSteam.value = true
  try {
    const res = await fetch(`https://steamcommunity.com/profiles/${sid}/?xml=1`)
    if (!res.ok) throw new Error(`HTTP ${res.status}`)
    const text = await res.text()
    const match = text.match(/<avatarFull><!\[CDATA\[(.*?)\]\]><\/avatarFull>/) || text.match(/<avatarFull>(.*?)<\/avatarFull>/)
    if (match && match[1]) {
      draft.value.avatar = match[1]
    } else {
      alert('Не удалось получить аватар из профиля Steam. Проверьте открытость профиля.')
    }
  } catch (e: any) {
    alert('Ошибка запроса к Steam: ' + (e.message || String(e)))
  } finally {
    fetchingSteam.value = false
  }
}

const camMap = computed(() => {
  const map: Record<string, CameraSource> = {}
  for (const c of camList.value) {
    map[c.steamid.trim()] = c
  }
  return map
})

const blank = (): Player => ({
  id: '', steamid: '', nickname: '', first_name: '',
  last_name: '', country: '', team_id: null, avatar: '',
})

const fullName = (p: Player) => [p.first_name, p.last_name].filter(Boolean).join(' ')

const teamName = (id: string | null) =>
  id ? (teamList.value.find(t => t.id === id)?.name ?? '—') : '—'

const filteredPlayers = computed(() => {
  const q = search.value.trim().toLowerCase()
  if (!q) return list.value
  return list.value.filter(p =>
    p.nickname.toLowerCase().includes(q) || fullName(p).toLowerCase().includes(q)
  )
})

const load = async () => {
  if (!isDesktop) {
    loading.value = false
    error.value = 'Откройте приложение в десктоп-режиме — база доступна только там.'
    return
  }
  loading.value = true
  error.value = ''
  try {
    const [p, t, c] = await Promise.all([
      playersApi.list(),
      teamsApi.list(),
      camerasApi.list().catch(() => []),
    ])
    list.value = p
    teamList.value = t
    camList.value = c
  } catch (e) {
    error.value = String(e)
  } finally {
    loading.value = false
  }
}

const openCreate = () => {
  draft.value = blank()
  playerCamUrl.value = ''
  playerCamKind.value = 'video'
}

const openEdit = (p: Player) => {
  draft.value = { ...p }
  const existingCam = p.steamid ? camMap.value[p.steamid.trim()] : null
  if (existingCam) {
    playerCamUrl.value = existingCam.url
    playerCamKind.value = existingCam.kind
  } else {
    playerCamUrl.value = ''
    playerCamKind.value = 'video'
  }
}

const save = async () => {
  if (!draft.value || !draft.value.nickname.trim()) return
  saving.value = true
  error.value = ''
  try {
    const saved = await playersApi.save(draft.value)
    const idx = list.value.findIndex(p => p.id === saved.id)
    if (idx >= 0) list.value[idx] = saved
    else list.value.push(saved)
    list.value.sort((a, b) => a.nickname.localeCompare(b.nickname))

    // Save camera if SteamID and camera URL are provided
    if (saved.steamid && saved.steamid.trim() && playerCamUrl.value.trim()) {
      try {
        const camSaved = await camerasApi.save({
          steamid: saved.steamid.trim(),
          url: playerCamUrl.value.trim(),
          kind: playerCamKind.value,
          enabled: true,
        })
        const camIdx = camList.value.findIndex(c => c.steamid === camSaved.steamid)
        if (camIdx >= 0) camList.value[camIdx] = camSaved
        else camList.value.push(camSaved)
      } catch (camErr) {
        error.value = `Игрок сохранён, но камера не сохранена: ${String(camErr)}`
        return
      }
    }

    draft.value = null
  } catch (e) {
    error.value = String(e)
  } finally {
    saving.value = false
  }
}

const remove = async (p: Player) => {
  if (!confirm(`Удалить игрока "${p.nickname}"?`)) return
  try {
    await playersApi.remove(p.id)
    list.value = list.value.filter(x => x.id !== p.id)
  } catch (e) {
    error.value = String(e)
  }
}

onMounted(load)
</script>
