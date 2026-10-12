// Adapter WordPress — rapikan hasil REST API jadi format standar Supermat
const P = $('Susun Payload WP').first().json;
const R = $input.first().json || {};
const status = Number(R.statusCode || R.status || 0);
const body = R.body && typeof R.body === 'object' ? R.body : (R.body ? (() => { try { return JSON.parse(R.body); } catch (e) { return { raw: String(R.body).slice(0, 300) }; } })() : R);
const okHttp = status >= 200 && status < 300;

if (!okHttp || !body.id) {
  let msg = body.message || body.code || (body.raw ? 'Respons bukan JSON: ' + body.raw : '') || R.error && (R.error.message || String(R.error)) || ('HTTP ' + status);
  if (status === 401 || status === 403) msg = 'WordPress menolak akses (' + status + '). Cek username & Application Password, dan pastikan REST API tidak diblokir plugin keamanan. Detail: ' + (body.message || body.code || '-');
  if (status === 405) msg = 'Situs menolak metode POST ke REST API (405). Kemungkinan bukan situs WordPress, REST API dinonaktifkan, atau diblokir firewall/plugin keamanan.';
  if (status === 404) msg = 'Endpoint REST WordPress tidak ditemukan (404). Pastikan URL situs benar dan permalink/REST API aktif.';
  if (!status) msg = 'Tidak bisa menghubungi situs WordPress: ' + msg;
  return [{ json: { status: 'error', cmsType: 'wordpress', action: P.action, httpStatus: status, message: msg, requestId: P.requestId } }];
}

const id = body.id;
const link = body.link || '';
const postStatus = body.status || P.action;
return [{ json: {
  status: 'ok', cmsType: 'wordpress', action: P.action,
  postId: String(id), postStatus,
  draftEditUrl: P.base + '/wp-admin/post.php?post=' + id + '&action=edit',
  publicUrl: postStatus === 'publish' ? link : '',
  previewUrl: link ? link + (link.includes('?') ? '&' : '?') + 'preview=true' : '',
  title: (body.title && body.title.rendered) || P.title,
  message: postStatus === 'publish' ? 'Artikel terbit di WordPress.' : 'Draf tersimpan di WordPress.',
  images: P.uploadedImages || [], warnings: P.warnings || [],
  requestId: P.requestId,
} }];
