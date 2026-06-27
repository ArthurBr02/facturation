// Template CRUD + placeholder preview routes.
//
// Note: editing a template that has already been used must not mutate history,
// so PUT creates a new version (increments `version`) rather than editing in
// place. Document instantiation (POST /:id/instancier) lands in later phases
// once business documents exist.
import { Router } from 'express';
import { z } from 'zod';
import prisma from '../config/prisma.js';
import asyncHandler from '../utils/asyncHandler.js';
import { validate } from '../middleware/validate.js';
import ApiError from '../utils/ApiError.js';
import { buildPreviewMap, resolve } from '../services/placeholder.service.js';
import { getDefaultHtml, renderCustomDocument } from '../services/customTemplate.service.js';
import { renderHtmlToPdf } from '../services/pdf.service.js';

const router = Router();

const lineSchema = z.object({
  designationTemplate: z.string(),
  quantiteTemplate: z.coerce.number().default(0),
  prixUnitaireTemplate: z.coerce.number().default(0),
  ordre: z.coerce.number().int().default(0),
});

const clauseSchema = z.object({
  cle: z.enum(['objet', 'description', 'modalites', 'hebergement', 'revision', 'paiement']),
  contenuTemplate: z.string(),
});

const templateSchema = z.object({
  nom: z.string().min(1),
  type: z.enum(['devis', 'avenant', 'facture', 'contrat']),
  description: z.string().optional().nullable(),
  estDefaut: z.boolean().default(false),
  lignes: z.array(lineSchema).default([]),
  clauses: z.array(clauseSchema).default([]),
});

const listQuerySchema = z.object({ type: z.enum(['devis', 'avenant', 'facture', 'contrat']).optional() });

router.get(
  '/',
  validate(listQuerySchema, 'query'),
  asyncHandler(async (req, res) => {
    const { type } = req.query;
    const templates = await prisma.template.findMany({
      where: type ? { type } : undefined,
      include: { lignes: { orderBy: { ordre: 'asc' } }, clauses: true },
      orderBy: [{ type: 'asc' }, { nom: 'asc' }],
    });
    res.json(templates);
  }),
);

router.get(
  '/:id',
  asyncHandler(async (req, res) => {
    const template = await prisma.template.findUnique({
      where: { id: Number(req.params.id) },
      include: { lignes: { orderBy: { ordre: 'asc' } }, clauses: true },
    });
    if (!template) throw ApiError.notFound('Template introuvable');
    res.json(template);
  }),
);

// If a template is marked default, clear the flag on the other templates of the
// same type (only one default per type).
async function clearDefaults(tx, type, exceptId = null) {
  await tx.template.updateMany({
    where: { type, estDefaut: true, ...(exceptId ? { id: { not: exceptId } } : {}) },
    data: { estDefaut: false },
  });
}

router.post(
  '/',
  validate(templateSchema),
  asyncHandler(async (req, res) => {
    const { lignes, clauses, ...data } = req.body;
    const created = await prisma.$transaction(async (tx) => {
      if (data.estDefaut) await clearDefaults(tx, data.type);
      return tx.template.create({
        data: { ...data, lignes: { create: lignes }, clauses: { create: clauses } },
        include: { lignes: true, clauses: true },
      });
    });
    res.status(201).json(created);
  }),
);

// PUT creates a NEW version of the template, preserving the previous one.
router.put(
  '/:id',
  validate(templateSchema),
  asyncHandler(async (req, res) => {
    const id = Number(req.params.id);
    const previous = await prisma.template.findUnique({ where: { id } });
    if (!previous) throw ApiError.notFound('Template introuvable');
    const { lignes, clauses, ...data } = req.body;
    const created = await prisma.$transaction(async (tx) => {
      if (data.estDefaut) await clearDefaults(tx, data.type);
      return tx.template.create({
        data: {
          ...data,
          version: previous.version + 1,
          lignes: { create: lignes },
          clauses: { create: clauses },
        },
        include: { lignes: true, clauses: true },
      });
    });
    res.status(201).json(created);
  }),
);

