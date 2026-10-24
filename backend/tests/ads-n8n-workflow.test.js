// backend/tests/ads-n8n-workflow.test.js
// Menjalankan Code node workflow n8n "markimate-ads-report" (hasil build) dengan Graph API, Gemini,
// Drive/Sheets/Slides tiruan, lalu memeriksa: data Meta ASLI dipakai (tanpa data palsu), token via
// header, error per akun, perhitungan metrics, request Slides/Sheets, callback sukses & error,
// serta integritas graf workflow (koneksi, referensi $('Node'), credential).

import assert from 'node:assert';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { MARKIMATE_STANDARD_TEMPLATE } from '../shared/report-template.js';

const here = path.dirname(fileURLToPath(import.meta.url));
const wfPath = path.join(here, '..', '..', 'automation', 'n8n-ads-report-workflow.json');
const wf = JSON.parse(fs.readFileSync(wfPath, 'utf8'));
const nodeByName = Object.fromEntries(wf.nodes.map((n) => [n.name, n]));
const AsyncFunction = Object.getPrototypeOf(async function () {}).constructor;

console.log('=== RUNNING TESTS: workflow n8n Ads Report (PR #2) ===');

// ---------------------------------------------------------------- harness
const ctx = {}; // output node: name -> array item {json}
function getCode(name) {
  const n = nodeByName[name];
  assert.ok(n, `node ${name} ada`);
  assert.strictEqual(n.type, 'n8n-nodes-base.code');
  return n.parameters.jsCode;
}
async function runCode(name, inputItems, http, override) {
  const js = override || getCode(name);
  const $input = { first: () => inputItems[0], all: () => inputItems };
  const $ = (n) => {
    if (!ctx[n]) throw new Error(`Node '${n}' hasn't been executed`);
    return { first: () => ctx[n][0], all: () => ctx[n] };
  };
  const fn = new AsyncFunction('$input', '$', js);
  const out = await fn.call({ helpers: { httpRequest: http || (async () => { throw new Error('no http'); }) } }, $input, $);
  ctx[name] = out;
  return out;
}

