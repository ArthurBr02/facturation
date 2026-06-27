// Centralised environment configuration. Reading process.env in one place
// keeps the rest of the codebase free of magic strings and easy to test.
import dotenv from 'dotenv';

dotenv.config();

function bool(value, fallback = false) {
  if (value === undefined) return fallback;
  return ['1', 'true', 'yes', 'on'].includes(String(value).toLowerCase());
}

export const env = {
  nodeEnv: process.env.NODE_ENV || 'development',
  port: parseInt(process.env.API_PORT || '3000', 10),

  databaseUrl: process.env.DATABASE_URL,

  auth: {
    jwtSecret: process.env.JWT_SECRET || 'dev-insecure-secret-change-me',
    jwtExpiresIn: process.env.JWT_EXPIRES_IN || '7d',
    adminEmail: process.env.ADMIN_EMAIL || 'admin@example.com',
    adminPassword: process.env.ADMIN_PASSWORD || 'admin',
  },

  drive: {
    enabled: bool(process.env.DRIVE_ENABLED, false),
    credentialsPath: process.env.GOOGLE_APPLICATION_CREDENTIALS || '',
    rootFolderId: process.env.GOOGLE_DRIVE_ROOT_FOLDER_ID || '',
    // OAuth2 user credentials (preferred over service account for personal Drive)
    clientId: process.env.GOOGLE_CLIENT_ID || '',
    clientSecret: process.env.GOOGLE_CLIENT_SECRET || '',
    refreshToken: process.env.GOOGLE_REFRESH_TOKEN || '',
  },

  mail: {
    enabled: bool(process.env.MAIL_ENABLED, false),
    host: process.env.SMTP_HOST || '',
    port: parseInt(process.env.SMTP_PORT || '587', 10),
    secure: bool(process.env.SMTP_SECURE, false),
    user: process.env.SMTP_USER || '',
    password: process.env.SMTP_PASSWORD || '',
    from: process.env.ALERT_FROM || 'facturation@example.com',
    to: process.env.ALERT_TO || 'admin@example.com',
  },

  jobs: {
    uploadRetryCron: process.env.UPLOAD_RETRY_CRON || '*/5 * * * *',
    uploadMaxAttempts: parseInt(process.env.UPLOAD_MAX_ATTEMPTS || '5', 10),
    backupCron: process.env.BACKUP_CRON || '0 2 * * 0',
  },

  storage: {
    // Root for temporary PDFs and DB dumps (a Docker volume in production).
    root: process.env.STORAGE_ROOT || '/app/storage',
  },
};

export default env;
