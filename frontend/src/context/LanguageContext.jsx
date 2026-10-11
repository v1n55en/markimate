import { createContext, useContext, useState, useEffect } from 'react';
import { Globe } from 'lucide-react';
import { TRANSLATIONS } from '../i18n/translations';

const LanguageContext = createContext({
  lang: 'en',
  setLang: () => {},
  toggleLang: () => {},
  t: (path, fallback = '') => fallback,
});

const STORAGE_KEY = 'supermat_lang';

export function LanguageProvider({ children }) {
  const [lang, setLangState] = useState(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved === 'en' || saved === 'id') return saved;
    } catch {
      // Fallback
    }
    // Default: English as primary
    return 'en';
  });

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, lang);
      document.documentElement.lang = lang;
    } catch {
      // Ignore
    }
  }, [lang]);

  const setLang = (newLang) => {
    if (newLang === 'en' || newLang === 'id') {
      setLangState(newLang);
    }
  };

  const toggleLang = () => {
    setLangState((prev) => (prev === 'en' ? 'id' : 'en'));
  };

  // Helper resolver dot-notation path, e.g. t('hero.title')
  const t = (path, fallback = '') => {
    if (!path) return fallback;
    const parts = path.split('.');
    let current = TRANSLATIONS[lang] || TRANSLATIONS.en;
    for (const part of parts) {
      if (current && typeof current === 'object' && part in current) {
        current = current[part];
      } else {
        // Fallback to English if key missing in Indonesian
        let enCurrent = TRANSLATIONS.en;
        for (const p of parts) {
          if (enCurrent && typeof enCurrent === 'object' && p in enCurrent) {
            enCurrent = enCurrent[p];
          } else {
            return fallback || path;
          }
        }
        return enCurrent || fallback || path;
      }
    }
    return typeof current === 'string' ? current : fallback || path;
  };

  return (
    <LanguageContext.Provider value={{ lang, setLang, toggleLang, t }}>
      {children}
    </LanguageContext.Provider>
  );
}

// eslint-disable-next-line react-refresh/only-export-components
export function useLanguage() {
  return useContext(LanguageContext);
}

// Komponen Switcher Bahasa yang fleksibel dan elegan
export function LanguageSwitcher({ size = 'normal', style = {} }) {
  const { lang, setLang } = useLanguage();

  const isSmall = size === 'small';

  return (
    <div
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        backgroundColor: 'rgba(24, 24, 27, 0.8)',
        border: '1px solid var(--border-muted)',
        borderRadius: '8px',
        padding: isSmall ? '2px' : '3px',
        gap: '2px',
        backdropFilter: 'blur(8px)',
        userSelect: 'none',
        ...style,
      }}
      title="Switch Language / Ganti Bahasa"
    >
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          padding: isSmall ? '0 4px' : '0 6px',
          color: 'var(--text-muted)',
        }}
      >
        <Globe size={isSmall ? 12 : 14} />
      </div>

      <button
        type="button"
        onClick={() => setLang('en')}
        style={{
          border: 'none',
          cursor: 'pointer',
          borderRadius: '5px',
          padding: isSmall ? '2px 6px' : '4px 8px',
          fontSize: isSmall ? '0.72rem' : '0.78rem',
          fontWeight: lang === 'en' ? '700' : '500',
          backgroundColor: lang === 'en' ? 'var(--accent-cyan)' : 'transparent',
          color: lang === 'en' ? '#09090b' : 'var(--text-muted)',
          transition: 'all 0.15s ease',
        }}
      >
        EN
      </button>

      <button
        type="button"
        onClick={() => setLang('id')}
        style={{
          border: 'none',
          cursor: 'pointer',
          borderRadius: '5px',
          padding: isSmall ? '2px 6px' : '4px 8px',
          fontSize: isSmall ? '0.72rem' : '0.78rem',
          fontWeight: lang === 'id' ? '700' : '500',
          backgroundColor: lang === 'id' ? 'var(--accent-cyan)' : 'transparent',
          color: lang === 'id' ? '#09090b' : 'var(--text-muted)',
          transition: 'all 0.15s ease',
        }}
      >
        ID
      </button>
    </div>
  );
}
