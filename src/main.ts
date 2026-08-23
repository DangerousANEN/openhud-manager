import { createApp } from 'vue'
import { createPinia } from 'pinia'
import { createRouter, createWebHashHistory } from 'vue-router'
import App from './App.vue'
import './style.css'

// Routes
import Live from './pages/Live.vue'
import Matches from './pages/Matches.vue'
import Teams from './pages/Teams.vue'
import Players from './pages/Players.vue'
import Tournaments from './pages/Tournaments.vue'
import HUDs from './pages/HUDs.vue'
import StreamControl from './pages/StreamControl.vue'
import Sponsors from './pages/Sponsors.vue'
import Config from './pages/Config.vue'
import HudEditor from './pages/HudEditor.vue'
import Servers from './pages/Servers.vue'

const router = createRouter({
  history: createWebHashHistory(),
  routes: [
    { path: '/', redirect: '/live' },
    { path: '/live', component: Live },
    { path: '/matches', component: Matches },
    { path: '/teams', component: Teams },
    { path: '/players', component: Players },
    { path: '/tournaments', component: Tournaments },
    { path: '/huds', component: HUDs },
    { path: '/hud-editor', component: HudEditor },
    { path: '/stream', component: StreamControl },
    { path: '/sponsors', component: Sponsors },
    { path: '/servers', component: Servers },
    { path: '/config', component: Config },
  ]
})

const pinia = createPinia()
const app = createApp(App)
app.use(pinia)
app.use(router)
app.mount('#app')
