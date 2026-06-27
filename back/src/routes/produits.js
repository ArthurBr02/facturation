// Product/service catalog routes — Sprint 1.5.
// Products are quick-fill shortcuts for document lines; no FK is stored on
// lines so archiving a product never breaks existing documents.
import { Router } from 'express';
import { z } from 'zod';
import prisma from '../config/prisma.js';
import asyncHandler from '../utils/asyncHandler.js';
import { validate } from '../middleware/validate.js';
import ApiError from '../utils/ApiError.js';

const router = Router();

const produitSchema = z.object({
  reference: z.string().optional().nullable(),
  designation: z.string().min(1),
  description: z.string().optional().nullable(),
  categorie: z.string().optional().nullable(),
  prixDefaut: z.coerce.number().min(0).default(0),
  unite: z.enum(['jour', 'heure', 'forfait', 'unite']).default('unite'),
  actif: z.boolean().default(true),
});

const listQuerySchema = z.object({
  actif: z
    .string()
    .optional()
    .transform((v) => (v === undefined ? undefined : v !== 'false')),
  categorie: z.string().optional(),
  q: z.string().optional(),
});

function serialize(p) {
  return {
    id: p.id,
    reference: p.reference,
    designation: p.designation,
    description: p.description,
    categorie: p.categorie,
    prixDefaut: Number(p.prixDefaut),
    unite: p.unite,
    actif: p.actif,
    createdAt: p.createdAt,
    updatedAt: p.updatedAt,
  };
}

// GET /api/produits
router.get(
  '/',
  validate(listQuerySchema, 'query'),
  asyncHandler(async (req, res) => {
    const { actif, categorie, q } = req.query;
    const where = {};
    if (actif !== undefined) where.actif = actif;
    if (categorie) where.categorie = categorie;
    if (q) where.designation = { contains: q, mode: 'insensitive' };
    const produits = await prisma.produit.findMany({
      where,
      orderBy: [{ categorie: 'asc' }, { designation: 'asc' }],
    });
    res.json(produits.map(serialize));
  }),
);

// GET /api/produits/:id
router.get(
  '/:id',
  asyncHandler(async (req, res) => {
    const p = await prisma.produit.findUnique({ where: { id: Number(req.params.id) } });
    if (!p) throw ApiError.notFound('Produit introuvable');
    res.json(serialize(p));
  }),
);

// POST /api/produits
router.post(
  '/',
  validate(produitSchema),
  asyncHandler(async (req, res) => {
    const p = await prisma.produit.create({ data: req.body });
    res.status(201).json(serialize(p));
  }),
);

// PUT /api/produits/:id
router.put(
  '/:id',
  validate(produitSchema),
  asyncHandler(async (req, res) => {
    const id = Number(req.params.id);
    const existing = await prisma.produit.findUnique({ where: { id } });
    if (!existing) throw ApiError.notFound('Produit introuvable');
    const p = await prisma.produit.update({ where: { id }, data: req.body });
    res.json(serialize(p));
  }),
);

// DELETE /api/produits/:id — always soft-deletes (actif = false)
router.delete(
  '/:id',
  asyncHandler(async (req, res) => {
    const id = Number(req.params.id);
    const existing = await prisma.produit.findUnique({ where: { id } });
    if (!existing) throw ApiError.notFound('Produit introuvable');
    await prisma.produit.update({ where: { id }, data: { actif: false } });
    res.status(204).end();
  }),
);

export default router;