// ---------------------------------------------------------------- data Meta tiruan
const TOKEN_A = 'EAAtokenA_secret';
const TOKEN_B = 'EAAtokenB_revoked';
const act = (o) => [{ action_type: 'link_click', value: '999' }, ...o];
const campaigns = [
  { campaign_id: 'c1', campaign_name: 'Sales Okt', objective: 'OUTCOME_SALES', spend: '600000', impressions: '50000', reach: '30000', clicks: '1500', inline_link_clicks: '1200', actions: act([{ action_type: 'omni_purchase', value: '30' }, { action_type: 'purchase', value: '30' }]), action_values: [{ action_type: 'omni_purchase', value: '6000000' }], results: [{ indicator: 'actions:omni_purchase', values: [{ value: '30' }] }] },
  { campaign_id: 'c2', campaign_name: 'Traffic Okt', objective: 'OUTCOME_TRAFFIC', spend: '400000', impressions: '50000', reach: '25000', clicks: '500', inline_link_clicks: '450', actions: act([]), action_values: [], results: [{ indicator: 'actions:link_click', values: [{ value: '450' }] }] }
];
const accountRow = { account_name: 'Toko A', account_currency: 'IDR', spend: '1000000', impressions: '100000', reach: '50000', clicks: '2000', inline_link_clicks: '1650', actions: act([{ action_type: 'omni_purchase', value: '30' }]), action_values: [{ action_type: 'omni_purchase', value: '6000000' }] };
const accountPrev = { spend: '800000', impressions: '80000', reach: '40000', clicks: '1600', inline_link_clicks: '1300', actions: act([{ action_type: 'omni_purchase', value: '20' }]), action_values: [{ action_type: 'omni_purchase', value: '4000000' }] };
const campaignsPrev = [{ campaign_id: 'c1', spend: '800000', impressions: '80000', reach: '40000', clicks: '1600', results: [{ values: [{ value: '20' }] }] }];
const daily = [
  { campaign_id: 'c1', date_start: '2026-10-01', spend: '300000', impressions: '25000', clicks: '700', results: [{ values: [{ value: '15' }] }] },
  { campaign_id: 'c2', date_start: '2026-10-01', spend: '200000', impressions: '25000', clicks: '250', results: [{ values: [{ value: '200' }] }] },
  { campaign_id: 'c1', date_start: '2026-10-02', spend: '300000', impressions: '25000', clicks: '800', results: [{ values: [{ value: '15' }] }] }
];
const monthly = [
  { campaign_id: 'c1', date_start: '2026-09-01', spend: '500000', reach: '20000' },
  { campaign_id: 'c1', date_start: '2026-10-01', spend: '600000', reach: '30000' },
  { campaign_id: 'c2', date_start: '2026-10-01', spend: '400000', reach: '25000' }
];
const bdPlatform = [
  { campaign_id: 'c1', publisher_platform: 'instagram', spend: '700000', clicks: '1400', impressions: '60000', actions: act([{ action_type: 'omni_purchase', value: '25' }]) },
  { campaign_id: 'c1', publisher_platform: 'facebook', spend: '300000', clicks: '600', impressions: '40000', actions: act([{ action_type: 'omni_purchase', value: '5' }]) }
];
const bdAgeGender = [
  { campaign_id: 'c1', age: '25-34', gender: 'female', spend: '500000', results: [{ values: [{ value: '20' }] }] },
  { campaign_id: 'c1', age: '25-34', gender: 'male', spend: '300000', results: [{ values: [{ value: '5' }] }] }
];
const ads = [
  { ad_id: 'ad1', ad_name: 'Video Promo', campaign_name: 'Sales Okt', spend: '500000', impressions: '40000', clicks: '1000', results: [{ values: [{ value: '25' }] }] },
  { ad_id: 'ad2', ad_name: 'Carousel', campaign_name: 'Sales Okt', spend: '300000', impressions: '30000', clicks: '400', results: [{ values: [{ value: '5' }] }] },
  { ad_id: 'ad3', ad_name: 'Gambar Statis', campaign_name: 'Traffic Okt', spend: '200000', impressions: '30000', clicks: '100', results: [] },
  { ad_id: 'ad4', ad_name: 'Tanpa Spend', campaign_name: 'Traffic Okt', spend: '0', impressions: '0', clicks: '0', results: [] }
];

const calls = [];
async function graphMock(opts) {
  calls.push(opts);
  const url = opts.url;
  const qs = opts.qs || {};
  const auth = (opts.headers || {}).Authorization || '';
  assert.ok(!JSON.stringify(qs).includes('EAA'), 'token TIDAK boleh ada di query string');
  assert.ok(!url.includes('access_token'), 'token TIDAK boleh ada di URL');
  if (url.includes('open.er-api.com')) return { result: 'success', rates: { USD: 0.0000625 } };
  if (auth === `Bearer ${TOKEN_B}`) {
    return { statusCode: 400, body: { error: { code: 190, message: 'Error validating access token: session has been invalidated' } } };
  }
  assert.strictEqual(auth, `Bearer ${TOKEN_A}`, 'token dikirim lewat header Authorization');
  const ok = (data, paging) => ({ statusCode: 200, body: { data, ...(paging ? { paging } : {}) } });
  if (/\/ad\d$/.test(url)) {
    const id = url.split('/').pop();
    return { statusCode: 200, body: { creative: id === 'ad3' ? { thumbnail_url: `https://cdn.fb/${id}_thumb.jpg` } : { image_url: `https://cdn.fb/${id}.jpg` } } };
  }
  // halaman kedua pagination (URL next)
  if (url.includes('page2')) return ok([campaigns[1]]);
  if (!url.endsWith('/insights')) throw new Error(`unexpected url ${url}`);
  const tr = JSON.parse(qs.time_range || '{}');
  const isPrev = tr.since === '2026-09-01' && tr.until === '2026-09-30';
  if (qs.level === 'account') return ok([isPrev ? accountPrev : accountRow]);
  if (qs.level === 'campaign' && qs.breakdowns === 'publisher_platform') return ok(bdPlatform);
  if (qs.level === 'campaign' && qs.breakdowns === 'age,gender') return ok(bdAgeGender);
  if (qs.level === 'campaign' && qs.time_increment === 1) return ok(daily);
  if (qs.level === 'campaign' && qs.time_increment === 'monthly') return ok(monthly);
  if (qs.level === 'campaign' && isPrev) return ok(campaignsPrev);
  if (qs.level === 'campaign') return ok([campaigns[0]], { next: 'https://graph.facebook.com/v23.0/act_111/insights?page2' });
  if (qs.level === 'ad') return ok(ads);
  return ok([]);
}

