// Adapter Sanity — ganti placeholder gambar di Portable Text dengan asset yang sudah di-upload, set mainImage, susun mutations.
const P = $('Siapkan Sanity').first().json;
if (P.mode !== 'mutate') return [{ json: P }]; // publishDraft: body sudah siap

let uploads = [];
try { uploads = $('Pecah Gambar').all().map((it, i) => ({ meta: it.json, res: ($('Sanity: Upload Asset').all()[i] || {}).json || {} })); } catch (e) { uploads = []; }
const assets = {}; const failed = [];
for (const u of uploads) {
  if (!u.meta || u.meta.skip) continue;
  let b = u.res.body; if (typeof b === 'string') { try { b = JSON.parse(b); } catch (e) { b = {}; } }
  const id = b && b.document && b.document._id;
  if (id && Number(u.res.statusCode || 200) < 300) assets[u.meta.idx] = { assetId: id, url: b.document.url || '', alt: u.meta.alt || '', placement: u.meta.placement };
  else failed.push(u.meta.idx);
}

const doc = JSON.parse(JSON.stringify(P.doc));
const key = () => 'k' + Math.random().toString(36).slice(2, 10);
// inline: placeholder → image block (atau dibuang bila gagal)
doc[P.bodyField] = (doc[P.bodyField] || []).map(b => {
  if (b._type !== 'image' || b._markimateIdx === undefined) return b;
  const a = assets[b._markimateIdx]; if (!a) return null;
  return { _type: 'image', _key: b._key || key(), asset: { _type: 'reference', _ref: a.assetId }, alt: b.alt || a.alt };
}).filter(Boolean);
// hero → mainImage
if (assets[0]) doc[P.fields.mainImage] = { _type: 'image', asset: { _type: 'reference', _ref: assets[0].assetId }, alt: assets[0].alt };

const mutations = [...(P.extraMutations || [])];
if (P.action === 'publish') mutations.push({ createOrReplace: Object.assign({ _id: P.baseId }, doc) }, { delete: { id: P.draftId } });
else mutations.push({ createOrReplace: Object.assign({ _id: P.draftId }, doc) });

const warnings = [...(P.warnings || [])];
if (failed.length) warnings.push('Upload gambar ke Sanity gagal untuk idx ' + failed.join(', ') + '.');
return [{ json: Object.assign({}, P, { body: { mutations }, doc: undefined, images: undefined, uploadedImages: Object.entries(assets).map(([idx, a]) => Object.assign({ idx: Number(idx) }, a)), warnings }) }];
