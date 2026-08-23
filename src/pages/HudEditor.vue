<template>
  <div class="h-full flex flex-col bg-bg-base overflow-hidden select-none">
    <!-- Top Bar / Header -->
    <header class="flex items-center justify-between px-6 py-3 border-b border-bg-border bg-bg-card flex-shrink-0">
      <div class="flex items-center gap-4">
        <div>
          <div class="section-label mb-0.5">Продакшн</div>
          <h1 class="text-xl font-bold text-white flex items-center gap-2">
            <LayoutGrid :size="20" class="text-gold" />
            Visual HUD Editor
          </h1>
        </div>
        <div class="h-6 w-px bg-bg-border mx-1"></div>
        <div class="flex items-center gap-2 text-xs text-text-muted">
          <span class="px-2 py-1 rounded bg-bg-elevated border border-bg-border font-mono">1920×1080</span>
          <span class="px-2 py-1 rounded bg-bg-elevated border border-bg-border font-mono">
            Превью: {{ Math.round(canvasScale * 100) }}%
          </span>
        </div>
      </div>

      <!-- Action Buttons -->
      <div class="flex items-center gap-2.5">
        <button
          @click="snapToGrid = !snapToGrid"
          :class="[
            'text-xs px-3 py-2 rounded-btn border transition-all flex items-center gap-1.5 font-medium',
            snapToGrid
              ? 'bg-gold/10 border-gold/40 text-gold'
              : 'border-bg-border text-text-secondary hover:border-gold/30 hover:text-white'
          ]"
          title="Привязка элементов к сетке 8px"
        >
          <Grid :size="14" />
          Сетка 8px: {{ snapToGrid ? 'Вкл' : 'Выкл' }}
        </button>

        <button @click="openLoadModal" class="btn-outline text-xs py-2 flex items-center gap-1.5">
          <FolderOpen :size="14" /> Загрузить
        </button>

        <button @click="resetToDefault" class="btn-outline text-xs py-2 flex items-center gap-1.5">
          <RotateCcw :size="14" /> Сбросить
        </button>

        <button @click="exportHtml" class="btn-outline text-xs py-2 flex items-center gap-1.5">
          <Download :size="14" /> Экспорт HTML
        </button>

        <button @click="openSaveModal" class="btn-gold text-xs py-2 flex items-center gap-1.5">
          <Save :size="14" /> Сохранить
        </button>
      </div>
    </header>

    <!-- Main Content Area -->
    <div class="flex-1 flex overflow-hidden">
      <!-- Left Panel: Block Library -->
      <aside class="w-64 border-r border-bg-border bg-bg-card flex flex-col flex-shrink-0">
        <div class="p-4 border-b border-bg-border">
          <div class="section-label mb-1">Библиотека</div>
          <h2 class="text-sm font-semibold text-white">Добавить блоки</h2>
        </div>

        <div class="flex-1 overflow-y-auto p-3 space-y-2">
          <div
            v-for="preset in presets"
            :key="preset.type"
            @click="addBlockFromPreset(preset)"
            class="group card p-3 cursor-pointer hover:border-gold/40 hover:bg-gold/5 transition-all flex items-center justify-between"
          >
            <div class="flex items-center gap-3">
              <div class="w-8 h-8 rounded bg-bg-elevated border border-bg-border group-hover:border-gold/30 flex items-center justify-center text-gold transition-colors">
                <component :is="getPresetIcon(preset.type)" :size="16" />
              </div>
              <div>
                <div class="text-xs font-semibold text-white group-hover:text-gold transition-colors">
                  {{ preset.name }}
                </div>
                <div class="text-[10px] text-text-muted font-mono">
                  {{ preset.defaultWidth }}×{{ preset.defaultHeight }}px
                </div>
              </div>
            </div>
            <Plus :size="14" class="text-text-muted group-hover:text-gold transition-colors" />
          </div>
        </div>

        <div class="p-3 border-t border-bg-border bg-bg-elevated/30">
          <div class="text-[11px] text-text-muted flex items-start gap-1.5">
            <Info :size="13" class="shrink-0 text-gold mt-0.5" />
            <span>Перетаскивайте блоки по холсту. Используйте маркер внизу справа для изменения размера.</span>
          </div>
        </div>
      </aside>

      <!-- Center: 16:9 Canvas Viewport -->
      <main
        class="flex-1 bg-[#090A0C] p-4 flex flex-col items-center justify-center overflow-auto relative"
        @click="onCanvasBackgroundClick"
      >
        <!-- Canvas Wrapper (Responsive 16:9 Frame) -->
        <div
          ref="canvasContainerRef"
          class="relative w-full max-w-[1280px] aspect-video bg-[#0E0F11] border border-bg-border/80 rounded-lg shadow-2xl overflow-hidden flex items-center justify-center"
          :class="{ 'bg-grid-pattern': snapToGrid }"
        >
          <!-- Grid Overlay Indicator -->
          <div
            v-if="snapToGrid"
            class="absolute inset-0 pointer-events-none opacity-20"
            style="background-image: radial-gradient(#E6C475 1px, transparent 1px); background-size: 16px 16px;"
          ></div>

          <!-- 1920x1080 Design Canvas -->
          <div
            class="absolute top-0 left-0"
            :style="{
              width: '1920px',
              height: '1080px',
              transform: `scale(${canvasScale})`,
              transformOrigin: 'top left'
            }"
          >
            <!-- Canvas Blocks -->
            <div
              v-for="block in blocks"
              :key="block.id"
              v-show="block.visible"
              @mousedown="startDrag($event, block)"
              :class="[
                'absolute cursor-move select-none border transition-shadow',
                selectedBlockId === block.id
                  ? 'border-gold shadow-[0_0_15px_rgba(230,196,117,0.3)] z-50'
                  : 'border-white/10 hover:border-gold/40'
              ]"
              :style="{
                left: block.x + 'px',
                top: block.y + 'px',
                width: block.width + 'px',
                height: block.height + 'px',
                zIndex: block.zIndex,
                color: block.color,
                backgroundColor: block.backgroundColor,
                opacity: block.opacity / 100,
                fontSize: block.fontSize + 'px'
              }"
            >
              <!-- Block Header Badge (visible when selected) -->
              <div
                v-if="selectedBlockId === block.id"
                class="absolute -top-6 left-0 bg-gold text-bg-base font-mono text-[10px] font-bold px-1.5 py-0.5 rounded-t flex items-center gap-1.5 whitespace-nowrap"
              >
                <span>{{ block.name }}</span>
                <span class="opacity-75">({{ block.x }}, {{ block.y }}) {{ block.width }}×{{ block.height }}</span>
              </div>

              <!-- Render Block Body Content -->
              <div class="w-full h-full overflow-hidden p-1">
                <!-- Score Block -->
                <template v-if="block.type === 'score'">
                  <div class="flex items-center justify-between h-full px-4 font-bold border border-gold/20 rounded bg-bg-card/90">
                    <div class="flex items-center gap-2 text-status-info">
                      <Shield :size="18" />
                      <span>NAVI</span>
                      <span class="text-xl text-white">12</span>
                    </div>
                    <div class="text-xs text-gold uppercase tracking-widest font-mono">ROUND 22</div>
                    <div class="flex items-center gap-2 text-amber-500">
                      <span class="text-xl text-white">9</span>
                      <span>FAZE</span>
                      <Shield :size="18" />
                    </div>
                  </div>
                </template>

                <!-- Timer Block -->
                <template v-else-if="block.type === 'timer'">
                  <div class="flex items-center justify-center h-full font-mono font-bold text-gold border border-gold/30 rounded bg-bg-card/90 tracking-wider">
                    <Clock :size="16" class="mr-2" />
                    <span>01:45</span>
                  </div>
                </template>

                <!-- Teams Roster Block -->
                <template v-else-if="block.type === 'teams'">
                  <div class="h-full p-2 space-y-1.5 font-sans border border-white/10 rounded bg-bg-card/90 text-xs">
                    <div class="text-[10px] text-text-muted uppercase tracking-wider font-semibold border-b border-bg-border pb-1">
                      Состав Команды
                    </div>
                    <div class="flex justify-between items-center bg-bg-elevated/50 px-2 py-1 rounded">
                      <span class="font-medium">s1mple</span>
                      <span class="text-status-success font-bold font-mono">100 HP</span>
                    </div>
                    <div class="flex justify-between items-center bg-bg-elevated/50 px-2 py-1 rounded">
                      <span class="font-medium">b1t</span>
                      <span class="text-status-success font-bold font-mono">85 HP</span>
                    </div>
                    <div class="flex justify-between items-center bg-bg-elevated/50 px-2 py-1 rounded">
                      <span class="font-medium">iM</span>
                      <span class="text-amber-400 font-bold font-mono">42 HP</span>
                    </div>
                    <div class="flex justify-between items-center bg-bg-elevated/50 px-2 py-1 rounded opacity-50">
                      <span class="font-medium">jl</span>
                      <span class="text-brand-red font-bold font-mono">DEAD</span>
                    </div>
                  </div>
                </template>

                <!-- Economy Block -->
                <template v-else-if="block.type === 'economy'">
                  <div class="flex items-center justify-around h-full px-3 text-xs border border-white/10 rounded bg-bg-card/90 font-mono">
                    <div><span class="text-text-muted">Инв:</span> $24,500</div>
                    <div class="badge-gold">FULL BUY</div>
                    <div><span class="text-text-muted">Бонус:</span> $3,400</div>
                  </div>
                </template>

                <!-- Killfeed Block -->
                <template v-else-if="block.type === 'killfeed'">
                  <div class="h-full flex flex-col justify-start gap-1 p-1 font-mono text-[11px]">
                    <div class="bg-bg-card/90 border-l-2 border-status-info px-2 py-1 rounded flex items-center justify-between">
                      <span class="text-status-info">s1mple</span>
                      <Crosshair :size="12" class="text-gold mx-1" />
                      <span class="text-amber-500">ZywOo</span>
                    </div>
                    <div class="bg-bg-card/90 border-l-2 border-amber-500 px-2 py-1 rounded flex items-center justify-between">
                      <span class="text-amber-500">apEX</span>
                      <Crosshair :size="12" class="text-gold mx-1" />
                      <span class="text-status-info">b1t</span>
                    </div>
                  </div>
                </template>

                <!-- Sponsor Block -->
                <template v-else-if="block.type === 'sponsor'">
                  <div class="flex items-center justify-center h-full border border-dashed border-gold/40 rounded bg-bg-card/90 text-gold font-bold tracking-widest text-xs">
                    <Award :size="16" class="mr-2" />
                    {{ block.content || 'SPONSOR BANNER' }}
                  </div>
                </template>

                <!-- Custom Text Block -->
                <template v-else>
                  <div class="flex items-center justify-center h-full p-2 text-center font-semibold">
                    {{ block.content || 'Произвольный текст' }}
                  </div>
                </template>
              </div>

              <!-- Resize Handle (Corner) -->
              <div
                v-if="selectedBlockId === block.id"
                @mousedown="startResize($event, block)"
                class="resize-handle absolute -bottom-1.5 -right-1.5 w-4 h-4 bg-gold border border-bg-base rounded-full cursor-se-resize flex items-center justify-center z-50 shadow"
                title="Изменить размер"
              >
                <Move :size="8" class="text-bg-base" />
              </div>
            </div>
          </div>
        </div>
      </main>

      <!-- Right Panel: Properties Inspector & Layers -->
      <aside class="w-80 border-l border-bg-border bg-bg-card flex flex-col flex-shrink-0">
        <!-- Tabs -->
        <div class="flex border-b border-bg-border">
          <button
            @click="activeTab = 'properties'"
            :class="[
              'flex-1 py-3 text-xs font-semibold uppercase tracking-wider text-center border-b-2 transition-colors flex items-center justify-center gap-1.5',
              activeTab === 'properties'
                ? 'border-gold text-gold bg-bg-elevated/40'
                : 'border-transparent text-text-muted hover:text-white'
            ]"
          >
            <Sliders :size="14" /> Свойства
          </button>
          <button
            @click="activeTab = 'layers'"
            :class="[
              'flex-1 py-3 text-xs font-semibold uppercase tracking-wider text-center border-b-2 transition-colors flex items-center justify-center gap-1.5',
              activeTab === 'layers'
                ? 'border-gold text-gold bg-bg-elevated/40'
                : 'border-transparent text-text-muted hover:text-white'
            ]"
          >
            <Layers :size="14" /> Слои ({{ blocks.length }})
          </button>
        </div>

        <!-- Tab Content -->
        <div class="flex-1 overflow-y-auto p-4 space-y-5">
          <!-- Properties Tab -->
          <template v-if="activeTab === 'properties'">
            <div v-if="selectedBlock" class="space-y-4">
              <!-- Block Name -->
              <div>
                <label class="text-text-secondary text-xs mb-1 block">Название блока</label>
                <input v-model="selectedBlock.name" class="input-field" />
              </div>

              <!-- Position X, Y -->
              <div class="grid grid-cols-2 gap-3">
                <div>
                  <label class="text-text-secondary text-xs mb-1 block">Позиция X (px)</label>
                  <input v-model.number="selectedBlock.x" type="number" min="0" max="1920" class="input-field" />
                </div>
                <div>
                  <label class="text-text-secondary text-xs mb-1 block">Позиция Y (px)</label>
                  <input v-model.number="selectedBlock.y" type="number" min="0" max="1080" class="input-field" />
                </div>
              </div>

              <!-- Dimensions W, H -->
              <div class="grid grid-cols-2 gap-3">
                <div>
                  <label class="text-text-secondary text-xs mb-1 block">Ширина W (px)</label>
                  <input v-model.number="selectedBlock.width" type="number" min="40" max="1920" class="input-field" />
                </div>
                <div>
                  <label class="text-text-secondary text-xs mb-1 block">Высота H (px)</label>
                  <input v-model.number="selectedBlock.height" type="number" min="20" max="1080" class="input-field" />
                </div>
              </div>

              <!-- Z-Index & Opacity -->
              <div class="grid grid-cols-2 gap-3">
                <div>
                  <label class="text-text-secondary text-xs mb-1 block">Z-Index (Слой)</label>
                  <input v-model.number="selectedBlock.zIndex" type="number" min="1" max="999" class="input-field" />
                </div>
                <div>
                  <label class="text-text-secondary text-xs mb-1 block">Размер шрифта</label>
                  <input v-model.number="selectedBlock.fontSize" type="number" min="8" max="72" class="input-field" />
                </div>
              </div>

              <!-- Opacity Slider -->
              <div>
                <div class="flex justify-between items-center text-xs text-text-secondary mb-1">
                  <span>Непрозрачность</span>
                  <span class="font-mono text-gold">{{ selectedBlock.opacity }}%</span>
                </div>
                <input
                  v-model.number="selectedBlock.opacity"
                  type="range"
                  min="0"
                  max="100"
                  class="w-full accent-gold bg-bg-elevated rounded"
                />
              </div>

              <!-- Color Pickers -->
              <div class="grid grid-cols-2 gap-3">
                <div>
                  <label class="text-text-secondary text-xs mb-1 block">Цвет текста</label>
                  <div class="flex items-center gap-2">
                    <input v-model="selectedBlock.color" type="color" class="w-8 h-8 rounded border-0 bg-transparent cursor-pointer" />
                    <input v-model="selectedBlock.color" class="input-field font-mono text-xs" />
                  </div>
                </div>
                <div>
                  <label class="text-text-secondary text-xs mb-1 block">Цвет фона</label>
                  <div class="flex items-center gap-2">
                    <input v-model="selectedBlock.backgroundColor" class="input-field font-mono text-xs" placeholder="rgba(...)" />
                  </div>
                </div>
              </div>

              <!-- Text Content (for Text / Sponsor / Score) -->
              <div>
                <label class="text-text-secondary text-xs mb-1 block">Содержимое / Текст</label>
                <input v-model="selectedBlock.content" class="input-field" placeholder="Текст оверлея..." />
              </div>

              <!-- Custom CSS -->
              <div>
                <label class="text-text-secondary text-xs mb-1 block">Произвольный CSS</label>
                <textarea
                  v-model="selectedBlock.customCss"
                  rows="3"
                  class="input-field font-mono text-xs"
                  placeholder="border-radius: 8px; backdrop-filter: blur(4px);"
                ></textarea>
              </div>

              <!-- Quick Actions for Block -->
              <div class="pt-2 border-t border-bg-border flex gap-2">
                <button @click="duplicateBlock(selectedBlock)" class="btn-outline flex-1 text-xs py-2 flex items-center justify-center gap-1">
                  <Copy :size="13" /> Клон
                </button>
                <button @click="deleteBlock(selectedBlock.id)" class="btn-outline text-brand-red border-brand-red/30 hover:bg-brand-red/10 flex-1 text-xs py-2 flex items-center justify-center gap-1">
                  <Trash2 :size="13" /> Удалить
                </button>
              </div>
            </div>

            <!-- No Selection Placeholder -->
            <div v-else class="text-center py-12 space-y-3 text-text-muted">
              <Maximize2 :size="32" class="mx-auto text-bg-border" />
              <div class="text-xs">Выберите блок на холсте для настройки свойств</div>
            </div>
          </template>

          <!-- Layers Tab -->
          <template v-else-if="activeTab === 'layers'">
            <div v-if="blocks.length === 0" class="text-center py-8 text-text-muted text-xs">
              Нет элементов на холсте
            </div>
            <div v-else class="space-y-1.5">
              <div
                v-for="b in sortedBlocks"
                :key="b.id"
                @click="selectedBlockId = b.id"
                :class="[
                  'p-2.5 rounded-lg border transition-all flex items-center justify-between cursor-pointer text-xs',
                  selectedBlockId === b.id
                    ? 'border-gold bg-gold/10 text-white'
                    : 'border-bg-border bg-bg-elevated/40 text-text-secondary hover:border-gold/30 hover:text-white'
                ]"
              >
                <div class="flex items-center gap-2 min-w-0">
                  <button @click.stop="toggleVisibility(b)" class="text-text-muted hover:text-white">
                    <Eye v-if="b.visible" :size="14" class="text-status-success" />
                    <EyeOff v-else :size="14" class="text-text-muted" />
                  </button>
                  <span class="font-medium truncate">{{ b.name }}</span>
                </div>
                <div class="flex items-center gap-1.5 flex-shrink-0">
                  <button @click.stop="moveLayerUp(b)" class="p-1 hover:text-gold" title="Вверх (Z-Index +1)">
                    <ChevronUp :size="13" />
                  </button>
                  <button @click.stop="moveLayerDown(b)" class="p-1 hover:text-gold" title="Вниз (Z-Index -1)">
                    <ChevronDown :size="13" />
                  </button>
                  <button @click.stop="deleteBlock(b.id)" class="p-1 hover:text-brand-red" title="Удалить">
                    <Trash2 :size="13" />
                  </button>
                </div>
              </div>
            </div>
          </template>
        </div>
      </aside>
    </div>

    <!-- Save Layout Modal -->
    <div v-if="showSaveModal" class="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center z-50">
      <div class="card w-[420px] space-y-4">
        <div class="flex justify-between items-center">
          <h3 class="text-base font-bold text-white">Сохранить макет HUD</h3>
          <button @click="showSaveModal = false" class="text-text-muted hover:text-white">
            <X :size="18" />
          </button>
        </div>
        <div>
          <label class="text-text-secondary text-xs mb-1.5 block">Название макета</label>
          <input v-model="layoutNameInput" class="input-field" placeholder="Например: Main CS2 Overlay 1080p" @keyup.enter="confirmSaveLayout" />
        </div>
        <div class="flex gap-2 pt-2">
          <button @click="showSaveModal = false" class="btn-outline flex-1 text-xs">Отмена</button>
          <button @click="confirmSaveLayout" :disabled="!layoutNameInput.trim()" class="btn-gold flex-1 text-xs disabled:opacity-40">
            Сохранить
          </button>
        </div>
      </div>
    </div>

    <!-- Load Layout Modal -->
    <div v-if="showLoadModal" class="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center z-50">
      <div class="card w-[480px] space-y-4">
        <div class="flex justify-between items-center">
          <h3 class="text-base font-bold text-white">Загрузить макет HUD</h3>
          <button @click="showLoadModal = false" class="text-text-muted hover:text-white">
            <X :size="18" />
          </button>
        </div>

        <div v-if="savedLayouts.length === 0" class="text-center py-8 text-text-muted text-xs">
          Сохранённых макетов не найдено
        </div>

        <div v-else class="max-h-60 overflow-y-auto space-y-2">
          <div
            v-for="layout in savedLayouts"
            :key="layout.id"
            class="p-3 rounded-lg border border-bg-border bg-bg-elevated flex items-center justify-between hover:border-gold/30 transition-all"
          >
            <div>
              <div class="font-semibold text-white text-sm">{{ layout.name }}</div>
              <div class="text-[10px] text-text-muted font-mono">
                Обновлено: {{ layout.updated_at || layout.created_at || '—' }}
              </div>
            </div>
            <div class="flex gap-2">
              <button @click="loadLayout(layout.id)" class="btn-gold text-xs py-1.5 px-3">
                Загрузить
              </button>
              <button @click="deleteSavedLayout(layout.id)" class="text-text-muted hover:text-brand-red px-2">
                <Trash2 :size="14" />
              </button>
            </div>
          </div>
        </div>

        <div class="flex justify-end pt-2">
          <button @click="showLoadModal = false" class="btn-outline text-xs">Закрыть</button>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted } from 'vue'
