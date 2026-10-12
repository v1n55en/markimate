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

// --- kandidat eksternal: organic results SerpAPI minus domain yang dikecualikan & domain brand sendiri ---
const excl = (O.excludeDomains || []).map(d => String(d).toLowerCase());
const own = (() => { try { return new URL(O.siteBaseUrl).hostname.replace(/^www\./, ''); } catch (e) { return ''; } })();
const host = u => { try { return new URL(u).hostname.replace(/^www\./, '').toLowerCase(); } catch (e) { return ''; } };
const external = (O.externalLinks ? (S.organic_results || []) : []).filter(r => r.link && host(r.link) && !excl.some(d => host(r.link).endsWith(d)) && (!own || !host(r.link).endsWith(own)))
  .slice(0, 8).map((r, i) => ({ id: 'E' + (i + 1), title: r.title, url: r.link, domain: host(r.link), snippet: String(r.snippet || '').slice(0, 160) }));

const wantImages = O.imagePrompts ? O.imageCount : 0;
const body = String(A.bodyMarkdown || '').slice(0, 14000);
const lang = (D.ln || 'id') === 'id' ? 'Bahasa Indonesia' : D.ln;

const prompt = `Kamu editor SEO. Diberikan ARTIKEL (markdown) dan daftar kandidat tautan. Kembalikan HANYA JSON valid dengan bentuk:
{"internal":[{"anchor":"","url":"","title":""}],"external":[{"anchor":"","url":"","domain":""}],"imagePrompts":[{"idx":0,"placement":"hero","prompt":"","alt":""}]}

ATURAN TAUTAN
- "anchor" HARUS potongan teks yang muncul PERSIS (huruf sama) di paragraf isi artikel — bukan di judul/heading, bukan di dalam teks yang sudah menjadi link [..](..), 2–6 kata, alami, relevan dengan halaman tujuan.
- internal: maksimal ${O.maxInternal} tautan, pilih hanya kandidat yang benar-benar relevan secara topik; url & title disalin persis dari kandidat. Satu url hanya sekali. Bila tidak ada yang relevan, kembalikan [].
- external: maksimal ${O.maxExternal} tautan ke sumber kredibel (lembaga resmi, media besar, riset); url disalin persis dari kandidat; jangan ke kompetitor langsung brand "${D.clientName}". Bila tidak ada yang layak, [].
- Jangan mengubah artikel; hanya kembalikan daftar.

ATURAN GAMBAR (buat tepat ${wantImages} item; bila ${wantImages} = 0 kembalikan [])
- idx 0 = "hero" (gambar utama 16:9, mewakili keseluruhan topik). idx 1 = "after_h2:1" (ilustrasi sub-bab pertama), idx 2 = "after_h2:3" (sub-bab ketiga; bila artikel punya kurang dari 3 H2 pakai "after_h2:2").
- "prompt" dalam bahasa Inggris untuk model text-to-image, deskriptif & konkret (subjek, setting, komposisi, mood), gaya: ${O.imageStyle}. Tanpa teks, logo, watermark, atau wajah tokoh nyata. Sesuaikan konteks Indonesia bila relevan.
- "alt" dalam ${lang}, 6–14 kata, deskriptif, mengandung kata kunci bila alami.

ARTIKEL
Judul: ${A.title}
Keyword utama: ${A.primaryKeyword || D.keyword}
---
${body}
---

KANDIDAT INTERNAL (artikel lama di situs yang sama)
${internal.length ? internal.map(i => `${i.id} | ${i.title} | ${i.url}`).join('\n') : '(tidak ada)'}

KANDIDAT EKSTERNAL (hasil pencarian Google)
${external.length ? external.map(e => `${e.id} | ${e.domain} | ${e.title} | ${e.url} | ${e.snippet}`).join('\n') : '(tidak ada)'}`;

return [{ json: {
  skip: !internal.length && !external.length && !wantImages,
  prompt, internalCandidates: internal, externalCandidates: external, wantImages,
  geminiBody: { contents: [{ parts: [{ text: prompt }] }], generationConfig: { responseMimeType: 'application/json', temperature: 0.2, maxOutputTokens: 2048 } },
} }];
