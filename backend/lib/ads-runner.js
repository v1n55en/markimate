// backend/lib/ads-runner.js
// Logika eksekusi trigger n8n, polling status, potongan kredit & rollback atomik (PRD F5 Langkah 5)

import crypto from 'crypto';
import { db } from '../db.js';
import { charge, grant } from './credits.js';
import { getAppUrl } from './config.js';
import { getDecryptedAccessToken } from './ads-oauth.js';
import { getTemplateById } from './ads-templates.js';
import { calculateCredits, countAiPages } from '../shared/report-template.js';

const TEN_MINUTES_MS = 10 * 60 * 1000;

export function getN8nAdsReportUrl() {
  const base = (process.env.N8N_BASE_URL || 'https://n8n.3ourasia.id').replace(/\/+$/, '');
  return (
    process.env.MARKIMATE_N8N_ADS_REPORT_URL ||
    process.env.N8N_URL_ADS_REPORT ||
    `${base}/webhook/ads-report-generate`
  );
}

export function getN8nApiKey() {
  return process.env.MARKIMATE_API_KEY || process.env.SUPERMAT_API_KEY || '';
}

/**
 * Trigger proses generate laporan iklan ke n8n dengan pemotongan kredit atomik dan rollback bila gagal.
 */
export async function triggerAdsReportGenerate({
  workspaceId,
  userId,
  profileId,
  templateId,
  accountIds = [],
  periodStart,
  periodEnd,
  compare = true,
  conversionEvent = 'purchase',
  currency = 'IDR',
  recipients = [],
  n8nUrl = null,
  n8nKey = null,
  fetchFn = fetch
}) {
  let resolvedTemplateId = templateId;
  let resolvedAccountIds = accountIds;
  let resolvedPeriodStart = periodStart;
  let resolvedPeriodEnd = periodEnd;
  let resolvedCompare = compare;
  let resolvedConversionEvent = conversionEvent;
  let resolvedCurrency = currency;
  let resolvedRecipients = recipients;

  // 1. Jika menggunakan profileId, ambil konfigurasi dari database
  if (profileId) {
    const profile = await db.findOne('report_profiles', { id: profileId, workspace_id: workspaceId });
    if (!profile) {
      return { ok: false, code: 'NOT_FOUND', message: 'Report profile not found' };
    }
    resolvedTemplateId = resolvedTemplateId || profile.template_id;
    resolvedAccountIds = resolvedAccountIds.length > 0 ? resolvedAccountIds : profile.account_ids;
    resolvedCompare = profile.compare;
    resolvedConversionEvent = profile.conversion_event || 'purchase';
    resolvedCurrency = profile.currency || 'IDR';
    resolvedRecipients = profile.recipients || [];

    // Jika periode belum ditentukan, hitung berdasarkan date_preset profile
    if (!resolvedPeriodStart || !resolvedPeriodEnd) {
      const now = new Date();
      // Default: bulan lalu (1 s.d. akhir bulan lalu)
      const firstDayPrevMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1);
      const lastDayPrevMonth = new Date(now.getFullYear(), now.getMonth(), 0);
      resolvedPeriodStart = firstDayPrevMonth.toISOString().slice(0, 10);
      resolvedPeriodEnd = lastDayPrevMonth.toISOString().slice(0, 10);
    }
  }

  // 2. Validasi input
  if (!resolvedTemplateId) {
    return { ok: false, code: 'PARAMS_REQUIRED', message: 'Template ID is required' };
  }
  if (!Array.isArray(resolvedAccountIds) || resolvedAccountIds.length === 0) {
    return { ok: false, code: 'PARAMS_REQUIRED', message: 'At least one ad account must be selected' };
  }
  if (!resolvedPeriodStart || !resolvedPeriodEnd) {
    return { ok: false, code: 'PARAMS_REQUIRED', message: 'periodStart and periodEnd are required' };
  }
  if (resolvedPeriodStart > resolvedPeriodEnd) {
    return { ok: false, code: 'BAD_REQUEST', message: 'periodStart cannot be after periodEnd' };
  }

  // 3. Ambil template
  const tpl = await getTemplateById(resolvedTemplateId, workspaceId);
  if (!tpl) {
    return { ok: false, code: 'NOT_FOUND', message: 'Report template not found' };
  }
  const spec = tpl.spec;

  // 4. Validasi akun iklan dan koneksi (IDOR & Token Validity)
  const preparedAccounts = [];
  for (const accId of resolvedAccountIds) {
    const acc = await db.findOne('ad_accounts', { id: accId, workspace_id: workspaceId });
    if (!acc) {
      return { ok: false, code: 'FORBIDDEN', message: `Ad account '${accId}' does not belong to this workspace` };
    }

    const token = await getDecryptedAccessToken(acc.connection_id, workspaceId);
    if (!token) {
      return {
        ok: false,
        code: 'ADS_RECONNECT_REQUIRED',
        message: `Connection for ad account '${acc.name}' has expired or was revoked. Please reconnect in Connections page.`
      };
    }

    preparedAccounts.push({
      id: acc.id,
      externalId: acc.external_id,
      platform: acc.platform,
      name: acc.name,
      currency: acc.currency,
      timezone: acc.timezone,
      accessToken: token
    });
  }

  // 5. Cek apakah ini rerun (dalam 7 hari dengan template, akun, dan rentang tanggal yang sama)
  const SEVEN_DAYS_AGO = new Date(Date.now() - 7 * 86400 * 1000).toISOString();
  const pastReports = await db.findMany('ad_reports', {
    workspace_id: workspaceId,
    period_start: resolvedPeriodStart,
    period_end: resolvedPeriodEnd,
    status: 'ready'
  });

  const isRerun = pastReports.some((pr) => {
    return (
      pr.finished_at >= SEVEN_DAYS_AGO &&
      (pr.profile_id === profileId || pr.template_snapshot?.name === spec?.name)
    );
  });

  // 6. Hitung kebutuhan kredit
  const aiPages = countAiPages(spec);
  const creditsRequired = calculateCredits({
    accountsCount: preparedAccounts.length,
    aiPagesCount: aiPages,
    isRerun
  });

  const reportId = crypto.randomUUID();
  const requestId = `req_ads_${crypto.randomUUID()}`;

  // 7. Potong kredit secara atomik sebelum trigger
  try {
    await charge(workspaceId, isRerun ? 'ads.report_rerun' : 'ads.report', 1, {
      type: 'ad_report',
      id: reportId,
      extra: { credits: creditsRequired },
      note: `Generate Ads Report: ${spec.name || 'Report'} (${isRerun ? 'Rerun' : 'New'})`
    });
  } catch (chargeErr) {
    if (chargeErr.code === 'INSUFFICIENT_CREDITS' || chargeErr.status === 402) {
      return {
        ok: false,
        code: 'INSUFFICIENT_CREDITS',
        status: 402,
        message: 'Kredit tidak mencukupi untuk membuat laporan iklan ini.',
        need: creditsRequired,
        have: chargeErr.have
      };
    }
    throw chargeErr;
  }

  // 8. Catat entri ad_reports berstatus queued
  const newReport = {
    id: reportId,
    workspace_id: workspaceId,
    profile_id: profileId || null,
    template_snapshot: spec,
    period_start: resolvedPeriodStart,
    period_end: resolvedPeriodEnd,
    status: 'queued',
    request_id: requestId,
    slides_url: null,
    slides_file_id: null,
    pdf_path: null,
    summary: null,
    warnings: [],
    credits_charged: creditsRequired,
    error_code: null,
    created_by: userId,
    created_at: new Date().toISOString(),
    started_at: new Date().toISOString(),
    finished_at: null,
    updated_at: new Date().toISOString()
  };
  await db.insert('ad_reports', newReport);

  // 9. Kirim webhook ke n8n
  const webhookUrl = n8nUrl || getN8nAdsReportUrl();
  const apiKey = n8nKey || getN8nApiKey();
  const callbackUrl = `${getAppUrl()}/api/ads/reports/callback`;

  const payload = {
    requestId,
    reportId,
    workspaceId,
    template: spec,
    accounts: preparedAccounts,
    period: {
      start: resolvedPeriodStart,
      end: resolvedPeriodEnd
    },
    compare: resolvedCompare,
    conversionEvent: resolvedConversionEvent,
    currency: resolvedCurrency,
    recipients: resolvedRecipients,
    callbackUrl
  };

  try {
    const triggerRes = await fetchFn(webhookUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Supermat-Key': apiKey,
        'X-Markimate-Key': apiKey
      },
      body: JSON.stringify(payload)
    });

    if (!triggerRes.ok) {
      throw new Error(`n8n webhook responded with HTTP ${triggerRes.status}`);
    }

    // Jika trigger berhasil, ubah status ke 'running'
    await db.update('ad_reports', { id: reportId }, {
      status: 'running',
      updated_at: new Date().toISOString()
    });

    return {
      ok: true,
      reportId,
      requestId,
      status: 'running',
      creditsCharged: creditsRequired,
      isRerun
    };
  } catch (triggerErr) {
    console.error('[AdsRunner] Gagal memicu webhook n8n:', triggerErr.message);

    // ROLLBACK ATOMIK: Kembalikan kredit ke wallet
    try {
      await grant(workspaceId, 'topup', creditsRequired, null, 'refund', 'Rollback trigger n8n gagal', {
        actionKey: 'ads.report_refund',
        refType: 'ad_report',
        refId: reportId
      });
    } catch (refundErr) {
      console.error('[AdsRunner] Gagal melakukan refund otomatis:', refundErr.message);
    }

    // Perbarui status laporan menjadi error
    await db.update('ad_reports', { id: reportId }, {
      status: 'error',
      error_code: 'ADS_SOURCE_UNAVAILABLE',
      finished_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    });

    return {
      ok: false,
      code: 'ADS_SOURCE_UNAVAILABLE',
      status: 502,
      message: 'Gagal menghubungi engine pembuatan laporan iklan. Kredit Anda telah dikembalikan.'
    };
  }
}

