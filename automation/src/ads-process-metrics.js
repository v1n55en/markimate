// automation/src/ads-process-metrics.js
// Normalisasi data Meta → hitung metrics (modul SSOT shared/ads-metrics.js, di-inline saat build)
// → susun model per halaman template (teks, KPI, tabel, data grafik, creative) + prompt AI.
// PRD F5 §3.2, §3.3, §3.7 langkah 2/2a.

// ==== shared/ads-metrics.js (di-inline oleh build-workflows.mjs) ====
__ADS_METRICS__
// =====================================================================

const job = $('Auth & Normalize (Ads)').first().json;
const fetched = $input.first().json.fetched;
const warnings = [...($input.first().json.warnings || [])];
const http = this.helpers.httpRequest.bind(this.helpers);

const locale = job.locale === 'en' ? 'en' : 'id';
const L = (id, en) => (locale === 'en' ? en : id);
const reportCur = String(job.currency || 'IDR').toUpperCase();
const customMetrics = (job.customMetrics || []).map((c) => ({ ...c, id: String(c.id).startsWith('custom:') ? c.id : `custom:${c.id}` }));
const customById = Object.fromEntries(customMetrics.map((c) => [c.id, c]));
const okAccounts = fetched.accounts.filter((a) => a.ok);

// ---------------- normalisasi baris Meta ----------------
const num = (v) => {
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
};
const ACTION_TYPES = {
  purchase: ['omni_purchase', 'purchase', 'offsite_conversion.fb_pixel_purchase'],
  lead: ['lead', 'onsite_conversion.lead_grouped', 'offsite_conversion.fb_pixel_lead']
};
function pickAction(arr, types) {
  if (!Array.isArray(arr)) return 0;
  for (const t of types) {
    const f = arr.find((a) => a.action_type === t);
    if (f) return num(f.value);
  }
  return 0;
}
const sumVals = (arr) => (Array.isArray(arr) ? arr.reduce((s, x) => s + num(x && x.values && x.values[0] ? x.values[0].value : x && x.value), 0) : null);
const convTypes = ACTION_TYPES[job.conversionEvent] || [job.conversionEvent];

function fxFactor(acc) {
  const cur = String(acc.currency || reportCur).toUpperCase();
  if (cur === reportCur) return 1;
  const rate = fetched.fx && fetched.fx.rates && fetched.fx.rates[cur];
  return rate ? 1 / rate : 1;
}

function normalize(row, factor) {
  if (!row) return null;
  return {
    spend: num(row.spend) * factor,
    impressions: num(row.impressions),
    reach: row.reach === undefined ? null : num(row.reach),
    clicks: num(row.clicks),
    link_clicks: num(row.inline_link_clicks),
    conversions: pickAction(row.actions, convTypes),
    conversion_value: pickAction(row.action_values, convTypes) * factor,
    leads: pickAction(row.actions, ACTION_TYPES.lead),
    purchases: pickAction(row.actions, ACTION_TYPES.purchase),
    video_views: sumVals(row.video_play_actions) || 0,
    results: row.results === undefined ? null : sumVals(row.results),
    purchase_value: pickAction(row.action_values, ACTION_TYPES.purchase) * factor
  };
}
const agg = (rows) => aggregateRows(rows.filter(Boolean), { customMetrics });

// ---------------- total periode & pembanding ----------------
function accountTotals(acc, accKey, campKey) {
  const f = fxFactor(acc);
  const accRow = normalize((acc.data[accKey] || [])[0], f);
  if (!accRow) return null;
  const camps = acc.data[campKey];
  // results tidak tersedia di level account → jumlahkan dari level campaign
  accRow.results = Array.isArray(camps) ? camps.reduce((s, c) => s + (sumVals(c.results) || 0), 0) : null;
  return accRow;
}
const perAccountCur = okAccounts.map((a) => ({ acc: a, m: agg([accountTotals(a, 'account', 'campaigns')]) }));
const totals = agg(okAccounts.map((a) => accountTotals(a, 'account', 'campaigns')));
const prevRows = okAccounts.map((a) => (a.data.accountPrev ? accountTotals(a, 'accountPrev', 'campaignsPrev') : null)).filter(Boolean);
const prevTotals = prevRows.length ? agg(prevRows) : null;

