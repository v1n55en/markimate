// automation/src/ads-share-list.js
// Daftar penerima akses file Slides: owner workspace = writer (editor), penerima laporan = reader.
// Selalu minimal 1 item (hasEmail=false) supaya alur tidak berhenti.

const job = $('Auth & Normalize (Ads)').first().json;
const copy = $('Drive: Salin Base Deck').first().json;
const seen = new Set();
const items = [];
const add = (email, role) => {
  const e = String(email || '').trim().toLowerCase();
  if (!e || !e.includes('@') || seen.has(e)) return;
  seen.add(e);
  items.push({ json: { hasEmail: true, fileId: copy.id, body: { type: 'user', role, emailAddress: e } } });
};
add(job.owner && job.owner.email, 'writer');
for (const r of job.recipients || []) add(r, 'reader');
return items.length ? items : [{ json: { hasEmail: false, fileId: copy.id } }];
