// automation/src/ads-fetch-meta.js
// Ambil data Meta Insights ASLI per akun (PRD F5 §3.7 langkah 2).
// - Hanya endpoint yang dipakai template yang dipanggil (hemat kuota API).
// - Token dikirim lewat header Authorization (tidak masuk URL/log).
// - Error per akun → warning; laporan tetap dibuat dari akun lain.
//   Kalau SEMUA akun gagal → throw ADS_SOURCE_UNAVAILABLE (diteruskan ke callback error → refund).
// - Tidak ada data contoh/palsu: kalau data kosong, laporan menampilkan "—".

const job = $input.first().json;
const http = this.helpers.httpRequest.bind(this.helpers);
const GRAPH = `https://graph.facebook.com/${job.config.graphVersion}`;
const pages = job.template.pages || [];
const warnings = [];

// ---------- kebutuhan data dari template ----------
const hasKpi = pages.some((p) => p.type === 'kpi');
const needPrev = job.compare && pages.some((p) => p.type === 'kpi' && p.compare !== false);
const needDaily = pages.some((p) => (p.type === 'trend' && p.granularity !== 'month') || (p.type === 'table' && ['day', 'week'].includes(p.dimension)));
const monthPages = pages.filter((p) => p.type === 'trend' && p.granularity === 'month');
const months = Math.min(24, Math.max(1, ...monthPages.map((p) => Number(p.months) || 6), 1));
const BREAKDOWNS = {
  publisher_platform: 'publisher_platform',
  placement: 'publisher_platform,platform_position',
  age: 'age',
  gender: 'gender',
  age_gender: 'age,gender'
};
const bdDims = [...new Set(pages.filter((p) => p.type === 'breakdown' && BREAKDOWNS[p.dimension]).map((p) => p.dimension))];
const needAdset = pages.some((p) => p.type === 'table' && p.dimension === 'adset');
const needAds = pages.some((p) => p.type === 'creatives' || (p.type === 'table' && p.dimension === 'ad'));

const BASE_FIELDS = 'spend,impressions,reach,clicks,inline_link_clicks,actions,action_values,video_play_actions';
const RESULT_FIELDS = `${BASE_FIELDS},results`;

const range = (s, e) => JSON.stringify({ since: s, until: e });
const monthStart = (() => {
  const d = new Date(`${job.period.start}T00:00:00Z`);
  d.setUTCDate(1);
  d.setUTCMonth(d.getUTCMonth() - (months - 1));
  return d.toISOString().slice(0, 10);
})();

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

function graphError(res) {
  const e = (res && res.body && res.body.error) || {};
  return { status: res ? res.statusCode : 0, code: e.code, message: e.message || `HTTP ${res ? res.statusCode : '?'}` };
}

// GET dengan pagination + 1x retry untuk rate limit (kode 4/17/80004) atau 5xx
async function getAll(path, qs, token) {
  const rows = [];
  let url = `${GRAPH}/${path}`;
  let params = { ...qs, limit: qs.limit || 500 };
  for (let page = 0; page < 20 && url; page++) {
    let res;
    for (let attempt = 0; attempt < 2; attempt++) {
      res = await http({
        method: 'GET',
        url,
        qs: params,
        headers: { Authorization: `Bearer ${token}` },
        json: true,
        returnFullResponse: true,
        ignoreHttpStatusErrors: true,
        timeout: 60000
      });
      const err = graphError(res);
      const retryable = res.statusCode >= 500 || [4, 17, 80004].includes(err.code);
      if (res.statusCode < 400 || !retryable || attempt === 1) break;
      await sleep(3000);
    }
    if (res.statusCode >= 400 || (res.body && res.body.error)) {
      const err = graphError(res);
      const e = new Error(err.message);
      e.graph = err;
      throw e;
    }
    rows.push(...((res.body && res.body.data) || []));
    url = res.body && res.body.paging && res.body.paging.next;
    params = undefined; // URL "next" sudah membawa semua parameter
  }
  return rows;
}

