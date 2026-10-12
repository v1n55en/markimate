// Adapter Sanity — satu item (dengan binary "data") per gambar untuk di-upload ke Assets API
const P = $input.first().json;
const out = [];
for (const im of P.images || []) {
  const buf = Buffer.from(String(im.b64 || ''), 'base64');
  if (!buf.length) continue;
  const bin = await this.helpers.prepareBinaryData(buf, im.filename || ('image-' + im.idx + '.png'), im.mime || 'image/png');
  out.push({ json: { idx: im.idx, placement: im.placement, alt: im.alt, filename: im.filename, uploadUrl: P.uploadUrlBase + '?filename=' + encodeURIComponent(im.filename || ('image-' + im.idx + '.png')), auth: P.auth, mime: im.mime || 'image/png' }, binary: { data: bin } });
}
return out.length ? out : [{ json: { idx: -1, skip: true, uploadUrl: '', auth: '' } }];
