// automation/src/ads-image-jobs.js
// Satu item per gambar (creative / custom image) → node Slides "Ganti Gambar" dijalankan per item
// dengan continueRegularOutput: gambar yang gagal hanya jadi warning, laporan tetap jadi.
// Selalu keluarkan minimal 1 item (hasImage=false) supaya alur n8n tidak berhenti.

const r = $('Susun Request Slides').first().json;
const jobs = r.imageJobs || [];
if (!jobs.length) return [{ json: { hasImage: false, presentationId: r.presentationId } }];
return jobs.map((j) => ({ json: { hasImage: true, presentationId: r.presentationId, ref: j.ref, body: { requests: [{ replaceImage: j.replaceImage }] } } }));
