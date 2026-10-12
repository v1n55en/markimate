// Fase 6 — Satu item per prompt gambar untuk node "Nano Banana" (Gemini image). idx 0 = hero 16:9, lainnya 4:3.
const N = $input.first().json;
const style = N.options && N.options.imageStyle ? ' Style: ' + N.options.imageStyle + '.' : '';
return (N.article.imagePrompts || []).map((p, i) => ({ json: {
  idx: Number.isFinite(Number(p.idx)) ? Number(p.idx) : i,
  placement: p.placement || (i === 0 ? 'hero' : 'after_h2:' + i),
  alt: String(p.alt || N.article.title || ''),
  aspect: i === 0 ? '16:9' : '4:3',
  prompt: String(p.prompt) + style + ' No text, no letters, no watermark, no logo.',
  slug: String(N.article.slug || 'artikel'),
} }));
