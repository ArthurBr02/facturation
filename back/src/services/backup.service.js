// PostgreSQL backup service.
//
// Dumps the database with pg_dump, gzips it, and pushes it to Drive under
// Facturation/backups/. Triggered weekly by a cron and on demand via the admin
// endpoint. An alert e-mail is sent on failure.
import fs from 'node:fs';
import path from 'node:path';
import { spawn } from 'node:child_process';
import zlib from 'node:zlib';
import { pipeline } from 'node:stream/promises';
import env from '../config/env.js';
import logger from '../utils/logger.js';
import driveService from './drive.service.js';
import { enqueueUpload } from './uploadQueue.service.js';
import { sendAlert } from './mail.service.js';

const backupDir = path.join(env.storage.root, 'backups');

function stamp() {
  return new Date().toISOString().slice(0, 10); // AAAA-MM-JJ
}

/** Strip Prisma-only query params (e.g. ?schema=public) that pg_dump rejects. */
function pgConnString(url) {
  try {
    const u = new URL(url);
    u.search = ''; // pg_dump doesn't accept ?schema=public
    return u.toString();
  } catch {
    return url;
  }
}

/** Run pg_dump into a plain SQL file. Returns the file path. */
function runPgDump(sqlPath) {
  return new Promise((resolve, reject) => {
    const out = fs.createWriteStream(sqlPath);
    const child = spawn('pg_dump', ['--no-owner', '--no-privileges', pgConnString(env.databaseUrl)], {
      stdio: ['ignore', 'pipe', 'pipe'],
    });
    let stderr = '';
    child.stdout.pipe(out);
    child.stderr.on('data', (d) => {
      stderr += d.toString();
    });
    child.on('error', reject);
    child.on('close', (code) => {
      out.close();
      if (code === 0) resolve(sqlPath);
      else reject(new Error(`pg_dump exited with code ${code}: ${stderr}`));
    });
  });
}

async function gzip(srcPath, destPath) {
  await pipeline(fs.createReadStream(srcPath), zlib.createGzip(), fs.createWriteStream(destPath));
}

/**
 * Create a compressed DB backup and queue it for upload to Drive.
 * @returns {Promise<{ file: string, drivePath: string }>}
 */
export async function runBackup() {
  fs.mkdirSync(backupDir, { recursive: true });
  const base = `backup-${stamp()}.sql`;
  const sqlPath = path.join(backupDir, base);
  const gzPath = `${sqlPath}.gz`;

  try {
    await runPgDump(sqlPath);
    await gzip(sqlPath, gzPath);
    fs.unlinkSync(sqlPath); // keep only the compressed file locally
    const drivePath = driveService.buildBackupDrivePath(`${base}.gz`);
    await enqueueUpload({ filePath: gzPath, drivePath, documentType: 'backup', documentId: null });
    logger.info(`[backup] created ${gzPath} -> ${drivePath}`);
    return { file: gzPath, drivePath };
  } catch (err) {
    logger.error('[backup] failed:', err.message);
    await sendAlert('Échec de la sauvegarde de la base', `La sauvegarde PostgreSQL a échoué :\n\n${err.message}`);
    throw err;
  }
}

export default { runBackup };
