// Settings & onboarding routes.
import { Router } from 'express';
import { z } from 'zod';
import prisma from '../config/prisma.js';
import asyncHandler from '../utils/asyncHandler.js';
import { validate } from '../middleware/validate.js';
import ApiError from '../utils/ApiError.js';
import { ONBOARDING_COMPLETE_KEY, ONBOARDING_STEPS } from '../config/settingsCatalog.js';
import { buildPlaceholderMap } from '../services/placeholder.service.js';

const router = Router();

// Settings that carry user data (excludes the onboarding flag from the lists).
function isUserSetting(s) {
  return s.cle !== ONBOARDING_COMPLETE_KEY;
}

// GET /api/settings — all settings grouped by `groupe`.
router.get(
  '/',
  asyncHandler(async (req, res) => {
    const all = await prisma.appSetting.findMany({ orderBy: [{ groupe: 'asc' }, { cle: 'asc' }] });
    const groups = {};
    for (const s of all.filter(isUserSetting)) {
      (groups[s.groupe] ||= []).push(s);
    }
    res.json({ groups });
  }),
);

const updateSchema = z.object({
  values: z.record(z.string(), z.string().nullable()),
});

// PUT /api/settings — update one or more settings: { values: { "emetteur.nom": "…" } }
router.put(
  '/',
  validate(updateSchema),
  asyncHandler(async (req, res) => {
    const { values } = req.body;
    await prisma.$transaction(
      Object.entries(values).map(([cle, valeur]) =>
        prisma.appSetting.update({ where: { cle }, data: { valeur } }),
      ),
    );
    res.json({ updated: Object.keys(values).length });
  }),
);

// GET /api/settings/onboarding — wizard state + values grouped by step.
router.get(
  '/onboarding',
  asyncHandler(async (req, res) => {
    const all = await prisma.appSetting.findMany();
    const completeFlag = all.find((s) => s.cle === ONBOARDING_COMPLETE_KEY);
    const steps = {};
    for (const s of all.filter((x) => x.onboardingStep != null)) {
      (steps[s.onboardingStep] ||= []).push(s);
    }
    res.json({
      complete: completeFlag?.valeur === 'true',
      totalSteps: ONBOARDING_STEPS,
      steps,
    });
  }),
);

const stepSchema = z.object({
  values: z.record(z.string(), z.string().nullable()),
});

// PUT /api/settings/onboarding/:step — save the values of one wizard step.
router.put(
  '/onboarding/:step',
  validate(stepSchema),
  asyncHandler(async (req, res) => {
    const step = Number(req.params.step);
    const { values } = req.body;
    // Only allow keys that actually belong to this step.
    const owned = await prisma.appSetting.findMany({ where: { onboardingStep: step } });
    const ownedKeys = new Set(owned.map((s) => s.cle));
    const ops = Object.entries(values)
      .filter(([cle]) => ownedKeys.has(cle))
      .map(([cle, valeur]) => prisma.appSetting.update({ where: { cle }, data: { valeur } }));
    await prisma.$transaction(ops);
    res.json({ step, updated: ops.length });
  }),
);

// POST /api/settings/onboarding/complete — validate required fields, set flag.
router.post(
  '/onboarding/complete',
  asyncHandler(async (req, res) => {
    const required = await prisma.appSetting.findMany({ where: { requis: true } });
    const missing = required.filter((s) => !s.valeur || s.valeur.trim() === '');
    if (missing.length > 0) {
      throw ApiError.badRequest('Champs obligatoires manquants', missing.map((s) => s.cle));
    }
    await prisma.appSetting.upsert({
      where: { cle: ONBOARDING_COMPLETE_KEY },
      create: { cle: ONBOARDING_COMPLETE_KEY, valeur: 'true', groupe: 'systeme' },
      update: { valeur: 'true' },
    });
    res.json({ complete: true });
  }),
);

// POST /api/settings/onboarding/reset — relance the wizard.
router.post(
  '/onboarding/reset',
  asyncHandler(async (req, res) => {
    await prisma.appSetting.upsert({
      where: { cle: ONBOARDING_COMPLETE_KEY },
      create: { cle: ONBOARDING_COMPLETE_KEY, valeur: 'false', groupe: 'systeme' },
      update: { valeur: 'false' },
    });
    res.json({ complete: false });
  }),
);

// GET /api/settings/placeholders — resolved placeholder map for templates.
router.get(
  '/placeholders',
  asyncHandler(async (req, res) => {
    const map = await buildPlaceholderMap();
    res.json({ placeholders: map });
  }),
);

export default router;