import { hudLayouts, type HudLayoutMeta } from '../api'
import {
  LayoutGrid, Grid, FolderOpen, RotateCcw, Download, Save,
  Plus, Info, Shield, Clock, Crosshair, Award, Sliders, Layers,
  Copy, Trash2, Eye, EyeOff, ChevronUp, ChevronDown, X, Move,
  Maximize2
} from 'lucide-vue-next'

export type BlockType =
  | 'score'
  | 'timer'
  | 'teams'
  | 'economy'
  | 'killfeed'
  | 'sponsor'
  | 'text'

export interface HudBlock {
  id: string
  type: BlockType
  name: string
  x: number
  y: number
  width: number
  height: number
  zIndex: number
  visible: boolean
  color: string
  backgroundColor: string
  opacity: number
  fontSize: number
  customCss: string
  content?: string
}

export interface HudLayout {
  id: string
  name: string
  updatedAt?: string
  updated_at?: string
  blocks?: HudBlock[]
  data?: string
}

interface PresetBlock {
  type: BlockType
  name: string
  defaultWidth: number
  defaultHeight: number
  defaultColor: string
  defaultBg: string
  defaultFontSize: number
  defaultContent?: string
}

// Preset Library Configuration
const presets: PresetBlock[] = [
  {
    type: 'score',
    name: 'Счёт матча',
    defaultWidth: 460,
    defaultHeight: 70,
    defaultColor: '#ffffff',
    defaultBg: 'rgba(22, 24, 28, 0.9)',
    defaultFontSize: 16
  },
  {
    type: 'timer',
    name: 'Таймер раунда',
    defaultWidth: 160,
    defaultHeight: 50,
    defaultColor: '#e6c475',
    defaultBg: 'rgba(22, 24, 28, 0.9)',
    defaultFontSize: 18
  },
  {
    type: 'teams',
    name: 'Составы команд',
    defaultWidth: 300,
    defaultHeight: 420,
    defaultColor: '#ffffff',
    defaultBg: 'rgba(22, 24, 28, 0.85)',
    defaultFontSize: 14
  },
  {
    type: 'economy',
    name: 'Экономика',
    defaultWidth: 420,
    defaultHeight: 60,
    defaultColor: '#ffffff',
    defaultBg: 'rgba(22, 24, 28, 0.85)',
    defaultFontSize: 14
  },
  {
    type: 'killfeed',
    name: 'Killfeed (Убийства)',
    defaultWidth: 360,
    defaultHeight: 180,
    defaultColor: '#ffffff',
    defaultBg: 'rgba(14, 15, 17, 0.7)',
    defaultFontSize: 13
  },
  {
    type: 'sponsor',
    name: 'Баннер спонсора',
    defaultWidth: 260,
    defaultHeight: 80,
    defaultColor: '#e6c475',
    defaultBg: 'rgba(22, 24, 28, 0.9)',
    defaultFontSize: 14,
    defaultContent: 'SPONSOR BANNER'
  },
  {
    type: 'text',
    name: 'Свой текст',
    defaultWidth: 300,
    defaultHeight: 50,
    defaultColor: '#ffffff',
    defaultBg: 'rgba(22, 24, 28, 0.7)',
    defaultFontSize: 16,
    defaultContent: 'GRAND FINALS CS2'
  }
]

