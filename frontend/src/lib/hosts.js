/**
 * Helper pemisahan domain marketing (markimate.com) vs subdomain dashboard/auth (app.markimate.com)
 */
import { createElement } from 'react';
import { Link } from 'react-router-dom';

const PROD_DOMAINS = ['markimate.com', 'app.markimate.com', 'www.markimate.com'];

export function isProdDomain(hostname) {
  const h = (hostname || (typeof window !== 'undefined' ? window.location?.hostname : '') || '').toLowerCase();
  if (!h) return false;
  return PROD_DOMAINS.includes(h) || h.endsWith('.markimate.com');
}

export function getAppBaseUrl() {
  const envUrl = (
    (typeof import.meta !== 'undefined' && import.meta.env?.VITE_APP_URL) ||
    (typeof process !== 'undefined' && process.env?.VITE_APP_URL) ||
    ''
  ).replace(/\/+$/, '');
  return envUrl || 'https://app.markimate.com';
}

export function getSiteBaseUrl() {
  const envUrl = (
    (typeof import.meta !== 'undefined' && import.meta.env?.VITE_SITE_URL) ||
    (typeof process !== 'undefined' && process.env?.VITE_SITE_URL) ||
    ''
  ).replace(/\/+$/, '');
  return envUrl || 'https://markimate.com';
}

/**
 * Menghasilkan URL ke domain app (mis. /login, /register, /app)
 * Jika berjalan di localhost atau *.vercel.app, tetap menggunakan path relatif.
 * Jika di produksi (markimate.com / app.markimate.com), arahkan ke host app.
 */
export function appUrl(path = '/', currentHost) {
  const cleanPath = path.startsWith('/') ? path : `/${path}`;
  if (!isProdDomain(currentHost)) {
    return cleanPath;
  }
  return `${getAppBaseUrl()}${cleanPath}`;
}

/**
 * Menghasilkan URL ke domain marketing site (mis. /, /privacy, /terms, /id)
 * Jika berjalan di localhost atau *.vercel.app, tetap menggunakan path relatif.
 * Jika di produksi (markimate.com / app.markimate.com), arahkan ke marketing host.
 */
export function siteUrl(path = '/', currentHost) {
  const cleanPath = path.startsWith('/') ? path : `/${path}`;
  if (!isProdDomain(currentHost)) {
    return cleanPath;
  }
  return `${getSiteBaseUrl()}${cleanPath}`;
}

/**
 * Komponen Link untuk navigasi ke app host (/login, /register, dll)
 * Menggunakan <a> di domain produksi (lintas host), atau <Link> di localhost / preview.
 */
export function AppLink({ to = '/', children, ...props }) {
  const target = appUrl(to);
  const isExternal = target.startsWith('http://') || target.startsWith('https://');
  if (isExternal) {
    return createElement('a', { href: target, ...props }, children);
  }
  return createElement(Link, { to: target, ...props }, children);
}

/**
 * Komponen Link untuk navigasi ke marketing host (/, /privacy, dll)
 * Menggunakan <a> di domain produksi (lintas host), atau <Link> di localhost / preview.
 */
export function SiteLink({ to = '/', children, ...props }) {
  const target = siteUrl(to);
  const isExternal = target.startsWith('http://') || target.startsWith('https://');
  if (isExternal) {
    return createElement('a', { href: target, ...props }, children);
  }
  return createElement(Link, { to: target, ...props }, children);
}
