<template>
  <div class="p-6 space-y-6">
    <div class="flex items-center justify-between">
      <div>
        <div class="section-label">Управление</div>
        <h1 class="text-2xl font-bold text-white">Матчи</h1>
      </div>
      <button @click="openCreate" class="btn-gold flex items-center gap-2">
        <Plus :size="15" /> Новый матч
      </button>
    </div>

    <div class="flex items-center gap-3">
      <div class="flex gap-1 bg-bg-card border border-bg-border rounded-lg p-1 w-fit">
        <button v-for="tab in tabs" :key="tab.id"
          @click="activeTab = tab.id"
          :class="['px-4 py-1.5 rounded text-sm font-medium transition-all',
            activeTab === tab.id ? 'bg-bg-elevated text-white' : 'text-text-secondary hover:text-white']">
          {{ tab.label }}
          <span class="ml-1.5 text-[10px] text-text-muted">{{ countFor(tab.id) }}</span>
        </button>
      </div>
      <div v-if="error" class="text-xs text-brand-red">{{ error }}</div>
    </div>

    <div v-if="loading" class="card text-center py-10 text-text-muted text-sm">Загрузка…</div>

    <div v-else-if="visibleMatches.length === 0" class="card text-center py-12 space-y-3">
      <Swords :size="28" class="mx-auto text-text-muted" />
      <div class="text-text-secondary text-sm">
        {{ list.length === 0 ? 'Матчей пока нет' : 'В этой категории пусто' }}
      </div>
      <button v-if="list.length === 0" @click="openCreate" class="btn-gold text-xs mx-auto">
        Создать первый матч
      </button>
    </div>

    <div v-else class="space-y-3">
      <div v-for="m in visibleMatches" :key="m.id"
        :class="['card flex items-center gap-5 transition-colors',
          m.current ? 'border-gold/40 bg-gold/[0.03]' : 'hover:border-bg-elevated']">

        <span :class="['text-xs font-bold uppercase px-2 py-1 rounded flex-shrink-0 border',
          m.match_type === 'bo3' ? 'bg-gold/10 text-gold border-gold/30' :
          m.match_type === 'bo5' ? 'bg-brand-red/10 text-brand-red border-brand-red/30' :
          'bg-bg-elevated text-text-secondary border-bg-border']">
          {{ m.match_type.toUpperCase() }}
        </span>

        <div class="flex-1 flex items-center gap-4 min-w-0">
          <div class="flex items-center gap-2 min-w-[140px]">
            <div class="w-7 h-7 rounded bg-bg-elevated border border-bg-border flex items-center justify-center overflow-hidden shrink-0">
              <img v-if="logoOf(m.left_team_id)" :src="logoOf(m.left_team_id)" alt="" class="w-full h-full object-contain" />
              <Shield v-else :size="13" class="text-blue-400" />
            </div>
            <span class="font-semibold text-white text-sm truncate">{{ nameOf(m.left_team_id) }}</span>
          </div>
          <span class="text-text-muted text-sm font-light shrink-0">vs</span>
          <div class="flex items-center gap-2 min-w-[140px]">
            <div class="w-7 h-7 rounded bg-bg-elevated border border-bg-border flex items-center justify-center overflow-hidden shrink-0">
              <img v-if="logoOf(m.right_team_id)" :src="logoOf(m.right_team_id)" alt="" class="w-full h-full object-contain" />
              <Crosshair v-else :size="13" class="text-orange-400" />
            </div>
            <span class="font-semibold text-white text-sm truncate">{{ nameOf(m.right_team_id) }}</span>
          </div>
        </div>

        <div class="flex items-center gap-2">
          <button @click="bump(m, 'left', -1)" class="score-btn">−</button>
          <div class="text-lg font-black text-white tabular-nums w-16 text-center">
            {{ m.left_score }} : {{ m.right_score }}
          </div>
          <button @click="bump(m, 'right', 1)" class="score-btn">+</button>
        </div>

        <div v-if="m.current"
          class="text-xs font-medium px-2.5 py-1 rounded-full border bg-status-success/10 border-status-success/30 text-status-success flex items-center gap-1.5">
          <span class="w-1.5 h-1.5 rounded-full bg-status-success animate-pulse"></span> LIVE
        </div>

        <div class="flex gap-2 flex-shrink-0">
          <button v-if="!m.current" @click="setCurrent(m)" class="btn-outline text-xs py-1.5 px-3 flex items-center gap-1">
            <Radio :size="12" /> Сделать текущим
          </button>
          <button @click="startEdit(m)" class="btn-outline text-xs py-1.5 px-3 flex items-center gap-1">
            <Pencil :size="12" />
          </button>
          <button @click="remove(m)" class="btn-outline text-xs py-1.5 px-3 flex items-center gap-1 hover:!text-brand-red hover:!border-brand-red/40">
            <Trash2 :size="12" />
          </button>
        </div>
      </div>
    </div>

    <!-- Create / edit modal -->
    <div v-if="showForm" class="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50"
      @click.self="showForm = false">
      <div class="card w-[480px] space-y-5">
        <div class="flex items-center justify-between">
          <h2 class="text-lg font-bold text-white">{{ draft.id ? 'Изменить матч' : 'Новый матч' }}</h2>
          <button @click="showForm = false" class="text-text-muted hover:text-white transition-colors">
            <X :size="20" />
          </button>
        </div>

        <div v-if="teamList.length === 0" class="text-xs text-brand-red">
          Сначала добавьте команды в разделе «Команды».
        </div>

        <div class="grid grid-cols-2 gap-4">
          <div>
            <label class="text-text-secondary text-xs mb-1.5 block">Команда 1</label>
            <select v-model="draft.left_team_id" class="input-field">
              <option :value="null">— выбрать —</option>
              <option v-for="t in teamList" :key="t.id" :value="t.id">{{ t.name }}</option>
            </select>
          </div>
          <div>
            <label class="text-text-secondary text-xs mb-1.5 block">Команда 2</label>
            <select v-model="draft.right_team_id" class="input-field">
              <option :value="null">— выбрать —</option>
              <option v-for="t in teamList" :key="t.id" :value="t.id">{{ t.name }}</option>
            </select>
          </div>
        </div>

        <div>
          <label class="text-text-secondary text-xs mb-2 block">Формат</label>
          <div class="flex gap-2">
            <button v-for="fmt in ['bo1', 'bo3', 'bo5']" :key="fmt"
              @click="draft.match_type = fmt"
              :class="['flex-1 py-2 rounded-btn border text-sm font-semibold transition-all uppercase',
                draft.match_type === fmt
                  ? 'bg-gold/10 border-gold text-gold'
                  : 'border-bg-border text-text-secondary hover:border-gold/40']">
              {{ fmt }}
            </button>
          </div>
        </div>

        <div class="grid grid-cols-2 gap-4">
          <div>
            <label class="text-text-secondary text-xs mb-1.5 block">Счёт 1</label>
            <input v-model.number="draft.left_score" type="number" min="0" class="input-field" />
          </div>
          <div>
            <label class="text-text-secondary text-xs mb-1.5 block">Счёт 2</label>
            <input v-model.number="draft.right_score" type="number" min="0" class="input-field" />
          </div>
        </div>

        <label class="flex items-center gap-2 text-sm text-text-secondary cursor-pointer">
          <input v-model="draft.current" type="checkbox" class="accent-gold" />
          Сделать текущим матчем (для оверлеев)
        </label>

        <div class="flex gap-3 pt-2">
          <button @click="showForm = false" class="btn-outline flex-1">Отмена</button>
          <button @click="save" :disabled="saving || !canSave" class="btn-gold flex-1 disabled:opacity-40">
            {{ saving ? 'Сохранение…' : 'Сохранить' }}
          </button>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import { Plus, Shield, Crosshair, Pencil, Trash2, X, Swords, Radio } from 'lucide-vue-next'
