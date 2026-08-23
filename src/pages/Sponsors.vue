<template>
  <div class="p-6 space-y-6">
    <div class="flex items-center justify-between">
      <div>
        <div class="section-label">Продакшн</div>
        <h1 class="text-2xl font-bold text-white">Спонсоры</h1>
      </div>
      <button @click="openCreate" class="btn-gold flex items-center gap-2">
        <Plus :size="14" /> Добавить спонсора
      </button>
    </div>

    <div v-if="error" class="card border-brand-red/40 text-brand-red text-sm">{{ error }}</div>

    <!-- Rotation settings -->
    <div class="card space-y-4">
      <div class="flex items-center justify-between">
        <div class="section-label mb-0">Ротация баннеров</div>
        <div class="flex items-center gap-3">
          <span class="text-text-secondary text-xs flex items-center gap-1.5">
            <Timer :size="13" /> Интервал:
          </span>
          <select v-model="rotationInterval" class="input-field w-28 text-xs py-1.5">
            <option value="15">15 сек</option>
            <option value="30">30 сек</option>
            <option value="60">60 сек</option>
          </select>
          <button @click="sendRotation"
            class="text-xs px-3 py-1.5 rounded-btn bg-status-success/10 border border-status-success/30 text-status-success font-medium flex items-center gap-1.5">
            <Play :size="12" /> Запустить
          </button>
        </div>
      </div>

      <div v-if="loading" class="text-text-muted text-sm">Загрузка...</div>

      <div v-else-if="list.length === 0" class="text-center py-8 text-text-muted text-sm">
        Спонсоры не добавлены
      </div>

      <div v-else class="grid grid-cols-3 gap-4">
        <div v-for="s in list" :key="s.id"
          :class="['bg-bg-elevated border rounded-lg p-4 space-y-3 transition-colors',
            s.active ? 'border-bg-border hover:border-gold/20' : 'border-bg-border/40 opacity-50']">
          <div class="flex items-center justify-between">
            <div class="flex items-center gap-2">
              <button @click="toggleActive(s)"
                :class="['w-7 h-4 rounded-full relative transition-all', s.active ? 'bg-status-success' : 'bg-bg-border']">
                <span :class="['absolute top-0.5 w-3 h-3 rounded-full bg-white shadow transition-all',
                  s.active ? 'left-3.5' : 'left-0.5']"></span>
              </button>
              <span class="text-[10px] text-text-muted">{{ s.active ? 'Вкл' : 'Выкл' }}</span>
            </div>
            <div class="flex gap-2">
              <button @click="openEdit(s)" class="text-text-muted hover:text-white transition-colors">
                <Pencil :size="13" />
              </button>
              <button @click="remove(s)" class="text-text-muted hover:text-brand-red transition-colors">
                <Trash2 :size="13" />
              </button>
            </div>
          </div>

          <div class="aspect-video bg-bg-base border border-bg-border rounded-lg flex items-center justify-center overflow-hidden">
            <img v-if="s.image" :src="s.image" :alt="s.name" class="max-h-full max-w-full object-contain" />
            <ImageIcon v-else :size="28" class="text-text-muted" />
          </div>

          <div>
            <div class="font-semibold text-white text-sm">{{ s.name }}</div>
            <div class="text-text-muted text-xs mt-0.5 flex items-center gap-1 truncate">
              <ExternalLink :size="11" /> {{ s.url || '—' }}
            </div>
          </div>

          <div class="flex items-center justify-between text-xs text-text-muted">
            <span>Вес: {{ s.weight }}</span>
          </div>
        </div>

        <button @click="openCreate"
          class="bg-bg-elevated border border-dashed border-bg-border rounded-lg p-4 flex flex-col items-center justify-center gap-2 hover:border-gold/30 hover:bg-gold/5 transition-all min-h-[200px]">
          <Plus :size="24" class="text-text-muted" />
          <span class="text-text-muted text-sm">Добавить спонсора</span>
        </button>
      </div>
    </div>

    <!-- Editor modal -->
    <div v-if="showForm" class="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50">
      <div class="card w-[460px] space-y-5">
        <div class="flex items-center justify-between">
          <h2 class="text-lg font-bold text-white">{{ draft.id ? 'Изменить спонсора' : 'Новый спонсор' }}</h2>
          <button @click="showForm = false" class="text-text-muted hover:text-white transition-colors">
            <X :size="20" />
          </button>
        </div>

        <div class="space-y-3">
          <div>
            <label class="text-text-secondary text-xs mb-1.5 block">Название *</label>
            <input v-model="draft.name" class="input-field" placeholder="Название компании" @keyup.enter="save">
          </div>
          <div>
            <label class="text-text-secondary text-xs mb-1.5 block">Изображение / URL баннера</label>
            <input v-model="draft.image" class="input-field" placeholder="https://...">
          </div>
          <div>
            <label class="text-text-secondary text-xs mb-1.5 block">Ссылка (URL)</label>
            <input v-model="draft.url" class="input-field" placeholder="https://...">
          </div>
          <div class="grid grid-cols-2 gap-3">
            <div>
              <label class="text-text-secondary text-xs mb-1.5 block">Вес показа</label>
              <input v-model.number="draft.weight" type="number" min="1" class="input-field">
            </div>
            <div class="flex items-end pb-1">
              <label class="flex items-center gap-2 text-sm text-text-secondary cursor-pointer">
                <input v-model="draft.active" type="checkbox" class="accent-gold">
                Активен
              </label>
            </div>
          </div>
        </div>

        <div class="flex gap-3 pt-1">
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
import { ref, onMounted } from 'vue'
import { Plus, Timer, Play, Pencil, Trash2, ImageIcon, ExternalLink, X } from 'lucide-vue-next'
import { sponsors as sponsorsApi, overlay, isDesktop, type Sponsor } from '../api'

