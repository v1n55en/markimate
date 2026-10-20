import crypto from 'crypto';
import { db } from '../../db.js';
import { TOPUP_PACKAGES, PLANS } from '../catalog.js';
import { grant } from '../credits.js';
import {
  sendTopupSuccessEmail,
  sendSubscriptionSuccessEmail
} from '../mailer.js';
import { getProvider } from './index.js';

/**
 * Menghasilkan nomor invoice unik sesuai spesifikasi PRD F14 §3:
 * Format: MKM-{T|S}-{YYMMDD}-{6 karakter acak}
 * @param {'topup'|'subscription'} kind
 */
export function generateInvoiceNumber(kind) {
  const prefix = kind === 'topup' ? 'T' : 'S';
  const now = new Date();
  const yy = String(now.getUTCFullYear()).slice(-2);
  const mm = String(now.getUTCMonth() + 1).padStart(2, '0');
  const dd = String(now.getUTCDate()).padStart(2, '0');
  const datePart = `${yy}${mm}${dd}`;
  const randomPart = crypto.randomBytes(4).toString('hex').slice(0, 6).toUpperCase();
  return `MKM-${prefix}-${datePart}-${randomPart}`;
}

/**
 * Membuat transaksi checkout pembayaran
 * @param {Object} params
 * @param {'topup'|'subscription'} params.kind
 * @param {string} params.itemId
 * @param {string} params.workspaceId
 * @param {string} params.userId
 * @param {string} params.callbackUrl
 */
export async function createCheckout({ kind, itemId, workspaceId, userId, callbackUrl }) {
  if (!['topup', 'subscription'].includes(kind)) {
    throw Object.assign(new Error(`Invalid payment kind '${kind}'. Must be 'topup' or 'subscription'.`), {
      status: 400,
      code: 'INVALID_PAYMENT_KIND'
    });
  }

  let itemName = '';
  let amount = 0;
  let credits = 0;
  let periodDays = 30;

  if (kind === 'topup') {
    const pack = TOPUP_PACKAGES[itemId];
    if (!pack) {
      throw Object.assign(new Error(`Invalid top-up package '${itemId}'. Choose starter, growth, or scale.`), {
        status: 400,
        code: 'INVALID_PACKAGE'
      });
    }
    itemName = pack.name;
    amount = pack.price;
    credits = pack.credits;
    periodDays = pack.periodDays || 365;
  } else {
    const plan = PLANS[itemId];
    if (!plan || itemId === 'free') {
      throw Object.assign(new Error(`Invalid subscription plan '${itemId}'. Choose an active paid plan.`), {
        status: 400,
        code: 'INVALID_PLAN'
      });
    }
    itemName = plan.name;
    amount = plan.price;
    credits = plan.credits;
    periodDays = 30;
  }

  const workspace = await db.findOne('workspaces', { id: workspaceId });
  if (!workspace) {
    throw Object.assign(new Error('Workspace not found.'), { status: 404, code: 'WORKSPACE_NOT_FOUND' });
  }

  const user = userId ? await db.findOne('accounts', { id: userId }) : null;
  const invoiceNumber = generateInvoiceNumber(kind);
  const provider = getProvider();
  const providerName = (process.env.PAYMENT_PROVIDER || 'doku').toLowerCase();
  const expiryMinutes = Number(process.env.PAYMENT_EXPIRY_MINUTES || 60);

  // Buat record pembayaran di tabel payments
  const payment = await db.insert('payments', {
    workspace_id: workspaceId,
    user_id: userId || null,
    kind,
    item_id: itemId,
    item_name: itemName,
    amount,
    currency: 'IDR',
    credits,
    period_days: periodDays,
    provider: providerName,
    invoice_number: invoiceNumber,
    status: 'pending',
    fulfilled_at: null,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString()
  });

  const appBaseUrl = process.env.APP_URL || 'https://app.markimate.com';
  const appCallbackUrl = `${appBaseUrl}/app/billing/return?invoice=${invoiceNumber}`;

  let checkoutResult;
  try {
    checkoutResult = await provider.createCheckout({
      invoiceNumber,
      amount,
      customer: {
        name: user?.name || workspace.name || 'Markimate Customer',
        email: user?.email || 'customer@markimate.com',
        phone: ''
      },
      items: [{
        id: itemId,
        name: itemName,
        price: amount,
        quantity: 1
      }],
      callbackUrl: appCallbackUrl,
      expiryMinutes
    });
  } catch (err) {
    // PRD F14 Poin 10: Tandai failed dan isi expires_at agar reconcile tidak polling selamanya
    const nowIso = new Date().toISOString();
    await db.update('payments', { id: payment.id }, {
      status: 'failed',
      expires_at: nowIso,
      raw: { error: err.message },
      updated_at: nowIso
    });
    throw err;
  }

  await db.update('payments', { id: payment.id }, {
    checkout_url: checkoutResult.checkoutUrl,
    provider_ref: checkoutResult.providerRef,
    expires_at: checkoutResult.expiresAt,
    raw: checkoutResult.raw || null,
    updated_at: new Date().toISOString()
  });

  return {
    paymentId: payment.id,
    invoiceNumber,
    checkoutUrl: checkoutResult.checkoutUrl,
    expiresAt: checkoutResult.expiresAt,
    amount,
    currency: 'IDR'
  };
}

