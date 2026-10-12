// Fase 6 — Ambil base64 dari respons Gemini image per item, gabungkan ke payload publish (images[]), lanjut ke CMS Router.
const N = JSON.parse(JSON.stringify($('Auth & Normalize (Publish)').first().json));
const prompts = $('Siapkan Prompt Gambar').all().map(i => i.json);
const resps = $input.all().map(i => i.json || {});
const images = []; const failed = [];
resps.forEach((res, i) => {
  const meta = prompts[i] || {};
  const parts = (((res.candidates || [])[0] || {}).content || {}).parts || [];
  const img = parts.find(p => (p.inlineData && p.inlineData.data) || (p.inline_data && p.inline_data.data));
  if (!img) { failed.push(meta.idx); return; }
  const d = img.inlineData || img.inline_data;
  const mime = d.mimeType || d.mime_type || 'image/png';
  const ext = mime.includes('jpeg') ? 'jpg' : mime.includes('webp') ? 'webp' : 'png';
  images.push({ idx: meta.idx, placement: meta.placement, alt: meta.alt, mime, b64: d.data, filename: meta.slug + '-' + (meta.idx === 0 ? 'hero' : 'img-' + meta.idx) + '.' + ext });
});
if (failed.length) N.warnings.push('Gambar gagal dibuat untuk idx ' + failed.join(', ') + (resps.find(r => r.error) ? ': ' + String((resps.find(r => r.error).error || {}).message || '').slice(0, 120) : '') + '.');
// buang placeholder yang gambarnya gagal
const ok = new Set(images.map(i => i.idx));
N.article.bodyMarkdown = String(N.article.bodyMarkdown || '').replace(/^\s*!\[([^\]]*)\]\(markimate:image:(\d+)\)\s*$/gm, (m, alt, idx) => (ok.has(Number(idx)) ? m : '')).replace(/\n{3,}/g, '\n\n');
N.images = images;
return [{ json: N }];
