// PDF generation service (HTML -> PDF via Puppeteer/Chromium).
//
// Phase 0 provides the generic rendering primitive and a temp-file helper.
// The actual document templates (facture, devis…) reuse models/facture.html and
// are wired up in later phases. Keeping a single launch path here means the
// Factur-X (PDF/A-3) switch in the final phase touches only this file.
import fs from 'node:fs';
import path from 'node:path';
import puppeteer from 'puppeteer';
import env from '../config/env.js';
import logger from '../utils/logger.js';

const tmpDir = path.join(env.storage.root, 'tmp');

function ensureTmpDir() {
  fs.mkdirSync(tmpDir, { recursive: true });
}

/** Render an HTML string to a PDF Buffer (A4, print backgrounds on). */
export async function renderHtmlToPdf(html) {
  const browser = await puppeteer.launch({
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox'],
    executablePath: process.env.PUPPETEER_EXECUTABLE_PATH || undefined,
  });
  try {
    const page = await browser.newPage();
    await page.setContent(html, { waitUntil: 'networkidle0' });
    const pdf = await page.pdf({
      format: 'A4',
      printBackground: true,
      margin: { top: '14mm', right: '14mm', bottom: '14mm', left: '14mm' },
    });
    return Buffer.from(pdf);
  } finally {
    await browser.close();
  }
}

/** Render HTML and write the PDF to a temporary file, returning its path. */
export async function renderToTempFile(html, fileName) {
  ensureTmpDir();
  const pdf = await renderHtmlToPdf(html);
  const filePath = path.join(tmpDir, fileName);
  fs.writeFileSync(filePath, pdf);
  logger.info(`[pdf] generated ${filePath} (${pdf.length} bytes)`);
  return filePath;
}

export default { renderHtmlToPdf, renderToTempFile };
