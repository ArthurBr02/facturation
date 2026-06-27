// Global encaissements list (read-only). Payments are created/deleted through
// the facture routes; this endpoint feeds the cash-in view and the seuils.
import { Router } from 'express';
import { z } from 'zod';
import prisma from '../config/prisma.js';
import asyncHandler from '../utils/asyncHandler.js';
import { validate } from '../middleware/validate.js';

const router = Router();

const listQuerySchema = z.object({ annee: z.coerce.number().int().optional() });
const exportQuerySchema = z.object({ annee: z.coerce.number().int().optional() });

// GET /api/encaissements/export-csv — CSV export of all payments.
router.get(
  '/export-csv',
  validate(exportQuerySchema, 'query'),
  asyncHandler(async (req, res) => {
    const { annee } = req.query;
    const where = {};
    if (annee) {
      where.dateEncaissement = {
        gte: new Date(Date.UTC(annee, 0, 1)),
        lt: new Date(Date.UTC(annee + 1, 0, 1)),
      };
    }
    const items = await prisma.encaissement.findMany({
      where,
      include: { facture: { include: { client: true } } },
      orderBy: { dateEncaissement: 'asc' },
    });

    const dateF = (d) => new Date(d).toLocaleDateString('fr-FR');
    const header = 'Date;Facture;Client;Moyen;Référence;Montant\n';
    const rows = items
      .map(
        (e) =>
          `${dateF(e.dateEncaissement)};${e.facture.numero || ''};${e.facture.client?.nom || ''};${e.moyen};${e.reference || ''};${Number(e.montant).toFixed(2)}`,
      )
      .join('\n');

    const filename = annee ? `encaissements-${annee}.csv` : 'encaissements.csv';
    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.send('﻿' + header + rows);
  }),
);

// GET /api/encaissements — most recent first, with facture + client context.
router.get(
  '/',
  validate(listQuerySchema, 'query'),
  asyncHandler(async (req, res) => {
    const { annee } = req.query;
    const where = {};
    if (annee) {
      where.dateEncaissement = {
        gte: new Date(Date.UTC(annee, 0, 1)),
        lt: new Date(Date.UTC(annee + 1, 0, 1)),
      };
    }
    const items = await prisma.encaissement.findMany({
      where,
      include: { facture: { include: { client: true } } },
      orderBy: { dateEncaissement: 'desc' },
    });
    res.json(
      items.map((e) => ({
        id: e.id,
        dateEncaissement: e.dateEncaissement,
        montant: Number(e.montant),
        moyen: e.moyen,
        reference: e.reference,
        facture: {
          id: e.facture.id,
          numero: e.facture.numero,
          client: e.facture.client ? { id: e.facture.client.id, nom: e.facture.client.nom } : null,
        },
      })),
    );
  }),
);

export default router;
