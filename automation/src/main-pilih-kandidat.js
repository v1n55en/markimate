// Pilih kandidat keyword dari Google Trends (rising + top) yang masih relevan dengan seed keyword.
// Seed keyword SELALU jadi kandidat pertama, jadi alur tidak pernah mati walau Trends kosong/error.
const N = $('Auth & Normalize').first().json;
let t = {}; try { t = $('Riset Google Trends').first().json || {}; } catch (e) {}
let ac = {}; try { ac = $('Riset Autocomplete').first().json || {}; } catch (e) {} // SerpAPI google_autocomplete (opsional)
const rq = t.related_queries || {};
const pool = [
  ...(rq.rising || []), ...(rq.top || []),
].map(x => String(x.query || '').trim()).concat((ac.suggestions || []).map(s => String(s.value || '').trim())).filter(Boolean);

const seed = N.keyword.toLowerCase();
const stop = new Set(['di', 'ke', 'dari', 'yang', 'dan', 'untuk', 'dengan', 'ada', 'adalah', 'itu', 'ini', 'cara', 'tips', 'info', 'the', 'a', 'an', 'of', 'for', 'in', 'on', 'to']);
const terms = [seed, ...seed.split(/\s+/).map(w => w.replace(/[^a-z0-9]/g, '')).filter(w => w.length > 2 && !stop.has(w))];
const esc = s => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
const matches = q => terms.some(tm => tm.includes(' ') ? q.includes(tm) : new RegExp('\\b' + esc(tm) + '\\b', 'i').test(q));

const matched = pool.filter(q => q.toLowerCase() !== seed && matches(q.toLowerCase()));
const uniq = [...new Set([N.keyword, ...matched])].slice(0, 3);
return uniq.map((q, i) => ({ json: { query: q, isSeed: i === 0, source: i === 0 ? 'seed' : 'trends/autocomplete', trendsError: t.error ? String(t.error.message || t.error) : '' } }));
