// Devis (quote) routes — Phase 2 Sprint 2.1.
// Full lifecycle: brouillon → finalise → envoye → accepte/refuse/expire/annule.
// A finalised devis is locked (verrouillee) and can spawn factures and avenants.
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
import { renderDevisHtml } from '../templates/devisHtml.js';
import { getCustomHtmlForType, renderCustomDocument } from '../services/customTemplate.service.js';
import { enqueueUpload } from '../services/uploadQueue.service.js';
import { storeSignedPdf } from '../services/signedPdf.service.js';
import { getEmetteurDict } from '../services/facture.service.js';
import env from '../config/env.js';
import path from 'node:path';

const router = Router();

const FULL_INCLUDE = {
  client: true,
  lignes: { orderBy: { ordre: 'asc' } },
  avenants: { orderBy: { createdAt: 'desc' } },
  factures: { select: { id: true, numero: true, type: true, statut: true, totalHt: true } },
};

const ligneSchema = z.object({
  designation: z.string().default(''),
  quantite: z.coerce.number().default(1),
  prixUnitaire: z.coerce.number().default(0),
  ordre: z.coerce.number().int().default(0),
});

const dateSchema = z.coerce.date();

const devisSchema = z.object({
  clientId: z.coerce.number().int().positive().optional().nullable(),
  titre: z.string().optional().nullable(),
  description: z.string().optional().nullable(),
  dateEmission: dateSchema.optional(),
  validiteJours: z.coerce.number().int().min(1).default(30),
  acomptePct: z.coerce.number().min(0).max(100).optional().nullable(),
  cyclesInclus: z.coerce.number().int().min(0).default(3),
  clauseRevision: z.string().optional().nullable(),
  clauseHebergement: z.string().optional().nullable(),
  lignes: z.array(ligneSchema).default([]),
});

const listQuerySchema = z.object({
  statut: z.enum(['brouillon', 'finalise', 'envoye', 'accepte', 'refuse', 'expire', 'annule']).optional(),
  clientId: z.coerce.number().int().optional(),
  annee: z.coerce.number().int().optional(),
  search: z.string().optional(),
});

function computeTotal(lignes) {
  return lignes.reduce((sum, l) => sum + Number(l.quantite || 0) * Number(l.prixUnitaire || 0), 0);
}

function serializeDevis(d) {
  const lignes = (d.lignes || []).map((l) => ({
    id: l.id,
    designation: l.designation,
    quantite: Number(l.quantite),
    prixUnitaire: Number(l.prixUnitaire),
    montant: Number(l.quantite) * Number(l.prixUnitaire),
    ordre: l.ordre,
  }));
  const dateEmission = d.dateEmission;
  const dateValidite = dateEmission
    ? new Date(new Date(dateEmission).getTime() + (d.validiteJours || 30) * 86400000)
    : null;
  const isExpired =
    d.statut === 'envoye' && dateValidite && dateValidite < new Date();

  return {
    id: d.id,
    numero: d.numero,
    statut: isExpired ? 'expire' : d.statut,
    clientId: d.clientId,
    client: d.client ? { id: d.client.id, nom: d.client.nom, denomination: d.client.denomination } : null,
    titre: d.titre,
    description: d.description,
    dateEmission: d.dateEmission,
    dateValidite,
    validiteJours: d.validiteJours,
    totalHt: Number(d.totalHt),
    acomptePct: d.acomptePct != null ? Number(d.acomptePct) : null,
    cyclesInclus: d.cyclesInclus,
    cyclesUtilises: d.cyclesUtilises,
    clauseRevision: d.clauseRevision,
    clauseHebergement: d.clauseHebergement,
    verrouillee: d.verrouillee,
    dateEnvoi: d.dateEnvoi,
    hasPdf: Boolean(d.pdfPath),
    hasSignedPdf: Boolean(d.signedPdfPath),
    finaliseeAt: d.finaliseeAt,
    avenants: d.avenants
      ? d.avenants.map((a) => ({ id: a.id, numero: a.numero, statut: a.statut, totalHt: Number(a.totalHt) }))
      : undefined,
    factures: d.factures || undefined,
    createdAt: d.createdAt,
    updatedAt: d.updatedAt,
    lignes,
  };
}

