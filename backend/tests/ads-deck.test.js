// backend/tests/ads-deck.test.js
// Deck Google Slides milik user (PRD F5 opsi A): parse URL, validasi template, backend checkDeck
// (n8n tiruan), dan Code node workflow n8n "Markimate Ads Deck Check" dengan deck tiruan.

import assert from 'node:assert';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { parseSlidesId, validateTemplate, MARKIMATE_STANDARD_TEMPLATE } from '../shared/report-template.js';
import { checkDeck, getDeckConfig } from '../lib/ads-deck.js';

console.log('=== RUNNING TESTS: deck Google Slides milik user (PR #3) ===');

const ID = '1AbCdEfGhIjKlMnOpQrStUvWxYz_0123456789-abc';

// ---------------------------------------------------------------- 1. parseSlidesId
assert.strictEqual(parseSlidesId(`https://docs.google.com/presentation/d/${ID}/edit#slide=id.p`), ID);
assert.strictEqual(parseSlidesId(`https://docs.google.com/presentation/u/1/d/${ID}/edit?usp=sharing`), ID);
assert.strictEqual(parseSlidesId(`  ${ID}  `), ID, 'ID mentah diterima');
assert.strictEqual(parseSlidesId('https://docs.google.com/document/d/abc/edit'), null, 'bukan Slides');
assert.strictEqual(parseSlidesId("x' or name contains 'a"), null, 'karakter berbahaya ditolak');
assert.strictEqual(parseSlidesId('short'), null);
assert.strictEqual(parseSlidesId(null), null);
console.log('   OK - parseSlidesId: URL Slides (termasuk /u/N/), ID mentah, input tidak valid.');

// ---------------------------------------------------------------- 2. validateTemplate
assert.ok(validateTemplate({ ...MARKIMATE_STANDARD_TEMPLATE, deck: { presentationId: ID } }).valid);
assert.ok(validateTemplate({ ...MARKIMATE_STANDARD_TEMPLATE, deck: null }).valid, 'deck null = pakai base deck');
for (const bad of [{ presentationId: 'x/../y' }, { presentationId: 123 }, 'string', {}]) {
  const v = validateTemplate({ ...MARKIMATE_STANDARD_TEMPLATE, deck: bad });
  assert.ok(!v.valid && v.errors.some((e) => e.code === 'INVALID_DECK'), `deck tidak valid ditolak: ${JSON.stringify(bad)}`);
}
console.log('   OK - validateTemplate: spec.deck opsional & divalidasi.');

// ---------------------------------------------------------------- 3. getDeckConfig
process.env.ADS_SERVICE_EMAIL = 'markimate.ai@gmail.com';
process.env.ADS_TEMPLATE_DECK_ID = `https://docs.google.com/presentation/d/${ID}/edit`;
{
  const c = getDeckConfig();
  assert.strictEqual(c.serviceEmail, 'markimate.ai@gmail.com');
  assert.strictEqual(c.templateCopyUrl, `https://docs.google.com/presentation/d/${ID}/copy`, 'link /copy dari ID template');
  process.env.ADS_TEMPLATE_DECK_ID = '';
  assert.strictEqual(getDeckConfig().templateCopyUrl, null);
}
console.log('   OK - getDeckConfig: email layanan & link salin template dari env.');

