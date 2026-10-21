// PRD F6b — Ambil deskripsi prompt gambar hasil rumusan Gemini Text untuk diproses oleh Nano Banana (Imagen)
const meta = $('Siapkan Prompt Gemini').first().json || {};
const res = $input.first().json || {};
const parts = (((res.candidates || [])[0] || {}).content || {}).parts || [];
const rawPrompt = parts.map(p => p.text || '').join('').trim();
const fallbackPrompt = `A concrete, high quality editorial illustration depicting the concept of "${meta.sectionTitle || 'the article topic'}". Style: ${meta.style}. Natural lighting, detailed composition, no text, no watermark, no logos.`;
const finalPrompt = rawPrompt || fallbackPrompt;

return [{ json: {
  sectionTitle: meta.sectionTitle,
  sectionText: meta.sectionText,
  style: meta.style,
  aspect: meta.aspect,
  alt: meta.alt,
  requestId: meta.requestId,
  prompt: finalPrompt
} }];