// ---------------------------------------------------------------- 1. Auth & Normalize
const payload = {
  requestId: 'req_ads_test_123456',
  reportId: 'rep-1',
  workspaceId: 'ws-1',
  workspaceName: 'Toko A Group',
  callbackUrl: 'https://app.markimate.com/api/ads/reports/callback',
  template: MARKIMATE_STANDARD_TEMPLATE,
  accounts: [
    { id: 'a1', externalId: '111', platform: 'meta', name: 'Toko A', currency: 'IDR', accessToken: TOKEN_A },
    { id: 'a2', externalId: 'act_222', platform: 'meta', name: 'Toko B', currency: 'IDR', accessToken: TOKEN_B }
  ],
  period: { start: '2026-10-01', end: '2026-10-31' },
  compare: true,
  conversionEvent: 'purchase',
  currency: 'IDR',
  recipients: ['tim@toko.id'],
  owner: { email: 'owner@toko.id', locale: 'id' },
  customMetrics: [{ id: 'cm1', name: 'Biaya per Klik Tautan', formula: 'spend / link_clicks', unit: 'currency', decimals: 0 }]
};

{
  const out = await runCode('Auth & Normalize (Ads)', [{ json: { body: payload } }]);
  assert.strictEqual(out[0].json.ok, false, 'CONFIG placeholder → tidak ok');
  assert.strictEqual(out[0].json.statusCode, 503, 'CONFIG placeholder → 503 (backend rollback kredit)');
}
const authCode = getCode('Auth & Normalize (Ads)').replace("'GANTI_DENGAN_ID_BASE_DECK'", "'BASEDECK123'").replace("'GANTI_DENGAN_ID_FOLDER'", "'ROOTFOLDER123'");
{
  const bad = await runCode('Auth & Normalize (Ads)', [{ json: { body: { ...payload, period: { start: '2026-10-31', end: '2026-10-01' } } } }], null, authCode);
  assert.strictEqual(bad[0].json.statusCode, 400);
}
const auth = await runCode('Auth & Normalize (Ads)', [{ json: { body: payload } }], null, authCode);
assert.strictEqual(auth[0].json.ok, true);
assert.strictEqual(auth[0].json.accounts[0].externalId, 'act_111', 'externalId dinormalisasi ke act_');
assert.deepStrictEqual(auth[0].json.prevPeriod, { start: '2026-09-01', end: '2026-09-30' }, 'periode pembanding = 31 hari sebelumnya');
console.log('   OK - Auth & Normalize: 503 saat belum dikonfigurasi, validasi periode, periode pembanding.');

// ---------------------------------------------------------------- 2. Ambil Data Meta
const fetchOut = await runCode('Ambil Data Meta', auth, graphMock);
const fetched = fetchOut[0].json;
const accA = fetched.fetched.accounts.find((a) => a.externalId === 'act_111');
const accB = fetched.fetched.accounts.find((a) => a.externalId === 'act_222');
assert.strictEqual(accA.ok, true);
assert.strictEqual(accB.ok, false, 'akun dengan token dicabut ditandai gagal');
assert.ok(fetched.warnings.some((w) => w.startsWith('account_unavailable:act_222:190')), 'warning akun gagal');
assert.strictEqual(accA.data.campaigns.length, 2, 'pagination paging.next diikuti');
assert.ok(!JSON.stringify(fetched).includes(TOKEN_A), 'token tidak ikut keluar dari node fetch');
assert.ok(calls.some((c) => c.qs && c.qs.breakdowns === 'age,gender'), 'breakdown demografi diminta (dipakai template)');
assert.ok(!calls.some((c) => c.qs && c.qs.level === 'adset'), 'level adset TIDAK diminta (tidak dipakai template)');
// semua akun gagal → throw ADS_SOURCE_UNAVAILABLE
{
  const allBad = { ...auth[0].json, accounts: auth[0].json.accounts.map((a) => ({ ...a, accessToken: TOKEN_B })) };
  await assert.rejects(() => runCode('Ambil Data Meta', [{ json: allBad }], graphMock), /ADS_SOURCE_UNAVAILABLE/);
  ctx['Ambil Data Meta'] = fetchOut;
}
console.log('   OK - Ambil Data Meta: data asli via header, pagination, error per akun, semua gagal → ADS_SOURCE_UNAVAILABLE.');

