// Build Static SEO Pages & Sitemap Generator (PRD F3 Langkah 3)
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { ROLES } from '../src/config/roles.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const distDir = path.resolve(__dirname, '../dist');

const rawSiteUrl = process.env.VITE_SITE_URL || 'https://markimate.com';
const SITE_URL = rawSiteUrl.replace(/\/+$/, '');

function escapeHtml(str = '') {
  return str
    .replace(/&/g, '&amp;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

async function run() {
  console.log('====================================================');
  console.log('RUNNING STATIC SEO PAGES & SITEMAP GENERATOR');
  console.log('====================================================');
  console.log(`Site Canonical URL: ${SITE_URL}`);

  const templatePath = path.join(distDir, 'index.html');
  if (!fs.existsSync(templatePath)) {
    console.error(`❌ Error: dist/index.html not found at ${templatePath}. Run vite build first.`);
    process.exit(1);
  }

  const templateHtml = fs.readFileSync(templatePath, 'utf8');

  // Daftar seluruh halaman publik
  const staticPages = [
    {
      cleanPath: '/',
      en: {
        title: 'Markimate — Full Digital Marketing Team in One Platform | Powered by 3our',
        description: 'All-in-one AI digital marketing platform: Autonomous SEO trend mining, rank-ready content generation, 1-click CMS dispatch, and multi-channel ad reporting.'
      },
      id: {
        title: 'Markimate — Tim Digital Marketing AI Terpadu | Powered by 3our',
        description: 'Platform otomasi tim digital marketing AI terpadu: Riset tren SEO, penulisan artikel rank-ready, auto-publish CMS, dan analitik multi-channel.'
      }
    },
    {
      cleanPath: '/pricing',
      en: {
        title: 'Lifetime Pricing & Modules — Markimate',
        description: 'Lifetime access to AI SEO, Ads Reporting, and Creative Spy modules. Pay once, use forever with free monthly credits and flexible custom top-up.'
      },
      id: {
        title: 'Harga Lifetime & Modul AI — Markimate',
        description: 'Akses seumur hidup modul AI SEO, Ads Reporting, dan Creative Spy. Sekali bayar tanpa langganan, kuota kredit bulanan gratis, dan top-up custom fleksibel.'
      }
    },
    {
      cleanPath: '/privacy',
      en: {
        title: 'Privacy Policy — Markimate',
        description: 'Markimate Privacy Policy: Our commitment to protecting user privacy, data integrity, and system security.'
      },
      id: {
        title: 'Kebijakan Privasi — Markimate',
        description: 'Kebijakan Privasi Markimate: Komitmen perlindungan privasi, integritas, dan keamanan data pengguna.'
      }
    },
    {
      cleanPath: '/terms',
      en: {
        title: 'Terms of Service — Markimate',
        description: 'Markimate Terms of Service: General conditions, acceptable usage policies, intellectual property, and user responsibilities.'
      },
      id: {
        title: 'Syarat & Ketentuan Layanan — Markimate',
        description: 'Syarat dan Ketentuan Penggunaan Layanan Markimate: Ketentuan umum, hak cipta, dan kewajiban pengguna.'
      }
    },
    {
      cleanPath: '/data-deletion',
      en: {
        title: 'Account Data Deletion Instructions — Markimate',
        description: 'Instructions and compliance guidelines for requesting account and personal data deletion on Markimate.'
      },
      id: {
        title: 'Instruksi Penghapusan Data Akun — Markimate',
        description: 'Petunjuk dan panduan penghapusan data akun Markimate sesuai standar privasi data.'
      }
    }
  ];

  // Tambahkan 16 halaman detail peran AI (roles)
  for (const role of ROLES) {
    staticPages.push({
      cleanPath: `/roles/${role.key}`,
      en: {
        title: `${role.name} — AI Marketing Role | Markimate`,
        description: role.description || `Autonomous AI marketing role for ${role.name}. Integrates with Markimate workspace.`
      },
      id: {
        title: `${role.name_id || role.name} — Peran AI Marketing | Markimate`,
        description: role.description_id || role.description || `Peran digital marketing AI otonom untuk ${role.name_id || role.name}.`
      }
    });
  }

  console.log(`Generating static HTML files for ${staticPages.length} public route pairs...`);

  const sitemapEntries = [];

  for (const page of staticPages) {
    const enPath = page.cleanPath;
    const idPath = page.cleanPath === '/' ? '/id' : `/id${page.cleanPath}`;

    const enUrl = `${SITE_URL}${enPath === '/' ? '' : enPath}`;
    const idUrl = `${SITE_URL}${idPath}`;

    sitemapEntries.push({
      enUrl,
      idUrl,
      cleanPath: page.cleanPath
    });

    for (const lang of ['en', 'id']) {
      const isId = lang === 'id';
      const meta = isId ? page.id : page.en;
      const canonicalUrl = isId ? idUrl : enUrl;
      const pageTitle = escapeHtml(meta.title);
      const pageDesc = escapeHtml(meta.description);
      const ogLocale = isId ? 'id_ID' : 'en_US';
      const ogLocaleAlt = isId ? 'en_US' : 'id_ID';

      const seoTags = `
    <!-- Pre-rendered Static SEO Tags (PRD F3 Langkah 3) -->
    <link rel="canonical" href="${canonicalUrl}" />
    <link rel="alternate" hreflang="en" href="${enUrl}" />
    <link rel="alternate" hreflang="id" href="${idUrl}" />
    <link rel="alternate" hreflang="x-default" href="${enUrl}" />
    <meta property="og:title" content="${pageTitle}" />
    <meta property="og:description" content="${pageDesc}" />
    <meta property="og:type" content="website" />
    <meta property="og:url" content="${canonicalUrl}" />
    <meta property="og:locale" content="${ogLocale}" />
    <meta property="og:locale:alternate" content="${ogLocaleAlt}" />
    <meta property="og:site_name" content="Markimate" />
    <meta property="og:image" content="${SITE_URL}/favicon.png" />
    <meta name="twitter:card" content="summary_large_image" />
    <meta name="twitter:title" content="${pageTitle}" />
    <meta name="twitter:description" content="${pageDesc}" />
    <meta name="twitter:image" content="${SITE_URL}/favicon.png" />
`;

      let html = templateHtml;

      // 1. Ganti tag html lang
      html = html.replace(/<html[^>]*lang=["'][^"']*["'][^>]*>/i, `<html lang="${lang}">`);

      // 2. Ganti title
      html = html.replace(/<title>.*?<\/title>/i, `<title>${pageTitle}</title>`);

      // 3. Ganti meta description
      html = html.replace(
        /<meta[^>]*name=["']description["'][^>]*>/i,
        `<meta name="description" content="${pageDesc}" />`
      );

      // 4. Sisipkan seoTags sebelum </head>
      html = html.replace('</head>', `${seoTags}</head>`);

      // Tentukan target file path di folder dist
      let targetFile;
      if (page.cleanPath === '/') {
        targetFile = isId
          ? path.join(distDir, 'id', 'index.html')
          : path.join(distDir, 'index.html');
      } else {
        const subPath = isId ? `id${page.cleanPath}` : page.cleanPath.replace(/^\//, '');
        targetFile = path.join(distDir, subPath, 'index.html');
      }

      const dir = path.dirname(targetFile);
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
      }

      fs.writeFileSync(targetFile, html, 'utf8');
    }
  }

  // ------------------------------------------------------------------
  // 5. Generate dist/sitemap.xml (Bilingual hreflang sitemap)
  // ------------------------------------------------------------------
  console.log('Generating dist/sitemap.xml with xhtml:link hreflang...');
  const nowIso = new Date().toISOString().split('T')[0];

  let sitemapXml = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9"
        xmlns:xhtml="http://www.w3.org/1999/xhtml">
`;

  for (const entry of sitemapEntries) {
    // URL EN (Kanonik)
    sitemapXml += `  <url>
    <loc>${entry.enUrl}</loc>
    <lastmod>${nowIso}</lastmod>
    <changefreq>${entry.cleanPath === '/' ? 'daily' : 'weekly'}</changefreq>
    <priority>${entry.cleanPath === '/' ? '1.0' : '0.8'}</priority>
    <xhtml:link rel="alternate" hreflang="en" href="${entry.enUrl}"/>
    <xhtml:link rel="alternate" hreflang="id" href="${entry.idUrl}"/>
    <xhtml:link rel="alternate" hreflang="x-default" href="${entry.enUrl}"/>
  </url>
`;

    // URL ID (Bilingual)
    sitemapXml += `  <url>
    <loc>${entry.idUrl}</loc>
    <lastmod>${nowIso}</lastmod>
    <changefreq>${entry.cleanPath === '/' ? 'daily' : 'weekly'}</changefreq>
    <priority>${entry.cleanPath === '/' ? '1.0' : '0.8'}</priority>
    <xhtml:link rel="alternate" hreflang="en" href="${entry.enUrl}"/>
    <xhtml:link rel="alternate" hreflang="id" href="${entry.idUrl}"/>
    <xhtml:link rel="alternate" hreflang="x-default" href="${entry.enUrl}"/>
  </url>
`;
  }

  sitemapXml += `</urlset>\n`;

  const sitemapPath = path.join(distDir, 'sitemap.xml');
  fs.writeFileSync(sitemapPath, sitemapXml, 'utf8');

  const robotsTxt = `User-agent: *
Allow: /
Disallow: /app/
Disallow: /api/

Sitemap: ${SITE_URL}/sitemap.xml
`;
  const robotsPath = path.join(distDir, 'robots.txt');
  fs.writeFileSync(robotsPath, robotsTxt, 'utf8');

  console.log(`✓ Successfully generated ${staticPages.length * 2} static HTML files.`);
  console.log(`✓ Successfully generated ${sitemapPath} with ${sitemapEntries.length * 2} URLs.`);
  console.log(`✓ Successfully generated ${robotsPath} with sitemap: ${SITE_URL}/sitemap.xml`);
}

run().catch((err) => {
  console.error('❌ Build SEO Pages failed:', err);
  process.exit(1);
});