// State
const blocks = ref<HudBlock[]>([])
const selectedBlockId = ref<string | null>(null)
const activeTab = ref<'properties' | 'layers'>('properties')
const snapToGrid = ref(true)
const gridSize = ref(8)

const showSaveModal = ref(false)
const showLoadModal = ref(false)
const layoutNameInput = ref('')
const savedLayouts = ref<HudLayoutMeta[]>([])
const isSaving = ref(false)
const isLoadingLayouts = ref(false)

// Viewport Scaling
const canvasContainerRef = ref<HTMLDivElement | null>(null)
const canvasScale = ref(0.6)
let resizeObserver: ResizeObserver | null = null

// Mouse Interactivity State
const isDragging = ref(false)
const isResizing = ref(false)
const dragStart = ref({ mouseX: 0, mouseY: 0, blockX: 0, blockY: 0 })
const resizeStart = ref({ mouseX: 0, mouseY: 0, width: 0, height: 0 })
const activeTargetId = ref<string | null>(null)

// Computed
const selectedBlock = computed(() =>
  blocks.value.find(b => b.id === selectedBlockId.value) || null
)

const sortedBlocks = computed(() =>
  [...blocks.value].sort((a, b) => b.zIndex - a.zIndex)
)

const getPresetIcon = (type: BlockType) => {
  switch (type) {
    case 'score': return Shield
    case 'timer': return Clock
    case 'teams': return Layers
    case 'economy': return Sliders
    case 'killfeed': return Crosshair
    case 'sponsor': return Award
    case 'text':
    default: return LayoutGrid
  }
}

