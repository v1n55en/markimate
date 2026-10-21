// Build n8n workflow JSON (Supermat API) dari sumber di ./src
// node automation/build-workflows.mjs  -> menulis n8n-main-workflow.json, n8n-adapter-wordpress.json, n8n-adapter-wix.json, n8n-adapter-sanity.json
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const src = f => fs.readFileSync(path.join(here, 'src', f), 'utf8');
const MD = src('md.js');
const CMS = src('cms.js');
const code = (f) => src(f).replace('__MD__', () => MD).replace('__CMS__', () => CMS);

// ---- ID workflow di n8n 3Our (dipakai node Execute Workflow) ----
export const IDS = {
  main: '9cXOiWyr2L2qdWrv',
  wordpress: 'XokXcBPuDOlIexss',
  wix: '54QOd6HkD0duCqGq',
  sanity: 'yRYqxg0wtw0Q0C9t',
  shopify: 'mPOJqWf1KKYoK1Bp',
};
// ---- Kredensial milik 3Our di n8n (API SerpAPI, RapidAPI, Gemini) ----
const CRED = {
  supermatKey: { httpHeaderAuth: { id: 'yRMoELEk1ya3tXjx', name: 'Supermat API Key (Header)' } },
  serpapi: { httpQueryAuth: { id: 'E7NNgmviGDIm3aE3', name: 'SerpAPI (Query Auth)' } },
  rapidapi: { httpHeaderAuth: { id: 'DHz0caqWkCEuxqry', name: 'Rapidapi' } },
  gemini: { googlePalmApi: { id: 'X4qY80NDFbDxQZZU', name: 'Google Gemini(PaLM) Api Veri' } },
  geminiImage: { httpHeaderAuth: { id: 'JF8Od16ebyhu0BUU', name: 'Gemini imagen' } },
};

const sticky = (name, pos, w, h, color, content) => ({ id: 'st-' + name.replace(/\W+/g, '-').toLowerCase(), name, type: 'n8n-nodes-base.stickyNote', typeVersion: 1, position: pos, parameters: { width: w, height: h, color, content } });
const codeNode = (name, pos, js, extra = {}) => ({ id: 'n-' + name.replace(/\W+/g, '-').toLowerCase(), name, type: 'n8n-nodes-base.code', typeVersion: 2, position: pos, parameters: { jsCode: js }, ...extra });
const ifBool = (name, pos, expr) => ({ id: 'n-' + name.replace(/\W+/g, '-').toLowerCase(), name, type: 'n8n-nodes-base.if', typeVersion: 2.2, position: pos, parameters: { conditions: { options: { caseSensitive: true, leftValue: '', typeValidation: 'loose', version: 2 }, conditions: [{ id: 'c1', leftValue: expr, rightValue: true, operator: { type: 'boolean', operation: 'true', singleValue: true } }], combinator: 'and' }, options: {} } });
const respond = (name, pos, body, codeExpr) => ({ id: 'n-' + name.replace(/\W+/g, '-').toLowerCase(), name, type: 'n8n-nodes-base.respondToWebhook', typeVersion: 1.1, position: pos, parameters: { respondWith: 'json', responseBody: body, options: codeExpr !== undefined ? { responseCode: isNaN(Number(codeExpr)) ? codeExpr : Number(codeExpr) } : {} } });
const respondFirst = (name, pos, codeExpr) => ({ id: 'n-' + name.replace(/\W+/g, '-').toLowerCase(), name, type: 'n8n-nodes-base.respondToWebhook', typeVersion: 1.1, position: pos, parameters: { respondWith: 'firstIncomingItem', options: codeExpr ? { responseCode: codeExpr } : {} } });
const httpNode = (name, pos, params, extra = {}) => ({ id: 'n-' + name.replace(/\W+/g, '-').toLowerCase(), name, type: 'n8n-nodes-base.httpRequest', typeVersion: 4.2, position: pos, onError: 'continueRegularOutput', parameters: params, ...extra });
const conn = (pairs) => { const c = {}; for (const [from, to, out = 0] of pairs) { c[from] = c[from] || { main: [] }; while (c[from].main.length <= out) c[from].main.push([]); c[from].main[out].push({ node: to, type: 'main', index: 0 }); } return c; };

const ERR_BODY = "={{ JSON.stringify({ status: 'error', message: $json.error, requestId: $json.requestId || null }) }}";
const ERR_CODE = '={{ $json.statusCode || 400 }}';

