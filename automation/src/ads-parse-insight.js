// automation/src/ads-parse-insight.js
// Gabungkan hasil Gemini (satu panggilan untuk semua halaman AI) ke model halaman.
// Kalau Gemini gagal/kosong, laporan TETAP dibuat dengan teks cadangan + warning ai_unavailable.

const proc = $('Proses Metrik').first().json;
const job = $('Auth & Normalize (Ads)').first().json;
const warnings = [...(proc.warnings || [])];
const L = (id, en) => (job.locale === 'en' ? en : id);

let insights = {};
let aiUsed = 0;
if (proc.ai && proc.ai.needed) {
  const res = $input.first().json || {};
  try {
    const text = res.candidates && res.candidates[0] && res.candidates[0].content && res.candidates[0].content.parts
      ? res.candidates[0].content.parts.map((p) => p.text || '').join('')
      : '';
    const cleaned = text.replace(/^```(?:json)?\s*/i, '').replace(/```\s*$/, '').trim();
    const parsed = cleaned ? JSON.parse(cleaned) : {};
    if (parsed && typeof parsed === 'object') insights = parsed;
  } catch (e) {
    insights = {};
  }
  if (!Object.keys(insights).length) warnings.push('ai_unavailable');
}

const clean = (s, max) => String(s || '').replace(/\*\*/g, '').replace(/^#+\s*/gm, '').trim().slice(0, max);
const model = proc.model.map((page) => {
  const key = `p${page.index}`;
  if (page.type === 'ai_insight') {
    const t = clean(insights[key], 1600);
    if (t) aiUsed++;
    return { ...page, insight: t || L('Insight AI tidak tersedia untuk laporan ini. Silakan buat ulang laporan untuk mencoba lagi.', 'AI insight is not available for this report. Please regenerate the report to try again.') };
  }
  if (page.type === 'breakdown') {
    return { ...page, insight: clean(insights[key], 400) };
  }
  return page;
});

return [{ json: { ...proc, model, warnings, aiPages: aiUsed } }];