// ---------------------------------------------------------------- 4. checkDeck (n8n tiruan)
const sent = [];
const n8n = (status, body) => async (url, opts) => {
  sent.push({ url, opts });
  return { ok: status < 400, status, json: async () => body };
};
{
  const r = await checkDeck({ input: 'https://example.com', n8nKey: 'k', fetchFn: n8n(200, {}) });
  assert.strictEqual(r.code, 'INVALID_DECK');
  assert.strictEqual(sent.length, 0, 'URL salah tidak memanggil n8n');
}
{
  delete process.env.MARKIMATE_API_KEY;
  delete process.env.SUPERMAT_API_KEY;
  const r = await checkDeck({ input: ID, fetchFn: n8n(200, {}) });
  assert.strictEqual(r.status, 503, 'key n8n belum diisi → 503');
}
{
  const r = await checkDeck({ input: ID, n8nKey: 'k', fetchFn: async () => { throw new Error('ECONNREFUSED'); } });
  assert.strictEqual(r.code, 'ADS_SOURCE_UNAVAILABLE');
  const r2 = await checkDeck({ input: ID, n8nKey: 'k', fetchFn: n8n(500, { message: 'boom' }) });
  assert.strictEqual(r2.code, 'ADS_SOURCE_UNAVAILABLE');
}
{
  const r = await checkDeck({ input: ID, n8nKey: 'k', fetchFn: n8n(200, { accessible: false, httpStatus: 404, message: 'Google Slides HTTP 404' }) });
  assert.strictEqual(r.ok, false);
  assert.strictEqual(r.code, 'ADS_DECK_UNAVAILABLE', 'belum dibagikan → ADS_DECK_UNAVAILABLE');
  assert.strictEqual(r.status, 422);
}
{
  sent.length = 0;
  const body = {
    accessible: true, title: 'Deck Klien', slideCount: 4, layouts: ['cover', 'kpi', 'closing'],
    missingLayouts: ['trend'], issues: [{ code: 'missing_alt', slide: 2, layout: 'kpi', detail: 'x'.repeat(200) }, 'bukan objek', null]
  };
  const r = await checkDeck({ input: `https://docs.google.com/presentation/d/${ID}/edit`, pageTypes: ['cover', 'kpi', 'trend', 'kpi', 'evil'], n8nKey: 'k', fetchFn: n8n(200, body) });
  assert.strictEqual(r.ok, true);
  assert.deepStrictEqual(JSON.parse(sent[0].opts.body), { presentationId: ID }, 'hanya ID bersih yang dikirim ke n8n');
  assert.strictEqual(sent[0].opts.headers['X-Markimate-Key'], 'k');
  assert.ok(sent[0].url.endsWith('/webhook/ads-deck-check'));
  assert.strictEqual(r.ready, false);
  assert.deepStrictEqual(r.missingRequired, ['trend'], 'yang dibutuhkan = jenis halaman template (unik, jenis dikenal)');
  assert.strictEqual(r.issues.length, 1, 'issue non-objek dibuang');
  assert.strictEqual(r.issues[0].detail.length, 60, 'detail dipotong');
  const r2 = await checkDeck({ input: ID, pageTypes: ['cover', 'kpi'], n8nKey: 'k', fetchFn: n8n(200, body) });
  assert.strictEqual(r2.ready, true);
}
console.log('   OK - checkDeck: URL salah, belum dikonfigurasi, n8n down, belum dibagikan, layout per template.');

// ---------------------------------------------------------------- 5. workflow n8n Deck Check
const here = path.dirname(fileURLToPath(import.meta.url));
const wf = JSON.parse(fs.readFileSync(path.join(here, '..', '..', 'automation', 'n8n-ads-deck-check-workflow.json'), 'utf8'));
const node = (n) => {
  const x = wf.nodes.find((y) => y.name === n);
  assert.ok(x, `node ${n} ada`);
  return x;
};
const run = (n, items) => new Function('$input', node(n).parameters.jsCode)({ first: () => items[0], all: () => items });

assert.strictEqual(node('Webhook Deck Check').parameters.path, 'ads-deck-check');
assert.strictEqual(node('Webhook Deck Check').parameters.authentication, 'headerAuth', 'webhook dilindungi API key');
const httpN = node('Slides: Baca Deck (Cek)');
assert.strictEqual(httpN.parameters.nodeCredentialType, 'googleDriveOAuth2Api');
assert.ok(httpN.credentials.googleDriveOAuth2Api);
assert.strictEqual(httpN.parameters.options.response.response.neverError, true, '403/404 diteruskan ke analisa, bukan error');
const names = new Set(wf.nodes.map((n) => n.name));
for (const [from, c] of Object.entries(wf.connections)) {
  assert.ok(names.has(from));
  c.main.forEach((outs) => outs.forEach((t) => assert.ok(names.has(t.node), `${from} → ${t.node}`)));
}

assert.strictEqual(run('Validasi Deck ID', [{ json: { body: { presentationId: `https://docs.google.com/presentation/d/${ID}/edit` } } }])[0].json.presentationId, ID);
assert.strictEqual(run('Validasi Deck ID', [{ json: { body: { presentationId: '../../x' } } }])[0].json.statusCode, 400);

