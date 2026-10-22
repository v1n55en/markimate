// Fase 6 — Terapkan hasil Gemini: sisipkan internal/external link ke markdown + placeholder gambar, lalu kembalikan respons generate.
const R = JSON.parse(JSON.stringify($('Susun Artikel').first().json));
const P = $('Siapkan Prompt Link').first().json;
const D = $('Cek Duplikat').first().json;
const O = D.options || {};
let G = $input.first().json || {};
const H = (typeof this !== 'undefined' && this && this.helpers) || null;
const warnings = [];

// Deteksi respons terpotong karena batas token (finishReason = MAX_TOKENS)
const cand0 = (G.candidates || [])[0] || {};
const finishReason = cand0.finishReason || G.finishReason;

let firstCand = null;
try {
  firstCand = ($('Gemini Link & Gambar').first().json.candidates || [])[0] || {};
} catch (_) {}
const firstFinishReason = firstCand?.finishReason;

if (firstFinishReason === 'MAX_TOKENS') {
  warnings.push('Peringatan: Respons AI terpotong karena mencapai batas token (finishReason = MAX_TOKENS). Mengulang sekali dengan batas token lebih besar (16384).');
}
if (finishReason === 'MAX_TOKENS') {
  warnings.push('Peringatan: Respons AI tetap mencapai batas token (finishReason = MAX_TOKENS) setelah pengulangan dengan batas 16384 token.');
}

// --- parse JSON Gemini (toleran) ---
let parsed = null;
try {
  const txt = (((G.candidates || [])[0] || {}).content || {}).parts?.map(p => p.text || '').join('') || '';
  const clean = String(txt).replace(/```json/gi, '').replace(/```/g, '').trim();
  const a = clean.indexOf('{'), b = clean.lastIndexOf('}');
  parsed = JSON.parse(a >= 0 && b > a ? clean.slice(a, b + 1) : clean);
} catch (e) { parsed = null; }
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

// --- prompt gambar + placeholder di markdown (PRD F6b §3.3) ---
const want = (O.imageMode === 'none') ? 0 : (P.wantImages || 0);
const heroActive = want > 0 && O.imageHero !== false;
const rawPrompts = (O.imageMode === 'none') ? [] : (Array.isArray(parsed.imagePrompts) ? parsed.imagePrompts : []).filter(p => p && p.prompt);

const h2Idx = lines.map((l, i) => (/^\s*##\s/.test(l) ? i : -1)).filter(i => i >= 0);
const totalH2 = h2Idx.length;
const usedH2 = new Set();
let usedIntro = false;
const validPrompts = [];
const inserts = []; // [lineIndex, text]

for (let i = 0; i < Math.min(rawPrompts.length, want); i++) {
  const p = rawPrompts[i];
  const isHero = (i === 0 && heroActive) || (p.placement === 'hero' && heroActive);
  if (isHero) {
    validPrompts.push({
      idx: validPrompts.length,
      placement: 'hero',
      sectionTitle: p.sectionTitle || 'Hero',
      prompt: String(p.prompt).trim(),
      alt: String(p.alt || A.title).trim(),
      aspect: '16:9'
    });
    continue;
  }

  // Parse nomor H2 target ("h2:<n>" atau "after_h2:<n>")
  const m = String(p.placement || '').match(/^(?:after_)?h2:(\d+)$/i);
  let k = m ? Number(m[1]) : 0;

  // Validasi: di luar jangkauan atau H2 duplikat -> cari H2 kosong terdekat (§3.3 butir 6)
  if (k < 1 || k > totalH2 || usedH2.has(k)) {
    let nearestEmpty = null;
    let minDiff = Infinity;
    for (let candidate = 1; candidate <= totalH2; candidate++) {
      if (!usedH2.has(candidate)) {
        const diff = Math.abs(candidate - (k || 1));
        if (diff < minDiff) {
          minDiff = diff;
          nearestEmpty = candidate;
        }
      }
    }

    if (nearestEmpty !== null) {
      if (k > 0) warnings.push(`Penempatan gambar dialihkan dari ${p.placement} ke h2:${nearestEmpty} (H2 kosong terdekat).`);
      k = nearestEmpty;
    } else if (!usedIntro) {
      // Fallback: sisa gambar ditempatkan setelah paragraf ke-2 intro (§3.3 butir 4)
      k = 0;
      usedIntro = true;
      warnings.push(`Jumlah H2 (${totalH2}) lebih sedikit dari gambar yang diminta; sisa gambar ditempatkan setelah intro.`);
    } else {
      // Tidak ada ruang lagi -> gambar tidak dibuat, kredit tidak dipotong (§3.3 butir 4)
      warnings.push(`Bagian artikel tidak mencukupi untuk gambar tambahan; gambar idx ${i} dilewati.`);
      continue;
    }
  }

  if (k > 0) usedH2.add(k);

  const curIdx = validPrompts.length;
  const placement = k > 0 ? `h2:${k}` : 'intro';
  const promptObj = {
    idx: curIdx,
    placement,
    sectionTitle: p.sectionTitle || (k > 0 ? `Section ${k}` : 'Intro'),
    prompt: String(p.prompt).trim(),
    alt: String(p.alt || A.title).trim(),
    aspect: '4:3'
  };
  validPrompts.push(promptObj);

  // Cari posisi baris di markdown
  let at = lines.length;
  if (k >= 1) {
    at = h2Idx[k - 1] + 1;
    while (at < lines.length && !lines[at].trim()) at++;
    while (at < lines.length && lines[at].trim() && !isHeading(lines[at])) at++;
  } else {
    let paras = 0;
    for (let l = 0; l < lines.length; l++) {
      if (isHeading(lines[l])) break;
      if (lines[l].trim() && (l + 1 >= lines.length || !lines[l + 1].trim())) {
        if (++paras === 2) { at = l + 1; break; }
      }
    }
  }

  inserts.push([at, '\n![' + promptObj.alt.replace(/[\[\]]/g, '') + '](markimate:image:' + curIdx + ')\n']);
}

if (want > 0 && !validPrompts.length) {
  warnings.push('AI tidak mengembalikan prompt gambar yang valid; artikel dibuat tanpa gambar.');
}

inserts.sort((a, b) => b[0] - a[0]);
for (const [at, text] of inserts) lines.splice(at, 0, text);
md = lines.join('\n').replace(/\n{3,}/g, '\n\n');
const prompts = validPrompts;

A.bodyMarkdown = md;
A.links = applied;
A.imagePrompts = prompts;
A.wordCount = md.replace(/!\[[^\]]*\]\([^)]*\)/g, '').split(/\s+/).filter(Boolean).length;
R.research = Object.assign({}, R.research, { existingPostsChecked: D.existingPostsChecked || 0, internalCandidates: (P.internalCandidates || []).length, externalCandidates: (P.externalCandidates || []).length });
R.warnings = warnings;
return [{ json: R }];