// =====================================================================
// MAIN: Supermat API — Generate & Publish
// =====================================================================
function buildMain() {
  const Y1 = 300, Y2 = 900, Y3 = 1800;
  const nodes = [
    sticky('Sticky Overview', [-1120, 60], 560, 1420, 7, `## 🚀 3Our Supermat API (SEO Article Automation)
Backend untuk web app **Supermat** (supermat-three.vercel.app). Semua kunci riset & AI (SerpAPI, RapidAPI/Ahrefs, Gemini) milik 3Our dan tersimpan sebagai credential n8n — user cukup pakai **API key 3Our** (header \`X-Supermat-Key\`) + kredensial CMS mereka sendiri.

**Endpoint**
- \`POST /webhook/supermat-trigger\` — riset + tulis artikel. Body: \`{ keyword, Geo, Ln, Client_Name, niche?, tone?, wordCount? }\` → \`{ status, article:{title, slug, excerpt, bodyMarkdown, keywords, primaryKeyword, searchVolume, difficulty, …}, research }\`
- \`POST /webhook/supermat-publish\` — kirim artikel ke CMS user. Body: \`{ cmsType:'wordpress'|'wix'|'sanity'|'shopify', action:'draft'|'publish', cms:{ wordpress:{url,user,appPassword} | wix:{siteId,apiKey} | sanity:{projectId,dataset,token,…} | shopify:{shop,accessToken|clientId+clientSecret,blogId?} }, article, postId? }\` → \`{ status, postId, draftEditUrl, publicUrl, message }\`

**API key** divalidasi node Webhook (Header Auth, credential *Supermat API Key (Header)*). Backend Supermat menyimpan key yang sama di env Vercel \`SUPERMAT_API_KEY\`.

**Error** selalu dibalas JSON \`{ status:'error', message }\` dengan HTTP code yang sesuai (401/400/502).

**Fase 6 (Markimate)**: generate menerima \`cmsType, cms, options\` → cek duplikat (409 \`status:'duplicate'\`), internal/external link (Gemini), \`imagePrompts\`; publish menerima \`options.images\` → gambar Nano Banana di-upload adapter (Sanity, WordPress); endpoint baru \`/webhook/supermat-topics\`. Kontrak lengkap: PRD Fase 6.`),
    sticky('Sticky Generate', [-520, -120], 3900, 740, 6, `## ① GENERATE — riset keyword → artikel (Gemini)
**Auth & Normalize** cek API key + rapikan input → **Riset Google Trends** (SerpAPI, related queries 3 bulan, geo/bahasa user) → **Riset Autocomplete** (SerpAPI Google Autocomplete, cadangan bila Trends kosong) → **Pilih Kandidat** (seed keyword + maks 3 query relevan) → **Riset SVolume** (Ahrefs via RapidAPI, per kandidat) → **Tentukan Target** (volume terbesar; fallback seed) → **AI Agent** (Gemini + tool Google Search SerpAPI untuk fakta, geo/bahasa mengikuti user, CTA ke brand user) → **Susun Artikel** → **Respond Generate**. Semua call eksternal *continue on error* supaya artikel tetap jadi walau riset gagal.`),
    sticky('Sticky Publish', [-520, 700], 2600, 800, 4, `## ② PUBLISH — kirim artikel ke CMS user
**Auth & Normalize (Publish)** validasi key, cmsType, kredensial CMS & artikel → **CMS Router** → adapter sub-workflow (**WordPress**, **Wix**, **Sanity**, **Shopify Blog**) → **Respond Publish**. Adapter mengembalikan format standar \`{ status, postId, draftEditUrl, publicUrl, postStatus, message }\`. \`action:'draft'\` menyimpan draf; \`action:'publish'\` menerbitkan (kirim \`postId\` untuk menerbitkan draf yang sudah ada).`),

    // ---- generate path ----
    { id: 'n-webhook-generate', name: 'Webhook Generate', type: 'n8n-nodes-base.webhook', typeVersion: 2, position: [-460, Y1], webhookId: '4443f0f9-062a-45ed-891f-47479690bf5b', parameters: { httpMethod: 'POST', path: 'supermat-trigger', authentication: 'headerAuth', responseMode: 'responseNode', options: {} }, credentials: CRED.supermatKey },
    codeNode('Auth & Normalize', [-240, Y1], code('main-auth-generate.js')),
    ifBool('Auth OK?', [-20, Y1], '={{ $json.ok }}'),
    respond('Respond Error', [200, Y1 + 200], ERR_BODY, ERR_CODE),
    ifBool('Ada CallbackUrl?', [80, Y1 - 80], '={{ !!($json.callbackUrl || $("Auth & Normalize").first().json.callbackUrl) }}'),
    respond('Respond Accepted', [280, Y1 - 80], "={{ JSON.stringify({ status: 'accepted', accepted: true, requestId: $json.requestId }) }}", 202),
    codeNode('Cek Duplikat', [200, Y1 - 160], code('main-cek-duplikat.js')),
    ifBool('Duplikat?', [420, Y1 - 160], '={{ $json.duplicate }}'),
    respond('Respond Duplicate', [640, Y1 - 320], "={{ JSON.stringify({ status: 'duplicate', message: $json.error, duplicateOf: $json.duplicateOf, existingPostsChecked: $json.existingPostsChecked, requestId: $json.requestId }) }}", 409),
    httpNode('Kirim Callback Duplicate', [860, Y1 - 320], { method: 'POST', url: "={{ $json.callbackUrl || $('Auth & Normalize').first().json.callbackUrl }}", authentication: 'genericCredentialType', genericAuthType: 'httpHeaderAuth', sendBody: true, specifyBody: 'json', jsonBody: "={{ JSON.stringify({ status: 'duplicate', duplicate: true, requestId: $json.requestId || $('Auth & Normalize').first().json.requestId, duplicateOf: $json.duplicateOf, message: $json.error }) }}", options: { timeout: 30000 } }, { credentials: CRED.supermatKey }),
    { id: 'n-riset-trends', name: 'Riset Google Trends', type: 'n8n-nodes-base.httpRequest', typeVersion: 4.2, position: [200, Y1], credentials: CRED.serpapi, onError: 'continueRegularOutput', parameters: { url: 'https://serpapi.com/search.json', authentication: 'genericCredentialType', genericAuthType: 'httpQueryAuth', sendQuery: true, queryParameters: { parameters: [
      { name: 'engine', value: 'google_trends' }, { name: 'q', value: '={{ $json.keyword }}' }, { name: 'geo', value: '={{ $json.geo }}' }, { name: 'hl', value: '={{ $json.ln }}' },
      { name: 'date', value: 'today 3-m' }, { name: 'data_type', value: 'RELATED_QUERIES' } ] }, options: { timeout: 30000 } } },
    ifBool('Trends Kosong?', [380, Y1], '={{ !($json.related_queries?.rising?.length || $json.related_queries?.top?.length) }}'),
    { id: 'n-riset-autocomplete', name: 'Riset Autocomplete', type: 'n8n-nodes-base.httpRequest', typeVersion: 4.2, position: [540, Y1 - 80], credentials: CRED.serpapi, onError: 'continueRegularOutput', parameters: { url: 'https://serpapi.com/search.json', authentication: 'genericCredentialType', genericAuthType: 'httpQueryAuth', sendQuery: true, queryParameters: { parameters: [
      { name: 'engine', value: 'google_autocomplete' }, { name: 'q', value: "={{ $('Auth & Normalize').first().json.keyword }}" }, { name: 'gl', value: "={{ $('Auth & Normalize').first().json.geo.toLowerCase() }}" }, { name: 'hl', value: "={{ $('Auth & Normalize').first().json.ln }}" } ] }, options: { timeout: 30000 } } },
    codeNode('Pilih Kandidat', [720, Y1], code('main-pilih-kandidat.js')),
    { id: 'n-riset-svolume', name: 'Riset SVolume', type: 'n8n-nodes-base.httpRequest', typeVersion: 4.2, position: [920, Y1], credentials: CRED.rapidapi, onError: 'continueRegularOutput', parameters: { url: 'https://ahrefs-keyword-research.p.rapidapi.com/keyword-metrics', authentication: 'genericCredentialType', genericAuthType: 'httpHeaderAuth', sendQuery: true, queryParameters: { parameters: [{ name: 'keyword', value: '={{ $json.query }}' }, { name: 'country', value: "={{ $('Auth & Normalize').first().json.geo.toLowerCase() }}" }] }, sendHeaders: true, headerParameters: { parameters: [{ name: 'x-rapidapi-host', value: 'ahrefs-keyword-research.p.rapidapi.com' }] }, options: { batching: { batch: { batchSize: 3, batchInterval: 0 } }, timeout: 8000 } } },
    codeNode('Tentukan Target', [1120, Y1], code('main-tentukan-target.js')),
    { id: 'n-ai-agent', name: 'AI Agent', type: '@n8n/n8n-nodes-langchain.agent', typeVersion: 3.1, position: [1340, Y1], parameters: { promptType: 'define', text: `=Tulis satu artikel blog SEO lengkap (struktur SILO) untuk keyword utama: {{ $json.targetKeyword }}.
Keyword asal yang diminta klien: {{ $json.keyword }}. Brand/klien: {{ $json.clientName }}{{ $json.niche ? ' (bidang: ' + $json.niche + ')' : '' }}.
Negara target: {{ $json.geo }} · Bahasa artikel: {{ $json.ln === 'id' ? 'Bahasa Indonesia' : $json.ln }}.{{ $json.tone ? ' ' + $json.tone + '.' : '' }}
Panjang WAJIB: minimal {{ $json.wordCount }} kata (hitung dengan cermat, jangan kurang), maksimal {{ Math.round($json.wordCount * 1.3) }} kata.{{ $json.wordCount >= 2000 ? ' Artikel ini merupakan PILLAR CONTENT mendalam: wajib menyertakan daftar isi (Table of Contents) di awal body dan minimal 6 sub-bab H2 yang terstruktur komprehensif.' : '' }}

Konteks riset (jangan ditulis mentah): search volume {{ $json.searchVolume }}, keyword difficulty {{ $json.difficulty ?? 'n/a' }}, traffic potential {{ $json.trafficPotential }}. Query terkait yang sedang naik: {{ ($json.relatedQueries || []).slice(0,5).join(', ') || '-' }}.

Ikuti seluruh aturan PERAN, TONE, STRUKTUR, dan SEO. Judul menarik, pembuka ber-hook, heading logis, penutup dengan soft CTA untuk brand {{ $json.clientName }}.

FORMAT OUTPUT (WAJIB): JSON dengan tepat 4 field: "title", "slug", "excerpt", "body" (markdown, tanpa judul di dalam body). Jangan tambahkan teks apa pun di luar JSON.`, options: { systemMessage: `=RISET DATA (WAJIB SEBELUM MENULIS)
Sebelum menulis, panggil tool "Google Search Riset" 1-3 kali untuk mengumpulkan fakta, data, statistik, dan informasi terkini tentang topik. Utamakan sumber kredibel (situs resmi, media ternama, lembaga riset, data statistik resmi). Dasarkan semua klaim faktual pada hasil riset; JANGAN mengarang angka, fitur, harga, atau klaim. Bila tidak ditemukan, tulis secara umum tanpa data palsu. Lokasi pencarian: {{ $json.geo }}, bahasa: {{ $json.ln }}.

PERAN
Kamu SEO content strategist dan copywriter profesional untuk brand "{{ $json.clientName }}". Tulis artikel blog yang SEO-friendly, terasa ditulis manusia, dan enak dibaca.

TARGET PEMBACA
Orang yang mencari topik "{{ $json.keyword }}" di {{ $json.geo === 'ID' ? 'Indonesia' : $json.geo }}. Mereka sibuk; konten ringkas, to-the-point, bisa dibaca ±5 menit.

TONE & GAYA
- Santai tapi profesional. Sapa pembaca dengan "kamu", posisikan brand sebagai "kami/kita".
- Bahasa natural sehari-hari sesuai bahasa artikel; istilah marketing umum (engagement, conversion, funnel, awareness) boleh tetap Inggris.
- Variasikan panjang kalimat; paragraf maksimal 2-4 kalimat. Konektor percakapan ("Jadi,", "Nah,", "Masalahnya,") secukupnya.
- Boleh analogi, contoh konkret, dan list bila membantu.

STRUKTUR
- Pembuka: hook yang menohok asumsi umum/masalah nyata pembaca, lalu posisikan topik sebagai solusi.
- Isi: beberapa sub-bagian dengan heading H2/H3 yang logis sesuai search intent.
- Penutup: rangkum 2-4 poin kunci, satu punchline, lalu soft CTA relevan ke brand "{{ $json.clientName }}" (bukan hard selling, jangan sebut pihak lain).

ATURAN SEO
- Keyword utama natural di judul, pembuka, dan beberapa heading — tanpa keyword stuffing. Gunakan sinonim/LSI.
- Pembuka langsung menjawab maksud pencarian.

HINDARI (agar tidak terdengar AI)
- Klise: "di era digital yang serba cepat ini", "tak dapat dipungkiri", "mari kita selami", "dalam dunia yang terus berkembang".
- Transisi kaku bertubi-tubi ("selain itu", "lebih lanjut", "dengan demikian").
- Pembuka berupa definisi kamus; kesimpulan yang mengulang kaku; nada over-promising.

FORMAT OUTPUT (WAJIB)
Kembalikan HANYA satu objek JSON valid: {"title": string, "slug": string, "excerpt": string, "body": string}
- Tanpa code fence, tanpa teks lain. Harus bisa di-parse JSON.parse().
- Semua field non-kosong. slug: huruf kecil, dipisah tanda hubung. body: markdown lengkap dengan heading ## dan ###, di-escape dengan benar.` } } },
    { id: 'n-gemini', name: 'Gemini Writer', type: '@n8n/n8n-nodes-langchain.lmChatGoogleGemini', typeVersion: 1, position: [1260, Y1 + 220], credentials: CRED.gemini, parameters: { modelName: 'models/gemini-3.1-flash-lite', options: { temperature: 0.7 } } },
    { id: 'n-search-tool', name: 'Google Search Riset', type: 'n8n-nodes-base.httpRequestTool', typeVersion: 4.3, position: [1460, Y1 + 220], credentials: CRED.serpapi, parameters: { toolDescription: 'Cari informasi faktual terkini dari Google tentang sebuah topik/keyword. Gunakan untuk mengumpulkan fakta, data, statistik, dan referensi nyata sebelum menulis artikel.', url: 'https://serpapi.com/search.json', authentication: 'genericCredentialType', genericAuthType: 'httpQueryAuth', sendQuery: true, queryParameters: { parameters: [
      { name: 'engine', value: 'google' },
      { name: 'q', value: "={{ /*n8n-auto-generated-fromAI-override*/ $fromAI('q', `Kata kunci atau pertanyaan pencarian Google untuk mengumpulkan fakta/data tentang topik artikel.`, 'string') }}" },
      { name: 'gl', value: "={{ $('Tentukan Target').first().json.geoLower }}" }, { name: 'hl', value: "={{ $('Tentukan Target').first().json.ln }}" }, { name: 'num', value: '8' } ] }, options: {}, optimizeResponse: true, dataField: 'organic_results' } },
    codeNode('Susun Artikel', [1680, Y1], code('main-susun-artikel.js')),
    ifBool('Artikel OK?', [1900, Y1], '={{ $json.ok }}'),
    ifBool('Perlu Link/Gambar?', [2120, Y1], "={{ $('Cek Duplikat').first().json.needEnrich }}"),
    httpNode('Cari Sumber Eksternal', [2340, Y1 - 160], { url: 'https://serpapi.com/search.json', authentication: 'genericCredentialType', genericAuthType: 'httpQueryAuth', sendQuery: true, queryParameters: { parameters: [
      { name: 'engine', value: 'google' }, { name: 'q', value: "={{ $('Susun Artikel').first().json.article.primaryKeyword || $('Cek Duplikat').first().json.keyword }}" }, { name: 'gl', value: "={{ $('Cek Duplikat').first().json.geo.toLowerCase() }}" }, { name: 'hl', value: "={{ $('Cek Duplikat').first().json.ln }}" }, { name: 'num', value: '10' } ] }, options: { timeout: 10000 } }, { credentials: CRED.serpapi }),
    codeNode('Siapkan Prompt Link', [2560, Y1 - 160], code('main-siapkan-prompt-link.js')),
    httpNode('Gemini Link & Gambar', [2780, Y1 - 160], { method: 'POST', url: 'https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent', authentication: 'predefinedCredentialType', nodeCredentialType: 'googlePalmApi', sendBody: true, specifyBody: 'json', jsonBody: '={{ JSON.stringify($json.geminiBody) }}', options: { timeout: 120000 } }, { credentials: CRED.gemini }),
    codeNode('Terapkan Link & Gambar', [3000, Y1 - 160], code('main-terapkan-link.js')),
    ifBool('Ada Callback Selesai?', [3220, Y1], '={{ !!($json.callbackUrl || $("Auth & Normalize").first().json.callbackUrl) }}'),
    httpNode('Kirim Callback', [3440, Y1], { method: 'POST', url: "={{ $json.callbackUrl || $('Auth & Normalize').first().json.callbackUrl }}", authentication: 'genericCredentialType', genericAuthType: 'httpHeaderAuth', sendBody: true, specifyBody: 'json', jsonBody: "={{ JSON.stringify({ status: 'ok', requestId: $json.requestId || $('Auth & Normalize').first().json.requestId, article: $json.article, usage: $json.usage || null, research: $json.research || null }) }}", options: { timeout: 30000 } }, { credentials: CRED.supermatKey }),
    respondFirst('Respond Generate', [3440, Y1 + 160]),
    respond('Respond AI Error', [2120, Y1 + 200], ERR_BODY, ERR_CODE),
    httpNode('Kirim Callback Error', [2340, Y1 + 200], { method: 'POST', url: "={{ $json.callbackUrl || $('Auth & Normalize').first().json.callbackUrl }}", authentication: 'genericCredentialType', genericAuthType: 'httpHeaderAuth', sendBody: true, specifyBody: 'json', jsonBody: "={{ JSON.stringify({ status: 'error', error: $json.error || $json.message || 'AI generation failed', requestId: $json.requestId || $('Auth & Normalize').first().json.requestId }) }}", options: { timeout: 30000 } }, { credentials: CRED.supermatKey }),

    // ---- publish path ----
    { id: 'n-webhook-publish', name: 'Webhook Publish', type: 'n8n-nodes-base.webhook', typeVersion: 2, position: [-460, Y2], webhookId: '12f6c704-5949-4562-b019-0697ff10a265', parameters: { httpMethod: 'POST', path: 'supermat-publish', authentication: 'headerAuth', responseMode: 'responseNode', options: {} }, credentials: CRED.supermatKey },
    codeNode('Auth & Normalize (Publish)', [-240, Y2], code('main-auth-publish.js')),
    ifBool('Auth OK (Publish)?', [-20, Y2], '={{ $json.ok }}'),
    respond('Respond Error (Publish)', [200, Y2 + 200], ERR_BODY, ERR_CODE),
    ifBool('Buat Gambar?', [200, Y2 - 160], '={{ $json.makeImages }}'),
    codeNode('Siapkan Prompt Gambar', [420, Y2 - 320], code('main-siapkan-gambar.js')),
    httpNode('Nano Banana', [640, Y2 - 320], { method: 'POST', url: 'https://generativelanguage.googleapis.com/v1beta/models/gemini-3.1-flash-lite-image:generateContent', authentication: 'genericCredentialType', genericAuthType: 'httpHeaderAuth', sendBody: true, specifyBody: 'json',
      jsonBody: '={{ JSON.stringify({ contents: [{ parts: [{ text: $json.prompt }] }], generationConfig: { responseModalities: ["IMAGE"], imageConfig: { aspectRatio: $json.aspect, imageSize: "1K" } } }) }}', options: { batching: { batch: { batchSize: 1, batchInterval: 6000 } }, response: { response: { responseFormat: 'json' } }, timeout: 120000 } }, { credentials: CRED.geminiImage }),
    codeNode('Kumpulkan Gambar', [860, Y2 - 320], code('main-kumpulkan-gambar.js')),
    { id: 'n-cms-router', name: 'CMS Router', type: 'n8n-nodes-base.switch', typeVersion: 3.2, position: [1080, Y2], parameters: { rules: { values: [
      { conditions: { options: { caseSensitive: true, leftValue: '', typeValidation: 'strict', version: 2 }, conditions: [{ id: 'r1', leftValue: '={{ $json.cmsType }}', rightValue: 'wordpress', operator: { type: 'string', operation: 'equals' } }], combinator: 'and' }, renameOutput: true, outputKey: 'wordpress' },
      { conditions: { options: { caseSensitive: true, leftValue: '', typeValidation: 'strict', version: 2 }, conditions: [{ id: 'r2', leftValue: '={{ $json.cmsType }}', rightValue: 'wix', operator: { type: 'string', operation: 'equals' } }], combinator: 'and' }, renameOutput: true, outputKey: 'wix' },
      { conditions: { options: { caseSensitive: true, leftValue: '', typeValidation: 'strict', version: 2 }, conditions: [{ id: 'r3', leftValue: '={{ $json.cmsType }}', rightValue: 'sanity', operator: { type: 'string', operation: 'equals' } }], combinator: 'and' }, renameOutput: true, outputKey: 'sanity' },
      { conditions: { options: { caseSensitive: true, leftValue: '', typeValidation: 'strict', version: 2 }, conditions: [{ id: 'r4', leftValue: '={{ $json.cmsType }}', rightValue: 'shopify', operator: { type: 'string', operation: 'equals' } }], combinator: 'and' }, renameOutput: true, outputKey: 'shopify' },
    ] }, options: { fallbackOutput: 'extra' } } },
    { id: 'n-adapter-wp', name: 'Adapter: WordPress', type: 'n8n-nodes-base.executeWorkflow', typeVersion: 1, position: [1360, Y2 - 160], parameters: { workflowId: IDS.wordpress, options: {} } },
    { id: 'n-adapter-wix', name: 'Adapter: Wix', type: 'n8n-nodes-base.executeWorkflow', typeVersion: 1, position: [1360, Y2], parameters: { workflowId: IDS.wix, options: {} } },
    { id: 'n-adapter-sanity', name: 'Adapter: Sanity', type: 'n8n-nodes-base.executeWorkflow', typeVersion: 1, position: [1360, Y2 + 160], parameters: { workflowId: IDS.sanity, options: {} } },
    { id: 'n-adapter-shopify', name: 'Adapter: Shopify', type: 'n8n-nodes-base.executeWorkflow', typeVersion: 1, position: [1360, Y2 + 320], parameters: { workflowId: IDS.shopify, options: {} } },
    respond('Respond CMS Tidak Didukung', [1360, Y2 + 480], "={{ JSON.stringify({ status: 'error', message: 'cmsType tidak didukung: ' + $json.cmsType }) }}", '400'),
    codeNode('Rapikan Hasil Publish', [1620, Y2], `// Samakan format hasil adapter + tentukan HTTP code
const r = $input.first().json || {};
const ok = r.status === 'ok' || r.status === 'success';
return [{ json: {
  status: ok ? 'ok' : 'error',
  statusCode: ok ? 200 : (r.httpStatus && r.httpStatus >= 400 && r.httpStatus < 500 ? 400 : 502),
  cmsType: r.cmsType || $('Auth & Normalize (Publish)').first().json.cmsType,
  action: r.action || $('Auth & Normalize (Publish)').first().json.action,
  postId: r.postId || r.draftDocId || '',
  postStatus: r.postStatus || (ok ? ($('Auth & Normalize (Publish)').first().json.action === 'publish' ? 'publish' : 'draft') : ''),
  draftEditUrl: r.draftEditUrl || '',
  publicUrl: r.publicUrl || '',
  previewUrl: r.previewUrl || '',
  title: r.title || '',
  message: r.message || (ok ? 'Berhasil.' : 'Gagal mengirim ke CMS.'),
  images: Array.isArray(r.images) ? r.images : [],
  warnings: [...new Set([...($('Auth & Normalize (Publish)').first().json.warnings || []), ...(Array.isArray(r.warnings) ? r.warnings : [])])],
  requestId: r.requestId || $('Auth & Normalize (Publish)').first().json.requestId,
} }];`),
    respondFirst('Respond Publish', [1840, Y2], '={{ $json.statusCode }}'),

    // ---- topics path (Fase 6) ----
    sticky('Sticky Topics', [-520, 1560], 2980, 520, 5, `## ③ TOPIK OTOMATIS — Google Trends → kandidat → volume → topik siap tulis
\`POST /webhook/supermat-topics\` body \`{ seedKeywords:[…], Geo, Ln, cmsType?, cms?, limit?, minVolume?, duplicateThreshold?, options:{siteBaseUrl?} }\`.
**Seeds & Artikel CMS** ambil artikel lama (dedupe) + 1 item per seed → **Riset Trends (Topics)** (SerpAPI related queries, rising + top) → **Kumpulkan Kandidat** (cocok seed, bukan duplikat artikel lama/antar kandidat) → **Riset SVolume (Topics)** (Ahrefs via RapidAPI) → **Susun Topik** (≥ minVolume, rising dulu, maks limit) → \`{ status, topics:[{keyword, seed, source, searchVolume, difficulty, trafficPotential}], skipped }\`. Jadwal mingguan & pembuatan keyword dilakukan backend Markimate (cron).`),
    { id: 'n-webhook-topics', name: 'Webhook Topics', type: 'n8n-nodes-base.webhook', typeVersion: 2, position: [-460, Y3], webhookId: '7c1d2e3f-4a5b-4c6d-8e9f-0a1b2c3d4e5f', parameters: { httpMethod: 'POST', path: 'supermat-topics', authentication: 'headerAuth', responseMode: 'responseNode', options: {} }, credentials: CRED.supermatKey },
    codeNode('Auth & Normalize (Topics)', [-240, Y3], code('main-auth-topics.js')),
    ifBool('Auth OK (Topics)?', [-20, Y3], '={{ $json.ok }}'),
    respond('Respond Error (Topics)', [200, Y3 + 200], ERR_BODY, ERR_CODE),
    codeNode('Seeds & Artikel CMS', [200, Y3], code('main-topik-seeds.js')),
    httpNode('Riset Trends (Topics)', [420, Y3], { url: 'https://serpapi.com/search.json', authentication: 'genericCredentialType', genericAuthType: 'httpQueryAuth', sendQuery: true, queryParameters: { parameters: [
      { name: 'engine', value: 'google_trends' }, { name: 'q', value: '={{ $json.seed }}' }, { name: 'geo', value: '={{ $json.geo }}' }, { name: 'hl', value: '={{ $json.ln }}' }, { name: 'date', value: 'today 3-m' }, { name: 'data_type', value: 'RELATED_QUERIES' } ] }, options: { batching: { batch: { batchSize: 1, batchInterval: 1000 } }, timeout: 30000 } }, { credentials: CRED.serpapi }),
    codeNode('Kumpulkan Kandidat', [640, Y3], code('main-topik-kandidat.js')),
    httpNode('Riset SVolume (Topics)', [860, Y3], { url: 'https://ahrefs-keyword-research.p.rapidapi.com/keyword-metrics', authentication: 'genericCredentialType', genericAuthType: 'httpHeaderAuth', sendQuery: true, queryParameters: { parameters: [{ name: 'keyword', value: '={{ $json.query }}' }, { name: 'country', value: '={{ $json.geoLower }}' }] }, sendHeaders: true, headerParameters: { parameters: [{ name: 'x-rapidapi-host', value: 'ahrefs-keyword-research.p.rapidapi.com' }] }, options: { batching: { batch: { batchSize: 1, batchInterval: 800 } }, timeout: 30000 } }, { credentials: CRED.rapidapi }),
    codeNode('Susun Topik', [1080, Y3], code('main-topik-susun.js')),
    respondFirst('Respond Topics', [1300, Y3]),
  ];
  const connections = {
    ...conn([
      ['Webhook Generate', 'Auth & Normalize'],
      ['Auth & Normalize', 'Auth OK?'],
      ['Auth OK?', 'Ada CallbackUrl?', 0],
      ['Auth OK?', 'Respond Error', 1],
      ['Ada CallbackUrl?', 'Respond Accepted', 0],
      ['Respond Accepted', 'Cek Duplikat'],
      ['Ada CallbackUrl?', 'Cek Duplikat', 1],
      ['Cek Duplikat', 'Duplikat?'],
      ['Duplikat?', 'Respond Duplicate', 0],
      ['Respond Duplicate', 'Kirim Callback Duplicate'],
      ['Duplikat?', 'Riset Google Trends', 1],
      ['Riset Google Trends', 'Trends Kosong?'],
      ['Trends Kosong?', 'Riset Autocomplete', 0],
      ['Trends Kosong?', 'Pilih Kandidat', 1],
      ['Riset Autocomplete', 'Pilih Kandidat'],
      ['Pilih Kandidat', 'Riset SVolume'],
      ['Riset SVolume', 'Tentukan Target'],
      ['Tentukan Target', 'AI Agent'],
      ['AI Agent', 'Susun Artikel'],
      ['Susun Artikel', 'Artikel OK?'],
      ['Artikel OK?', 'Perlu Link/Gambar?', 0],
      ['Artikel OK?', 'Respond AI Error', 1],
      ['Respond AI Error', 'Kirim Callback Error'],
      ['Perlu Link/Gambar?', 'Cari Sumber Eksternal', 0],
      ['Perlu Link/Gambar?', 'Ada Callback Selesai?', 1],
      ['Cari Sumber Eksternal', 'Siapkan Prompt Link'],
      ['Siapkan Prompt Link', 'Gemini Link & Gambar'],
      ['Gemini Link & Gambar', 'Terapkan Link & Gambar'],
      ['Terapkan Link & Gambar', 'Ada Callback Selesai?'],
      ['Ada Callback Selesai?', 'Kirim Callback', 0],
      ['Ada Callback Selesai?', 'Respond Generate', 1],
      ['Webhook Publish', 'Auth & Normalize (Publish)'], ['Auth & Normalize (Publish)', 'Auth OK (Publish)?'], ['Auth OK (Publish)?', 'Buat Gambar?', 0], ['Auth OK (Publish)?', 'Respond Error (Publish)', 1],
      ['Buat Gambar?', 'Siapkan Prompt Gambar', 0], ['Buat Gambar?', 'CMS Router', 1], ['Siapkan Prompt Gambar', 'Nano Banana'], ['Nano Banana', 'Kumpulkan Gambar'], ['Kumpulkan Gambar', 'CMS Router'],
      ['CMS Router', 'Adapter: WordPress', 0], ['CMS Router', 'Adapter: Wix', 1], ['CMS Router', 'Adapter: Sanity', 2], ['CMS Router', 'Adapter: Shopify', 3], ['CMS Router', 'Respond CMS Tidak Didukung', 4],
      ['Adapter: WordPress', 'Rapikan Hasil Publish'], ['Adapter: Wix', 'Rapikan Hasil Publish'], ['Adapter: Sanity', 'Rapikan Hasil Publish'], ['Adapter: Shopify', 'Rapikan Hasil Publish'], ['Rapikan Hasil Publish', 'Respond Publish'],
      ['Webhook Topics', 'Auth & Normalize (Topics)'], ['Auth & Normalize (Topics)', 'Auth OK (Topics)?'], ['Auth OK (Topics)?', 'Seeds & Artikel CMS', 0], ['Auth OK (Topics)?', 'Respond Error (Topics)', 1],
      ['Seeds & Artikel CMS', 'Riset Trends (Topics)'], ['Riset Trends (Topics)', 'Kumpulkan Kandidat'], ['Kumpulkan Kandidat', 'Riset SVolume (Topics)'], ['Riset SVolume (Topics)', 'Susun Topik'], ['Susun Topik', 'Respond Topics'],
    ]),
    'Gemini Writer': { ai_languageModel: [[{ node: 'AI Agent', type: 'ai_languageModel', index: 0 }]] },
    'Google Search Riset': { ai_tool: [[{ node: 'AI Agent', type: 'ai_tool', index: 0 }]] },
  };
  return { name: 'Supermat API: Generate & Publish (3Our)', nodes, connections, settings: { executionOrder: 'v1', binaryMode: 'separate' } };
}