/**
 * Handle callback webhook dari n8n ketika laporan selesai / gagal.
 */
export async function handleAdsReportCallback({
  requestId,
  status,
  slidesUrl,
  slidesFileId,
  pdfPath,
  summary,
  warnings = [],
  errorCode
}) {
  if (!requestId) {
    return { ok: false, code: 'PARAMS_REQUIRED', message: 'requestId is required' };
  }

  const report = await db.findOne('ad_reports', { request_id: requestId });
  if (!report) {
    return { ok: false, code: 'NOT_FOUND', message: 'Report with given requestId not found' };
  }

  // Idempoten jika sudah selesai
  if (report.status === 'ready' || (report.status === 'error' && report.finished_at)) {
    return { ok: true, idempotent: true, status: report.status, refunded: 0 };
  }

  const now = new Date().toISOString();

  if (status === 'ready') {
    await db.update('ad_reports', { id: report.id }, {
      status: 'ready',
      slides_url: slidesUrl || report.slides_url,
      slides_file_id: slidesFileId || report.slides_file_id,
      pdf_path: pdfPath || report.pdf_path,
      summary: summary || report.summary,
      warnings: Array.isArray(warnings) ? warnings : report.warnings || [],
      error_code: null,
      finished_at: now,
      updated_at: now
    });
    const updated = await db.findOne('ad_reports', { id: report.id });
    try {
      const { dispatchReportEmails } = await import('./ads-scheduler.js');
      await dispatchReportEmails(updated);
    } catch (e) {
      console.warn('[AdsRunner] Email dispatch notice:', e.message);
    }
    return { ok: true, status: 'ready', reportId: report.id };
  }

  // Jika status error / failed dari n8n: REFUND KREDIT ATOMIK (hanya sekali & sesuai bucket asal)
  if (status === 'error' || status === 'failed') {
    const refundRes = await refundReportCreditsAtomic(
      report,
      `Refund report error: ${errorCode || 'Generation failed'}`,
      errorCode || 'ADS_REPORT_FAILED'
    );
    return { ok: true, status: 'error', reportId: report.id, refunded: refundRes.refunded, idempotent: refundRes.idempotent };
  }

  return { ok: true, status: report.status, reportId: report.id };
}

