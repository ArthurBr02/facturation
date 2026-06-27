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

  // --- System (not in wizard) ---
  { cle: 'systeme.date_debut_activite', groupe: 'systeme', label: 'Date de début d\'activité', requis: false, step: null, defaut: '2026-06-26' },
];

// Number of onboarding steps in the wizard (Welcome … Confirmation).
export const ONBOARDING_STEPS = 7;

// Special flag key gating the onboarding wizard.
export const ONBOARDING_COMPLETE_KEY = 'onboarding_complete';

export default { SETTINGS_CATALOG, ONBOARDING_STEPS, ONBOARDING_COMPLETE_KEY };
