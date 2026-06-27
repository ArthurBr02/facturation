// Client CRUD routes.
import { Router } from 'express';
import { z } from 'zod';
import prisma from '../config/prisma.js';
import asyncHandler from '../utils/asyncHandler.js';
import { validate } from '../middleware/validate.js';
import ApiError from '../utils/ApiError.js';

const router = Router();

const clientSchema = z.object({
  type: z.enum(['pro', 'particulier']).default('pro'),
  pays: z.string().default('France'),
  nom: z.string().min(1, 'Le nom est requis'),
  denomination: z.string().optional().nullable(),
  formeJuridique: z.string().optional().nullable(),
  email: z.string().email().optional().or(z.literal('')).nullable(),
  telephone: z.string().optional().nullable(),
  adresse1: z.string().optional().nullable(),
  adresse2: z.string().optional().nullable(),
  codePostal: z.string().optional().nullable(),
  ville: z.string().optional().nullable(),
  siren: z.string().optional().nullable(),
  tvaIntra: z.string().optional().nullable(),
  conditionsPaiement: z.coerce.number().int().positive().optional().nullable(),
  // Phase 3.5
  contactPrincipal: z.string().optional().nullable(),
  tjmNegocie: z.coerce.number().positive().optional().nullable(),
  notesInternes: z.string().optional().nullable(),
  actif: z.boolean().default(true),
});

const listQuerySchema = z.object({
  search: z.string().optional(),
  type: z.enum(['pro', 'particulier']).optional(),
});

// GET /api/clients — list with optional search + type filter.
router.get(
  '/',
  validate(listQuerySchema, 'query'),
  asyncHandler(async (req, res) => {
    const { search, type } = req.query;
    const where = {};
    if (type) where.type = type;
    if (search) {
      where.OR = [
        { nom: { contains: search, mode: 'insensitive' } },
        { denomination: { contains: search, mode: 'insensitive' } },
        { email: { contains: search, mode: 'insensitive' } },
        { siren: { contains: search, mode: 'insensitive' } },
      ];
    }
    const clients = await prisma.client.findMany({ where, orderBy: { nom: 'asc' } });

    // Attach per-client stats: document count, CA généré, en attente.
    const ids = clients.map((c) => c.id);

    // Aggregate factures (excluding avoirs) per client.
    const facAgg = await prisma.facture.groupBy({
      by: ['clientId'],
      where: {
        clientId: { in: ids },
        type: { not: 'avoir' },
        statut: { not: 'brouillon' },
      },
      _count: { id: true },
      _sum: { totalHt: true },
    });

    // Aggregate received payments for outstanding (finalisee/partielle) invoices.
    const encAgg = await prisma.encaissement.groupBy({
      by: ['factureId'],
      where: {
        facture: {
          clientId: { in: ids },
          type: { not: 'avoir' },
          statut: { in: ['finalisee', 'partielle'] },
        },
      },
      _sum: { montant: true },
    });

    // Outstanding invoice totals per client (finalisee + partielle, non-avoir).
    const pendingAgg = await prisma.facture.groupBy({
      by: ['clientId'],
      where: {
        clientId: { in: ids },
        type: { not: 'avoir' },
        statut: { in: ['finalisee', 'partielle'] },
      },
      _sum: { totalHt: true },
    });

    // Sum encaissements per client via factureId → clientId lookup.
    const pendingFactureIds = await prisma.facture.findMany({
      where: { clientId: { in: ids }, type: { not: 'avoir' }, statut: { in: ['finalisee', 'partielle'] } },
      select: { id: true, clientId: true },
    });
    const factureClientMap = Object.fromEntries(pendingFactureIds.map((f) => [f.id, f.clientId]));
    const encByClient = {};
    for (const e of encAgg) {
      const cid = factureClientMap[e.factureId];
      if (cid) encByClient[cid] = (encByClient[cid] || 0) + Number(e._sum.montant || 0);
    }

    const facByClient = Object.fromEntries(facAgg.map((a) => [a.clientId, a]));
    const pendByClient = Object.fromEntries(pendingAgg.map((a) => [a.clientId, Number(a._sum.totalHt || 0)]));

    const result = clients.map((c) => {
      const agg = facByClient[c.id];
      const pending = Math.max(0, (pendByClient[c.id] || 0) - (encByClient[c.id] || 0));
      return {
        ...c,
        _stats: {
          nbDocuments: agg?._count?.id ?? 0,
          caGenere: Number(agg?._sum?.totalHt ?? 0),
          enAttente: pending,
        },
      };
    });

    res.json(result);
  }),
);

