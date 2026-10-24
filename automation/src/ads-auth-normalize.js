// automation/src/ads-auth-normalize.js
// Validasi payload laporan iklan + konfigurasi workflow (PRD F5 §3.7).
// API key sudah divalidasi node Webhook (Header Auth). Node ini memastikan payload lengkap
// dan konfigurasi base deck terisi. Kalau gagal → balas 4xx/503 secara sinkron sehingga
// backend langsung me-rollback kredit (tidak perlu menunggu timeout 15 menit).

// ===== KONFIGURASI (diisi 3Our setelah import, lihat automation/ADS-BASE-DECK.md) =====
const CONFIG = {
  baseDeckId: 'GANTI_DENGAN_ID_BASE_DECK',        // ID Google Slides "Markimate Base Deck"
  reportsFolderId: 'GANTI_DENGAN_ID_FOLDER',       // ID folder Drive "Markimate Reports"
  graphVersion: 'v23.0',
  geminiModel: 'gemini-2.5-flash'
};
// ======================================================================================

const body = $input.first().json.body || $input.first().json;
const fail = (statusCode, error) => [{ json: { ok: false, statusCode, error, requestId: body.requestId || null } }];

if (!body.requestId || typeof body.requestId !== 'string') return fail(400, 'requestId is required');
if (!body.callbackUrl || !/^https:\/\//.test(String(body.callbackUrl))) return fail(400, 'callbackUrl (https) is required');
if (!body.template || !Array.isArray(body.template.pages) || body.template.pages.length === 0) return fail(400, 'template.pages is required');
if (body.template.pages.length > 20) return fail(400, 'template has more than 20 pages');
if (!Array.isArray(body.accounts) || body.accounts.length === 0) return fail(400, 'at least one ad account is required');

const isDate = (s) => typeof s === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(s);
const period = body.period || {};
if (!isDate(period.start) || !isDate(period.end) || period.start > period.end) return fail(400, 'period.start/end (YYYY-MM-DD) is invalid');

if (/^GANTI_/.test(CONFIG.baseDeckId) || /^GANTI_/.test(CONFIG.reportsFolderId)) {
  return fail(503, 'Ads report workflow is not configured (baseDeckId / reportsFolderId)');
}

const accounts = body.accounts
  .filter((a) => a && a.platform === 'meta' && a.externalId && a.accessToken)
  .map((a) => ({
    id: a.id,
    externalId: String(a.externalId).startsWith('act_') ? String(a.externalId) : `act_${a.externalId}`,
    name: a.name || String(a.externalId),
    currency: a.currency || null,
    timezone: a.timezone || null,
    accessToken: a.accessToken
  }));
if (accounts.length === 0) return fail(400, 'no Meta ad account with access token in payload');

// Periode pembanding = rentang hari yang sama tepat sebelum periode laporan
const DAY = 86400000;
const toDate = (s) => new Date(`${s}T00:00:00Z`);
const fmt = (d) => d.toISOString().slice(0, 10);
const days = Math.round((toDate(period.end) - toDate(period.start)) / DAY) + 1;
const sD = toDate(period.start);
const eD = toDate(period.end);
const isFullMonths = sD.getUTCDate() === 1 && new Date(eD.getTime() + DAY).getUTCDate() === 1;
let prevStart;
let prevEnd = new Date(sD.getTime() - DAY);
if (isFullMonths) {
  // laporan bulanan → bandingkan dengan bulan kalender sebelumnya (sama seperti WF 3Our "bulan lalu")
  const nMonths = (eD.getUTCFullYear() - sD.getUTCFullYear()) * 12 + (eD.getUTCMonth() - sD.getUTCMonth()) + 1;
  prevStart = new Date(Date.UTC(sD.getUTCFullYear(), sD.getUTCMonth() - nMonths, 1));
} else {
  prevStart = new Date(prevEnd.getTime() - (days - 1) * DAY);
}

const template = body.template;
const owner = body.owner || {};
const locale = (owner.locale || template.locale || 'id') === 'en' ? 'en' : 'id';

return [{
  json: {
    ok: true,
    config: { baseDeckId: CONFIG.baseDeckId, reportsFolderId: CONFIG.reportsFolderId, graphVersion: CONFIG.graphVersion, geminiModel: CONFIG.geminiModel },
    requestId: body.requestId,
    reportId: body.reportId || null,
    workspaceId: String(body.workspaceId || 'unknown').replace(/[^A-Za-z0-9_-]/g, ''),
    workspaceName: body.workspaceName || '',
    callbackUrl: body.callbackUrl,
    template,
    accounts,
    period: { start: period.start, end: period.end, days },
    prevPeriod: { start: fmt(prevStart), end: fmt(prevEnd) },
    compare: body.compare !== false,
    conversionEvent: body.conversionEvent || 'purchase',
    currency: body.currency || template.currency || 'IDR',
    customMetrics: Array.isArray(body.customMetrics) ? body.customMetrics : [],
    recipients: Array.isArray(body.recipients) ? body.recipients.filter((e) => typeof e === 'string' && e.includes('@')) : [],
    owner: { email: owner.email || null, locale },
    locale
  }
}];
