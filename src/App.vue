<template>
  <div class="flex h-screen overflow-hidden bg-bg-base">
    <!-- Sidebar -->
    <aside class="w-[220px] flex-shrink-0 flex flex-col border-r border-bg-border bg-bg-card">
      <!-- Logo -->
      <div class="flex items-center gap-3 px-5 py-4 border-b border-bg-border">
        <img src="/openhud-mark.png" alt="OpenHUD" class="w-9 h-9 object-contain shrink-0" />
        <div>
          <div class="text-white font-bold text-sm tracking-widest uppercase leading-none">OpenHUD</div>
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
      <div class="px-3 py-4 border-t border-bg-border space-y-0.5">
        <router-link to="/config" custom v-slot="{ isActive, navigate }">
          <button @click="navigate" :class="['nav-link w-full text-left flex items-center gap-2.5', isActive ? 'active' : '']">
            <Settings :size="15" /> Настройки
          </button>
        </router-link>
        <div class="px-3 pt-3">
          <div class="text-[10px] text-text-muted">OpenHUD Manager</div>
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
import { ref } from 'vue'
import {
  Radio, Swords, Trophy, Server, Shield, Users,
  Layers, LayoutGrid, MonitorPlay, Banknote, Settings
} from 'lucide-vue-next'

const gsiConnected = ref(false)
</script>