// ---------------------------------------------------------------- 3. Proses Metrik
const proc = (await runCode('Proses Metrik', fetchOut, graphMock))[0].json;
const pageOf = (type, nth = 0) => proc.model.filter((p) => p.type === type)[nth];
const kpi = pageOf('kpi');
const k = Object.fromEntries(kpi.kpis.map((x) => [x.id, x]));
assert.strictEqual(k.spend.value.replace(/\s/g, ' '), 'Rp 1.000.000', 'spend total dari level akun (IDR tanpa desimal)');
assert.strictEqual(k.results.value, '480', 'results = jumlah results level campaign (30 + 450)');
assert.strictEqual(k.ctr.value, '2,00%', 'CTR = clicks/impressions dari jumlah');
assert.strictEqual(k.spend.delta, '▲ 25,0%', 'delta spend vs periode lalu');
assert.strictEqual(k.results.delta, '▲ 2.300,0%', 'delta results memakai results campaign periode lalu (20 → 480)');
assert.strictEqual(k.roas.value, '6,00x', 'ROAS = nilai konversi / spend');
const trendMonth = proc.model.find((p) => p.type === 'trend' && p.chart && p.chart.rows.length === 6);
assert.ok(trendMonth, 'tren bulanan 6 bulan (bulan kosong diisi 0)');
assert.deepStrictEqual(trendMonth.chart.rows[5], ['Okt 26', 1000000, 55000], 'bulan Okt = c1 + c2');
assert.deepStrictEqual(trendMonth.chart.rows[4], ['Sep 26', 500000, 20000]);
const trendDay = proc.model.find((p) => p.type === 'trend' && p !== trendMonth);
assert.deepStrictEqual(trendDay.chart.rows.map((r) => r[0]), ['1 Okt', '2 Okt'], 'tren harian urut tanggal');
assert.deepStrictEqual(trendDay.chart.rows[0].slice(1), [500000, 215], 'harian 1 Okt = jumlah semua campaign');
const objectivePage = proc.model.find((p) => p.type === 'breakdown' && p.chart.kind === 'pie');
assert.deepStrictEqual(objectivePage.chart.rows.map((r) => r[0]), ['Penjualan', 'Traffic'], 'objective dilabeli & diurut biaya');
const platformPage = proc.model.find((p) => p.type === 'breakdown' && p.title.includes('Platform'));
assert.deepStrictEqual(platformPage.chart.rows[0], ['Instagram', 700000, 1.79], 'conv_rate % per platform (25/1400)');
const table = pageOf('table').table;
assert.deepStrictEqual(table.rows.map((r) => r[0]), ['Sales Okt', 'Traffic Okt'], 'tabel campaign urut -spend');
const best = pageOf('creatives', 0).creatives;
const worst = pageOf('creatives', 1).creatives;
assert.deepStrictEqual(best.map((c) => c.adId), ['ad1', 'ad2', 'ad3'], 'creative terbaik urut hasil');
assert.strictEqual(best[0].imageUrl, 'https://cdn.fb/ad1.jpg', 'gambar creative dari Meta (image_url)');
assert.strictEqual(best[2].imageUrl, 'https://cdn.fb/ad3_thumb.jpg', 'fallback thumbnail_url');
assert.strictEqual(worst.length, 0, 'iklan yang sudah tampil di "terbaik" tidak diulang; ad4 (spend 0) tidak ikut');
assert.ok(proc.ai.needed && proc.ai.keys.includes('p10') && proc.ai.keys.includes('p5'), 'AI untuk ai_insight + breakdown insight');
assert.ok(proc.ai.prompt.includes('Rp 1.000.000') || proc.ai.prompt.includes('Rp 1.000.000'), 'prompt AI memakai angka asli');
assert.strictEqual(proc.model[0].title, 'Laporan Iklan Oktober 2026', 'placeholder {{period}} → nama bulan');
assert.strictEqual(proc.model[0].subtitle, 'Toko A · Meta Ads');
assert.ok(!/mock|demo_|deck_/i.test(JSON.stringify(proc)), 'tidak ada data contoh/palsu di model');
console.log('   OK - Proses Metrik: KPI, delta, tren bulanan/harian, breakdown, tabel, creative, prompt AI.');