// Canvas Scale Calculation
const updateScale = () => {
  if (!canvasContainerRef.value) return
  const rect = canvasContainerRef.value.getBoundingClientRect()
  canvasScale.value = rect.width / 1920
}

// Default Presets Initializer
const resetToDefault = () => {
  blocks.value = [
    {
      id: 'block_score',
      type: 'score',
      name: 'Счёт матча',
      x: 730,
      y: 20,
      width: 460,
      height: 70,
      zIndex: 10,
      visible: true,
      color: '#ffffff',
      backgroundColor: 'rgba(22, 24, 28, 0.9)',
      opacity: 100,
      fontSize: 16,
      customCss: 'border-radius: 8px;'
    },
    {
      id: 'block_timer',
      type: 'timer',
      name: 'Таймер раунда',
      x: 880,
      y: 95,
      width: 160,
      height: 45,
      zIndex: 11,
      visible: true,
      color: '#e6c475',
      backgroundColor: 'rgba(22, 24, 28, 0.9)',
      opacity: 100,
      fontSize: 18,
      customCss: 'border-radius: 6px;'
    },
    {
      id: 'block_teams',
      type: 'teams',
      name: 'Состав команды',
      x: 40,
      y: 280,
      width: 300,
      height: 420,
      zIndex: 5,
      visible: true,
      color: '#ffffff',
      backgroundColor: 'rgba(22, 24, 28, 0.85)',
      opacity: 100,
      fontSize: 14,
      customCss: 'border-radius: 8px;'
    },
    {
      id: 'block_economy',
      type: 'economy',
      name: 'Экономика',
      x: 750,
      y: 990,
      width: 420,
      height: 60,
      zIndex: 8,
      visible: true,
      color: '#ffffff',
      backgroundColor: 'rgba(22, 24, 28, 0.85)',
      opacity: 100,
      fontSize: 14,
      customCss: 'border-radius: 6px;'
    },
    {
      id: 'block_killfeed',
      type: 'killfeed',
      name: 'Killfeed',
      x: 1520,
      y: 30,
      width: 360,
      height: 180,
      zIndex: 12,
      visible: true,
      color: '#ffffff',
      backgroundColor: 'rgba(14, 15, 17, 0.7)',
      opacity: 100,
      fontSize: 13,
      customCss: ''
    },
    {
      id: 'block_sponsor',
      type: 'sponsor',
      name: 'Спонсор',
      x: 40,
      y: 30,
      width: 240,
      height: 70,
      zIndex: 4,
      visible: true,
      color: '#e6c475',
      backgroundColor: 'rgba(22, 24, 28, 0.9)',
      opacity: 100,
      fontSize: 14,
      customCss: 'border-radius: 6px;',
      content: 'OpenHUD PARTNER'
    }
  ]
  selectedBlockId.value = 'block_score'
}

