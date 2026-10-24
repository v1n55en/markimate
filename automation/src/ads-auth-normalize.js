// automation/src/ads-auth-normalize.js
// Normalisasi & validasi input job pembuatan Ads Report (PRD F5)

const item = $input.first().json;

// 1. Validasi field wajib
if (!item.requestId) {
  return [{ json: { ok: false, error: 'requestId is required', statusCode: 400 } }];
}

if (!item.accounts || !Array.isArray(item.accounts) || item.accounts.length === 0) {
  return [{ json: { ok: false, error: 'At least one ad account is required', statusCode: 400, requestId: item.requestId } }];
}

if (!item.template || !Array.isArray(item.template.pages)) {
  return [{ json: { ok: false, error: 'Template with pages is required', statusCode: 400, requestId: item.requestId } }];
}

const template = item.template;
const period = item.period || {};
const start = period.start;
const end = period.end;

if (!start || !end) {
  return [{ json: { ok: false, error: 'Period start and end are required', statusCode: 400, requestId: item.requestId } }];
}

// 2. Hitung periode perbandingan (bulan sebelumnya / durasi hari yang sama)
const startDate = new Date(start);
const endDate = new Date(end);
const durationMs = endDate.getTime() - startDate.getTime();

const prevEndDate = new Date(startDate.getTime() - 24 * 60 * 60 * 1000);
const prevStartDate = new Date(prevEndDate.getTime() - durationMs);

const formatDate = (d) => d.toISOString().split('T')[0];

const prevPeriod = {
  start: formatDate(prevStartDate),
  end: formatDate(prevEndDate)
};

// 3. Analisis kebutuhan halaman dari template
const pages = template.pages;
const needsTrends = pages.some(p => p.type === 'trend');
const needsBreakdowns = pages.some(p => p.type === 'breakdown');
const needsCampaigns = pages.some(p => p.type === 'table');
const needsCreatives = pages.some(p => p.type === 'creatives');
const needsAiInsights = pages.some(p => p.type === 'ai_insight' || p.insight === true);

return [{
  json: {
    ok: true,
    requestId: item.requestId,
    reportId: item.reportId,
    workspaceId: item.workspaceId,
    template,
    accounts: item.accounts,
    period: { start, end },
    prevPeriod,
    compare: item.compare !== false,
    conversionEvent: item.conversionEvent || 'purchase',
    currency: item.currency || template.currency || 'IDR',
    recipients: item.recipients || [],
    owner: item.owner || {},
    callbackUrl: item.callbackUrl,
    needsTrends,
    needsBreakdowns,
    needsCampaigns,
    needsCreatives,
    needsAiInsights,
    warnings: []
  }
}];