// ---------------------------------------------------------------- 4. Parse Insight
ctx['Proses Metrik'] = [{ json: proc }];
const gemini = { candidates: [{ content: { parts: [{ text: '```json\n{"p10":"**Ringkasan**: biaya naik 25%.","p5":"Instagram paling efisien."}\n```' }] } }] };
const parsed = (await runCode('Parse Insight', [{ json: gemini }]))[0].json;
assert.strictEqual(parsed.model[10].insight, 'Ringkasan: biaya naik 25%.', 'insight AI terpasang (markdown dibersihkan)');
assert.strictEqual(parsed.model[5].insight, 'Instagram paling efisien.');
assert.strictEqual(parsed.aiPages, 1);
{
  const bad = (await runCode('Parse Insight', [{ json: { error: { message: '429' } } }]))[0].json;
  assert.ok(bad.warnings.includes('ai_unavailable'), 'Gemini gagal → warning');
  assert.ok(bad.model[10].insight.length > 10, 'Gemini gagal → teks cadangan, laporan tetap jadi');
  assert.strictEqual(bad.aiPages, 0);
  ctx['Parse Insight'] = [{ json: parsed }];
}
console.log('   OK - Parse Insight: JSON Gemini, fallback saat gagal.');

// ---------------------------------------------------------------- 5. Sheets
ctx['Drive: Salin Base Deck'] = [{ json: { id: 'COPY1', parents: ['WSFOLDER'] } }];
const sheet = (await runCode('Susun Data Grafik', [{ json: { id: 'SHEET1' } }]))[0].json;
assert.strictEqual(sheet.spreadsheetId, 'SHEET1');
const addCharts = sheet.requests.filter((r) => r.addChart);
assert.strictEqual(addCharts.length, proc.charts.length, 'satu chart per halaman grafik');
assert.deepStrictEqual(Object.values(sheet.chartMap), addCharts.map((r) => r.addChart.chart.chartId), 'chartMap = ID chart di Sheets');
const combo = addCharts.find((r) => r.addChart.chart.spec.basicChart && r.addChart.chart.spec.basicChart.chartType === 'COMBO');
assert.ok(combo && combo.addChart.chart.spec.basicChart.series[1].targetAxis === 'RIGHT_AXIS', 'combo: metrik ke-2 di sumbu kanan');
assert.ok(addCharts.some((r) => r.addChart.chart.spec.pieChart), 'pie untuk objective');
console.log('   OK - Susun Data Grafik: tab data + chart deterministik.');

