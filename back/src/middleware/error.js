// Central error handler. Converts ApiError, Zod and Prisma errors into clean
// JSON. Must be registered last, after all routes.
import { ZodError } from 'zod';
import ApiError from '../utils/ApiError.js';
import logger from '../utils/logger.js';

export function notFoundHandler(req, res) {
  res.status(404).json({ error: 'Route introuvable', path: req.originalUrl });
}

// eslint-disable-next-line no-unused-vars
export function errorHandler(err, req, res, next) {
  if (err instanceof ZodError) {
    return res.status(400).json({
      error: 'Données invalides',
      details: err.errors.map((e) => ({ path: e.path.join('.'), message: e.message })),
    });
  }

  if (err instanceof ApiError) {
    return res.status(err.status).json({ error: err.message, details: err.details });
  }

  // Prisma unique-constraint violation.
  if (err.code === 'P2002') {
    return res.status(409).json({
      error: 'Conflit : une ressource avec ces valeurs existe déjà.',
      details: err.meta?.target,
    });
  }
  // Prisma record-not-found.
  if (err.code === 'P2025') {
    return res.status(404).json({ error: 'Ressource introuvable' });
  }

  logger.error('Unhandled error:', err);
  res.status(500).json({ error: 'Erreur interne du serveur' });
}
