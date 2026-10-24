// backend/lib/ads-deck.js
// Deck Google Slides milik user untuk laporan iklan (PRD F5, opsi A):
// user menyalin template Markimate, membagikannya ke email layanan Markimate (Viewer),
// lalu menempelkan URL-nya di template. Backend tidak punya kredensial Google, jadi
// pengecekan akses & layout dijalankan oleh workflow n8n "Markimate Ads Deck Check".

import { parseSlidesId, ALLOWED_PAGE_TYPES } from '../shared/report-template.js';
import { getN8nApiKey } from './ads-runner.js';

export function getN8nAdsDeckCheckUrl() {
  const base = (process.env.N8N_BASE_URL || 'https://n8n.3ourasia.id').replace(/\/+$/, '');
  return process.env.MARKIMATE_N8N_ADS_DECK_CHECK_URL || `${base}/webhook/ads-deck-check`;
}

/**
 * Info yang dibutuhkan UI: email layanan (tujuan share) & link salin template Markimate.
 * Nilainya dari env supaya bisa diganti tanpa deploy ulang frontend.
 */
export function getDeckConfig() {
  const serviceEmail = (process.env.ADS_SERVICE_EMAIL || '').trim();
  const templateId = parseSlidesId(process.env.ADS_TEMPLATE_DECK_ID || '');
  return {
    serviceEmail: serviceEmail || null,
    templateDeckId: templateId,
    templateCopyUrl: templateId ? `https://docs.google.com/presentation/d/${templateId}/copy` : null,
    checkConfigured: Boolean(getN8nApiKey())
  };
}

/**
 * Cek deck lewat n8n. Hasil: { ok, code?, presentationId, title, layouts, missingLayouts, issues, ready, missingRequired }.
 * code: INVALID_DECK (URL salah) | ADS_DECK_UNAVAILABLE (tidak bisa dibaca / belum dibagikan)
 *       | ADS_SOURCE_UNAVAILABLE (n8n tidak bisa dihubungi).
 */
export async function checkDeck({ input, pageTypes, fetchFn = fetch, n8nUrl, n8nKey } = {}) {
  const presentationId = parseSlidesId(input);
  if (!presentationId) {
    return { ok: false, status: 400, code: 'INVALID_DECK', message: 'Not a valid Google Slides URL or ID' };
  }
  const apiKey = n8nKey || getN8nApiKey();
  if (!apiKey) {
    return { ok: false, status: 503, code: 'ADS_SOURCE_UNAVAILABLE', message: 'Deck check is not configured' };
  }

  let res;
  let body = null;
  try {
    res = await fetchFn(n8nUrl || getN8nAdsDeckCheckUrl(), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'X-Supermat-Key': apiKey, 'X-Markimate-Key': apiKey },
      body: JSON.stringify({ presentationId })
    });
    body = await res.json().catch(() => null);
  } catch (err) {
    console.error('[AdsDeck] Gagal menghubungi n8n deck check:', err.message);
    return { ok: false, status: 502, code: 'ADS_SOURCE_UNAVAILABLE', message: 'Deck check service is unavailable' };
  }

  if (!res.ok || !body || typeof body !== 'object') {
    return { ok: false, status: 502, code: 'ADS_SOURCE_UNAVAILABLE', message: `Deck check responded with HTTP ${res.status}` };
  }

  if (!body.accessible) {
    return {
      ok: false,
      status: 422,
      code: 'ADS_DECK_UNAVAILABLE',
      presentationId,
      httpStatus: body.httpStatus || null,
      message: body.message || 'Deck is not accessible'
    };
  }

  const layouts = Array.isArray(body.layouts) ? body.layouts.filter((l) => typeof l === 'string') : [];
  const issues = Array.isArray(body.issues)
    ? body.issues
      .filter((i) => i && typeof i === 'object' && typeof i.code === 'string')
      .slice(0, 50)
      .map((i) => ({
        code: i.code,
        slide: Number.isInteger(i.slide) ? i.slide : null,
        layout: typeof i.layout === 'string' ? i.layout : null,
        detail: typeof i.detail === 'string' ? i.detail.slice(0, 60) : null
      }))
    : [];
  // Layout yang dibutuhkan = jenis halaman di template yang sedang diedit (default: semua jenis).
  const wanted = Array.isArray(pageTypes) && pageTypes.length
    ? [...new Set(pageTypes.filter((p) => ALLOWED_PAGE_TYPES.includes(p)))]
    : ALLOWED_PAGE_TYPES;
  const missingRequired = wanted.filter((l) => !layouts.includes(l));
  return {
    ok: true,
    presentationId,
    title: typeof body.title === 'string' ? body.title : '',
    slideCount: Number(body.slideCount) || 0,
    layouts,
    missingLayouts: Array.isArray(body.missingLayouts) ? body.missingLayouts : [],
    issues,
    // Siap bila semua jenis halaman template punya layout. Kalau tidak, halaman itu dilewati saat generate (warning).
    ready: missingRequired.length === 0,
    missingRequired
  };
}
