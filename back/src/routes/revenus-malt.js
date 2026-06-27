// Routes for Malt platform revenues. Malt invoices on behalf of the user (mandat);
// only the net received amount is stored here for URSSAF + seuils consolidation.
// Phase 4 — Sprint 4.3.
import { Router } from 'express';
import { z } from 'zod';
import prisma from '../config/prisma.js';
import asyncHandler from '../utils/asyncHandler.js';
import { validate } from '../middleware/validate.js';
import ApiError from '../utils/ApiError.js';

const router = Router();

const listQuery = z.object({
  annee: z.coerce.number().int().optional(),
  trimestre: z.coerce.number().int().min(1).max(4).optional(),
});

const createSchema = z.object({
  dateEncaissement: z.string().regex(/^\d{4}-\d{2}-\d{2}/),
  montantNet: z.coerce.number().positive(),
  description: z.string().optional(),
});

const importSchema = z.object({
  lignes: z.array(z.object({
    dateEncaissement: z.string().regex(/^\d{4}-\d{2}-\d{2}/),
    montantNet: z.coerce.number().positive(),
    description: z.string().optional(),
  })).min(1),
});

function buildDateRange(annee, trimestre) {
  if (!annee) return undefined;
  if (trimestre) {
    const moisDebut = (trimestre - 1) * 3;
    return {
      gte: new Date(Date.UTC(annee, moisDebut, 1)),
      lt: new Date(Date.UTC(annee, moisDebut + 3, 1)),
    };
  }
  return {
    gte: new Date(Date.UTC(annee, 0, 1)),
    lt: new Date(Date.UTC(annee + 1, 0, 1)),
  };
}

function serialize(r) {
  return {
    id: r.id,
    dateEncaissement: r.dateEncaissement,
    montantNet: Number(r.montantNet),
    description: r.description,
    createdAt: r.createdAt,
  };
}

// GET /api/revenus-malt
router.get('/', validate(listQuery, 'query'), asyncHandler(async (req, res) => {
  const { annee, trimestre } = req.query;
  const where = {};
  const range = buildDateRange(annee, trimestre);
  if (range) where.dateEncaissement = range;

  const items = await prisma.revenuMalt.findMany({ where, orderBy: { dateEncaissement: 'desc' } });
  res.json(items.map(serialize));
}));

// POST /api/revenus-malt
router.post('/', validate(createSchema, 'body'), asyncHandler(async (req, res) => {
  const { dateEncaissement, montantNet, description } = req.body;
  const item = await prisma.revenuMalt.create({
    data: { dateEncaissement: new Date(dateEncaissement), montantNet, description: description || null },
  });
  res.status(201).json(serialize(item));
}));

// DELETE /api/revenus-malt/:id
router.delete('/:id', asyncHandler(async (req, res) => {
  const id = parseInt(req.params.id, 10);
  const found = await prisma.revenuMalt.findUnique({ where: { id } });
  if (!found) throw ApiError.notFound('Revenu Malt introuvable');
  await prisma.revenuMalt.delete({ where: { id } });
  res.json({ ok: true });
}));

// POST /api/revenus-malt/import-csv — frontend parses CSV, sends JSON lines.
router.post('/import-csv', validate(importSchema, 'body'), asyncHandler(async (req, res) => {
  const { lignes } = req.body;
  const result = await prisma.revenuMalt.createMany({
    data: lignes.map((l) => ({
      dateEncaissement: new Date(l.dateEncaissement),
      montantNet: l.montantNet,
      description: l.description || null,
    })),
  });
  res.status(201).json({ created: result.count });
}));

export default router;