import { matches, teams, isDesktop, type Match, type Team } from '../api'

const list = ref<Match[]>([])
const teamList = ref<Team[]>([])
const loading = ref(true)
const saving = ref(false)
const error = ref('')
const showForm = ref(false)
const activeTab = ref<'active' | 'finished' | 'all'>('active')

const tabs = [
  { id: 'active' as const, label: 'Активные' },
  { id: 'finished' as const, label: 'Завершённые' },
  { id: 'all' as const, label: 'Все' },
]

const emptyDraft = (): Match => ({
  id: '',
  left_team_id: null,
  right_team_id: null,
  left_score: 0,
  right_score: 0,
  match_type: 'bo3',
  current: false,
})
const draft = ref<Match>(emptyDraft())

/** A match counts as finished once someone reached the maps needed to win. */
const needed = (type: string) => (type === 'bo5' ? 3 : type === 'bo3' ? 2 : 1)
const isFinished = (m: Match) =>
  m.left_score >= needed(m.match_type) || m.right_score >= needed(m.match_type)

const filterFor = (tab: string) => (m: Match) =>
  tab === 'all' ? true : tab === 'finished' ? isFinished(m) : !isFinished(m)

const visibleMatches = computed(() => list.value.filter(filterFor(activeTab.value)))
const countFor = (tab: string) => list.value.filter(filterFor(tab)).length

