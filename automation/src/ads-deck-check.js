// automation/src/ads-deck-check.js
// Analisa deck Google Slides milik user sebelum dipakai untuk laporan (PRD F5 opsi A).
// Input: respons penuh "Slides: Baca Deck (Cek)" ({ statusCode, body }).
// Aturan sama dengan ads-render-slides.js — lihat automation/ADS-BASE-DECK.md.
// Output selalu 200: { accessible, httpStatus, title, slideCount, layouts, missingLayouts, issues[{code,slide,layout,detail}], message }.

const res = $input.first().json || {};
const status = Number(res.statusCode) || 0;
const pres = res.body && typeof res.body === 'object' ? res.body : {};

if (status !== 200 || !Array.isArray(pres.slides)) {
  const gErr = (pres && pres.error) || {};
  // 403/404 = belum dibagikan ke email layanan atau ID salah. Pesan Google diteruskan apa adanya (dipotong).
  const message = `Google Slides HTTP ${status || '?'}${gErr.message ? ` - ${String(gErr.message).slice(0, 160)}` : ''}`;
  return [{ json: { accessible: false, httpStatus: status || null, message } }];
}

const TYPES = ['cover', 'section', 'kpi', 'trend', 'breakdown', 'table', 'creatives', 'ai_insight', 'custom_text', 'custom_image', 'closing'];
const COMMON = ['title', 'subtitle', 'period', 'account_name', 'workspace_name', 'client_name', 'ads_platform', 'insight', 'text', 'caption'];
const isKnown = (k) => COMMON.includes(k) || /^kpi[1-8]_(label|value|delta)$/.test(k) || /^c[1-9]_(name|metrics)$/.test(k);

const textOf = (te) => (Array.isArray(te) ? te.map((t) => (t.textRun ? t.textRun.content : '')).join('') : '');
function walk(elements, fn, depth = 0) {
  for (const el of elements || []) {
    fn(el, depth);
    if (el.elementGroup) walk(el.elementGroup.children, fn, depth + 1);
  }
}
function notesText(slide) {
  const np = slide.slideProperties && slide.slideProperties.notesPage;
  const parts = [];
  if (np) walk(np.pageElements, (el) => { if (el.shape && el.shape.text) parts.push(textOf(el.shape.text.textElements)); });
  return parts.join('\n');
}
function slideTexts(slide) {
  const out = [];
  walk(slide.pageElements, (el) => {
    if (el.shape && el.shape.text) out.push(textOf(el.shape.text.textElements));
    if (el.table) for (const r of el.table.tableRows || []) for (const c of r.tableCells || []) if (c.text) out.push(textOf(c.text.textElements));
  });
  return out.join('\n');
}

const layouts = [];
const issues = [];
pres.slides.forEach((slide, idx) => {
  const m = notesText(slide).match(/layout\s*:\s*([a-z_]+)/i);
  if (!m) return;
  const type = m[1].toLowerCase();
  const issue = (code, detail) => issues.push({ code, slide: idx + 1, layout: type, ...(detail ? { detail } : {}) });
  if (!TYPES.includes(type)) {
    issue('unknown_layout');
    return;
  }
  if (layouts.includes(type)) {
    issue('duplicate_layout');
    return;
  }
  layouts.push(type);

  // placeholder
  const tokens = new Set();
  const re = /\{\{\s*([a-z0-9_]+)\s*\}\}/gi;
  let t;
  const txt = slideTexts(slide);
  while ((t = re.exec(txt))) tokens.add(t[1].toLowerCase());
  for (const k of tokens) if (!isKnown(k)) issue('unknown_placeholder', k);
  if (!tokens.has('title') && type !== 'custom_image') issue('missing_placeholder', 'title');

  // alt text
  const roles = [];
  walk(slide.pageElements, (el, depth) => {
    const r = String(el.description || '').trim().toLowerCase();
    if (!r) return;
    roles.push(r);
    if (r === 'chart' && depth > 0) issue('chart_in_group');
    if ((/^creative \d+ img$/.test(r) || r === 'custom image') && !el.image) issue('not_image', r);
    if (r === 'table') {
      if (!el.table) issue('not_table');
      else if ((el.table.rows || 0) < 2) issue('table_too_small');
    }
  });
  const has = (r) => roles.includes(r);
  if ((type === 'trend' || type === 'breakdown') && !has('chart')) issue('missing_alt', 'chart');
  if (type === 'breakdown' && !tokens.has('insight')) issue('missing_placeholder', 'insight');
  if (type === 'table' && !has('table')) issue('missing_alt', 'table');
  if (type === 'kpi' && ![...tokens].some((k) => /^kpi\d_value$/.test(k))) issue('missing_placeholder', 'kpiN_value');
  if (type === 'creatives' && !roles.some((r) => /^creative \d+( img)?$/.test(r))) issue('missing_alt', 'creative N');
  if (type === 'ai_insight' && !tokens.has('insight')) issue('missing_placeholder', 'insight');
  if (type === 'custom_text' && !tokens.has('text')) issue('missing_placeholder', 'text');
  if (type === 'custom_image' && !has('custom image')) issue('missing_alt', 'custom image');
});

if (!layouts.length) issues.push({ code: 'no_layouts' });

return [{
  json: {
    accessible: true,
    httpStatus: 200,
    title: pres.title || '',
    slideCount: pres.slides.length,
    layouts,
    missingLayouts: TYPES.filter((x) => !layouts.includes(x)),
    issues: issues.slice(0, 50)
  }
}];
