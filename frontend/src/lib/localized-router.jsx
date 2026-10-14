import { useEffect } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { useLanguage } from '../context/LanguageContext';
import { storage } from './storage';

/**
 * Daftar rute publik & auth yang mendukung prefix /id
 */
export const PUBLIC_PAGES = [
  '/',
  '/privacy',
  '/terms',
  '/data-deletion',
  '/login',
  '/register',
  '/forgot',
  '/reset',
  '/verify',
  '/invite'
];

/**
 * Cek apakah sebuah pathname merupakan rute publik (home, privacy, terms, data-deletion, roles/:key, auth pages)
 */
export function isPublicPath(pathname = '/') {
  const clean = getCleanPath(pathname);
  if (PUBLIC_PAGES.includes(clean)) return true;
  if (clean.startsWith('/roles/')) return true;
  return false;
}

/**
 * Bersihkan prefix /id dari pathname untuk mendapatkan path kanonik EN
 * Contoh:
 * - "/id" -> "/"
 * - "/id/" -> "/"
 * - "/id/privacy" -> "/privacy"
 * - "/id/roles/seo" -> "/roles/seo"
 * - "/id/login" -> "/login"
 * - "/privacy" -> "/privacy"
 */
export function getCleanPath(pathname = '/') {
  if (!pathname || pathname === '/id' || pathname === '/id/') return '/';
  if (pathname.startsWith('/id/')) {
    return pathname.slice(3) || '/';
  }
  return pathname;
}

/**
 * Dapatkan localized path sesuai bahasa target ('en' atau 'id')
 */
export function getLocalizedPath(pathname = '/', targetLang = 'en') {
  const clean = getCleanPath(pathname);

  // Jika bukan rute publik / auth, jangan beri prefix /id
  if (!isPublicPath(clean)) {
    return clean;
  }

  if (targetLang === 'id') {
    return clean === '/' ? '/id' : `/id${clean}`;
  }

  // targetLang === 'en' (kanonik)
  return clean;
}

/**
 * Hook untuk mendapatkan fungsi localizePath sesuai bahasa aktif
 */
export function useLocalizedPath() {
  const { lang } = useLanguage();
  return (toPath) => getLocalizedPath(toPath, lang);
}

/**
 * Hook untuk programmatic navigation ter-lokalisasi
 */
export function useLocalizedNavigate() {
  const navigate = useNavigate();
  const localize = useLocalizedPath();
  return (to, options) => {
    const target = typeof to === 'string' ? localize(to) : to;
    return navigate(target, options);
  };
}

/**
 * Komponen Link ter-lokalisasi untuk rute internal publik
 */
export function LocalizedLink({ to, onClick, children, ...props }) {
  const localize = useLocalizedPath();
  const localizedTo = typeof to === 'string' ? localize(to) : to;

  return (
    <Link to={localizedTo} onClick={onClick} {...props}>
      {children}
    </Link>
  );
}

/**
 * Hook untuk redirect kunjungan pertama kali ke /id bagi browser ID (PRD F3 §2.3)
 * Aturan:
 * - Hanya berlaku saat kunjungan pertama ke "/"
 * - User belum pernah memilih bahasa di switcher (tidak ada markimate_lang / markimate_lang_selected)
 * - Browser language diawali "id"
 * - Menggunakan replace: true
 */
export function useInitialLanguageRedirect() {
  const location = useLocation();
  const navigate = useNavigate();

  useEffect(() => {
    if (typeof window === 'undefined') return;

    // Hanya evaluasi di root "/"
    if (location.pathname !== '/') return;

    // Jika user sudah pernah memilih bahasa secara eksplisit, jangan redirect otomatis
    const userSelected = storage.getItem('markimate_lang_selected') || storage.getItem('markimate_lang');
    if (userSelected) return;

    // Cek bahasa browser
    const browserLangs = navigator.languages || [navigator.language || ''];
    const isIndonesian = browserLangs.some(
      (l) => typeof l === 'string' && l.toLowerCase().startsWith('id')
    );

    if (isIndonesian) {
      navigate('/id', { replace: true });
    }
  }, [location.pathname, navigate]);
}