// =====================================================================
// ADAPTER WORDPRESS
// =====================================================================
function buildWordPress() {
  const Y = 300;
  const nodes = [
    sticky('Sticky WP', [-560, 40], 1800, 460, 5, `## 🟦 Adapter WordPress (REST API, kredensial user)
Input dari Main: \`{ cms:{wordpress:{url,user,appPassword}}, article, action:'draft'|'publish', postId? }\`.
**Siapkan WP** membuat header \`Authorization: Basic base64(user:appPassword)\` (Application Password WP) dan mengubah markdown → HTML. Tanpa \`postId\` → \`POST /wp-json/wp/v2/posts\` (buat); dengan \`postId\` → \`POST /wp-json/wp/v2/posts/{id}\` (update/terbitkan). **Hasil WP** menerjemahkan respons/err jadi \`{ status, postId, draftEditUrl, publicUrl, previewUrl, postStatus, message }\`. Tidak ada kredensial 3Our yang dipakai di sini.
**Fase 6**: \`images[]\` dari Main → **Upload Media** (\`/wp-json/wp/v2/media\`) → **Susun Payload WP**: hero → \`featured_media\`, inline → \`<figure><img>\`; kategori/author default dari \`cms.wordpress.defaultCategoryIds/authorId\`.`),
    { id: 'n-wp-trigger', name: 'Trigger dari Main', type: 'n8n-nodes-base.executeWorkflowTrigger', typeVersion: 1, position: [-500, Y], parameters: {} },
    codeNode('Siapkan WP', [-280, Y], code('wp-siapkan.js')),
    ifBool('Ada Gambar WP?', [-60, Y], '={{ $json.hasImages }}'),
    codeNode('Pecah Gambar WP', [160, Y - 160], code('wp-pecah-gambar.js')),
    httpNode('WP: Upload Media', [380, Y - 160], { method: 'POST', url: '={{ $json.mediaUrl }}', sendHeaders: true, headerParameters: { parameters: [{ name: 'Authorization', value: '={{ $json.auth }}' }, { name: 'Content-Disposition', value: '={{ "attachment; filename=\"" + $json.filename + "\"" }}' }, { name: 'Content-Type', value: '={{ $json.mime }}' }, { name: 'User-Agent', value: 'Markimate/1.0 (+https://3ourasia.id)' }] }, sendBody: true, contentType: 'binaryData', inputDataFieldName: 'data', options: { batching: { batch: { batchSize: 1, batchInterval: 500 } }, response: { response: { fullResponse: true, neverError: true } }, timeout: 90000 } }),
    codeNode('Susun Payload WP', [600, Y], code('wp-susun-payload.js')),
    { id: 'n-wp-request', name: 'WP: Kirim Post', type: 'n8n-nodes-base.httpRequest', typeVersion: 4.2, position: [820, Y], onError: 'continueRegularOutput', parameters: { method: 'POST', url: '={{ $json.url }}', sendHeaders: true, headerParameters: { parameters: [{ name: 'Authorization', value: '={{ $json.auth }}' }, { name: 'Content-Type', value: 'application/json' }, { name: 'User-Agent', value: 'Supermat/1.0 (+https://3ourasia.id)' }] }, sendBody: true, specifyBody: 'json', jsonBody: '={{ JSON.stringify($json.payload) }}', options: { response: { response: { fullResponse: true, neverError: true } }, timeout: 45000, redirect: { redirect: {} } } } },
    codeNode('Hasil WP', [1040, Y], code('wp-hasil.js')),
  ];
  return { name: 'Supermat Adapter: WordPress', nodes, connections: conn([['Trigger dari Main', 'Siapkan WP'], ['Siapkan WP', 'Ada Gambar WP?'], ['Ada Gambar WP?', 'Pecah Gambar WP', 0], ['Ada Gambar WP?', 'Susun Payload WP', 1], ['Pecah Gambar WP', 'WP: Upload Media'], ['WP: Upload Media', 'Susun Payload WP'], ['Susun Payload WP', 'WP: Kirim Post'], ['WP: Kirim Post', 'Hasil WP']]), settings: { executionOrder: 'v1' } };
}

