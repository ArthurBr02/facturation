import { createApp } from 'vue'
import { createPinia } from 'pinia'

import App from './App.vue'
import router from './router'
import './assets/css/main.css'

const app = createApp(App)

app.use(createPinia())
app.use(router)

// Re-init Lucide icons after every route change (icons in newly mounted views)
router.afterEach(() => {
  setTimeout(() => window.lucide?.createIcons(), 50)
})

app.mount('#app')