function buildDevisSnapshot(devis, em) {
  const cl = devis.client || {};
  const dateEmission = devis.dateEmission;
  const dateValidite = dateEmission
    ? new Date(new Date(dateEmission).getTime() + (devis.validiteJours || 30) * 86400000)
    : null;
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
      tvaIntra: cl.tvaIntra,
    },
    devis: {
      numero: devis.numero,
      titre: devis.titre,
      description: devis.description,
      dateEmission: devis.dateEmission,
      dateValidite,
      validiteJours: devis.validiteJours,
      acomptePct: devis.acomptePct != null ? Number(devis.acomptePct) : null,
      cyclesInclus: devis.cyclesInclus,
      clauseRevision: devis.clauseRevision,
      clauseHebergement: devis.clauseHebergement,
    },
    lignes: (devis.lignes || []).map((l) => ({
      designation: l.designation,
      quantite: Number(l.quantite),
      prixUnitaire: Number(l.prixUnitaire),
      montant: Number(l.quantite) * Number(l.prixUnitaire),
    })),
    totalHt: Number(devis.totalHt),
  };
}

async function generateDevisPdf(devis) {
  if (!devis.snapshot) throw new Error('Devis sans snapshot');
  const customHtml = await getCustomHtmlForType('devis');
  const html = customHtml ? renderCustomDocument(customHtml, devis.snapshot, 'devis') : renderDevisHtml(devis.snapshot);
  const pdf = await renderHtmlToPdf(html);
  const d = new Date(devis.dateEmission);
  const year = String(d.getFullYear());
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const dir = path.join(env.storage.root, 'devis', year, month);
  fs.mkdirSync(dir, { recursive: true });
  const filePath = path.join(dir, `${devis.numero}.pdf`);
  fs.writeFileSync(filePath, pdf);
  logger.info(`[devis] PDF stored ${filePath} (${pdf.length} bytes)`);
  await prisma.devis.update({ where: { id: devis.id }, data: { pdfPath: filePath } });
  const drivePath = `Facturation/devis/${year}/${month}/${devis.numero}.pdf`;
  await enqueueUpload({ filePath, drivePath, documentType: 'devis', documentId: devis.id });
  return filePath;
}

// GET /api/devis
router.get(
  '/',
  validate(listQuerySchema, 'query'),
  asyncHandler(async (req, res) => {
    const { statut, clientId, annee, search } = req.query;
    const where = {};
    if (clientId) where.clientId = Number(clientId);
    if (search) where.numero = { contains: search, mode: 'insensitive' };
    if (annee) {
      where.dateEmission = {
        gte: new Date(Date.UTC(annee, 0, 1)),
        lt: new Date(Date.UTC(Number(annee) + 1, 0, 1)),
      };
    }
    // statut filter: 'expire' is computed from envoye + validite so we filter envoye server-side
    if (statut && statut !== 'expire') where.statut = statut;
    else if (statut === 'expire') where.statut = 'envoye'; // will be post-filtered

    const all = await prisma.devis.findMany({
      where,
      include: { client: true, lignes: { orderBy: { ordre: 'asc' } } },
      orderBy: [{ dateEmission: 'desc' }, { id: 'desc' }],
    });

    const serialized = all.map(serializeDevis);
    const filtered = statut === 'expire' ? serialized.filter((d) => d.statut === 'expire') : serialized;
    res.json(filtered);
  }),
);

// GET /api/devis/:id
router.get(
  '/:id',
  asyncHandler(async (req, res) => {
    const devis = await prisma.devis.findUnique({
      where: { id: Number(req.params.id) },
      include: FULL_INCLUDE,
    });
    if (!devis) throw ApiError.notFound('Devis introuvable');
    res.json(serializeDevis(devis));
  }),
);

// POST /api/devis
router.post(
  '/',
  validate(devisSchema),
  asyncHandler(async (req, res) => {
    const { lignes, ...data } = req.body;
    data.dateEmission = data.dateEmission || new Date();
    const totalHt = computeTotal(lignes);
    const created = await prisma.devis.create({
      data: { ...data, totalHt, lignes: { create: lignes.map((l, i) => ({ ...l, ordre: i })) } },
      include: FULL_INCLUDE,
    });
    res.status(201).json(serializeDevis(created));
  }),
);

// PUT /api/devis/:id — update draft only
router.put(
  '/:id',
  validate(devisSchema),
  asyncHandler(async (req, res) => {
    const id = Number(req.params.id);
    const existing = await prisma.devis.findUnique({ where: { id } });
    if (!existing) throw ApiError.notFound('Devis introuvable');
    if (existing.verrouillee) throw ApiError.badRequest('Devis finalisé : non modifiable');

    const { lignes, ...data } = req.body;
    data.dateEmission = data.dateEmission || existing.dateEmission;
    const totalHt = computeTotal(lignes);

    const updated = await prisma.$transaction(async (tx) => {
      await tx.ligneDevis.deleteMany({ where: { devisId: id } });
      return tx.devis.update({
        where: { id },
        data: { ...data, totalHt, lignes: { create: lignes.map((l, i) => ({ ...l, ordre: i })) } },
        include: FULL_INCLUDE,
      });
    });
    res.json(serializeDevis(updated));
  }),
);

