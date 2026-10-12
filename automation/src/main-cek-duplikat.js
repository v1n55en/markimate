// Fase 6 — Ambil daftar artikel yang sudah ada di CMS user (bila cms dikirim) lalu cek topik duplikat.
// Output = input (keyword, geo, ln, …) + existingPosts + duplicate flag, supaya node riset berikutnya tetap membaca $json.keyword.
const N = $input.first().json;
const H = this.helpers;

__CMS__

let existingPosts = [];
const needPosts = N.cmsType && (N.options.duplicateCheck || N.options.internalLinks);
if (needPosts) existingPosts = await listExistingPosts(H, N.cmsType, N.cms, { limit: 200, siteBaseUrl: N.options.siteBaseUrl });

const dup = N.options.duplicateCheck ? findDuplicate(N.keyword, existingPosts, N.options.duplicateThreshold) : null;

return [{ json: Object.assign({}, N, {
  existingPosts,
  existingPostsChecked: existingPosts.length,
  needEnrich: !!((N.options.internalLinks && existingPosts.length) || N.options.externalLinks || N.options.imagePrompts),
  duplicate: !!dup,
  duplicateOf: dup ? { title: dup.title, slug: dup.slug, url: dup.url, similarity: dup.similarity } : null,
  statusCode: dup ? 409 : 200,
  error: dup ? 'Topik mirip sudah ada di CMS: ' + dup.title : '',
}) }];
