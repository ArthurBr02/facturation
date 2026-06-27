// Avenant (amendment) routes — Phase 2 Sprint 2.3.
// Avenants are attached to an accepted/finalised devis. On acceptance,
// the avenant's totalHt is added to the parent devis's totalHt.
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
import { renderAvenantHtml } from '../templates/avenantHtml.js';
import { getCustomHtmlForType, renderCustomDocument } from '../services/customTemplate.service.js';
import { enqueueUpload } from '../services/uploadQueue.service.js';
import { getEmetteurDict } from '../services/facture.service.js';
import env from '../config/env.js';
import path from 'node:path';

const router = Router();

const FULL_INCLUDE = {
  devis: { include: { client: true } },
  lignes: { orderBy: { ordre: 'asc' } },
};

const ligneSchema = z.object({
  designation: z.string().default(''),
  quantite: z.coerce.number().default(1),
  prixUnitaire: z.coerce.number().default(0),
  ordre: z.coerce.number().int().default(0),
});

const dateSchema = z.coerce.date();

const avenantSchema = z.object({
  devisId: z.coerce.number().int().positive(),
  objet: z.string().optional().nullable(),
  description: z.string().optional().nullable(),
  delaiAdd: z.coerce.number().int().min(0).optional().nullable(),
  dateEmission: dateSchema.optional(),
  lignes: z.array(ligneSchema).default([]),
});

const listQuerySchema = z.object({
  devisId: z.coerce.number().int().optional(),
  statut: z.enum(['brouillon', 'finalise', 'envoye', 'accepte', 'refuse', 'annule']).optional(),
  annee: z.coerce.number().int().optional(),
});

function computeTotal(lignes) {
  return lignes.reduce((sum, l) => sum + Number(l.quantite || 0) * Number(l.prixUnitaire || 0), 0);
}

function serializeAvenant(a) {
  const lignes = (a.lignes || []).map((l) => ({
    id: l.id,
    designation: l.designation,
    quantite: Number(l.quantite),
    prixUnitaire: Number(l.prixUnitaire),
    montant: Number(l.quantite) * Number(l.prixUnitaire),
    ordre: l.ordre,
  }));
  const cl = a.devis?.client || {};
  return {
    id: a.id,
    numero: a.numero,
    statut: a.statut,
    devisId: a.devisId,
    devisNumero: a.devis?.numero || null,
    client: cl.id ? { id: cl.id, nom: cl.nom, denomination: cl.denomination } : null,
    objet: a.objet,
    description: a.description,
    delaiAdd: a.delaiAdd,
    totalHt: Number(a.totalHt),
    verrouillee: a.verrouillee,
    dateEmission: a.dateEmission,
    dateEnvoi: a.dateEnvoi,
    hasPdf: Boolean(a.pdfPath),
    hasSignedPdf: Boolean(a.signedPdfPath),
    finaliseeAt: a.finaliseeAt,
    createdAt: a.createdAt,
    updatedAt: a.updatedAt,
    lignes,
  };
}

function buildAvenantSnapshot(avenant, em) {
  const devis = avenant.devis || {};
  const cl = devis.client || {};
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
    },
    mentions: { tva: em.mention_tva },
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
    avenant: {
      numero: avenant.numero,
      objet: avenant.objet,
      description: avenant.description,
      delaiAdd: avenant.delaiAdd,
      dateEmission: avenant.dateEmission,
      devisNumero: devis.numero,
    },
    lignes: (avenant.lignes || []).map((l) => ({
      designation: l.designation,
      quantite: Number(l.quantite),
      prixUnitaire: Number(l.prixUnitaire),
      montant: Number(l.quantite) * Number(l.prixUnitaire),
    })),
    totalHt: Number(avenant.totalHt),
  };
}