// GET /api/clients/:id — single client.
router.get(
  '/:id',
  asyncHandler(async (req, res) => {
    const client = await prisma.client.findUnique({ where: { id: Number(req.params.id) } });
    if (!client) throw ApiError.notFound('Client introuvable');
    res.json(client);
  }),
);

// GET /api/clients/:id/documents — 360° view: all documents for this client + synthesis.
router.get(
  '/:id/documents',
  asyncHandler(async (req, res) => {
    const id = Number(req.params.id);
    const client = await prisma.client.findUnique({ where: { id } });
    if (!client) throw ApiError.notFound('Client introuvable');

    // Fetch all document types in parallel.
    const [factures, devis, avenants, contrats] = await Promise.all([
      prisma.facture.findMany({
        where: { clientId: id },
        include: { encaissements: { select: { montant: true } } },
        orderBy: { createdAt: 'desc' },
      }),
      prisma.devis.findMany({
        where: { clientId: id },
        orderBy: { createdAt: 'desc' },
      }),
      prisma.avenant.findMany({
        where: { devis: { clientId: id } },
        include: { devis: { select: { id: true, numero: true, titre: true } } },
        orderBy: { createdAt: 'desc' },
      }),
      prisma.contratMaintenance.findMany({
        where: { clientId: id },
        orderBy: { createdAt: 'desc' },
      }),
    ]);

    // Synthesis.
    const invoicesNotAvoir = factures.filter((f) => f.type !== 'avoir');
    const caTotal = invoicesNotAvoir
      .filter((f) => f.statut !== 'brouillon')
      .reduce((s, f) => s + Number(f.totalHt), 0);
    const caEncaisse = factures.reduce(
      (s, f) => s + f.encaissements.reduce((ss, e) => ss + Number(e.montant), 0),
      0,
    );
    const facturesEnCours = invoicesNotAvoir.filter((f) =>
      ['finalisee', 'partielle'].includes(f.statut),
    ).length;
    const contratsActifs = contrats.filter((c) => c.statut === 'actif').length;

    res.json({
      client,
      factures: factures.map((f) => ({
        ...f,
        encaissements: undefined, // stripped; summed below
        caEncaisse: f.encaissements.reduce((s, e) => s + Number(e.montant), 0),
      })),
      devis,
      avenants,
      contrats,
      synthese: { caTotal, caEncaisse, facturesEnCours, contratsActifs },
    });
  }),
);

router.post(
  '/',
  validate(clientSchema),
  asyncHandler(async (req, res) => {
    const data = { ...req.body };
    if (data.email === '') data.email = null;
    const client = await prisma.client.create({ data });
    res.status(201).json(client);
  }),
);

router.put(
  '/:id',
  validate(clientSchema.partial()),
  asyncHandler(async (req, res) => {
    const data = { ...req.body };
    if (data.email === '') data.email = null;
    const client = await prisma.client.update({ where: { id: Number(req.params.id) }, data });
    res.json(client);
  }),
);

router.delete(
  '/:id',
  asyncHandler(async (req, res) => {
    await prisma.client.delete({ where: { id: Number(req.params.id) } });
    res.status(204).end();
  }),
);

export default router;
