// Mounts every API route under /api. Public routes (health, auth/login) are
// registered before the auth guard; everything after requires a valid token.
import { Router } from 'express';
import { requireAuth } from '../middleware/auth.js';
import healthRoutes from './health.js';
import authRoutes from './auth.js';
import clientsRoutes from './clients.js';
import settingsRoutes from './settings.js';
import templatesRoutes from './templates.js';
import facturesRoutes from './factures.js';
import encaissementsRoutes from './encaissements.js';
import dashboardRoutes from './dashboard.js';
import adminRoutes from './admin.js';
import produitsRoutes from './produits.js';
import devisRoutes from './devis.js';
import avenantsRoutes from './avenants.js';
import contratsRoutes from './contrats.js';
import revenusMaltRoutes from './revenus-malt.js';
import urssafRoutes from './urssaf.js';
import livreRecettesRoutes from './livre-recettes.js';

const router = Router();

// --- Public ---
router.use('/', healthRoutes); // /api/health, /api/hello
router.use('/auth', authRoutes); // /api/auth/login is public; /me is guarded internally

// --- Protected ---
router.use(requireAuth);
router.use('/clients', clientsRoutes);
router.use('/settings', settingsRoutes);
router.use('/templates', templatesRoutes);
router.use('/factures', facturesRoutes);
router.use('/encaissements', encaissementsRoutes);
router.use('/dashboard', dashboardRoutes);
router.use('/admin', adminRoutes);
router.use('/produits', produitsRoutes);
router.use('/devis', devisRoutes);
router.use('/avenants', avenantsRoutes);
router.use('/contrats', contratsRoutes);
router.use('/revenus-malt', revenusMaltRoutes);
router.use('/urssaf', urssafRoutes);
router.use('/livre-recettes', livreRecettesRoutes);

export default router;
