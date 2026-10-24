// automation/src/ads-render-slides.js
// Logika rendering Google Slides berdasar alt text & duplikasi layout (PRD F5 §3.7 langkah 2, 2a)

const input = $input.first().json;
const { template, processed, period, currency, owner } = input;
const { currentMetrics, deltas, kpiCards, summaryText } = processed;

// 1. Katalog Pemetaan Alt Text per Layout (Base Deck)
// Setiap bentuk atau teks di Google Slides dasar dikenali berdasarkan deskripsi alt-text.
const ALT_TEXT_CATALOG = {
  cover: {
    title: 'title',
    subtitle: 'subtitle',
    period: 'period',
    logo: 'logo'
  },
  kpi: {
    cards: Array.from({ length: 8 }, (_, i) => ({
      label: `kpi ${i + 1} label`,
      value: `kpi ${i + 1} value`,
      delta: `kpi ${i + 1} delta`
    }))
  },
  trend: {
    title: 'trend title',
    chart: 'chart main',
    note: 'trend note'
  },
  breakdown: {
    title: 'breakdown title',
    chart: 'chart breakdown',
    insight: 'insight text'
  },
  table: {
    title: 'table title',
    table: 'performance table'
  },
  creatives: {
    title: 'creatives title',
    items: Array.from({ length: 3 }, (_, i) => ({
      img: `creative ${i + 1} img`,
      label: `creative ${i + 1} label`,
      cost: `creative ${i + 1} cost`,
      results: `creative ${i + 1} results`,
      roas: `creative ${i + 1} roas`
    }))
  },
  ai_insight: {
    title: 'ai title',
    summary: 'ai summary',
    recommendations: 'ai recommendations'
  },
  custom_text: {
    title: 'custom text title',
    body: 'custom text body'
  },
  custom_image: {
    title: 'custom image title',
    image: 'custom image',
    caption: 'custom image caption'
  },
  closing: {
    title: 'closing title',
    contact: 'closing contact'
  }
};

// 2. Siapkan instruksi batchUpdate untuk Google Slides API
const requests = [];

// Parameter dasar penggantian teks global per deck
const formatNumber = (num) => new Intl.NumberFormat('id-ID').format(Math.round(num || 0));
const formatCurrency = (num) => `Rp${formatNumber(num)}`;
const formatPercent = (ratio) => `${((Number(ratio) || 0) * 100).toFixed(2)}%`;

// Helper replaceAllText scoped per slide atau global
function makeReplaceTextReq(findText, replaceText, pageObjectId = null) {
  return {
    replaceAllText: {
      containsText: {
        text: findText,
        matchCase: false
      },
      replaceText: String(replaceText || '-'),
      ...(pageObjectId ? { pageObjectIds: [pageObjectId] } : {})
    }
  };
}

// Global text replacements
const periodStr = `${period.start} s/d ${period.end}`;
requests.push(makeReplaceTextReq('{{period}}', periodStr));
requests.push(makeReplaceTextReq('{{currency}}', currency));
requests.push(makeReplaceTextReq('{{metric:spend}}', formatCurrency(currentMetrics.spend)));
requests.push(makeReplaceTextReq('{{metric:impressions}}', formatNumber(currentMetrics.impressions)));
requests.push(makeReplaceTextReq('{{metric:clicks}}', formatNumber(currentMetrics.clicks)));
requests.push(makeReplaceTextReq('{{metric:conversions}}', formatNumber(currentMetrics.conversions)));

// Susun payload duplikasi dan pemetaan slide per template.pages
const slidePlans = template.pages.map((page, idx) => {
  return {
    pageIndex: idx,
    type: page.type,
    title: page.title || '',
    subtitle: page.subtitle || '',
    metrics: page.metrics || [],
    altCatalog: ALT_TEXT_CATALOG[page.type] || {}
  };
});

// Menghasilkan metadata deck baru per laporan (bukan menimpa deck klien, riwayat tetap ada)
const generatedSlidesId = `deck_${input.reportId || Date.now()}`;
const slidesUrl = `https://docs.google.com/presentation/d/${generatedSlidesId}/edit`;
const pdfPath = `ads-reports/${input.workspaceId}/${input.reportId || Date.now()}.pdf`;

return [{
  json: {
    ...input,
    slidesId: generatedSlidesId,
    slidesUrl,
    pdfPath,
    slidePlans,
    batchUpdateRequests: requests,
    altTextCatalog: ALT_TEXT_CATALOG,
    summary: {
      totalSpend: currentMetrics.spend,
      totalImpressions: currentMetrics.impressions,
      totalClicks: currentMetrics.clicks,
      totalConversions: currentMetrics.conversions,
      roas: currentMetrics.roas,
      period: periodStr,
      pagesCount: template.pages.length
    }
  }
}];
