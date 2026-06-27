<script>
import { healthApi, dashboardApi } from '@/api'
import PageHeader from '@/components/PageHeader.vue'
import KpiBar from '@/components/KpiBar.vue'

const euro = new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 })
const dateF = (d) => d ? new Intl.DateTimeFormat('fr-FR').format(new Date(d)) : '—'

const NIVEAU_COLOR = {
  ok:      '#15803d',
  alerte:  '#a16207',
  danger:  '#b45309',
  depasse: '#b91c1c',
}
const NIVEAU_LABEL = {
  ok:      'Sous le seuil',
  alerte:  'Seuil approché (70 %)',
  danger:  'Seuil proche (90 %)',
  depasse: 'Seuil dépassé',
}
const NIVEAU_BAR = {
  ok:      '#16a34a',
  alerte:  '#ca8a04',
  danger:  '#d97706',
  depasse: '#dc2626',
}

export default {
  name: 'DashboardView',
  components: { PageHeader, KpiBar },
  data() {
    return {
      hello: null,
      error: '',
      loading: true,
      seuils: null,
      actions: null,
      NIVEAU_COLOR,
      NIVEAU_LABEL,
      NIVEAU_BAR,
    }
  },
  computed: {
    annee() { return new Date().getFullYear() },
    tvaPct() { return this.seuils ? Math.min(this.seuils.franchiseTva.pct * 100, 100) : 0 },
    niveau() { return this.seuils?.franchiseTva?.niveau || 'ok' },
    kpis() {
      if (!this.seuils) return []
      return [
        { label: `CA encaissé ${this.annee}`, value: euro.format(this.seuils.caEncaisse), color: '#15803d' },
        { label: 'CA facturé',                value: euro.format(this.seuils.caEmis) },
        { label: 'Franchise TVA',             value: `${Math.round(this.tvaPct)} %`, color: NIVEAU_COLOR[this.niveau] },
        { label: 'Reste avant seuil',         value: euro.format(this.seuils.franchiseTva.restant) },
      ]
    },
    totalActions() {
      if (!this.actions) return 0
      return (this.actions.facturesEnRetard?.length || 0)
        + (this.actions.facturesImpayees?.length || 0)
        + (this.actions.devisBientotExpires?.length || 0)
        + (this.actions.devisEnAttenteReponse?.length || 0)
        + (this.actions.brouillons?.length || 0)
        + (this.actions.maintenanceAFacturer?.length || 0)
    },
  },
  async created() {
    try { this.seuils  = await dashboardApi.seuils() } catch (e) { this.error = e.response?.data?.error || e.message }
    try { this.actions = await dashboardApi.actions() } catch (e) { /* non-blocking */ }
    try { this.hello   = await healthApi.hello() } catch (e) { if (!this.error) this.error = e.response?.data?.error || e.message }
    this.loading = false
  },
  methods: {
    fmtEuro(n)  { return euro.format(n || 0) },
    fmtDate(d)  { return dateF(d) },
    relancerMailto(f) {
      // Build a mailto link for overdue invoice reminder.
      const subject = encodeURIComponent(`Relance — Facture ${f.numero} du ${this.fmtDate(f.finaliseeAt)}`)
      const iban = '' // filled from settings if available
      const body = encodeURIComponent(
        `Bonjour,\n\nSauf erreur de notre part, la facture ${f.numero} d'un montant de ${this.fmtEuro(f.totalHt)} avec une échéance au ${this.fmtDate(f.dateEcheance)} reste à régler.\n\nMerci de procéder au règlement dans les meilleurs délais par virement bancaire.\n\nCordialement,\nAB Corp`
      )
      window.location.href = `mailto:?subject=${subject}&body=${body}`
    },
    urssafTrimestre() {
      if (!this.actions?.urssaf?.prochaineEcheance) return ''
      const d = new Date(this.actions.urssaf.prochaineEcheance)
      return this.fmtDate(d)
    },
  },
}
</script>

