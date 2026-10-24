// backend/lib/ads-scheduler.js
// Logika eksekusi cron pengiriman laporan bulanan terjadwal & notifikasi email (PRD F5 Langkah 6)

import { db } from '../db.js';
import { hasActiveModuleEntitlement } from './entitlements.js';
import { triggerAdsReportGenerate } from './ads-runner.js';
import { sendMail, normalizeLocale } from './mailer.js';

const log = (msg) => console.log(`[${new Date().toISOString()}] ${msg}`);

/**
 * Hitung rentang tanggal bulan sebelumnya (YYYY-MM-DD).
 */
export function getPreviousMonthRange(now = new Date()) {
  const d = now instanceof Date ? now : new Date(now);
  const year = d.getFullYear();
  const month = d.getMonth(); // 0-indexed (0 = Jan)

  const firstDayPrev = new Date(year, month - 1, 1);
  const lastDayPrev = new Date(year, month, 0);

  const pad = (n) => String(n).padStart(2, '0');
  const periodStart = `${firstDayPrev.getFullYear()}-${pad(firstDayPrev.getMonth() + 1)}-01`;
  const periodEnd = `${lastDayPrev.getFullYear()}-${pad(lastDayPrev.getMonth() + 1)}-${pad(lastDayPrev.getDate())}`;

  return { periodStart, periodEnd };
}

/**
 * Hitung tanggal 1 bulan berikutnya pukul 07:00 WIB (00:00 UTC).
 */
export function getNextMonthlyRunDate(now = new Date()) {
  const d = now instanceof Date ? now : new Date(now);
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + 1, 1, 0, 0, 0)).toISOString();
}

/**
 * Kirim email laporan iklan ke pemangku kepentingan klien.
 */
export async function sendAdsReportEmail({
  to,
  report,
  profileName,
  locale = 'id',
  pdfBuffer = null,
  pdfFilename = null
}) {
  if (!to) return { success: false, error: 'Recipient is required' };

  const lang = normalizeLocale(locale);
  const isEn = lang === 'en';

  const name = profileName || (isEn ? 'Monthly Report' : 'Laporan Bulanan');
  const subject = isEn
    ? `Monthly Ads Report: ${name} (${report.period_start} to ${report.period_end})`
    : `Laporan Iklan Bulanan: ${name} (${report.period_start} s.d. ${report.period_end})`;

  const periodText = isEn
    ? `Reporting Period: <strong>${report.period_start}</strong> to <strong>${report.period_end}</strong>`
    : `Periode Laporan: <strong>${report.period_start}</strong> s.d. <strong>${report.period_end}</strong>`;

  const summarySection = report.summary
    ? `
      <div style="background-color: #f8fafc; border-left: 4px solid #2563eb; padding: 12px 16px; margin: 16px 0; border-radius: 4px;">
        <p style="margin: 0; font-size: 14px; color: #334155; line-height: 1.5;">
          ${report.summary.replace(/\n/g, '<br/>')}
        </p>
      </div>
    `
    : '';

  const slidesPrompt = isEn
    ? 'Your presentation deck has been generated on Google Slides. You can view, present, or export it anytime:'
    : 'Slide presentasi laporan Anda telah berhasil dibuat di Google Slides. Anda dapat melihat, mempresentasikan, atau mengekspornya kapan saja:';

  const downloadPrompt = report.pdf_path
    ? `<p style="margin-top: 12px; font-size: 13px; color: #64748b;">
        ${isEn ? 'PDF download link:' : 'Tautan unduh PDF:'} <a href="${report.pdf_path}" style="color: #2563eb;">${report.pdf_path}</a>
      </p>`
    : '';

  const html = `
    <p style="font-size: 15px; color: #1e293b; margin-bottom: 8px;">
      ${isEn ? 'Hello,' : 'Halo,'}
    </p>
    <p style="font-size: 14px; color: #475569; margin-bottom: 12px;">
      ${periodText}
    </p>
    ${summarySection}
    <p style="font-size: 14px; color: #475569; margin: 16px 0;">
      ${slidesPrompt}
    </p>
    ${downloadPrompt}
  `;

  // Attach PDF jika buffer tersedia dan <= 10 MB
  const attachments = [];
  if (pdfBuffer && pdfBuffer.length <= 10 * 1024 * 1024) {
    attachments.push({
      filename: pdfFilename || `Laporan-Iklan-${report.period_start}-${report.period_end}.pdf`,
      content: pdfBuffer.toString('base64')
    });
  }

  return await sendMail({
    to,
    subject,
    html,
    actionUrl: report.slides_url || undefined,
    actionText: isEn ? 'Open Google Slides Deck' : 'Buka Slide Google Slides',
    locale: lang,
    tag: 'ads_report',
    attachments: attachments.length > 0 ? attachments : undefined
  });
}