// Block Operations
const addBlockFromPreset = (preset: PresetBlock) => {
  const newId = `block_${Date.now()}_${Math.floor(Math.random() * 1000)}`
  const maxZ = blocks.value.reduce((acc, b) => Math.max(acc, b.zIndex), 0)

  const newBlock: HudBlock = {
    id: newId,
    type: preset.type,
    name: `${preset.name} ${blocks.value.length + 1}`,
    x: 800,
    y: 450,
    width: preset.defaultWidth,
    height: preset.defaultHeight,
    zIndex: maxZ + 1,
    visible: true,
    color: preset.defaultColor,
    backgroundColor: preset.defaultBg,
    opacity: 100,
    fontSize: preset.defaultFontSize,
    customCss: 'border-radius: 6px;',
    content: preset.defaultContent
  }

  blocks.value.push(newBlock)
  selectedBlockId.value = newId
  activeTab.value = 'properties'
}

const duplicateBlock = (block: HudBlock) => {
  const newId = `block_${Date.now()}_${Math.floor(Math.random() * 1000)}`
  const clone: HudBlock = {
    ...block,
    id: newId,
    name: `${block.name} (Копия)`,
    x: Math.min(1920 - block.width, block.x + 24),
    y: Math.min(1080 - block.height, block.y + 24),
    zIndex: block.zIndex + 1
  }
  blocks.value.push(clone)
  selectedBlockId.value = newId
}