// ---------------------------------------------------------------- 6. Slides
const T = (s) => ({ shape: { text: { textElements: [{ textRun: { content: s } }] } } });
let eid = 0;
const el = (extra) => ({ objectId: `g_el_${++eid}`, size: { width: { magnitude: 3000000, unit: 'EMU' }, height: { magnitude: 2000000, unit: 'EMU' } }, transform: { scaleX: 1, scaleY: 1, translateX: 100, translateY: 200, unit: 'EMU' }, ...extra });
const notes = (s) => ({ notesPage: { pageElements: [{ objectId: `n${eid++}`, ...T(s) }] } });
const tableEl = el({ description: 'table', table: { rows: 2, columns: 9, tableRows: [{ tableCells: Array.from({ length: 9 }, (_, i) => (i === 0 ? { text: { textElements: [{ textRun: { content: 'Campaign\n' } }] } } : {})) }, { tableCells: Array.from({ length: 9 }, () => ({})) }] } });
const layout = (type, els) => ({ objectId: `L_${type}`, pageElements: [el(T('{{title}}')), ...els], slideProperties: notes(`layout:${type}`) });
const pres = {
  presentationId: 'COPY1',
  slides: [
    layout('cover', [el(T('{{subtitle}} {{period}}'))]),
    layout('kpi', Array.from({ length: 8 }, (_, i) => el({ description: `kpi ${i + 1}`, ...T(`{{kpi${i + 1}_label}} {{kpi${i + 1}_value}} {{kpi${i + 1}_delta}}`) }))),
    layout('trend', [el({ description: 'chart', image: {} })]),
    layout('breakdown', [el({ description: 'chart', image: {} }), el(T('{{insight}}'))]),
    layout('table', [tableEl]),
    layout('creatives', [1, 2, 3, 4].flatMap((n) => [el({ description: `creative ${n} img`, image: {} }), el({ description: `creative ${n}`, ...T(`{{c${n}_name}} {{c${n}_metrics}}`) })])),
    layout('ai_insight', [el(T('{{insight}} {{foo}}'))]),
    { objectId: 'L_unused', pageElements: [], slideProperties: notes('catatan biasa') }
  ]
};
ctx['Susun Data Grafik'] = [{ json: sheet }];
const render = (await runCode('Susun Request Slides', [{ json: pres }]))[0].json;
const R = render.requests;
const dups = R.filter((r) => r.duplicateObject);
assert.strictEqual(dups.length, proc.model.length - 1, 'semua halaman diduplikat kecuali yang layout-nya tidak ada (closing)');
assert.ok(render.warnings.includes('layout_missing:closing'));
assert.ok(render.warnings.includes('unknown_placeholder:ai_insight:foo'));
const created = new Set(dups.flatMap((d) => Object.values(d.duplicateObject.objectIds)));
R.filter((r) => r.createSheetsChart).forEach((r) => created.add(r.createSheetsChart.objectId));
const referenced = [];
for (const r of R) {
  if (r.deleteObject && !String(r.deleteObject.objectId).startsWith('L_')) referenced.push(r.deleteObject.objectId);
  for (const key of ['deleteTableColumn', 'insertTableRows', 'deleteTableRow']) if (r[key]) referenced.push(r[key].tableObjectId);
  if (r.insertText) referenced.push(r.insertText.objectId);
  if (r.deleteText) referenced.push(r.deleteText.objectId);
  if (r.replaceAllText) r.replaceAllText.pageObjectIds.forEach((id) => referenced.push(id));
}
referenced.forEach((id) => assert.ok(created.has(id), `request merujuk objek yang ada: ${id}`));
assert.ok(R.filter((r) => r.createSheetsChart).every((r) => r.createSheetsChart.spreadsheetId === 'SHEET1' && r.createSheetsChart.linkingMode === 'LINKED'), 'chart LINKED ke Sheet data');
assert.strictEqual(R.filter((r) => r.createSheetsChart).length, proc.charts.length);
const kpiDeletes = R.filter((r) => r.deleteObject && /^mk01e/.test(r.deleteObject.objectId));
assert.strictEqual(kpiDeletes.length, 0, 'template KPI 8 metrics → tidak ada kartu dihapus');
const rt = (txt, page) => R.find((r) => r.replaceAllText && r.replaceAllText.containsText.text === txt && r.replaceAllText.pageObjectIds[0] === page);
assert.strictEqual(rt('{{title}}', 'mk00slide').replaceAllText.replaceText, 'Laporan Iklan Oktober 2026');
assert.strictEqual(rt('{{kpi5_value}}', 'mk01slide').replaceAllText.replaceText.replace(/\s/g, ' '), 'Rp 1.000.000');
assert.strictEqual(rt('{{insight}}', 'mk10slide').replaceAllText.replaceText, 'Ringkasan: biaya naik 25%.');
// tabel: 9 kolom layout, 8 dipakai (1 + 7 metrics) → hapus 1 kolom; 2 baris data, layout 1 → tambah 1
assert.strictEqual(R.filter((r) => r.deleteTableColumn).length, 1);
assert.strictEqual(R.find((r) => r.insertTableRows).insertTableRows.number, 1);
assert.ok(R.some((r) => r.deleteText && r.deleteText.cellLocation.rowIndex === 0 && r.deleteText.cellLocation.columnIndex === 0), 'header berisi teks dihapus dulu sebelum diisi');
assert.ok(R.some((r) => r.insertText && r.insertText.text === 'Sales Okt' && r.insertText.cellLocation.rowIndex === 1));
// creative: halaman terbaik 3 iklan → slot 4 dihapus; halaman "perlu dievaluasi" 0 iklan → semua slot dihapus
const credDel = (p) => R.filter((r) => r.deleteObject && r.deleteObject.objectId.startsWith(p)).length;
assert.strictEqual(credDel('mk08e'), 2, 'slot creative ke-4 (img + teks) dihapus');
assert.strictEqual(credDel('mk09e'), 8, 'tidak ada iklan → semua slot dihapus');
assert.deepStrictEqual(render.imageJobs.map((j) => j.replaceImage.url), ['https://cdn.fb/ad1.jpg', 'https://cdn.fb/ad2.jpg', 'https://cdn.fb/ad3_thumb.jpg']);
// urutan & pembersihan
const pos = R.find((r) => r.updateSlidesPosition).updateSlidesPosition;
assert.deepStrictEqual(pos.slideObjectIds, dups.map((d) => d.duplicateObject.objectIds[d.duplicateObject.objectId]), 'urutan slide = urutan template');
assert.strictEqual(R.indexOf(R.find((r) => r.updateSlidesPosition)) > R.lastIndexOf(dups[dups.length - 1]), true);
assert.deepStrictEqual(R.filter((r) => r.deleteObject && r.deleteObject.objectId.startsWith('L_')).map((r) => r.deleteObject.objectId), pres.slides.map((s) => s.objectId), 'semua slide asli base deck dihapus');
await assert.rejects(() => runCode('Susun Request Slides', [{ json: { presentationId: 'X', slides: [{ objectId: 'a', pageElements: [] }] } }]), /layout/, 'base deck tanpa layout → error (callback error, refund)');
ctx['Susun Request Slides'] = [{ json: render }];
console.log('   OK - Susun Request Slides: duplikat layout, placeholder, chart LINKED, tabel, creative, urutan, hapus layout.');

