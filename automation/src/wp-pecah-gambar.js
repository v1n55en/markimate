// Adapter WordPress — satu item (binary "data") per gambar untuk POST /wp-json/wp/v2/media
const P = $input.first().json;
const out = [];
for (const im of P.images || []) {
  const buf = Buffer.from(String(im.b64 || ''), 'base64');
  if (!buf.length) continue;
  const bin = await this.helpers.prepareBinaryData(buf, im.filename || ('image-' + im.idx + '.png'), im.mime || 'image/png');
  out.push({ json: { idx: im.idx, placement: im.placement, alt: im.alt, filename: im.filename || ('image-' + im.idx + '.png'), mime: im.mime || 'image/png', mediaUrl: P.mediaUrl, auth: P.auth }, binary: { data: bin } });
}
return out.length ? out : [{ json: { idx: -1, skip: true, mediaUrl: '', auth: '' } }];
