// Authentication routes for the single-user app.
import { Router } from 'express';
import bcrypt from 'bcryptjs';
import { z } from 'zod';
import prisma from '../config/prisma.js';
import asyncHandler from '../utils/asyncHandler.js';
import { validate } from '../middleware/validate.js';
import { requireAuth, signToken } from '../middleware/auth.js';
import ApiError from '../utils/ApiError.js';

const router = Router();

const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
});

router.post(
  '/login',
  validate(loginSchema),
  asyncHandler(async (req, res) => {
    const { email, password } = req.body;
    const user = await prisma.user.findUnique({ where: { email } });
    if (!user || !(await bcrypt.compare(password, user.passwordHash))) {
      throw ApiError.unauthorized('Identifiants invalides');
    }
    const token = signToken(user);
    res.json({ token, user: { id: user.id, email: user.email } });
  }),
);

// Returns the current user; also used by the frontend to validate a stored token.
router.get('/me', requireAuth, (req, res) => {
  res.json({ user: req.user });
});

export default router;
