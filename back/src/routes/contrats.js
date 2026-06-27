// Maintenance contract routes — Phase 3.
// Contracts are immediately active on creation (no brouillon/finalise cycle).
// Lifecycle: actif → suspendu → résilié.
// Interventions are logged per contract; monthly invoices are generated on demand or by cron.
import fs from 'node:fs';
import path from 'node:path';
import { Router } from 'express';
import { z } from 'zod';
import prisma from '../config/prisma.js';
import asyncHandler from '../utils/asyncHandler.js';
import { validate } from '../middleware/validate.js';
import ApiError from '../utils/ApiError.js';
import logger from '../utils/logger.js';
import { allocateNumber } from '../services/numbering.service.js';
import { renderHtmlToPdf } from '../services/pdf.service.js';
import { renderContratHtml } from '../templates/contratHtml.js';
import { getCustomHtmlForType, renderCustomDocument } from '../services/customTemplate.service.js';
import { enqueueUpload } from '../services/uploadQueue.service.js';
import { getEmetteurDict } from '../services/facture.service.js';
import env from '../config/env.js';

const router = Router();

const FULL_INCLUDE = {
  client: true,
  interventions: { orderBy: { date: 'desc' } },
  periodes: { include: { facture: { select: { id: true, numero: true, statut: true, totalHt: true } } }, orderBy: [{ annee: 'desc' }, { mois: 'desc' }] },
  factures: { select: { id: true, numero: true, statut: true, totalHt: true, dateEmission: true }, orderBy: { dateEmission: 'desc' } },
};

const dateSchema = z.coerce.date();

const contratSchema = z.object({
  clientId: z.coerce.number().int().positive(),
  titre: z.string().optional().nullable(),
  description: z.string().optional().nullable(),
  dateDebut: dateSchema,
  dureeMois: z.coerce.number().int().positive().optional().nullable(),
  reconduction: z.boolean().default(true),
  preavisJours: z.coerce.number().int().min(0).default(30),
  montantMensuel: z.coerce.number().min(0),
  heuresIncluses: z.coerce.number().min(0).default(0),
  reportHeures: z.boolean().default(false),
  thmDepassement: z.coerce.number().min(0).default(0),
  perimetreCouvert: z.string().optional().nullable(),
  exclusions: z.string().optional().nullable(),
});

const updateSchema = contratSchema.partial().omit({ clientId: true });

const interventionSchema = z.object({
  date: dateSchema,
  dureeH: z.coerce.number().positive(),
  description: z.string().optional().nullable(),
});

const listQuerySchema = z.object({
  statut: z.enum(['actif', 'suspendu', 'resilie']).optional(),
  clientId: z.coerce.number().int().optional(),
});

const generateFactureSchema = z.object({
  annee: z.coerce.number().int().min(2020).max(2100).optional(),
  mois: z.coerce.number().int().min(1).max(12).optional(),
});

function serializeContrat(c) {
  const now = new Date();
  const interventionsByMonth = {};
  for (const i of c.interventions || []) {
    const d = new Date(i.date);
    const key = `${d.getFullYear()}-${d.getMonth() + 1}`;
    interventionsByMonth[key] = (interventionsByMonth[key] || 0) + Number(i.dureeH);
  }

  // Current month stats
  const curYear = now.getFullYear();
  const curMonth = now.getMonth() + 1;
  const heuresMonth = interventionsByMonth[`${curYear}-${curMonth}`] || 0;

  return {
    id: c.id,
    numero: c.numero,
    statut: c.statut,
    clientId: c.clientId,
    client: c.client ? { id: c.client.id, nom: c.client.nom, denomination: c.client.denomination } : null,
    titre: c.titre,
    description: c.description,
    dateDebut: c.dateDebut,
    dureeMois: c.dureeMois,
    reconduction: c.reconduction,
    preavisJours: c.preavisJours,
    montantMensuel: Number(c.montantMensuel),
    heuresIncluses: Number(c.heuresIncluses),
    reportHeures: c.reportHeures,
    thmDepassement: Number(c.thmDepassement),
    perimetreCouvert: c.perimetreCouvert,
    exclusions: c.exclusions,
    dateResiliation: c.dateResiliation,
    hasPdf: Boolean(c.pdfPath),
    heuresMoisCourant: heuresMonth,
    depassementMoisCourant: Math.max(0, heuresMonth - Number(c.heuresIncluses)),
    interventions: (c.interventions || []).map((i) => ({
      id: i.id,
      date: i.date,
      dureeH: Number(i.dureeH),
      description: i.description,
      createdAt: i.createdAt,
    })),
    periodes: (c.periodes || []).map((p) => ({
      id: p.id,
      annee: p.annee,
      mois: p.mois,
      facture: p.facture || null,
    })),
    factures: c.factures || [],
    createdAt: c.createdAt,
    updatedAt: c.updatedAt,
  };
}

