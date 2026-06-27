// Storage + Drive upload of client-signed PDFs.
//
// A signed PDF is the version returned by the client (scan or e-signed). It is
// stored under storage/signes/{folder}/ and queued for Drive upload next to the
// generated PDF, using a distinct "-signe.pdf" name so it never overwrites it.
import fs from 'node:fs';
import path from 'node:path';
import env from '../config/env.js';
import logger from '../utils/logger.js';
import { enqueueUpload } from './uploadQueue.service.js';

/**
 * Persist a base64 signed PDF and enqueue it for Drive.
 * @param {object} p
 * @param {string} p.type        logical type (devis|avenant|facture|avoir|contrat) — used for log + queue tag
 * @param {string} p.folder      storage subfolder + Drive folder (e.g. 'devis', 'factures', 'contrats')
 * @param {string} [p.numero]    document number (used in the file name)
 * @param {string} p.fallbackName name used when numero is missing
 * @param {number} p.documentId
 * @param {string} p.base64
 * @param {Date|string} [p.date] date driving the Drive year/month folders
 * @returns {Promise<string>} absolute file path
 */
export async function storeSignedPdf({ type, folder, numero, fallbackName, documentId, base64, date }) {
  if (!base64) throw new Error('Champ data (base64) requis');
  const buf = Buffer.from(base64, 'base64');
  const dir = path.join(env.storage.root, 'signes', folder);
  fs.mkdirSync(dir, { recursive: true });
  const safeNum = numero || fallbackName;
  const filePath = path.join(dir, `${safeNum}-signe.pdf`);
  fs.writeFileSync(filePath, buf);
  logger.info(`[${type}] signed PDF stored ${filePath} (${buf.length} bytes)`);

  const d = date ? new Date(date) : new Date();
  const year = String(d.getFullYear());
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const drivePath = `Facturation/${folder}/${year}/${month}/${safeNum}-signe.pdf`;
  await enqueueUpload({ filePath, drivePath, documentType: `${type}-signe`, documentId });
  return filePath;
}

export default { storeSignedPdf };