// ---------------- format ----------------
const NF = (opts) => new Intl.NumberFormat(locale === 'en' ? 'en-US' : 'id-ID', opts);
const CUR_DEC = ['IDR', 'JPY', 'KRW', 'VND'].includes(reportCur) ? 0 : 2;
const LOWER_IS_BETTER = new Set(['cpc', 'cpm', 'cpa', 'cost_per_result', 'cost_per_purchase']);

function metricDef(id) {
  if (customById[id]) {
    const c = customById[id];
    return { unit: c.unit || 'number', decimals: Number.isFinite(Number(c.decimals)) ? Number(c.decimals) : 2, label: c.name || id };
  }
  const d = ALL_METRICS[id];
  if (!d) return { unit: 'number', decimals: 0, label: id };
  return { unit: d.unit, decimals: null, label: (d.labels && d.labels[locale]) || id };
}
const label = (id) => metricDef(id).label;
function fmt(id, v) {
  if (v === null || v === undefined || !Number.isFinite(Number(v))) return '—';
  const d = metricDef(id);
  const n = Number(v);
  if (d.unit === 'currency') return NF({ style: 'currency', currency: reportCur, maximumFractionDigits: CUR_DEC, minimumFractionDigits: CUR_DEC }).format(n);
  if (d.unit === 'percent') return `${NF({ maximumFractionDigits: 2, minimumFractionDigits: 2 }).format(n * 100)}%`;
  if (d.unit === 'ratio') return `${NF({ maximumFractionDigits: 2, minimumFractionDigits: 2 }).format(n)}x`;
  return NF({ maximumFractionDigits: d.decimals === null ? 0 : d.decimals }).format(n);
}
function delta(id, cur, prev) {
  if (cur === null || cur === undefined || prev === null || prev === undefined || Number(prev) === 0) return { text: '', dir: 0 };
  const pct = (Number(cur) - Number(prev)) / Math.abs(Number(prev));
  const dir = pct > 0.0005 ? 1 : pct < -0.0005 ? -1 : 0;
  const good = LOWER_IS_BETTER.has(id) ? dir < 0 : id === 'spend' ? null : dir > 0;
  const arrow = dir > 0 ? '▲' : dir < 0 ? '▼' : '=';
  return { text: `${arrow} ${NF({ maximumFractionDigits: 1, minimumFractionDigits: 1 }).format(Math.abs(pct) * 100)}%`, dir, good };
}
// nilai mentah untuk grafik (persen → ×100)
const chartVal = (id, v) => (v === null || v === undefined || !Number.isFinite(Number(v)) ? 0 : metricDef(id).unit === 'percent' ? Math.round(Number(v) * 10000) / 100 : Math.round(Number(v) * 100) / 100);
const chartLabel = (id) => (metricDef(id).unit === 'percent' ? `${label(id)} (%)` : label(id));

const MONTHS = {
  id: ['Jan', 'Feb', 'Mar', 'Apr', 'Mei', 'Jun', 'Jul', 'Agu', 'Sep', 'Okt', 'Nov', 'Des'],
  en: ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']
};
const MONTHS_LONG = {
  id: ['Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni', 'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember'],
  en: ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December']
};
function periodLabel(s, e) {
  const a = new Date(`${s}T00:00:00Z`);
  const b = new Date(`${e}T00:00:00Z`);
  const lastDay = new Date(Date.UTC(b.getUTCFullYear(), b.getUTCMonth() + 1, 0)).getUTCDate();
  if (a.getUTCDate() === 1 && b.getUTCDate() === lastDay && a.getUTCMonth() === b.getUTCMonth() && a.getUTCFullYear() === b.getUTCFullYear()) {
    return `${MONTHS_LONG[locale][a.getUTCMonth()]} ${a.getUTCFullYear()}`;
  }
  const d = (x) => `${x.getUTCDate()} ${MONTHS[locale][x.getUTCMonth()]} ${x.getUTCFullYear()}`;
  return `${d(a)} – ${d(b)}`;
}
const PERIOD = periodLabel(job.period.start, job.period.end);
const ACCOUNT_NAMES = okAccounts.map((a) => a.name).join(', ');