function buildContratSnapshot(contrat, em) {
  const cl = contrat.client || {};
  return {
    emetteur: {
      nom: em.nom,
      entreprise: em.entreprise,
      statut: em.statut,
      siret: em.siret,
      ape: em.ape,
      adresse1: em.adresse1,
      adresse2: em.adresse2,
      cp: em.cp,
      ville: em.ville,
      pays: em.pays,
      email: em.email,
      telephone: em.telephone,
      iban: em.iban,
      bic: em.bic,
    },
    mentions: { tva: em.mention_tva, penalites: em.penalites },
    client: {
      nom: cl.nom,
      denomination: cl.denomination,
      formeJuridique: cl.formeJuridique,
      adresse1: cl.adresse1,
      adresse2: cl.adresse2,
      codePostal: cl.codePostal,
      ville: cl.ville,
      pays: cl.pays,
      siren: cl.siren,
    },
    contrat: {
      numero: contrat.numero,
      titre: contrat.titre,
      description: contrat.description,
      dateDebut: contrat.dateDebut,
      dureeMois: contrat.dureeMois,
      reconduction: contrat.reconduction,
      preavisJours: contrat.preavisJours,
      montantMensuel: Number(contrat.montantMensuel),
      heuresIncluses: Number(contrat.heuresIncluses),
      reportHeures: contrat.reportHeures,
      thmDepassement: Number(contrat.thmDepassement),
      perimetreCouvert: contrat.perimetreCouvert,
      exclusions: contrat.exclusions,
    },
  };
}

async function generateContratPdf(contrat) {
  if (!contrat.snapshot) throw new Error('Contrat sans snapshot');
  const customHtml = await getCustomHtmlForType('contrat');
  const html = customHtml ? renderCustomDocument(customHtml, contrat.snapshot, 'contrat') : renderContratHtml(contrat.snapshot);
  const pdf = await renderHtmlToPdf(html);
  const d = new Date(contrat.dateDebut);
  const year = String(d.getFullYear());
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const dir = path.join(env.storage.root, 'contrats', year, month);
  fs.mkdirSync(dir, { recursive: true });
  const filePath = path.join(dir, `${contrat.numero}.pdf`);
  fs.writeFileSync(filePath, pdf);
  logger.info(`[contrats] PDF stored ${filePath} (${pdf.length} bytes)`);
  await prisma.contratMaintenance.update({ where: { id: contrat.id }, data: { pdfPath: filePath } });
  const drivePath = `Facturation/contrats/${year}/${month}/${contrat.numero}.pdf`;
  await enqueueUpload({ filePath, drivePath, documentType: 'contrat', documentId: contrat.id });
  return filePath;
}

