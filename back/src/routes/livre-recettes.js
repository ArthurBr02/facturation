// Livre des recettes — mandatory register for micro-entrepreneurs (art. 50-0 CGI).
// Combines encaissements (from invoices) and revenus Malt, sorted by date.
// Exports: JSON list, CSV, PDF.
// Phase 4 — Sprint 4.4.
import { Router } from 'express';
import { z } from 'zod';
import prisma from '../config/prisma.js';
import asyncHandler from '../utils/asyncHandler.js';
import { validate } from '../middleware/validate.js';
import { renderHtmlToPdf } from '../services/pdf.service.js';
import { renderLivreRecettes } from '../templates/livreRecettesHtml.js';

const router = Router();

const listQuery = z.object({ annee: z.coerce.number().int().optional() });

async function buildLignes(annee) {
  const range = annee
    ? { gte: new Date(Date.UTC(annee, 0, 1)), lt: new Date(Date.UTC(annee + 1, 0, 1)) }
    : undefined;

  const [encaissements, revenus] = await Promise.all([
    prisma.encaissement.findMany({
      where: range ? { dateEncaissement: range } : {},
      include: {
        facture: {
          include: { client: { select: { nom: true } }, lignes: { take: 1, orderBy: { ordre: 'asc' } } },
        },
      },
      orderBy: { dateEncaissement: 'asc' },
    }),
    prisma.revenuMalt.findMany({
      where: range ? { dateEncaissement: range } : {},
      orderBy: { dateEncaissement: 'asc' },
    }),
  ]);

  const lignesEnc = encaissements.map((e) => ({
    date: e.dateEncaissement,
    reference: e.facture.numero || `Facture #${e.facture.id}`,
    client: e.facture.client?.nom || null,
    nature: e.facture.objet || e.facture.lignes[0]?.designation || 'Prestation de service',
    montant: Number(e.montant),
    source: 'encaissement',
  }));

  const lignesMalt = revenus.map((r) => ({
    date: r.dateEncaissement,
    reference: 'Malt',
    client: null,
    nature: r.description || 'Mission Malt',
    montant: Number(r.montantNet),
    source: 'malt',
  }));

  return [...lignesEnc, ...lignesMalt].sort((a, b) => new Date(a.date) - new Date(b.date));
}

async function getEmetteur() {
  const keys = ['emetteur.nom', 'emetteur.siret', 'emetteur.adresse1', 'emetteur.cp', 'emetteur.ville'];
  const settings = await prisma.appSetting.findMany({ where: { cle: { in: keys } } });
  return Object.fromEntries(settings.map((s) => [s.cle.replace('emetteur.', ''), s.valeur]));
}

// GET /api/livre-recettes?annee=YYYY
router.get('/', validate(listQuery, 'query'), asyncHandler(async (req, res) => {
  const annee = req.query.annee ? Number(req.query.annee) : null;
  const lignes = await buildLignes(annee);
  const total = lignes.reduce((s, l) => s + l.montant, 0);
  res.json({ annee, lignes, total, count: lignes.length });
}));

// GET /api/livre-recettes/export/csv?annee=YYYY
router.get('/export/csv', validate(listQuery, 'query'), asyncHandler(async (req, res) => {
  const annee = req.query.annee ? Number(req.query.annee) : null;
  const lignes = await buildLignes(annee);

  const dateF = (d) => new Date(d).toLocaleDateString('fr-FR');
  const header = 'Date;Référence;Client;Nature;Montant\n';
  const rows = lignes
    .map((l) => `${dateF(l.date)};${l.reference};${l.client || ''};${l.nature.replace(/;/g, ',')};${l.montant.toFixed(2)}`)
    .join('\n');

  const filename = annee ? `livre-recettes-${annee}.csv` : 'livre-recettes.csv';
  res.setHeader('Content-Type', 'text/csv; charset=utf-8');
  res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
  res.send('﻿' + header + rows); // BOM for Excel
}));

// GET /api/livre-recettes/export/pdf?annee=YYYY
router.get('/export/pdf', validate(listQuery, 'query'), asyncHandler(async (req, res) => {
  const annee = req.query.annee ? Number(req.query.annee) : new Date().getFullYear();
  const [lignes, emetteur] = await Promise.all([buildLignes(annee), getEmetteur()]);

  const html = renderLivreRecettes({ annee, emetteur, lignes });
  const pdf = await renderHtmlToPdf(html);

  res.setHeader('Content-Type', 'application/pdf');
  res.setHeader('Content-Disposition', `inline; filename="livre-recettes-${annee}.pdf"`);
  res.send(pdf);
}));

export default router;
