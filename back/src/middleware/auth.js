// JWT authentication for the single-user app. Expects an
// `Authorization: Bearer <token>` header.
import jwt from 'jsonwebtoken';
import env from '../config/env.js';
import ApiError from '../utils/ApiError.js';

export function signToken(user) {
  return jwt.sign({ sub: user.id, email: user.email }, env.auth.jwtSecret, {
    expiresIn: env.auth.jwtExpiresIn,
  });
}

export function requireAuth(req, res, next) {
  const header = req.headers.authorization || '';
  const token = header.startsWith('Bearer ') ? header.slice(7) : null;
  if (!token) return next(ApiError.unauthorized());

  try {
    const payload = jwt.verify(token, env.auth.jwtSecret);
    req.user = { id: payload.sub, email: payload.email };
    return next();
  } catch {
    return next(ApiError.unauthorized('Token invalide ou expiré'));
  }
}