// =====================================================================
// ADAPTER WIX
// =====================================================================
function buildWix() {
  const Y = 400;
  const H = (name, pos, method, url, body) => ({ id: 'n-' + name.replace(/\W+/g, '-').toLowerCase(), name, type: 'n8n-nodes-base.httpRequest', typeVersion: 4.2, position: pos, onError: 'continueRegularOutput', parameters: Object.assign({ method, url, sendHeaders: true, headerParameters: { parameters: [
    { name: 'Authorization', value: "={{ $('Siapkan Wix').first().json.headers.Authorization }}" }, { name: 'wix-site-id', value: "={{ $('Siapkan Wix').first().json.headers['wix-site-id'] }}" }, { name: 'Content-Type', value: 'application/json' } ] }, options: { response: { response: { fullResponse: true, neverError: true } }, timeout: 45000 } }, body ? { sendBody: true, specifyBody: 'json', jsonBody: body } : {}) });
  const nodes = [
    sticky('Sticky Wix', [-560, 60], 2200, 700, 3, `## 🟪 Adapter Wix Blog (REST v3, kredensial user)
Input dari Main: \`{ cms:{wix:{siteId, apiKey, memberId?}}, article, action, postId? }\`. Header: \`Authorization: <API key akun Wix>\`, \`wix-site-id\`.
**Siapkan Wix** ubah markdown → Ricos rich content. **Cek Posts/Members** mencari \`memberId\` penulis (wajib di Wix: dari post terakhir, lalu Members API, atau diisi user). Tanpa \`postId\` → **Buat Draft** \`POST /blog/v3/draft-posts\` (\`publish:true\` bila action publish). Dengan \`postId\` → **Publish Draft** \`POST /blog/v3/draft-posts/{id}/publish\`. **Ambil URL** \`GET /blog/v3/posts/{id}?fieldsets=URL\` untuk link publik. **Hasil Wix** → format standar Supermat.
Catatan: API key dibuat di Wix Account → API Keys dengan izin *Blog* (+ *Members* opsional). Edit draf: \`manage.wix.com/dashboard/{siteId}/blog/{draftId}/edit\`.`),
    { id: 'n-wix-trigger', name: 'Trigger dari Main', type: 'n8n-nodes-base.executeWorkflowTrigger', typeVersion: 1, position: [-500, Y], parameters: {} },
    codeNode('Siapkan Wix', [-280, Y], code('wix-siapkan.js')),
    H('Wix: Cek Posts', [-60, Y], 'GET', 'https://www.wixapis.com/blog/v3/posts?paging.limit=1&fieldsets=URL'),
    H('Wix: Cek Members', [160, Y], 'GET', 'https://www.wixapis.com/members/v1/members?paging.limit=1'),
    codeNode('Tentukan Member', [380, Y], code('wix-tentukan-member.js')),
    ifBool('Member OK?', [600, Y], "={{ $json.status === 'prep' }}"),
    ifBool('Ada postId?', [820, Y - 80], '={{ !!$json.postId }}'),
    H('Wix: Publish Draft', [1040, Y - 200], 'POST', '={{ $json.publishUrl }}', '={{ JSON.stringify({}) }}'),
    H('Wix: Buat Draft', [1040, Y], 'POST', 'https://www.wixapis.com/blog/v3/draft-posts', '={{ JSON.stringify($json.createBody) }}'),
    H('Wix: Ambil URL', [1260, Y - 80], 'GET', "={{ 'https://www.wixapis.com/blog/v3/posts/' + (($json.body && ($json.body.postId || ($json.body.draftPost && $json.body.draftPost.id))) || $('Tentukan Member').first().json.postId) + '?fieldsets=URL' }}"),
    codeNode('Hasil Wix', [1480, Y], code('wix-hasil.js')),
  ];
  const connections = conn([
    ['Trigger dari Main', 'Siapkan Wix'], ['Siapkan Wix', 'Wix: Cek Posts'], ['Wix: Cek Posts', 'Wix: Cek Members'], ['Wix: Cek Members', 'Tentukan Member'],
    ['Tentukan Member', 'Member OK?'], ['Member OK?', 'Ada postId?', 0], ['Member OK?', 'Hasil Wix', 1],
    ['Ada postId?', 'Wix: Publish Draft', 0], ['Ada postId?', 'Wix: Buat Draft', 1],
    ['Wix: Publish Draft', 'Wix: Ambil URL'], ['Wix: Buat Draft', 'Wix: Ambil URL'], ['Wix: Ambil URL', 'Hasil Wix'],
  ]);
  return { name: 'Supermat Adapter: Wix Blog', nodes, connections, settings: { executionOrder: 'v1' } };
}


