// automation/src/ads-process-metrics.js
// Normalisasi & agregasi metrics iklan (PRD F5 §3.2, inlining ads-metrics SSOT)

const input = $input.first().json;
const { fetchedData, template, conversionEvent, currency, compare } = input;

// 1. Helper agregasi dasar (sesuai shared/ads-metrics.js)
function aggregateMetrics(rows) {
  let spend = 0;
  let impressions = 0;
  let reach = 0;
  let clicks = 0;
  let link_clicks = 0;
  let conversions = 0;
  let conversion_value = 0;

  for (const r of rows) {
    spend += Number(r.spend || 0);
    impressions += Number(r.impressions || 0);
    reach += Number(r.reach || 0);
    clicks += Number(r.clicks || 0);
    link_clicks += Number(r.inline_link_clicks || r.link_clicks || 0);

    if (Array.isArray(r.actions)) {
      const convAction = r.actions.find(a => a.action_type === conversionEvent || a.action_type === 'purchase' || a.action_type === 'lead');
      if (convAction) conversions += Number(convAction.value || 0);
    } else if (r.conversions) {
      conversions += Number(r.conversions || 0);
    }

    if (Array.isArray(r.action_values)) {
      const valAction = r.action_values.find(a => a.action_type === conversionEvent || a.action_type === 'purchase');
      if (valAction) conversion_value += Number(valAction.value || 0);
    } else if (r.conversion_value) {
      conversion_value += Number(r.conversion_value || 0);
    }
  }

  // Derived metrics (dihitung dari rasio jumlah, bukan rata-rata rasio)
  const ctr = impressions > 0 ? clicks / impressions : null;
  const cpc = clicks > 0 ? spend / clicks : null;
  const cpm = impressions > 0 ? (spend / impressions) * 1000 : null;
  const cpa = conversions > 0 ? spend / conversions : null;
  const roas = spend > 0 ? conversion_value / spend : null;
  const conv_rate = clicks > 0 ? conversions / clicks : null;
  const frequency = reach > 0 ? impressions / reach : null;
  const cost_per_result = conversions > 0 ? spend / conversions : null;

  return {
    spend,
    impressions,
    reach,
    clicks,
    link_clicks,
    conversions,
    results: conversions,
    conversion_value,
    purchase_value: conversion_value,
    ctr,
    cpc,
    cpm,
    cpa,
    roas,
    conv_rate,
    frequency,
    cost_per_result,
    cost_per_purchase: cpa
  };
}

// Hitung metrik periode aktif dan periode perbandingan
const currentMetrics = aggregateMetrics(fetchedData.accountSummaries || []);
const prevMetrics = aggregateMetrics(fetchedData.prevSummaries || []);

// Hitung persentase perubahan (delta)
const deltas = {};
for (const [key, currVal] of Object.entries(currentMetrics)) {
  const prevVal = prevMetrics[key];
  if (currVal !== null && prevVal !== null && prevVal > 0) {
    deltas[key] = Math.round(((currVal - prevVal) / prevVal) * 1000) / 10;
  } else {
    deltas[key] = null;
  }
}

// Siapkan KPI Cards untuk halaman KPI
const kpiCards = [
  { id: 'impressions', label: 'Impresi', value: currentMetrics.impressions, delta: deltas.impressions, format: 'number' },
  { id: 'reach', label: 'Jangkauan (Reach)', value: currentMetrics.reach, delta: deltas.reach, format: 'number' },
  { id: 'clicks', label: 'Total Klik', value: currentMetrics.clicks, delta: deltas.clicks, format: 'number' },
  { id: 'ctr', label: 'CTR', value: currentMetrics.ctr, delta: deltas.ctr, format: 'percent' },
  { id: 'spend', label: 'Total Biaya', value: currentMetrics.spend, delta: deltas.spend, format: 'currency' },
  { id: 'cpc', label: 'CPC Rata-rata', value: currentMetrics.cpc, delta: deltas.cpc, format: 'currency' },
  { id: 'results', label: 'Hasil (Konversi)', value: currentMetrics.results, delta: deltas.results, format: 'number' },
  { id: 'roas', label: 'ROAS', value: currentMetrics.roas, delta: deltas.roas, format: 'ratio' }
];

// Siapkan ringkasan performa untuk AI Prompt
const summaryText = `Total Spend: ${currentMetrics.spend} ${currency} (${deltas.spend > 0 ? '+' : ''}${deltas.spend}% vs lalu)
Total Impresi: ${currentMetrics.impressions} (${deltas.impressions}%)
Total Klik: ${currentMetrics.clicks} (CTR: ${(currentMetrics.ctr * 100).toFixed(2)}%)
Total Konversi: ${currentMetrics.conversions} (CPA: ${currentMetrics.cpa})
ROAS: ${currentMetrics.roas ? currentMetrics.roas.toFixed(2) : 'N/A'}`;

return [{
  json: {
    ...input,
    processed: {
      currentMetrics,
      prevMetrics,
      deltas,
      kpiCards,
      summaryText
    }
  }
}];
