// Facture (invoice) & avoir (credit note) routes.
//
// Sprint 1.1 scope: draft CRUD with HT=TTC totals. Drafts are freely editable;
// finalisation (locking + numbering + PDF), encaissements and avoirs are added
// by later sprints in this same file.
import fs from 'node:fs';
import { Router } from 'express';
import { z } from 'zod';
import prisma from '../config/prisma.js';
import asyncHandler from '../utils/asyncHandler.js';
import { validate } from '../middleware/validate.js';
import ApiError from '../utils/ApiError.js';
import logger from '../utils/logger.js';
import { allocateNumber } from '../services/numbering.service.js';
import { renderHtmlToPdf } from '../services/pdf.service.js';
import { renderFactureHtml } from '../templates/factureHtml.js';
import { getCustomHtmlForType, renderCustomDocument } from '../services/customTemplate.service.js';
import {
  serializeFacture,
  paidAmount,
  deriveStatut,
  getEmetteurDict,
  buildSnapshot,
  generateFacturePdf,
} from '../services/facture.service.js';

// Recompute payee/partielle/finalisee from the encaissements after a payment
// changes. Drafts and avoirs keep their statut untouched.
async function recomputeStatut(tx, factureId) {
  const f = await tx.facture.findUnique({ where: { id: factureId }, include: { encaissements: true } });
  if (!f || f.statut === 'brouillon' || f.type === 'avoir') return f;
  return tx.facture.update({ where: { id: factureId }, data: { statut: deriveStatut(f, paidAmount(f)) } });
}

// Full include used wherever a finalisation/serialization needs all relations.
const FULL_INCLUDE = {
  client: true,
  encaissements: { orderBy: { dateEncaissement: 'asc' } },
  lignes: { orderBy: { ordre: 'asc' } },
  factureOrigine: true,
  avoirs: true,
};

const router = Router();

const ligneSchema = z.object({
  designation: z.string().default(''),
  quantite: z.coerce.number().default(1),
  prixUnitaire: z.coerce.number().default(0),
  ordre: z.coerce.number().int().default(0),
});

// A draft accepts a date as 'YYYY-MM-DD' (HTML date input) or ISO string.
const dateSchema = z.coerce.date();

const factureSchema = z.object({
  type: z.enum(['standard', 'acompte', 'solde']).default('standard'),
  clientId: z.coerce.number().int().positive().optional().nullable(),
  devisId: z.coerce.number().int().positive().optional().nullable(),
  dateEmission: dateSchema.optional(),
  dateExecutionDebut: dateSchema.optional().nullable(),
  dateExecutionFin: dateSchema.optional().nullable(),
  dateEcheance: dateSchema.optional().nullable(),
  bonCommande: z.string().optional().nullable(),
  conditionsReglement: z.string().optional().nullable(),
  objet: z.string().optional().nullable(),
  notes: z.string().optional().nullable(),
  lignes: z.array(ligneSchema).default([]),
});

const VALID_TYPES = ['standard', 'acompte', 'solde', 'avoir'];
const listQuerySchema = z.object({
  statut: z.enum(['brouillon', 'finalisee', 'payee', 'partielle']).optional(),
  type: z.string().optional().transform((val) => {
    if (!val) return undefined;
    const types = val.split(',').map((t) => t.trim()).filter(Boolean);
    if (!types.every((t) => VALID_TYPES.includes(t))) return undefined;
    return types;
  }),
  clientId: z.coerce.number().int().optional(),
  annee: z.coerce.number().int().optional(),
  search: z.string().optional(),
});

// Sum of line amounts (quantite * prixUnitaire). HT = TTC, no VAT.
function computeTotal(lignes) {
  return lignes.reduce((sum, l) => sum + Number(l.quantite || 0) * Number(l.prixUnitaire || 0), 0);
}

// Default echeance = emission + client payment delay (or 30 days) when not given.
async function resolveEcheance({ dateEcheance, dateEmission, clientId }) {
  if (dateEcheance) return dateEcheance;
  let delai = 30;
  if (clientId) {
    const client = await prisma.client.findUnique({ where: { id: clientId } });
    if (client?.conditionsPaiement) delai = client.conditionsPaiement;
  }
  const echeance = new Date(dateEmission);
  echeance.setDate(echeance.getDate() + delai);
  return echeance;
}

