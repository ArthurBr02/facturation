import prisma from '../src/config/prisma.js';
import { SETTINGS_CATALOG, ONBOARDING_COMPLETE_KEY } from '../src/config/settingsCatalog.js';

async function main() {
  console.log('Starting developer data seeding...');

  // 1. Clean existing transactional data
  console.log('Cleaning existing transactional data...');
  await prisma.revenuMalt.deleteMany();
  await prisma.periodeMaintenance.deleteMany();
  await prisma.intervention.deleteMany();
  await prisma.contratMaintenance.deleteMany();
  await prisma.encaissement.deleteMany();
  await prisma.ligneFacture.deleteMany();
  await prisma.facture.deleteMany();
  await prisma.ligneAvenant.deleteMany();
  await prisma.avenant.deleteMany();
  await prisma.ligneDevis.deleteMany();
  await prisma.devis.deleteMany();
  await prisma.produit.deleteMany();
  await prisma.client.deleteMany();

  // Reset number counters
  await prisma.numberCounter.deleteMany();
  await prisma.numberCounter.createMany({
    data: [
      { annee: 2026, serie: 'DEV', dernierNumero: 4 },
      { annee: 2026, serie: 'AVE', dernierNumero: 1 },
      { annee: 2026, serie: 'FAC', dernierNumero: 4 },
      { annee: 2026, serie: 'AVO', dernierNumero: 1 },
      { annee: 2026, serie: 'MNT', dernierNumero: 1 },
    ]
  });

  // 2. Setup professional settings & complete onboarding
  console.log('Configuring settings...');
  const settings = [
    { cle: 'emetteur.nom', valeur: 'Arthur Lemoine', groupe: 'identite' },
    { cle: 'emetteur.entreprise', valeur: 'Lemoine Tech', groupe: 'identite' },
    { cle: 'emetteur.statut', valeur: 'Entrepreneur individuel (EI)', groupe: 'identite' },
    { cle: 'emetteur.siret', valeur: '84930291000023', groupe: 'identite' },
    { cle: 'emetteur.ape', valeur: '6201Z', groupe: 'identite' },
    { cle: 'emetteur.adresse1', valeur: '12 Rue de la République', groupe: 'coordonnees' },
    { cle: 'emetteur.adresse2', valeur: 'Bâtiment B, Apt 4', groupe: 'coordonnees' },
    { cle: 'emetteur.cp', valeur: '75011', groupe: 'coordonnees' },
    { cle: 'emetteur.ville', valeur: 'Paris', groupe: 'coordonnees' },
    { cle: 'emetteur.pays', valeur: 'France', groupe: 'coordonnees' },
    { cle: 'emetteur.email', valeur: 'arthur@lemoine-tech.fr', groupe: 'coordonnees' },
    { cle: 'emetteur.telephone', valeur: '06 12 34 56 78', groupe: 'coordonnees' },
    { cle: 'emetteur.iban', valeur: 'FR76 3000 6000 0112 3456 7890 123', groupe: 'bancaire' },
    { cle: 'emetteur.bic', valeur: 'AGRIFRPPXXX', groupe: 'bancaire' },
    { cle: 'emetteur.tjm_defaut', valeur: '600', groupe: 'facturation' },
    { cle: 'emetteur.delai_paiement', valeur: '30', groupe: 'facturation' },
    { cle: 'systeme.email_alerte', valeur: 'alerts@lemoine-tech.fr', groupe: 'alertes' },
    { cle: 'systeme.date_debut_activite', valeur: '2026-01-01', groupe: 'systeme' },
    { cle: ONBOARDING_COMPLETE_KEY, valeur: 'true', groupe: 'systeme' }
  ];

  for (const s of settings) {
    await prisma.appSetting.upsert({
      where: { cle: s.cle },
      create: { cle: s.cle, valeur: s.valeur, groupe: s.groupe },
      update: { valeur: s.valeur }
    });
  }

  // 3. Create products/services in catalog
  console.log('Seeding products/services catalog...');
  const prodSenior = await prisma.produit.create({
    data: { reference: 'DEV-SR', designation: 'Développement Senior Node/Vue', description: 'Prestation de développement fullstack senior.', prixDefaut: 650.00, unite: 'jour', categorie: 'Prestation' }
  });
  const prodConsulting = await prisma.produit.create({
    data: { reference: 'CONS-ARCHI', designation: 'Consulting Architecture Cloud', description: 'Audit et conception architecture cloud AWS/GCP.', prixDefaut: 850.00, unite: 'jour', categorie: 'Conseil' }
  });
  const prodMnt = await prisma.produit.create({
    data: { reference: 'MNT-FORFAIT', designation: 'Forfait Maintenance Mensuelle', description: 'Maintenance préventive, corrective et support.', prixDefaut: 500.00, unite: 'forfait', categorie: 'Maintenance' }
  });
  const prodHour = await prisma.produit.create({
    data: { reference: 'H-SUP', designation: 'Heure de développement sup.', description: 'Heure sup de développement hors forfait.', prixDefaut: 75.00, unite: 'heure', categorie: 'Prestation' }
  });
  const prodAudit = await prisma.produit.create({
    data: { reference: 'AUD-SEC', designation: 'Audit Sécurité Web', description: 'Audit de sécurité applicatif et tests d\'intrusion.', prixDefaut: 2400.00, unite: 'forfait', categorie: 'Audit' }
  });

  // 4. Create clients
  console.log('Seeding clients...');
  const clientAcme = await prisma.client.create({
    data: {
      type: 'pro',
      nom: 'Acme Corp',
      denomination: 'Acme Corporation SA',
      formeJuridique: 'SA',
      email: 'factures@acme.com',
      telephone: '01 40 20 30 40',
      adresse1: '45 Rue de la Paix',
      codePostal: '75002',
      ville: 'Paris',
      siren: '123456789',
      tvaIntra: 'FR12123456789',
      conditionsPaiement: 30,
      contactPrincipal: 'Jean Dupont (Directeur Technique)',
      tjmNegocie: 600.00,
      notesInternes: 'Client historique de confiance. Toujours payer par virement à 30 jours.'
    }
  });

  const clientStark = await prisma.client.create({
    data: {
      type: 'pro',
      nom: 'Stark Industries',
      denomination: 'Stark Industries France',
      formeJuridique: 'SAS',
      email: 'accounting@stark.fr',
      telephone: '04 90 80 70 60',
      adresse1: 'Avenue de l\'Europe',
      codePostal: '31000',
      ville: 'Toulouse',
      siren: '987654321',
      tvaIntra: 'FR98987654321',
      conditionsPaiement: 15,
      contactPrincipal: 'Pepper Potts',
      tjmNegocie: 800.00,
      notesInternes: 'Exige un niveau de réactivité élevé. TJM premium négocié pour expertise cloud.'
    }
  });

  const clientGlobex = await prisma.client.create({
    data: {
      type: 'pro',
      nom: 'Globex Corp',
      denomination: 'Globex Corporation',
      formeJuridique: 'SARL',
      email: 'billing@globex.com',
      adresse1: '8 Boulevard des Hérissons',
      codePostal: '69002',
      ville: 'Lyon',
      siren: '456789123',
      conditionsPaiement: 45,
      contactPrincipal: 'Homer Simpson',
      tjmNegocie: 550.00,
      notesInternes: 'Attention aux retards de paiement fréquents. Bien relancer dès l\'échéance passée.'
    }
  });

  const clientAlice = await prisma.client.create({
    data: {
      type: 'particulier',
      nom: 'Alice Martin',
      email: 'alice.martin@gmail.com',
      telephone: '06 88 77 66 55',
      adresse1: '4 Place de la Mairie',
      codePostal: '44000',
      ville: 'Nantes',
      notesInternes: 'Particulier. Création d\'un blog de photographie personnel.'
    }
  });

  // 5. Create Quotes (Devis)
  console.log('Seeding quotes (devis)...');

  // Devis 1: Acme - Refonte E-commerce (Accepted)
  const devisAcme = await prisma.devis.create({
    data: {
      clientId: clientAcme.id,
      numero: 'DEV-2026-001',
      statut: 'accepte',
      titre: 'Refonte de la plateforme E-Commerce',
      description: 'Prestation globale comprenant l\'audit, le développement backend/frontend et le déploiement de la nouvelle boutique.',
      dateEmission: new Date('2026-01-02'),
      validiteJours: 30,
      totalHt: 12000.00,
      acomptePct: 30.00,
      verrouillee: true,
      finaliseeAt: new Date('2026-01-02'),
      snapshot: {
        client: clientAcme,
        emetteur: { nom: 'Arthur Lemoine', entreprise: 'Lemoine Tech', siret: '84930291000023' }
      }
    }
  });

  await prisma.ligneDevis.createMany({
    data: [
      { devisId: devisAcme.id, designation: 'Spécifications & Architecture technique', quantite: 3.00, prixUnitaire: 600.00, ordre: 1 },
      { devisId: devisAcme.id, designation: 'Développement Backend (Express/Prisma) & Frontend (Vue 3)', quantite: 15.00, prixUnitaire: 600.00, ordre: 2 },
      { devisId: devisAcme.id, designation: 'Recette technique, tests et déploiement de la production', quantite: 2.00, prixUnitaire: 600.00, ordre: 3 },
    ]
  });

  // Devis 2: Stark Industries - Audit Cloud (Sent)
  const devisStark = await prisma.devis.create({
    data: {
      clientId: clientStark.id,
      numero: 'DEV-2026-002',
      statut: 'envoye',
      titre: 'Audit Architecture Cloud & Sécurité',
      description: 'Analyse de l\'infrastructure AWS actuelle, détection des failles de sécurité et recommandations d\'optimisation des coûts.',
      dateEmission: new Date('2026-06-15'),
      validiteJours: 30,
      totalHt: 2400.00,
      verrouillee: true,
      dateEnvoi: new Date('2026-06-16'),
      finaliseeAt: new Date('2026-06-15'),
      snapshot: {
        client: clientStark,
        emetteur: { nom: 'Arthur Lemoine', entreprise: 'Lemoine Tech', siret: '84930291000023' }
      }
    }
  });

  await prisma.ligneDevis.createMany({
    data: [
      { devisId: devisStark.id, designation: 'Audit technique et scan de vulnérabilités', quantite: 2.00, prixUnitaire: 800.00, ordre: 1 },
      { devisId: devisStark.id, designation: 'Rapport de synthèse et présentation des correctifs', quantite: 1.00, prixUnitaire: 800.00, ordre: 2 },
    ]
  });

  // Devis 3: Globex - Accompagnement Devops (Draft)
  const devisGlobex = await prisma.devis.create({
    data: {
      clientId: clientGlobex.id,
      numero: 'DEV-2026-003',
      statut: 'brouillon',
      titre: 'Mise en place pipeline CI/CD et Dockerisation',
      description: 'Automatisation des déploiements via GitHub Actions et configuration de Docker pour les environnements de staging et prod.',
      dateEmission: new Date('2026-06-25'),
      validiteJours: 30,
      totalHt: 2200.00,
      verrouillee: false
    }
  });

  await prisma.ligneDevis.createMany({
    data: [
      { devisId: devisGlobex.id, designation: 'Dockerisation de l\'application Node/React', quantite: 1.50, prixUnitaire: 550.00, ordre: 1 },
      { devisId: devisGlobex.id, designation: 'Configuration des pipelines GitHub Actions & déploiement K8s', quantite: 2.50, prixUnitaire: 550.00, ordre: 2 },
    ]
  });

  // Devis 4: Alice Martin - Site Web Vitrine (Expired)
  const devisAlice = await prisma.devis.create({
    data: {
      clientId: clientAlice.id,
      numero: 'DEV-2026-004',
      statut: 'expire',
      titre: 'Création d\'un site Web vitrine (Portfolio)',
      description: 'Développement d\'un site web complet responsive avec galerie d\'images pour présenter son activité de photographe.',
      dateEmission: new Date('2026-03-01'),
      validiteJours: 30,
      totalHt: 6000.00,
      verrouillee: true,
      finaliseeAt: new Date('2026-03-01'),
      snapshot: {
        client: clientAlice,
        emetteur: { nom: 'Arthur Lemoine', entreprise: 'Lemoine Tech', siret: '84930291000023' }
      }
    }
  });

  await prisma.ligneDevis.createMany({
    data: [
      { devisId: devisAlice.id, designation: 'Design UI/UX et maquettes interactives', quantite: 5.00, prixUnitaire: 400.00, ordre: 1 },
      { devisId: devisAlice.id, designation: 'Développement Nuxt.js et intégration CMS headless', quantite: 10.00, prixUnitaire: 400.00, ordre: 2 },
    ]
  });

  // 6. Create Avenant to Devis 1
  console.log('Seeding avenants...');
  const avenantAcme = await prisma.avenant.create({
    data: {
      devisId: devisAcme.id,
      numero: 'AVE-2026-001',
      statut: 'accepte',
      objet: 'Ajout module de paiement Stripe et abonnements',
      description: 'Suite aux ateliers techniques, intégration du SDK Stripe pour gérer des paiements uniques ainsi que des formules d\'abonnements mensuels.',
      totalHt: 1800.00,
      verrouillee: true,
      dateEmission: new Date('2026-02-05'),
      finaliseeAt: new Date('2026-02-05'),
      snapshot: {
        devis: devisAcme,
        emetteur: { nom: 'Arthur Lemoine', entreprise: 'Lemoine Tech', siret: '84930291000023' }
      }
    }
  });

  await prisma.ligneAvenant.create({
    data: { avenantId: avenantAcme.id, designation: 'Développement de l\'intégration Stripe & gestion webhooks (3 jours)', quantite: 3.00, prixUnitaire: 600.00, ordre: 1 }
  });

  // Update devis parent totalHt to include accepted avenant
  await prisma.devis.update({
    where: { id: devisAcme.id },
    data: { totalHt: 12000.00 + 1800.00 }
  });

  // 7. Create Maintenance Contract
  console.log('Seeding maintenance contracts...');
  const contratAcme = await prisma.contratMaintenance.create({
    data: {
      clientId: clientAcme.id,
      numero: 'MNT-2026-001',
      statut: 'actif',
      titre: 'Contrat de support & maintenance évolutive',
      description: 'Support mensuel incluant la maintenance préventive, les mises à jour de sécurité et 5h de développement de correctifs.',
      dateDebut: new Date('2026-01-01'),
      dureeMois: 12,
      reconduction: true,
      preavisJours: 30,
      montantMensuel: 500.00,
      heuresIncluses: 5.00,
      thmDepassement: 75.00,
      perimetreCouvert: 'Application e-commerce Node/Vue, infrastructure AWS (EC2, RDS). Support par e-mail sous 24h ouvrées.',
      exclusions: 'Refonte complète de fonctionnalités, création de nouvelles pages complexes (soumises à devis séparé).',
      snapshot: {
        client: clientAcme,
        emetteur: { nom: 'Arthur Lemoine', entreprise: 'Lemoine Tech', siret: '84930291000023' }
      }
    }
  });

  // Interventions for maintenance contract
  const interventions = [
    // Janvier 2026: 4h
    { contratId: contratAcme.id, date: new Date('2026-01-15'), dureeH: 2.00, description: 'Mise à jour de sécurité des dépendances NPM.' },
    { contratId: contratAcme.id, date: new Date('2026-01-20'), dureeH: 2.00, description: 'Optimisation de la requête SQL de recherche de produits.' },

    // Février 2026: 6h (1h dépassement)
    { contratId: contratAcme.id, date: new Date('2026-02-10'), dureeH: 3.00, description: 'Correction bug panier lors de la perte de session.' },
    { contratId: contratAcme.id, date: new Date('2026-02-18'), dureeH: 3.00, description: 'Ajout de logs de debug sur le webhook de paiement Stripe.' },

    // Mars 2026: 3h
    { contratId: contratAcme.id, date: new Date('2026-03-12'), dureeH: 3.00, description: 'Mise à jour SSL et renouvellement certificat Let\'s Encrypt.' },

    // Avril 2026: 5h
    { contratId: contratAcme.id, date: new Date('2026-04-05'), dureeH: 2.50, description: 'Rapports hebdomadaires automatisés par e-mail.' },
    { contratId: contratAcme.id, date: new Date('2026-04-20'), dureeH: 2.50, description: 'Résolution bug sur l\'affichage des avoirs clients.' },

    // Mai 2026: 7.5h (2.5h dépassement)
    { contratId: contratAcme.id, date: new Date('2026-05-08'), dureeH: 4.00, description: 'Migration base de données Postgres 15 vers 16.' },
    { contratId: contratAcme.id, date: new Date('2026-05-14'), dureeH: 3.50, description: 'Correction lenteurs sur le dashboard d\'administration.' },

    // Juin 2026 (mois courant): 2h
    { contratId: contratAcme.id, date: new Date('2026-06-10'), dureeH: 2.00, description: 'Mise en conformité mentions légales RGPD sur le site.' },
  ];

  await prisma.intervention.createMany({ data: interventions });

  // 8. Create Invoices (Factures) & Payments (Encaissements)
  console.log('Seeding invoices and payments...');

  // Invoice 1: Acompte 30% Refonte Acme (Paid)
  const fact1 = await prisma.facture.create({
    data: {
      numero: 'FAC-2026-001',
      type: 'acompte',
      statut: 'payee',
      clientId: clientAcme.id,
      devisId: devisAcme.id,
      dateEmission: new Date('2026-01-05'),
      dateEcheance: new Date('2026-02-05'),
      objet: 'Facture d\'acompte 30% - Refonte plateforme E-commerce',
      totalHt: 3600.00,
      verrouillee: true,
      finaliseeAt: new Date('2026-01-05'),
      snapshot: {
        client: clientAcme,
        emetteur: { nom: 'Arthur Lemoine', entreprise: 'Lemoine Tech', siret: '84930291000023' }
      }
    }
  });

  await prisma.ligneFacture.create({
    data: { factureId: fact1.id, designation: 'Facture d\'acompte 30% pour la refonte de la plateforme E-Commerce (selon devis DEV-2026-001)', quantite: 1.00, prixUnitaire: 3600.00, ordre: 1 }
  });

  await prisma.encaissement.create({
    data: { factureId: fact1.id, dateEncaissement: new Date('2026-01-08'), montant: 3600.00, moyen: 'virement', reference: 'VIRACMEAC30' }
  });


  // Invoice 2: Solde Refonte Acme + Avenant (Paid)
  // Devis total was 13800€, minus 3600€ acompte = 10200€
  const fact2 = await prisma.facture.create({
    data: {
      numero: 'FAC-2026-002',
      type: 'solde',
      statut: 'payee',
      clientId: clientAcme.id,
      devisId: devisAcme.id,
      dateEmission: new Date('2026-03-05'),
      dateEcheance: new Date('2026-04-05'),
      dateExecutionDebut: new Date('2026-01-10'),
      dateExecutionFin: new Date('2026-02-28'),
      objet: 'Facture de solde - Refonte plateforme E-commerce & Avenant 1',
      totalHt: 10200.00,
      verrouillee: true,
      finaliseeAt: new Date('2026-03-05'),
      snapshot: {
        client: clientAcme,
        emetteur: { nom: 'Arthur Lemoine', entreprise: 'Lemoine Tech', siret: '84930291000023' }
      }
    }
  });

  await prisma.ligneFacture.createMany({
    data: [
      { factureId: fact2.id, designation: 'Facture de solde de la prestation (selon devis DEV-2026-001)', quantite: 1.00, prixUnitaire: 8400.00, ordre: 1 },
      { factureId: fact2.id, designation: 'Avenant 1 : Intégration module de paiement Stripe et abonnements (AVE-2026-001)', quantite: 1.00, prixUnitaire: 1800.00, ordre: 2 }
    ]
  });

  await prisma.encaissement.create({
    data: { factureId: fact2.id, dateEncaissement: new Date('2026-03-10'), montant: 10200.00, moyen: 'virement', reference: 'VIRACMESOLDE' }
  });


  // Invoice 3: Stark - Consulting Archi (Partially paid)
  const fact3 = await prisma.facture.create({
    data: {
      numero: 'FAC-2026-003',
      type: 'standard',
      statut: 'partielle',
      clientId: clientStark.id,
      dateEmission: new Date('2026-05-15'),
      dateEcheance: new Date('2026-06-15'), // Overdue!
      dateExecutionDebut: new Date('2026-05-01'),
      dateExecutionFin: new Date('2026-05-10'),
      objet: 'Conseil Architecture AWS & Plan de migration Serverless',
      totalHt: 6400.00,
      verrouillee: true,
      finaliseeAt: new Date('2026-05-15'),
      snapshot: {
        client: clientStark,
        emetteur: { nom: 'Arthur Lemoine', entreprise: 'Lemoine Tech', siret: '84930291000023' }
      }
    }
  });

  await prisma.ligneFacture.create({
    data: { factureId: fact3.id, designation: 'Prestation de conseil architecture cloud (TJM négocié 800€/j)', quantite: 8.00, prixUnitaire: 800.00, ordre: 1 }
  });

  await prisma.encaissement.create({
    data: { factureId: fact3.id, dateEncaissement: new Date('2026-05-20'), montant: 4000.00, moyen: 'virement', reference: 'VIRSTARKPART' }
  });


  // Invoice 4: Globex - Audit Sécurité (Finalised - Overdue & unpaid)
  const fact4 = await prisma.facture.create({
    data: {
      numero: 'FAC-2026-004',
      type: 'standard',
      statut: 'finalisee',
      clientId: clientGlobex.id,
      dateEmission: new Date('2026-05-10'),
      dateEcheance: new Date('2026-06-10'), // Overdue!
      objet: 'Audit de sécurité applicative complet',
      totalHt: 2400.00,
      verrouillee: true,
      finaliseeAt: new Date('2026-05-10'),
      snapshot: {
        client: clientGlobex,
        emetteur: { nom: 'Arthur Lemoine', entreprise: 'Lemoine Tech', siret: '84930291000023' }
      }
    }
  });

  await prisma.ligneFacture.create({
    data: { factureId: fact4.id, designation: 'Audit Sécurité Web (Forfait)', quantite: 1.00, prixUnitaire: 2400.00, ordre: 1 }
  });


  // Invoice 5: Avoir issued on Invoice 4 for discount (Finalised / Paid)
  const fact5Avoir = await prisma.facture.create({
    data: {
      numero: 'AVO-2026-001',
      type: 'avoir',
      statut: 'finalisee',
      clientId: clientGlobex.id,
      factureOrigineId: fact4.id,
      dateEmission: new Date('2026-06-12'),
      dateEcheance: new Date('2026-06-12'),
      objet: 'Geste commercial suite à réduction périmètre audit sécurité',
      totalHt: 400.00,
      verrouillee: true,
      finaliseeAt: new Date('2026-06-12'),
      snapshot: {
        client: clientGlobex,
        emetteur: { nom: 'Arthur Lemoine', entreprise: 'Lemoine Tech', siret: '84930291000023' }
      }
    }
  });

  await prisma.ligneFacture.create({
    data: { factureId: fact5Avoir.id, designation: 'Réduction commerciale suite à suppression tests d\'intrusion sur la DB secondaire', quantite: 1.00, prixUnitaire: 400.00, ordre: 1 }
  });


  // Invoice 6: Acme - Maintenance Brouillon
  const fact6 = await prisma.facture.create({
    data: {
      numero: null,
      type: 'standard',
      statut: 'brouillon',
      clientId: clientAcme.id,
      dateEmission: new Date('2026-06-25'),
      objet: 'Forfait maintenance évolutive - Juin 2026',
      totalHt: 500.00,
      verrouillee: false
    }
  });

  await prisma.ligneFacture.create({
    data: { factureId: fact6.id, designation: 'Forfait Maintenance Mensuelle - Juin 2026', quantite: 1.00, prixUnitaire: 500.00, ordre: 1 }
  });


  // 9. Generate Monthly Invoices for Maintenance Contract
  console.log('Generating maintenance invoices...');

  // Helper function to create finalized maintenance invoice
  const createMntInvoice = async (mois, annee, dateEmission, total, designLines, estPaye, encaissementDate) => {
    // Increment counter manually
    const counter = await prisma.numberCounter.upsert({
      where: { annee_serie: { annee: 2026, serie: 'FAC' } },
      create: { annee: 2026, serie: 'FAC', dernierNumero: 1 },
      update: { dernierNumero: { increment: 1 } }
    });
    const numStr = `FAC-2026-${String(counter.dernierNumero).padStart(3, '0')}`;

    const fact = await prisma.facture.create({
      data: {
        numero: numStr,
        type: 'standard',
        statut: estPaye ? 'payee' : 'finalisee',
        clientId: clientAcme.id,
        contratId: contratAcme.id,
        dateEmission: dateEmission,
        dateEcheance: new Date(dateEmission.getTime() + 30 * 24 * 60 * 60 * 1000),
        objet: `Facture maintenance - Mois de ${['Janvier', 'Février', 'Mars', 'Avril', 'Mai', 'Juin'][mois-1]} 2026`,
        totalHt: total,
        verrouillee: true,
        finaliseeAt: dateEmission,
        snapshot: {
          client: clientAcme,
          emetteur: { nom: 'Arthur Lemoine', entreprise: 'Lemoine Tech', siret: '84930291000023' }
        }
      }
    });

    for (let i = 0; i < designLines.length; i++) {
      await prisma.ligneFacture.create({
        data: { factureId: fact.id, designation: designLines[i].designation, quantite: designLines[i].qte, prixUnitaire: designLines[i].pu, ordre: i + 1 }
      });
    }

    await prisma.periodeMaintenance.create({
      data: { contratId: contratAcme.id, annee, mois, factureId: fact.id }
    });

    if (estPaye) {
      await prisma.encaissement.create({
        data: {
          factureId: fact.id,
          dateEncaissement: encaissementDate,
          montant: total,
          moyen: 'virement',
          reference: `VIRACMEMENT${mois}`
        }
      });
    }
  };

  // January maintenance (500€, Paid)
  await createMntInvoice(1, 2026, new Date('2026-02-01'), 500.00, [
    { designation: 'Forfait support & maintenance évolutive - Janvier 2026', qte: 1.00, pu: 500.00 }
  ], true, new Date('2026-02-15'));

  // February maintenance (575€, Paid, 1h overshoot)
  await createMntInvoice(2, 2026, new Date('2026-03-01'), 575.00, [
    { designation: 'Forfait support & maintenance évolutive - Février 2026', qte: 1.00, pu: 500.00 },
    { designation: 'Dépassement d\'heures de maintenance (1.00 h sup. à 75.00€/h)', qte: 1.00, pu: 75.00 }
  ], true, new Date('2026-03-20'));

  // March maintenance (500€, Paid)
  await createMntInvoice(3, 2026, new Date('2026-04-01'), 500.00, [
    { designation: 'Forfait support & maintenance évolutive - Mars 2026', qte: 1.00, pu: 500.00 }
  ], true, new Date('2026-04-18'));

  // April maintenance (500€, Paid)
  await createMntInvoice(4, 2026, new Date('2026-05-01'), 500.00, [
    { designation: 'Forfait support & maintenance évolutive - Avril 2026', qte: 1.00, pu: 500.00 }
  ], true, new Date('2026-05-15'));

  // May maintenance (687.50€, Finalised / Overdue & unpaid, 2.5h overshoot)
  await createMntInvoice(5, 2026, new Date('2026-06-01'), 687.50, [
    { designation: 'Forfait support & maintenance évolutive - Mai 2026', qte: 1.00, pu: 500.00 },
    { designation: 'Dépassement d\'heures de maintenance (2.50 h sup. à 75.00€/h)', qte: 2.50, pu: 75.00 }
  ], false, null);


  // 10. Malt Revenues (RevenuMalt)
  console.log('Seeding Malt revenues...');
  const maltRevenues = [
    { dateEncaissement: new Date('2026-01-20'), montantNet: 3200.00, description: 'Mission Malt - Dev React - Sprint 1' },
    { dateEncaissement: new Date('2026-02-22'), montantNet: 3200.00, description: 'Mission Malt - Dev React - Sprint 2' },
    { dateEncaissement: new Date('2026-03-25'), montantNet: 4500.00, description: 'Audit d\'infrastructure Cloud pour Malt Client A' },
    { dateEncaissement: new Date('2026-04-20'), montantNet: 3200.00, description: 'Mission Malt - Dev React - Sprint 3' },
    { dateEncaissement: new Date('2026-05-20'), montantNet: 3500.00, description: 'Mission Malt - Dev React - Sprint 4 & Finalisation' },
    { dateEncaissement: new Date('2026-06-15'), montantNet: 4100.00, description: 'Mission Malt - Refonte complète landing page marketing' },
  ];

  await prisma.revenuMalt.createMany({ data: maltRevenues });

  console.log('Developer data seeding successfully completed!');
}

main()
  .then(() => prisma.$disconnect())
  .catch(async (err) => {
    console.error('Failed developer data seeding:', err);
    await prisma.$disconnect();
    process.exit(1);
  });
