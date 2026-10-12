// Fase 6 — Terapkan hasil Gemini: sisipkan internal/external link ke markdown + placeholder gambar, lalu kembalikan respons generate.
const R = JSON.parse(JSON.stringify($('Susun Artikel').first().json));
const P = $('Siapkan Prompt Link').first().json;
const D = $('Cek Duplikat').first().json;
const O = D.options || {};
const G = $input.first().json || {};

// --- parse JSON Gemini (toleran) ---
let parsed = null;
try {
  const txt = (((G.candidates || [])[0] || {}).content || {}).parts?.map(p => p.text || '').join('') || '';
  const clean = String(txt).replace(/```json/gi, '').replace(/```/g, '').trim();
  const a = clean.indexOf('{'), b = clean.lastIndexOf('}');
  parsed = JSON.parse(a >= 0 && b > a ? clean.slice(a, b + 1) : clean);
} catch (e) { parsed = null; }
const warnings = [];
if (!parsed) warnings.push('Link & prompt gambar dilewati: ' + (G.error ? String(G.error.message || G.error).slice(0, 140) : 'respons AI tidak valid'));
parsed = parsed || { internal: [], external: [], imagePrompts: [] };

const A = R.article;
let md = String(A.bodyMarkdown || '');
const lines = md.split('\n');
const isHeading = l => /^\s*#{1,6}\s/.test(l);
const esc = s => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
const usedUrls = new Set();
const applied = { internal: [], external: [] };

function applyLink(item, type, allowed, max) {
  if (applied[type].length >= max) return;
  const anchor = String(item.anchor || '').trim(); const url = String(item.url || '').trim();
  if (!anchor || !url || usedUrls.has(url)) return;
  const cand = allowed.find(c => c.url === url); if (!cand) return; // url harus dari kandidat (anti halusinasi)
  const re = new RegExp('(^|[^\\[\\w])(' + esc(anchor) + ')(?![^\\[]*\\]\\()(?!\\w)');
  for (let i = 0; i < lines.length; i++) {
    if (isHeading(lines[i]) || /^\s*!\[/.test(lines[i]) || !re.test(lines[i])) continue;
    lines[i] = lines[i].replace(re, (m, pre, a) => pre + '[' + a + '](' + url + ')');
    usedUrls.add(url);
    applied[type].push(type === 'internal' ? { anchor, url, title: cand.title || item.title || '' } : { anchor, url, domain: cand.domain || '' });
    return;
  }
}
for (const it of (Array.isArray(parsed.internal) ? parsed.internal : [])) applyLink(it, 'internal', P.internalCandidates || [], O.maxInternal || 0);
for (const it of (Array.isArray(parsed.external) ? parsed.external : [])) applyLink(it, 'external', P.externalCandidates || [], O.maxExternal || 0);

// --- prompt gambar + placeholder di markdown ---
const want = P.wantImages || 0;
let prompts = (Array.isArray(parsed.imagePrompts) ? parsed.imagePrompts : []).filter(p => p && p.prompt).slice(0, want)
  .map((p, i) => ({ idx: i, placement: i === 0 ? 'hero' : String(p.placement || ('after_h2:' + (i === 1 ? 1 : 3))), prompt: String(p.prompt).trim(), alt: String(p.alt || A.title).trim(), aspect: i === 0 ? '16:9' : '4:3' }));
if (want && !prompts.length) warnings.push('AI tidak mengembalikan prompt gambar; artikel tanpa gambar.');

const h2Idx = lines.map((l, i) => (/^\s*##\s/.test(l) ? i : -1)).filter(i => i >= 0);
const inserts = []; // [lineIndex, text]
for (const p of prompts) {
  if (p.placement === 'hero') continue;
  const m = p.placement.match(/after_h2:(\d+)/); let k = m ? Number(m[1]) : 1;
  if (k > h2Idx.length) k = h2Idx.length;
  let at;
  if (k >= 1) { at = h2Idx[k - 1] + 1; while (at < lines.length && !lines[at].trim()) at++; while (at < lines.length && lines[at].trim() && !isHeading(lines[at])) at++; } // setelah paragraf pertama di bawah H2
  else { let paras = 0; at = lines.length; for (let i = 0; i < lines.length; i++) { if (lines[i].trim() && !isHeading(lines[i]) && (i + 1 >= lines.length || !lines[i + 1].trim())) { if (++paras === 2) { at = i + 1; break; } } } }
  inserts.push([at, '\n![' + p.alt.replace(/[\[\]]/g, '') + '](markimate:image:' + p.idx + ')\n']);
}
inserts.sort((a, b) => b[0] - a[0]);
for (const [at, text] of inserts) lines.splice(at, 0, text);
md = lines.join('\n').replace(/\n{3,}/g, '\n\n');

A.bodyMarkdown = md;
A.links = applied;
A.imagePrompts = prompts;
A.wordCount = md.replace(/!\[[^\]]*\]\([^)]*\)/g, '').split(/\s+/).filter(Boolean).length;
R.research = Object.assign({}, R.research, { existingPostsChecked: D.existingPostsChecked || 0, internalCandidates: (P.internalCandidates || []).length, externalCandidates: (P.externalCandidates || []).length });
R.warnings = warnings;
return [{ json: R }];
