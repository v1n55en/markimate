// Adapter Sanity — siapkan dokumen dari kredensial user (token Editor)
// draft            → Mutations API: createOrReplace "drafts.<id>"
// publish + artikel → Mutations API: createOrReplace "<id>" + hapus "drafts.<id>"
// publish tanpa artikel (postId draf lama) → Actions API: sanity.action.document.publish (isi draf apa adanya)
// Fase 6: field author/categories/publishedAt/excerpt/mainImage (mapping dari cms.sanity.*), gambar AI (images[] base64 → asset), placeholder image di Portable Text.
const IN = $input.first().json;
const S = (IN.cms || {}).sanity || {};
const projectId = String(S.projectId || '').trim().toLowerCase();
const dataset = String(S.dataset || 'production').trim();
const docType = String(S.docType || 'post').trim() || 'post';
const bodyField = String(S.bodyField || 'body').trim() || 'body';
const F = { publishedAt: S.publishedAtField || 'publishedAt', mainImage: S.mainImageField || 'mainImage', excerpt: S.excerptField || 'excerpt' };
const action = IN.action === 'publish' ? 'publish' : 'draft';
const A = IN.article && typeof IN.article === 'object' ? IN.article : null;
const API = 'https://' + projectId + '.api.sanity.io/v2025-02-19';
const images = Array.isArray(IN.images) ? IN.images : [];

__MD__

let baseId = String(IN.postId || '').trim().replace(/^drafts\./, '');
if (!baseId) baseId = 'markimate-' + Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
const draftId = 'drafts.' + baseId;
const ref = id => ({ _type: 'reference', _ref: id, _key: 'r' + Math.random().toString(36).slice(2, 8) });

let url, body, mode, doc = null, extraMutations = [];
if (A && A.title) {
  const slug = String(A.slug || '').trim() || String(A.title).toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 90);
  doc = { _type: docType, title: String(A.title), slug: { _type: 'slug', current: slug } };
  doc[F.excerpt] = String(A.excerpt || '');
  doc[bodyField] = markdownToPortableText(A.bodyMarkdown || A.body || '');
  if (action === 'publish') doc[F.publishedAt] = new Date().toISOString();
  // author & kategori (opsional, hanya bila diisi di pengaturan)
  let authorId = String(S.authorId || '').trim();
  if (!authorId && S.autoCreateAuthor !== false && (A.authorName || IN.clientName)) {
    authorId = 'author.markimate-' + String(IN.clientName || 'ai-team').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 40);
    extraMutations.push({ createIfNotExists: { _id: authorId, _type: 'author', name: String(A.authorName || IN.clientName || 'AI Team'), slug: { _type: 'slug', current: authorId.replace(/^author\./, '') } } });
  }
  if (authorId) doc.author = { _type: 'reference', _ref: authorId };
  const cats = (S.categoryIds || []).filter(Boolean);
  if (cats.length) doc.categories = cats.map(ref);
  mode = 'mutate';
  url = API + '/data/mutate/' + encodeURIComponent(dataset) + '?returnIds=true&visibility=sync';
  body = null; // disusun di "Susun Mutasi" setelah upload gambar
} else {
  if (!IN.postId) throw new Error('Tidak ada artikel maupun postId untuk diproses.');
  url = API + '/data/actions/' + encodeURIComponent(dataset);
  body = { actions: [{ actionType: 'sanity.action.document.publish', draftId, publishedId: baseId }] };
  mode = 'publishDraft';
}

return [{ json: {
  cmsType: 'sanity', action, mode, projectId, dataset, docType, bodyField, fields: F, baseId, draftId,
  url, body, doc, extraMutations, auth: 'Bearer ' + String(S.token || '').trim(),
  uploadUrlBase: API + '/assets/images/' + encodeURIComponent(dataset),
  hasImages: mode === 'mutate' && images.length > 0,
  images,
  studioUrl: String(S.studioUrl || '').trim().replace(/\/+$/, ''),
  publicUrlPattern: String(S.publicUrlPattern || '').trim(),
  slug: doc ? doc.slug.current : '',
  title: A ? A.title || '' : '',
  warnings: Array.isArray(IN.warnings) ? IN.warnings : [],
  requestId: IN.requestId || '',
} }];
