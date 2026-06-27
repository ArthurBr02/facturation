// Catalogue of application settings. Single source of truth shared by the seed
// (to create the rows) and the API (to expose labels, groups and onboarding
// steps). Onboarding steps mirror the wizard described in PLAN.md §5.7.2.
//
// step: which onboarding wizard step the setting belongs to (1..7). Settings
// with step=null are system settings not shown in the wizard.

export const SETTINGS_CATALOG = [
  // --- Step 2: Identité professionnelle ---
  { cle: 'emetteur.nom', groupe: 'identite', label: 'Prénom et nom', requis: true, step: 2 },
  { cle: 'emetteur.entreprise', groupe: 'identite', label: 'Raison sociale', requis: false, step: 2 },
  { cle: 'emetteur.statut', groupe: 'identite', label: 'Statut juridique', requis: false, step: 2, defaut: 'Entrepreneur individuel (EI)' },
  { cle: 'emetteur.siret', groupe: 'identite', label: 'SIRET', requis: true, step: 2 },
  { cle: 'emetteur.ape', groupe: 'identite', label: 'Code APE', requis: false, step: 2, defaut: '6201Z' },

  // --- Step 3: Coordonnées ---
  { cle: 'emetteur.adresse1', groupe: 'coordonnees', label: 'Adresse (ligne 1)', requis: true, step: 3 },
  { cle: 'emetteur.adresse2', groupe: 'coordonnees', label: 'Adresse (ligne 2)', requis: false, step: 3 },
  { cle: 'emetteur.cp', groupe: 'coordonnees', label: 'Code postal', requis: false, step: 3 },
  { cle: 'emetteur.ville', groupe: 'coordonnees', label: 'Ville', requis: false, step: 3 },
  { cle: 'emetteur.pays', groupe: 'coordonnees', label: 'Pays', requis: false, step: 3, defaut: 'France' },
  { cle: 'emetteur.email', groupe: 'coordonnees', label: 'E-mail professionnel', requis: false, step: 3 },
  { cle: 'emetteur.telephone', groupe: 'coordonnees', label: 'Téléphone', requis: false, step: 3 },

  // --- Step 4: Coordonnées bancaires ---
  { cle: 'emetteur.iban', groupe: 'bancaire', label: 'IBAN', requis: true, step: 4 },
  { cle: 'emetteur.bic', groupe: 'bancaire', label: 'BIC', requis: false, step: 4 },

  // --- Step 5: Préférences de facturation ---
  { cle: 'emetteur.tjm_defaut', groupe: 'facturation', label: 'TJM par défaut (€/jour)', requis: false, step: 5, defaut: '400' },
  { cle: 'emetteur.delai_paiement', groupe: 'facturation', label: 'Délai de paiement (jours)', requis: false, step: 5, defaut: '30' },
  {
    cle: 'emetteur.mention_tva',
    groupe: 'facturation',
    label: 'Mention TVA',
    requis: false,
    step: 5,
    defaut: 'TVA non applicable, art. 293 B du CGI',
  },
  {
    cle: 'emetteur.penalites',
    groupe: 'facturation',
    label: 'Mention pénalités de retard',
    requis: false,
    step: 5,
    defaut:
      'En cas de retard de paiement, pénalités au taux de 3 fois le taux d’intérêt légal, et indemnité forfaitaire de recouvrement de 40 € (art. L441-10 et D441-5 du Code de commerce). Escompte pour paiement anticipé : néant.',
  },

  // --- Step 6: Alertes ---
  { cle: 'systeme.email_alerte', groupe: 'alertes', label: 'E-mail de réception des alertes', requis: false, step: 6 },

  // --- Step 7: Maintenance & infogérance ---
  // Standard terms reused across every maintenance contract. They feed the
  // {{maintenance.*}} placeholders of the default maintenance contract template.
  // All optional: a blank value renders as a fillable blank in the contract.
  { cle: 'emetteur.maint_taux_horaire', groupe: 'maintenance', label: 'Taux horaire dépassement (€)', requis: false, step: 7, defaut: '70' },
  { cle: 'emetteur.maint_tranche_facturation', groupe: 'maintenance', label: 'Tranche de facturation', requis: false, step: 7, defaut: '15 minutes' },
  { cle: 'emetteur.maint_tjm', groupe: 'maintenance', label: 'TJM évolutions majeures (€)', requis: false, step: 7, defaut: '450' },
  { cle: 'emetteur.maint_plage_horaire', groupe: 'maintenance', label: "Plage horaire d'intervention", requis: false, step: 7, defaut: '9h00 – 18h00' },
  { cle: 'emetteur.maint_delai_critique', groupe: 'maintenance', label: 'Délai de prise en compte — Critique', requis: false, step: 7, defaut: '4 heures ouvrées' },
  { cle: 'emetteur.maint_delai_majeur', groupe: 'maintenance', label: 'Délai de prise en compte — Majeur', requis: false, step: 7, defaut: '1 jour ouvré' },
  { cle: 'emetteur.maint_delai_mineur', groupe: 'maintenance', label: 'Délai de prise en compte — Mineur', requis: false, step: 7, defaut: '3 jours ouvrés' },
  { cle: 'emetteur.maint_canal_signalement', groupe: 'maintenance', label: 'Canal de signalement', requis: false, step: 7, defaut: 'courriel' },
  { cle: 'emetteur.maint_frequence_reporting', groupe: 'maintenance', label: 'Fréquence de reporting', requis: false, step: 7, defaut: 'mensuelle' },
  { cle: 'emetteur.maint_detail_supervision', groupe: 'maintenance', label: 'Détail de la supervision', requis: false, step: 7, defaut: 'disponibilité du service, ressources, journaux' },
  { cle: 'emetteur.maint_frequence_sauvegarde', groupe: 'maintenance', label: 'Fréquence des sauvegardes', requis: false, step: 7, defaut: 'quotidienne' },
  { cle: 'emetteur.maint_localisation_sauvegarde', groupe: 'maintenance', label: 'Localisation des sauvegardes', requis: false, step: 7, defaut: "l'Infrastructure du Client" },
  { cle: 'emetteur.maint_retention_sauvegarde', groupe: 'maintenance', label: 'Rétention des sauvegardes', requis: false, step: 7, defaut: '30 jours glissants' },
  { cle: 'emetteur.maint_moyen_paiement', groupe: 'maintenance', label: 'Moyen de paiement', requis: false, step: 7, defaut: 'virement bancaire' },
  { cle: 'emetteur.maint_modalite_emission', groupe: 'maintenance', label: "Modalité d'émission", requis: false, step: 7, defaut: 'à terme à échoir, le 1er de chaque mois' },
  { cle: 'emetteur.maint_preavis_revision', groupe: 'maintenance', label: 'Préavis de révision du prix', requis: false, step: 7, defaut: '2 mois' },
  { cle: 'emetteur.maint_delai_suspension', groupe: 'maintenance', label: 'Délai avant suspension pour impayé', requis: false, step: 7, defaut: '15 jours' },
  { cle: 'emetteur.maint_duree_confidentialite', groupe: 'maintenance', label: 'Durée de confidentialité post-contrat', requis: false, step: 7, defaut: '2 ans' },
  { cle: 'emetteur.maint_periode_reconduction', groupe: 'maintenance', label: 'Période de reconduction tacite', requis: false, step: 7, defaut: '12 mois' },
  { cle: 'emetteur.maint_preavis_resiliation', groupe: 'maintenance', label: 'Préavis de résiliation', requis: false, step: 7, defaut: '3 mois' },
  { cle: 'emetteur.maint_delai_remede', groupe: 'maintenance', label: 'Délai de remède en cas de manquement', requis: false, step: 7, defaut: '30 jours' },
  { cle: 'emetteur.maint_plafond_responsabilite_mois', groupe: 'maintenance', label: 'Plafond de responsabilité (mois)', requis: false, step: 7, defaut: '12' },
  { cle: 'emetteur.maint_assurance_rcpro', groupe: 'maintenance', label: 'Mention assurance RC Pro', requis: false, step: 7, defaut: 'ne pas être soumis à une obligation légale d’assurance responsabilité civile professionnelle' },
  { cle: 'emetteur.maint_assureur', groupe: 'maintenance', label: 'Assureur (si RC Pro souscrite)', requis: false, step: 7 },
  { cle: 'emetteur.maint_duree_reversibilite', groupe: 'maintenance', label: 'Durée de réversibilité', requis: false, step: 7, defaut: '1 mois' },
  { cle: 'emetteur.maint_heures_reversibilite', groupe: 'maintenance', label: 'Heures de réversibilité incluses', requis: false, step: 7, defaut: '4 heures' },
  { cle: 'emetteur.maint_duree_force_majeure', groupe: 'maintenance', label: 'Durée de force majeure avant résiliation', requis: false, step: 7, defaut: '30 jours' },
  { cle: 'emetteur.maint_tribunal', groupe: 'maintenance', label: 'Tribunal de commerce compétent', requis: false, step: 7, defaut: 'Le Mans' },
  { cle: 'emetteur.maint_lieu_signature', groupe: 'maintenance', label: 'Lieu de signature par défaut', requis: false, step: 7, defaut: 'Le Mans' },

  // --- System (not in wizard) ---
  { cle: 'systeme.date_debut_activite', groupe: 'systeme', label: 'Date de début d\'activité', requis: false, step: null, defaut: '2026-06-26' },
];

// Number of onboarding steps in the wizard (Welcome … Maintenance … Confirmation).
export const ONBOARDING_STEPS = 8;

// Special flag key gating the onboarding wizard.
export const ONBOARDING_COMPLETE_KEY = 'onboarding_complete';

export default { SETTINGS_CATALOG, ONBOARDING_STEPS, ONBOARDING_COMPLETE_KEY };
