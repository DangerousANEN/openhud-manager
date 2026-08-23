<template>
  <div class="p-6 space-y-6">
    <div class="flex items-center justify-between">
      <div>
        <div class="section-label">Управление</div>
        <h1 class="text-2xl font-bold text-white">Турниры</h1>
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

    <div v-if="error" class="card border-brand-red/40 bg-brand-red/5 text-brand-red text-sm">
      {{ error }}
    </div>

    <div v-if="loading" class="text-text-muted text-sm">Загрузка...</div>

    <div v-else-if="items.length === 0" class="card text-center py-12 space-y-3">
      <Trophy :size="28" class="text-text-muted mx-auto" />
      <div class="text-text-secondary text-sm">Турниров пока нет</div>
      <button @click="openCreate" class="btn-outline text-xs mx-auto">Создать первый</button>
    </div>

    <div v-else class="grid grid-cols-3 gap-4">
      <div v-for="t in filtered" :key="t.id"
        class="card group hover:border-gold/30 transition-all">
        <div class="flex items-center gap-3 mb-4">
          <div class="w-12 h-12 rounded-xl bg-bg-elevated border border-bg-border flex items-center justify-center overflow-hidden group-hover:border-gold/40 transition-colors">
            <img v-if="t.logo" :src="t.logo" :alt="t.name" class="w-full h-full object-contain" />
            <Trophy v-else :size="22" class="text-text-secondary group-hover:text-gold transition-colors" />
          </div>
          <div class="flex-1 min-w-0">
            <div class="font-bold text-white truncate">{{ t.name }}</div>
            <div class="text-xs text-text-secondary">
              {{ t.entry_fee > 0 ? fmt(t.entry_fee) + ' взнос' : 'бесплатный' }}
            </div>
          </div>
          <div class="flex gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
            <button @click="openEdit(t)" class="text-text-secondary hover:text-white transition-colors">
              <Pencil :size="13" />
            </button>
            <button @click="remove(t)" class="text-text-secondary hover:text-brand-red transition-colors">
              <Trash2 :size="13" />
            </button>
          </div>
        </div>
        <div class="grid grid-cols-2 gap-2 text-center border-t border-bg-border pt-3">
          <div>
            <div class="text-gold font-semibold text-sm">{{ fmt(t.prize_pool) }}</div>
            <div class="text-text-muted text-[10px]">Призовой фонд</div>
          </div>
          <div>
            <div class="text-white font-semibold text-sm">{{ fmt(t.entry_fee) }}</div>
            <div class="text-text-muted text-[10px]">Взнос</div>
          </div>
        </div>
      </div>

      <button @click="openCreate"
        class="card border-dashed hover:border-gold/40 hover:bg-gold/5 transition-all flex flex-col items-center justify-center gap-2 min-h-[130px]">
        <Plus :size="24" class="text-text-muted" />
        <span class="text-text-muted text-sm">Добавить турнир</span>
      </button>
    </div>

    <!-- Editor modal -->
    <div v-if="showForm" class="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50">
      <div class="card w-[460px] space-y-5">
        <div class="flex items-center justify-between">
          <h2 class="text-lg font-bold text-white">
            {{ draft.id ? 'Редактировать турнир' : 'Новый турнир' }}
          </h2>
          <button @click="showForm = false" class="text-text-muted hover:text-white transition-colors">
            <X :size="20" />
          </button>
        </div>

        <div>
          <label class="text-text-secondary text-xs mb-1.5 block">Название *</label>
          <input v-model="draft.name" class="input-field" placeholder="OpenHUD Cup #1" @keyup.enter="save">
        </div>

        <div>
          <label class="text-text-secondary text-xs mb-1.5 block">Логотип (URL или путь)</label>
          <input v-model="draft.logo" class="input-field" placeholder="https://...">
        </div>

        <div class="grid grid-cols-2 gap-4">
          <div>
            <label class="text-text-secondary text-xs mb-1.5 block">Взнос, ₽</label>
            <input v-model.number="draft.entry_fee" type="number" min="0" class="input-field" placeholder="0">
          </div>
          <div>
            <label class="text-text-secondary text-xs mb-1.5 block">Призовой фонд, ₽</label>
            <input v-model.number="draft.prize_pool" type="number" min="0" class="input-field" placeholder="0">
          </div>
        </div>

        <div class="flex gap-3 pt-2">
          <button @click="showForm = false" class="btn-outline flex-1">Отмена</button>
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
import { Search, Plus, Trophy, Pencil, Trash2, X } from 'lucide-vue-next'
import { tournaments, isDesktop, type Tournament } from '../api'

const items = ref<Tournament[]>([])
const search = ref('')
const loading = ref(true)
const saving = ref(false)
const error = ref('')
const showForm = ref(false)

const blank = (): Tournament => ({ id: '', name: '', logo: '', entry_fee: 0, prize_pool: 0 })
const draft = ref<Tournament>(blank())

const filtered = computed(() =>
  items.value.filter((t) => t.name.toLowerCase().includes(search.value.toLowerCase()))
)

const fmt = (n: number) =>
  n > 0 ? new Intl.NumberFormat('ru-RU').format(n) + ' ₽' : '—'

const load = async () => {
  if (!isDesktop) {
    loading.value = false
    error.value = 'Доступно только в десктоп-приложении'
    return
  }
  try {
    items.value = await tournaments.list()
    error.value = ''
  } catch (e) {
    error.value = String(e)
  } finally {
    loading.value = false
  }
}

const openCreate = () => {
  draft.value = blank()
  showForm.value = true
}

const openEdit = (t: Tournament) => {
  draft.value = { ...t }
  showForm.value = true
}

const save = async () => {
  if (!draft.value.name.trim() || !isDesktop) return
  saving.value = true
  try {
    const saved = await tournaments.save(draft.value)
    const idx = items.value.findIndex((t) => t.id === saved.id)
    if (idx >= 0) items.value[idx] = saved
    else items.value.push(saved)
    items.value.sort((a, b) => a.name.localeCompare(b.name))
    showForm.value = false
    error.value = ''
  } catch (e) {
    error.value = String(e)
  } finally {
    saving.value = false
  }
}

const remove = async (t: Tournament) => {
  if (!isDesktop) return
  if (!confirm(`Удалить турнир «${t.name}»?`)) return
  try {
    await tournaments.remove(t.id)
    items.value = items.value.filter((x) => x.id !== t.id)
  } catch (e) {
    error.value = String(e)
  }
}

onMounted(load)
</script>
