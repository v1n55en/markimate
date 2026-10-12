// Adapter WordPress — pasang hasil upload media: featured_media (hero) + ganti <img data-markimate-idx> dengan URL asli
const P = JSON.parse(JSON.stringify($('Siapkan WP').first().json));
let uploads = [];
try { uploads = $('Pecah Gambar WP').all().map((it, i) => ({ meta: it.json, res: ($('WP: Upload Media').all()[i] || {}).json || {} })); } catch (e) { uploads = []; }
const media = {}; const failed = [];
for (const u of uploads) {
  if (!u.meta || u.meta.skip) continue;
  let b = u.res.body; if (typeof b === 'string') { try { b = JSON.parse(b); } catch (e) { b = {}; } }
  if (b && b.id && Number(u.res.statusCode || 200) < 300) media[u.meta.idx] = { mediaId: b.id, url: b.source_url || '', alt: u.meta.alt, placement: u.meta.placement };
  else failed.push(u.meta.idx);
}
if (P.payload && P.payload.content) {
  P.payload.content = P.payload.content.replace(/<img data-markimate-idx="(\d+)" alt="([^"]*)">/g, (m, idx, alt) => {
    const a = media[Number(idx)]; if (!a) return '';
    return '<figure class="wp-block-image size-large"><img src="' + a.url + '" alt="' + alt + '" class="wp-image-' + a.mediaId + '"/></figure>';
  });
  if (media[0]) P.payload.featured_media = media[0].mediaId;
}
const warnings = [...(P.warnings || [])];
if (failed.length) warnings.push('Upload gambar ke WordPress gagal untuk idx ' + failed.join(', ') + '.');
return [{ json: Object.assign(P, { images: undefined, uploadedImages: Object.entries(media).map(([idx, a]) => Object.assign({ idx: Number(idx) }, a)), warnings }) }];
