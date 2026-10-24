// shared/report-template.js
// Spesifikasi template laporan iklan, validasi skema, dan perhitungan estimasi kredit.
// Modul JS murni tanpa dependensi eksternal.

import { isKnownMetric } from './ads-metrics.js';

export const MAX_PAGES = 20;
export const MAX_AI_PAGES = 2;

export const ALLOWED_PAGE_TYPES = [
  'cover',
  'section',
  'kpi',
  'trend',
  'table',
  'breakdown',
  'creatives',
  'ai_insight',
  'custom_text',
  'custom_image',
  'closing'
];

export const ALLOWED_TABLE_DIMENSIONS = [
  'platform',
  'account',
  'campaign',
  'adset',
  'ad',
  'day',
  'week'
];

export const ALLOWED_BREAKDOWN_DIMENSIONS = [
  'objective',
  'publisher_platform',
  'placement',
  'age',
  'gender',
  'age_gender'
];

export const STANDARD_PLACEHOLDERS = new Set([
  'period',
  'account_name',
  'ads_platform',
  'client_name',
  'workspace_name'
]);

/**
 * Template bawaan "Markimate Standard" (meniru urutan deck produksi 3Our WF v3.2).
 * KPI disesuaikan maksimal 8 metrics sesuai batas spesifikasi PRD.
 */
export const MARKIMATE_STANDARD_TEMPLATE = {
  version: 1,
  name: 'Markimate Standard',
  locale: 'id',
  currency: 'IDR',
  pages: [
    {
      type: 'cover',
      title: 'Laporan Iklan {{period}}',
      subtitle: '{{account_name}} · {{ads_platform}}'
    },
    {
      type: 'kpi',
      title: 'Ringkasan Bulan Ini',
      platform: 'all',
      metrics: ['impressions', 'reach', 'clicks', 'ctr', 'spend', 'cpc', 'results', 'roas'],
      compare: true
    },
    {
      type: 'trend',
      title: 'Biaya vs Reach (6 bulan)',
      metrics: ['spend', 'reach'],
      granularity: 'month',
      months: 6,
      chart: 'combo'
    },
    {
      type: 'trend',
      title: 'Biaya & Hasil Harian',
      metrics: ['spend', 'results'],
      granularity: 'day',
      chart: 'bar'
    },
    {
      type: 'breakdown',
      title: 'Biaya per Objective',
      dimension: 'objective',
      metrics: ['spend'],
      chart: 'pie'
    },
    {
      type: 'breakdown',
      title: 'Performa per Platform & Placement',
      dimension: 'publisher_platform',
      metrics: ['spend', 'conv_rate'],
      chart: 'bar',
      insight: true
    },
    {
      type: 'breakdown',
      title: 'Demografi',
      dimension: 'age_gender',
      metrics: ['spend', 'results'],
      chart: 'bar',
      insight: true
    },
    {
      type: 'table',
      title: 'Performa Campaign',
      dimension: 'campaign',
      metrics: ['spend', 'impressions', 'reach', 'clicks', 'ctr', 'results', 'cost_per_result'],
      sort: '-spend',
      limit: 10
    },
    {
      type: 'creatives',
      title: 'Iklan Terbaik',
      sort: '-results',
      limit: 3,
      metrics: ['spend', 'results', 'cost_per_result']
    },
    {
      type: 'creatives',
      title: 'Iklan Perlu Dievaluasi',
      variant: 'lowest',
      limit: 3,
      metrics: ['spend', 'results', 'cost_per_result']
    },
    {
      type: 'ai_insight',
      title: 'Insight & Rekomendasi',
      focus: 'performa, efisiensi biaya, rekomendasi bulan depan'
    },
    {
      type: 'closing',
      title: 'Terima kasih'
    }
  ]
};

/**
 * Ekstraksi placeholder `{{...}}` dari teks.
 */
export function extractPlaceholders(text) {
  if (typeof text !== 'string') return [];
  const matches = text.match(/\{\{([^}]+)\}\}/g) || [];
  return matches.map((m) => m.slice(2, -2).trim());
}

/**
 * Validasi apakah suatu placeholder sah.
 */
export function isValidPlaceholder(placeholder, customMetricIds = new Set()) {
  if (STANDARD_PLACEHOLDERS.has(placeholder)) {
    return true;
  }
  if (placeholder.startsWith('metric:')) {
    const metricId = placeholder.slice(7).trim();
    if (isKnownMetric(metricId) || customMetricIds.has(metricId) || customMetricIds.has(`custom:${metricId}`)) {
      return true;
    }
  }
  return false;
}

