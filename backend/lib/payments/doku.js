import crypto from 'crypto';
import { PaymentProvider } from './provider.js';

/**
 * Adapter DOKU Checkout (Non-SNAP)
 * Sesuai spesifikasi DOKU Checkout API & PRD F14 §3
 */
export class DokuPaymentProvider extends PaymentProvider {
  constructor(config = {}) {
    super();
    this.clientId = config.clientId !== undefined ? config.clientId : (process.env.DOKU_CLIENT_ID || '');
    this.secretKey = config.secretKey !== undefined ? config.secretKey : (process.env.DOKU_SECRET_KEY || '');
    this.env = (config.env || process.env.DOKU_ENV || 'sandbox').toLowerCase();
    this.baseUrl = this.env === 'production'
      ? 'https://api.doku.com'
      : 'https://api-sandbox.doku.com';
    this.timeoutMs = config.timeoutMs || 15000;
  }

  /**
   * Menghasilkan timestamp UTC ISO 8601 (contoh: 2026-10-20T08:00:00Z)
   */
  generateTimestamp() {
    return new Date().toISOString().slice(0, 19) + 'Z';
  }

  /**
   * Menghitung Digest SHA-256 base64 dari raw body
   * @param {string|Buffer} rawBody
   */
  calculateDigest(rawBody) {
    const bodyStr = typeof rawBody === 'string' ? rawBody : (rawBody ? rawBody.toString('utf8') : '');
    return crypto.createHash('sha256').update(bodyStr).digest('base64');
  }

  /**
   * Menghasilkan signature DOKU Checkout non-SNAP
   * @param {Object} params
   * @param {string} params.clientId
   * @param {string} params.requestId
   * @param {string} params.timestamp
   * @param {string} params.requestTarget
   * @param {string} [params.digest]
   * @param {string} params.secretKey
   */
  generateSignature({ clientId, requestId, timestamp, requestTarget, digest, secretKey }) {
    let component = `Client-Id:${clientId}\nRequest-Id:${requestId}\nRequest-Timestamp:${timestamp}\nRequest-Target:${requestTarget}`;
    if (digest) {
      component += `\nDigest:${digest}`;
    }
    const hmac = crypto.createHmac('sha256', secretKey).update(component).digest('base64');
    return `HMACSHA256=${hmac}`;
  }