/**
 * Memberikan reward / mengaktifkan entitlement paket secara idempoten
 * @param {Object} payment
 * @param {Object} parsed
 */
export async function fulfillPayment(payment, parsed = {}) {
  // PRD F14 Poin 5: Fulfillment harus atomik. Gunakan update bersyarat (where id = ? and fulfilled_at is null)
  // dan hanya berikan kredit kalau baris itu benar-benar ter-update.
  const fulfilledAt = new Date().toISOString();
  const claimed = typeof db.claim === 'function'
    ? await db.claim('payments', payment.id, {
        fulfilled_at: fulfilledAt,
        status: 'paid',
        updated_at: fulfilledAt
      })
    : await db.update('payments', {
        id: payment.id,
        fulfilled_at: null
      }, {
        fulfilled_at: fulfilledAt,
        status: 'paid',
        updated_at: fulfilledAt
      });

  if (!claimed) {
    return { fulfilled: false, reason: 'already_fulfilled' };
  }

  const now = new Date();
  const user = payment.user_id ? await db.findOne('accounts', { id: payment.user_id }) : null;
  const userLocale = user?.locale || 'id';

  if (payment.kind === 'topup') {
    // 1. Tambah credit ke bucket topup dengan masa berlaku 365 hari
    const validityDays = payment.period_days || 365;
    const expiresAt = new Date(now.getTime() + validityDays * 86400e3);

    await grant(
      payment.workspace_id,
      'topup',
      payment.credits,
      expiresAt,
      'topup',
      `Top-up credit via ${payment.provider.toUpperCase()} (${payment.invoice_number})`,
      {
        actionKey: 'billing.topup',
        refType: 'payment',
        refId: payment.id,
        invoiceNumber: payment.invoice_number,
        provider: payment.provider,
        method: parsed.method || payment.method
      }
    );

    // 2. Kirim email notifikasi top-up berhasil
    if (user?.email) {
      sendTopupSuccessEmail({
        to: user.email,
        invoiceNumber: payment.invoice_number,
        packageName: payment.item_name,
        credits: payment.credits,
        amount: payment.amount,
        locale: userLocale
      }).catch(err => console.error('[MAIL] Failed to send topup success email:', err.message));
    }
  } else if (payment.kind === 'subscription') {
    const planKey = payment.item_id;
    const planData = PLANS[planKey];
    const durationDays = payment.period_days || 30;

    // Periksa apakah sudah ada langganan aktif untuk memperpanjang
    const existingSubs = await db.findMany('subscriptions', {
      workspace_id: payment.workspace_id,
      status: 'active'
    });

    let baseTime = now.getTime();
    for (const s of existingSubs) {
      if (s.ends_at && new Date(s.ends_at).getTime() > baseTime) {
        baseTime = new Date(s.ends_at).getTime();
      }
    }
    const endsAt = new Date(baseTime + durationDays * 86400e3);

    // 1. Buat record subscription
    const sub = await db.insert('subscriptions', {
      user_id: payment.user_id,
      workspace_id: payment.workspace_id,
      plan: planKey,
      status: 'active',
      method: parsed.method || payment.method || payment.provider,
      amount: payment.amount,
      invoice_no: payment.invoice_number,
      started_at: now.toISOString(),
      ends_at: endsAt.toISOString(),
      dummy: false
    });

    if (user) {
      await db.update('accounts', { id: user.id }, { plan: planKey });
    }

    // 2. Aktifkan module_entitlements paket dengan source: 'subscription'
    const targetModules = planData?.modules || ['seo'];
    for (const mod of targetModules) {
      const existingEnt = await db.findOne('module_entitlements', {
        workspace_id: payment.workspace_id,
        module: mod
      });
      if (existingEnt) {
        await db.update('module_entitlements', { workspace_id: payment.workspace_id, module: mod }, {
          active: true,
          source: 'subscription',
          starts_at: now.toISOString(),
          ends_at: endsAt.toISOString()
        });
      } else {
        await db.insert('module_entitlements', {
          workspace_id: payment.workspace_id,
          module: mod,
          active: true,
          source: 'subscription',
          starts_at: now.toISOString(),
          ends_at: endsAt.toISOString()
        });
      }
    }

    // 3. Berikan credit paket subscription (reset/isi kuota bulanan)
    const credits = (planData?.credits || payment.credits || 0);
    if (process.env.CREDITS_ENABLED !== 'false' && credits > 0) {
      await grant(
        payment.workspace_id,
        'sub',
        credits,
        endsAt,
        'grant_sub',
        `Aktivasi paket ${payment.item_name} via ${payment.provider.toUpperCase()} (${payment.invoice_number})`,
        {
          actionKey: 'billing.sub',
          refType: 'subscription',
          refId: sub.id,
          invoiceNumber: payment.invoice_number
        }
      );
    }

    // 4. Kirim email notifikasi aktivasi langganan berhasil
    if (user?.email) {
      sendSubscriptionSuccessEmail({
        to: user.email,
        invoiceNumber: payment.invoice_number,
        planName: payment.item_name,
        periodDays: durationDays,
        amount: payment.amount,
        endsAt: endsAt.toISOString(),
        locale: userLocale
      }).catch(err => console.error('[MAIL] Failed to send subscription success email:', err.message));
    }
  }

  return { fulfilled: true, fulfilledAt };
}

