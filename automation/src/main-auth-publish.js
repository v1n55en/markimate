// 3Our Supermat API — validasi API key & normalisasi input untuk endpoint PUBLISH
// Body: { cmsType: 'wordpress'|'wix'|'sanity'|'shopify', action: 'draft'|'publish', cms: {...kredensial user...}, article: {...}, postId?: '' }
// API key (header X-Supermat-Key) divalidasi oleh node Webhook (Header Auth, credential "Supermat API Key (Header)").
// Request tanpa key yang benar sudah ditolak 403 sebelum sampai ke node ini. Key TIDAK ditulis di kode/repo.
const headers = $json.headers || {};
const body = $json.body || {};
const ok = true;

const cmsType = String(body.cmsType || body.CMS_Type || '').toLowerCase().trim();
const action = String(body.action || '').toLowerCase() === 'publish' ? 'publish' : 'draft';
const cmsIn = body.cms || {};
const str = v => String(v ?? '').trim();
const cms = {
  wordpress: {
    url: str((cmsIn.wordpress || {}).url || body.wpUrl).replace(/\/+$/, ''),
    user: str((cmsIn.wordpress || {}).user || body.wpUser),
    appPassword: str((cmsIn.wordpress || {}).appPassword || body.wpPass),
  },
  wix: {
    siteId: str((cmsIn.wix || {}).siteId || body.wixSiteId),
    apiKey: str((cmsIn.wix || {}).apiKey || body.wixKey),
    memberId: str((cmsIn.wix || {}).memberId || body.wixMemberId),
  },
  sanity: {
    projectId: str((cmsIn.sanity || {}).projectId || body.projectId),
    dataset: str((cmsIn.sanity || {}).dataset || body.dataset) || 'production',
    token: str((cmsIn.sanity || {}).token || body.authToken),
    studioUrl: str((cmsIn.sanity || {}).studioUrl || body.studioUrl),
    docType: str((cmsIn.sanity || {}).docType) || 'post',
    bodyField: str((cmsIn.sanity || {}).bodyField) || 'body',
    publicUrlPattern: str((cmsIn.sanity || {}).publicUrlPattern),
    // Fase 6: mapping field dokumen
    authorId: str((cmsIn.sanity || {}).authorId),
    autoCreateAuthor: (cmsIn.sanity || {}).autoCreateAuthor !== false,
    categoryIds: Array.isArray((cmsIn.sanity || {}).categoryIds) ? (cmsIn.sanity || {}).categoryIds.map(str).filter(Boolean) : [],
    publishedAtField: str((cmsIn.sanity || {}).publishedAtField) || 'publishedAt',
    mainImageField: str((cmsIn.sanity || {}).mainImageField) || 'mainImage',
    excerptField: str((cmsIn.sanity || {}).excerptField) || 'excerpt',
  },
  shopify: {
    shop: str((cmsIn.shopify || {}).shop).toLowerCase().replace(/^https?:\/\//, '').replace(/\/.*$/, ''),
    accessToken: str((cmsIn.shopify || {}).accessToken),
    clientId: str((cmsIn.shopify || {}).clientId),
    clientSecret: str((cmsIn.shopify || {}).clientSecret),
    blogId: str((cmsIn.shopify || {}).blogId),
    authorName: str((cmsIn.shopify || {}).authorName),
  },
};
if (cmsIn.wordpress) { cms.wordpress.categoryIds = Array.isArray(cmsIn.wordpress.defaultCategoryIds) ? cmsIn.wordpress.defaultCategoryIds.map(Number).filter(Boolean) : []; cms.wordpress.authorId = Number(cmsIn.wordpress.authorId) || 0; }

// --- Fase 6: gambar AI (hanya Sanity & WordPress yang bisa menerima upload) ---
const optIn = body.options && typeof body.options === 'object' ? body.options : {};
const IMAGE_CMS = ['sanity', 'wordpress'];
const warnings = [];
const prompts = body.article && Array.isArray(body.article.imagePrompts) ? body.article.imagePrompts.filter(p => p && p.prompt) : [];
let makeImages = optIn.images !== false && prompts.length > 0 && !!(body.article && body.article.title);
if (makeImages && !IMAGE_CMS.includes(cmsType)) { makeImages = false; warnings.push((cmsType === 'wix' ? 'Wix' : cmsType === 'shopify' ? 'Shopify' : cmsType) + ': upload gambar belum didukung, artikel dikirim tanpa gambar.'); }
const stripPlaceholders = md => String(md || '').replace(/^\s*!\[[^\]]*\]\(markimate:image:\d+\)\s*$/gm, '').replace(/\n{3,}/g, '\n\n');
const article = body.article && typeof body.article === 'object' ? body.article : null;
const postId = str(body.postId || body.draftDocId || body.draftPostId);