// GET /api/contrats
router.get(
  '/',
  validate(listQuerySchema, 'query'),
  asyncHandler(async (req, res) => {
    const { statut, clientId } = req.query;
    const where = {};
    if (statut) where.statut = statut;
    if (clientId) where.clientId = Number(clientId);

    const all = await prisma.contratMaintenance.findMany({
      where,
      include: { client: true, interventions: true, periodes: { include: { facture: { select: { id: true, numero: true, statut: true, totalHt: true } } } } },
      orderBy: { createdAt: 'desc' },
    });

    res.json(all.map(serializeContrat));
  }),
);

// GET /api/contrats/:id
router.get(
  '/:id',
  asyncHandler(async (req, res) => {
    const contrat = await prisma.contratMaintenance.findUnique({
      where: { id: Number(req.params.id) },
      include: FULL_INCLUDE,
    });
    if (!contrat) throw ApiError.notFound('Contrat introuvable');
    res.json(serializeContrat(contrat));
  }),
);

// POST /api/contrats — creates and immediately activates the contract
router.post(
  '/',
  validate(contratSchema),
  asyncHandler(async (req, res) => {
    const data = req.body;

    // Verify client exists
    const client = await prisma.client.findUnique({ where: { id: data.clientId } });
    if (!client) throw ApiError.notFound('Client introuvable');

    const em = await getEmetteurDict();
    const annee = new Date(data.dateDebut).getFullYear();

    const created = await prisma.$transaction(async (tx) => {
      const numero = await allocateNumber(tx, 'MNT', annee);
      const snapshot = buildContratSnapshot({ ...data, numero, client }, em);
      return tx.contratMaintenance.create({
        data: {
          clientId: data.clientId,
          numero,
          statut: 'actif',
          titre: data.titre,
          description: data.description,
          dateDebut: data.dateDebut,
          dureeMois: data.dureeMois,
          reconduction: data.reconduction,
          preavisJours: data.preavisJours,
          montantMensuel: data.montantMensuel,
          heuresIncluses: data.heuresIncluses,
          reportHeures: data.reportHeures,
          thmDepassement: data.thmDepassement,
          perimetreCouvert: data.perimetreCouvert,
          exclusions: data.exclusions,
          snapshot,
        },
        include: FULL_INCLUDE,
      });
    });

    try {
      await generateContratPdf(created);
    } catch (err) {
      logger.error(`[contrats] PDF generation failed for ${created.numero}: ${err.message}`);
    }

    const fresh = await prisma.contratMaintenance.findUnique({ where: { id: created.id }, include: FULL_INCLUDE });
    res.status(201).json(serializeContrat(fresh));
  }),
);

// PUT /api/contrats/:id — update non-critical fields (does not renumber or re-lock)
router.put(
  '/:id',
  validate(updateSchema),
  asyncHandler(async (req, res) => {
    const id = Number(req.params.id);
    const contrat = await prisma.contratMaintenance.findUnique({ where: { id } });
    if (!contrat) throw ApiError.notFound('Contrat introuvable');
    if (contrat.statut === 'resilie') throw ApiError.badRequest('Contrat résilié : non modifiable');

    const updated = await prisma.contratMaintenance.update({
      where: { id },
      data: req.body,
      include: FULL_INCLUDE,
    });
    res.json(serializeContrat(updated));
  }),
);

// POST /api/contrats/:id/suspendre
router.post(
  '/:id/suspendre',
  asyncHandler(async (req, res) => {
    const id = Number(req.params.id);
    const contrat = await prisma.contratMaintenance.findUnique({ where: { id } });
    if (!contrat) throw ApiError.notFound('Contrat introuvable');
    if (contrat.statut !== 'actif') throw ApiError.badRequest('Seul un contrat actif peut être suspendu');
    const updated = await prisma.contratMaintenance.update({
      where: { id },
      data: { statut: 'suspendu' },
      include: FULL_INCLUDE,
    });
    res.json(serializeContrat(updated));
  }),
);

