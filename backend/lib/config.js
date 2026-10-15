/**
 * Helper konfigurasi terpusat untuk Markimate Backend
 */

export function getAppUrl() {
  return (process.env.APP_URL || 'https://app.markimate.com').replace(/\/+$/, '');
}
