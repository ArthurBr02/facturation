<script>
// Administration: inspect the Drive upload queue, retry it, and force a manual
// database backup.
import { adminApi } from '@/api'
import PageHeader from '@/components/PageHeader.vue'
import StatusDot from '@/components/StatusDot.vue'

const STATUS_DOT = {
  pending: { dot: '#93c5fd', color: '#1d4ed8', label: 'En attente' },
  failed:  { dot: '#dc2626', color: '#b91c1c', label: 'Échoué' },
  done:    { dot: '#16a34a', color: '#15803d', label: 'Envoyé' },
}

export default {
  name: 'AdminView',
  components: { PageHeader, StatusDot },
  data() {
    return { queue: [], loading: true, statusFilter: '', busy: false, message: '' }
  },
  created() {
    this.fetch()
  },
  methods: {
    statusMeta(s) { return STATUS_DOT[s] || { dot: '#a1a1aa', color: '#71717a', label: s } },
    async fetch() {
      this.loading = true
      try {
        this.queue = await adminApi.uploadQueue(this.statusFilter || undefined)
      } finally {
        this.loading = false
      }
    },
    async retry() {
      this.busy = true
      this.message = ''
      try {
        const res = await adminApi.retryUploads()
        this.message = `Retraitement : ${res.processed || 0} élément(s), ${res.succeeded || 0} réussi(s).`
        await this.fetch()
      } finally {
        this.busy = false
      }
    },
    async backup() {
      this.busy = true
      this.message = ''
      try {
        const res = await adminApi.backup()
        this.message = `Sauvegarde créée : ${res.drivePath}`
        await this.fetch()
      } catch (e) {
        this.message = 'Échec : ' + (e.response?.data?.error || e.message)
      } finally {
        this.busy = false
      }
    },
  },
}
</script>

<template>
  <div class="flex flex-col h-full overflow-hidden">
    <PageHeader title="Administration" subtitle="File d'envoi Google Drive et sauvegardes">
      <select v-model="statusFilter" class="field-input w-40" @change="fetch">
        <option value="">Tous les statuts</option>
        <option value="pending">En attente</option>
        <option value="failed">Échoués</option>
        <option value="done">Envoyés</option>
      </select>
      <button class="btn-secondary" title="Rafraîchir" :disabled="busy" @click="retry">
        <i data-lucide="refresh-cw" width="14" height="14"></i>
        Retenter les envois
      </button>
      <button class="btn-primary" title="Sauvegarder maintenant" :disabled="busy" @click="backup">
        <i data-lucide="hard-drive" width="14" height="14"></i>
        Sauvegarder maintenant
      </button>
    </PageHeader>

    <div class="flex-1 overflow-auto bg-white">
      <div v-if="message" class="px-6 py-3 text-[13px] text-zinc-700 bg-zinc-50 border-b border-zinc-200">{{ message }}</div>
      <table class="w-full border-collapse">
        <thead class="t-head">
          <tr>
            <th class="t-th">Destination Drive</th>
            <th class="t-th">Statut</th>
            <th class="t-th-right">Tentatives</th>
            <th class="t-th">Dernière erreur</th>
          </tr>
        </thead>
        <tbody>
          <tr v-if="loading">
            <td colspan="4" class="px-4 py-8 text-center text-[13px] text-zinc-400">Chargement…</td>
          </tr>
          <tr v-else-if="!queue.length">
            <td colspan="4" class="px-4 py-8 text-center text-[13px] text-zinc-400">File vide.</td>
          </tr>
          <tr v-for="item in queue" :key="item.id" class="t-tr">
            <td class="t-td-mono text-zinc-700">{{ item.drivePath }}</td>
            <td class="t-td">
              <StatusDot :dot="statusMeta(item.status).dot" :color="statusMeta(item.status).color" :label="statusMeta(item.status).label" />
            </td>
            <td class="t-td-right">{{ item.attempts }}</td>
            <td class="t-td text-zinc-400 max-w-xs truncate">{{ item.errorMessage || '—' }}</td>
          </tr>
        </tbody>
      </table>
    </div>
  </div>
</template>
