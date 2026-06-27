// Facture domain helpers: Decimal->Number serialization and money math.
//
// Prisma returns Decimal objects for money columns; the API exposes plain
// numbers to the frontend. Statut derivation (payee/partielle) lives here too
// so it stays consistent between the list and the encaissement endpoints.
import fs from 'node:fs';
import path from 'node:path';
import prisma from '../config/prisma.js';
import env from '../config/env.js';
import logger from '../utils/logger.js';
import { renderHtmlToPdf } from './pdf.service.js';
import { enqueueUpload } from './uploadQueue.service.js';
import { renderFactureHtml } from '../templates/factureHtml.js';
import { getCustomHtmlForType, renderCustomDocument } from './customTemplate.service.js';

async function renderFactureOrCustom(snap) {
  const customHtml = await getCustomHtmlForType('facture');
  if (customHtml) return renderCustomDocument(customHtml, snap, 'facture');
  return renderFactureHtml(snap);
}

/**
 * Render a finalised facture's PDF from its frozen snapshot, store it as an
 * immutable local file, persist the path and enqueue it for Google Drive.
 * Called AFTER finalisation commits, so a render failure never voids the
 * (already legal) numbering — the PDF can simply be regenerated later.
 * @returns {Promise<string>} stored file path
 */
export async function generateFacturePdf(facture) {
  if (!facture.snapshot) throw new Error('Facture sans snapshot — PDF impossible');
  const pdf = await renderHtmlToPdf(await renderFactureOrCustom(facture.snapshot));

  const isAvoir = facture.type === 'avoir';
  const folder = isAvoir ? 'avoirs' : 'factures';
  const d = new Date(facture.dateEmission);
  const year = String(d.getFullYear());
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const dir = path.join(env.storage.root, folder, year, month);
  fs.mkdirSync(dir, { recursive: true });
  const filePath = path.join(dir, `${facture.numero}.pdf`);
  fs.writeFileSync(filePath, pdf);
  logger.info(`[facture] PDF stored ${filePath} (${pdf.length} bytes)`);

  await prisma.facture.update({ where: { id: facture.id }, data: { pdfPath: filePath } });

  const drivePath = `Facturation/${folder}/${year}/${month}/${facture.numero}.pdf`;
  await enqueueUpload({ filePath, drivePath, documentType: isAvoir ? 'avoir' : 'facture', documentId: facture.id });
  return filePath;
}

/** Read all `emetteur.*` settings as a flat dict keyed by short name (siret, iban…). */
export async function getEmetteurDict() {
  const rows = await prisma.appSetting.findMany({ where: { cle: { startsWith: 'emetteur.' } } });
  const dict = {};
  for (const r of rows) dict[r.cle.replace('emetteur.', '')] = r.valeur ?? '';
  return dict;
}

/**
 * Build the immutable snapshot frozen on a facture at finalisation. It captures
 * émetteur + client + mentions + lines so the PDF stays reproducible even if the
 * settings or the client are edited later.
 * @param {object} facture full facture with `lignes`, `client`, `factureOrigine`
 * @param {object} em émetteur dict from getEmetteurDict()
 */
export function buildSnapshot(facture, em) {
  const cl = facture.client || {};
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
    facture: {
      numero: facture.numero,
      type: facture.type,
      dateEmission: facture.dateEmission,
      dateEcheance: facture.dateEcheance,
      dateExecutionDebut: facture.dateExecutionDebut,
      dateExecutionFin: facture.dateExecutionFin,
      bonCommande: facture.bonCommande,
      conditionsReglement: facture.conditionsReglement,
      objet: facture.objet,
      factureOrigineNumero: facture.factureOrigine?.numero || null,
    },
    lignes: (facture.lignes || []).map((l) => ({
      designation: l.designation,
      quantite: Number(l.quantite),
      prixUnitaire: Number(l.prixUnitaire),
      montant: Number(l.quantite) * Number(l.prixUnitaire),
    })),
    totalHt: Number(facture.totalHt),
  };
}

/** Total already paid against a facture (sum of its encaissements). */
export function paidAmount(facture) {
  return (facture.encaissements || []).reduce((sum, e) => sum + Number(e.montant || 0), 0);
}

/**
 * Status a finalised facture should have given what has been paid.
 * Drafts keep `brouillon`. Avoirs are never "paid" through encaissements.
 * @returns {'finalisee'|'partielle'|'payee'}
 */
export function deriveStatut(facture, paid) {
  const total = Number(facture.totalHt || 0);
  if (paid <= 0) return 'finalisee';
  if (paid + 0.005 >= total) return 'payee';
  return 'partielle';
}

/** Convert a Prisma facture (with relations) into a plain JSON payload. */
export function serializeFacture(f) {
  const lignes = (f.lignes || []).map((l) => ({
    id: l.id,
    designation: l.designation,
    quantite: Number(l.quantite),
    prixUnitaire: Number(l.prixUnitaire),
    montant: Number(l.quantite) * Number(l.prixUnitaire),
    ordre: l.ordre,
  }));
  const encaissements = (f.encaissements || []).map((e) => ({
    id: e.id,
    dateEncaissement: e.dateEncaissement,
    montant: Number(e.montant),
    moyen: e.moyen,
    reference: e.reference,
  }));
  const totalHt = Number(f.totalHt);
  const paye = paidAmount(f);
  return {
    id: f.id,
    numero: f.numero,
    type: f.type,
    statut: f.statut,
    clientId: f.clientId,
    client: f.client ? { id: f.client.id, nom: f.client.nom, denomination: f.client.denomination } : null,
    devisId: f.devisId,
    contratId: f.contratId,
    factureOrigineId: f.factureOrigineId,
    factureOrigine: f.factureOrigine ? { id: f.factureOrigine.id, numero: f.factureOrigine.numero } : undefined,
    avoirs: f.avoirs ? f.avoirs.map((a) => ({ id: a.id, numero: a.numero })) : undefined,
    dateEmission: f.dateEmission,
    dateExecutionDebut: f.dateExecutionDebut,
    dateExecutionFin: f.dateExecutionFin,
    dateEcheance: f.dateEcheance,
    bonCommande: f.bonCommande,
    conditionsReglement: f.conditionsReglement,
    objet: f.objet,
    notes: f.notes,
    totalHt,
    paye,
    reste: Math.max(totalHt - paye, 0),
    verrouillee: f.verrouillee,
    hasPdf: Boolean(f.pdfPath),
    finaliseeAt: f.finaliseeAt,
    createdAt: f.createdAt,
    updatedAt: f.updatedAt,
    lignes,
    encaissements,
  };
}

export default {
  paidAmount,
  deriveStatut,
  serializeFacture,
  getEmetteurDict,
  buildSnapshot,
  generateFacturePdf,
};
