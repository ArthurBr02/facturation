// Dashboard / pilotage routes.
// Sprint 1.4: minimal seuils (CA encaissé + franchise TVA).
// Sprint 3.5.1: full "actions urgentes" section + advanced indicators.
// Phase 4 — Sprint 4.1: seuils complet (plafond micro proratisé, projections, revenus Malt).
import { Router } from 'express';
import { z } from 'zod';
import prisma from '../config/prisma.js';
import asyncHandler from '../utils/asyncHandler.js';
import { validate } from '../middleware/validate.js';

const router = Router();

// Franchise en base de TVA thresholds (prestations de services / BNC).
const FRANCHISE_TVA_BASE = 37500;
const FRANCHISE_TVA_MAJORE = 41250;
// Micro-entreprise annual revenue ceiling (BNC / prestations de services).
const PLAFOND_MICRO = 83600;

// Alert level from a ratio against the base threshold (PLAN alerts 70/90/100%).
function niveau(pct) {
  if (pct >= 1) return 'depasse';
  if (pct >= 0.9) return 'danger';
  if (pct >= 0.7) return 'alerte';
  return 'ok';
}

const querySchema = z.object({ annee: z.coerce.number().int().optional() });

async function getDebutActivite() {
  const s = await prisma.appSetting.findUnique({ where: { cle: 'systeme.date_debut_activite' } });
  return s?.valeur ? new Date(s.valeur) : new Date('2026-06-26');
}

// GET /api/dashboard/seuils — CA encaissé (enc + Malt) + jauges TVA + micro + projections.
router.get(
  '/seuils',
  validate(querySchema, 'query'),
  asyncHandler(async (req, res) => {
    const annee = Number(req.query.annee || new Date().getFullYear());
    const range = { gte: new Date(Date.UTC(annee, 0, 1)), lt: new Date(Date.UTC(annee + 1, 0, 1)) };

    const [encAgg, maltAgg, debutActivite, facts] = await Promise.all([
      prisma.encaissement.aggregate({ _sum: { montant: true }, where: { dateEncaissement: range } }),
      prisma.revenuMalt.aggregate({ _sum: { montantNet: true }, where: { dateEncaissement: range } }),
      getDebutActivite(),
      prisma.facture.findMany({
        where: { statut: { not: 'brouillon' }, type: { not: 'avoir' }, dateEmission: range },
        select: { totalHt: true },
      }),
    ]);

    const caEncaissements = Number(encAgg._sum.montant || 0);
    const caRevenusMalt = Number(maltAgg._sum.montantNet || 0);
    const caEncaisse = caEncaissements + caRevenusMalt;
    const caEmis = facts.reduce((s, f) => s + Number(f.totalHt), 0);

    // ── Plafond micro proratisé ───────────────────────────────────────────────
    let plafondMicroAnnuel = PLAFOND_MICRO;
    let proratise = false;
    if (debutActivite.getFullYear() === annee) {
      const debut = new Date(Date.UTC(debutActivite.getFullYear(), debutActivite.getMonth(), debutActivite.getDate()));
      const finAnnee = new Date(Date.UTC(annee + 1, 0, 1));
      const debutAnnee = new Date(Date.UTC(annee, 0, 1));
      const daysInYear = Math.floor((finAnnee - debutAnnee) / 86400000);
      const daysActivity = Math.floor((finAnnee - debut) / 86400000);
      plafondMicroAnnuel = Math.round(PLAFOND_MICRO * (daysActivity / daysInYear));
      proratise = true;
    }

    // ── Projections (linear extrapolation from Jan 1) ────────────────────────
    const today = new Date();
    const debutAnnee = new Date(Date.UTC(annee, 0, 1));
    const finAnnee = new Date(Date.UTC(annee + 1, 0, 1));
    const daysInYear = Math.floor((finAnnee - debutAnnee) / 86400000);
    const daysElapsed = Math.max(1, Math.min(Math.floor((today - debutAnnee) / 86400000), daysInYear));
    const caProjecte = annee <= today.getFullYear()
      ? Math.round(caEncaisse * daysInYear / daysElapsed)
      : null;

    const tvaPct = caEncaisse / FRANCHISE_TVA_BASE;
    const microPct = caEncaisse / plafondMicroAnnuel;

    res.json({
      annee,
      caEncaissements,
      caRevenusMalt,
      caEncaisse,
      caEmis,
      franchiseTva: {
        seuilBase: FRANCHISE_TVA_BASE,
        seuilMajore: FRANCHISE_TVA_MAJORE,
        pct: tvaPct,
        restant: Math.max(FRANCHISE_TVA_BASE - caEncaisse, 0),
        niveau: niveau(tvaPct),
      },
      plafondMicro: {
        plafond: PLAFOND_MICRO,
        plafondProratise: plafondMicroAnnuel,
        proratise,
        debutActivite: debutActivite.toISOString().slice(0, 10),
        pct: microPct,
        restant: Math.max(plafondMicroAnnuel - caEncaisse, 0),
        niveau: niveau(microPct),
      },
      projection: caProjecte !== null ? { caProjecte, daysElapsed, daysInYear } : null,
    });
  }),
);

