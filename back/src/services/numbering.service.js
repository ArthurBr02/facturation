// Sequential numbering service.
//
// Legal requirement: invoice/credit-note numbers must form a continuous series
// with no gaps and no duplicates. The number is therefore allocated by the API
// at finalisation time, inside the SAME database transaction as the document,
// using a row-level lock on the per-(year, series) counter.
//
// Usage from a finalisation flow:
//   await prisma.$transaction(async (tx) => {
//     const numero = await allocateNumber(tx, 'FAC');
//     await tx.facture.update({ where: { id }, data: { numero, verrouillee: true } });
//   });
import prisma from '../config/prisma.js';

const SERIES = ['DEV', 'AVE', 'FAC', 'AVO', 'MNT'];

function format(serie, annee, numero) {
  return `${serie}-${annee}-${String(numero).padStart(3, '0')}`;
}

/**
 * Allocate the next number for a series within a transaction.
 * @param {import('@prisma/client').Prisma.TransactionClient} tx
 * @param {'DEV'|'AVE'|'FAC'|'AVO'|'MNT'} serie
 * @param {number} [annee] defaults to the current year
 * @returns {Promise<string>} formatted number, e.g. "FAC-2026-001"
 */
export async function allocateNumber(tx, serie, annee = new Date().getFullYear()) {
  if (!SERIES.includes(serie)) {
    throw new Error(`Série de numérotation inconnue : ${serie}`);
  }

  // Atomic read-modify-write. The counter row is created at 1 on first use, or
  // incremented otherwise. Postgres serialises concurrent upserts on the PK,
  // so two finalisations can never receive the same number.
  const counter = await tx.numberCounter.upsert({
    where: { annee_serie: { annee, serie } },
    create: { annee, serie, dernierNumero: 1 },
    update: { dernierNumero: { increment: 1 } },
  });

  return format(serie, annee, counter.dernierNumero);
}

/**
 * Peek at the next number that WOULD be allocated, without consuming it.
 * For previews only — never use this to actually number a document.
 */
export async function peekNextNumber(serie, annee = new Date().getFullYear()) {
  const counter = await prisma.numberCounter.findUnique({
    where: { annee_serie: { annee, serie } },
  });
  const next = (counter?.dernierNumero || 0) + 1;
  return format(serie, annee, next);
}

export default { allocateNumber, peekNextNumber };
