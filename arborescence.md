# Arborescence du code applicatif

> Fichiers sources uniquement (hors node_modules, dist, .git, migrations SQL).

## Backend (`back/`)

```
back/
├── prisma/
│   └── schema.prisma               # Schéma Prisma (DB source of truth)
└── src/
    ├── app.js                      # Express app setup
    ├── server.js                   # Entry point, port binding
    ├── config/
    │   ├── env.js                  # Toutes les variables d'env (objet `env`)
    │   ├── prisma.js               # Client Prisma singleton
    │   └── settingsCatalog.js      # Source de vérité AppSetting (seed ↔ API)
    ├── middleware/
    │   ├── auth.js                 # requireAuth (JWT)
    │   ├── error.js                # Sérialise ApiError → { error }
    │   └── validate.js             # Middleware Zod: validate(schema, target)
    ├── routes/
    │   ├── index.js                # Monte toutes les routes sous /api
    │   ├── health.js               # GET /api/health, /api/hello
    │   ├── auth.js                 # POST /api/auth/login, GET /api/auth/me
    │   ├── clients.js              # CRUD /api/clients
    │   ├── settings.js             # GET/PUT /api/settings + onboarding
    │   ├── templates.js            # CRUD /api/templates
    │   ├── factures.js             # CRUD + lifecycle /api/factures
    │   ├── encaissements.js        # GET /api/encaissements
    │   ├── dashboard.js            # GET /api/dashboard/seuils (+ Malt, plafond micro, projections, ca-mensuel) [Phase 4]
    │   ├── admin.js                # /api/admin/backup, /api/admin/upload-queue
    │   ├── produits.js             # CRUD /api/produits          [Sprint 1.5]
    │   ├── devis.js                # CRUD + lifecycle /api/devis  [Phase 2]
    │   ├── avenants.js             # CRUD + lifecycle /api/avenants [Phase 2]
    │   ├── contrats.js             # CRUD + lifecycle + interventions + generer-facture [Phase 3]
    │   ├── revenus-malt.js         # CRUD + import-csv /api/revenus-malt [Phase 4]
    │   ├── urssaf.js               # GET /api/urssaf/synthese + /trimestre/:y/:t [Phase 4]
    │   └── livre-recettes.js       # GET /api/livre-recettes + export CSV/PDF [Phase 4]
    ├── services/
    │   ├── facture.service.js      # serialize, buildSnapshot, generateFacturePdf, getEmetteurDict
    │   ├── numbering.service.js    # allocateNumber(tx, serie, annee), peekNextNumber
    │   ├── pdf.service.js          # renderHtmlToPdf, renderToTempFile (Puppeteer)
    │   ├── uploadQueue.service.js  # enqueueUpload → upload_queue + Drive immédiat
    │   ├── placeholder.service.js  # buildPlaceholderMap, resolve(text, map)
    │   ├── customTemplate.service.js # Phase 6: buildDocumentMap, renderCustomDocument, getDefaultHtml, getCustomHtmlForType
    │   ├── drive.service.js        # Google Drive API (désactivable: DRIVE_ENABLED)
    │   ├── mail.service.js         # Nodemailer (désactivable: MAIL_ENABLED)
    │   └── backup.service.js       # pg_dump + upload Drive
    ├── templates/
    │   ├── factureHtml.js          # HTML → PDF facture/avoir
    │   ├── devisHtml.js            # HTML → PDF devis          [Phase 2]
    │   ├── avenantHtml.js          # HTML → PDF avenant        [Phase 2]
    │   ├── contratHtml.js          # HTML → PDF contrat maintenance [Phase 3]
    │   └── livreRecettesHtml.js    # HTML → PDF livre des recettes [Phase 4]
    ├── utils/
    │   ├── ApiError.js             # ApiError.notFound / .badRequest
    │   ├── asyncHandler.js         # Wrapper async pour Express
    │   └── logger.js               # Logger structuré
    └── workers/
        └── jobs.js                 # Crons: retry upload, backup hebdo, maintenance mensuel [Phase 3]
```

## Frontend (`front/src/`)

```
front/src/
├── main.js                         # Vue app bootstrap
├── App.vue                         # Root component
├── api/
│   ├── http.js                     # Axios instance + JWT interceptor
│   └── index.js                    # Wrappers par ressource (authApi, clientsApi…)
├── stores/
│   ├── auth.js                     # Pinia: user, token, isAuthenticated
│   └── settings.js                 # Pinia: onboardingComplete, fetchOnboardingState
├── router/
│   └── index.js                    # Routes + garde globale (auth → onboarding → app)
├── layouts/
│   └── AppShell.vue                # Layout principal: SideNav + TopBar + <router-view>
├── components/
│   ├── BaseModal.vue               # Modale réutilisable
│   ├── ProductPicker.vue           # Bouton + dropdown recherche catalogue produits [Sprint 3.4]
│   ├── SideNav.vue                 # Sidebar navigation
│   └── TopBar.vue                  # Barre du haut
└── views/
    ├── LoginView.vue               # Authentification
    ├── OnboardingView.vue          # Assistant 7 étapes (1re connexion)
    ├── DashboardView.vue           # Tableau de bord + actions urgentes + seuils TVA [Phase 3.5.1]
    ├── ClientsView.vue             # Liste clients + modale création/édition
    ├── ClientDetailView.vue        # Vue client 360° : documents + synthèse [Phase 3.5.3]
    ├── DocumentsView.vue           # Vue unifiée Devis/Factures/Avoirs/Avenants [Phase 2]
    ├── FacturesView.vue            # Liste factures (accessible via Documents)
    ├── FactureEditView.vue         # Éditeur facture pleine page + relance mailto [Phase 3.5.4]
    ├── DevisEditView.vue           # Éditeur devis pleine page + modales avenant/facture [Phase 2]
    ├── ProduitsView.vue            # Catalogue produits & services [Sprint 1.5]
    ├── ContratEditView.vue         # Contrat maintenance pleine page + interventions [Phase 3]
    ├── RapportsView.vue            # Rapports : Seuils, URSSAF, CA mensuel, Livre des recettes, Exports [Phase 4]
    ├── TemplatesView.vue           # Gestion templates
    ├── SettingsView.vue            # Paramètres + aperçu en-tête
    └── AdminView.vue               # Administration (backup, upload-queue)
```

## Modèles de données clés (Prisma)

| Modèle         | Table              | Phase  |
|----------------|--------------------|--------|
| User           | users              | 0      |
| Client         | clients            | 0      |
| AppSetting     | app_settings       | 0      |
| Template       | templates          | 0      |
| NumberCounter  | number_counters    | 0      |
| UploadQueue    | upload_queue       | 0      |
| Facture        | factures           | 1      |
| LigneFacture   | facture_lines      | 1      |
| Encaissement   | encaissements      | 1      |
| Produit        | produits           | 1.5    |
| Devis          | devis              | 2      |
| LigneDevis     | devis_lines        | 2      |
| Avenant        | avenants           | 2      |
| LigneAvenant   | avenant_lines      | 2      |
| ContratMaintenance | contrats_maintenance | 3   |
| Intervention   | interventions      | 3      |
| PeriodeMaintenance | periodes_maintenance | 3  |
| RevenuMalt     | revenus_malt       | 4      |
