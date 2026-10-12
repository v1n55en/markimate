// ===== Helper CMS bersama (disisipkan oleh build-workflows.mjs) =====
// listExistingPosts(H, cmsType, cms, opts) -> [{ title, slug, url, publishedAt }]
// H = this.helpers (Code node). Semua error ditelan → [] supaya alur artikel tidak mati.
async function listExistingPosts(H, cmsType, cms, opts) {
  const o = Object.assign({ limit: 200, siteBaseUrl: '' }, opts || {});
  const base = String(o.siteBaseUrl || '').trim();
  const urlOf = (slug, direct) => direct || (base && slug ? base.replace(/\/+$/, '') + '/' + slug : '');
  const c = (cms || {})[cmsType] || {};
  try {
    if (cmsType === 'sanity') {
      const q = '*[_type == $t && defined(slug.current)] | order(coalesce(publishedAt, _createdAt) desc) [0...' + o.limit + ']{title, "slug": slug.current, publishedAt}';
      const r = await H.httpRequest({ method: 'POST', url: 'https://' + c.projectId + '.api.sanity.io/v2025-02-19/data/query/' + encodeURIComponent(c.dataset || 'production'),
        headers: Object.assign({ 'Content-Type': 'application/json' }, c.token ? { Authorization: 'Bearer ' + c.token } : {}), body: { query: q, params: { t: c.docType || 'post' } }, json: true });
      const pat = String(c.publicUrlPattern || '');
      return (r.result || []).filter(p => p.title).map(p => ({ title: p.title, slug: p.slug, url: urlOf(p.slug, pat && p.slug ? pat.replace('{slug}', p.slug) : ''), publishedAt: p.publishedAt || '' }));
    }
    if (cmsType === 'wordpress') {
      const auth = 'Basic ' + Buffer.from(String(c.user) + ':' + String(c.appPassword || '').replace(/\s+/g, '')).toString('base64');
      const out = [];
      for (let page = 1; page <= Math.ceil(o.limit / 100); page++) {
        const r = await H.httpRequest({ method: 'GET', url: c.url + '/wp-json/wp/v2/posts?status=publish&per_page=100&page=' + page + '&_fields=title,slug,link,date', headers: { Authorization: auth, 'User-Agent': 'Markimate/1.0' }, json: true });
        if (!Array.isArray(r) || !r.length) break;
        for (const p of r) out.push({ title: (p.title && p.title.rendered) || '', slug: p.slug, url: p.link || urlOf(p.slug), publishedAt: p.date || '' });
        if (r.length < 100) break;
      }
      return out;
    }
    if (cmsType === 'wix') {
      const r = await H.httpRequest({ method: 'GET', url: 'https://www.wixapis.com/blog/v3/posts?paging.limit=100&fieldsets=URL', headers: { Authorization: c.apiKey, 'wix-site-id': c.siteId }, json: true });
      return (r.posts || []).map(p => ({ title: p.title, slug: p.slug, url: p.url ? (p.url.base || '') + (p.url.path || '') : urlOf(p.slug), publishedAt: p.firstPublishedDate || '' }));
    }
    if (cmsType === 'shopify') {
      const r = await H.httpRequest({ method: 'POST', url: 'https://' + c.shop + '/admin/api/2026-07/graphql.json', headers: { 'X-Shopify-Access-Token': c.accessToken, 'Content-Type': 'application/json' },
        body: { query: '{ shop { primaryDomain { url } } articles(first: 100, sortKey: PUBLISHED_AT, reverse: true) { nodes { title handle publishedAt blog { handle } } } }' }, json: true });
      const d = (r.data || {}); const dom = ((d.shop || {}).primaryDomain || {}).url || ('https://' + c.shop);
      return ((d.articles || {}).nodes || []).map(a => ({ title: a.title, slug: a.handle, url: dom + '/blogs/' + ((a.blog || {}).handle || 'news') + '/' + a.handle, publishedAt: a.publishedAt || '' }));
    }
  } catch (e) { /* abaikan: tanpa daftar artikel */ }
  return [];
}

// --- kemiripan topik (token Jaccard-ish, dipakai cek duplikat & dedupe kandidat) ---
const STOPWORDS = new Set(['apa', 'itu', 'adalah', 'yang', 'dan', 'di', 'ke', 'dari', 'untuk', 'dengan', 'pada', 'cara', 'tips', 'panduan', 'lengkap', 'pengertian', 'arti', 'what', 'is', 'the', 'a', 'an', 'of', 'to', 'for', 'and', 'in', 'how', '2024', '2025', '2026', '2027', 'terbaru', 'contoh', 'jenis', 'manfaat', 'strategi', 'bisnis', 'agar', 'bagi', 'vs', 'atau']);
const topicTokens = s => String(s || '').toLowerCase().replace(/[^a-z0-9\s-]/g, ' ').replace(/-/g, ' ').split(/\s+/).filter(t => t.length > 1 && !STOPWORDS.has(t));
function topicSimilarity(a, b) {
  const ta = [...new Set(topicTokens(a))], tb = new Set(topicTokens(b));
  if (!ta.length || !tb.size) return 0;
  return ta.filter(t => tb.has(t)).length / ta.length;
}
function findDuplicate(keyword, posts, threshold) {
  let best = null;
  for (const p of posts || []) {
    const sim = Math.max(topicSimilarity(keyword, p.title), topicSimilarity(keyword, String(p.slug || '').replace(/-/g, ' ')));
    if (sim >= (threshold || 0.7) && (!best || sim > best.similarity)) best = Object.assign({ similarity: Number(sim.toFixed(2)) }, p);
  }
  return best;
}
