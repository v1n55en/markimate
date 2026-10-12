// Adapter WordPress — siapkan request REST API dari kredensial user (Application Password)
const IN = $input.first().json;
const W = (IN.cms || {}).wordpress || {};
const base = String(W.url || '').replace(/\/+$/, '');
const auth = 'Basic ' + Buffer.from(String(W.user) + ':' + String(W.appPassword).replace(/\s+/g, '')).toString('base64');
const A = IN.article || {};
const action = IN.action === 'publish' ? 'publish' : 'draft';
const postId = String(IN.postId || '').trim();

__MD__

const payload = {};
if (A.title) {
  payload.title = String(A.title);
  payload.slug = String(A.slug || '').trim() || undefined;
  payload.excerpt = String(A.excerpt || '');
  payload.content = markdownToHtml(A.bodyMarkdown || A.body || '');
}
payload.status = action;
if (A.title && Array.isArray(W.categoryIds) && W.categoryIds.length) payload.categories = W.categoryIds;
if (A.title && W.authorId) payload.author = W.authorId;
if (!A.title && !postId) throw new Error('Tidak ada artikel maupun postId untuk diproses.');

return [{ json: {
  cmsType: 'wordpress', action, postId, base, auth,
  url: postId ? base + '/wp-json/wp/v2/posts/' + postId : base + '/wp-json/wp/v2/posts',
  payload,
  images: Array.isArray(IN.images) ? IN.images : [], hasImages: !!A.title && Array.isArray(IN.images) && IN.images.length > 0,
  mediaUrl: base + '/wp-json/wp/v2/media', warnings: Array.isArray(IN.warnings) ? IN.warnings : [],
  keyword: A.primaryKeyword || '', title: A.title || '',
  requestId: IN.requestId || '',
} }];