// GET /api/factures — list with filters. Includes client + paid amount.
router.get(
  '/',
  validate(listQuerySchema, 'query'),
  asyncHandler(async (req, res) => {
    const { statut, type, clientId, annee, search } = req.query;
    const where = {};
    if (statut) where.statut = statut;
    if (type) where.type = Array.isArray(type) && type.length > 1 ? { in: type } : (Array.isArray(type) ? type[0] : type);
    if (clientId) where.clientId = clientId;
    if (search) where.numero = { contains: search, mode: 'insensitive' };
    if (annee) {
      where.dateEmission = {
        gte: new Date(Date.UTC(annee, 0, 1)),
        lt: new Date(Date.UTC(annee + 1, 0, 1)),
      };
    }
    const factures = await prisma.facture.findMany({
      where,
      include: { client: true, encaissements: true, lignes: { orderBy: { ordre: 'asc' } } },
      orderBy: [{ dateEmission: 'desc' }, { id: 'desc' }],
    });
    res.json(factures.map(serializeFacture));
  }),
);

router.get(
  '/:id',
  asyncHandler(async (req, res) => {
    const facture = await prisma.facture.findUnique({
      where: { id: Number(req.params.id) },
      include: {
        client: true,
        encaissements: { orderBy: { dateEncaissement: 'asc' } },
        lignes: { orderBy: { ordre: 'asc' } },
        factureOrigine: true,
        avoirs: true,
      },
    });
    if (!facture) throw ApiError.notFound('Facture introuvable');
    res.json(serializeFacture(facture));
  }),
);

// POST /api/factures — create a draft.
router.post(
  '/',
  validate(factureSchema),
  asyncHandler(async (req, res) => {
    const { lignes, ...data } = req.body;
    data.dateEmission = data.dateEmission || new Date();
    data.dateEcheance = await resolveEcheance(data);
    const totalHt = computeTotal(lignes);
    const created = await prisma.facture.create({
      data: {
        ...data,
        statut: 'brouillon',
        totalHt,
        lignes: { create: lignes.map((l, i) => ({ ...l, ordre: i })) },
      },
      include: { client: true, encaissements: true, lignes: { orderBy: { ordre: 'asc' } } },
    });
    res.status(201).json(serializeFacture(created));
  }),
);

// PUT /api/factures/:id — update a draft (locked once finalised).
router.put(
  '/:id',
  validate(factureSchema),
  asyncHandler(async (req, res) => {
    const id = Number(req.params.id);
    const existing = await prisma.facture.findUnique({ where: { id } });
    if (!existing) throw ApiError.notFound('Facture introuvable');
    if (existing.verrouillee) throw ApiError.badRequest('Facture finalisée : non modifiable (émettre un avoir)');

    const { lignes, ...data } = req.body;
    data.dateEmission = data.dateEmission || existing.dateEmission;
    data.dateEcheance = await resolveEcheance(data);
    const totalHt = computeTotal(lignes);

    const updated = await prisma.$transaction(async (tx) => {
      await tx.ligneFacture.deleteMany({ where: { factureId: id } });
      return tx.facture.update({
        where: { id },
        data: {
          ...data,
          totalHt,
          lignes: { create: lignes.map((l, i) => ({ ...l, ordre: i })) },
        },
        include: { client: true, encaissements: true, lignes: { orderBy: { ordre: 'asc' } } },
      });
    });
    res.json(serializeFacture(updated));
  }),
);

// DELETE /api/factures/:id — only drafts can be deleted (finalised = immutable).
router.delete(
  '/:id',
  asyncHandler(async (req, res) => {
    const id = Number(req.params.id);
    const existing = await prisma.facture.findUnique({ where: { id } });
    if (!existing) throw ApiError.notFound('Facture introuvable');
    if (existing.verrouillee) throw ApiError.badRequest('Facture finalisée : suppression interdite');
    await prisma.facture.delete({ where: { id } });
    res.status(204).end();
  }),
);

// POST /api/factures/:id/finaliser — lock + sequential number + frozen snapshot
// + conforming PDF. The number is allocated inside the SAME transaction as the
// lock so the FAC series can never have a gap. PDF rendering happens after the
// commit (it is slow and must not hold DB locks).
router.post(
  '/:id/finaliser',
  asyncHandler(async (req, res) => {
    const id = Number(req.params.id);
    const facture = await prisma.facture.findUnique({ where: { id }, include: FULL_INCLUDE });
    if (!facture) throw ApiError.notFound('Facture introuvable');
    if (facture.verrouillee) throw ApiError.badRequest('Facture déjà finalisée');
    if (facture.statut !== 'brouillon') throw ApiError.badRequest('Seul un brouillon peut être finalisé');
    if (!facture.clientId) throw ApiError.badRequest('Un client est requis pour finaliser la facture');
    if (facture.lignes.length === 0) throw ApiError.badRequest('Au moins une ligne est requise');
    if (Number(facture.totalHt) <= 0) throw ApiError.badRequest('Le total doit être strictement positif');

    const em = await getEmetteurDict();
    const serie = facture.type === 'avoir' ? 'AVO' : 'FAC';
    const annee = new Date(facture.dateEmission).getFullYear();

    const finalised = await prisma.$transaction(async (tx) => {
      const numero = await allocateNumber(tx, serie, annee);
      const snapshot = buildSnapshot({ ...facture, numero }, em);
      return tx.facture.update({
        where: { id },
        data: { numero, statut: 'finalisee', verrouillee: true, finaliseeAt: new Date(), snapshot },
        include: FULL_INCLUDE,
      });
    });

    // Render + store the PDF. A failure here is logged but not fatal: the
    // invoice is already legally numbered and the PDF is regenerable.
    try {
      await generateFacturePdf(finalised);
    } catch (err) {
      logger.error(`[facture] PDF generation failed for ${finalised.numero}: ${err.message}`);
    }

    const fresh = await prisma.facture.findUnique({ where: { id }, include: FULL_INCLUDE });
    res.json(serializeFacture(fresh));
  }),
);

