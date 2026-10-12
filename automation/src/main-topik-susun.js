// Fase 6 — Gabungkan metrik Ahrefs ke kandidat, saring volume minimum, urutkan, batasi jumlah → respons
const N = $('Auth & Normalize (Topics)').first().json;
const cands = $('Kumpulkan Kandidat').all().map(i => i.json);
const metrics = $input.all().map(i => i.json || {});
const num = v => { const n = Number(v); return Number.isFinite(n) ? n : 0; };
const skipped = Object.assign({ duplicate: 0, noMatch: 0, trendsError: 0 }, (cands[0] || {}).skipped || {}, { lowVolume: 0 });
const rows = [];
cands.forEach((c, i) => {
  if (c.empty) return;
  const m = metrics[i] || {}; const d = m.data || m || {};
  const vol = num(d.globalSearchVolume ?? d.searchVolume ?? d.volume);
  if (vol < N.minVolume) { skipped.lowVolume++; return; }
  rows.push({ keyword: c.query, seed: c.seed, source: c.source, searchVolume: vol, difficulty: (d.difficulty === null || d.difficulty === undefined || d.difficulty === '') ? null : num(d.difficulty), trafficPotential: num(d.trafficPotential), trendValue: c.trendValue });
});
rows.sort((a, b) => (b.source === 'trends_rising') - (a.source === 'trends_rising') || b.searchVolume - a.searchVolume);
return [{ json: { status: 'ok', statusCode: 200, topics: rows.slice(0, N.limit), candidatesChecked: cands.filter(c => !c.empty).length, skipped, requestId: N.requestId } }];