router.delete(
  '/:id',
  asyncHandler(async (req, res) => {
    await prisma.template.delete({ where: { id: Number(req.params.id) } });
    res.status(204).end();
  }),
);

router.post(
  '/:id/set-defaut',
  asyncHandler(async (req, res) => {
    const id = Number(req.params.id);
    const template = await prisma.template.findUnique({ where: { id } });
    if (!template) throw ApiError.notFound('Template introuvable');
    await prisma.$transaction(async (tx) => {
      await clearDefaults(tx, template.type, id);
      await tx.template.update({ where: { id }, data: { estDefaut: true } });
    });
    res.json({ id, estDefaut: true });
  }),
);

// GET /api/templates/:id/preview — resolve placeholders with sample data.
router.get(
  '/:id/preview',
  asyncHandler(async (req, res) => {
    const template = await prisma.template.findUnique({
      where: { id: Number(req.params.id) },
      include: { lignes: { orderBy: { ordre: 'asc' } }, clauses: true },
    });
    if (!template) throw ApiError.notFound('Template introuvable');
    const map = await buildPreviewMap();
    res.json({
      nom: template.nom,
      type: template.type,
      hasCustomHtml: Boolean(template.customHtml),
      lignes: template.lignes.map((l) => ({
        designation: resolve(l.designationTemplate, map),
        quantite: Number(l.quantiteTemplate),
        prixUnitaire: Number(l.prixUnitaireTemplate),
      })),
      clauses: template.clauses.map((c) => ({ cle: c.cle, contenu: resolve(c.contenuTemplate, map) })),
    });
  }),
);

// GET /api/templates/defaults/:type — download the default placeholder HTML for a type.
router.get(
  '/defaults/:type',
  asyncHandler(async (req, res) => {
    const { type } = req.params;
    const html = getDefaultHtml(type);
    if (!html) throw ApiError.notFound(`Pas de template par défaut pour le type "${type}"`);
    res.setHeader('Content-Type', 'text/html; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="template-${type}-defaut.html"`);
    res.send(html);
  }),
);

// POST /api/templates/:id/upload-html — store a custom HTML override on the template.
router.post(
  '/:id/upload-html',
  asyncHandler(async (req, res) => {
    const id = Number(req.params.id);
    const template = await prisma.template.findUnique({ where: { id } });
    if (!template) throw ApiError.notFound('Template introuvable');
    const { html } = req.body;
    if (!html || typeof html !== 'string') throw ApiError.badRequest('Champ html requis');
    if (html.length > 2_000_000) throw ApiError.badRequest('HTML trop volumineux (max 2 Mo)');
    await prisma.template.update({ where: { id }, data: { customHtml: html } });
    res.json({ id, customHtml: true });
  }),
);

// DELETE /api/templates/:id/custom-html — remove the custom HTML override.
router.delete(
  '/:id/custom-html',
  asyncHandler(async (req, res) => {
    const id = Number(req.params.id);
    const template = await prisma.template.findUnique({ where: { id } });
    if (!template) throw ApiError.notFound('Template introuvable');
    await prisma.template.update({ where: { id }, data: { customHtml: null } });
    res.json({ id, customHtml: false });
  }),
);

// GET /api/templates/:id/preview-pdf — render a preview PDF with sample data.
router.get(
  '/:id/preview-pdf',
  asyncHandler(async (req, res) => {
    const template = await prisma.template.findUnique({ where: { id: Number(req.params.id) } });
    if (!template) throw ApiError.notFound('Template introuvable');

    const sampleSnap = buildSampleSnapshot(template.type);
    const customHtml = template.customHtml || getDefaultHtml(template.type);
    if (!customHtml) throw ApiError.badRequest('Aucun HTML disponible pour ce type');

    const html = renderCustomDocument(customHtml, sampleSnap, template.type);
    const pdf = await renderHtmlToPdf(html);

    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `inline; filename="preview-${template.nom}.pdf"`);
    res.send(pdf);
  }),
);