// GET /api/dashboard/ca-mensuel?annee=YYYY — monthly CA breakdown.
router.get(
  '/ca-mensuel',
  validate(querySchema, 'query'),
  asyncHandler(async (req, res) => {
    const annee = Number(req.query.annee || new Date().getFullYear());

    const MOIS_LABELS = ['Jan.', 'Fév.', 'Mar.', 'Avr.', 'Mai', 'Juin', 'Juil.', 'Août', 'Sep.', 'Oct.', 'Nov.', 'Déc.'];

    const mois = await Promise.all(
      Array.from({ length: 12 }, (_, m) => {
        const range = {
          gte: new Date(Date.UTC(annee, m, 1)),
          lt: new Date(Date.UTC(annee, m + 1, 1)),
        };
        return Promise.all([
          prisma.encaissement.aggregate({ _sum: { montant: true }, where: { dateEncaissement: range } }),
          prisma.revenuMalt.aggregate({ _sum: { montantNet: true }, where: { dateEncaissement: range } }),
        ]).then(([encAgg, maltAgg]) => {
          const encaissements = Number(encAgg._sum.montant || 0);
          const revenus = Number(maltAgg._sum.montantNet || 0);
          return { mois: m + 1, label: MOIS_LABELS[m], encaissements, revenus, total: encaissements + revenus };
        });
      }),
    );

    const totalAnnee = mois.reduce((s, m) => s + m.total, 0);
    res.json({ annee, mois, totalAnnee });
  }),
);