function applyPh(text) {
  return String(text || '')
    .replace(/\{\{\s*period\s*\}\}/g, PERIOD)
    .replace(/\{\{\s*account_name\s*\}\}/g, ACCOUNT_NAMES)
    .replace(/\{\{\s*ads_platform\s*\}\}/g, 'Meta Ads')
    .replace(/\{\{\s*(client_name|workspace_name)\s*\}\}/g, job.workspaceName || ACCOUNT_NAMES)
    .replace(/\{\{\s*metric:([a-z0-9_:\-]+)\s*\}\}/gi, (m, id) => fmt(id, totals[id]));
}

// ---------------- pengelompokan ----------------
function groupBy(rowsWithAcc, keyFn, nameFn) {
  const groups = new Map();
  for (const { row, acc } of rowsWithAcc) {
    const key = keyFn(row);
    if (key === null || key === undefined) continue;
    if (!groups.has(key)) groups.set(key, { key, name: nameFn ? nameFn(row) : key, rows: [] });
    groups.get(key).rows.push(normalize(row, fxFactor(acc)));
  }
  return [...groups.values()].map((g) => ({ key: g.key, name: g.name, m: agg(g.rows) }));
}
const rowsOf = (key) => okAccounts.flatMap((acc) => (acc.data[key] || []).map((row) => ({ row, acc })));

const OBJECTIVES = {
  OUTCOME_SALES: ['Penjualan', 'Sales'], OUTCOME_LEADS: ['Prospek', 'Leads'], OUTCOME_TRAFFIC: ['Traffic', 'Traffic'],
  OUTCOME_ENGAGEMENT: ['Interaksi', 'Engagement'], OUTCOME_AWARENESS: ['Awareness', 'Awareness'], OUTCOME_APP_PROMOTION: ['Promosi Aplikasi', 'App Promotion'],
  CONVERSIONS: ['Konversi', 'Conversions'], LINK_CLICKS: ['Traffic', 'Traffic'], MESSAGES: ['Pesan', 'Messages'],
  REACH: ['Jangkauan', 'Reach'], BRAND_AWARENESS: ['Awareness', 'Awareness'], VIDEO_VIEWS: ['Video Views', 'Video Views'], POST_ENGAGEMENT: ['Interaksi', 'Engagement']
};
const cap = (s) => String(s || '').replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
const GENDER = { male: ['Pria', 'Male'], female: ['Wanita', 'Female'], unknown: ['Tidak diketahui', 'Unknown'] };
const gender = (g) => (GENDER[g] ? GENDER[g][locale === 'en' ? 1 : 0] : cap(g));
const objective = (o) => (OBJECTIVES[o] ? OBJECTIVES[o][locale === 'en' ? 1 : 0] : cap(o || L('Lainnya', 'Other')));

function breakdownGroups(dim) {
  if (dim === 'objective') return groupBy(rowsOf('campaigns'), (r) => r.objective || 'OTHER', (r) => objective(r.objective));
  const rows = rowsOf(`bd_${dim}`);
  if (dim === 'publisher_platform') return groupBy(rows, (r) => r.publisher_platform, (r) => cap(r.publisher_platform));
  if (dim === 'placement') return groupBy(rows, (r) => `${r.publisher_platform}|${r.platform_position}`, (r) => `${cap(r.publisher_platform)} · ${cap(r.platform_position)}`);
  if (dim === 'age') return groupBy(rows, (r) => r.age, (r) => r.age);
  if (dim === 'gender') return groupBy(rows, (r) => r.gender, (r) => gender(r.gender));
  if (dim === 'age_gender') return groupBy(rows, (r) => `${r.age}|${r.gender}`, (r) => `${r.age} ${gender(r.gender)}`);
  return [];
}

function isoWeekStart(dateStr) {
  const d = new Date(`${dateStr}T00:00:00Z`);
  const day = (d.getUTCDay() + 6) % 7;
  d.setUTCDate(d.getUTCDate() - day);
  return d.toISOString().slice(0, 10);
}
const dayLabel = (s) => {
  const d = new Date(`${s}T00:00:00Z`);
  return `${d.getUTCDate()} ${MONTHS[locale][d.getUTCMonth()]}`;
};
const monthLabel = (s) => {
  const d = new Date(`${s}T00:00:00Z`);
  return `${MONTHS[locale][d.getUTCMonth()]} ${String(d.getUTCFullYear()).slice(2)}`;
};

