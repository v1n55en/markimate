// Fase 6 — Susun prompt Gemini untuk: internal link (artikel lama di CMS), external link (hasil Google), dan prompt gambar.
// Input node ini = respons SerpAPI "Cari Sumber Eksternal" (boleh error/kosong). Artikel diambil dari "Susun Artikel".
const R = $('Susun Artikel').first().json;
const D = $('Cek Duplikat').first().json;
const O = D.options || {};
const A = R.article || {};
const S = $input.first().json || {};

__CMS__

// --- kandidat internal: artikel lama paling mirip dengan topik (maks 30) ---
const existing = (D.existingPosts || []).filter(p => p.url && p.title && String(p.slug || '') !== String(A.slug || ''));
const scored = existing.map(p => ({ p, s: topicSimilarity(p.title, A.title + ' ' + (A.keywords || []).join(' ')) })).sort((a, b) => b.s - a.s);
const internal = (O.internalLinks ? scored.slice(0, 30) : []).map(({ p }, i) => ({ id: 'I' + (i + 1), title: p.title, url: p.url }));

// --- kandidat eksternal: organic results SerpAPI (pakai ulang hasil Google Search Riset AI Agent bila Cari Sumber Eksternal kosong/timeout) ---
let organicList = S.organic_results || [];
if (!organicList.length) {
  try {
    const aiSearch = $('Google Search Riset').all();
    for (const it of aiSearch) {
      if (Array.isArray(it.json?.organic_results)) organicList.push(...it.json.organic_results);
      else if (it.json?.link) organicList.push(it.json);
    }
  } catch (_) {}
}
const excl = (O.excludeDomains || []).map(d => String(d).toLowerCase());
const own = (() => { try { return new URL(O.siteBaseUrl).hostname.replace(/^www\./, ''); } catch (e) { return ''; } })();
const host = u => { try { return new URL(u).hostname.replace(/^www\./, '').toLowerCase(); } catch (e) { return ''; } };
const external = (O.externalLinks ? organicList : []).filter(r => r.link && host(r.link) && !excl.some(d => host(r.link).endsWith(d)) && (!own || !host(r.link).endsWith(own)))
  .slice(0, 8).map((r, i) => ({ id: 'E' + (i + 1), title: r.title, url: r.link, domain: host(r.link), snippet: String(r.snippet || '').slice(0, 160) }));

// Ekstrak bagian H2 dan ringkasan untuk pemilihan gambar kontekstual (PRD F6b §3.3)
const h2Sections = [];
const lines = String(A.bodyMarkdown || '').split('\n');
let curH2 = null;
let curText = [];

