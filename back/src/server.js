// HTTP server bootstrap: starts Express, schedules background jobs, and handles
// graceful shutdown.
import app from './app.js';
import env from './config/env.js';
import logger from './utils/logger.js';
import prisma from './config/prisma.js';
import { startJobs } from './workers/jobs.js';

const server = app.listen(env.port, () => {
  logger.info(`API listening on http://localhost:${env.port} (${env.nodeEnv})`);
  startJobs();
});

async function shutdown(signal) {
  logger.info(`${signal} received — shutting down`);
  server.close(async () => {
    await prisma.$disconnect();
    process.exit(0);
  });
}

process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT', () => shutdown('SIGINT'));