/**
 * Validasi teks terhadap placeholder yang tidak dikenal.
 */
export function validateTextPlaceholders(text, customMetricIds = new Set()) {
  const placeholders = extractPlaceholders(text);
  const invalid = [];
  for (const ph of placeholders) {
    if (!isValidPlaceholder(ph, customMetricIds)) {
      invalid.push(ph);
    }
  }
  return invalid;
}

/**
 * Validasi template spesifikasi secara mendalam.
 * Mengembalikan `{ valid: boolean, errors: Array<{ pageIndex?: number, error: string, code?: string }> }`
 */
export function validateTemplate(spec, { customMetricIds = [] } = {}) {
  const errors = [];
  const customIdsSet = new Set(customMetricIds);

  if (!spec || typeof spec !== 'object') {
    return { valid: false, errors: [{ error: 'Template specification must be an object', code: 'INVALID_SPEC' }] };
  }

  if (spec.platform === 'google') {
    errors.push({
      error: 'Google Ads platform is not available until phase F5-Google',
      code: 'PLATFORM_NOT_AVAILABLE'
    });
  }

  if (!Array.isArray(spec.pages)) {
    errors.push({ error: 'Template must contain a pages array', code: 'MISSING_PAGES' });
    return { valid: false, errors };
  }

  if (spec.pages.length === 0) {
    errors.push({ error: 'Template must contain at least 1 page', code: 'EMPTY_PAGES' });
  }

  if (spec.pages.length > MAX_PAGES) {
    errors.push({
      error: `Template exceeds maximum page limit of ${MAX_PAGES} (found ${spec.pages.length})`,
      code: 'PAGE_LIMIT_EXCEEDED'
    });
  }

  let aiPageCount = 0;

  spec.pages.forEach((page, index) => {
    if (!page || typeof page !== 'object') {
      errors.push({ pageIndex: index, error: 'Page item must be an object', code: 'INVALID_PAGE' });
      return;
    }

    if (!ALLOWED_PAGE_TYPES.includes(page.type)) {
      errors.push({
        pageIndex: index,
        error: `Unknown page type '${page.type}'`,
        code: 'INVALID_PAGE_TYPE'
      });
      return;
    }

    if (page.platform === 'google') {
      errors.push({
        pageIndex: index,
        error: 'Google Ads platform is not available until phase F5-Google',
        code: 'PLATFORM_NOT_AVAILABLE'
      });
    }

    // Cek placeholder di title & subtitle & text
    for (const field of ['title', 'subtitle', 'text']) {
      if (typeof page[field] === 'string') {
        const invalid = validateTextPlaceholders(page[field], customIdsSet);
        if (invalid.length > 0) {
          errors.push({
            pageIndex: index,
            error: `Page has unknown placeholder(s): ${invalid.map((p) => `{{${p}}}`).join(', ')}`,
            code: 'UNKNOWN_PLACEHOLDER'
          });
        }
      }
    }

    // Validasi per jenis halaman
    switch (page.type) {
      case 'kpi': {
        if (!Array.isArray(page.metrics) || page.metrics.length === 0) {
          errors.push({
            pageIndex: index,
            error: 'KPI page must specify at least 1 metric',
            code: 'KPI_EMPTY_METRICS'
          });
        } else if (page.metrics.length > 8) {
          errors.push({
            pageIndex: index,
            error: `KPI page can have at most 8 metrics (found ${page.metrics.length})`,
            code: 'KPI_METRICS_LIMIT'
          });
        } else {
          for (const m of page.metrics) {
            if (!isKnownMetric(m) && !customIdsSet.has(m) && !customIdsSet.has(`custom:${m}`)) {
              errors.push({
                pageIndex: index,
                error: `Unknown metric '${m}' in KPI page`,
                code: 'UNKNOWN_METRIC'
              });
            }
          }
        }
        break;
      }

      case 'trend': {
        if (!Array.isArray(page.metrics) || page.metrics.length === 0) {
          errors.push({
            pageIndex: index,
            error: 'Trend page must specify at least 1 metric',
            code: 'TREND_EMPTY_METRICS'
          });
        } else if (page.metrics.length > 3) {
          errors.push({
            pageIndex: index,
            error: `Trend page can have at most 3 metrics (found ${page.metrics.length})`,
            code: 'TREND_METRICS_LIMIT'
          });
        }
        if (page.granularity && !['day', 'week', 'month'].includes(page.granularity)) {
          errors.push({
            pageIndex: index,
            error: `Invalid trend granularity '${page.granularity}'. Must be day, week, or month`,
            code: 'INVALID_GRANULARITY'
          });
        }
        break;
      }

      case 'table': {
        if (!ALLOWED_TABLE_DIMENSIONS.includes(page.dimension)) {
          errors.push({
            pageIndex: index,
            error: `Invalid table dimension '${page.dimension}'`,
            code: 'INVALID_DIMENSION'
          });
        }
        if (!Array.isArray(page.metrics) || page.metrics.length === 0) {
          errors.push({
            pageIndex: index,
            error: 'Table page must specify at least 1 metric',
            code: 'TABLE_EMPTY_METRICS'
          });
        } else if (page.metrics.length > 8) {
          errors.push({
            pageIndex: index,
            error: `Table page can have at most 8 metrics (found ${page.metrics.length})`,
            code: 'TABLE_METRICS_LIMIT'
          });
        }
        if (page.limit !== undefined && (typeof page.limit !== 'number' || page.limit < 1 || page.limit > 25)) {
          errors.push({
            pageIndex: index,
            error: `Table limit must be between 1 and 25 (found ${page.limit})`,
            code: 'INVALID_TABLE_LIMIT'
          });
        }
        break;
      }

      case 'breakdown': {
        if (!ALLOWED_BREAKDOWN_DIMENSIONS.includes(page.dimension)) {
          errors.push({
            pageIndex: index,
            error: `Invalid breakdown dimension '${page.dimension}'`,
            code: 'INVALID_BREAKDOWN_DIMENSION'
          });
        }
        if (!Array.isArray(page.metrics) || page.metrics.length === 0) {
          errors.push({
            pageIndex: index,
            error: 'Breakdown page must specify at least 1 metric',
            code: 'BREAKDOWN_EMPTY_METRICS'
          });
        } else if (page.metrics.length > 2) {
          errors.push({
            pageIndex: index,
            error: `Breakdown page can have at most 2 metrics (found ${page.metrics.length})`,
            code: 'BREAKDOWN_METRICS_LIMIT'
          });
        }
        break;
      }

      case 'creatives': {
        if (page.limit !== undefined && (typeof page.limit !== 'number' || page.limit < 1 || page.limit > 9)) {
          errors.push({
            pageIndex: index,
            error: `Creatives limit must be between 1 and 9 (found ${page.limit})`,
            code: 'INVALID_CREATIVES_LIMIT'
          });
        }
        break;
      }

      case 'ai_insight': {
        aiPageCount++;
        if (aiPageCount > MAX_AI_PAGES) {
          errors.push({
            pageIndex: index,
            error: `Template can have at most ${MAX_AI_PAGES} AI Insight pages`,
            code: 'AI_PAGES_LIMIT'
          });
        }
        break;
      }

      case 'custom_text': {
        if (typeof page.text === 'string' && page.text.length > 1500) {
          errors.push({
            pageIndex: index,
            error: `Custom text cannot exceed 1500 characters (found ${page.text.length})`,
            code: 'TEXT_LENGTH_EXCEEDED'
          });
        }
        break;
      }

      case 'custom_image': {
        if (!page.imageUrl && !page.imagePath) {
          errors.push({
            pageIndex: index,
            error: 'Custom image page must have an imageUrl or imagePath',
            code: 'MISSING_IMAGE'
          });
        }
        break;
      }
    }
  });

  return {
    valid: errors.length === 0,
    errors
  };
}

/**
 * Hitung estimasi kredit untuk pembuatan laporan (sesuai §3.8).
 * - Dasar: 300 kredit (semua halaman data, s.d. 3 akun iklan)
 * - Extra account: 50 per akun di atas 3
 * - AI page: 50 per halaman ai_insight
 * - Rerun: 100 kredit (generate ulang periode yang sama dlm 7 hari)
 */
export function calculateCredits({ accountsCount = 1, aiPagesCount = 1, isRerun = false } = {}) {
  if (isRerun) {
    return 100;
  }
  const base = 300;
  const safeAccounts = Math.max(1, Number(accountsCount) || 1);
  const extraAccounts = Math.max(0, safeAccounts - 3) * 50;
  const safeAiPages = Math.max(0, Number(aiPagesCount) || 0);
  const aiCost = safeAiPages * 50;

  return base + extraAccounts + aiCost;
}

/**
 * Hitung jumlah halaman AI Insight dalam suatu template spec.
 */
export function countAiPages(spec) {
  if (!spec || !Array.isArray(spec.pages)) return 0;
  return spec.pages.filter((p) => p && p.type === 'ai_insight').length;
}
