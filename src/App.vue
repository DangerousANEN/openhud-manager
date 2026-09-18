<template>
  <div class="flex h-screen overflow-hidden bg-bg-base">
    <!-- Sidebar -->
    <aside class="w-[220px] flex-shrink-0 flex flex-col border-r border-bg-border bg-bg-card">
      <!-- Logo -->
      <div class="flex items-center gap-3 px-5 py-4 border-b border-bg-border">
        <img src="/protokol-mark.png" alt="PROTOKOL HUD" class="w-9 h-9 object-contain shrink-0" />
        <div>
          <div class="text-white font-bold text-sm tracking-widest uppercase leading-none">PROTOKOL HUD</div>
          <div class="text-text-muted text-[10px] uppercase tracking-wider mt-0.5">HUD Manager</div>
        </div>
      </div>

      <!-- Nav -->
      <nav class="flex-1 px-3 py-4 space-y-0.5 overflow-y-auto">
        <div class="section-label px-2 mb-2">Управление</div>

        <router-link to="/live" custom v-slot="{ isActive, navigate }">
          <button @click="navigate" :class="['nav-link w-full text-left flex items-center gap-2.5', isActive ? 'active' : '']">
            <Radio :size="15" />
            Live
            <span v-if="gsiConnected" class="ml-auto w-2 h-2 rounded-full bg-status-success animate-pulse"></span>
          </button>
        </router-link>

        <router-link to="/matches" custom v-slot="{ isActive, navigate }">
          <button @click="navigate" :class="['nav-link w-full text-left flex items-center gap-2.5', isActive ? 'active' : '']">
            <Swords :size="15" /> Матчи
          </button>
        </router-link>

        <router-link to="/tournaments" custom v-slot="{ isActive, navigate }">
          <button @click="navigate" :class="['nav-link w-full text-left flex items-center gap-2.5', isActive ? 'active' : '']">
            <Trophy :size="15" /> Турниры
          </button>
        </router-link>

        <router-link to="/servers" custom v-slot="{ isActive, navigate }">
          <button @click="navigate" :class="['nav-link w-full text-left flex items-center gap-2.5', isActive ? 'active' : '']">
            <Server :size="15" /> Серверы
          </button>
        </router-link>

        <div class="section-label px-2 mt-4 mb-2">База данных</div>

        <router-link to="/teams" custom v-slot="{ isActive, navigate }">
          <button @click="navigate" :class="['nav-link w-full text-left flex items-center gap-2.5', isActive ? 'active' : '']">
            <Shield :size="15" /> Команды
          </button>
        </router-link>

        <router-link to="/players" custom v-slot="{ isActive, navigate }">
          <button @click="navigate" :class="['nav-link w-full text-left flex items-center gap-2.5', isActive ? 'active' : '']">
            <Users :size="15" /> Игроки
          </button>
        </router-link>

        <div class="section-label px-2 mt-4 mb-2">Продакшн</div>

        <router-link to="/huds" custom v-slot="{ isActive, navigate }">
          <button @click="navigate" :class="['nav-link w-full text-left flex items-center gap-2.5', isActive ? 'active' : '']">
            <Layers :size="15" /> HUD-паки
          </button>
        </router-link>

        <router-link to="/cameras" custom v-slot="{ isActive, navigate }">
          <button @click="navigate" :class="['nav-link w-full text-left flex items-center gap-2.5', isActive ? 'active' : '']">
            <Camera :size="15" /> Веб-камеры
          </button>
        </router-link>

        <router-link to="/hud-editor" custom v-slot="{ isActive, navigate }">
          <button @click="navigate" :class="['nav-link w-full text-left flex items-center gap-2.5', isActive ? 'active' : '']">
            <LayoutGrid :size="15" /> Редактор HUD
          </button>
        </router-link>

        <router-link to="/stream" custom v-slot="{ isActive, navigate }">
          <button @click="navigate" :class="['nav-link w-full text-left flex items-center gap-2.5', isActive ? 'active' : '']">
            <MonitorPlay :size="15" /> Трансляция
          </button>
        </router-link>

        <router-link to="/sponsors" custom v-slot="{ isActive, navigate }">
          <button @click="navigate" :class="['nav-link w-full text-left flex items-center gap-2.5', isActive ? 'active' : '']">
            <Banknote :size="15" /> Спонсоры
          </button>
        </router-link>
      </nav>

      <!-- Footer -->
      <div class="px-3 py-3 border-t border-bg-border space-y-2">
        <!-- Quick In-Game Overlay Control (Global in Sidebar) -->
        <div v-if="isDesktop" class="p-2.5 rounded-lg bg-bg-base border border-gold/20 space-y-2">
          <div class="flex items-center justify-between">
            <span class="text-[11px] font-bold text-white flex items-center gap-1.5">
              <Tv :size="13" class="text-gold" /> HUD в игре
            </span>
            <span class="text-[9px] font-mono px-1.5 py-0.5 rounded bg-gold/15 text-gold border border-gold/30">
              F10
            </span>
          </div>
          <button @click="toggleGameOverlay"
            :class="['w-full py-1.5 px-2 rounded font-bold text-[11px] transition-all flex items-center justify-center gap-1.5 shadow cursor-pointer',
              overlayActive 
                ? 'bg-status-success text-black hover:bg-status-success/90 shadow-status-success/20' 
                : 'bg-gold/15 text-gold border border-gold/30 hover:bg-gold/25']">
            <span :class="['w-2 h-2 rounded-full', overlayActive ? 'bg-black animate-ping' : 'bg-gold']"></span>
            {{ overlayActive ? 'Выключить худ поверх игры' : 'Включить худ поверх игры' }}
          </button>
        </div>

        <router-link to="/config" custom v-slot="{ isActive, navigate }">
          <button @click="navigate" :class="['nav-link w-full text-left flex items-center gap-2.5', isActive ? 'active' : '']">
            <Settings :size="15" /> Настройки
          </button>
        </router-link>
        <div class="px-3 pt-1">
          <div class="text-[10px] text-text-muted">PROTOKOL HUD Manager</div>
          <div class="text-[10px] text-text-muted">v0.2.0</div>
        </div>
      </div>
    </aside>

    <!-- Main content -->
    <main class="flex-1 overflow-y-auto">
      <router-view />
    </main>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted, onUnmounted } from 'vue'
import {
  Radio, Swords, Trophy, Server, Shield, Users,
  Layers, LayoutGrid, MonitorPlay, Banknote, Settings, Camera, Tv
} from 'lucide-vue-next'
import { operatorOverlay, isDesktop } from './api'
import { listen, type UnlistenFn } from '@tauri-apps/api/event'

const gsiConnected = ref(false)
const overlayActive = ref(false)
let unlistenStatus: UnlistenFn | null = null

const checkOverlay = async () => {
  if (isDesktop) {
    overlayActive.value = await operatorOverlay.status()
  }
}

const toggleGameOverlay = async () => {
  try {
    overlayActive.value = await operatorOverlay.toggle()
  } catch (e) {
    console.error('Failed to toggle overlay:', e)
  }
}

onMounted(async () => {
  await checkOverlay()
  if (isDesktop) {
    try {
      unlistenStatus = await listen<boolean>('overlay_status_changed', (event) => {
        overlayActive.value = event.payload
      })
    } catch (_) {}
  }
})

onUnmounted(() => {
  if (unlistenStatus) unlistenStatus()
})
</script>