for (const line of lines) {
  const h2Match = line.match(/^##\s+(.+)$/);
  if (h2Match) {
    if (curH2) {
      const summary = curText.join(' ').replace(/[\r\n]+/g, ' ').trim().slice(0, 300);
      h2Sections.push({ index: h2Sections.length + 1, title: curH2, summary });
    }
    curH2 = h2Match[1].trim();
    curText = [];
  } else if (curH2 && line.trim() && !line.startsWith('#')) {
    if (curText.length < 3) curText.push(line.trim());
  }
}
if (curH2) {
  const summary = curText.join(' ').replace(/[\r\n]+/g, ' ').trim().slice(0, 300);
  h2Sections.push({ index: h2Sections.length + 1, title: curH2, summary });
}

const wantImages = O.imageMode === 'none' ? 0 : (O.imageCount !== undefined ? Number(O.imageCount) : (O.imagePrompts ? 3 : 0));
const heroActive = wantImages > 0 && O.imageHero !== false;
const inlineCount = heroActive ? Math.max(0, wantImages - 1) : wantImages;
const body = String(A.bodyMarkdown || '').slice(0, 14000);
const lang = (D.ln || 'id') === 'id' ? 'Bahasa Indonesia' : D.ln;

const prompt = `Kamu editor SEO. Diberikan ARTIKEL (markdown) dan daftar kandidat tautan. Kembalikan HANYA JSON valid dengan bentuk:
{"internal":[{"anchor":"","url":"","title":""}],"external":[{"anchor":"","url":"","domain":""}],"imagePrompts":[{"idx":0,"placement":"hero","sectionTitle":"","prompt":"","alt":""}]}

ATURAN TAUTAN
- "anchor" HARUS potongan teks yang muncul PERSIS (huruf sama) di paragraf isi artikel — bukan di judul/heading, bukan di dalam teks yang sudah menjadi link [..](..), 2–6 kata, alami, relevan dengan halaman tujuan.
- internal: maksimal ${O.maxInternal} tautan, pilih hanya kandidat yang benar-benar relevan secara topik; url & title disalin persis dari kandidat. Satu url hanya sekali. Bila tidak ada yang relevan, kembalikan [].
- external: maksimal ${O.maxExternal} tautan ke sumber kredibel (lembaga resmi, media besar, riset); url disalin persis dari kandidat; jangan ke kompetitor langsung brand "${D.clientName}". Bila tidak ada yang layak, [].
- Jangan mengubah artikel; hanya kembalikan daftar.

ATURAN GAMBAR (buat tepat ${wantImages} item; bila ${wantImages} = 0 kembalikan [])
${heroActive ? '- Item pertama (idx 0): placement "hero", sectionTitle "Hero" (gambar utama 16:9, mewakili keseluruhan topik artikel).' : ''}
${inlineCount > 0 ? `- Pilih ${inlineCount} bagian H2 paling layak diilustrasikan dari DAFTAR BAGIAN H2 di bawah:
  * placement HARUS berbentuk "h2:<index>" (contoh: "h2:1", "h2:3") sesuai nomor index H2 terpilih, serta tuliskan "sectionTitle"-nya.
  * Maksimal 1 gambar per H2.
  * Prioritaskan bagian yang berisi proses, langkah, perbandingan, atau objek konkret.
  * HINDARI bagian FAQ dan kesimpulan.
  * Sebar merata di sepanjang artikel dan jangan berurutan kecuali artikel pendek.` : ''}
- "prompt" dalam bahasa Inggris untuk model text-to-image AI, deskriptif & konkret DITULIS DARI ISI BAGIAN ITU (bukan dari judul artikel), gaya: ${O.imageStyle}. Tanpa teks, logo, watermark, atau wajah tokoh nyata. Sesuaikan konteks Indonesia bila relevan.
- "alt" dalam ${lang}, 6–14 kata, deskriptif sesuai ilustrasi bagian tersebut, mengandung kata kunci bila alami.

ARTIKEL
Judul: ${A.title}
Keyword utama: ${A.primaryKeyword || D.keyword}
---
${body}
---

DAFTAR BAGIAN H2 (UNTUK PEMILIHAN GAMBAR KONTEKSTUAL)
${h2Sections.length ? h2Sections.map(s => `[h2:${s.index}] ${s.title} — Ringkasan: ${s.summary}`).join('\n') : '(artikel tidak memiliki sub-bab H2)'}

KANDIDAT INTERNAL (artikel lama di situs yang sama)
${internal.length ? internal.map(i => `${i.id} | ${i.title} | ${i.url}`).join('\n') : '(tidak ada)'}

KANDIDAT EKSTERNAL (hasil pencarian Google)
${external.length ? external.map(e => `${e.id} | ${e.domain} | ${e.title} | ${e.url} | ${e.snippet}`).join('\n') : '(tidak ada)'}`;

return [{ json: {
  skip: !internal.length && !external.length && !wantImages,
  prompt,
  internalCandidates: internal,
  externalCandidates: external,
  wantImages,
  geminiBody: {
    contents: [{ parts: [{ text: prompt }] }],
    generationConfig: {
      responseMimeType: 'application/json',
      temperature: 0.2,
      maxOutputTokens: 8192,
      thinkingConfig: { thinkingBudget: 0 }
    }
  },
} }];
