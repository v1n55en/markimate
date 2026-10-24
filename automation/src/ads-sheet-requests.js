// automation/src/ads-sheet-requests.js
// Susun Google Sheets batchUpdate: satu tab data per grafik + chart (ID deterministik 1000+k)
// supaya bisa langsung di-link ke Slides tanpa membaca respons (PRD F5 §3.7 2a, "linked Sheets chart").

const proc = $('Parse Insight').first().json;
const job = $('Auth & Normalize (Ads)').first().json;
const spreadsheetId = $input.first().json.id;
if (!spreadsheetId) throw new Error('ADS_REPORT_FAILED - spreadsheet data tidak terbuat');

const L = (id, en) => (job.locale === 'en' ? en : id);
const requests = [{ updateSpreadsheetProperties: { properties: { title: `Data – ${proc.period}` }, fields: 'title' } }];
const chartMap = {};

proc.charts.forEach((c, k) => {
  const sheetId = 100 + k;
  const chartId = 1000 + k;
  const header = [c.header[0] || L('Kategori', 'Category'), ...c.header.slice(1)];
  const rows = c.rows.length ? c.rows : [['—', ...header.slice(1).map(() => 0)]];
  const nCols = header.length;
  const cell = (v) => (typeof v === 'number' ? { userEnteredValue: { numberValue: v } } : { userEnteredValue: { stringValue: String(v) } });
  requests.push({ addSheet: { properties: { sheetId, title: `p${c.pageIndex + 1}`, gridProperties: { rowCount: Math.max(rows.length + 5, 20), columnCount: nCols + 12 } } } });
  requests.push({ updateCells: { start: { sheetId, rowIndex: 0, columnIndex: 0 }, rows: [header, ...rows].map((r) => ({ values: r.map(cell) })), fields: 'userEnteredValue' } });

  const src = (col) => ({ sourceRange: { sources: [{ sheetId, startRowIndex: 0, endRowIndex: rows.length + 1, startColumnIndex: col, endColumnIndex: col + 1 }] } });
  let spec;
  if (c.kind === 'pie') {
    spec = { pieChart: { legendPosition: 'RIGHT_LEGEND', domain: src(0), series: src(1), pieHole: 0.45 } };
  } else {
    const type = c.kind === 'line' ? 'LINE' : c.kind === 'combo' ? 'COMBO' : 'COLUMN';
    spec = {
      basicChart: {
        chartType: type,
        legendPosition: 'BOTTOM_LEGEND',
        headerCount: 1,
        axis: [{ position: 'BOTTOM_AXIS' }, { position: 'LEFT_AXIS' }],
        domains: [{ domain: src(0) }],
        series: header.slice(1).map((_, j) => ({
          series: src(j + 1),
          targetAxis: j === 0 ? 'LEFT_AXIS' : 'RIGHT_AXIS',
          ...(type === 'COMBO' ? { type: j === 0 ? 'COLUMN' : 'LINE' } : {})
        }))
      }
    };
  }
  requests.push({ addChart: { chart: { chartId, spec, position: { overlayPosition: { anchorCell: { sheetId, rowIndex: 0, columnIndex: nCols + 1 } } } } } });
  chartMap[c.pageIndex] = chartId;
});

return [{ json: { spreadsheetId, requests, chartMap } }];