const deleteBlock = (id: string) => {
  blocks.value = blocks.value.filter(b => b.id !== id)
  if (selectedBlockId.value === id) {
    selectedBlockId.value = null
  }
}

const toggleVisibility = (block: HudBlock) => {
  block.visible = !block.visible
}

const moveLayerUp = (block: HudBlock) => {
  block.zIndex += 1
}

const moveLayerDown = (block: HudBlock) => {
  if (block.zIndex > 1) {
    block.zIndex -= 1
  }
}

// Drag & Drop Handling
const startDrag = (event: MouseEvent, block: HudBlock) => {
  if (event.button !== 0) return
  if ((event.target as HTMLElement).closest('.resize-handle')) return

  event.stopPropagation()
  selectedBlockId.value = block.id
  isDragging.value = true
  activeTargetId.value = block.id

  dragStart.value = {
    mouseX: event.clientX,
    mouseY: event.clientY,
    blockX: block.x,
    blockY: block.y
  }

  window.addEventListener('mousemove', onDragMove)
  window.addEventListener('mouseup', onDragEnd)
}

const onDragMove = (event: MouseEvent) => {
  if (!isDragging.value || !activeTargetId.value) return
  const block = blocks.value.find(b => b.id === activeTargetId.value)
  if (!block) return

  const scale = canvasScale.value || 1
  const dx = (event.clientX - dragStart.value.mouseX) / scale
  const dy = (event.clientY - dragStart.value.mouseY) / scale

  let newX = Math.round(dragStart.value.blockX + dx)
  let newY = Math.round(dragStart.value.blockY + dy)

  if (snapToGrid.value) {
    newX = Math.round(newX / gridSize.value) * gridSize.value
    newY = Math.round(newY / gridSize.value) * gridSize.value
  }

  newX = Math.max(0, Math.min(1920 - block.width, newX))
  newY = Math.max(0, Math.min(1080 - block.height, newY))

  block.x = newX
  block.y = newY
}

