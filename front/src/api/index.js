// Thin API wrappers grouped by resource. Components call these instead of
// using axios directly, so endpoints live in one place.
import http from './http'

export const authApi = {
  login: (email, password) => http.post('/auth/login', { email, password }).then((r) => r.data),
  me: () => http.get('/auth/me').then((r) => r.data),
}

export const healthApi = {
  hello: () => http.get('/hello').then((r) => r.data),
}

export const clientsApi = {
  list: (params) => http.get('/clients', { params }).then((r) => r.data),
  get: (id) => http.get(`/clients/${id}`).then((r) => r.data),
  documents: (id) => http.get(`/clients/${id}/documents`).then((r) => r.data),
  create: (data) => http.post('/clients', data).then((r) => r.data),
  update: (id, data) => http.put(`/clients/${id}`, data).then((r) => r.data),
  remove: (id) => http.delete(`/clients/${id}`).then((r) => r.data),
}

export const settingsApi = {
  getAll: () => http.get('/settings').then((r) => r.data),
  update: (values) => http.put('/settings', { values }).then((r) => r.data),
  getOnboarding: () => http.get('/settings/onboarding').then((r) => r.data),
  saveStep: (step, values) => http.put(`/settings/onboarding/${step}`, { values }).then((r) => r.data),
  completeOnboarding: () => http.post('/settings/onboarding/complete').then((r) => r.data),
  resetOnboarding: () => http.post('/settings/onboarding/reset').then((r) => r.data),
  placeholders: () => http.get('/settings/placeholders').then((r) => r.data),
}

export const templatesApi = {
  list: (params) => http.get('/templates', { params }).then((r) => r.data),
  get: (id) => http.get(`/templates/${id}`).then((r) => r.data),
  create: (data) => http.post('/templates', data).then((r) => r.data),
  update: (id, data) => http.put(`/templates/${id}`, data).then((r) => r.data),
  remove: (id) => http.delete(`/templates/${id}`).then((r) => r.data),
  setDefaut: (id) => http.post(`/templates/${id}/set-defaut`).then((r) => r.data),
  preview: (id) => http.get(`/templates/${id}/preview`).then((r) => r.data),
  previewPdf: (id) => http.get(`/templates/${id}/preview-pdf`, { responseType: 'blob' }).then((r) => r.data),
  defaultHtml: (type) => http.get(`/templates/defaults/${type}`, { responseType: 'blob' }).then((r) => r.data),
  uploadHtml: (id, html) => http.post(`/templates/${id}/upload-html`, { html }).then((r) => r.data),
  removeCustomHtml: (id) => http.delete(`/templates/${id}/custom-html`).then((r) => r.data),
}

export const facturesApi = {
  list: (params) => http.get('/factures', { params }).then((r) => r.data),
  get: (id) => http.get(`/factures/${id}`).then((r) => r.data),
  create: (data) => http.post('/factures', data).then((r) => r.data),
  update: (id, data) => http.put(`/factures/${id}`, data).then((r) => r.data),
  remove: (id) => http.delete(`/factures/${id}`).then((r) => r.data),
  finalize: (id) => http.post(`/factures/${id}/finaliser`).then((r) => r.data),
  pdf: (id) => http.get(`/factures/${id}/pdf`, { responseType: 'blob' }).then((r) => r.data),
  addEncaissement: (id, data) => http.post(`/factures/${id}/encaissements`, data).then((r) => r.data),
  removeEncaissement: (id, eid) => http.delete(`/factures/${id}/encaissements/${eid}`).then((r) => r.data),
  createAvoir: (id) => http.post(`/factures/${id}/avoir`).then((r) => r.data),
  dupliquer: (id) => http.post(`/factures/${id}/dupliquer`).then((r) => r.data),
}

export const encaissementsApi = {
  list: (params) => http.get('/encaissements', { params }).then((r) => r.data),
  exportCsv: (params) => http.get('/encaissements/export-csv', { params, responseType: 'blob' }).then((r) => r.data),
}

export const dashboardApi = {
  seuils: (params) => http.get('/dashboard/seuils', { params }).then((r) => r.data),
  actions: () => http.get('/dashboard/actions').then((r) => r.data),
  caMensuel: (params) => http.get('/dashboard/ca-mensuel', { params }).then((r) => r.data),
}

export const revenusMaltApi = {
  list: (params) => http.get('/revenus-malt', { params }).then((r) => r.data),
  create: (data) => http.post('/revenus-malt', data).then((r) => r.data),
  remove: (id) => http.delete(`/revenus-malt/${id}`).then((r) => r.data),
  importCsv: (lignes) => http.post('/revenus-malt/import-csv', { lignes }).then((r) => r.data),
}

export const urssafApi = {
  synthese: (params) => http.get('/urssaf/synthese', { params }).then((r) => r.data),
}

export const livreRecettesApi = {
  list: (params) => http.get('/livre-recettes', { params }).then((r) => r.data),
  exportCsv: (params) => http.get('/livre-recettes/export/csv', { params, responseType: 'blob' }).then((r) => r.data),
  exportPdf: (params) => http.get('/livre-recettes/export/pdf', { params, responseType: 'blob' }).then((r) => r.data),
}