function sortRows(groups, sortSpec, fallback) {
  const spec = sortSpec || fallback || '-spend';
  const desc = spec.startsWith('-');
  const key = spec.replace(/^[-+]/, '');
  return [...groups].sort((a, b) => {
    const va = a.m[key];
    const vb = b.m[key];
    if (va === null || va === undefined) return 1;
    if (vb === null || vb === undefined) return -1;
    return desc ? vb - va : va - vb;
  });
}

function tableGroups(dim) {
  if (dim === 'campaign') return groupBy(rowsOf('campaigns'), (r) => r.campaign_id, (r) => r.campaign_name);
  if (dim === 'adset') return groupBy(rowsOf('adsets'), (r) => r.adset_id, (r) => r.adset_name);
  if (dim === 'ad') return groupBy(rowsOf('ads'), (r) => r.ad_id, (r) => r.ad_name);
  if (dim === 'account') return perAccountCur.map(({ acc, m }) => ({ key: acc.externalId, name: acc.name, m }));
  if (dim === 'platform') return [{ key: 'meta', name: 'Meta Ads', m: totals }];
  if (dim === 'day') return groupBy(rowsOf('daily'), (r) => r.date_start, (r) => dayLabel(r.date_start));
  if (dim === 'week') return groupBy(rowsOf('daily'), (r) => isoWeekStart(r.date_start), (r) => `${L('Minggu', 'Week of')} ${dayLabel(isoWeekStart(r.date_start))}`);
  return [];
}
const DIM_LABEL = {
  campaign: ['Campaign', 'Campaign'], adset: ['Ad Set', 'Ad Set'], ad: ['Iklan', 'Ad'], account: ['Akun', 'Account'],
  platform: ['Platform', 'Platform'], day: ['Tanggal', 'Date'], week: ['Minggu', 'Week']
};

// ---------------- creative ----------------
const adGroups = okAccounts.length ? groupBy(rowsOf('ads'), (r) => r.ad_id, (r) => r.ad_name) : [];
const adAccount = new Map(rowsOf('ads').map(({ row, acc }) => [row.ad_id, acc]));
const usedAds = new Set();
async function creativeImage(adId) {
  const acc = adAccount.get(adId);
  const tokenAcc = job.accounts.find((a) => a.externalId === (acc && acc.externalId));
  if (!tokenAcc) return null;
  try {
    const res = await http({
      method: 'GET',
      url: `https://graph.facebook.com/${job.config.graphVersion}/${adId}`,
      qs: { fields: 'creative{image_url,thumbnail_url}', thumbnail_width: 600, thumbnail_height: 600 },
      headers: { Authorization: `Bearer ${tokenAcc.accessToken}` },
      json: true,
      returnFullResponse: true,
      ignoreHttpStatusErrors: true,
      timeout: 30000
    });
    const c = res.statusCode < 400 && res.body && res.body.creative;
    return (c && (c.image_url || c.thumbnail_url)) || null;
  } catch (e) {
    return null;
  }
}

// ---------------- susun halaman ----------------
const model = [];
const charts = [];
const aiTasks = [];
const aiFacts = [];

aiFacts.push(`${L('Periode', 'Period')}: ${PERIOD} (${job.period.start} s.d. ${job.period.end})`);
aiFacts.push(`${L('Akun', 'Accounts')}: ${ACCOUNT_NAMES}`);
for (const id of ['spend', 'impressions', 'reach', 'clicks', 'ctr', 'cpc', 'cpm', 'results', 'cost_per_result', 'conversions', 'cpa', 'conversion_value', 'roas']) {
  const d = prevTotals ? delta(id, totals[id], prevTotals[id]).text : '';
  aiFacts.push(`- ${label(id)}: ${fmt(id, totals[id])}${prevTotals ? ` (${L('periode lalu', 'previous')}: ${fmt(id, prevTotals[id])}${d ? `, ${d}` : ''})` : ''}`);
}
const topCamps = sortRows(groupBy(rowsOf('campaigns'), (r) => r.campaign_id, (r) => r.campaign_name), '-spend').slice(0, 8);
if (topCamps.length) {
  aiFacts.push(L('Campaign teratas (biaya):', 'Top campaigns (spend):'));
  for (const c of topCamps) aiFacts.push(`- ${c.name}: ${label('spend')} ${fmt('spend', c.m.spend)}, ${label('results')} ${fmt('results', c.m.results)}, ${label('cost_per_result')} ${fmt('cost_per_result', c.m.cost_per_result)}, CTR ${fmt('ctr', c.m.ctr)}`);
}