const onDragEnd = () => {
  isDragging.value = false
  activeTargetId.value = null
  window.removeEventListener('mousemove', onDragMove)
  window.removeEventListener('mouseup', onDragEnd)
}

// Resizing Handling
const startResize = (event: MouseEvent, block: HudBlock) => {
  if (event.button !== 0) return
  event.stopPropagation()
  selectedBlockId.value = block.id
  isResizing.value = true
  activeTargetId.value = block.id

  resizeStart.value = {
    mouseX: event.clientX,
    mouseY: event.clientY,
    width: block.width,
    height: block.height
  }

  window.addEventListener('mousemove', onResizeMove)
  window.addEventListener('mouseup', onResizeEnd)
}

const onResizeMove = (event: MouseEvent) => {
  if (!isResizing.value || !activeTargetId.value) return
  const block = blocks.value.find(b => b.id === activeTargetId.value)
  if (!block) return

  const scale = canvasScale.value || 1
  const dw = (event.clientX - resizeStart.value.mouseX) / scale
  const dh = (event.clientY - resizeStart.value.mouseY) / scale

  let newW = Math.round(resizeStart.value.width + dw)
  let newH = Math.round(resizeStart.value.height + dh)

  if (snapToGrid.value) {
    newW = Math.round(newW / gridSize.value) * gridSize.value
    newH = Math.round(newH / gridSize.value) * gridSize.value
  }

  newW = Math.max(40, Math.min(1920 - block.x, newW))
  newH = Math.max(20, Math.min(1080 - block.y, newH))

  block.width = newW
  block.height = newH
}

const onResizeEnd = () => {
  isResizing.value = false
  activeTargetId.value = null
  window.removeEventListener('mousemove', onResizeMove)
  window.removeEventListener('mouseup', onResizeEnd)
}

const onCanvasBackgroundClick = (event: MouseEvent) => {
  if (event.target === canvasContainerRef.value) {
    selectedBlockId.value = null
  }
}

// Persistence via Tauri IPC / SQLite (with browser fallback)
const openSaveModal = () => {
  layoutNameInput.value = 'Основной оверлей CS2'
  showSaveModal.value = true
}

const confirmSaveLayout = async () => {
  if (!layoutNameInput.value.trim() || isSaving.value) return
  isSaving.value = true
  try {
    const data = JSON.stringify(blocks.value)
    await hudLayouts.save({
      name: layoutNameInput.value.trim(),
      data,
    })
    showSaveModal.value = false
  } catch (err) {
    console.error('Ошибка сохранения макета HUD:', err)
  } finally {
    isSaving.value = false
  }
}

const openLoadModal = async () => {
  showLoadModal.value = true
  isLoadingLayouts.value = true
  try {
    savedLayouts.value = await hudLayouts.list()
  } catch (err) {
    console.error('Ошибка загрузки списка макетов HUD:', err)
    savedLayouts.value = []
  } finally {
    isLoadingLayouts.value = false
  }
}

const loadLayout = async (id: string) => {
  try {
    const loaded = await hudLayouts.load(id)
    if (loaded && loaded.data) {
      const parsed = JSON.parse(loaded.data)
      const blocksToLoad = Array.isArray(parsed) ? parsed : (parsed.blocks || [])
      blocks.value = blocksToLoad
      if (blocks.value.length > 0) {
        selectedBlockId.value = blocks.value[0].id
      } else {
        selectedBlockId.value = null
      }
    }
  } catch (err) {
    console.error('Ошибка загрузки макета HUD:', err)
  } finally {
    showLoadModal.value = false
  }
}

const deleteSavedLayout = async (id: string) => {
  try {
    await hudLayouts.remove(id)
    savedLayouts.value = savedLayouts.value.filter(l => l.id !== id)
  } catch (err) {
    console.error('Ошибка удаления макета HUD:', err)
  }
}

