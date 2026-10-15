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

/**
 * Resolusi bahasa sesuai urutan prioritas PRD §2.2:
 * 1. Prefix URL publik (/id/... -> id)
 * 2. accounts.locale dari user tersimpan
 * 3. Pilihan tersimpan (markimate_lang di localStorage)
 * 4. Bahasa browser (navigator.languages diawali 'id' -> id)
 * 5. Default: en
 */
function detectInitialLanguage() {
  if (typeof window !== 'undefined' && window.location) {
    const pathname = window.location.pathname || '';
    if (pathname === '/id' || pathname.startsWith('/id/')) {
      return 'id';
    }
  }

  try {
    const userRaw = storage.getItem('markimate_user') || storage.getItem('user');
    if (userRaw) {
      const u = typeof userRaw === 'string' ? JSON.parse(userRaw) : userRaw;
      if (u?.locale === 'id' || u?.locale === 'en') {
        return u.locale;
      }
    }
  } catch {}

  try {
    const saved = storage.getItem(STORAGE_KEY) || storage.getItem(LEGACY_STORAGE_KEY);
    if (saved === 'en' || saved === 'id') return saved;
  } catch {}

  if (typeof navigator !== 'undefined') {
    const langs = navigator.languages || [navigator.language || ''];
    for (const l of langs) {
      if (typeof l === 'string' && l.toLowerCase().startsWith('id')) {
        return 'id';
      }
    }
  }

  return 'en';
}

import { api } from '../api.js';

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

  // Sinkronisasi bahasa dengan URL publik saat navigasi tanpa merusak pilihan pengguna
  useEffect(() => {
    if (!location?.pathname) return;
    const pathname = location.pathname;

    // 1. Path publik dengan prefix /id selalu aktifkan 'id'
    if (pathname === '/id' || pathname.startsWith('/id/')) {
      if (lang !== 'id') setLangState('id');
      return;
    }

    // 2. Path publik tanpa prefix (/ ... /privacy, /terms, /data-deletion, /roles/*)
    if (isPublicPath(pathname)) {
      const selected = storage.getItem('markimate_lang_selected') === 'true';
      const savedLang = storage.getItem(STORAGE_KEY) || lang;

      // Jika user SUDAH memilih 'id', arahkan ke URL padanannya (/id/...)
      if (selected && savedLang === 'id') {
        const idPath = getLocalizedPath(pathname, 'id');
        if (idPath !== pathname && navigate) {
          navigate(idPath + (location.search || '') + (location.hash || ''), { replace: true });
        }
        if (lang !== 'id') setLangState('id');
      } else if (selected && savedLang === 'en') {
        if (lang !== 'en') setLangState('en');
      } else {
        // Belum pernah memilih secara manual:
        // Jika browser bahasa ID, arahkan ke /id/...
        if (lang === 'id') {
          const idPath = getLocalizedPath(pathname, 'id');
          if (idPath !== pathname && navigate) {
            navigate(idPath + (location.search || '') + (location.hash || ''), { replace: true });
          }
        } else {
          if (lang !== 'en') setLangState('en');
        }
      }
      return;
    }

    // 3. Path Auth (/login, /register, dll) dan App (/app/*) TIDAK PERNAH mengubah bahasa
  }, [location?.pathname, lang, navigate]);

  useEffect(() => {
    try {
      storage.setItem(STORAGE_KEY, lang);
      document.documentElement.lang = lang;
    } catch {}
  }, [lang]);

  const setLang = (newLang) => {
    if (newLang !== 'en' && newLang !== 'id') return;
    try {
      storage.setItem('markimate_lang_selected', 'true');
      storage.setItem(STORAGE_KEY, newLang);
      document.documentElement.lang = newLang;
    } catch {}
    setLangState(newLang);

    // Sinkronkan ke akun pengguna jika sedang login
    try {
      api('/api/me', {
        method: 'PATCH',
        body: { locale: newLang }
      }).catch(() => {});
    } catch {}
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
  const { lang, toggleLang } = useLanguage();
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
    toggleLang();

    if (location && navigate && isPublicPath(location.pathname)) {
      const nextPath = getLocalizedPath(location.pathname, nextLang);
      navigate(nextPath + (location.search || '') + (location.hash || ''));
    }
  };

  const nextLabel = lang === 'en' ? 'ID' : 'EN';
  const currentLabel = lang.toUpperCase();

  return (
    <button
      type="button"
      onClick={handleToggle}
      className={`lang-toggle ${className}`}
      aria-label={`Current language: ${currentLabel}. Switch to ${nextLabel}`}
      title={`Switch to ${nextLabel}`}
    >
      <Globe size={13} className="lang-toggle-icon" />
      <span className="lang-toggle-label">{currentLabel}</span>
    </button>
  );
}

// Backward compatibility alias
export const LanguageSwitcher = LanguageToggle;