async function generateAvenantPdf(avenant) {
  if (!avenant.snapshot) throw new Error('Avenant sans snapshot');
  const customHtml = await getCustomHtmlForType('avenant');
  const html = customHtml ? renderCustomDocument(customHtml, avenant.snapshot, 'avenant') : renderAvenantHtml(avenant.snapshot);
  const pdf = await renderHtmlToPdf(html);
  const d = new Date(avenant.dateEmission);
  const year = String(d.getFullYear());
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const dir = path.join(env.storage.root, 'avenants', year, month);
  fs.mkdirSync(dir, { recursive: true });
  const filePath = path.join(dir, `${avenant.numero}.pdf`);
  fs.writeFileSync(filePath, pdf);
  logger.info(`[avenant] PDF stored ${filePath} (${pdf.length} bytes)`);
  await prisma.avenant.update({ where: { id: avenant.id }, data: { pdfPath: filePath } });
  const drivePath = `Facturation/avenants/${year}/${month}/${avenant.numero}.pdf`;
  await enqueueUpload({ filePath, drivePath, documentType: 'avenant', documentId: avenant.id });
  return filePath;
}

// GET /api/avenants
router.get(
  '/',
  validate(listQuerySchema, 'query'),
  asyncHandler(async (req, res) => {
    const { devisId, statut, annee } = req.query;
    const where = {};
    if (devisId) where.devisId = Number(devisId);
    if (statut) where.statut = statut;
    if (annee) {
      where.dateEmission = {
        gte: new Date(Date.UTC(annee, 0, 1)),
        lt: new Date(Date.UTC(Number(annee) + 1, 0, 1)),
      };
    }
    const all = await prisma.avenant.findMany({
      where,
      include: FULL_INCLUDE,
      orderBy: [{ dateEmission: 'desc' }, { id: 'desc' }],
    });
    res.json(all.map(serializeAvenant));
  }),
);

// GET /api/avenants/:id
router.get(
  '/:id',
  asyncHandler(async (req, res) => {
    const a = await prisma.avenant.findUnique({
      where: { id: Number(req.params.id) },
      include: FULL_INCLUDE,
    });
    if (!a) throw ApiError.notFound('Avenant introuvable');
    res.json(serializeAvenant(a));
  }),
);

// POST /api/avenants
router.post(
  '/',
  validate(avenantSchema),
  asyncHandler(async (req, res) => {
    const { lignes, ...data } = req.body;
    const devis = await prisma.devis.findUnique({ where: { id: data.devisId } });
    if (!devis) throw ApiError.notFound('Devis parent introuvable');
    if (!devis.verrouillee) throw ApiError.badRequest('Le devis doit être finalisé pour créer un avenant');

    data.dateEmission = data.dateEmission || new Date();
    const totalHt = computeTotal(lignes);
    const created = await prisma.avenant.create({
      data: { ...data, totalHt, lignes: { create: lignes.map((l, i) => ({ ...l, ordre: i })) } },
      include: FULL_INCLUDE,
    });
    res.status(201).json(serializeAvenant(created));
  }),
);

// PUT /api/avenants/:id
router.put(
  '/:id',
  validate(avenantSchema),
  asyncHandler(async (req, res) => {
    const id = Number(req.params.id);
    const existing = await prisma.avenant.findUnique({ where: { id } });
    if (!existing) throw ApiError.notFound('Avenant introuvable');
    if (existing.verrouillee) throw ApiError.badRequest('Avenant finalisé : non modifiable');

    const { lignes, devisId, ...data } = req.body; // devisId immutable after creation
    data.dateEmission = data.dateEmission || existing.dateEmission;
    const totalHt = computeTotal(lignes);

    const updated = await prisma.$transaction(async (tx) => {
      await tx.ligneAvenant.deleteMany({ where: { avenantId: id } });
      return tx.avenant.update({
        where: { id },
        data: { ...data, totalHt, lignes: { create: lignes.map((l, i) => ({ ...l, ordre: i })) } },
        include: FULL_INCLUDE,
      });
    });
    res.json(serializeAvenant(updated));
  }),
);

// DELETE /api/avenants/:id — draft only
router.delete(
  '/:id',
  asyncHandler(async (req, res) => {
    const id = Number(req.params.id);
    const existing = await prisma.avenant.findUnique({ where: { id } });
    if (!existing) throw ApiError.notFound('Avenant introuvable');
    if (existing.verrouillee) throw ApiError.badRequest('Avenant finalisé : suppression interdite');
    await prisma.avenant.delete({ where: { id } });
    res.status(204).end();
  }),
);

