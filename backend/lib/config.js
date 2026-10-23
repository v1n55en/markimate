/**
 * Helper konfigurasi terpusat untuk Markimate Backend
 */

export function getAppUrl() {
  return (process.env.APP_URL || 'https://app.markimate.com').replace(/\/+$/, '');
}

export const TRIAL_CONFIG = {
  days: Number(process.env.TRIAL_DAYS || 30),
  credits: Number(process.env.TRIAL_CREDITS || 400),
};
export const TRIAL_DAYS = TRIAL_CONFIG.days;

export const SYSTEM_WORKSPACE_ID = '00000000-0000-0000-0000-000000000000';
