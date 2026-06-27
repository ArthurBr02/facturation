// Idempotent seed: creates the single admin user (from ADMIN_* env) and the
// app-settings rows from the catalogue. Safe to run on every container start.
import bcrypt from 'bcryptjs';
import prisma from '../src/config/prisma.js';
import env from '../src/config/env.js';
import logger from '../src/utils/logger.js';
import { SETTINGS_CATALOG, ONBOARDING_COMPLETE_KEY } from '../src/config/settingsCatalog.js';

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

async function main() {
  await seedUser();
  await seedSettings();
}

main()
  .then(() => prisma.$disconnect())
  .catch(async (err) => {
    logger.error('[seed] failed:', err);
    await prisma.$disconnect();
    process.exit(1);
  });
