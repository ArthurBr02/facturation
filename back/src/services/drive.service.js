// Google Drive storage service.
//
// Finalised PDFs are stored on Drive under a logical tree:
//   Facturation/{type}/{year}/{month}/{numero}.pdf
// Folders are created on demand (and cached) under a configured root folder.
//
// Auth strategy (in priority order):
//   1. OAuth2 user credentials (GOOGLE_CLIENT_ID + GOOGLE_CLIENT_SECRET + GOOGLE_REFRESH_TOKEN)
//      → files are owned by the user, quota counts against their Drive. Preferred for personal use.
//   2. Service account (GOOGLE_APPLICATION_CREDENTIALS)
//      → only works with Shared Drives (Google Workspace). Fails on personal Drive.
//
// When DRIVE_ENABLED=false (local/dev), uploads throw a clear error so the
// caller enqueues them in the upload queue instead — exercising the retry path.
import fs from 'node:fs';
import path from 'node:path';
import { google } from 'googleapis';
import env from '../config/env.js';
import logger from '../utils/logger.js';

const folderCache = new Map(); // "parentId/name" -> folderId
const folderInFlight = new Map(); // "parentId/name" -> Promise (dedup concurrent calls)

let driveClient = null;

function getDrive() {
  if (driveClient) return driveClient;

  // OAuth2 user credentials take priority (works with personal Drive)
  if (env.drive.clientId && env.drive.clientSecret && env.drive.refreshToken) {
    const auth = new google.auth.OAuth2(env.drive.clientId, env.drive.clientSecret);
    auth.setCredentials({ refresh_token: env.drive.refreshToken });
    driveClient = google.drive({ version: 'v3', auth });
    logger.info('[drive] using OAuth2 user credentials');
    return driveClient;
  }

  // Fallback: service account (requires Shared Drive)
  if (!env.drive.credentialsPath || !fs.existsSync(env.drive.credentialsPath)) {
    throw new Error('Aucun credential Google Drive configuré (OAuth2 ou compte de service).');
  }
  const auth = new google.auth.GoogleAuth({
    keyFile: env.drive.credentialsPath,
    scopes: ['https://www.googleapis.com/auth/drive'],
  });
  driveClient = google.drive({ version: 'v3', auth });
  logger.info('[drive] using service account credentials');
  return driveClient;
}

/** Find or create a subfolder named `name` under `parentId`. Cached per process. */
async function ensureFolder(name, parentId) {
  const cacheKey = `${parentId}/${name}`;
  if (folderCache.has(cacheKey)) return folderCache.get(cacheKey);

  // Deduplicate concurrent calls for the same folder to avoid Drive duplicates
  if (folderInFlight.has(cacheKey)) return folderInFlight.get(cacheKey);

  const promise = (async () => {
    const drive = getDrive();
    const q = [
      `name='${name.replace(/'/g, "\\'")}'`,
      "mimeType='application/vnd.google-apps.folder'",
      `'${parentId}' in parents`,
      'trashed=false',
    ].join(' and ');

    const { data } = await drive.files.list({ q, fields: 'files(id,name)', spaces: 'drive' });
    let id = data.files?.[0]?.id;
    if (!id) {
      const created = await drive.files.create({
        requestBody: { name, mimeType: 'application/vnd.google-apps.folder', parents: [parentId] },
        fields: 'id',
      });
      id = created.data.id;
    }
    folderCache.set(cacheKey, id);
    folderInFlight.delete(cacheKey);
    return id;
  })();

  folderInFlight.set(cacheKey, promise);
  return promise;
}

/** Ensure every segment of a logical path exists, return the deepest folder id. */
async function ensurePath(segments) {
  let parent = env.drive.rootFolderId;
  if (!parent) throw new Error('GOOGLE_DRIVE_ROOT_FOLDER_ID non configuré.');
  for (const seg of segments) {
    parent = await ensureFolder(seg, parent);
  }
  return parent;
}

/**
 * Upload a local file to Drive at the given logical path.
 * @param {string} localFilePath absolute path to the file on disk
 * @param {string} drivePath logical path, e.g. "Facturation/factures/2026/06/FAC-2026-001.pdf"
 * @returns {Promise<{ fileId: string }>}
 */
export async function uploadFile(localFilePath, drivePath) {
  if (!env.drive.enabled) {
    throw new Error('Google Drive désactivé (DRIVE_ENABLED=false).');
  }
  const drive = getDrive();
  const segments = drivePath.split('/').filter(Boolean);
  const fileName = segments.pop();
  const folderId = await ensurePath(segments);

  const { data } = await drive.files.create({
    requestBody: { name: fileName, parents: [folderId] },
    media: { mimeType: 'application/pdf', body: fs.createReadStream(localFilePath) },
    fields: 'id',
  });
  logger.info(`[drive] uploaded ${drivePath} (id=${data.id})`);
  return { fileId: data.id };
}

/** Build the logical Drive path for a document PDF. */
export function buildDrivePath(type, numero, date = new Date()) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  return `Facturation/${type}/${year}/${month}/${numero}.pdf`;
}

/** Drive path for a database backup dump. */
export function buildBackupDrivePath(fileName) {
  return `Facturation/backups/${path.basename(fileName)}`;
}

export default { uploadFile, buildDrivePath, buildBackupDrivePath };