/**
 * Dispatch notifikasi email ke seluruh recipients profil saat laporan selesai.
 */
export async function dispatchReportEmails(report) {
  if (!report || report.status !== 'ready') return { dispatched: 0 };

  let recipients = [];
  let profileName = 'Markimate Ads Report';

  if (report.profile_id) {
    const profile = await db.findOne('report_profiles', { id: report.profile_id });
    if (profile) {
      profileName = profile.name;
      if (Array.isArray(profile.recipients)) {
        recipients = profile.recipients.filter(Boolean);
      }
    }
  }

  if (recipients.length === 0) {
    return { dispatched: 0 };
  }

  let successCount = 0;
  for (const email of recipients) {
    try {
      await sendAdsReportEmail({
        to: email,
        report,
        profileName,
        locale: 'id'
      });
      successCount++;
    } catch (err) {
      log(`[AdsScheduler] Gagal kirim email laporan ke ${email}: ${err.message}`);
    }
  }

  return { dispatched: successCount, total: recipients.length };
}

/**
 * Memproses seluruh profil laporan yang memiliki jadwal `monthly` dan sudah jatuh tempo.
 * Dijalankan secara otomatis oleh cron harian Vercel.
 */
export async function processScheduledAdsReports(now = new Date(), { fetchFn = fetch } = {}) {
  const nowIso = now instanceof Date ? now.toISOString() : new Date(now).toISOString();
  const allProfiles = await db.findMany('report_profiles', {});

  // Ambil profil yang dijadwalkan bulanan dan next_run_at <= nowIso
  const dueProfiles = allProfiles.filter(
    (p) => p.schedule === 'monthly' && p.next_run_at && p.next_run_at <= nowIso
  );

  const results = [];
  const { periodStart, periodEnd } = getPreviousMonthRange(now);

  for (const prof of dueProfiles) {
    try {
      // 1. Cek aktivasi modul ads_report pada workspace
      const hasAdsModule = await hasActiveModuleEntitlement(prof.workspace_id, 'ads_report');
      if (!hasAdsModule) {
        results.push({ profileId: prof.id, skipped: 'module_not_entitled' });
        continue;
      }

      // 2. Trigger pembuatan laporan
      const triggerRes = await triggerAdsReportGenerate({
        workspaceId: prof.workspace_id,
        userId: prof.created_by,
        profileId: prof.id,
        periodStart,
        periodEnd,
        fetchFn
      });

      // 3. Majukan jadwal eksekusi berikutnya ke tanggal 1 bulan depan
      const nextRunAt = getNextMonthlyRunDate(now);
      await db.update('report_profiles', { id: prof.id }, {
        next_run_at: nextRunAt,
        updated_at: new Date().toISOString()
      });

      if (triggerRes.ok) {
        results.push({
          profileId: prof.id,
          status: 'triggered',
          reportId: triggerRes.reportId,
          requestId: triggerRes.requestId,
          creditsCharged: triggerRes.creditsCharged,
          nextRunAt
        });
      } else {
        results.push({
          profileId: prof.id,
          status: 'failed',
          code: triggerRes.code,
          error: triggerRes.message,
          nextRunAt
        });
      }
    } catch (e) {
      log(`[AdsScheduler] Error memproses profil ${prof.id}: ${e.message}`);
      results.push({ profileId: prof.id, error: e.message });
    }
  }

  return { ran: results.length, results };
}