const canSave = computed(() =>
  !!draft.value.left_team_id &&
  !!draft.value.right_team_id &&
  draft.value.left_team_id !== draft.value.right_team_id
)

const teamById = computed(() => new Map(teamList.value.map((t) => [t.id, t])))
const nameOf = (id: string | null) => (id && teamById.value.get(id)?.name) || 'TBD'
const logoOf = (id: string | null) => (id && teamById.value.get(id)?.logo) || ''

const load = async () => {
  if (!isDesktop) { loading.value = false; return }
  loading.value = true
  try {
    const [m, t] = await Promise.all([matches.list(), teams.list()])
    list.value = m
    teamList.value = t
    error.value = ''
  } catch (e) {
    error.value = String(e)
  } finally {
    loading.value = false
  }
}

const openCreate = () => {
  draft.value = emptyDraft()
  showForm.value = true
}

const startEdit = (m: Match) => {
  draft.value = { ...m }
  showForm.value = true
}

const save = async () => {
  if (!canSave.value || !isDesktop) return
  saving.value = true
  try {
    await matches.save(draft.value)
    showForm.value = false
    await load()
  } catch (e) {
    error.value = String(e)
  } finally {
    saving.value = false
  }
}

/** Inline score nudge — persists immediately. */
const bump = async (m: Match, side: 'left' | 'right', delta: number) => {
  if (!isDesktop) return
  const next: Match = { ...m }
  if (side === 'left') next.left_score = Math.max(0, next.left_score + delta)
  else next.right_score = Math.max(0, next.right_score + delta)
  try {
    await matches.save(next)
    await load()
  } catch (e) {
    error.value = String(e)
  }
}

const setCurrent = async (m: Match) => {
  if (!isDesktop) return
  try {
    await matches.save({ ...m, current: true })
    await load()
  } catch (e) {
    error.value = String(e)
  }
}

const remove = async (m: Match) => {
  if (!isDesktop) return
  if (!confirm(`Удалить матч ${nameOf(m.left_team_id)} vs ${nameOf(m.right_team_id)}?`)) return
  try {
    await matches.remove(m.id)
    await load()
  } catch (e) {
    error.value = String(e)
  }
}

onMounted(load)
</script>

<style scoped>
.score-btn {
  @apply w-6 h-6 rounded border border-bg-border text-text-secondary text-sm leading-none
         hover:border-gold/40 hover:text-gold transition-colors flex items-center justify-center;
}
</style>