// GET /api/dashboard/actions — "todo list" of urgent items.
// Returns counts and lists for: unpaid invoices, overdue, unanswered quotes,
// expiring quotes, unfinalized drafts, maintenance to bill, next URSSAF, TVA threshold.
router.get(
  '/actions',
  asyncHandler(async (req, res) => {
    const now = new Date();
    const today = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
    const annee = today.getUTCFullYear();
    const in7days = new Date(today.getTime() + 7 * 24 * 60 * 60 * 1000);

    // ── 1. Factures impayées (finalisee or partielle, non-avoir) ──────────────
    const facturesImpayees = await prisma.facture.findMany({
      where: {
        statut: { in: ['finalisee', 'partielle'] },
        type: { not: 'avoir' },
        verrouillee: true,
      },
      include: {
        client: { select: { id: true, nom: true } },
        encaissements: { select: { montant: true } },
      },
      orderBy: { finaliseeAt: 'asc' },
    });

    const impayees = facturesImpayees.map((f) => {
      const encaisse = f.encaissements.reduce((s, e) => s + Number(e.montant), 0);
      const resteAPayer = Math.max(0, Number(f.totalHt) - encaisse);
      const joursDepuis = f.finaliseeAt
        ? Math.floor((today - new Date(f.finaliseeAt)) / 86400000)
        : null;
      const enRetard = f.dateEcheance && new Date(f.dateEcheance) < today;
      return {
        id: f.id,
        numero: f.numero,
        clientId: f.clientId,
        clientNom: f.client?.nom,
        totalHt: Number(f.totalHt),
        resteAPayer,
        dateEcheance: f.dateEcheance,
        finaliseeAt: f.finaliseeAt,
        joursDepuis,
        enRetard,
        statut: f.statut,
      };
    });

    const facturesEnRetard = impayees.filter((f) => f.enRetard);
    const facturesImpayeesNonRetard = impayees.filter((f) => !f.enRetard);

    // ── 2. Devis sans réponse (envoye, non expiré) ────────────────────────────
    const devisEnvoyesSansReponse = await prisma.devis.findMany({
      where: { statut: 'envoye' },
      include: { client: { select: { id: true, nom: true } } },
      orderBy: { dateEnvoi: 'asc' },
    });

    const devisSansReponse = devisEnvoyesSansReponse.map((d) => {
      const dateExpiration = d.dateEnvoi
        ? new Date(new Date(d.dateEnvoi).getTime() + d.validiteJours * 86400000)
        : null;
      const expire = dateExpiration && dateExpiration < today;
      const joursSansReponse = d.dateEnvoi
        ? Math.floor((today - new Date(d.dateEnvoi)) / 86400000)
        : null;
      const bientotExpire = dateExpiration && !expire && dateExpiration <= in7days;
      return {
        id: d.id,
        numero: d.numero,
        titre: d.titre,
        clientId: d.clientId,
        clientNom: d.client?.nom,
        dateEnvoi: d.dateEnvoi,
        dateExpiration,
        joursSansReponse,
        expire,
        bientotExpire,
        totalHt: Number(d.totalHt),
      };
    });

    const devisBientotExpires = devisSansReponse.filter((d) => d.bientotExpire);
    const devisEnAttenteReponse = devisSansReponse.filter((d) => !d.expire && !d.bientotExpire);

    // ── 3. Brouillons non finalisés (factures + devis brouillon) ─────────────
    const brouillonsFactures = await prisma.facture.findMany({
      where: { statut: 'brouillon', type: { not: 'avoir' } },
      include: { client: { select: { id: true, nom: true } } },
      orderBy: { updatedAt: 'desc' },
    });
    const brouillonsDevis = await prisma.devis.findMany({
      where: { statut: 'brouillon' },
      include: { client: { select: { id: true, nom: true } } },
      orderBy: { updatedAt: 'desc' },
    });

    const brouillons = [
      ...brouillonsFactures.map((f) => ({
        id: f.id,
        type: 'facture',
        clientId: f.clientId,
        clientNom: f.client?.nom,
        totalHt: Number(f.totalHt),
        updatedAt: f.updatedAt,
        route: 'facture-edit',
      })),
      ...brouillonsDevis.map((d) => ({
        id: d.id,
        type: 'devis',
        titre: d.titre,
        clientId: d.clientId,
        clientNom: d.client?.nom,
        totalHt: Number(d.totalHt),
        updatedAt: d.updatedAt,
        route: 'devis-edit',
      })),
    ].sort((a, b) => new Date(b.updatedAt) - new Date(a.updatedAt));

    // ── 4. Maintenance à facturer ce mois ────────────────────────────────────
    const moisCourant = today.getUTCMonth() + 1;
    const anneeCourante = today.getUTCFullYear();

    const contratsActifs = await prisma.contratMaintenance.findMany({
      where: { statut: 'actif' },
      include: {
        client: { select: { id: true, nom: true } },
        periodes: {
          where: { annee: anneeCourante, mois: moisCourant },
        },
      },
    });

    const maintenanceAFacturer = contratsActifs
      .filter((c) => c.periodes.length === 0) // no invoice generated for this month yet
      .map((c) => ({
        id: c.id,
        numero: c.numero,
        clientId: c.clientId,
        clientNom: c.client?.nom,
        montantMensuel: Number(c.montantMensuel),
      }));

    // ── 5. Prochaine échéance URSSAF ──────────────────────────────────────────
    // BNC quarterly: 30/04, 31/07, 31/10, 31/01. First one (start 2026-06-26) → 31/10/2026.
    const echeancesUrssaf = [
      new Date(Date.UTC(annee, 3, 30)),  // 30 avril
      new Date(Date.UTC(annee, 6, 31)),  // 31 juillet
      new Date(Date.UTC(annee, 9, 31)),  // 31 octobre
      new Date(Date.UTC(annee + 1, 0, 31)), // 31 janvier suivant
    ];
    const prochaineEcheanceUrssaf = echeancesUrssaf.find((d) => d >= today) || echeancesUrssaf[echeancesUrssaf.length - 1];
    const joursAvantUrssaf = Math.floor((prochaineEcheanceUrssaf - today) / 86400000);

    // ── 6. Seuil TVA proche ───────────────────────────────────────────────────
    const range = { gte: new Date(Date.UTC(annee, 0, 1)), lt: new Date(Date.UTC(annee + 1, 0, 1)) };
    const encAgg = await prisma.encaissement.aggregate({
      _sum: { montant: true },
      where: { dateEncaissement: range },
    });
    const caEncaisse = Number(encAgg._sum.montant || 0);
    const tvaPct = caEncaisse / FRANCHISE_TVA_BASE;
    const tvaNiveau = niveau(tvaPct);

    res.json({
      facturesEnRetard,
      facturesImpayees: facturesImpayeesNonRetard,
      devisBientotExpires,
      devisEnAttenteReponse,
      brouillons,
      maintenanceAFacturer,
      urssaf: {
        prochaineEcheance: prochaineEcheanceUrssaf,
        joursAvant: joursAvantUrssaf,
      },
      tva: {
        caEncaisse,
        pct: tvaPct,
        niveau: tvaNiveau,
        seuilBase: FRANCHISE_TVA_BASE,
      },
    });
  }),
);

export default router;