// =====================================================================
// ADAPTER SANITY
// =====================================================================
function buildSanity() {
  const Y = 300;
  const nodes = [
    sticky('Sticky Sanity', [-560, 40], 1800, 500, 2, `## 🟥 Adapter Sanity (HTTP API, token user)
Input dari Main: \`{ cms:{sanity:{projectId, dataset, token, studioUrl?, docType?='post', bodyField?='body', publicUrlPattern?}}, article, action, postId? }\`. Header: \`Authorization: Bearer <token Editor user>\`.
**Siapkan Sanity** ubah markdown → Portable Text lalu pilih request:
- \`draft\` → Mutations API \`createOrReplace drafts.<id>\`
- \`publish\` + artikel → \`createOrReplace <id>\` + hapus \`drafts.<id>\`
- \`publish\` tanpa artikel (postId draf lama) → Actions API \`sanity.action.document.publish\` (isi draf apa adanya, termasuk editan di Studio)
**Hasil Sanity** → format standar Supermat (link edit: \`<studioUrl>/intent/edit/id=<id>;type=<docType>\`). Field dokumen: title, slug, <excerptField>, <publishedAtField>, <bodyField>, author (ref), categories (ref[]), <mainImageField>.
**Fase 6**: bila Main mengirim \`images[]\` (base64 dari Nano Banana) → **Pecah Gambar** → **Upload Asset** (Assets API) → **Susun Mutasi** mengganti placeholder \`{_type:'image', _markimateIdx}\` di Portable Text dengan asset, hero → mainImage.`),
    { id: 'n-sanity-trigger', name: 'Trigger dari Main', type: 'n8n-nodes-base.executeWorkflowTrigger', typeVersion: 1, position: [-500, Y], parameters: {} },
    codeNode('Siapkan Sanity', [-280, Y], code('sanity-siapkan.js')),
    ifBool('Ada Gambar?', [-60, Y], '={{ $json.hasImages }}'),
    codeNode('Pecah Gambar', [160, Y - 160], code('sanity-pecah-gambar.js')),
    httpNode('Sanity: Upload Asset', [380, Y - 160], { method: 'POST', url: '={{ $json.uploadUrl }}', sendHeaders: true, headerParameters: { parameters: [{ name: 'Authorization', value: '={{ $json.auth }}' }, { name: 'Content-Type', value: '={{ $json.mime }}' }] }, sendBody: true, contentType: 'binaryData', inputDataFieldName: 'data', options: { batching: { batch: { batchSize: 1, batchInterval: 500 } }, response: { response: { fullResponse: true, neverError: true } }, timeout: 90000 } }),
    codeNode('Susun Mutasi', [600, Y], code('sanity-susun-mutasi.js')),
    { id: 'n-sanity-request', name: 'Sanity: Kirim', type: 'n8n-nodes-base.httpRequest', typeVersion: 4.2, position: [820, Y], onError: 'continueRegularOutput', parameters: { method: 'POST', url: '={{ $json.url }}', sendHeaders: true, headerParameters: { parameters: [{ name: 'Authorization', value: '={{ $json.auth }}' }, { name: 'Content-Type', value: 'application/json' }] }, sendBody: true, specifyBody: 'json', jsonBody: '={{ JSON.stringify($json.body) }}', options: { response: { response: { fullResponse: true, neverError: true } }, timeout: 45000 } } },
    codeNode('Hasil Sanity', [1040, Y], code('sanity-hasil.js')),
  ];
  return { name: 'Supermat Adapter: Sanity', nodes, connections: conn([['Trigger dari Main', 'Siapkan Sanity'], ['Siapkan Sanity', 'Ada Gambar?'], ['Ada Gambar?', 'Pecah Gambar', 0], ['Ada Gambar?', 'Susun Mutasi', 1], ['Pecah Gambar', 'Sanity: Upload Asset'], ['Sanity: Upload Asset', 'Susun Mutasi'], ['Susun Mutasi', 'Sanity: Kirim'], ['Sanity: Kirim', 'Hasil Sanity']]), settings: { executionOrder: 'v1' } };
}

