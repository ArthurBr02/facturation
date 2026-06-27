// Idempotent seed: creates the single admin user (from ADMIN_* env) and the
// app-settings rows from the catalogue. Safe to run on every container start.
import bcrypt from 'bcryptjs';
import prisma from '../src/config/prisma.js';
import env from '../src/config/env.js';
import logger from '../src/utils/logger.js';
import { SETTINGS_CATALOG, ONBOARDING_COMPLETE_KEY } from '../src/config/settingsCatalog.js';
import { getDefaultHtml } from '../src/services/customTemplate.service.js';

async function seedUser() {
  const passwordHash = await bcrypt.hash(env.auth.adminPassword, 10);
  await prisma.user.upsert({
    where: { email: env.auth.adminEmail },
    create: { email: env.auth.adminEmail, passwordHash },
    update: {}, // never overwrite an existing password on reseed
  });
  logger.info(`[seed] admin user ensured: ${env.auth.adminEmail}`);
}

async function seedSettings() {
  for (const s of SETTINGS_CATALOG) {
    await prisma.appSetting.upsert({
      where: { cle: s.cle },
      create: {
        cle: s.cle,
        valeur: s.defaut ?? null,
        groupe: s.groupe,
        label: s.label,
        requis: s.requis,
        onboardingStep: s.step ?? null,
      },
      // Refresh metadata but keep any value the user already entered.
      update: { groupe: s.groupe, label: s.label, requis: s.requis, onboardingStep: s.step ?? null },
    });
  }
  await prisma.appSetting.upsert({
    where: { cle: ONBOARDING_COMPLETE_KEY },
    create: { cle: ONBOARDING_COMPLETE_KEY, valeur: 'false', groupe: 'systeme', label: 'Onboarding terminé' },
    update: {},
  });
  logger.info(`[seed] ${SETTINGS_CATALOG.length} settings ensured`);
}

// One default template per document type, pre-filled with the built-in HTML so
// every type shows an editable default template in the UI and renders through
// the placeholder pipeline (getCustomHtmlForType). Idempotent: identified by a
// fixed name, never overwritten on reseed so user edits are preserved.
const DEFAULT_TEMPLATES = [
  { type: 'facture', nom: 'Modèle par défaut — Facture', description: 'Modèle standard initialisé automatiquement. Modifiable ou remplaçable par votre propre HTML.' },
  { type: 'devis', nom: 'Modèle par défaut — Devis', description: 'Modèle standard initialisé automatiquement. Modifiable ou remplaçable par votre propre HTML.' },
  { type: 'avenant', nom: 'Modèle par défaut — Avenant', description: 'Modèle standard initialisé automatiquement. Modifiable ou remplaçable par votre propre HTML.' },
  { type: 'contrat', nom: 'Modèle par défaut — Contrat de maintenance', description: 'Contrat complet de maintenance et d’infogérance (18 articles + 3 annexes). Modifiable ou remplaçable par votre propre HTML.' },
];

async function seedDefaultTemplates() {
  let created = 0;
  for (const t of DEFAULT_TEMPLATES) {
    // Skip if our seeded template already exists (preserve any user edits).
    const existing = await prisma.template.findFirst({ where: { type: t.type, nom: t.nom } });
    if (existing) continue;
    // Only claim the default slot if no other default exists for this type.
    const hasDefault = await prisma.template.findFirst({ where: { type: t.type, estDefaut: true } });
    await prisma.template.create({
      data: {
        nom: t.nom,
        type: t.type,
        description: t.description,
        estDefaut: !hasDefault,
        customHtml: getDefaultHtml(t.type),
      },
    });
    created += 1;
  }
  logger.info(`[seed] ${created} default template(s) created`);
}

async function main() {
  await seedUser();
  await seedSettings();
  await seedDefaultTemplates();
}

main()
  .then(() => prisma.$disconnect())
  .catch(async (err) => {
    logger.error('[seed] failed:', err);
    await prisma.$disconnect();
    process.exit(1);
  });