for (let i = 0; i < job.template.pages.length; i++) {
  const p = job.template.pages[i];
  const page = { index: i, type: p.type, title: applyPh(p.title || ''), subtitle: applyPh(p.subtitle || '') };

  if (p.type === 'kpi') {
    const ids = (p.metrics || []).slice(0, 8);
    page.kpis = ids.map((id) => {
      const d = prevTotals && p.compare !== false ? delta(id, totals[id], prevTotals[id]) : { text: '', dir: 0 };
      return { id, label: label(id), value: fmt(id, totals[id]), delta: d.text, good: d.good === undefined ? null : d.good };
    });
  } else if (p.type === 'trend') {
    const ids = (p.metrics || []).slice(0, 3);
    let groups;
    if (p.granularity === 'month') {
      const g = groupBy(rowsOf('monthly'), (r) => r.date_start.slice(0, 7), (r) => monthLabel(r.date_start));
      const byKey = new Map(g.map((x) => [x.key, x]));
      groups = [];
      const d = new Date(`${fetched.monthStart}T00:00:00Z`);
      const n = Number(p.months) || 6;
      const startOffset = fetched.months - n;
      d.setUTCMonth(d.getUTCMonth() + startOffset);
      for (let k = 0; k < n; k++) {
        const key = d.toISOString().slice(0, 7);
        groups.push(byKey.get(key) || { key, name: monthLabel(`${key}-01`), m: agg([]) });
        d.setUTCMonth(d.getUTCMonth() + 1);
      }
    } else {
      groups = groupBy(rowsOf('daily'), (r) => r.date_start, (r) => dayLabel(r.date_start)).sort((a, b) => (a.key < b.key ? -1 : 1));
    }
    page.chart = { kind: p.chart || (p.granularity === 'month' ? 'combo' : 'bar'), header: ['', ...ids.map(chartLabel)], rows: groups.map((g) => [g.name, ...ids.map((id) => chartVal(id, g.m[id]))]) };
    if (!groups.length) warnings.push(`no_data:page${i}:trend`);
  } else if (p.type === 'breakdown') {
    const ids = (p.metrics || ['spend']).slice(0, 2);
    const groups = sortRows(breakdownGroups(p.dimension), `-${ids[0]}`).slice(0, 12);
    page.chart = { kind: p.chart || 'bar', header: ['', ...ids.map(chartLabel)], rows: groups.map((g) => [g.name, ...ids.map((id) => chartVal(id, g.m[id]))]) };
    page.summary = groups.slice(0, 6).map((g) => `${g.name}: ${ids.map((id) => `${label(id)} ${fmt(id, g.m[id])}`).join(', ')}`).join('; ');
    if (!groups.length) warnings.push(`no_data:page${i}:breakdown`);
    if (groups.length) aiFacts.push(`${page.title} — ${page.summary}`);
    if (p.insight) aiTasks.push({ key: `p${i}`, kind: 'short', title: page.title, facts: page.summary });
  } else if (p.type === 'table') {
    const ids = (p.metrics || []).slice(0, 8);
    const limit = Math.min(25, Number(p.limit) || 10);
    const groups = sortRows(tableGroups(p.dimension), p.sort, '-spend').slice(0, limit);
    page.table = {
      header: [(DIM_LABEL[p.dimension] || [p.dimension, p.dimension])[locale === 'en' ? 1 : 0], ...ids.map(label)],
      rows: groups.map((g) => [String(g.name || '—'), ...ids.map((id) => fmt(id, g.m[id]))]),
      empty: L('Tidak ada data pada periode ini', 'No data for this period')
    };
  } else if (p.type === 'creatives') {
    const ids = (p.metrics || ['spend', 'results', 'cost_per_result']).slice(0, 4);
    const limit = Math.min(9, Number(p.limit) || 3);
    let list = adGroups.filter((g) => g.m.spend > 0 && !usedAds.has(g.key));
    if (p.variant === 'lowest') {
      // biaya per hasil tertinggi; iklan ber-spend tanpa hasil dianggap paling perlu dievaluasi
      list = [...list].sort((a, b) => {
        const ca = a.m.cost_per_result === null ? Infinity : a.m.cost_per_result;
        const cb = b.m.cost_per_result === null ? Infinity : b.m.cost_per_result;
        return cb === ca ? b.m.spend - a.m.spend : cb - ca;
      });
    } else {
      list = sortRows(list, p.sort, '-results');
    }
    list = list.slice(0, limit);
    page.creatives = [];
    for (const g of list) {
      usedAds.add(g.key);
      const imageUrl = await creativeImage(g.key);
      if (!imageUrl) warnings.push(`creative_image_missing:${g.key}`);
      page.creatives.push({ adId: g.key, name: g.name, imageUrl, metrics: ids.map((id) => `${label(id)}: ${fmt(id, g.m[id])}`).join('\n') });
    }
  } else if (p.type === 'ai_insight') {
    aiTasks.push({ key: `p${i}`, kind: 'long', title: page.title, focus: p.focus || '' });
  } else if (p.type === 'custom_text') {
    page.text = applyPh(p.text || '');
  } else if (p.type === 'custom_image') {
    page.imageUrl = p.imageUrl || null;
    page.caption = applyPh(p.caption || '');
    if (!page.imageUrl) warnings.push(`custom_image_missing:page${i}`);
  }
  if (page.chart) charts.push({ pageIndex: i, ...page.chart });
  model.push(page);
}

