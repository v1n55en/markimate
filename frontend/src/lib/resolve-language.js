/**
 * Urutan penentuan bahasa (Keputusan 3Our PRD F3):
 * 1. Prefix URL /id/* -> id
 * 2. accounts.locale setelah login
 * 3. Cookie mk_lang
 * 4. localStorage markimate_lang
 * 5. Default: en (tanpa deteksi bahasa browser)
 */
export function resolveLanguage({ path = '', accountLocale = null, cookie = null, storage = null } = {}) {
  // 1. Prefix URL publik (/id atau /id/...)
  if (path === '/id' || path.startsWith('/id/')) {
    return 'id';
  }

  // 2. accounts.locale setelah login
  if (accountLocale === 'id' || accountLocale === 'en') {
    return accountLocale;
  }

  // 3. Cookie mk_lang
  if (cookie === 'id' || cookie === 'en') {
    return cookie;
  }

  // 4. localStorage markimate_lang
  if (storage === 'id' || storage === 'en') {
    return storage;
  }

  // 5. Default en (English)
  return 'en';
}