/**
 * Menangani notifikasi webhook masuk dari provider pembayaran
 * @param {string} providerName
 * @param {import('express').Request} req
 */
export async function handleNotification(providerName, req) {
  const provider = getProvider(providerName);

  // 1. Verifikasi signature notifikasi
  const isValid = await provider.verifyNotification(req);
  if (!isValid) {
    const err = new Error('Invalid webhook signature');
    err.status = 401;
    err.code = 'INVALID_SIGNATURE';
    throw err;
  }

  // 2. Parse payload notifikasi
  const parsed = provider.parseNotification(req.body);
  const { invoiceNumber, amount, status, paidAt, method, raw } = parsed;

  if (!invoiceNumber) {
    return { status: 'ignored', reason: 'missing_invoice_number' };
  }

  // 3. Ambil data payment terkait
  const payment = await db.findOne('payments', { invoice_number: invoiceNumber });
  if (!payment) {
    return { status: 'ignored', reason: 'payment_not_found', invoiceNumber };
  }

  // PRD F14 Poin 6: Cocokkan nominal order.amount dengan amount di database
  if (amount && Number(payment.amount) !== Number(amount)) {
    console.error(`[PAYMENT-MISMATCH] Invoice ${invoiceNumber}: DB amount ${payment.amount} !== Notif amount ${amount}`);
    return { status: 'ignored', reason: 'amount_mismatch', invoiceNumber };
  }

  // 4. Catat webhook event untuk mencegah duplicate delivery (Idempotensi)
  const eventKey = `${invoiceNumber}_${status}`;
  const existingEvent = await db.findOne('webhook_events', { source: providerName, event_id: eventKey });
  if (existingEvent) {
    return { status: 'already_processed', invoiceNumber };
  }

  const nowIso = new Date().toISOString();

  // 5. Update status pembayaran & berikan fulfillment jika 'paid'
  if (status === 'paid') {
    await fulfillPayment(payment, parsed);
    await db.update('payments', { id: payment.id }, {
      status: 'paid',
      provider_status: raw?.transaction?.status || 'SUCCESS',
      method: method || payment.method,
      paid_at: paidAt || nowIso,
      updated_at: nowIso
    });
  } else if (['expired', 'refunded'].includes(status)) {
    // PRD F14 Poin 8: FAILED bukan status final untuk Checkout, hanya expired/refunded yang final
    await db.update('payments', { id: payment.id }, {
      status,
      provider_status: raw?.transaction?.status || status.toUpperCase(),
      updated_at: nowIso
    });
  }

  // PRD F14 Poin 9: Event webhook dicatat SETELAH fulfill berhasil dilakukan
  await db.insert('webhook_events', {
    source: providerName,
    event_id: eventKey,
    signature_ok: true,
    payload: raw || {},
    processed_at: new Date().toISOString(),
    created_at: new Date().toISOString()
  });

  return { status: 'ok', invoiceNumber, paymentStatus: status };
}

/**
 * Rekonsiliasi pembayaran 'pending' yang belum terselesaikan
 */