// GET /api/factures/:id/pdf — serve the stored immutable PDF. Regenerate from
// the frozen snapshot if the file is missing; for a draft, render a live preview.
router.get(
  '/:id/pdf',
  asyncHandler(async (req, res) => {
    const id = Number(req.params.id);
    const facture = await prisma.facture.findUnique({ where: { id }, include: FULL_INCLUDE });
    if (!facture) throw ApiError.notFound('Facture introuvable');

    let pdf;
    if (facture.pdfPath && fs.existsSync(facture.pdfPath)) {
      pdf = fs.readFileSync(facture.pdfPath);
    } else {
      const snapshot = facture.snapshot || buildSnapshot(facture, await getEmetteurDict());
      const customHtml = await getCustomHtmlForType('facture');
      const html = customHtml ? renderCustomDocument(customHtml, snapshot, 'facture') : renderFactureHtml(snapshot);
      pdf = await renderHtmlToPdf(html);
    }

    const name = `${facture.numero || `brouillon-${id}`}.pdf`;
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `inline; filename="${name}"`);
    res.send(pdf);
  }),
);

// POST /api/factures/:id/avoir — issue a credit note for a finalised invoice.
// The avoir mirrors the origin's lines, is linked via factureOrigineId, and is
// created already finalised (AVO number + snapshot + PDF) — the legal way to
// correct an immutable invoice.
router.post(
  '/:id/avoir',
  asyncHandler(async (req, res) => {
    const id = Number(req.params.id);
    const origin = await prisma.facture.findUnique({
      where: { id },
      include: { lignes: { orderBy: { ordre: 'asc' } }, client: true },
    });
    if (!origin) throw ApiError.notFound('Facture introuvable');
    if (!origin.verrouillee) throw ApiError.badRequest('Seule une facture finalisée peut faire l’objet d’un avoir');
    if (origin.type === 'avoir') throw ApiError.badRequest('Un avoir ne peut pas être corrigé par un avoir');

    const em = await getEmetteurDict();
    const annee = new Date().getFullYear();

    const avoir = await prisma.$transaction(async (tx) => {
      const numero = await allocateNumber(tx, 'AVO', annee);
      const created = await tx.facture.create({
        data: {
          numero,
          type: 'avoir',
          statut: 'finalisee',
          verrouillee: true,
          finaliseeAt: new Date(),
          clientId: origin.clientId,
          factureOrigineId: origin.id,
          dateEmission: new Date(),
          objet: `Avoir sur facture ${origin.numero}`,
          totalHt: origin.totalHt,
          lignes: {
            create: origin.lignes.map((l, i) => ({
              designation: l.designation,
              quantite: l.quantite,
              prixUnitaire: l.prixUnitaire,
              ordre: i,
            })),
          },
        },
        include: { lignes: { orderBy: { ordre: 'asc' } }, client: true, factureOrigine: true },
      });
      const snapshot = buildSnapshot(created, em);
      return tx.facture.update({ where: { id: created.id }, data: { snapshot }, include: FULL_INCLUDE });
    });

    try {
      await generateFacturePdf(avoir);
    } catch (err) {
      logger.error(`[facture] avoir PDF generation failed for ${avoir.numero}: ${err.message}`);
    }

    const fresh = await prisma.facture.findUnique({ where: { id: avoir.id }, include: FULL_INCLUDE });
    res.status(201).json(serializeFacture(fresh));
  }),
);

const encaissementSchema = z.object({
  dateEncaissement: dateSchema,
  montant: z.coerce.number().positive(),
  moyen: z.enum(['virement', 'malt', 'especes', 'cheque', 'autre']).default('virement'),
  reference: z.string().optional().nullable(),
});

