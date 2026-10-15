import { createContext, useContext, useState, useEffect, isValidElement, cloneElement } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { Globe } from 'lucide-react';
import { TRANSLATIONS } from '../i18n/index.js';
import { storage } from '../lib/storage.js';
import * as format from '../lib/format.js';
import { isPublicPath, getCleanPath, getLocalizedPath } from '../lib/localized-router.jsx';

const STORAGE_KEY = 'markimate_lang';
const LEGACY_STORAGE_KEY = 'lang';

const LanguageContext = createContext({
  lang: 'en',
  setLang: () => {},
  toggleLang: () => {},
  t: (path, params = {}, fallback = '') => fallback || path,
  format,
});

function resolvePath(obj, path) {
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

function getLanguageCookie() {
  if (typeof document === 'undefined') return null;
  try {
    const match = document.cookie.match(/(?:^|;\s*)mk_lang=([^;]+)/);
    if (match) {
      const val = decodeURIComponent(match[1]).trim();
      if (val === 'en' || val === 'id') return val;
    }
  } catch {}
  return null;
}

export function setLanguageCookie(val) {
  if (typeof document === 'undefined') return;
  if (val !== 'en' && val !== 'id') return;
  let cookieStr = `mk_lang=${val}; Path=/; Max-Age=31536000; SameSite=Lax`;
  if (typeof window !== 'undefined' && window.location) {
    const hostname = window.location.hostname || '';
    if (hostname === 'markimate.com' || hostname.endsWith('.markimate.com')) {
      cookieStr += '; Domain=.markimate.com; Secure';
    } else if (window.location.protocol === 'https:') {
      cookieStr += '; Secure';
    }
  }
  try {
    document.cookie = cookieStr;
  } catch {}
}

import { resolveLanguage } from '../lib/resolve-language.js';
export { resolveLanguage };

export function getSavedLanguagePreference() {
  const cookieLang = getLanguageCookie();
  if (cookieLang === 'id' || cookieLang === 'en') return cookieLang;

  try {
    const saved = storage.getItem(STORAGE_KEY) || storage.getItem(LEGACY_STORAGE_KEY);
    if (saved === 'id' || saved === 'en') return saved;
  } catch {}

  return null;
}

function detectInitialLanguage() {
  const path = typeof window !== 'undefined' ? (window.location?.pathname || '') : '';
  const cookie = getLanguageCookie();
  let savedStorage = null;
  try {
    savedStorage = storage.getItem(STORAGE_KEY) || storage.getItem(LEGACY_STORAGE_KEY);
  } catch {}

  return resolveLanguage({
    path,
    accountLocale: null,
    cookie,
    storage: savedStorage
  });
}

import { api, getToken } from '../api.js';

export function LanguageProvider({ children }) {
  const [lang, setLangState] = useState(detectInitialLanguage);
  let location;
  let navigate;
  try {
    // eslint-disable-next-line react-hooks/rules-of-hooks
    location = useLocation();
    // eslint-disable-next-line react-hooks/rules-of-hooks
    navigate = useNavigate();
  } catch {
    // Di luar Router context
  }

  // Sinkronisasi bahasa dengan URL publik saat navigasi
  useEffect(() => {
    if (!location?.pathname) return;
    const pathname = location.pathname;

    // 1. Halaman /id/* hanya menampilkan ID. Halaman itu tidak menimpa cookie/storage.
    if (pathname === '/id' || pathname.startsWith('/id/')) {
      setLangState('id');
      if (typeof document !== 'undefined') document.documentElement.lang = 'id';
      return;
    }

    // 2. Halaman publik tanpa prefix (/ ... /privacy, /terms, /data-deletion, /roles/*):
    if (isPublicPath(pathname)) {
      const savedPref = getSavedLanguagePreference();
      // Kalau pilihan tersimpan adalah 'id', lakukan redirect (replace) ke padanan /id/...
      if (savedPref === 'id') {
        const targetPath = getLocalizedPath(pathname, 'id');
        if (targetPath !== pathname && navigate) {
          navigate(targetPath + (location.search || '') + (location.hash || ''), { replace: true });
          return;
        }
      }

      // Kalau belum ada pilihan tersimpan (pengunjung baru), tampilkan EN tanpa menyimpan apa pun
      const activeLang = savedPref || 'en';
      setLangState(activeLang);
      if (typeof document !== 'undefined') document.documentElement.lang = activeLang;
      return;
    }

    // 3. Halaman Auth (/login, /register, dll) dan App (/app/*):
    // Hormati pilihan tersimpan (cookie mk_lang / storage markimate_lang)
    const savedPref = getSavedLanguagePreference();
    const resolved = savedPref || 'en';
    setLangState(resolved);
    if (typeof document !== 'undefined') document.documentElement.lang = resolved;
  }, [location?.pathname, navigate]);

  const setLang = (newLang, { syncBackend = true } = {}) => {
    if (newLang !== 'en' && newLang !== 'id') return;
    try {
      storage.setItem('markimate_lang_selected', 'true');
      storage.setItem(STORAGE_KEY, newLang);
      setLanguageCookie(newLang);
      if (typeof document !== 'undefined') {
        document.documentElement.lang = newLang;
      }
    } catch {}
    setLangState(newLang);

    // Sinkronkan ke akun pengguna HANYA jika sedang login (memiliki access token) dan diminta
    if (syncBackend && getToken && getToken()) {
      try {
        api('/api/me', {
          method: 'PATCH',
          body: { locale: newLang }
        }).catch(() => {});
      } catch {}
    }
  };

  const toggleLang = () => {
    const next = lang === 'en' ? 'id' : 'en';
    setLang(next);
    return next;
  };

  /**
   * Helper penterjemah t(path, params, fallback)
   * Mendukung:
   * - dot notation: t('hero.title')
   * - interpolasi: t('hero.ctaPrimary', { credits: 300, days: 7 })
   * - pluralisasi: t('common.itemsCount', { count: 1 }) -> mencari itemsCount_one / itemsCount_other
   * - dev warning bila key tidak ditemukan
   */
  const t = (path, params = {}, fallback = '') => {
    if (!path) return fallback;

    // Normalisasi parameter fallback bila params dipassing sebagai string fallback
    let actualParams = params;
    let actualFallback = fallback;
    if (typeof params === 'string') {
      actualFallback = params;
      actualParams = {};
    }

    const count = typeof actualParams === 'number'
      ? actualParams
      : (actualParams && (actualParams.count !== undefined ? actualParams.count : actualParams.number));

    let lookupKey = path;
    if (typeof count === 'number') {
      try {
        const pr = new Intl.PluralRules(lang);
        const rule = pr.select(count); // 'one', 'other'
        const pluralKey = `${path}_${rule}`;
        if (resolvePath(TRANSLATIONS[lang], pluralKey) !== undefined) {
          lookupKey = pluralKey;
        }
      } catch {}
    }

    let val = resolvePath(TRANSLATIONS[lang], lookupKey);

    if (val === undefined) {
      // Fallback ke EN bila belum ada di ID
      if (lang !== 'en') {
        val = resolvePath(TRANSLATIONS.en, lookupKey);
        if (import.meta.env?.DEV) {
          console.warn(`[i18n] Missing translation key: "${lookupKey}" for language "${lang}"`);
        }
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
  };

  return (
    <LanguageContext.Provider value={{ lang, setLang, toggleLang, t, format }}>
      {children}
    </LanguageContext.Provider>
  );
}

// eslint-disable-next-line react-refresh/only-export-components
export function useLanguage() {
  return useContext(LanguageContext);
}

/**
 * Komponen <Trans> untuk teks dengan komponen tersemat (link/bold) tanpa dangerouslySetInnerHTML
 */
export function Trans({ i18nKey, values = {}, components = {}, fallback = '' }) {
  const { t } = useLanguage();
  const rawText = t(i18nKey, values, fallback);
  if (typeof rawText !== 'string') return rawText;

  const tagRegex = /<([a-zA-Z0-9_]+)>(.*?)<\/\1>/g;
  const elements = [];
  let lastIndex = 0;
  let match;

  while ((match = tagRegex.exec(rawText)) !== null) {
    if (match.index > lastIndex) {
      elements.push(rawText.substring(lastIndex, match.index));
    }
    const [ , tagName, content ] = match;
    const comp = components[tagName];
    if (comp && isValidElement(comp)) {
      elements.push(cloneElement(comp, { key: elements.length }, content));
    } else {
      elements.push(content);
    }
    lastIndex = tagRegex.lastIndex;
  }
  if (lastIndex < rawText.length) {
    elements.push(rawText.substring(lastIndex));
  }

  return <>{elements}</>;
}

/**
 * Komponen LanguageToggle (Satu pill kecil per layar, touch target >= 44px via ::after, class .lang-toggle)
 */
export function LanguageToggle({ className = '' }) {
  const { lang, setLang } = useLanguage();
  let location;
  let navigate;
  try {
    // eslint-disable-next-line react-hooks/rules-of-hooks
    location = useLocation();
    // eslint-disable-next-line react-hooks/rules-of-hooks
    navigate = useNavigate();
  } catch {}

  const handleToggle = () => {
    const nextLang = lang === 'en' ? 'id' : 'en';
    setLang(nextLang);

    if (location && navigate && isPublicPath(location.pathname)) {
      const nextPath = getLocalizedPath(location.pathname, nextLang);
      if (nextPath !== location.pathname) {
        navigate(nextPath + (location.search || '') + (location.hash || ''));
      }
    }
  };

  const currentLabel = lang.toUpperCase();
  const ariaLabel = lang === 'en' ? 'Switch to Bahasa Indonesia' : 'Ganti ke English';

  return (
    <button
      type="button"
      onClick={handleToggle}
      className={`lang-toggle ${className}`}
      aria-label={ariaLabel}
      title={ariaLabel}
    >
      <Globe size={13} className="lang-toggle-icon" />
      <span className="lang-toggle-label">{currentLabel}</span>
    </button>
  );
}

// Backward compatibility alias
export const LanguageSwitcher = LanguageToggle;