export async function reconcile() {
  const pendingPayments = await db.findMany('payments', { status: 'pending' });
  const results = { checked: 0, fulfilled: 0, expired: 0, failed: 0, unchanged: 0 };
  const now = Date.now();

  for (const payment of pendingPayments) {
    results.checked++;
    const createdAt = new Date(payment.created_at || now).getTime();
    // Hanya periksa yang umurnya lebih dari 2 menit
    if (now - createdAt < 2 * 60 * 1000) {
      results.unchanged++;
      continue;
    }

    // Query status langsung ke provider DOKU DULU sebelum memutuskan expired (PRD F14 Poin 7)
    try {
      const provider = getProvider(payment.provider);
      const statusRes = await provider.getStatus(payment.invoice_number);

      if (statusRes.status === 'paid' && !payment.fulfilled_at) {
        const fulfillRes = await fulfillPayment(payment, statusRes);
        if (fulfillRes.fulfilled) {
          await db.update('payments', { id: payment.id }, {
            status: 'paid',
            provider_status: statusRes.raw?.transaction?.status || 'SUCCESS',
            method: statusRes.method || payment.method,
            paid_at: statusRes.paidAt || new Date().toISOString(),
            updated_at: new Date().toISOString()
          });
          results.fulfilled++;
        } else {
          results.unchanged++;
        }
      } else if (statusRes.status === 'expired' || statusRes.status === 'refunded') {
        // PRD F14 Poin 8: Hanya status final resmi
        await db.update('payments', { id: payment.id }, {
          status: statusRes.status,
          updated_at: new Date().toISOString()
        });
        if (statusRes.status === 'expired') results.expired++;
      } else if (payment.expires_at && new Date(payment.expires_at).getTime() <= now) {
        // Jika dari DOKU belum paid dan sudah lewat expires_at, barulah tandai expired
        await db.update('payments', { id: payment.id }, {
          status: 'expired',
          updated_at: new Date().toISOString()
        });
        results.expired++;
      } else {
        results.unchanged++;
      }
    } catch (err) {
      console.error(`[RECONCILE] Error checking status for ${payment.invoice_number}:`, err.message);
      results.unchanged++;
    }
  }

  return results;
}

/**
 * Memeriksa langganan aktif yang akan berakhir dalam 7 hari (H-7) atau 1 hari (H-1)
 * dan mengirim email pengingat perpanjangan secara idempoten (PRD F14 Poin 16)
 */
export async function processSubscriptionRenewalReminders() {
  const activeSubs = await db.findMany('subscriptions', { status: 'active' });
  const now = new Date();
  const summary = { checked: 0, sentH7: 0, sentH1: 0, skipped: 0 };

  for (const sub of activeSubs) {
    if (!sub.ends_at) continue;
    summary.checked++;
    const endsAt = new Date(sub.ends_at);
    const diffMs = endsAt.getTime() - now.getTime();
    const daysRemaining = Math.ceil(diffMs / (1000 * 60 * 60 * 24));

    if (daysRemaining === 7 || daysRemaining === 1) {
      const tag = `sub_renew_reminder_h${daysRemaining}_${sub.id}_${sub.ends_at.slice(0, 10)}`;
      // Cek apakah pengingat untuk tanggal berakhir ini sudah pernah dikirim
      const existingAlert = await db.findOne('credit_alerts', {
        workspace_id: sub.workspace_id,
        alert_type: 'subscription_renewal',
        period_key: tag
      });
      if (existingAlert) {
        summary.skipped++;
        continue;
      }

      // Ambil user dan workspace
      const user = await db.findOne('accounts', { id: sub.user_id });
      if (!user || !user.email) {
        summary.skipped++;
        continue;
      }

      const planName = sub.plan ? sub.plan.toUpperCase() : 'Markimate Subscription';
      const renewUrl = `${process.env.APP_URL || 'https://app.markimate.com'}/app/billing`;

      try {
        const { sendSubscriptionRenewalReminderEmail } = await import('../mailer.js');
        await sendSubscriptionRenewalReminderEmail({
          to: user.email,
          planName,
          endsAt: sub.ends_at,
          daysRemaining,
          renewUrl,
          locale: user.locale || 'id'
        });

        await db.insert('credit_alerts', {
          workspace_id: sub.workspace_id,
          alert_type: 'subscription_renewal',
          sent_to: user.email,
          period_key: tag,
          metadata: { daysRemaining, planName, endsAt: sub.ends_at },
          created_at: new Date().toISOString()
        });

        if (daysRemaining === 7) summary.sentH7++;
        if (daysRemaining === 1) summary.sentH1++;
      } catch (err) {
        console.error(`[REMINDER] Failed to send subscription reminder to ${user.email}:`, err.message);
        summary.skipped++;
      }
    }
  }

  return summary;
}