// ---------------- prompt AI (satu panggilan Gemini untuk semua halaman) ----------------
let aiPrompt = null;
if (aiTasks.length) {
  const lang = L('Bahasa Indonesia yang profesional dan mudah dipahami pemilik bisnis', 'clear professional English for business owners');
  aiPrompt = [
    L('Kamu adalah Senior Performance Marketing Analyst. Gunakan HANYA data berikut, jangan mengarang angka.', 'You are a Senior Performance Marketing Analyst. Use ONLY the data below; never invent numbers.'),
    '',
    'DATA:',
    ...aiFacts,
    '',
    L('TUGAS (tulis dalam', 'TASKS (write in') + ` ${lang}):`,
    ...aiTasks.map((t) => t.kind === 'long'
      ? `- "${t.key}": ${L('ringkasan eksekutif + 3–5 rekomendasi konkret bulan depan, maksimal 180 kata', 'executive summary + 3–5 concrete recommendations for next month, max 180 words')}${t.focus ? ` (${L('fokus', 'focus')}: ${t.focus})` : ''}. ${L('Judul halaman', 'Page title')}: ${t.title}`
      : `- "${t.key}": ${L('1–2 kalimat insight untuk grafik', '1–2 sentence insight for the chart')} "${t.title}" (${t.facts})`),
    '',
    L('Balas HANYA JSON objek dengan key persis seperti di atas, nilai berupa teks biasa (boleh baris baru dan "• "), tanpa markdown.', 'Reply with ONLY a JSON object using exactly the keys above; values are plain text (newlines and "• " allowed), no markdown.')
  ].join('\n');
}

return [{
  json: {
    requestId: job.requestId,
    period: PERIOD,
    fileName: `${L('Laporan Iklan', 'Ads Report')} – ${PERIOD} – ${ACCOUNT_NAMES}`.slice(0, 150) + ` – ${String(job.requestId).slice(-6)}`,
    model,
    charts,
    ai: { needed: aiTasks.length > 0, prompt: aiPrompt, keys: aiTasks.map((t) => t.key) },
    summary: {
      period: { start: job.period.start, end: job.period.end, label: PERIOD },
      currency: reportCur,
      accounts: okAccounts.map((a) => ({ id: a.externalId, name: a.name })),
      totals: Object.fromEntries(['spend', 'impressions', 'reach', 'clicks', 'ctr', 'cpc', 'results', 'cost_per_result', 'conversions', 'conversion_value', 'roas'].map((k) => [k, totals[k] === undefined ? null : totals[k]])),
      previous: prevTotals ? Object.fromEntries(['spend', 'impressions', 'reach', 'clicks', 'results'].map((k) => [k, prevTotals[k]])) : null,
      fx: fetched.fx ? { source: fetched.fx.source, date: fetched.fx.date, rates: fetched.fx.rates } : null
    },
    warnings
  }
}];