// =====================================================================
// ADAPTER SHOPIFY BLOG
// =====================================================================
function buildShopify() {
  const Y = 360;
  const http = (name, pos, extra) => ({ id: 'n-' + name.replace(/\W+/g, '-').toLowerCase(), name, type: 'n8n-nodes-base.httpRequest', typeVersion: 4.2, position: pos, onError: 'continueRegularOutput', parameters: Object.assign({ method: 'POST', options: { response: { response: { fullResponse: true, neverError: true } }, timeout: 45000 } }, extra) });
  const gql = (name, pos, bodyExpr) => http(name, pos, { url: '={{ $json.gqlUrl }}', sendHeaders: true, headerParameters: { parameters: [{ name: 'X-Shopify-Access-Token', value: '={{ $json.token }}' }, { name: 'Content-Type', value: 'application/json' }] }, sendBody: true, specifyBody: 'json', jsonBody: bodyExpr });
  const nodes = [
    sticky('Sticky Shopify', [-600, 60], 2000, 560, 5, `## 🟩 Adapter Shopify Blog (GraphQL Admin API, kredensial user)
Input dari Main: \`{ cms:{shopify:{shop:'namatoko.myshopify.com', accessToken? | clientId+clientSecret, blogId?, authorName?}}, article, action, postId? }\`.
**Siapkan Shopify** validasi domain → bila pakai app Dev Dashboard (Client ID + Secret) **Ambil Token** \`POST /admin/oauth/access_token\` (client_credentials, token 24 jam) → **Shopify: Auth** → **Info Toko** (GraphQL: primary domain + daftar blog) → **Susun Artikel Shopify** (markdown → HTML; pilih blog; \`articleCreate\` atau \`articleUpdate\`) → **Kirim Artikel** → **Hasil Shopify**.
\`draft\` = artikel tersembunyi (\`isPublished:false\`), \`publish\` = tampil. Tanpa artikel + postId → terbitkan artikel yang ada. Scope app: \`write_content\` (+ \`read_content\`). Link edit: \`admin.shopify.com/store/<toko>/content/articles/<id>\`.`),
    { id: 'n-shop-trigger', name: 'Trigger dari Main', type: 'n8n-nodes-base.executeWorkflowTrigger', typeVersion: 1, position: [-540, Y], parameters: {} },
    codeNode('Siapkan Shopify', [-320, Y], code('shopify-siapkan.js')),
    ifBool('Perlu Tukar Token?', [-100, Y], '={{ $json.needsExchange }}'),
    http('Shopify: Ambil Token', [120, Y - 120], { url: "={{ 'https://' + $json.shop + '/admin/oauth/access_token' }}", sendBody: true, contentType: 'form-urlencoded', bodyParameters: { parameters: [{ name: 'grant_type', value: 'client_credentials' }, { name: 'client_id', value: '={{ $json.clientId }}' }, { name: 'client_secret', value: '={{ $json.clientSecret }}' }] } }),
    codeNode('Shopify: Auth', [340, Y], code('shopify-auth.js')),
    gql('Shopify: Info Toko', [560, Y], '={{ JSON.stringify({ query: "{ shop { name primaryDomain { url } } blogs(first: 20) { nodes { id handle title } } }" }) }}'),
    codeNode('Susun Artikel Shopify', [780, Y], code('shopify-susun.js')),
    gql('Shopify: Kirim Artikel', [1000, Y], '={{ JSON.stringify($json.body) }}'),
    codeNode('Hasil Shopify', [1220, Y], code('shopify-hasil.js')),
  ];
  return { name: 'Supermat Adapter: Shopify Blog', nodes, connections: conn([['Trigger dari Main', 'Siapkan Shopify'], ['Siapkan Shopify', 'Perlu Tukar Token?'], ['Perlu Tukar Token?', 'Shopify: Ambil Token', 0], ['Perlu Tukar Token?', 'Shopify: Auth', 1], ['Shopify: Ambil Token', 'Shopify: Auth'], ['Shopify: Auth', 'Shopify: Info Toko'], ['Shopify: Info Toko', 'Susun Artikel Shopify'], ['Susun Artikel Shopify', 'Shopify: Kirim Artikel'], ['Shopify: Kirim Artikel', 'Hasil Shopify']]), settings: { executionOrder: 'v1' } };
}

