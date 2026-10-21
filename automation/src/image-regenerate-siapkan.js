// PRD F6b — Siapkan prompt gambar konkret berdasarkan section title & text untuk webhook supermat-image
const body = $json.body || {};
const sectionTitle = String(body.sectionTitle || '').trim();
const sectionText = String(body.sectionText || '').trim();
const style = String(body.style || 'foto editorial realistis, pencahayaan natural, warna hangat, tanpa teks atau logo di dalam gambar').trim();
const aspect = String(body.aspect || '4:3').trim();
const alt = String(body.alt || sectionTitle || 'Ilustrasi artikel').trim();

// Tulis prompt dalam bahasa Inggris untuk text-to-image AI berdasarkan isi spesifik section
const promptText = `A concrete, high quality editorial illustration depicting ${sectionTitle ? `the concept of "${sectionTitle}"` : 'the article section'}${sectionText ? `, where ${sectionText.slice(0, 200)}` : ''}. Style: ${style}. Clean composition, natural lighting, highly detailed, no text, no watermark, no logos, no real faces.`;

return [{ json: {
  sectionTitle,
  sectionText,
  style,
  aspect: ['16:9', '4:3', '1:1'].includes(aspect) ? aspect : '4:3',
  alt,
  requestId: body.requestId || ('img_' + Date.now().toString(36)),
  prompt: promptText
} }];