// POST /api/contrats/:id/reactiver
router.post(
  '/:id/reactiver',
  asyncHandler(async (req, res) => {
    const id = Number(req.params.id);
    const contrat = await prisma.contratMaintenance.findUnique({ where: { id } });
    if (!contrat) throw ApiError.notFound('Contrat introuvable');
    if (contrat.statut !== 'suspendu') throw ApiError.badRequest('Seul un contrat suspendu peut être réactivé');
    const updated = await prisma.contratMaintenance.update({
      where: { id },
      data: { statut: 'actif' },
      include: FULL_INCLUDE,
    });
    res.json(serializeContrat(updated));
  }),
);

// POST /api/contrats/:id/resilier
router.post(
  '/:id/resilier',
  asyncHandler(async (req, res) => {
    const id = Number(req.params.id);
    const contrat = await prisma.contratMaintenance.findUnique({ where: { id } });
    if (!contrat) throw ApiError.notFound('Contrat introuvable');
    if (contrat.statut === 'resilie') throw ApiError.badRequest('Contrat déjà résilié');
    const updated = await prisma.contratMaintenance.update({
      where: { id },
      data: { statut: 'resilie', dateResiliation: new Date() },
      include: FULL_INCLUDE,
    });
    res.json(serializeContrat(updated));
  }),
);

// GET /api/contrats/:id/pdf
router.get(
  '/:id/pdf',
  asyncHandler(async (req, res) => {
    const id = Number(req.params.id);
    const contrat = await prisma.contratMaintenance.findUnique({ where: { id }, include: { client: true } });
    if (!contrat) throw ApiError.notFound('Contrat introuvable');

    let pdf;
    if (contrat.pdfPath && fs.existsSync(contrat.pdfPath)) {
      pdf = fs.readFileSync(contrat.pdfPath);
    } else {
      const em = await getEmetteurDict();
      const snapshot = contrat.snapshot || buildContratSnapshot(contrat, em);
      const customHtml = await getCustomHtmlForType('contrat');
      const html = customHtml ? renderCustomDocument(customHtml, snapshot, 'contrat') : renderContratHtml(snapshot);
      pdf = await renderHtmlToPdf(html);
    }

    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `inline; filename="${contrat.numero}.pdf"`);
    res.send(pdf);
  }),
);

// POST /api/contrats/:id/interventions — log a work session
router.post(
  '/:id/interventions',
  validate(interventionSchema),
  asyncHandler(async (req, res) => {
    const contratId = Number(req.params.id);
    const contrat = await prisma.contratMaintenance.findUnique({ where: { id: contratId } });
    if (!contrat) throw ApiError.notFound('Contrat introuvable');
    if (contrat.statut === 'resilie') throw ApiError.badRequest('Impossible de logger une intervention sur un contrat résilié');

    const intervention = await prisma.intervention.create({
      data: { contratId, ...req.body },
    });
    res.status(201).json({
      id: intervention.id,
      contratId: intervention.contratId,
      date: intervention.date,
      dureeH: Number(intervention.dureeH),
      description: intervention.description,
      createdAt: intervention.createdAt,
    });
  }),
);

// DELETE /api/contrats/:id/interventions/:intId
router.delete(
  '/:id/interventions/:intId',
  asyncHandler(async (req, res) => {
    const contratId = Number(req.params.id);
    const intId = Number(req.params.intId);
    const intervention = await prisma.intervention.findUnique({ where: { id: intId } });
    if (!intervention || intervention.contratId !== contratId) throw ApiError.notFound('Intervention introuvable');
    await prisma.intervention.delete({ where: { id: intId } });
    res.status(204).end();
  }),
);

