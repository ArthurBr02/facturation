// Health & "hello" routes — used by Docker healthchecks and the Sprint 0.1
// end-to-end check (Vue -> Express -> Postgres).
import { Router } from 'express';
import prisma from '../config/prisma.js';
import asyncHandler from '../utils/asyncHandler.js';

const router = Router();

// Liveness: process is up. No DB dependency so the container is reported healthy
// even while the DB is briefly unavailable.
router.get('/health', (req, res) => {
  res.json({ status: 'ok', uptime: process.uptime() });
});

// Connectivity check across the whole stack: queries Postgres and returns its time.
router.get('/hello', asyncHandler(async (req, res) => {
  const [row] = await prisma.$queryRaw`SELECT NOW() as now, version() as version`;
  res.json({
    message: 'Bonjour depuis l’API Facturation 👋',
    db: { connected: true, now: row.now, version: row.version },
  });
}));

export default router;