// Standalone HTML Export Functionality
const exportHtml = () => {
  const layoutName = 'OpenHUD CS2 HUD'
  const visibleBlocks = blocks.value.filter(b => b.visible)

  const blockHtmls = visibleBlocks.map(block => {
    const inlineStyles = [
      `position: absolute`,
      `left: ${block.x}px`,
      `top: ${block.y}px`,
      `width: ${block.width}px`,
      `height: ${block.height}px`,
      `z-index: ${block.zIndex}`,
      `color: ${block.color}`,
      `background-color: ${block.backgroundColor}`,
      `opacity: ${block.opacity / 100}`,
      `font-size: ${block.fontSize}px`,
      block.customCss
    ].filter(Boolean).join('; ')

    let innerContent = ''
    switch (block.type) {
      case 'score':
        innerContent = `
          <div style="display: flex; align-items: center; justify-content: space-between; height: 100%; padding: 0 20px; font-weight: 700; border: 1px solid rgba(230,196,117,0.3); border-radius: 8px;">
            <div style="color: #2b7fff; display: flex; align-items: center; gap: 8px;">NAVI <span style="font-size: 1.3em; color: #fff;">12</span></div>
            <div style="font-size: 0.8em; color: #e6c475; letter-spacing: 2px;">ROUND 22</div>
            <div style="color: #ffaa00; display: flex; align-items: center; gap: 8px;"><span style="font-size: 1.3em; color: #fff;">9</span> FAZE</div>
          </div>`
        break
      case 'timer':
        innerContent = `
          <div style="display: flex; align-items: center; justify-content: center; height: 100%; font-weight: 800; font-family: monospace; letter-spacing: 2px; color: #e6c475; border: 1px solid rgba(230,196,117,0.3); border-radius: 6px;">
            01:45
          </div>`
        break
      case 'teams':
        innerContent = `
          <div style="padding: 10px; height: 100%; display: flex; flex-direction: column; gap: 6px; border: 1px solid rgba(255,255,255,0.1); border-radius: 8px;">
            <div style="font-size: 0.7em; text-transform: uppercase; letter-spacing: 1px; color: #8a8f9d; border-bottom: 1px solid rgba(255,255,255,0.1); padding-bottom: 4px;">Состав Команды</div>
            <div style="background: rgba(255,255,255,0.05); padding: 6px 10px; border-radius: 4px; display: flex; justify-content: space-between;"><span>s1mple</span><span style="color: #22c55e; font-weight: bold;">100 HP</span></div>
            <div style="background: rgba(255,255,255,0.05); padding: 6px 10px; border-radius: 4px; display: flex; justify-content: space-between;"><span>b1t</span><span style="color: #22c55e; font-weight: bold;">85 HP</span></div>
            <div style="background: rgba(255,255,255,0.05); padding: 6px 10px; border-radius: 4px; display: flex; justify-content: space-between;"><span>iM</span><span style="color: #f59e0b; font-weight: bold;">42 HP</span></div>
            <div style="background: rgba(255,255,255,0.05); padding: 6px 10px; border-radius: 4px; display: flex; justify-content: space-between; opacity: 0.5;"><span>jl</span><span style="color: #ef4444; font-weight: bold;">DEAD</span></div>
          </div>`
        break
      case 'economy':
        innerContent = `
          <div style="display: flex; align-items: center; justify-content: space-around; height: 100%; font-size: 0.85em; border: 1px solid rgba(255,255,255,0.1); border-radius: 6px; font-family: monospace;">
            <div><span style="color: #8a8f9d;">Equip:</span> $24,500</div>
            <div style="color: #e6c475; border: 1px solid rgba(230,196,117,0.4); padding: 2px 8px; border-radius: 4px; font-weight: bold;">FULL BUY</div>
            <div><span style="color: #8a8f9d;">Loss Bonus:</span> $3,400</div>
          </div>`
        break
      case 'killfeed':
        innerContent = `
          <div style="display: flex; flex-direction: column; gap: 6px; padding: 6px; font-family: monospace; font-size: 0.8em;">
            <div style="background: rgba(14, 15, 17, 0.9); border-left: 3px solid #2b7fff; padding: 4px 8px; border-radius: 2px; display: flex; justify-content: space-between;">
              <span style="color: #2b7fff;">s1mple</span> <span style="color: #e6c475;">[AK-47]</span> <span style="color: #f59e0b;">ZywOo</span>
            </div>
          </div>`
        break
      case 'sponsor':
        innerContent = `
          <div style="display: flex; align-items: center; justify-content: center; height: 100%; font-weight: 700; letter-spacing: 2px; color: #e6c475; border: 1px dashed rgba(230,196,117,0.4); border-radius: 6px;">
            ${block.content || 'SPONSOR BANNER'}
          </div>`
        break
      case 'text':
      default:
        innerContent = `
          <div style="display: flex; align-items: center; justify-content: center; height: 100%; font-weight: 600;">
            ${block.content || 'Произвольный текст'}
          </div>`
        break
    }

    return `    <div id="${block.id}" class="hud-block block-${block.type}" style="${inlineStyles}">\n      ${innerContent}\n    </div>`
  }).join('\n')

  const fullHtml = `<!DOCTYPE html>
<html lang="ru">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=1920, height=1080, initial-scale=1.0">
  <title>${layoutName} - OpenHUD HUD Overlay</title>
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body {
      width: 1920px;
      height: 1080px;
      overflow: hidden;
      background-color: transparent;
      font-family: 'Inter', system-ui, -apple-system, sans-serif;
      color: #ffffff;
      user-select: none;
    }
    .hud-container {
      position: relative;
      width: 1920px;
      height: 1080px;
    }
    .hud-block {
      box-sizing: border-box;
      overflow: hidden;
    }
  </style>
</head>
<body>
  <div class="hud-container">
${blockHtmls}
  </div>
</body>
</html>`

  const blob = new Blob([fullHtml], { type: 'text/html;charset=utf-8' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = `openhud_hud_${Date.now()}.html`
  a.click()
  URL.revokeObjectURL(url)
}

// Lifecycle Hooks
onMounted(() => {
  resetToDefault()
  updateScale()
  window.addEventListener('resize', updateScale)
  if (canvasContainerRef.value) {
    resizeObserver = new ResizeObserver(() => updateScale())
    resizeObserver.observe(canvasContainerRef.value)
  }
})

onUnmounted(() => {
  window.removeEventListener('resize', updateScale)
  resizeObserver?.disconnect()
  window.removeEventListener('mousemove', onDragMove)
  window.removeEventListener('mouseup', onDragEnd)
  window.removeEventListener('mousemove', onResizeMove)
  window.removeEventListener('mouseup', onResizeEnd)
})
</script>

<style scoped>
.bg-grid-pattern {
  background-image: radial-gradient(rgba(230, 196, 117, 0.12) 1px, transparent 1px);
  background-size: 16px 16px;
}
</style>
