// Adapter Sanity — rapikan respons Sanity jadi format standar Supermat
const P = $('Susun Mutasi').first().json;
const R = $input.first().json || {};
const status = Number(R.statusCode || 0);
let body = R.body;
if (typeof body === 'string') { try { body = JSON.parse(body); } catch (e) { body = { raw: body.slice(0, 300) }; } }
body = body || {};
const ok = status >= 200 && status < 300 && !body.error;

if (!ok) {
  const detail = (body.error && (body.error.description || body.error.message || body.error)) || body.message || body.raw || (R.error && (R.error.message || String(R.error))) || ('HTTP ' + status);
  let msg = 'Sanity menolak permintaan: ' + (typeof detail === 'string' ? detail : JSON.stringify(detail));
  if (status === 401) msg = 'Token Sanity tidak valid (401). Buat token baru di sanity.io/manage → API → Tokens dengan izin Editor.';
  if (status === 403) msg = 'Token Sanity tidak punya izin menulis (403). Pakai token dengan izin Editor, bukan Viewer.';
  if (status === 404) msg = 'Project ID atau dataset Sanity tidak ditemukan (404). Cek Project ID & nama dataset.';
  if (P.mode === 'publishDraft' && status === 409) msg = 'Draf di Sanity tidak ditemukan atau sudah terbit — buka Studio untuk mengecek.';
  if (!status) msg = 'Tidak bisa menghubungi Sanity: ' + msg;
  return [{ json: { status: 'error', cmsType: 'sanity', action: P.action, httpStatus: status, message: msg, requestId: P.requestId } }];
}

const published = P.action === 'publish';
const editId = published ? P.baseId : 'drafts.' + P.baseId;
const draftEditUrl = P.studioUrl
  ? P.studioUrl + '/intent/edit/id=' + encodeURIComponent(P.baseId) + ';type=' + encodeURIComponent(P.docType)
  : 'https://www.sanity.io/manage/project/' + P.projectId;
const publicUrl = published && P.publicUrlPattern && P.slug ? P.publicUrlPattern.replace('{slug}', P.slug) : '';
return [{ json: {
  status: 'ok', cmsType: 'sanity', action: P.action,
  postId: P.baseId, documentId: editId, postStatus: published ? 'publish' : 'draft',
  draftEditUrl, publicUrl, previewUrl: '',
  title: P.title,
  message: published ? 'Artikel terbit di Sanity.' : 'Draf tersimpan di Sanity.',
  images: P.uploadedImages || [], warnings: P.warnings || [],
  requestId: P.requestId,
} }];
