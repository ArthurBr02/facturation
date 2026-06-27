// Resilient Drive upload queue.
//
// Every finalised PDF is enqueued here. We attempt an immediate upload; on
// failure the item stays in the queue (status pending/failed) and a background
// worker retries it. After UPLOAD_MAX_ATTEMPTS, an alert e-mail is sent.
import prisma from '../config/prisma.js';
import env from '../config/env.js';
import logger from '../utils/logger.js';
import driveService from './drive.service.js';
import { sendAlert, uploadFailureMessage } from './mail.service.js';

/**
 * Enqueue a file and attempt an immediate upload.
 * @returns the queue row (status 'done' on success, otherwise 'pending'/'failed').
 */
export async function enqueueUpload({ filePath, drivePath, documentType, documentId }) {
  const item = await prisma.uploadQueue.create({
    data: { filePath, drivePath, documentType, documentId, status: 'pending' },
  });
  return attemptUpload(item);
}

/** Try to upload a single queue item, updating its status/attempts. */
export async function attemptUpload(item) {
  try {
    const { fileId } = await driveService.uploadFile(item.filePath, item.drivePath);
    return prisma.uploadQueue.update({
      where: { id: item.id },
      data: { status: 'done', driveFileId: fileId, errorMessage: null, lastAttempt: new Date(), attempts: { increment: 1 } },
    });
  } catch (err) {
    const attempts = item.attempts + 1;
    const exhausted = attempts >= env.jobs.uploadMaxAttempts;
    const updated = await prisma.uploadQueue.update({
      where: { id: item.id },
      data: {
        status: exhausted ? 'failed' : 'pending',
        attempts,
        lastAttempt: new Date(),
        errorMessage: err.message,
      },
    });
    logger.warn(`[upload-queue] attempt ${attempts} failed for ${item.drivePath}: ${err.message}`);
    if (exhausted) {
      await sendAlert(
        `Échec d'envoi vers Drive : ${item.drivePath}`,
        uploadFailureMessage({ fileName: item.filePath, drivePath: item.drivePath, error: err.message, attempts }),
      );
    }
    return updated;
  }
}

/** Retry every item still pending or failed. Called by the worker on a cron. */
export async function processPending() {
  const items = await prisma.uploadQueue.findMany({
    where: { status: { in: ['pending', 'failed'] }, attempts: { lt: env.jobs.uploadMaxAttempts } },
    orderBy: { createdAt: 'asc' },
    take: 50,
  });
  if (items.length === 0) return { processed: 0 };
  logger.info(`[upload-queue] retrying ${items.length} item(s)`);
  let ok = 0;
  for (const item of items) {
    const res = await attemptUpload(item);
    if (res.status === 'done') ok += 1;
  }
  return { processed: items.length, succeeded: ok };
}

export function listQueue(status) {
  return prisma.uploadQueue.findMany({
    where: status ? { status } : undefined,
    orderBy: { createdAt: 'desc' },
    take: 200,
  });
}

export default { enqueueUpload, attemptUpload, processPending, listQueue };