const list = ref<Sponsor[]>([])
const loading = ref(true)
const saving = ref(false)
const error = ref('')
const showForm = ref(false)
const rotationInterval = ref('30')

const blank = (): Sponsor => ({ id: '', name: '', image: '', url: '', weight: 1, active: true })
const draft = ref<Sponsor>(blank())

const load = async () => {
  if (!isDesktop) { loading.value = false; return }
  try {
    list.value = await sponsorsApi.list()
    error.value = ''
  } catch (e) {
    error.value = String(e)
  } finally {
    loading.value = false
  }
}

const openCreate = () => { draft.value = blank(); showForm.value = true }
const openEdit = (s: Sponsor) => { draft.value = { ...s }; showForm.value = true }

const save = async () => {
  if (!draft.value.name.trim() || !isDesktop) return
  saving.value = true
  try {
    const saved = await sponsorsApi.save(draft.value)
    const idx = list.value.findIndex((x) => x.id === saved.id)
    if (idx >= 0) list.value[idx] = saved
    else list.value.push(saved)
    showForm.value = false
  } catch (e) {
    error.value = String(e)
  } finally {
    saving.value = false
  }
}

const remove = async (s: Sponsor) => {
  if (!isDesktop || !confirm(`Удалить "${s.name}"?`)) return
  try {
    await sponsorsApi.remove(s.id)
    list.value = list.value.filter((x) => x.id !== s.id)
  } catch (e) {
    error.value = String(e)
  }
}

const toggleActive = async (s: Sponsor) => {
  try {
    const updated = await sponsorsApi.save({ ...s, active: !s.active })
    const idx = list.value.findIndex((x) => x.id === updated.id)
    if (idx >= 0) list.value[idx] = updated
  } catch (e) {
    error.value = String(e)
  }
}

const sendRotation = async () => {
  if (!isDesktop) return
  const active = list.value.filter((s) => s.active)
  try {
    await overlay.broadcast('sponsor_rotation', {
      sponsors: active,
      interval_ms: parseInt(rotationInterval.value) * 1000,
    })
  } catch (e) {
    error.value = String(e)
  }
}

onMounted(load)
</script>
