// E-mail alert service (Nodemailer / SMTP). Used to notify the admin when a
// Drive upload keeps failing or when a backup finishes. Disabled by default in
// local/dev (MAIL_ENABLED=false); calls then just log instead of sending.
import nodemailer from 'nodemailer';
import env from '../config/env.js';
import logger from '../utils/logger.js';

let transporter = null;

function getTransporter() {
  if (transporter) return transporter;
  transporter = nodemailer.createTransport({
    host: env.mail.host,
    port: env.mail.port,
    secure: env.mail.secure,
    auth: env.mail.user ? { user: env.mail.user, pass: env.mail.password } : undefined,
  });
  return transporter;
}

/**
 * Send a plain-text alert e-mail. Resolves to true if sent, false if skipped.
 */
export async function sendAlert(subject, text) {
  if (!env.mail.enabled) {
    logger.warn(`[mail] disabled — would send: "${subject}"`);
    return false;
  }
  try {
    await getTransporter().sendMail({
      from: env.mail.from,
      to: env.mail.to,
      subject: `[Facturation] ${subject}`,
      text,
    });
    logger.info(`[mail] alert sent: "${subject}"`);
    return true;
  } catch (err) {
    logger.error('[mail] failed to send alert:', err.message);
    return false;
  }
}

export function uploadFailureMessage({ fileName, drivePath, error, attempts }) {
  return [
    "Échec d'envoi d'un document vers Google Drive.",
    '',
    `Fichier      : ${fileName}`,
    `Destination  : ${drivePath}`,
    `Tentatives   : ${attempts}`,
    `Erreur       : ${error}`,
    '',
    'Le document reste en file et sera retenté automatiquement.',
  ].join('\n');
}

export default { sendAlert, uploadFailureMessage };