export const adminApi = {
  backup: () => http.post('/admin/backup').then((r) => r.data),
  uploadQueue: (status) => http.get('/admin/upload-queue', { params: { status } }).then((r) => r.data),
  retryUploads: () => http.post('/admin/upload-queue/retry').then((r) => r.data),
}

export const produitsApi = {
  list: (params) => http.get('/produits', { params }).then((r) => r.data),
  get: (id) => http.get(`/produits/${id}`).then((r) => r.data),
  create: (data) => http.post('/produits', data).then((r) => r.data),
  update: (id, data) => http.put(`/produits/${id}`, data).then((r) => r.data),
  archive: (id) => http.delete(`/produits/${id}`).then((r) => r.data),
}

export const devisApi = {
  list: (params) => http.get('/devis', { params }).then((r) => r.data),
  get: (id) => http.get(`/devis/${id}`).then((r) => r.data),
  create: (data) => http.post('/devis', data).then((r) => r.data),
  update: (id, data) => http.put(`/devis/${id}`, data).then((r) => r.data),
  remove: (id) => http.delete(`/devis/${id}`).then((r) => r.data),
  finaliser: (id) => http.post(`/devis/${id}/finaliser`).then((r) => r.data),
  envoyer: (id) => http.post(`/devis/${id}/envoyer`).then((r) => r.data),
  accepter: (id) => http.post(`/devis/${id}/accepter`).then((r) => r.data),
  refuser: (id) => http.post(`/devis/${id}/refuser`).then((r) => r.data),
  annuler: (id) => http.post(`/devis/${id}/annuler`).then((r) => r.data),
  incrementerCycle: (id) => http.post(`/devis/${id}/incrementer-cycle`).then((r) => r.data),
  pdf: (id) => http.get(`/devis/${id}/pdf`, { responseType: 'blob' }).then((r) => r.data),
  pdfSigne: (id) => http.get(`/devis/${id}/pdf-signe`, { responseType: 'blob' }).then((r) => r.data),
  uploadSigne: (id, base64Data) => http.post(`/devis/${id}/upload-signe`, { data: base64Data }).then((r) => r.data),
  dupliquer: (id) => http.post(`/devis/${id}/dupliquer`).then((r) => r.data),
  createFacture: (devisId, data) => http.post(`/factures/from-devis/${devisId}`, data).then((r) => r.data),
}

export const avenantsApi = {
  list: (params) => http.get('/avenants', { params }).then((r) => r.data),
  get: (id) => http.get(`/avenants/${id}`).then((r) => r.data),
  create: (data) => http.post('/avenants', data).then((r) => r.data),
  update: (id, data) => http.put(`/avenants/${id}`, data).then((r) => r.data),
  remove: (id) => http.delete(`/avenants/${id}`).then((r) => r.data),
  finaliser: (id) => http.post(`/avenants/${id}/finaliser`).then((r) => r.data),
  envoyer: (id) => http.post(`/avenants/${id}/envoyer`).then((r) => r.data),
  accepter: (id) => http.post(`/avenants/${id}/accepter`).then((r) => r.data),
  refuser: (id) => http.post(`/avenants/${id}/refuser`).then((r) => r.data),
  annuler: (id) => http.post(`/avenants/${id}/annuler`).then((r) => r.data),
  pdf: (id) => http.get(`/avenants/${id}/pdf`, { responseType: 'blob' }).then((r) => r.data),
  pdfSigne: (id) => http.get(`/avenants/${id}/pdf-signe`, { responseType: 'blob' }).then((r) => r.data),
  uploadSigne: (id, base64Data) => http.post(`/avenants/${id}/upload-signe`, { data: base64Data }).then((r) => r.data),
  dupliquer: (id) => http.post(`/avenants/${id}/dupliquer`).then((r) => r.data),
}

export const contratsApi = {
  list: (params) => http.get('/contrats', { params }).then((r) => r.data),
  get: (id) => http.get(`/contrats/${id}`).then((r) => r.data),
  create: (data) => http.post('/contrats', data).then((r) => r.data),
  update: (id, data) => http.put(`/contrats/${id}`, data).then((r) => r.data),
  suspendre: (id) => http.post(`/contrats/${id}/suspendre`).then((r) => r.data),
  reactiver: (id) => http.post(`/contrats/${id}/reactiver`).then((r) => r.data),
  resilier: (id) => http.post(`/contrats/${id}/resilier`).then((r) => r.data),
  pdf: (id) => http.get(`/contrats/${id}/pdf`, { responseType: 'blob' }).then((r) => r.data),
  addIntervention: (id, data) => http.post(`/contrats/${id}/interventions`, data).then((r) => r.data),
  removeIntervention: (id, intId) => http.delete(`/contrats/${id}/interventions/${intId}`).then((r) => r.data),
  genererFacture: (id, data) => http.post(`/contrats/${id}/generer-facture`, data).then((r) => r.data),
}