let statusCode = 200, error = '';
if (!ok) { statusCode = 401; error = 'API key tidak valid. Kirim header X-Supermat-Key.'; }
else if (!['wordpress', 'wix', 'sanity', 'shopify'].includes(cmsType)) { statusCode = 400; error = 'cmsType harus wordpress, wix, sanity, atau shopify.'; }
else if (!article && !postId) { statusCode = 400; error = 'Field "article" wajib diisi (atau postId untuk publish draf yang sudah ada).'; }
else if (article && (!str(article.title) || !str(article.bodyMarkdown || article.body))) { statusCode = 400; error = 'article.title dan article.bodyMarkdown wajib diisi.'; }
else if (cmsType === 'wordpress' && (!cms.wordpress.url || !cms.wordpress.user || !cms.wordpress.appPassword)) { statusCode = 400; error = 'Kredensial WordPress belum lengkap (url, user, appPassword).'; }
else if (cmsType === 'wix' && (!cms.wix.siteId || !cms.wix.apiKey)) { statusCode = 400; error = 'Kredensial Wix belum lengkap (siteId, apiKey).'; }
else if (cmsType === 'sanity' && (!cms.sanity.projectId || !cms.sanity.token)) { statusCode = 400; error = 'Kredensial Sanity belum lengkap (projectId, token).'; }
else if (cmsType === 'sanity' && (!/^[a-z0-9]+$/i.test(cms.sanity.projectId) || !/^[a-z0-9_-]+$/i.test(cms.sanity.dataset) || !/^[A-Za-z_][A-Za-z0-9_.-]*$/.test(cms.sanity.docType) || !/^[A-Za-z_][A-Za-z0-9_]*$/.test(cms.sanity.bodyField))) { statusCode = 400; error = 'Format Sanity tidak valid: Project ID (huruf/angka), dataset (huruf kecil, angka, - _), docType & bodyField (nama field).'; }
else if (cmsType === 'shopify' && (!cms.shopify.shop || (!cms.shopify.accessToken && !(cms.shopify.clientId && cms.shopify.clientSecret)))) { statusCode = 400; error = 'Kredensial Shopify belum lengkap (shop + accessToken, atau shop + clientId + clientSecret).'; }
if (cms.wordpress.url && !/^https?:\/\//i.test(cms.wordpress.url)) cms.wordpress.url = 'https://' + cms.wordpress.url;

return [{ json: {
  ok: statusCode === 200, statusCode, error,
  cmsType, action, cms, postId,
  article: article ? Object.assign({}, article, { bodyMarkdown: makeImages ? str(article.bodyMarkdown || article.body) : stripPlaceholders(article.bodyMarkdown || article.body), imagePrompts: makeImages ? prompts.slice(0, Math.min(Number(optIn.imageCount) || 3, 3)) : [] }) : null,
  makeImages, images: [], warnings,
  options: { images: makeImages, imageStyle: str(optIn.imageStyle) },
  clientName: str(body.clientName || body.Client_Name || 'Brand Anda'),
  requestId: str(body.requestId) || ('pub_' + Date.now().toString(36)),
} }];
