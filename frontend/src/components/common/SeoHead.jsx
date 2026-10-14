import { useEffect } from 'react';
import { useLocation } from 'react-router-dom';
import { useLanguage } from '../../context/LanguageContext';
import { getCleanPath } from '../../lib/localized-router';

/**
 * Komponen SeoHead dinamis untuk client-side head updates
 * Mendukung canonical URL, hreflang alternates (en, id, x-default), Open Graph, dan Twitter Cards
 */
export default function SeoHead({
  title,
  description,
  path,
  ogImage = '/favicon.png',
  type = 'website'
}) {
  const { lang } = useLanguage();
  const location = useLocation();

  useEffect(() => {
    if (typeof document === 'undefined') return;

    const rawSiteUrl = import.meta.env.VITE_SITE_URL || 'https://markimate-three.vercel.app';
    const siteUrl = rawSiteUrl.replace(/\/+$/, '');

    // Tentukan clean pathname kanonik
    const targetPath = path || location.pathname;
    const clean = getCleanPath(targetPath);

    // URL EN, ID, dan x-default
    const enPath = clean;
    const idPath = clean === '/' ? '/id' : `/id${clean}`;

    const enUrl = `${siteUrl}${enPath === '/' ? '' : enPath}`;
    const idUrl = `${siteUrl}${idPath}`;
    const canonicalUrl = lang === 'id' ? idUrl : enUrl;

    const pageTitle = title
      ? (title.includes('Markimate') ? title : `${title} — Markimate`)
      : (lang === 'id'
          ? 'Markimate — Tim Digital Marketing AI Terpadu | Powered by 3our'
          : 'Markimate — Full Digital Marketing Team in One Platform | Powered by 3our');

    const metaDesc = description || (lang === 'id'
      ? 'Platform otomasi tim digital marketing AI terpadu: Riset tren SEO, penulisan artikel rank-ready, auto-publish CMS, dan analitik multi-channel.'
      : 'All-in-one AI digital marketing platform: Autonomous SEO trend mining, rank-ready content generation, 1-click CMS dispatch, and multi-channel ad reporting.');

    // 1. Update Title & HTML lang attribute
    document.title = pageTitle;
    document.documentElement.lang = lang;

    // Helper untuk update atau create tag
    const setMetaTag = (attributeName, attributeValue, content) => {
      let el = document.querySelector(`meta[${attributeName}="${attributeValue}"]`);
      if (!el) {
        el = document.createElement('meta');
        el.setAttribute(attributeName, attributeValue);
        document.head.appendChild(el);
      }
      el.setAttribute('content', content);
    };

    const setLinkTag = (rel, hreflang, href) => {
      const selector = hreflang
        ? `link[rel="${rel}"][hreflang="${hreflang}"]`
        : `link[rel="${rel}"]`;
      let el = document.querySelector(selector);
      if (!el) {
        el = document.createElement('link');
        el.setAttribute('rel', rel);
        if (hreflang) el.setAttribute('hreflang', hreflang);
        document.head.appendChild(el);
      }
      el.setAttribute('href', href);
    };

    // 2. Meta description
    setMetaTag('name', 'description', metaDesc);

    // 3. Canonical & hreflang
    setLinkTag('canonical', null, canonicalUrl);
    setLinkTag('alternate', 'en', enUrl);
    setLinkTag('alternate', 'id', idUrl);
    setLinkTag('alternate', 'x-default', enUrl);

    // 4. Open Graph
    setMetaTag('property', 'og:title', pageTitle);
    setMetaTag('property', 'og:description', metaDesc);
    setMetaTag('property', 'og:type', type);
    setMetaTag('property', 'og:url', canonicalUrl);
    setMetaTag('property', 'og:locale', lang === 'id' ? 'id_ID' : 'en_US');
    setMetaTag('property', 'og:locale:alternate', lang === 'id' ? 'en_US' : 'id_ID');
    setMetaTag('property', 'og:site_name', 'Markimate');

    const fullImageUrl = ogImage.startsWith('http') ? ogImage : `${siteUrl}${ogImage.startsWith('/') ? '' : '/'}${ogImage}`;
    setMetaTag('property', 'og:image', fullImageUrl);

    // 5. Twitter Card
    setMetaTag('name', 'twitter:card', 'summary_large_image');
    setMetaTag('name', 'twitter:title', pageTitle);
    setMetaTag('name', 'twitter:description', metaDesc);
    setMetaTag('name', 'twitter:image', fullImageUrl);
  }, [title, description, path, ogImage, type, lang, location.pathname]);

  return null;
}