// ---------------------------------------------------------------- 7. gambar, akses, callback
const imgs = await runCode('Susun Request Gambar', [{ json: {} }]);
assert.strictEqual(imgs.length, 3);
assert.ok(imgs.every((i) => i.json.hasImage && i.json.body.requests[0].replaceImage));
ctx['Slides: Ganti Gambar'] = [{ json: {} }, { json: { error: { message: 'image not accessible' } } }, { json: {} }];
ctx['Auth & Normalize (Ads)'] = auth;
const share = await runCode('Daftar Akses', [{ json: {} }]);
assert.deepStrictEqual(share.map((s) => [s.json.body.emailAddress, s.json.body.role]), [['owner@toko.id', 'writer'], ['tim@toko.id', 'reader']], 'owner = writer (editor), penerima = reader');
assert.ok(share.every((s) => s.json.fileId === 'COPY1'));
ctx['Drive: Bagikan Akses'] = [{ json: { id: 'perm1' } }, { json: { error: { message: 'not a Google account' } } }];
const cb = (await runCode('Siapkan Callback', [{ json: {} }]))[0].json;
const P = cb.callbackPayload;
assert.strictEqual(cb.callbackUrl, payload.callbackUrl);
assert.strictEqual(P.status, 'ready');
assert.strictEqual(P.requestId, payload.requestId);
assert.strictEqual(P.slidesFileId, 'COPY1');
assert.strictEqual(P.slidesUrl, 'https://docs.google.com/presentation/d/COPY1/edit');
assert.strictEqual(P.pdfPath, 'https://docs.google.com/presentation/d/COPY1/export/pdf');
assert.ok(P.warnings.includes('image_failed:creative:ad2'), 'gambar gagal → warning, bukan error');
assert.ok(P.warnings.includes('share_failed:tim@toko.id'));
assert.ok(P.warnings.some((w) => w.startsWith('account_unavailable:act_222')));
assert.strictEqual(P.summary.totals.spend, 1000000);
assert.ok(!JSON.stringify(cb).includes('EAAtoken'), 'token tidak ada di callback');
{
  const err = (await runCode('Siapkan Callback Error', [{ json: { error: 'ADS_SOURCE_UNAVAILABLE: act_222 (invalid token)' } }]))[0].json;
  assert.strictEqual(err.callbackPayload.status, 'error');
  assert.strictEqual(err.callbackPayload.errorCode, 'ADS_SOURCE_UNAVAILABLE');
  const err2 = (await runCode('Siapkan Callback Error', [{ json: { error: { message: 'File not found: BASEDECK123' } } }]))[0].json;
  assert.strictEqual(err2.callbackPayload.errorCode, 'ADS_REPORT_FAILED');
}
console.log('   OK - Gambar per item, akses Drive, callback sukses & error.');