// DELETE /api/devis/:id — draft only
router.delete(
  '/:id',
  asyncHandler(async (req, res) => {
    const id = Number(req.params.id);
    const existing = await prisma.devis.findUnique({ where: { id } });
    if (!existing) throw ApiError.notFound('Devis introuvable');
    if (existing.verrouillee) throw ApiError.badRequest('Devis finalisé : suppression interdite');
    await prisma.devis.delete({ where: { id } });
    res.status(204).end();
  }),
);

// POST /api/devis/:id/finaliser
router.post(
  '/:id/finaliser',
  asyncHandler(async (req, res) => {
    const id = Number(req.params.id);
    const devis = await prisma.devis.findUnique({ where: { id }, include: FULL_INCLUDE });
    if (!devis) throw ApiError.notFound('Devis introuvable');
    if (devis.verrouillee) throw ApiError.badRequest('Devis déjà finalisé');
    if (devis.statut !== 'brouillon') throw ApiError.badRequest('Seul un brouillon peut être finalisé');
    if (!devis.clientId) throw ApiError.badRequest('Un client est requis pour finaliser le devis');
    if (devis.lignes.length === 0) throw ApiError.badRequest('Au moins une ligne est requise');
    if (Number(devis.totalHt) <= 0) throw ApiError.badRequest('Le total doit être strictement positif');

    const em = await getEmetteurDict();
    const annee = new Date(devis.dateEmission).getFullYear();

    const finalised = await prisma.$transaction(async (tx) => {
      const numero = await allocateNumber(tx, 'DEV', annee);
      const snapshot = buildDevisSnapshot({ ...devis, numero }, em);
      return tx.devis.update({
        where: { id },
        data: { numero, statut: 'finalise', verrouillee: true, finaliseeAt: new Date(), snapshot },
        include: FULL_INCLUDE,
      });
    });

    try {
      await generateDevisPdf(finalised);
    } catch (err) {
      logger.error(`[devis] PDF generation failed for ${finalised.numero}: ${err.message}`);
    }

    const fresh = await prisma.devis.findUnique({ where: { id }, include: FULL_INCLUDE });
    res.json(serializeDevis(fresh));
  }),
);

// POST /api/devis/:id/envoyer
router.post(
  '/:id/envoyer',
  asyncHandler(async (req, res) => {
    const id = Number(req.params.id);
    const devis = await prisma.devis.findUnique({ where: { id } });
    if (!devis) throw ApiError.notFound('Devis introuvable');
    if (devis.statut !== 'finalise') throw ApiError.badRequest('Seul un devis finalisé peut être marqué envoyé');
    const updated = await prisma.devis.update({
      where: { id },
      data: { statut: 'envoye', dateEnvoi: new Date() },
      include: FULL_INCLUDE,
    });
    res.json(serializeDevis(updated));
  }),
);

// POST /api/devis/:id/accepter
router.post(
  '/:id/accepter',
  asyncHandler(async (req, res) => {
    const id = Number(req.params.id);
    const devis = await prisma.devis.findUnique({ where: { id } });
    if (!devis) throw ApiError.notFound('Devis introuvable');
    if (!['finalise', 'envoye'].includes(devis.statut)) {
      throw ApiError.badRequest('Le devis doit être finalisé ou envoyé pour être accepté');
    }
    const updated = await prisma.devis.update({
      where: { id },
      data: { statut: 'accepte' },
      include: FULL_INCLUDE,
    });
    res.json(serializeDevis(updated));
  }),
);

// POST /api/devis/:id/refuser
router.post(
  '/:id/refuser',
  asyncHandler(async (req, res) => {
    const id = Number(req.params.id);
    const devis = await prisma.devis.findUnique({ where: { id } });
    if (!devis) throw ApiError.notFound('Devis introuvable');
    if (!['finalise', 'envoye'].includes(devis.statut)) {
      throw ApiError.badRequest('Le devis doit être finalisé ou envoyé pour être refusé');
    }
    const updated = await prisma.devis.update({
      where: { id },
      data: { statut: 'refuse' },
      include: FULL_INCLUDE,
    });
    res.json(serializeDevis(updated));
  }),
);

// POST /api/devis/:id/annuler
router.post(
  '/:id/annuler',
  asyncHandler(async (req, res) => {
    const id = Number(req.params.id);
    const devis = await prisma.devis.findUnique({ where: { id } });
    if (!devis) throw ApiError.notFound('Devis introuvable');
    if (devis.statut === 'brouillon') throw ApiError.badRequest("Supprimez le brouillon plutôt que de l'annuler");
    const updated = await prisma.devis.update({
      where: { id },
      data: { statut: 'annule' },
      include: FULL_INCLUDE,
    });
    res.json(serializeDevis(updated));
  }),
);

