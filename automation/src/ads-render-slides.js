// automation/src/ads-render-slides.js
// Susun Slides batchUpdate untuk deck salinan base deck (PRD F5 §3.7 langkah 2, 2a).
// Base deck: 1 slide layout per jenis halaman, ditandai di SPEAKER NOTES dengan "layout:<type>".
// Elemen dikenali lewat alt text (description) atau placeholder teks {{...}} — bukan posisi.
// Detail konvensi: automation/ADS-BASE-DECK.md.
//
// Urutan request: duplikat layout per halaman (ID objek deterministik) → isi teks/tabel/grafik
// → urutkan slide → hapus semua slide asli base deck. Gambar creative dikirim TERPISAH
// (node "Susun Request Gambar") supaya satu URL gambar yang gagal tidak menggagalkan laporan.

const pres = $input.first().json;
const proc = $('Parse Insight').first().json;
const job = $('Auth & Normalize (Ads)').first().json;
const sheet = $('Susun Data Grafik').first().json;
const warnings = [];

if (!pres || !Array.isArray(pres.slides)) throw new Error('ADS_REPORT_FAILED - base deck tidak bisa dibaca');

// ---------- util ----------
const textOf = (te) => (Array.isArray(te) ? te.map((t) => (t.textRun ? t.textRun.content : '')).join('') : '');
function walk(elements, fn) {
  for (const el of elements || []) {
    fn(el);
    if (el.elementGroup) walk(el.elementGroup.children, fn);
  }
}
function slideTexts(slide) {
  const out = [];
  walk(slide.pageElements, (el) => {
    if (el.shape && el.shape.text) out.push(textOf(el.shape.text.textElements));
    if (el.table) for (const r of el.table.tableRows || []) for (const c of r.tableCells || []) if (c.text) out.push(textOf(c.text.textElements));
  });
  return out.join('\n');
}
function notesText(slide) {
  const np = slide.slideProperties && slide.slideProperties.notesPage;
  if (!np) return '';
  const parts = [];
  walk(np.pageElements, (el) => {
    if (el.shape && el.shape.text) parts.push(textOf(el.shape.text.textElements));
  });
  return parts.join('\n');
}
const role = (el) => String(el.description || '').trim().toLowerCase();
const toEmu = (d) => (!d ? 0 : d.unit === 'PT' ? d.magnitude * 12700 : d.magnitude || 0);
function boxOf(el) {
  const t = el.transform || {};
  const k = t.unit === 'PT' ? 12700 : 1;
  return {
    x: Math.round((t.translateX || 0) * k),
    y: Math.round((t.translateY || 0) * k),
    w: Math.round(toEmu(el.size && el.size.width) * (t.scaleX || 1)),
    h: Math.round(toEmu(el.size && el.size.height) * (t.scaleY || 1))
  };
}

// ---------- peta layout ----------
const layouts = {};
for (const s of pres.slides) {
  const m = notesText(s).match(/layout\s*:\s*([a-z_]+)/i);
  if (m && !layouts[m[1].toLowerCase()]) layouts[m[1].toLowerCase()] = s;
}
if (!Object.keys(layouts).length) throw new Error('ADS_REPORT_FAILED - base deck tidak punya slide layout (speaker notes "layout:<type>")');

const common = {
  period: proc.period,
  account_name: (proc.summary.accounts || []).map((a) => a.name).join(', '),
  workspace_name: job.workspaceName || '',
  client_name: job.workspaceName || '',
  ads_platform: 'Meta Ads'
};

const requests = [];
const contentReqs = [];
const imageJobs = [];
const newSlideIds = [];