const accountsOut = [];
for (const acc of job.accounts) {
  const tok = acc.accessToken;
  const out = { id: acc.id, externalId: acc.externalId, name: acc.name, currency: acc.currency, ok: true, data: {} };
  const insights = (qs) => getAll(`${acc.externalId}/insights`, qs, tok);
  const cur = range(job.period.start, job.period.end);
  const prev = range(job.prevPeriod.start, job.prevPeriod.end);

  // Permintaan utama: kalau ini gagal (token kedaluwarsa, izin dicabut, akun nonaktif) akun dilewati.
  try {
    const acct = await insights({ level: 'account', fields: `account_name,account_currency,${BASE_FIELDS}`, time_range: cur });
    out.data.account = acct;
    if (acct[0] && acct[0].account_currency) out.currency = acct[0].account_currency;
    if (acct[0] && acct[0].account_name) out.name = acct[0].account_name;
  } catch (e) {
    out.ok = false;
    const g = e.graph || {};
    out.error = { code: g.code || null, message: e.message };
    warnings.push(`account_unavailable:${acc.externalId}:${g.code || 'ERR'}`);
    accountsOut.push(out);
    continue;
  }

  const optional = async (key, qs) => {
    try {
      out.data[key] = await insights(qs);
    } catch (e) {
      out.data[key] = [];
      warnings.push(`fetch_failed:${acc.externalId}:${key}:${(e.graph && e.graph.code) || 'ERR'}`);
    }
  };

  // results hanya akurat di level campaign (sama seperti WF 3Our v3.2)
  await optional('campaigns', { level: 'campaign', fields: `campaign_id,campaign_name,objective,${RESULT_FIELDS}`, time_range: cur });
  if (needPrev) {
    await optional('accountPrev', { level: 'account', fields: BASE_FIELDS, time_range: prev });
    await optional('campaignsPrev', { level: 'campaign', fields: `campaign_id,${RESULT_FIELDS}`, time_range: prev });
  }
  if (needDaily) await optional('daily', { level: 'campaign', fields: `campaign_id,${RESULT_FIELDS}`, time_range: cur, time_increment: 1 });
  if (monthPages.length) await optional('monthly', { level: 'campaign', fields: `campaign_id,${RESULT_FIELDS}`, time_range: range(monthStart, job.period.end), time_increment: 'monthly' });
  for (const dim of bdDims) {
    await optional(`bd_${dim}`, { level: 'campaign', fields: `campaign_id,${RESULT_FIELDS}`, time_range: cur, breakdowns: BREAKDOWNS[dim] });
  }
  if (needAdset) await optional('adsets', { level: 'adset', fields: `adset_id,adset_name,${RESULT_FIELDS}`, time_range: cur });
  if (needAds) await optional('ads', { level: 'ad', fields: `ad_id,ad_name,campaign_name,${RESULT_FIELDS}`, time_range: cur, sort: 'spend_descending' });

  accountsOut.push(out);
}

const okAccounts = accountsOut.filter((a) => a.ok);
if (okAccounts.length === 0) {
  // Tanpa ': ' di pesan — task runner n8n memotong teks sebelum ': ' pada pesan error
  throw new Error(`ADS_SOURCE_UNAVAILABLE - ${accountsOut.map((a) => `${a.externalId} (${String(a.error && a.error.message).replace(/:\s*/g, ' - ')})`).join('; ')}`);
}

// Kurs: hanya kalau mata uang akun berbeda dari mata uang laporan
let fx = null;
const reportCur = String(job.currency || 'IDR').toUpperCase();
const foreign = [...new Set(okAccounts.map((a) => String(a.currency || reportCur).toUpperCase()).filter((c) => c !== reportCur))];
if (foreign.length) {
  try {
    const res = await http({ method: 'GET', url: `https://open.er-api.com/v6/latest/${reportCur}`, json: true, timeout: 20000 });
    if (res && res.result === 'success' && res.rates) {
      fx = { base: reportCur, source: 'open.er-api.com', date: res.time_last_update_utc || null, rates: {} };
      for (const c of foreign) {
        if (res.rates[c]) fx.rates[c] = res.rates[c];
        else warnings.push(`fx_missing:${c}`);
      }
    } else {
      warnings.push('fx_unavailable');
    }
  } catch (e) {
    warnings.push('fx_unavailable');
  }
}

return [{
  json: {
    requestId: job.requestId,
    fetched: { accounts: accountsOut.map(({ ok, error, ...rest }) => ({ ok, error: error || null, ...rest })), fx, monthStart, months },
    warnings
  }
}];
