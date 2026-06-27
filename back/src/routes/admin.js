// Administration routes: manual DB backup + upload-queue inspection.
import { Router } from 'express';
import asyncHandler from '../utils/asyncHandler.js';
import { runBackup } from '../services/backup.service.js';
import { listQueue, processPending } from '../services/uploadQueue.service.js';

const router = Router();

// POST /api/admin/backup — force a DB dump + Drive upload now.
router.post(
  '/backup',
  asyncHandler(async (req, res) => {
    const result = await runBackup();
    res.json({ ok: true, ...result });
  }),
);

// GET /api/admin/upload-queue — list queue items (optional ?status=).
router.get(
  '/upload-queue',
  asyncHandler(async (req, res) => {
    const items = await listQueue(req.query.status);
    res.json(items);
  }),
);

// POST /api/admin/upload-queue/retry — trigger a retry pass immediately.
router.post(
  '/upload-queue/retry',
  asyncHandler(async (req, res) => {
    const result = await processPending();
    res.json(result);
  }),
);

export default router;