/**
 * Refund kredit laporan secara atomik, idempoten (berdasarkan claim refunded_at),
 * dan mengembalikan ke bucket yang sama persis (trial vs purchased/topup).
 */
export async function refundReportCreditsAtomic(report, reason, errorCode) {
  const now = new Date().toISOString();

  // 1. Claim refund atomik: update ad_reports set refunded_at = now() where id = $1 and refunded_at is null
  const claimed = await db.claim('ad_reports', report.id, {
    refunded_at: now,
    status: 'error',
    error_code: errorCode || 'ADS_REPORT_FAILED',
    finished_at: now,
    updated_at: now
  }, 'refunded_at');

  if (!claimed) {
    // Rowcount == 0: sudah pernah di-refund sebelumnya (idempoten, cegah race condition)
    return { refunded: 0, idempotent: true };
  }

  // 2. Kembalikan ke bucket yang sama: periksa credit_ledger entri pemotongan laporan ini
  const deductionRows = await db.findMany('credit_ledger', {
    workspace_id: report.workspace_id,
    ref_type: 'ad_report',
    ref_id: String(report.id),
    kind: 'usage'
  });

  let totalRefunded = 0;
  if (deductionRows && deductionRows.length > 0) {
    for (const row of deductionRows) {
      const amt = Math.abs(Number(row.delta || 0));
      const bucket = ['trial', 'sub', 'topup'].includes(row.bucket) ? row.bucket : 'topup';
      if (amt > 0) {
        try {
          await grant(report.workspace_id, bucket, amt, null, 'refund', reason, {
            actionKey: 'ads.report_refund',
            refType: 'ad_report',
            refId: report.id
          });
          totalRefunded += amt;
        } catch (err) {
          console.error('[AdsRunner] Gagal grant refund per bucket:', err.message);
        }
      }
    }
  } else {
    // Fallback jika tidak ada ledger rows
    const charged = Number(report.credits_charged || 0);
    if (charged > 0) {
      try {
        await grant(report.workspace_id, 'topup', charged, null, 'refund', reason, {
          actionKey: 'ads.report_refund',
          refType: 'ad_report',
          refId: report.id
        });
        totalRefunded = charged;
      } catch (err) {
        console.error('[AdsRunner] Gagal grant fallback refund:', err.message);
      }
    }
  }

  return { refunded: totalRefunded, idempotent: false };
}

/**
 * Ambil status laporan dengan deteksi timeout 10 menit (otomatis refund bila timeout).
 */
export async function getReportStatus(reportId, workspaceId) {
  const report = await db.findOne('ad_reports', { id: reportId, workspace_id: workspaceId });
  if (!report) {
    return null;
  }

  // Cek apakah laporan running melebihi 10 menit (600 detik)
  if (report.status === 'running' || report.status === 'queued') {
    const startedAtMs = Date.parse(report.started_at || report.created_at);
    if (!isNaN(startedAtMs) && Date.now() - startedAtMs > TEN_MINUTES_MS) {
      await refundReportCreditsAtomic(
        report,
        'Refund ads report generation timeout (10m)',
        'ADS_REPORT_TIMEOUT'
      );
      const updated = await db.findOne('ad_reports', { id: report.id });
    }
  }

  return report;
}