// POST /api/devis/:id/incrementer-cycle
router.post(
  '/:id/incrementer-cycle',
  asyncHandler(async (req, res) => {
    const id = Number(req.params.id);
    const devis = await prisma.devis.findUnique({ where: { id } });
    if (!devis) throw ApiError.notFound('Devis introuvable');
    if (devis.statut !== 'accepte') throw ApiError.badRequest('Le devis doit être accepté pour incrémenter les cycles');
    const updated = await prisma.devis.update({
      where: { id },
      data: { cyclesUtilises: { increment: 1 } },
      include: FULL_INCLUDE,
    });
    res.json(serializeDevis(updated));
  }),
);

// POST /api/devis/:id/upload-signe — store the client-signed PDF (base64 JSON body)
router.post(
  '/:id/upload-signe',
  asyncHandler(async (req, res) => {
    const id = Number(req.params.id);
    const devis = await prisma.devis.findUnique({ where: { id } });
    if (!devis) throw ApiError.notFound('Devis introuvable');
    if (!devis.verrouillee) throw ApiError.badRequest('Le devis doit être finalisé pour uploader le signé');
    const { data } = req.body;
    if (!data) throw ApiError.badRequest('Champ data (base64) requis');

    const filePath = await storeSignedPdf({
      type: 'devis', folder: 'devis', numero: devis.numero, fallbackName: `devis-${id}`,
      documentId: id, base64: data, date: devis.dateEmission,
    });
    await prisma.devis.update({ where: { id }, data: { signedPdfPath: filePath } });
    const fresh = await prisma.devis.findUnique({ where: { id }, include: FULL_INCLUDE });
    res.json(serializeDevis(fresh));
  }),
);

// GET /api/devis/:id/pdf-signe — serve the signed PDF
router.get(
  '/:id/pdf-signe',
  asyncHandler(async (req, res) => {
    const id = Number(req.params.id);
    const devis = await prisma.devis.findUnique({ where: { id } });
    if (!devis) throw ApiError.notFound('Devis introuvable');
    if (!devis.signedPdfPath || !fs.existsSync(devis.signedPdfPath)) {
      throw ApiError.notFound('Aucun document signé disponible');
    }
    const name = `${devis.numero}-signe.pdf`;
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `inline; filename="${name}"`);
    res.send(fs.readFileSync(devis.signedPdfPath));
  }),
);

// POST /api/devis/:id/dupliquer — create a new draft from an existing devis
router.post(
  '/:id/dupliquer',
  asyncHandler(async (req, res) => {
    const id = Number(req.params.id);
    const source = await prisma.devis.findUnique({
      where: { id },
      include: { lignes: { orderBy: { ordre: 'asc' } } },
    });
    if (!source) throw ApiError.notFound('Devis introuvable');

    const created = await prisma.devis.create({
      data: {
        clientId: source.clientId,
        titre: source.titre ? `Copie — ${source.titre}` : null,
        description: source.description,
        dateEmission: new Date(),
        validiteJours: source.validiteJours,
        acomptePct: source.acomptePct,
        cyclesInclus: source.cyclesInclus,
        clauseRevision: source.clauseRevision,
        clauseHebergement: source.clauseHebergement,
        totalHt: source.totalHt,
        statut: 'brouillon',
        verrouillee: false,
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
    res.status(201).json(serializeDevis(created));
  }),
);

// GET /api/devis/:id/pdf
router.get(
  '/:id/pdf',
  asyncHandler(async (req, res) => {
    const id = Number(req.params.id);
    const devis = await prisma.devis.findUnique({ where: { id }, include: FULL_INCLUDE });
    if (!devis) throw ApiError.notFound('Devis introuvable');

    let pdf;
    if (devis.pdfPath && fs.existsSync(devis.pdfPath)) {
      pdf = fs.readFileSync(devis.pdfPath);
    } else {
      const em = await getEmetteurDict();
      const snapshot = devis.snapshot || buildDevisSnapshot(devis, em);
      const customHtml = await getCustomHtmlForType('devis');
      const html = customHtml ? renderCustomDocument(customHtml, snapshot, 'devis') : renderDevisHtml(snapshot);
      pdf = await renderHtmlToPdf(html);
    }

    const name = `${devis.numero || `brouillon-devis-${id}`}.pdf`;
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `inline; filename="${name}"`);
    res.send(pdf);
  }),
);

export { serializeDevis, buildDevisSnapshot };
export default router;