// deck tiruan mengikuti builder base deck (automation/ADS-BASE-DECK.md)
const T = (s) => ({ shape: { text: { textElements: [{ textRun: { content: s } }] } } });
let n = 0;
const el = (extra) => ({ objectId: `e${++n}`, ...extra });
const notes = (s) => ({ notesPage: { pageElements: [el(T(s))] } });
const L = (type, els) => ({ objectId: `s${++n}`, pageElements: [el(T('{{title}}')), ...els], slideProperties: notes(`layout:${type}`) });
const good = {
  title: 'Markimate Base Deck (Copy)',
  slides: [
    L('cover', [el(T('{{subtitle}}'))]),
    L('section', []),
    L('kpi', [el({ description: 'kpi 1', ...T('{{kpi1_label}} {{kpi1_value}} {{kpi1_delta}}') })]),
    L('trend', [el({ description: 'chart', ...T('chart') })]),
    L('breakdown', [el({ description: 'chart', ...T('chart') }), el(T('{{insight}}'))]),
    L('table', [el({ description: 'table', table: { rows: 2, columns: 9, tableRows: [] } })]),
    L('creatives', [el({ description: 'creative 1 img', image: {} }), el({ description: 'creative 1', ...T('{{c1_name}}') })]),
    L('ai_insight', [el(T('{{insight}}'))]),
    L('custom_text', [el(T('{{text}}'))]),
    { objectId: 'ci', pageElements: [el({ description: 'custom image', image: {} }), el(T('{{caption}}'))], slideProperties: notes('layout:custom_image') },
    L('closing', [el(T('{{workspace_name}}'))]),
    { objectId: 'info', pageElements: [el(T('Petunjuk pemakaian'))], slideProperties: notes('catatan biasa') }
  ]
};
{
  const r = run('Analisa Deck', [{ json: { statusCode: 200, body: good } }])[0].json;
  assert.strictEqual(r.accessible, true);
  assert.strictEqual(r.layouts.length, 11, 'semua 11 layout dikenali');
  assert.deepStrictEqual(r.missingLayouts, []);
  assert.deepStrictEqual(r.issues, [], 'deck sesuai aturan → tanpa issue');
  assert.strictEqual(r.slideCount, 12);
}
{
  const bad = {
    title: 'Deck Rusak',
    slides: [
      L('cover', [el(T('{{judul}}'))]),
      L('cover', []),
      L('trend', [el({ elementGroup: { children: [el({ description: 'chart', ...T('x') })] } })]),
      L('table', [el({ description: 'table', ...T('bukan tabel') })]),
      L('creatives', [el({ description: 'creative 1 img', ...T('kotak') })]),
      L('slidebaru', [])
    ]
  };
  const r = run('Analisa Deck', [{ json: { statusCode: 200, body: bad } }])[0].json;
  const codes = r.issues.map((i) => `${i.slide}:${i.code}${i.detail ? `:${i.detail}` : ''}`);
  for (const want of ['1:unknown_placeholder:judul', '2:duplicate_layout', '3:chart_in_group', '4:not_table', '5:not_image:creative 1 img', '6:unknown_layout']) {
    assert.ok(codes.includes(want), `issue ${want} terdeteksi (dapat: ${codes.join(', ')})`);
  }
  assert.ok(r.missingLayouts.includes('kpi'));
  assert.ok(!r.layouts.includes('slidebaru'));
}
{
  const r = run('Analisa Deck', [{ json: { statusCode: 200, body: { title: 'Kosong', slides: [{ objectId: 'a', pageElements: [] }] } } }])[0].json;
  assert.deepStrictEqual(r.issues.map((i) => i.code), ['no_layouts']);
}
for (const st of [403, 404]) {
  const r = run('Analisa Deck', [{ json: { statusCode: st, body: { error: { code: st, message: 'The caller does not have permission' } } } }])[0].json;
  assert.strictEqual(r.accessible, false, `HTTP ${st} → tidak bisa diakses`);
  assert.strictEqual(r.httpStatus, st);
}
console.log('   OK - Workflow Deck Check: validasi ID, 11 layout, issue alt text/placeholder/group/tabel/gambar, 403/404.');

console.log('\n🎉 SEMUA TEST DECK USER LOLOS!');
process.exit(0);
