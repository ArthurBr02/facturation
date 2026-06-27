// URSSAF assistant routes — aggregates encaissements + revenus Malt by quarter.
// BNC micro-entreprise rates and quarterly due dates for the French tax authority.
// Phase 4 — Sprint 4.2.
import { Router } from 'express';
import { z } from 'zod';
import prisma from '../config/prisma.js';
import asyncHandler from '../utils/asyncHandler.js';
import { validate } from '../middleware/validate.js';

const router = Router();

// BNC micro-entreprise social contribution rate (2024).
const TAUX_URSSAF = 0.256;
// Versement libératoire additionnal rate.
const TAUX_VL = 0.022;

// Quarterly due dates for BNC declarations.
function echeanceTrimestrielle(annee, trimestre) {
  switch (trimestre) {
    case 1: return new Date(Date.UTC(annee, 3, 30));     // 30 avril
    case 2: return new Date(Date.UTC(annee, 6, 31));     // 31 juillet
    case 3: return new Date(Date.UTC(annee, 9, 31));     // 31 octobre
    case 4: return new Date(Date.UTC(annee + 1, 0, 31)); // 31 janvier N+1
    default: return null;
  }
}

function quarterRange(annee, trimestre) {
  const moisDebut = (trimestre - 1) * 3;
  return {
    gte: new Date(Date.UTC(annee, moisDebut, 1)),
    lt: new Date(Date.UTC(annee, moisDebut + 3, 1)),
  };
}

const QUARTER_LABELS = ['T1 — Janv. / Mars', 'T2 — Avr. / Juin', 'T3 — Juil. / Sept.', 'T4 — Oct. / Déc.'];

async function computeQuarter(annee, t) {
  const range = quarterRange(annee, t);

  const [encAgg, maltAgg] = await Promise.all([
    prisma.encaissement.aggregate({
      _sum: { montant: true },
      where: { dateEncaissement: range },
    }),
    prisma.revenuMalt.aggregate({
      _sum: { montantNet: true },
      where: { dateEncaissement: range },
    }),
  ]);

  const caEncaissements = Number(encAgg._sum.montant || 0);
  const caRevenusMalt = Number(maltAgg._sum.montantNet || 0);
  const caTotal = caEncaissements + caRevenusMalt;

  return {
    trimestre: t,
    label: QUARTER_LABELS[t - 1],
    debut: new Date(Date.UTC(annee, (t - 1) * 3, 1)),
    fin: new Date(Date.UTC(annee, t * 3, 0)),
    echeance: echeanceTrimestrielle(annee, t),
    caEncaissements,
    caRevenusMalt,
    caTotal,
    estimationCotisations: Math.round(caTotal * TAUX_URSSAF * 100) / 100,
    estimationAvecVL: Math.round(caTotal * (TAUX_URSSAF + TAUX_VL) * 100) / 100,
  };
}

const syntheseQuery = z.object({ annee: z.coerce.number().int().optional() });

// GET /api/urssaf/synthese?annee=YYYY — all quarters for a year.
router.get('/synthese', validate(syntheseQuery, 'query'), asyncHandler(async (req, res) => {
  const annee = req.query.annee || new Date().getFullYear();

  const trimestres = await Promise.all([1, 2, 3, 4].map((t) => computeQuarter(annee, t)));

  const totalAnnee = trimestres.reduce(
    (acc, t) => ({
      caEncaissements: acc.caEncaissements + t.caEncaissements,
      caRevenusMalt: acc.caRevenusMalt + t.caRevenusMalt,
      caTotal: acc.caTotal + t.caTotal,
      estimationCotisations: acc.estimationCotisations + t.estimationCotisations,
    }),
    { caEncaissements: 0, caRevenusMalt: 0, caTotal: 0, estimationCotisations: 0 },
  );

  // Next due date from today.
  const today = new Date();
  const prochaineEcheance = trimestres
    .map((t) => t.echeance)
    .find((d) => d >= today) || trimestres[3].echeance;

  res.json({
    annee,
    taux: TAUX_URSSAF,
    tauxVL: TAUX_VL,
    trimestres,
    totalAnnee,
    prochaineEcheance,
    joursAvantEcheance: Math.floor((prochaineEcheance - today) / 86400000),
  });
}));

const trimestreParams = z.object({
  annee: z.coerce.number().int(),
  trimestre: z.coerce.number().int().min(1).max(4),
});

// GET /api/urssaf/trimestre/:annee/:trimestre — single quarter details.
router.get('/trimestre/:annee/:trimestre', validate(trimestreParams, 'params'), asyncHandler(async (req, res) => {
  const { annee, trimestre } = req.params;
  const data = await computeQuarter(Number(annee), Number(trimestre));
  res.json(data);
}));

export default router;