<template>
  <div class="flex flex-col h-full overflow-hidden">
    <PageHeader :title="`Tableau de bord`" :subtitle="`Vue d'ensemble · exercice ${annee}`">
      <button class="btn-primary" @click="$router.push({ name: 'facture-new' })">
        <i data-lucide="plus" width="15" height="15"></i>
        Nouveau document
      </button>
    </PageHeader>

    <KpiBar v-if="seuils" :items="kpis" />

    <div class="flex-1 overflow-auto p-6 bg-zinc-50">
      <div v-if="loading" class="text-[13px] text-zinc-400">Chargement…</div>

      <div v-else class="grid grid-cols-1 lg:grid-cols-3 gap-5">

        <!-- ── Section Actions urgentes ─────────────────────────────────── -->
        <div class="lg:col-span-2 space-y-4">
          <div class="flex items-center gap-2">
            <h2 class="text-[14px] font-bold text-zinc-900">À faire</h2>
            <span v-if="totalActions > 0" class="text-[11px] font-bold bg-red-100 text-red-700 rounded-full px-2 py-0.5">
              {{ totalActions }}
            </span>
          </div>

          <!-- Factures en retard -->
          <div v-if="actions?.facturesEnRetard?.length" class="bg-white border border-red-200 rounded">
            <div class="flex items-center gap-2 px-4 py-3 border-b border-red-100">
              <i data-lucide="alert-triangle" width="15" height="15" class="text-red-500"></i>
              <span class="text-[13px] font-semibold text-red-700">Factures en retard</span>
              <span class="ml-auto text-[11px] text-red-500 font-semibold">{{ actions.facturesEnRetard.length }}</span>
            </div>
            <div v-for="f in actions.facturesEnRetard" :key="f.id" class="flex items-center gap-3 px-4 py-2.5 border-b last:border-b-0 border-zinc-100 hover:bg-zinc-50 group">
              <div class="flex-1 min-w-0">
                <div class="flex items-center gap-2">
                  <span class="text-[13px] font-semibold text-zinc-800 cursor-pointer hover:text-blue-600" @click="$router.push({ name: 'facture-edit', params: { id: f.id } })">
                    {{ f.numero }}
                  </span>
                  <span class="text-[12px] text-zinc-500">{{ f.clientNom }}</span>
                </div>
                <div class="text-[11px] text-red-500 mt-0.5">
                  Échéance {{ fmtDate(f.dateEcheance) }} · {{ f.joursDepuis }}j depuis la finalisation
                </div>
              </div>
              <span class="text-[13px] font-semibold text-red-600 tabular-nums">{{ fmtEuro(f.resteAPayer) }}</span>
              <button
                class="btn-icon opacity-0 group-hover:opacity-100 transition-opacity text-amber-600 hover:text-amber-700"
                title="Relancer par email"
                @click="relancerMailto(f)"
              >
                <i data-lucide="mail" width="14" height="14"></i>
              </button>
            </div>
          </div>

          <!-- Factures impayées (non en retard) -->
          <div v-if="actions?.facturesImpayees?.length" class="bg-white border border-amber-200 rounded">
            <div class="flex items-center gap-2 px-4 py-3 border-b border-amber-100">
              <i data-lucide="clock" width="15" height="15" class="text-amber-500"></i>
              <span class="text-[13px] font-semibold text-amber-700">Factures en attente de paiement</span>
              <span class="ml-auto text-[11px] text-amber-600 font-semibold">{{ actions.facturesImpayees.length }}</span>
            </div>
            <div v-for="f in actions.facturesImpayees" :key="f.id" class="flex items-center gap-3 px-4 py-2.5 border-b last:border-b-0 border-zinc-100 hover:bg-zinc-50">
              <div class="flex-1 min-w-0">
                <div class="flex items-center gap-2">
                  <span class="text-[13px] font-semibold text-zinc-800 cursor-pointer hover:text-blue-600" @click="$router.push({ name: 'facture-edit', params: { id: f.id } })">
                    {{ f.numero }}
                  </span>
                  <span class="text-[12px] text-zinc-500">{{ f.clientNom }}</span>
                </div>
                <div class="text-[11px] text-zinc-400 mt-0.5">Échéance {{ fmtDate(f.dateEcheance) }}</div>
              </div>
              <span class="text-[13px] font-semibold text-amber-600 tabular-nums">{{ fmtEuro(f.resteAPayer) }}</span>
            </div>
          </div>

          <!-- Devis bientôt expirés -->
          <div v-if="actions?.devisBientotExpires?.length" class="bg-white border border-orange-200 rounded">
            <div class="flex items-center gap-2 px-4 py-3 border-b border-orange-100">
              <i data-lucide="timer" width="15" height="15" class="text-orange-500"></i>
              <span class="text-[13px] font-semibold text-orange-700">Devis bientôt expirés (&lt; 7 jours)</span>
              <span class="ml-auto text-[11px] text-orange-600 font-semibold">{{ actions.devisBientotExpires.length }}</span>
            </div>
            <div v-for="d in actions.devisBientotExpires" :key="d.id" class="flex items-center gap-3 px-4 py-2.5 border-b last:border-b-0 border-zinc-100 hover:bg-zinc-50">
              <div class="flex-1 min-w-0">
                <div class="flex items-center gap-2">
                  <span class="text-[13px] font-semibold text-zinc-800 cursor-pointer hover:text-blue-600" @click="$router.push({ name: 'devis-edit', params: { id: d.id } })">
                    {{ d.numero }}
                  </span>
                  <span class="text-[12px] text-zinc-500">{{ d.clientNom }}</span>
                </div>
                <div class="text-[11px] text-orange-500 mt-0.5">Expire le {{ fmtDate(d.dateExpiration) }}</div>
              </div>
              <span class="text-[13px] font-semibold text-zinc-700 tabular-nums">{{ fmtEuro(d.totalHt) }}</span>
            </div>
          </div>

          <!-- Devis en attente de réponse -->
          <div v-if="actions?.devisEnAttenteReponse?.length" class="bg-white border border-zinc-200 rounded">
            <div class="flex items-center gap-2 px-4 py-3 border-b border-zinc-100">
              <i data-lucide="send" width="15" height="15" class="text-blue-500"></i>
              <span class="text-[13px] font-semibold text-zinc-700">Devis envoyés sans réponse</span>
              <span class="ml-auto text-[11px] text-zinc-500 font-semibold">{{ actions.devisEnAttenteReponse.length }}</span>
            </div>
            <div v-for="d in actions.devisEnAttenteReponse" :key="d.id" class="flex items-center gap-3 px-4 py-2.5 border-b last:border-b-0 border-zinc-100 hover:bg-zinc-50">
              <div class="flex-1 min-w-0">
                <div class="flex items-center gap-2">
                  <span class="text-[13px] font-semibold text-zinc-800 cursor-pointer hover:text-blue-600" @click="$router.push({ name: 'devis-edit', params: { id: d.id } })">
                    {{ d.numero }}
                  </span>
                  <span class="text-[12px] text-zinc-500">{{ d.clientNom }}</span>
                </div>
                <div class="text-[11px] text-zinc-400 mt-0.5">Envoyé il y a {{ d.joursSansReponse }}j · Expire le {{ fmtDate(d.dateExpiration) }}</div>
              </div>
              <span class="text-[13px] font-semibold text-zinc-600 tabular-nums">{{ fmtEuro(d.totalHt) }}</span>
            </div>
          </div>

          <!-- Maintenance à facturer -->
          <div v-if="actions?.maintenanceAFacturer?.length" class="bg-white border border-violet-200 rounded">
            <div class="flex items-center gap-2 px-4 py-3 border-b border-violet-100">
              <i data-lucide="wrench" width="15" height="15" class="text-violet-500"></i>
              <span class="text-[13px] font-semibold text-violet-700">Factures de maintenance à générer</span>
              <span class="ml-auto text-[11px] text-violet-600 font-semibold">{{ actions.maintenanceAFacturer.length }}</span>
            </div>
            <div v-for="c in actions.maintenanceAFacturer" :key="c.id" class="flex items-center gap-3 px-4 py-2.5 border-b last:border-b-0 border-zinc-100 hover:bg-zinc-50">
              <div class="flex-1 min-w-0">
                <div class="flex items-center gap-2">
                  <span class="text-[13px] font-semibold text-zinc-800 cursor-pointer hover:text-blue-600" @click="$router.push({ name: 'contrat-edit', params: { id: c.id } })">
                    {{ c.numero }}
                  </span>
                  <span class="text-[12px] text-zinc-500">{{ c.clientNom }}</span>
                </div>
              </div>
              <span class="text-[13px] font-semibold text-violet-600 tabular-nums">{{ fmtEuro(c.montantMensuel) }}/mois</span>
            </div>
          </div>

          <!-- Brouillons non finalisés -->
          <div v-if="actions?.brouillons?.length" class="bg-white border border-zinc-200 rounded">
            <div class="flex items-center gap-2 px-4 py-3 border-b border-zinc-100">
              <i data-lucide="file-edit" width="15" height="15" class="text-zinc-400"></i>
              <span class="text-[13px] font-semibold text-zinc-600">Brouillons non finalisés</span>
              <span class="ml-auto text-[11px] text-zinc-400 font-semibold">{{ actions.brouillons.length }}</span>
            </div>
            <div v-for="b in actions.brouillons" :key="`${b.type}-${b.id}`" class="flex items-center gap-3 px-4 py-2.5 border-b last:border-b-0 border-zinc-100 hover:bg-zinc-50">
              <div class="flex-1 min-w-0">
                <div class="flex items-center gap-2">
                  <span class="tag tag-zinc text-[11px] capitalize">{{ b.type }}</span>
                  <span class="text-[13px] font-semibold text-zinc-700 cursor-pointer hover:text-blue-600" @click="$router.push({ name: b.route, params: { id: b.id } })">
                    {{ b.titre || `#${b.id}` }}
                  </span>
                  <span v-if="b.clientNom" class="text-[12px] text-zinc-400">{{ b.clientNom }}</span>
                </div>
              </div>
              <span v-if="b.totalHt" class="text-[13px] text-zinc-500 tabular-nums">{{ fmtEuro(b.totalHt) }}</span>
            </div>
          </div>

          <!-- Tout est OK -->
          <div v-if="!loading && actions && totalActions === 0" class="bg-white border border-green-200 rounded px-4 py-4">
            <div class="flex items-center gap-2 text-green-700">
              <i data-lucide="check-circle-2" width="16" height="16"></i>
              <span class="text-[13px] font-semibold">Tout est à jour — aucune action requise</span>
            </div>
          </div>
        </div>

        <!-- ── Colonne droite : indicateurs + statut ───────────────────── -->
        <div class="space-y-4">
          <!-- Franchise TVA -->
          <div v-if="seuils" class="bg-white border border-zinc-200 rounded p-5">
            <div class="flex items-center justify-between mb-4">
              <h2 class="text-[14px] font-bold text-zinc-900">Franchise TVA</h2>
              <span class="text-[11px] font-semibold" :style="`color:${NIVEAU_COLOR[niveau]}`">
                {{ NIVEAU_LABEL[niveau] }}
              </span>
            </div>
            <div class="h-[6px] bg-zinc-100 rounded-full overflow-hidden mb-3">
              <div class="h-full rounded-full transition-all" :style="`width:${tvaPct}%;background:${NIVEAU_BAR[niveau]}`"></div>
            </div>
            <div class="flex justify-between text-[12px] text-zinc-500">
              <span class="tabular">{{ fmtEuro(seuils.caEncaisse) }}</span>
              <span>Seuil <span class="tabular">{{ fmtEuro(seuils.franchiseTva.seuilBase) }}</span></span>
            </div>
            <p class="text-[12px] text-zinc-400 mt-1.5">
              Seuil majoré : <span class="tabular">{{ fmtEuro(seuils.franchiseTva.seuilMajore) }}</span>
            </p>
          </div>

          <!-- URSSAF -->
          <div v-if="actions?.urssaf" class="bg-white border border-zinc-200 rounded p-5">
            <div class="flex items-center gap-2 mb-3">
              <i data-lucide="calendar-clock" width="15" height="15" class="text-zinc-400"></i>
              <h2 class="text-[14px] font-bold text-zinc-900">Prochaine URSSAF</h2>
            </div>
            <p class="text-[22px] font-bold text-zinc-800 tabular">{{ urssafTrimestre() }}</p>
            <p class="text-[12px] text-zinc-500 mt-1">
              Dans <span class="font-semibold" :class="actions.urssaf.joursAvant < 14 ? 'text-red-600' : 'text-zinc-700'">
                {{ actions.urssaf.joursAvant }} jours
              </span>
            </p>
            <p class="text-[11px] text-zinc-400 mt-2">Déclaration BNC trimestrielle — 25,6 %</p>
          </div>

          <!-- Système -->
          <div class="bg-white border border-zinc-200 rounded p-5">
            <div class="flex items-center gap-2 mb-3">
              <i data-lucide="activity" width="15" height="15" class="text-zinc-400"></i>
              <h2 class="text-[14px] font-bold text-zinc-900">État du système</h2>
            </div>
            <div v-if="error" class="flex items-center gap-2 text-error-fg text-[13px]">
              <i data-lucide="alert-circle" width="15" height="15"></i>
              API injoignable : {{ error }}
            </div>
            <div v-else class="space-y-1.5">
              <span class="inline-flex items-center gap-1.5 text-[11px] font-semibold text-success-fg bg-success-bg px-2 py-1 rounded">
                <i data-lucide="check-circle-2" width="12" height="12"></i>
                Vue → Express → Postgres OK
              </span>
              <p class="text-[12px] text-zinc-400 font-mono mt-1">{{ hello?.db?.now }}</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>
