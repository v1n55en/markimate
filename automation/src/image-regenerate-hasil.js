// PRD F6b — Proses respons Nano Banana (Gemini image) untuk webhook supermat-image
const meta = $('Siapkan Prompt Image').first().json || {};
const res = $input.first().json || {};
const parts = (((res.candidates || [])[0] || {}).content || {}).parts || [];
const img = parts.find(p => (p.inlineData && p.inlineData.data) || (p.inline_data && p.inline_data.data));

if (!img) {
  const errMsg = (res.error && res.error.message) ? res.error.message : 'Gagal membuat gambar dari model AI Imagen';
  return [{ json: {
    ok: false,
    error: errMsg,
    requestId: meta.requestId
  } }];
}

const d = img.inlineData || img.inline_data;
const mime = d.mimeType || d.mime_type || 'image/png';
const b64 = d.data;

return [{ json: {
  ok: true,
  image: {
    base64: b64,
    mime,
    alt: meta.alt,
    aspect: meta.aspect,
    sectionTitle: meta.sectionTitle
  },
  requestId: meta.requestId
} }];