/** Build a realistic sample snapshot for PDF preview. */
function buildSampleSnapshot(type) {
  const emetteur = {
    nom: 'Jean Dupont', entreprise: 'JD Dev', statut: 'EI',
    siret: '123 456 789 00012', ape: '6201Z',
    adresse1: '12 rue de la Paix', adresse2: '', cp: '75001', ville: 'Paris', pays: 'France',
    email: 'jean@jddev.fr', telephone: '06 00 00 00 00',
    iban: 'FR76 3000 6000 0112 3456 7890 189', bic: 'BNPAFRPP',
    mention_tva: 'TVA non applicable, art. 293 B du CGI',
    penalites: "En cas de retard de paiement, une pénalité de 3× le taux légal sera appliquée.",
  };
  const client = {
    nom: 'AB Corp', denomination: 'AB Corp SAS', formeJuridique: 'SAS',
    adresse1: '42 avenue des Champs', adresse2: 'Bâtiment C', codePostal: '75008', ville: 'Paris', pays: 'France',
    siren: '987 654 321', tvaIntra: 'FR12987654321',
  };
  const mentions = { tva: emetteur.mention_tva, penalites: emetteur.penalites };
  const lignes = [
    { designation: 'Développement frontend', quantite: 5, prixUnitaire: 400, montant: 2000 },
    { designation: 'Intégration API', quantite: 2, prixUnitaire: 400, montant: 800 },
  ];
  const totalHt = 2800;
  const now = new Date();

  if (type === 'facture') {
    return {
      emetteur, client, mentions, lignes, totalHt,
      facture: {
        numero: 'FAC-2026-001', type: 'standard',
        dateEmission: now, dateEcheance: new Date(now.getTime() + 30 * 86400000),
        bonCommande: '', factureOrigineNumero: '',
        objet: 'Prestation de développement web',
        dateExecutionDebut: null, dateExecutionFin: null,
      },
    };
  }
  if (type === 'devis') {
    return {
      emetteur, client, mentions, lignes, totalHt,
      devis: {
        numero: 'DEV-2026-001', titre: 'Refonte application web',
        description: 'Développement complet de l\'application de gestion.',
        dateEmission: now,
        dateValidite: new Date(now.getTime() + 30 * 86400000),
        validiteJours: 30, acomptePct: 30, cyclesInclus: 3,
        clauseRevision: 'Le présent devis inclut 3 cycles de révision mineurs.',
        clauseHebergement: 'Le client crée un compte Hetzner et fournit un accès développeur.',
      },
    };
  }
  if (type === 'avenant') {
    return {
      emetteur, client, mentions, lignes, totalHt,
      avenant: {
        numero: 'AVE-2026-001', objet: 'Ajout module reporting',
        description: 'Développement d\'un tableau de bord analytique.',
        delaiAdd: 5, dateEmission: now, devisNumero: 'DEV-2026-001',
      },
    };
  }
  if (type === 'contrat') {
    return {
      emetteur, client, mentions, lignes: [], totalHt: 0,
      contrat: {
        numero: 'MNT-2026-001', titre: 'Contrat de maintenance applicative',
        description: 'Maintenance corrective et évolutive de l\'application web.',
        dateDebut: now, dureeMois: 12, reconduction: true, preavisJours: 30,
        montantMensuel: 500, heuresIncluses: 5, reportHeures: false,
        thmDepassement: 75,
        perimetreCouvert: 'Corrections de bugs, petites évolutions, supervision serveur.',
        exclusions: 'Nouvelles fonctionnalités majeures → avenant ou facture directe.',
      },
    };
  }
  return { emetteur, client, mentions, lignes: [], totalHt: 0 };
}

export default router;
