import { randomUUID } from 'crypto';
import { db } from '../db.js';
import { PLANS } from './plans.js';
import { TRIAL_CONFIG, SYSTEM_WORKSPACE_ID } from './config.js';

import { sendMail } from './mailer.js';

const log = (msg) => console.log(`[${new Date().toISOString()}] ${msg}`);

let customSendEmailHandler = null;

export function setSendEmailHandler(fn) {
  customSendEmailHandler = fn;
}

/**
 * Mengirim email notifikasi (menggunakan modul mailer bersama)
 */
export async function sendEmail({ to, subject, text, html, tag = 'general', metadata = {} }) {
  if (customSendEmailHandler) {
    return await customSendEmailHandler({ to, subject, text, html, tag, metadata });
  }
  return await sendMail({ to, subject, text, html, tag });
}

export async function hasAlertBeenSent(workspaceId, alertType, periodKey = null) {
  const isSystem = (workspaceId === 'system' || workspaceId === SYSTEM_WORKSPACE_ID || !workspaceId);
  const wsId = isSystem ? SYSTEM_WORKSPACE_ID : workspaceId;
  const query = { workspace_id: wsId, alert_type: alertType };
  if (periodKey) query.period_key = periodKey;
  const existing = await db.findOne('credit_alerts', query);
  return Boolean(existing);
}

export async function recordAlertSent(workspaceId, alertType, sentTo, periodKey = null, metadata = {}) {
  const isSystem = (workspaceId === 'system' || workspaceId === SYSTEM_WORKSPACE_ID || !workspaceId);
  const wsId = isSystem ? SYSTEM_WORKSPACE_ID : workspaceId;
  const payloadMeta = isSystem
    ? { scope: 'system', ...metadata }
    : metadata;
  return await db.insert('credit_alerts', {
    id: randomUUID(),
    workspace_id: wsId,
    alert_type: alertType,
    sent_to: sentTo,
    period_key: periodKey,
    metadata: payloadMeta,
    created_at: new Date().toISOString()
  });
}

/**
 * Memeriksa seluruh dompet untuk mengirimkan email peringatan harian:
 * 1. Peringatan saldo <= 20% (sekali per periode)
 * 2. Peringatan masa trial H-2 dan H-0 (sekali per masa trial)
 */
export async function processDailyCreditAlerts() {
  const wallets = await db.findMany('credit_wallets', {});
  const alertsSent = [];

  for (const w of wallets || []) {
    const user = await db.findOne('accounts', { id: w.workspace_id });
    if (!user || !user.email) continue;

    const email = user.email;
    const now = Date.now();

    // 1. Peringatan Trial H-2 & H-0
    if (w.trial_expires_at) {
      const expTime = new Date(w.trial_expires_at).getTime();
      const msLeft = expTime - now;
      const hoursLeft = msLeft / (1000 * 3600);
      const trialPeriodKey = String(w.trial_expires_at);

      // Trial H-2: Sisa waktu <= 48 jam dan masih aktif (> 0)
      if (hoursLeft > 0 && hoursLeft <= 48) {
        const alreadySent = await hasAlertBeenSent(w.workspace_id, 'trial_h2', trialPeriodKey);
        if (!alreadySent) {
          const daysText = Math.ceil(hoursLeft / 24);
          await sendEmail({
            to: email,
            subject: `[Markimate] Free Trial Anda berakhir dalam ${daysText} hari`,
            text: `Halo ${user.brand_name || 'Pelanggan'},\n\nMasa Free Trial ${TRIAL_CONFIG.days} hari Markimate Anda akan berakhir dalam ${daysText} hari (saldo trial saat ini: ${w.balance_trial} credit).\n\nSegera pilih paket langganan untuk memastikan automasi konten dan publikasi artikel Anda tetap berjalan lancar.\n\nSalam,\nTim Markimate`,
            tag: 'trial_h2'
          });
          await recordAlertSent(w.workspace_id, 'trial_h2', email, trialPeriodKey, { hoursLeft });
          alertsSent.push({ workspaceId: w.workspace_id, email, type: 'trial_h2' });
        }
      }

      // Trial H-0: Masa trial telah habis
      if (hoursLeft <= 0) {
        const alreadySent = await hasAlertBeenSent(w.workspace_id, 'trial_h0', trialPeriodKey);
        if (!alreadySent) {
          await sendEmail({
            to: email,
            subject: `[Markimate] Masa Free Trial Anda telah berakhir`,
            text: `Halo ${user.brand_name || 'Pelanggan'},\n\nMasa Free Trial ${TRIAL_CONFIG.days} hari Markimate Anda telah berakhir dan saldo trial telah dinolkan.\n\nData dan pengaturan CMS Anda tetap tersimpan selama 30 hari. Aktifkan paket langganan sekarang untuk melanjutkan automasi.\n\nSalam,\nTim Markimate`,
            tag: 'trial_h0'
          });
          await recordAlertSent(w.workspace_id, 'trial_h0', email, trialPeriodKey, { expiredAt: w.trial_expires_at });
          alertsSent.push({ workspaceId: w.workspace_id, email, type: 'trial_h0' });
        }
      }
    }

    // 2. Peringatan Saldo <= 20% (PRD §4.3: sekali per periode)
    const userPlan = user.plan || 'free';
    const planCredits = PLANS[userPlan]?.credits || 0;
    const baseAllocation = planCredits > 0 ? planCredits : TRIAL_CONFIG.credits;

    if (baseAllocation > 0) {
      const threshold = Math.floor(baseAllocation * 0.2);
      const totalBalance = (Number(w.balance_trial) || 0) + (Number(w.balance_sub) || 0) + (Number(w.balance_topup) || 0);

      if (totalBalance > 0 && totalBalance <= threshold) {
        const periodKey = w.sub_expires_at
          ? `sub_${String(w.sub_expires_at).slice(0, 10)}`
          : (w.trial_expires_at ? `trial_${String(w.trial_expires_at).slice(0, 10)}` : 'current');

        const alreadySent = await hasAlertBeenSent(w.workspace_id, 'balance_low_20', periodKey);
        if (!alreadySent) {
          await sendEmail({
            to: email,
            subject: `[Markimate] Peringatan: Saldo credit Anda tersisa ${totalBalance} (≤ 20%)`,
            text: `Halo ${user.brand_name || 'Pelanggan'},\n\nSaldo dompet credit Markimate Anda saat ini tersisa ${totalBalance} credit (kurang dari 20% dari alokasi ${baseAllocation} credit).\n\nUntuk menghindari terhentinya pembuatan artikel, gambar, atau riset topik otomatis, silakan lakukan top-up credit atau upgrade paket di menu Billing.\n\nSalam,\nTim Markimate`,
            tag: 'balance_low_20'
          });
          await recordAlertSent(w.workspace_id, 'balance_low_20', email, periodKey, { totalBalance, baseAllocation });
          alertsSent.push({ workspaceId: w.workspace_id, email, type: 'balance_low_20', totalBalance });
        }
      }
    }
  }

  return { processedCount: (wallets || []).length, alertsSent };
}
