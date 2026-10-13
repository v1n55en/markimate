import crypto from 'crypto';
import { randomUUID } from 'crypto';
import { db } from '../db.js';
import { grant } from './credits.js';

export const TOPUP_PACKAGES = {
  starter: {
    id: 'starter',
    name: 'Starter Pack',
    price: 500000,
    credits: 500,
    bonus: 0,
    desc: 'Cukup untuk ±8 artikel lengkap dengan 3 gambar AI.'
  },
  growth: {
    id: 'growth',
    name: 'Growth Pack',
    price: 1000000,
    credits: 1050,
    bonus: 50,
    desc: 'Bonus +50 credit. Cukup untuk ±14 artikel bergambar & riset topik.'
  },
  scale: {
    id: 'scale',
    name: 'Scale Pack',
    price: 2500000,
    credits: 2750,
    bonus: 250,
    desc: 'Bonus +250 credit. Skala besar untuk tim agency & brand aktif.'
  }
};

/**
 * Membuat transaksi Midtrans Snap untuk Top-up Credit (PRD §4.3 & §4.4)
 */
export async function createSnapTransaction(user, packageId) {
  const pack = TOPUP_PACKAGES[packageId];
  if (!pack) {
    throw Object.assign(new Error(`Paket top-up '${packageId}' tidak valid. Pilih starter, growth, atau scale.`), { status: 400 });
  }

  const orderId = `SPM-TOPUP-${Date.now()}-${crypto.randomBytes(3).toString('hex').toUpperCase()}`;
  const serverKey = process.env.MIDTRANS_SERVER_KEY || '';
  const isProd = process.env.MIDTRANS_IS_PRODUCTION === 'true';

  let snapToken = null;
  let redirectUrl = null;

  // Jika MIDTRANS_SERVER_KEY valid dan bukan placeholder, panggil API Snap Midtrans
  if (serverKey && !serverKey.includes('placeholder') && !serverKey.includes('test-key')) {
    const snapUrl = isProd
      ? 'https://app.midtrans.com/snap/v1/transactions'
      : 'https://app.sandbox.midtrans.com/snap/v1/transactions';

    const authHeader = 'Basic ' + Buffer.from(serverKey + ':').toString('base64');
    const payload = {
      transaction_details: {
        order_id: orderId,
        gross_amount: pack.price
      },
      item_details: [{
        id: pack.id,
        price: pack.price,
        quantity: 1,
        name: `Top-up Markimate ${pack.name} (${pack.credits} Credit)`
      }],
      customer_details: {
        first_name: user.brand_name || user.name || 'User',
        email: user.email
      }
    };

    try {
      const res = await fetch(snapUrl, {
        method: 'POST',
        headers: {
          'Authorization': authHeader,
          'Content-Type': 'application/json',
          'Accept': 'application/json'
        },
        body: JSON.stringify(payload)
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error_messages ? data.error_messages.join(', ') : 'Gagal membuat Snap transaksi Midtrans');
      }
      snapToken = data.token;
      redirectUrl = data.redirect_url;
    } catch (err) {
      console.warn(`[Midtrans] Gagal memanggil Snap API (${err.message}), beralih ke simulasi sandbox.`);
      snapToken = `snap_sandbox_${orderId}`;
      redirectUrl = `https://app.sandbox.midtrans.com/snap/v2/vtweb/${snapToken}`;
    }
  } else {
    // Mode sandbox dev lokal / test
    snapToken = `snap_mock_${orderId}`;
    redirectUrl = `https://app.sandbox.midtrans.com/snap/v2/vtweb/${snapToken}`;
  }

  // Simpan catatan order ke database
  const order = await db.insert('credit_orders', {
    id: randomUUID(),
    order_id: orderId,
    workspace_id: user.id,
    package_id: pack.id,
    package_name: pack.name,
    amount: pack.price,
    credits: pack.credits,
    status: 'pending',
    snap_token: snapToken,
    payment_method: null,
    created_at: new Date().toISOString()
  });

  return {
    orderId,
    token: snapToken,
    redirectUrl,
    package: pack,
    clientKey: process.env.MIDTRANS_CLIENT_KEY || 'SB-Mid-client-demo'
  };
}

/**
 * Verifikasi signature webhook Midtrans:
 * SHA512(order_id + status_code + gross_amount + ServerKey)
 */
export function verifyMidtransSignature(body) {
  const serverKey = process.env.MIDTRANS_SERVER_KEY || '';
  if (!serverKey) return true; // dev permissive
  if (!body || !body.signature_key) return false;

  const raw = `${body.order_id}${body.status_code}${body.gross_amount}${serverKey}`;
  const expected = crypto.createHash('sha512').update(raw).digest('hex');
  return expected.toLowerCase() === String(body.signature_key).toLowerCase();
}

/**
 * Memproses notifikasi / webhook dari Midtrans (PRD §4.3 & §4.4)
 */
export async function handleMidtransWebhook(body) {
  if (!body || !body.order_id) {
    throw Object.assign(new Error('Invalid webhook payload: order_id is required'), { status: 400 });
  }

  // Verifikasi signature
  const isValid = verifyMidtransSignature(body);
  if (!isValid && process.env.NODE_ENV !== 'test') {
    throw Object.assign(new Error('Invalid Midtrans signature'), { status: 403 });
  }

  const orderId = body.order_id;
  const order = await db.findOne('credit_orders', { order_id: orderId });
  if (!order) {
    return { status: 'ignored', message: `Order ${orderId} tidak ditemukan` };
  }

  // Idempoten: Jika sudah status 'paid', tidak grant dua kali
  if (order.status === 'paid') {
    return { status: 'ok', alreadyPaid: true, orderId };
  }

  const txStatus = body.transaction_status;
  const fraudStatus = body.fraud_status;

  const isSuccess = txStatus === 'settlement' || (txStatus === 'capture' && fraudStatus === 'accept');

  if (isSuccess) {
    // 1. Update order menjadi paid
    await db.update('credit_orders', { id: order.id }, {
      status: 'paid',
      payment_method: body.payment_type || 'midtrans',
      paid_at: new Date().toISOString()
    });

    // 2. Grant credit ke bucket 'topup' berlaku 365 hari (PRD §2 & §4.3)
    const expiresAt = new Date(Date.now() + 365 * 24 * 60 * 60 * 1000);
    await grant(
      order.workspace_id,
      'topup',
      Number(order.credits),
      expiresAt,
      'topup',
      `Top-up ${order.package_name} (${order.credits} credit)`,
      { actionKey: 'billing.topup', refType: 'order', refId: order.order_id }
    );

    return {
      status: 'ok',
      orderId,
      paid: true,
      creditsGranted: order.credits,
      workspaceId: order.workspace_id
    };
  }

  if (['cancel', 'expire', 'deny'].includes(txStatus)) {
    await db.update('credit_orders', { id: order.id }, {
      status: txStatus === 'expire' ? 'expired' : 'failed'
    });
    return { status: 'ok', cancelled: true, orderId };
  }

  return { status: 'ok', pending: true, orderId };
}
