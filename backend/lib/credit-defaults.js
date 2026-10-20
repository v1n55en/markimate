// Default harga credit dan tarif biaya API nyata untuk Markimate
export const DEFAULT_PRICES = [
  { action_key: 'seo.article', credits: 60, label: 'Generate artikel SEO (Review Ready)' },
  { action_key: 'seo.image', credits: 5, label: 'Upload gambar artikel (per gambar)' },
  { action_key: 'seo.topics_run', credits: 10, label: 'Riset topik otomatis' },
  { action_key: 'seo.relink', credits: 5, label: 'Regenerate link/prompt' },
  { action_key: 'ads.report', credits: 400, label: 'Laporan bulanan akun iklan' },
  { action_key: 'ads.report_rerun', credits: 100, label: 'Laporan iklan ulang / custom' },
  { action_key: 'spy.scan', credits: 40, label: 'Scan kompetitor iklan' },
  { action_key: 'spy.insight', credits: 50, label: 'Insight AI kompetitor' },
  { action_key: 'spy.export', credits: 0, label: 'Export data kompetitor' },
];

export const DEFAULT_COST_RATES = [
  { rate_key: 'gemini_in_per_1k', idr: 4.95, note: 'Gemini 2.5 Flash input token ($0.30/1M)' },
  { rate_key: 'gemini_out_per_1k', idr: 41.25, note: 'Gemini 2.5 Flash output token ($2.50/1M incl. thinking)' },
  { rate_key: 'image', idr: 554.4, note: 'Nano Banana 2 Lite / gemini image ($0.0336/gambar)' },
  { rate_key: 'serp_call', idr: 247.5, note: 'SerpAPI Developer ($75/5.000 search = $0.015/call)' },
  { rate_key: 'rapid_call', idr: 16.5, note: 'RapidAPI Ahrefs Pro ($4.99/5.000 = $0.001/call)' },
];