// ---------------------------------------------------------------- 8. integritas workflow
const names = new Set(wf.nodes.map((n) => n.name));
for (const [from, c] of Object.entries(wf.connections)) {
  assert.ok(names.has(from), `sumber koneksi ada: ${from}`);
  c.main.forEach((outs) => outs.forEach((t) => assert.ok(names.has(t.node), `target koneksi ada: ${from} → ${t.node}`)));
}
const allText = JSON.stringify(wf.nodes.map((n) => n.parameters));
for (const m of allText.matchAll(/\$\(\\?['"]([^'"\\]+)\\?['"]\)/g)) assert.ok(names.has(m[1]), `referensi $('${m[1]}') menunjuk node yang ada`);
const errTargets = Object.entries(wf.connections).filter(([, c]) => c.main[1] && c.main[1].some((t) => t.node === 'Siapkan Callback Error')).map(([n]) => n);
for (const n of wf.nodes.filter((x) => x.onError === 'continueErrorOutput')) assert.ok(errTargets.includes(n.name), `error output ${n.name} → Siapkan Callback Error`);
for (const n of ['Ambil Data Meta', 'Proses Metrik', 'Drive: Salin Base Deck', 'Slides: Isi Konten', 'Sheets: Tulis Data & Grafik']) assert.ok(errTargets.includes(n), `${n} punya jalur error ke callback`);
for (const n of wf.nodes.filter((x) => /^(Drive|Sheets|Slides):/.test(x.name))) {
  assert.strictEqual(n.parameters.nodeCredentialType, 'googleDriveOAuth2Api', `${n.name} pakai credential Google Drive`);
  assert.ok(n.credentials && n.credentials.googleDriveOAuth2Api, `${n.name} punya credential`);
}
assert.strictEqual(nodeByName['Gemini: Insight'].parameters.nodeCredentialType, 'googlePalmApi');
assert.ok(nodeByName['Kirim Callback'].credentials.httpHeaderAuth && nodeByName['Kirim Callback Error'].credentials.httpHeaderAuth, 'callback memakai header X-Supermat-Key');
assert.strictEqual(nodeByName['Webhook Ads Report'].parameters.path, 'ads-report-generate');
assert.ok(!/deck_\$\{|mock_|demo_/.test(allText), 'tidak ada ID deck palsu / data contoh di workflow');
assert.ok(!nodeByName['Drive: Bagikan Akses'].parameters.jsonBody.includes('editor'), 'role Drive valid (writer/reader, bukan "editor")');
console.log('   OK - Integritas workflow: koneksi, referensi node, jalur error, credential.');

console.log('\n🎉 SEMUA TEST WORKFLOW N8N ADS REPORT LOLOS!');
process.exit(0);
