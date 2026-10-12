// Fase 6 — Endpoint TOPIK OTOMATIS: validasi & normalisasi input
// Body: { seedKeywords:[...], Geo, Ln, cmsType?, cms?, limit?, minVolume?, duplicateThreshold?, requestId? }
const body = $json.body || {};
const seeds = [...new Set((Array.isArray(body.seedKeywords) ? body.seedKeywords : String(body.seedKeywords || body.keyword || '').split(',')).map(s => String(s || '').trim().toLowerCase()).filter(Boolean))].slice(0, 10);
let statusCode = 200, error = '';
if (!seeds.length) { statusCode = 400; error = 'Field "seedKeywords" wajib diisi (array, maks 10).'; }
const n = (v, d, lo, hi) => { const x = Number(v); return Number.isFinite(x) ? Math.min(Math.max(x, lo), hi) : d; };
return [{ json: {
  ok: statusCode === 200, statusCode, error,
  seeds,
  geo: String(body.Geo || body.geo || 'ID').toUpperCase(), ln: String(body.Ln || body.ln || 'id').toLowerCase(),
  cmsType: ['wordpress', 'wix', 'sanity', 'shopify'].includes(String(body.cmsType || '').toLowerCase()) ? String(body.cmsType).toLowerCase() : '',
  cms: body.cms && typeof body.cms === 'object' ? body.cms : {},
  limit: n(body.limit, 3, 1, 10), minVolume: n(body.minVolume, 50, 0, 100000), duplicateThreshold: n(body.duplicateThreshold, 0.7, 0.4, 0.95),
  siteBaseUrl: String((body.options || {}).siteBaseUrl || body.siteBaseUrl || '').trim(),
  requestId: String(body.requestId || ('top_' + Date.now().toString(36))),
} }];