// POST /api/contrats/:id/generer-facture — generate a monthly draft invoice
// Body: { annee?, mois? } — defaults to previous calendar month
router.post(
  '/:id/generer-facture',
  validate(generateFactureSchema),
  asyncHandler(async (req, res) => {
    const contratId = Number(req.params.id);
    const contrat = await prisma.contratMaintenance.findUnique({ where: { id: contratId }, include: { client: true } });
    if (!contrat) throw ApiError.notFound('Contrat introuvable');
    if (contrat.statut === 'resilie') throw ApiError.badRequest('Contrat résilié : génération de facture impossible');

    // Determine target period (default: previous month)
    const now = new Date();
    let annee = req.body.annee;
    let mois = req.body.mois;
    if (!annee || !mois) {
      const prev = new Date(now.getFullYear(), now.getMonth() - 1, 1);
      annee = prev.getFullYear();
      mois = prev.getMonth() + 1;
    }

    // Guard: already generated for this period
    const existing = await prisma.periodeMaintenance.findUnique({
      where: { contratId_annee_mois: { contratId, annee, mois } },
      include: { facture: { select: { id: true, numero: true, statut: true } } },
    });
    if (existing) {
      throw ApiError.badRequest(
        `Une facture a déjà été générée pour ${mois}/${annee}` +
          (existing.facture ? ` (${existing.facture.numero || `#${existing.facture.id}`})` : ''),
      );
    }

    // Compute hours used in the period
    const periodStart = new Date(Date.UTC(annee, mois - 1, 1));
    const periodEnd = new Date(Date.UTC(annee, mois, 1));
    const interventions = await prisma.intervention.findMany({
      where: { contratId, date: { gte: periodStart, lt: periodEnd } },
    });
    const heuresUtilisees = interventions.reduce((sum, i) => sum + Number(i.dureeH), 0);
    const heuresIncluses = Number(contrat.heuresIncluses);
    const depassement = Math.max(0, heuresUtilisees - heuresIncluses);

    const MOIS_FR = ['Janvier','Février','Mars','Avril','Mai','Juin','Juillet','Août','Septembre','Octobre','Novembre','Décembre'];
    const moisLabel = MOIS_FR[mois - 1];

    const lignes = [];
    // Fixed monthly fee line
    lignes.push({
      designation: `Maintenance${contrat.titre ? ` — ${contrat.titre}` : ''} — ${moisLabel} ${annee}`,
      quantite: 1,
      prixUnitaire: Number(contrat.montantMensuel),
      ordre: 0,
    });
    // Overage line
    if (depassement > 0 && Number(contrat.thmDepassement) > 0) {
      lignes.push({
        designation: `Heures supplémentaires (${depassement.toFixed(2)} h au-delà des ${heuresIncluses} h incluses)`,
        quantite: depassement,
        prixUnitaire: Number(contrat.thmDepassement),
        ordre: 1,
      });
    }

    const totalHt = lignes.reduce((s, l) => s + l.quantite * l.prixUnitaire, 0);

    // Compute echeance
    const dateEmission = new Date();
    const delai = contrat.client?.conditionsPaiement || 30;
    const dateEcheance = new Date(dateEmission);
    dateEcheance.setDate(dateEcheance.getDate() + delai);

    const facture = await prisma.$transaction(async (tx) => {
      const newFacture = await tx.facture.create({
        data: {
          clientId: contrat.clientId,
          contratId,
          type: 'standard',
          statut: 'brouillon',
          dateEmission,
          dateEcheance,
          objet: `Maintenance — ${moisLabel} ${annee}`,
          totalHt,
          lignes: { create: lignes },
        },
        include: { client: true, lignes: { orderBy: { ordre: 'asc' } } },
      });
      await tx.periodeMaintenance.create({
        data: { contratId, annee, mois, factureId: newFacture.id },
      });
      return newFacture;
    });

    logger.info(`[contrats] Draft facture #${facture.id} generated for contrat ${contrat.numero} period ${mois}/${annee}`);
    res.status(201).json({
      id: facture.id,
      clientId: facture.clientId,
      contratId: facture.contratId,
      statut: facture.statut,
      totalHt: Number(facture.totalHt),
      mois,
      annee,
      heuresUtilisees,
      depassement,
      message: `Brouillon de facture créé pour ${moisLabel} ${annee}`,
    });
  }),
);

export { serializeContrat, buildContratSnapshot, generateContratPdf };
export default router;