proc.model.forEach((page, pi) => {
  const layout = layouts[page.type];
  if (!layout) {
    warnings.push(`layout_missing:${page.type}`);
    return;
  }
  const P = `mk${String(pi).padStart(2, '0')}`;
  const slideId = `${P}slide`;
  const idMap = { [layout.objectId]: slideId };
  let seq = 0;
  walk(layout.pageElements, (el) => {
    idMap[el.objectId] = `${P}e${++seq}`;
  });
  requests.push({ duplicateObject: { objectId: layout.objectId, objectIds: idMap } });
  newSlideIds.push(slideId);
  const nid = (el) => idMap[el.objectId];

  // ---- nilai placeholder teks ----
  const values = { ...common, title: page.title || '', subtitle: page.subtitle || '', insight: page.insight || '', text: page.text || '', caption: page.caption || '' };
  (page.kpis || []).forEach((k, i) => {
    values[`kpi${i + 1}_label`] = k.label;
    values[`kpi${i + 1}_value`] = k.value;
    values[`kpi${i + 1}_delta`] = k.delta;
  });
  (page.creatives || []).forEach((c, i) => {
    values[`c${i + 1}_name`] = c.name;
    values[`c${i + 1}_metrics`] = c.metrics;
  });
  const found = new Set();
  const re = /\{\{\s*([a-z0-9_]+)\s*\}\}/gi;
  let m;
  const txt = slideTexts(layout);
  while ((m = re.exec(txt))) found.add(m[0]);
  for (const token of found) {
    const key = token.replace(/[{}\s]/g, '').toLowerCase();
    // slot KPI/creative yang tidak terpakai → kosong; placeholder tak dikenal → kosong + warning
    const known = key in values || /^kpi\d+_(label|value|delta)$/.test(key) || /^c\d+_(name|metrics)$/.test(key);
    if (!known) warnings.push(`unknown_placeholder:${page.type}:${key}`);
    contentReqs.push({ replaceAllText: { containsText: { text: token, matchCase: true }, replaceText: String(values[key] ?? ''), pageObjectIds: [slideId] } });
  }

  // ---- elemen berdasarkan alt text ----
  let chartSeq = 0;
  const nKpi = (page.kpis || []).length;
  const nCre = (page.creatives || []).length;
  walk(layout.pageElements, (el) => {
    const r = role(el);
    if (!r) return;
    let mm;
    if ((mm = r.match(/^kpi (\d+)$/)) && Number(mm[1]) > nKpi) {
      contentReqs.push({ deleteObject: { objectId: nid(el) } });
    } else if ((mm = r.match(/^creative (\d+)( img)?$/))) {
      const n = Number(mm[1]);
      if (n > nCre) contentReqs.push({ deleteObject: { objectId: nid(el) } });
      else if (mm[2] && el.image) {
        const c = page.creatives[n - 1];
        if (c.imageUrl) imageJobs.push({ replaceImage: { imageObjectId: nid(el), url: c.imageUrl, imageReplaceMethod: 'CENTER_CROP' }, ref: `creative:${c.adId}` });
      }
    } else if (r === 'custom image' && el.image && page.imageUrl) {
      imageJobs.push({ replaceImage: { imageObjectId: nid(el), url: page.imageUrl, imageReplaceMethod: 'CENTER_INSIDE' }, ref: `custom_image:page${pi}` });
    } else if (r === 'chart') {
      const chartId = sheet.chartMap[String(page.index)];
      if (chartId === undefined) {
        warnings.push(`chart_without_data:page${pi}`);
        return;
      }
      const b = boxOf(el);
      contentReqs.push({
        createSheetsChart: {
          objectId: `${P}ch${++chartSeq}`,
          spreadsheetId: sheet.spreadsheetId,
          chartId,
          linkingMode: 'LINKED',
          elementProperties: {
            pageObjectId: slideId,
            size: { width: { magnitude: b.w, unit: 'EMU' }, height: { magnitude: b.h, unit: 'EMU' } },
            transform: { scaleX: 1, scaleY: 1, shearX: 0, shearY: 0, translateX: b.x, translateY: b.y, unit: 'EMU' }
          }
        }
      });
      contentReqs.push({ deleteObject: { objectId: nid(el) } });
    } else if (r === 'table' && el.table && page.table) {
      const tid = nid(el);
      const t = page.table;
      const R = el.table.rows;
      const C = el.table.columns;
      const header = t.header.slice(0, C);
      if (t.header.length > C) warnings.push(`table_columns_truncated:page${pi}:${t.header.length}>${C}`);
      const n = header.length;
      const data = t.rows.length ? t.rows.map((row) => row.slice(0, n)) : [[t.empty, ...header.slice(1).map(() => '–')]];
      const cellHasText = (ri, ci) => {
        const row = el.table.tableRows[ri];
        const cell = row && row.tableCells[ci];
        return Boolean(cell && cell.text && textOf(cell.text.textElements).replace(/\n/g, '').length);
      };
      // kolom berlebih (dari kanan)
      for (let c = C - 1; c >= n; c--) contentReqs.push({ deleteTableColumn: { tableObjectId: tid, cellLocation: { rowIndex: 0, columnIndex: c } } });
      // baris data: tambah / hapus
      const have = R - 1;
      if (data.length > have) contentReqs.push({ insertTableRows: { tableObjectId: tid, cellLocation: { rowIndex: R - 1, columnIndex: 0 }, insertBelow: true, number: data.length - have } });
      for (let r2 = have; r2 > data.length; r2--) contentReqs.push({ deleteTableRow: { tableObjectId: tid, cellLocation: { rowIndex: r2, columnIndex: 0 } } });
      const put = (ri, ci, text) => {
        if (ri < R && ci < C && cellHasText(ri, ci)) contentReqs.push({ deleteText: { objectId: tid, cellLocation: { rowIndex: ri, columnIndex: ci }, textRange: { type: 'ALL' } } });
        if (String(text).length) contentReqs.push({ insertText: { objectId: tid, cellLocation: { rowIndex: ri, columnIndex: ci }, text: String(text), insertionIndex: 0 } });
      };
      header.forEach((h, ci) => put(0, ci, h));
      data.forEach((row, ri) => row.forEach((v, ci) => put(ri + 1, ci, v)));
    }
  });
});

if (!newSlideIds.length) throw new Error('ADS_REPORT_FAILED - tidak ada halaman yang punya layout di base deck');

requests.push(...contentReqs);
requests.push({ updateSlidesPosition: { slideObjectIds: newSlideIds, insertionIndex: 0 } });
for (const s of pres.slides) requests.push({ deleteObject: { objectId: s.objectId } });

return [{ json: { presentationId: pres.presentationId, requests, imageJobs, warnings } }];