// POST /api/avenants/:id/finaliser
router.post(
  '/:id/finaliser',
  asyncHandler(async (req, res) => {
    const id = Number(req.params.id);
    const avenant = await prisma.avenant.findUnique({ where: { id }, include: FULL_INCLUDE });
    if (!avenant) throw ApiError.notFound('Avenant introuvable');
    if (avenant.verrouillee) throw ApiError.badRequest('Avenant déjà finalisé');
    if (avenant.statut !== 'brouillon') throw ApiError.badRequest('Seul un brouillon peut être finalisé');
    if (avenant.lignes.length === 0) throw ApiError.badRequest('Au moins une ligne est requise');
    if (Number(avenant.totalHt) <= 0) throw ApiError.badRequest('Le total doit être strictement positif');

    const em = await getEmetteurDict();
    const annee = new Date(avenant.dateEmission).getFullYear();

    const finalised = await prisma.$transaction(async (tx) => {
      const numero = await allocateNumber(tx, 'AVE', annee);
      const snapshot = buildAvenantSnapshot({ ...avenant, numero }, em);
      return tx.avenant.update({
        where: { id },
        data: { numero, statut: 'finalise', verrouillee: true, finaliseeAt: new Date(), snapshot },
        include: FULL_INCLUDE,
      });
    });

    try {
      await generateAvenantPdf(finalised);
    } catch (err) {
      logger.error(`[avenant] PDF generation failed for ${finalised.numero}: ${err.message}`);
    }

    const fresh = await prisma.avenant.findUnique({ where: { id }, include: FULL_INCLUDE });
    res.json(serializeAvenant(fresh));
  }),
);

// POST /api/avenants/:id/envoyer
router.post(
  '/:id/envoyer',
  asyncHandler(async (req, res) => {
    const id = Number(req.params.id);
    const a = await prisma.avenant.findUnique({ where: { id } });
    if (!a) throw ApiError.notFound('Avenant introuvable');
    if (a.statut !== 'finalise') throw ApiError.badRequest('Seul un avenant finalisé peut être marqué envoyé');
    const updated = await prisma.avenant.update({
      where: { id },
      data: { statut: 'envoye', dateEnvoi: new Date() },
      include: FULL_INCLUDE,
    });
    res.json(serializeAvenant(updated));
  }),
);

// POST /api/avenants/:id/accepter — also updates parent devis totalHt
router.post(
  '/:id/accepter',
  asyncHandler(async (req, res) => {
    const id = Number(req.params.id);
    const a = await prisma.avenant.findUnique({ where: { id }, include: FULL_INCLUDE });
    if (!a) throw ApiError.notFound('Avenant introuvable');
    if (!['finalise', 'envoye'].includes(a.statut)) {
      throw ApiError.badRequest("L'avenant doit être finalisé ou envoyé pour être accepté");
    }

    const updated = await prisma.$transaction(async (tx) => {
      // Update parent devis totalHt += avenant.totalHt
      await tx.devis.update({
        where: { id: a.devisId },
        data: { totalHt: { increment: a.totalHt } },
      });
      return tx.avenant.update({
        where: { id },
        data: { statut: 'accepte' },
        include: FULL_INCLUDE,
      });
    });
    res.json(serializeAvenant(updated));
  }),
);

// POST /api/avenants/:id/refuser
router.post(
  '/:id/refuser',
  asyncHandler(async (req, res) => {
    const id = Number(req.params.id);
    const a = await prisma.avenant.findUnique({ where: { id } });
    if (!a) throw ApiError.notFound('Avenant introuvable');
    if (!['finalise', 'envoye'].includes(a.statut)) {
      throw ApiError.badRequest("L'avenant doit être finalisé ou envoyé pour être refusé");
    }
    const updated = await prisma.avenant.update({
      where: { id },
      data: { statut: 'refuse' },
      include: FULL_INCLUDE,
    });
    res.json(serializeAvenant(updated));
  }),
);

