// Fase 6 — Kumpulkan kandidat topik dari Trends (rising dulu, lalu top) per seed; saring: cocok dengan seed, tidak duplikat artikel lama, tidak duplikat antar kandidat
const N = $('Auth & Normalize (Topics)').first().json;
const seeds = $('Seeds & Artikel CMS').all().map(i => i.json);
const resps = $input.all().map(i => i.json || {});
const existing = (seeds[0] || {}).existingPosts || [];
__CMS__
const stop = new Set(['di', 'ke', 'dari', 'yang', 'dan', 'untuk', 'dengan', 'ada', 'adalah', 'itu', 'ini', 'cara', 'tips', 'info', 'the', 'a', 'an', 'of', 'for', 'in', 'on', 'to']);
const esc = s => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
const skipped = { duplicate: 0, noMatch: 0, trendsError: 0 };
const cands = []; const seen = new Set();
resps.forEach((t, i) => {
  const seed = (seeds[i] || {}).seed || '';
  if (t.error) skipped.trendsError++;
  const rq = t.related_queries || {};
  const pool = [...(rq.rising || []).map(x => ({ q: x.query, src: 'trends_rising', v: x.extracted_value || 0 })), ...(rq.top || []).map(x => ({ q: x.query, src: 'trends_top', v: x.extracted_value || 0 }))];
  const terms = [seed, ...seed.split(/\s+/).map(w => w.replace(/[^a-z0-9]/g, '')).filter(w => w.length > 2 && !stop.has(w))];
  const matches = q => terms.some(tm => tm.includes(' ') ? q.includes(tm) : new RegExp('\\b' + esc(tm) + '\\b', 'i').test(q));
  for (const p of pool) {
    const q = String(p.q || '').trim().toLowerCase();
    if (!q || q === seed || seen.has(q)) continue;
    if (!matches(q)) { skipped.noMatch++; continue; }
    if (findDuplicate(q, existing, N.duplicateThreshold)) { skipped.duplicate++; continue; }
    if (cands.some(c => topicSimilarity(q, c.query) >= N.duplicateThreshold)) { skipped.duplicate++; continue; }
    seen.add(q); cands.push({ query: q, seed, source: p.src, trendValue: Number(p.v) || 0 });
  }
});
const out = cands.slice(0, Math.max(N.limit * 4, 8)).map(c => ({ json: Object.assign(c, { skipped, geoLower: N.geo.toLowerCase() }) }));
return out.length ? out : [{ json: { query: '', empty: true, skipped, geoLower: N.geo.toLowerCase() } }];
