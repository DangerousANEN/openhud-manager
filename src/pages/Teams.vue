<template>
  <div class="p-6 space-y-6">
    <div class="flex items-center justify-between">
      <div>
        <div class="section-label">База данных</div>
        <h1 class="text-2xl font-bold text-white">Команды</h1>
      </div>
      <div class="flex gap-3">
        <div class="relative">
          <Search :size="14" class="absolute left-3 top-1/2 -translate-y-1/2 text-text-muted" />
          <input v-model="search" class="input-field pl-8 w-52" placeholder="Поиск...">
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

    <div v-else class="grid grid-cols-3 gap-4">
      <div v-for="team in filteredTeams" :key="team.id"
        class="card group hover:border-gold/30 transition-all">
        <div class="flex items-center gap-3 mb-4">
          <div class="w-12 h-12 rounded-xl bg-bg-elevated border border-bg-border flex items-center justify-center overflow-hidden group-hover:border-gold/40 transition-colors">
            <img v-if="team.logo" :src="team.logo" :alt="team.name" class="w-full h-full object-contain" />
            <Shield v-else :size="22" class="text-text-secondary group-hover:text-gold transition-colors" />
          </div>
          <div class="flex-1 min-w-0">
            <div class="font-bold text-white truncate">{{ team.name }}</div>
            <div class="text-xs text-text-secondary">
              {{ team.short_name || '—' }}<template v-if="team.country"> · {{ team.country }}</template>
            </div>
          </div>
        </div>
        <div class="grid grid-cols-2 gap-2 text-center border-t border-bg-border pt-3">
          <div>
            <div class="text-white font-semibold text-sm">{{ rosterCount(team.id) }}</div>
            <div class="text-text-muted text-[10px]">Игроков</div>
          </div>
          <div>
            <div class="text-white font-semibold text-sm">{{ matchCount(team.id) }}</div>
            <div class="text-text-muted text-[10px]">Матчей</div>
          </div>
        </div>
        <div class="flex gap-2 mt-3 opacity-0 group-hover:opacity-100 transition-opacity">
          <button @click="openEdit(team)" class="btn-outline flex-1 text-xs py-1.5 flex items-center justify-center gap-1">
            <Pencil :size="12" /> Изменить
          </button>
          <button @click="remove(team)" class="btn-outline text-xs py-1.5 px-3 text-brand-red border-brand-red/30 hover:bg-brand-red/10">
            <Trash2 :size="12" />
          </button>
        </div>
      </div>

      <button @click="openCreate"
        class="card border-dashed hover:border-gold/40 hover:bg-gold/5 transition-all flex flex-col items-center justify-center gap-2 min-h-[130px]">
        <Plus :size="24" class="text-text-muted" />
        <span class="text-text-muted text-sm">Добавить команду</span>
      </button>
    </div>

    <!-- Editor modal -->
    <div v-if="draft" class="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50">
      <div class="card w-[460px] space-y-5">
        <div class="flex items-center justify-between">
          <h2 class="text-lg font-bold text-white">{{ draft.id ? 'Изменить команду' : 'Новая команда' }}</h2>
          <button @click="draft = null" class="text-text-muted hover:text-white transition-colors">
            <X :size="20" />
          </button>
        </div>

        <div class="space-y-3">
          <div>
            <label class="text-text-secondary text-xs mb-1.5 block">Название *</label>
            <input v-model="draft.name" class="input-field" placeholder="Natus Vincere" @keyup.enter="save">
          </div>
          <div class="grid grid-cols-2 gap-3">
            <div>
              <label class="text-text-secondary text-xs mb-1.5 block">Тег</label>
              <input v-model="draft.short_name" class="input-field" placeholder="NAVI">
            </div>
            <div>
              <label class="text-text-secondary text-xs mb-1.5 block">Страна</label>
              <input v-model="draft.country" class="input-field" placeholder="UA" maxlength="3">
            </div>
          </div>
          <div>
            <label class="text-text-secondary text-xs mb-1.5 block">Логотип (URL или data:image)</label>
            <input v-model="draft.logo" class="input-field" placeholder="https://...">
          </div>
        </div>

        <div class="flex gap-3 pt-1">
          <button @click="draft = null" class="btn-outline flex-1">Отмена</button>
          <button @click="save" :disabled="!draft.name.trim() || saving" class="btn-gold flex-1 disabled:opacity-40">
            {{ saving ? 'Сохранение...' : 'Сохранить' }}
          </button>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import { Search, Plus, Shield, Pencil, Trash2, X, AlertTriangle } from 'lucide-vue-next'
import { teams as teamsApi, players as playersApi, matches as matchesApi, isDesktop, type Team, type Player, type Match } from '../api'

const search = ref('')
const list = ref<Team[]>([])
const roster = ref<Player[]>([])
const matchList = ref<Match[]>([])
const loading = ref(true)
const saving = ref(false)
const error = ref('')
const draft = ref<Team | null>(null)

const blank = (): Team => ({ id: '', name: '', short_name: '', country: '', logo: '' })

const filteredTeams = computed(() => {
  const q = search.value.trim().toLowerCase()
  if (!q) return list.value
  return list.value.filter(t =>
    t.name.toLowerCase().includes(q) || t.short_name.toLowerCase().includes(q)
  )
})

const rosterCount = (teamId: string) => roster.value.filter(p => p.team_id === teamId).length
const matchCount = (teamId: string) =>
  matchList.value.filter(m => m.left_team_id === teamId || m.right_team_id === teamId).length

const load = async () => {
  if (!isDesktop) {
    loading.value = false
    error.value = 'Откройте приложение в десктоп-режиме — база доступна только там.'
    return
  }
  loading.value = true
  error.value = ''
  try {
    const [t, p, m] = await Promise.all([teamsApi.list(), playersApi.list(), matchesApi.list()])
    list.value = t
    roster.value = p
    matchList.value = m
  } catch (e) {
    error.value = String(e)
  } finally {
    loading.value = false
  }
}

const openCreate = () => { draft.value = blank() }
const openEdit = (t: Team) => { draft.value = { ...t } }

const save = async () => {
  if (!draft.value || !draft.value.name.trim()) return
  saving.value = true
  error.value = ''
  try {
    const saved = await teamsApi.save(draft.value)
    const idx = list.value.findIndex(t => t.id === saved.id)
    if (idx >= 0) list.value[idx] = saved
    else list.value.push(saved)
    list.value.sort((a, b) => a.name.localeCompare(b.name))
    draft.value = null
  } catch (e) {
    error.value = String(e)
  } finally {
    saving.value = false
  }
}

const remove = async (t: Team) => {
  if (!confirm(`Удалить команду "${t.name}"?`)) return
  try {
    await teamsApi.remove(t.id)
    list.value = list.value.filter(x => x.id !== t.id)
  } catch (e) {
    error.value = String(e)
  }
}

onMounted(load)
</script>