// =====================================================================
// WEBHOOK REGENERASI / PENAMBAHAN GAMBAR KONTEKSTUAL (PRD F6b §3.4 & §4.10)
// =====================================================================
// =====================================================================
// WEBHOOK REGENERASI / PENAMBAHAN GAMBAR KONTEKSTUAL (PRD F6b §3.4 & §4.10)
// =====================================================================
function buildImageWorkflow() {
  const Y = 360;
  const nodes = [
    sticky('Sticky Image', [-520, 100], 1900, 520, 3, `## 🎨 Webhook Regenerasi Gambar Kontekstual (\`/webhook/supermat-image\`)
Input: \`{ sectionTitle, sectionText, style, aspect, alt, requestId, keyword, Client_Name }\`.
1. **Siapkan Prompt Gemini** susun prompt perumusan deskripsi visual berbasis H2/section.
2. **Gemini Prompt Writer** rumuskan prompt bahasa Inggris deskriptif, konkret & fotorealistik.
3. **Siapkan Prompt Image** ekstrak prompt final untuk Imagen.
4. **Nano Banana Image** generate 1 gambar spesifik via Gemini Imagen (\`gemini-3.1-flash-lite-image:generateContent\`).
5. **Hasil Image** ambil base64; bila gagal kembalikan \`{ ok: false, status: 'error', message }\`.
6. **Image OK?** bila sukses balas HTTP 200, bila gagal balas HTTP 502.`),
    {
      id: 'n-webhook-image',
      name: 'Webhook Image',
      type: 'n8n-nodes-base.webhook',
      typeVersion: 2,
      position: [-460, Y],
      parameters: {
        httpMethod: 'POST',
        path: 'supermat-image',
        authentication: 'headerAuth',
        responseMode: 'responseNode',
        options: {}
      },
      credentials: CRED.supermatKey
    },
    codeNode('Siapkan Prompt Gemini', [-240, Y], code('image-regenerate-siapkan-prompt.js')),
    httpNode('Gemini Prompt Writer', [-20, Y], {
      method: 'POST',
      url: 'https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent',
      authentication: 'predefinedCredentialType',
      nodeCredentialType: 'googlePalmApi',
      sendBody: true,
      specifyBody: 'json',
      jsonBody: '={{ JSON.stringify($json.geminiBody) }}',
      options: { timeout: 45000 }
    }, { credentials: CRED.gemini }),
    codeNode('Siapkan Prompt Image', [200, Y], code('image-regenerate-siapkan.js')),
    httpNode('Nano Banana Image', [420, Y], {
      method: 'POST',
      url: 'https://generativelanguage.googleapis.com/v1beta/models/gemini-3.1-flash-lite-image:generateContent',
      authentication: 'genericCredentialType',
      genericAuthType: 'httpHeaderAuth',
      sendBody: true,
      specifyBody: 'json',
      jsonBody: '={{ JSON.stringify({ contents: [{ parts: [{ text: $json.prompt }] }], generationConfig: { responseModalities: ["IMAGE"], imageConfig: { aspectRatio: $json.aspect || "4:3", imageSize: "1K" } } }) }}',
      options: {
        response: { response: { responseFormat: 'json' } },
        timeout: 120000
      }
    }, { credentials: CRED.geminiImage }),
    codeNode('Hasil Image', [640, Y], code('image-regenerate-hasil.js')),
    ifBool('Image OK?', [860, Y], '={{ $json.ok }}'),
    respond('Respond Image', [1080, Y - 100], '={{ JSON.stringify($json) }}'),
    respond('Respond Error', [1080, Y + 100], '={{ JSON.stringify($json) }}', '502')
  ];

  return {
    name: 'Supermat Webhook: Regenerate Image',
    nodes,
    connections: conn([
      ['Webhook Image', 'Siapkan Prompt Gemini'],
      ['Siapkan Prompt Gemini', 'Gemini Prompt Writer'],
      ['Gemini Prompt Writer', 'Siapkan Prompt Image'],
      ['Siapkan Prompt Image', 'Nano Banana Image'],
      ['Nano Banana Image', 'Hasil Image'],
      ['Hasil Image', 'Image OK?'],
      ['Image OK?', 'Respond Image', 0],
      ['Image OK?', 'Respond Error', 1]
    ]),
    settings: { executionOrder: 'v1' }
  };
}

const out = {
  'n8n-main-workflow.json': buildMain(),
  'n8n-adapter-wordpress.json': buildWordPress(),
  'n8n-adapter-wix.json': buildWix(),
  'n8n-adapter-sanity.json': buildSanity(),
  'n8n-adapter-shopify.json': buildShopify(),
  'n8n-image-workflow.json': buildImageWorkflow()
};
for (const [f, w] of Object.entries(out)) {
  fs.writeFileSync(path.join(here, f), JSON.stringify(w, null, 2));
  console.log('wrote', f, w.nodes.length, 'nodes');
}
