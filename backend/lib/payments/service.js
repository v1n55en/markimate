import crypto from 'crypto';
import { db } from '../../db.js';
import { PLANS, MODULES, BUNDLES, TOPUP, quoteTopup } from '../catalog.js';
import { grant, ensureMonthlyGrant } from '../credits.js';
import {
  sendTopupSuccessEmail,
  sendSubscriptionSuccessEmail,
  sendModuleSuccessEmail
} from '../mailer.js';
import { getProvider } from './index.js';

/**
 * Menghasilkan nomor invoice unik sesuai spesifikasi PRD F14 §3 & PRD F15:
 * Format: MKM-{T|S|M}-{YYMMDD}-{6 karakter acak}
 * @param {'topup'|'subscription'|'module'} kind
 */
export function generateInvoiceNumber(kind) {
  const prefix = kind === 'topup' ? 'T' : (kind === 'module' ? 'M' : 'S');
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
 * @param {'topup'|'subscription'|'module'} params.kind
 * @param {string|number} params.itemId
 * @param {number} [params.credits]
 * @param {string} params.workspaceId
 * @param {string} params.userId
 * @param {string} [params.callbackUrl]
 */
export async function createCheckout({ kind, itemId, credits: inputCredits, workspaceId, userId, callbackUrl }) {
  if (!['topup', 'subscription', 'module'].includes(kind)) {
    throw Object.assign(new Error(`Invalid payment kind '${kind}'. Must be 'topup', 'subscription', or 'module'.`), {
      status: 400,
      code: 'INVALID_PAYMENT_KIND'
    });
  }

  let itemName = '';
  let amount = 0;
  let credits = 0;
  let periodDays = 30;

  if (kind === 'topup') {
    // PRD F15: Top-up Custom Credits (hanya lewat credits)
    const rawCredits = inputCredits !== undefined ? inputCredits : itemId;
    const numCredits = Math.floor(Number(rawCredits));
    if (isNaN(numCredits) || numCredits < TOPUP.min || numCredits > TOPUP.max) {
      throw Object.assign(new Error(`Top-up credits must be between ${TOPUP.min} and ${TOPUP.max}.`), {
        status: 400,
        code: 'INVALID_TOPUP_AMOUNT'
      });
    }
    const quote = quoteTopup(numCredits);
    itemName = `Top-Up ${quote.credits.toLocaleString('id-ID')} Credit`;
    amount = quote.amount; // Server-calculated amount; client amount is completely ignored
    credits = quote.credits;
    periodDays = TOPUP.validityDays || 365;
    itemId = `custom_${quote.credits}`;
  } else if (kind === 'module') {
    const mod = MODULES[itemId];
    const bun = BUNDLES[itemId];
    if (!mod && !bun) {
      throw Object.assign(new Error(`Invalid module or bundle '${itemId}'.`), {
        status: 400,
        code: 'INVALID_MODULE'
      });
    }

    const existingEnts = await db.findMany('module_entitlements', { workspace_id: workspaceId });
    const ownedLifetime = new Set(
      (existingEnts || [])
        .filter(e => e.source === 'lifetime' && e.active)
        .map(e => e.module)
    );

    if (mod) {
      if (ownedLifetime.has(mod.id)) {
        throw Object.assign(new Error(`Workspace already owns module '${mod.name}'.`), {
          status: 409,
          code: 'MODULE_ALREADY_OWNED'
        });
      }
      itemName = mod.name;
      amount = mod.price;
      credits = mod.monthlyCredits;
      periodDays = null;
    } else if (bun) {
      const targetMods = bun.modules || [];
      const unownedMods = targetMods.filter(m => !ownedLifetime.has(m));
      if (unownedMods.length === 0) {
        throw Object.assign(new Error(`Workspace already owns all modules in '${bun.name}'.`), {
          status: 409,
          code: 'MODULE_ALREADY_OWNED'
        });
      }

      // PRD F15: Bundle saat sebagian modul sudah dimiliki -> harga bundle dikurangi harga modul
      // yang sudah dimiliki, tapi tidak lebih rendah dari jumlah harga modul yang belum dimiliki x 0.8
      const baseBundlePrice = bun.price;
      const sumOwnedPrice = targetMods
        .filter(m => ownedLifetime.has(m))
        .reduce((sum, m) => sum + (MODULES[m]?.price || 0), 0);
      const sumUnownedPrice = unownedMods
        .reduce((sum, m) => sum + (MODULES[m]?.price || 0), 0);
      const floorPrice = Math.round(sumUnownedPrice * 0.8);
      const discountedBundlePrice = baseBundlePrice - sumOwnedPrice;

      amount = Math.max(discountedBundlePrice, floorPrice);
      itemName = bun.name;
      credits = bun.monthlyCredits;
      periodDays = null;
    }
  } else {
    // PRD F15: Langganan bulanan dihapus, mengembalikan 410 PLAN_DISCONTINUED
    throw Object.assign(
      new Error('Monthly subscription plans have been discontinued. Please choose a lifetime module.'),
      {
        status: 410,
        code: 'PLAN_DISCONTINUED'
      }
    );
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
    granted_at: null,
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
        name: (user?.name || workspace?.name || 'Markimate Customer').trim().slice(0, 64) || 'Markimate Customer',
        email: user?.email || 'customer@markimate.com',
        ...(user?.phone && String(user.phone).trim() ? { phone: String(user.phone).trim() } : {})
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
    const dokuRaw = err.dokuResponse || { error: err.message };
    await db.update('payments', { id: payment.id }, {
      status: 'failed',
      expires_at: nowIso,
      raw: dokuRaw,
      updated_at: nowIso
    });

    const dokuStatus = err.status || 500;
    const dokuCode = err.dokuResponse?.error?.code || err.code || 'GATEWAY_ERROR';
    const dokuMsg = err.dokuResponse?.error?.message
      || (Array.isArray(err.dokuResponse?.message) ? err.dokuResponse.message.join(', ') : err.dokuResponse?.message)
      || (Array.isArray(err.dokuResponse?.error) ? err.dokuResponse.error.join(', ') : err.dokuResponse?.error)
      || err.message;
    console.error(`[DOKU Error] invoice=${invoiceNumber} status=${dokuStatus} code=${dokuCode} message=${dokuMsg}`);

    if (err.status && err.status >= 400 && err.status < 500) {
      const clientErr = new Error('Payment gateway rejected the request. Please try again or contact support.');
      clientErr.status = 502;
      clientErr.code = 'PAYMENT_GATEWAY_REJECTED';
      clientErr.dokuResponse = err.dokuResponse;
      throw clientErr;
    }

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
 * Memberikan aktivasi modul lifetime dan kuota bulanan secara idempoten per payment.id
 * @param {Object} payment
 */
export async function grantModulePayment(payment) {
  if (payment.granted_at) {
    return { granted: false, reason: 'already_granted' };
  }

  let targetModules = [];
  if (MODULES[payment.item_id]) {
    targetModules = [payment.item_id];
  } else if (BUNDLES[payment.item_id]) {
    targetModules = BUNDLES[payment.item_id].modules || [];
  } else {
    targetModules = [payment.item_id];
  }

  const nowIso = new Date().toISOString();

  // 1. Upsert module_entitlements (source: 'lifetime', ends_at: null, payment_id)
  for (const modKey of targetModules) {
    const existingEnt = await db.findOne('module_entitlements', {
      workspace_id: payment.workspace_id,
      module: modKey
    });

    if (existingEnt) {
      await db.update('module_entitlements', {
        workspace_id: payment.workspace_id,
        module: modKey
      }, {
        active: true,
        source: 'lifetime',
        starts_at: existingEnt.starts_at || nowIso,
        ends_at: null,
        payment_id: payment.id,
        updated_at: nowIso
      });
    } else {
      await db.insert('module_entitlements', {
        workspace_id: payment.workspace_id,
        module: modKey,
        active: true,
        source: 'lifetime',
        starts_at: nowIso,
        ends_at: null,
        payment_id: payment.id,
        updated_at: nowIso
      });
    }
  }

  // 2. Langsung jalankan ensureMonthlyGrant
  await ensureMonthlyGrant(payment.workspace_id);

  // 3. Catat granted_at di baris payment
  await db.update('payments', { id: payment.id }, {
    granted_at: nowIso,
    updated_at: nowIso
  });

  // 4. Kirim email notifikasi pembelian modul lifetime berhasil
  const user = payment.user_id ? await db.findOne('accounts', { id: payment.user_id }) : null;
  const userLocale = user?.locale || 'id';
  if (user?.email) {
    sendModuleSuccessEmail({
      to: user.email,
      invoiceNumber: payment.invoice_number,
      moduleName: payment.item_name,
      amount: payment.amount,
      locale: userLocale
    }).catch(err => console.error('[MAIL] Failed to send module success email:', err.message));
  }

  return { granted: true };
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

  try {
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

      // PRD F14 Tahap 3: Kunci langganan per payment.id (atau invoice_no) untuk mencegah duplikasi & dobel masa aktif saat retry
      let sub = null;
      if (payment.id) {
        sub = await db.findOne('subscriptions', { payment_id: payment.id });
      }
      if (!sub && payment.invoice_number) {
        sub = await db.findOne('subscriptions', { invoice_no: payment.invoice_number });
      }

      if (!sub) {
        // Periksa apakah sudah ada langganan aktif lain untuk memperpanjang
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

        sub = await db.insert('subscriptions', {
          payment_id: payment.id || null,
          user_id: payment.user_id,
          workspace_id: payment.workspace_id,
          plan: planKey,
          status: 'active',
          method: parsed?.method || payment.method || payment.provider,
          amount: payment.amount,
          invoice_no: payment.invoice_number,
          started_at: now.toISOString(),
          ends_at: endsAt.toISOString(),
          dummy: false
        });
      }

      const endsAt = new Date(sub.ends_at);

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
      // PRD F14 Tahap 3: Semua refId grant memakai payment.id
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
            refType: 'payment',
            refId: payment.id,
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
    } else if (payment.kind === 'module') {
      const grantRes = await grantModulePayment(payment);
      if (!grantRes.granted) {
        return { fulfilled: false, reason: grantRes.reason };
      }
    }

    return { fulfilled: true, fulfilledAt };
  } catch (err) {
    console.error(`[FULFILLMENT-FAILED] Error fulfilling payment ${payment.invoice_number}:`, err.message);
    // Rollback klaim agar baris tidak terkunci sebagai 'paid' tanpa kredit
    try {
      await db.update('payments', { id: payment.id }, {
        fulfilled_at: null,
        status: 'pending',
        updated_at: new Date().toISOString()
      });
    } catch (rbErr) {
      console.error(`[CRITICAL] Rollback claim failed for payment ${payment.invoice_number} (id=${payment.id}): ${rbErr.message}. Reconcile loop will recover.`);
    }
    throw err;
  }
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

  // PRD F14 Poin 6 & Tahap 2 Poin 3: Nominal wajib dicocokkan.
  // Notifikasi status 'paid' tanpa amount yang valid (> 0) atau nominal mismatch wajib ditolak & dilog.
  if (status === 'paid') {
    const notifAmount = Number(amount);
    if (!amount || isNaN(notifAmount) || notifAmount <= 0 || notifAmount !== Number(payment.amount)) {
      console.error(`[PAYMENT-MISMATCH] Invoice ${invoiceNumber}: Invalid or mismatch amount in SUCCESS notification. DB amount: ${payment.amount}, Notif amount: ${amount}`);
      return { status: 'ignored', reason: 'amount_mismatch', invoiceNumber };
    }
  } else if (amount && Number(payment.amount) !== Number(amount)) {
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

  // Rekonsiliasi pembayaran 'paid' yang belum ter-grant (PRD F14 Tahap 2 Poin 2)
  const paidPayments = await db.findMany('payments', { status: 'paid' });
  for (const payment of paidPayments || []) {
    // 1. Jika fulfilled_at masih null pada status 'paid', lakukan fulfill
    if (!payment.fulfilled_at) {
      try {
        const fulfillRes = await fulfillPayment(payment);
        if (fulfillRes.fulfilled) results.fulfilled++;
      } catch (err) {
        console.error(`[RECONCILE] Error fulfilling unfulfilled paid payment ${payment.invoice_number}:`, err.message);
      }
      continue;
    }

    // 2. Jika kind === 'topup' dan credits > 0, pastikan ada baris credit_ledger terkait
    if (payment.kind === 'topup' && payment.credits > 0) {
      const existingLedger = await db.findMany('credit_ledger', {
        workspace_id: payment.workspace_id,
        ref_id: payment.id
      });
      const hasGrantRow = (existingLedger || []).some(r => r.kind === 'topup' || (r.delta && r.delta > 0));
      if (!hasGrantRow) {
        try {
          const validityDays = payment.period_days || 365;
          const expiresAt = new Date(Date.now() + validityDays * 86400e3);
          await grant(
            payment.workspace_id,
            'topup',
            payment.credits,
            expiresAt,
            'topup',
            `Reconciliation: Top-up credit via ${payment.provider.toUpperCase()} (${payment.invoice_number})`,
            {
              actionKey: 'billing.topup',
              refType: 'payment',
              refId: payment.id,
              invoiceNumber: payment.invoice_number,
              provider: payment.provider,
              method: payment.method
            }
          );
          results.fulfilled++;
        } catch (err) {
          console.error(`[RECONCILE] Error granting missing topup credits for ${payment.invoice_number}:`, err.message);
        }
      }
    }

    // 3. PRD F15: Jalur pemulihan khusus untuk pembelian modul jika granted_at IS NULL.
    // Jalur ini tidak perlu claim ulang (karena baris mungkin sudah paid + fulfilled_at terisi),
    // cukup jalankan pemberian modul secara idempoten per payment.id.
    if (payment.kind === 'module' && !payment.granted_at) {
      try {
        const grantRes = await grantModulePayment(payment);
        if (grantRes.granted) results.fulfilled++;
      } catch (err) {
        console.error(`[RECONCILE] Error fulfilling missing module grant for ${payment.invoice_number}:`, err.message);
      }
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