// POST /api/avenants/:id/annuler
router.post(
  '/:id/annuler',
  asyncHandler(async (req, res) => {
    const id = Number(req.params.id);
    const a = await prisma.avenant.findUnique({ where: { id } });
    if (!a) throw ApiError.notFound('Avenant introuvable');
    if (a.statut === 'brouillon') throw ApiError.badRequest("Supprimez le brouillon plutôt que de l'annuler");
    const updated = await prisma.avenant.update({
      where: { id },
      data: { statut: 'annule' },
      include: FULL_INCLUDE,
    });
    res.json(serializeAvenant(updated));
  }),
);

// POST /api/avenants/:id/upload-signe — store the client-signed PDF (base64 JSON body)
router.post(
  '/:id/upload-signe',
  asyncHandler(async (req, res) => {
    const id = Number(req.params.id);
    const a = await prisma.avenant.findUnique({ where: { id } });
    if (!a) throw ApiError.notFound('Avenant introuvable');
    if (!a.verrouillee) throw ApiError.badRequest("L'avenant doit être finalisé pour uploader le signé");
    const { data } = req.body;
    if (!data) throw ApiError.badRequest('Champ data (base64) requis');

    const buf = Buffer.from(data, 'base64');
    const dir = path.join(env.storage.root, 'signes', 'avenants');
    fs.mkdirSync(dir, { recursive: true });
    const filename = `${a.numero || `avenant-${id}`}-signe.pdf`;
    const filePath = path.join(dir, filename);
    fs.writeFileSync(filePath, buf);
    logger.info(`[avenants] signed PDF stored ${filePath} (${buf.length} bytes)`);

    await prisma.avenant.update({ where: { id }, data: { signedPdfPath: filePath } });
    const fresh = await prisma.avenant.findUnique({ where: { id }, include: FULL_INCLUDE });
    res.json(serializeAvenant(fresh));
  }),
);

// GET /api/avenants/:id/pdf-signe — serve the signed PDF
router.get(
  '/:id/pdf-signe',
  asyncHandler(async (req, res) => {
    const id = Number(req.params.id);
    const a = await prisma.avenant.findUnique({ where: { id } });
    if (!a) throw ApiError.notFound('Avenant introuvable');
    if (!a.signedPdfPath || !fs.existsSync(a.signedPdfPath)) {
      throw ApiError.notFound('Aucun document signé disponible');
    }
    const name = `${a.numero}-signe.pdf`;
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `inline; filename="${name}"`);
    res.send(fs.readFileSync(a.signedPdfPath));
  }),
);

// POST /api/avenants/:id/dupliquer — create a new draft from an existing avenant
router.post(
  '/:id/dupliquer',
  asyncHandler(async (req, res) => {
    const id = Number(req.params.id);
    const source = await prisma.avenant.findUnique({
      where: { id },
      include: { lignes: { orderBy: { ordre: 'asc' } } },
    });
    if (!source) throw ApiError.notFound('Avenant introuvable');

    const created = await prisma.avenant.create({
      data: {
        devisId: source.devisId,
        objet: source.objet ? `Copie — ${source.objet}` : null,
        description: source.description,
        delaiAdd: source.delaiAdd,
        dateEmission: new Date(),
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
    res.status(201).json(serializeAvenant(created));
  }),
);

// GET /api/avenants/:id/pdf
router.get(
  '/:id/pdf',
  asyncHandler(async (req, res) => {
    const id = Number(req.params.id);
    const a = await prisma.avenant.findUnique({ where: { id }, include: FULL_INCLUDE });
    if (!a) throw ApiError.notFound('Avenant introuvable');

    let pdf;
    if (a.pdfPath && fs.existsSync(a.pdfPath)) {
      pdf = fs.readFileSync(a.pdfPath);
    } else {
      const em = await getEmetteurDict();
      const snapshot = a.snapshot || buildAvenantSnapshot(a, em);
      const customHtml = await getCustomHtmlForType('avenant');
      const html = customHtml ? renderCustomDocument(customHtml, snapshot, 'avenant') : renderAvenantHtml(snapshot);
      pdf = await renderHtmlToPdf(html);
    }

    const name = `${a.numero || `brouillon-avenant-${id}`}.pdf`;
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `inline; filename="${name}"`);
    res.send(pdf);
  }),
);

export default router;
