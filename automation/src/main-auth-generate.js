// 3Our Supermat API — validasi API key & normalisasi input untuk endpoint GENERATE
// API key (header X-Supermat-Key) divalidasi oleh node Webhook (Header Auth, credential "Supermat API Key (Header)").
// Request tanpa key yang benar sudah ditolak 403 sebelum sampai ke node ini. Key TIDAK ditulis di kode/repo.
const headers = $json.headers || {};
const body = $json.body || {};
const ok = true;

const keyword = String(body.keyword || body.query || '').trim();
let statusCode = 200, error = '';
if (!ok) { statusCode = 401; error = 'API key tidak valid. Kirim header X-Supermat-Key.'; }
else if (!keyword) { statusCode = 400; error = 'Field "keyword" wajib diisi.'; }

return [{ json: {
  ok: statusCode === 200, statusCode, error,
  keyword,
  geo: String(body.Geo || body.geo || 'ID').toUpperCase(),
  ln: String(body.Ln || body.ln || 'id').toLowerCase(),
  clientName: String(body.Client_Name || body.clientName || body.brandName || 'Brand Anda').trim(),
  niche: String(body.niche || '').trim(),
  tone: String(body.tone || '').trim(),
  wordCount: Math.min(Math.max(Number(body.wordCount) || 800, 400), 2500),
  requestId: String(body.requestId || ('req_' + Date.now().toString(36))),
  callbackUrl: String(body.callbackUrl || '').trim(),
  // --- Fase 6 & PRD F6b: CMS (opsional) untuk cek duplikat & internal link + opsi artikel ---
  cmsType: ['wordpress', 'wix', 'sanity', 'shopify'].includes(String(body.cmsType || '').toLowerCase()) ? String(body.cmsType).toLowerCase() : '',
  cms: body.cms && typeof body.cms === 'object' ? body.cms : {},
  options: normalizeOptions(body.options),
} }];

function normalizeOptions(o) {
  o = o && typeof o === 'object' ? o : {};
  const b = (v, d) => (v === undefined || v === null ? d : !!v);
  const n = (v, d, lo, hi) => { const x = Number(v); return Number.isFinite(x) ? Math.min(Math.max(x, lo), hi) : d; };
  const imageMode = ['none', 'auto', 'manual'].includes(o.imageMode) ? o.imageMode : (o.imagePrompts === false ? 'none' : 'auto');
  const imageCount = imageMode === 'none' ? 0 : n(o.imageCount, 3, 0, 6);
  const imageHero = b(o.imageHero, true);

  return {
    duplicateCheck: b(o.duplicateCheck, true), duplicateThreshold: n(o.duplicateThreshold, 0.7, 0.4, 0.95),
    internalLinks: b(o.internalLinks, true), maxInternal: n(o.maxInternal, 4, 0, 8), siteBaseUrl: String(o.siteBaseUrl || '').trim(),
    externalLinks: b(o.externalLinks, true), maxExternal: n(o.maxExternal, 2, 0, 5),
    excludeDomains: Array.isArray(o.excludeDomains) && o.excludeDomains.length ? o.excludeDomains.map(String) : ['facebook.com', 'instagram.com', 'tiktok.com', 'youtube.com', 'shopee.co.id', 'tokopedia.com', 'x.com', 'twitter.com', 'pinterest.com', 'linkedin.com'],
    imagePrompts: imageMode !== 'none',
    imageCount,
    imageMode,
    imageHero,
    imageStyle: String(o.imageStyle || 'foto editorial realistis, pencahayaan natural, warna hangat, tanpa teks atau logo di dalam gambar').trim(),
  };
}
