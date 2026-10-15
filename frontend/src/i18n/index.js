import { en } from './locales/en/index.js';
import { id } from './locales/id/index.js';

export const TRANSLATIONS = { en, id };
export { en, id };

export function resolvePath(obj, path) {
  if (!obj || !path) return undefined;
  const parts = path.split('.');
  let curr = obj;
  for (const part of parts) {
    if (curr && typeof curr === 'object' && part in curr) {
      curr = curr[part];
    } else {
      return undefined;
    }
  }
  return curr;
}

export function getCurrentLang() {
  if (typeof document !== 'undefined' && (document.documentElement.lang === 'id' || document.documentElement.lang === 'en')) {
    return document.documentElement.lang;
  }
  if (typeof window !== 'undefined' && window.location) {
    const p = window.location.pathname || '';
    if (p === '/id' || p.startsWith('/id/')) return 'id';
  }
  if (typeof document !== 'undefined') {
    try {
      const match = document.cookie.match(/(?:^|;\s*)mk_lang=([^;]+)/);
      if (match) {
        const val = decodeURIComponent(match[1]).trim();
        if (val === 'en' || val === 'id') return val;
      }
    } catch {}
  }
  if (typeof localStorage !== 'undefined') {
    try {
      const saved = localStorage.getItem('markimate_lang') || localStorage.getItem('lang');
      if (saved === 'en' || saved === 'id') return saved;
    } catch {}
  }
  return 'en';
}

export function translate(lang, path, params = {}, fallback = '') {
  if (!path) return fallback;

  let actualParams = params;
  let actualFallback = fallback;
  if (typeof params === 'string') {
    actualFallback = params;
    actualParams = {};
  }

  const activeLang = lang === 'id' || lang === 'en' ? lang : 'en';

  const count = typeof actualParams === 'number'
    ? actualParams
    : (actualParams && (actualParams.count !== undefined ? actualParams.count : actualParams.number));

  let lookupKey = path;
  if (typeof count === 'number') {
    try {
      const pr = new Intl.PluralRules(activeLang);
      const rule = pr.select(count);
      const pluralKey = `${path}_${rule}`;
      if (resolvePath(TRANSLATIONS[activeLang], pluralKey) !== undefined) {
        lookupKey = pluralKey;
      }
    } catch {}
  }

  let val = resolvePath(TRANSLATIONS[activeLang], lookupKey);

  if (val === undefined) {
    if (activeLang !== 'en') {
      val = resolvePath(TRANSLATIONS.en, lookupKey);
    }
  }

  if (val === undefined) {
    val = actualFallback || path;
  }

  if (typeof val === 'string' && actualParams && typeof actualParams === 'object') {
    return val.replace(/\{([a-zA-Z0-9_]+)\}/g, (match, paramName) => {
      return paramName in actualParams ? String(actualParams[paramName]) : match;
    });
  }

  return val;
}

export function t(path, params, fallback) {
  const lang = getCurrentLang();
  return translate(lang, path, params, fallback);
}

export const i18n = {
  t,
  translate,
  getCurrentLang,
  TRANSLATIONS,
  en,
  id
};

export default i18n;