// POST /api/factures/:id/encaissements — record a payment, then refresh statut.
router.post(
  '/:id/encaissements',
  validate(encaissementSchema),
  asyncHandler(async (req, res) => {
    const id = Number(req.params.id);
    const facture = await prisma.facture.findUnique({ where: { id } });
    if (!facture) throw ApiError.notFound('Facture introuvable');
    if (facture.statut === 'brouillon') throw ApiError.badRequest('Finalisez la facture avant de saisir un encaissement');
    if (facture.type === 'avoir') throw ApiError.badRequest('Un avoir ne reçoit pas d’encaissement');

    await prisma.$transaction(async (tx) => {
      await tx.encaissement.create({ data: { factureId: id, ...req.body } });
      await recomputeStatut(tx, id);
    });
    const fresh = await prisma.facture.findUnique({ where: { id }, include: FULL_INCLUDE });
    res.status(201).json(serializeFacture(fresh));
  }),
);

// DELETE /api/factures/:id/encaissements/:eid — undo a payment (correction).
router.delete(
  '/:id/encaissements/:eid',
  asyncHandler(async (req, res) => {
    const id = Number(req.params.id);
    const eid = Number(req.params.eid);
    const enc = await prisma.encaissement.findUnique({ where: { id: eid } });
    if (!enc || enc.factureId !== id) throw ApiError.notFound('Encaissement introuvable');
    await prisma.$transaction(async (tx) => {
      await tx.encaissement.delete({ where: { id: eid } });
      await recomputeStatut(tx, id);
    });
    const fresh = await prisma.facture.findUnique({ where: { id }, include: FULL_INCLUDE });
    res.json(serializeFacture(fresh));
  }),
);

// POST /api/factures/from-devis/:devisId — create a pre-filled draft from an accepted devis.
// The caller can pass { type, acomptePct } in the body; lines are copied from the devis.
router.post(
  '/from-devis/:devisId',
  asyncHandler(async (req, res) => {
    const devisId = Number(req.params.devisId);
    const devis = await prisma.devis.findUnique({
      where: { id: devisId },
      include: { lignes: { orderBy: { ordre: 'asc' } }, client: true },
    });
    if (!devis) throw ApiError.notFound('Devis introuvable');
    if (devis.statut !== 'accepte') throw ApiError.badRequest('Le devis doit être accepté pour créer une facture');

    const type = req.body.type || 'standard';
    const acomptePct = req.body.acomptePct ? Number(req.body.acomptePct) : null;

    let lignes = devis.lignes.map((l) => ({
      designation: l.designation,
      quantite: Number(l.quantite),
      prixUnitaire: Number(l.prixUnitaire),
    }));

    // For acompte: create a single line with the percentage amount
    if (type === 'acompte' && acomptePct) {
      const acompteTotal = (Number(devis.totalHt) * acomptePct) / 100;
      lignes = [{ designation: `Acompte ${acomptePct} % — ${devis.titre || devis.numero}`, quantite: 1, prixUnitaire: acompteTotal }];
    }

    const totalHt = computeTotal(lignes);
    const dateEmission = new Date();
    const dateEcheance = await resolveEcheance({ dateEmission, clientId: devis.clientId });

    const created = await prisma.facture.create({
      data: {
        type,
        clientId: devis.clientId,
        devisId,
        objet: devis.titre || null,
        dateEmission,
        dateEcheance,
        statut: 'brouillon',
        totalHt,
        lignes: { create: lignes.map((l, i) => ({ ...l, ordre: i })) },
      },
      include: { client: true, encaissements: true, lignes: { orderBy: { ordre: 'asc' } } },
    });
    res.status(201).json(serializeFacture(created));
  }),
);

// POST /api/factures/:id/dupliquer — create a new draft from an existing facture/avoir
router.post(
  '/:id/dupliquer',
  asyncHandler(async (req, res) => {
    const id = Number(req.params.id);
    const source = await prisma.facture.findUnique({
      where: { id },
      include: { lignes: { orderBy: { ordre: 'asc' } } },
    });
    if (!source) throw ApiError.notFound('Facture introuvable');

    const dateEmission = new Date();
    const dateEcheance = await resolveEcheance({ dateEmission, clientId: source.clientId });

    const created = await prisma.facture.create({
      data: {
        type: source.type === 'avoir' ? 'standard' : source.type,
        clientId: source.clientId,
        devisId: source.devisId,
        objet: source.objet,
        bonCommande: source.bonCommande,
        conditionsReglement: source.conditionsReglement,
        notes: source.notes,
        dateEmission,
        dateEcheance,
        statut: 'brouillon',
        totalHt: source.totalHt,
        lignes: {
          create: source.lignes.map((l, i) => ({
            designation: l.designation,
            quantite: l.quantite,
            prixUnitaire: l.prixUnitaire,
            ordre: i,
          })),
        },
      },
      include: FULL_INCLUDE,
    });
    res.status(201).json(serializeFacture(created));
  }),
);

export { router, computeTotal, paidAmount };
export default router;
