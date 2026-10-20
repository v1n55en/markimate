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