  /**
   * Helper HTTP request ke API DOKU dengan retry 1x untuk network error
   */
  async requestDoku(method, path, body = null) {
    const requestId = crypto.randomUUID();
    const timestamp = this.generateTimestamp();
    const rawBody = body ? JSON.stringify(body) : '';
    const digest = body ? this.calculateDigest(rawBody) : null;

    const signature = this.generateSignature({
      clientId: this.clientId,
      requestId,
      timestamp,
      requestTarget: path,
      digest,
      secretKey: this.secretKey
    });

    const headers = {
      'Client-Id': this.clientId,
      'Request-Id': requestId,
      'Request-Timestamp': timestamp,
      'Signature': signature
    };
    if (body) {
      headers['Content-Type'] = 'application/json';
    }

    const url = `${this.baseUrl}${path}`;
    let attempts = 0;
    const maxAttempts = 2;

    while (attempts < maxAttempts) {
      attempts++;
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), this.timeoutMs);
      try {
        const res = await fetch(url, {
          method,
          headers,
          body: body ? rawBody : undefined,
          signal: controller.signal
        });
        clearTimeout(timer);

        const text = await res.text();
        let json = null;
        try {
          json = JSON.parse(text);
        } catch {
          json = { raw: text };
        }

        if (!res.ok) {
          const err = new Error(`DOKU API error: ${res.status} ${res.statusText}`);
          err.status = res.status;
          err.dokuResponse = json;
          throw err;
        }

        return json;
      } catch (err) {
        clearTimeout(timer);
        // Jangan retry untuk error 4xx dari server
        if (err.status && err.status >= 400 && err.status < 500) {
          throw err;
        }
        if (attempts >= maxAttempts) {
          throw err;
        }
      }
    }
  }

  /**
   * Membuat pembayaran DOKU Checkout
   * @param {import('./provider.js').CreateCheckoutParams} params
   */
  async createCheckout(params) {
    if (!this.clientId || !this.secretKey) {
      const err = new Error('DOKU payment gateway is not configured (missing DOKU_CLIENT_ID / DOKU_SECRET_KEY).');
      err.status = 503;
      err.code = 'GATEWAY_NOT_CONFIGURED';
      throw err;
    }

    const { invoiceNumber, amount, customer = {}, items = [], callbackUrl, expiryMinutes = 60 } = params || {};

    const payload = {
      order: {
        amount,
        invoice_number: invoiceNumber,
        callback_url: callbackUrl,
        line_items: items.map(item => ({
          name: item.name,
          price: item.price,
          quantity: item.quantity || 1
        }))
      },
      payment: {
        payment_due_date: expiryMinutes
      },
      customer: {
        name: customer.name || 'Markimate Customer',
        email: customer.email,
        phone: customer.phone || ''
      }
    };

    const res = await this.requestDoku('POST', '/checkout/v1/payment', payload);
    const checkoutUrl = res?.response?.payment?.url || res?.payment?.url || res?.url;
    if (!checkoutUrl) {
      throw new Error(`DOKU Checkout URL missing from response: ${JSON.stringify(res)}`);
    }

    const expiresAt = new Date(Date.now() + expiryMinutes * 60 * 1000).toISOString();
    return {
      checkoutUrl,
      providerRef: res?.response?.payment?.token_id || res?.payment?.token_id || null,
      expiresAt,
      raw: res
    };
  }

  /**
   * Memverifikasi signature notifikasi webhook yang diterima dari DOKU
   * @param {import('express').Request} req
   */
  verifyNotification(req) {
    if (!this.clientId || !this.secretKey) {
      return false;
    }

    const clientId = req.headers['client-id'] || req.headers['Client-Id'];
    const requestId = req.headers['request-id'] || req.headers['Request-Id'];
    const timestamp = req.headers['request-timestamp'] || req.headers['Request-Timestamp'];
    const receivedSignature = req.headers['signature'] || req.headers['Signature'];

    if (!clientId || !requestId || !timestamp || !receivedSignature) {
      return false;
    }

    // PRD F14 Poin 2: Client-Id di notifikasi dibandingkan dengan env, tidak pernah diambil dari header pengirim
    if (clientId !== this.clientId) {
      return false;
    }

    // PRD F14 Poin 11: Request-Target notifikasi di-hardcode ke /api/webhooks/doku
    const targetPath = '/api/webhooks/doku';

    const rawBody = req.rawBody || (typeof req.body === 'string' ? req.body : JSON.stringify(req.body));
    const digest = this.calculateDigest(rawBody);

    const expectedSignature = this.generateSignature({
      clientId: this.clientId,
      requestId,
      timestamp,
      requestTarget: targetPath,
      digest,
      secretKey: this.secretKey
    });

    const receivedBuf = Buffer.from(String(receivedSignature));
    const expectedBuf = Buffer.from(String(expectedSignature));

    if (receivedBuf.length !== expectedBuf.length) {
      return false;
    }
    return crypto.timingSafeEqual(receivedBuf, expectedBuf);
  }

  /**
   * Mem-parse body notifikasi DOKU Checkout
   * @param {any} body
   */
  parseNotification(body) {
    const order = body?.order || {};
    const transaction = body?.transaction || {};
    const invoiceNumber = order.invoice_number || body?.invoice_number || '';
    const amount = Number(order.amount || body?.amount || 0);
    const rawStatus = (transaction.status || body?.status || '').toUpperCase();

    let status = 'pending';
    if (rawStatus === 'SUCCESS') {
      status = 'paid';
    } else if (rawStatus === 'EXPIRED') {
      status = 'expired';
    } else if (rawStatus === 'REFUNDED') {
      status = 'refunded';
    } else if (rawStatus === 'FAILED') {
      // PRD F14 Poin 8: FAILED bukan status final untuk Checkout, tetap pending sampai sukses atau expired
      status = 'pending';
    }

    const paidAt = status === 'paid' ? (transaction.date || new Date().toISOString()) : null;
    const method = body?.channel?.id || transaction.channel || null;

    return {
      invoiceNumber,
      amount,
      status,
      paidAt,
      method,
      raw: body
    };
  }

  /**
   * Cek status pembayaran ke DOKU
   * GET /orders/v1/status/{invoice_number}
   * @param {string} invoiceNumber
   */
  async getStatus(invoiceNumber) {
    if (!this.clientId || !this.secretKey) {
      const err = new Error('DOKU payment gateway is not configured (missing DOKU_CLIENT_ID / DOKU_SECRET_KEY).');
      err.status = 503;
      err.code = 'GATEWAY_NOT_CONFIGURED';
      throw err;
    }

    const path = `/orders/v1/status/${invoiceNumber}`;
    const res = await this.requestDoku('GET', path, null);

    const order = res?.order || {};
    const transaction = res?.transaction || {};
    const rawStatus = (transaction.status || order.status || res?.status || '').toUpperCase();

    let status = 'pending';
    if (rawStatus === 'SUCCESS') {
      status = 'paid';
    } else if (rawStatus === 'EXPIRED' || rawStatus === 'TIMEOUT') {
      status = 'expired';
    } else if (rawStatus === 'REFUNDED') {
      status = 'refunded';
    } else if (rawStatus === 'FAILED') {
      // PRD F14 Poin 8: FAILED bukan status final untuk Checkout
      status = 'pending';
    }

    const paidAt = status === 'paid' ? (transaction.date || new Date().toISOString()) : null;
    const method = res?.channel?.id || transaction.channel || null;

    return {
      status,
      paidAt,
      method,
      raw: res
    };
  }
}
