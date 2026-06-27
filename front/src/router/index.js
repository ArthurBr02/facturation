import { createRouter, createWebHistory } from 'vue-router'
import { useAuthStore } from '@/stores/auth'
import { useSettingsStore } from '@/stores/settings'

import AppShell from '@/layouts/AppShell.vue'
import LoginView from '@/views/LoginView.vue'
import OnboardingView from '@/views/OnboardingView.vue'
import DashboardView from '@/views/DashboardView.vue'
import ClientsView from '@/views/ClientsView.vue'
import ClientDetailView from '@/views/ClientDetailView.vue'
import DocumentsView from '@/views/DocumentsView.vue'
import FacturesView from '@/views/FacturesView.vue'
import FactureEditView from '@/views/FactureEditView.vue'
import DevisEditView from '@/views/DevisEditView.vue'
import ContratEditView from '@/views/ContratEditView.vue'
import ProduitsView from '@/views/ProduitsView.vue'
import SettingsView from '@/views/SettingsView.vue'
import TemplatesView from '@/views/TemplatesView.vue'
import AdminView from '@/views/AdminView.vue'
import RapportsView from '@/views/RapportsView.vue'

const router = createRouter({
  history: createWebHistory(import.meta.env.BASE_URL),
  routes: [
    { path: '/login', name: 'login', component: LoginView, meta: { public: true } },
    { path: '/onboarding', name: 'onboarding', component: OnboardingView, meta: { requiresAuth: true } },
    {
      path: '/',
      component: AppShell,
      meta: { requiresAuth: true },
      children: [
        { path: '', redirect: { name: 'dashboard' } },
        { path: 'dashboard', name: 'dashboard', component: DashboardView },
        { path: 'documents', name: 'documents', component: DocumentsView },
        { path: 'documents/factures', name: 'factures', component: FacturesView },
        { path: 'documents/factures/new', name: 'facture-new', component: FactureEditView },
        { path: 'documents/factures/:id', name: 'facture-edit', component: FactureEditView, props: true },
        { path: 'documents/devis/new', name: 'devis-new', component: DevisEditView },
        { path: 'documents/devis/:id', name: 'devis-edit', component: DevisEditView, props: true },
        { path: 'documents/contrats/new', name: 'contrat-new', component: ContratEditView },
        { path: 'documents/contrats/:id', name: 'contrat-edit', component: ContratEditView, props: true },
        { path: 'clients', name: 'clients', component: ClientsView },
        { path: 'clients/:id', name: 'client-detail', component: ClientDetailView, props: true },
        { path: 'produits', name: 'produits', component: ProduitsView },
        { path: 'rapports', name: 'rapports', component: RapportsView },
        { path: 'templates', name: 'templates', component: TemplatesView },
        { path: 'settings', name: 'settings', component: SettingsView },
        { path: 'admin', name: 'admin', component: AdminView },
      ],
    },
    { path: '/:pathMatch(.*)*', redirect: '/' },
  ],
})

// Global guard: enforce auth, then force first-run users through onboarding.
router.beforeEach(async (to) => {
  const auth = useAuthStore()
  const settings = useSettingsStore()

  if (to.meta.public) return true

  // Require a valid token.
  if (!auth.isAuthenticated) return { name: 'login' }
  if (!auth.user) {
    const ok = await auth.fetchMe()
    if (!ok) return { name: 'login' }
  }

  // Determine onboarding status (cached after first fetch).
  if (settings.onboardingComplete === null) {
    await settings.fetchOnboardingState()
  }

  if (!settings.onboardingComplete && to.name !== 'onboarding') {
    return { name: 'onboarding' }
  }
  if (settings.onboardingComplete && to.name === 'onboarding') {
    return { name: 'dashboard' }
  }
  return true
})

export default router
