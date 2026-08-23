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
            <label class="text-text-secondary text-xs mb-1.5 block">Аватар (URL)</label>
            <input v-model="draft.avatar" class="input-field" placeholder="https://...">
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
import { Search, Plus, UserCircle, Pencil, Trash2, X, AlertTriangle } from 'lucide-vue-next'
import { players as playersApi, teams as teamsApi, isDesktop, type Player, type Team } from '../api'

const search = ref('')
const list = ref<Player[]>([])
const teamList = ref<Team[]>([])
const loading = ref(true)
const saving = ref(false)
const error = ref('')
const draft = ref<Player | null>(null)

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
    const [p, t] = await Promise.all([playersApi.list(), teamsApi.list()])
    list.value = p
    teamList.value = t
  } catch (e) {
    error.value = String(e)
  } finally {
    loading.value = false
  }
}

const openCreate = () => { draft.value = blank() }
const openEdit = (p: Player) => { draft.value = { ...p } }

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
