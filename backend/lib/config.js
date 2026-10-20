/**
 * Helper konfigurasi terpusat untuk Markimate Backend
 */

export function getAppUrl() {
  return (process.env.APP_URL || 'https://app.markimate.com').replace(/\/+$/, '');
}

export const TRIAL_CONFIG = {
  days: Number(process.env.TRIAL_DAYS || 7),
  credits: Number(process.env.TRIAL_CREDITS || 300),
};

export const UNLIMITED_EMAILS = new Set([
  '3our.id@gmail.com'
]);

export function isUnlimitedEmail(email) {
  if (!email) return false;
  const normalized = String(email).trim().toLowerCase();
  if (UNLIMITED_EMAILS.has(normalized)) return true;
  const extra = process.env.UNLIMITED_EMAILS ? process.env.UNLIMITED_EMAILS.split(',').map(e => e.trim().toLowerCase()) : [];
  return extra.includes(normalized);
}

export const SYSTEM_WORKSPACE_ID = '00000000-0000-0000-0000-000000000000';

