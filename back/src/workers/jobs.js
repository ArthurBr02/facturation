// Background jobs: the upload-retry worker and the weekly DB backup. Scheduled
// with node-cron and started from server.js after the HTTP server is up.
import cron from 'node-cron';
import env from '../config/env.js';
import logger from '../utils/logger.js';
import { processPending } from '../services/uploadQueue.service.js';
import { runBackup } from '../services/backup.service.js';
import prisma from '../config/prisma.js';

// Generates draft maintenance invoices for all active contracts that don't yet
// have an invoice for the previous calendar month. Runs on the 1st of each month.
async function generateMaintenanceInvoices() {
  const now = new Date();
  const prev = new Date(now.getFullYear(), now.getMonth() - 1, 1);
  const annee = prev.getFullYear();
  const mois = prev.getMonth() + 1;

  const activeContracts = await prisma.contratMaintenance.findMany({
    where: { statut: 'actif' },
    include: { client: true },
  });

  let generated = 0;
  for (const contrat of activeContracts) {
    const alreadyDone = await prisma.periodeMaintenance.findUnique({
      where: { contratId_annee_mois: { contratId: contrat.id, annee, mois } },
    });
    if (alreadyDone) continue;

    try {
      const periodStart = new Date(Date.UTC(annee, mois - 1, 1));
      const periodEnd = new Date(Date.UTC(annee, mois, 1));
      const interventions = await prisma.intervention.findMany({
        where: { contratId: contrat.id, date: { gte: periodStart, lt: periodEnd } },
      });
      const heuresUtilisees = interventions.reduce((sum, i) => sum + Number(i.dureeH), 0);
      const heuresIncluses = Number(contrat.heuresIncluses);
      const depassement = Math.max(0, heuresUtilisees - heuresIncluses);

      const MOIS_FR = ['Janvier','Février','Mars','Avril','Mai','Juin','Juillet','Août','Septembre','Octobre','Novembre','Décembre'];
      const moisLabel = MOIS_FR[mois - 1];

      const lignes = [
        {
          designation: `Maintenance${contrat.titre ? ` — ${contrat.titre}` : ''} — ${moisLabel} ${annee}`,
          quantite: 1,
          prixUnitaire: Number(contrat.montantMensuel),
          ordre: 0,
        },
      ];
      if (depassement > 0 && Number(contrat.thmDepassement) > 0) {
        lignes.push({
          designation: `Heures supplémentaires (${depassement.toFixed(2)} h au-delà des ${heuresIncluses} h incluses)`,
          quantite: depassement,
          prixUnitaire: Number(contrat.thmDepassement),
          ordre: 1,
        });
      }
      const totalHt = lignes.reduce((s, l) => s + l.quantite * l.prixUnitaire, 0);

      const dateEmission = new Date();
      const delai = contrat.client?.conditionsPaiement || 30;
      const dateEcheance = new Date(dateEmission);
      dateEcheance.setDate(dateEcheance.getDate() + delai);

      await prisma.$transaction(async (tx) => {
        const facture = await tx.facture.create({
          data: {
            clientId: contrat.clientId,
            contratId: contrat.id,
            type: 'standard',
            statut: 'brouillon',
            dateEmission,
            dateEcheance,
            objet: `Maintenance — ${moisLabel} ${annee}`,
            totalHt,
            lignes: { create: lignes },
          },
        });
        await tx.periodeMaintenance.create({
          data: { contratId: contrat.id, annee, mois, factureId: facture.id },
        });
      });

      generated++;
      logger.info(`[job:maintenance] Draft invoice generated for ${contrat.numero} (${moisLabel} ${annee})`);
    } catch (err) {
      logger.error(`[job:maintenance] Failed to generate invoice for ${contrat.numero}: ${err.message}`);
    }
  }

  if (generated > 0) {
    logger.info(`[job:maintenance] Generated ${generated} draft invoice(s) for ${mois}/${annee}`);
  }
}

export function startJobs() {
  // Retry pending/failed Drive uploads.
  cron.schedule(env.jobs.uploadRetryCron, async () => {
    try {
      await processPending();
    } catch (err) {
      logger.error('[job:upload-retry] error:', err.message);
    }
  });
  logger.info(`[jobs] upload-retry scheduled (${env.jobs.uploadRetryCron})`);

  // Weekly PostgreSQL backup (Sunday 02:00 by default).
  cron.schedule(env.jobs.backupCron, async () => {
    try {
      await runBackup();
    } catch (err) {
      logger.error('[job:backup] error:', err.message);
    }
  });
  logger.info(`[jobs] weekly backup scheduled (${env.jobs.backupCron})`);

  // Generate monthly maintenance draft invoices on the 1st of each month at 06:00.
  const maintenanceCron = env.jobs.maintenanceCron || '0 6 1 * *';
  cron.schedule(maintenanceCron, async () => {
    try {
      await generateMaintenanceInvoices();
    } catch (err) {
      logger.error('[job:maintenance] error:', err.message);
    }
  });
  logger.info(`[jobs] maintenance invoicing scheduled (${maintenanceCron})`);
}

export { generateMaintenanceInvoices };
export default { startJobs };
