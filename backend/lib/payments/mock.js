import { PaymentProvider } from './provider.js';

/**
 * Mock Payment Provider Adapter untuk Testing & Lingkungan Lokal
 */
export class MockPaymentProvider extends PaymentProvider {
  constructor(config = {}) {
    super();
    this.statusMap = new Map();
    this.failVerify = config.failVerify || false;
  }

  setMockStatus(invoiceNumber, status, method = 'MOCK_QRIS') {
    this.statusMap.set(invoiceNumber, {
      status,
      paidAt: status === 'paid' ? new Date().toISOString() : null,
      method
    });
  }

  async createCheckout(params) {
    const { invoiceNumber, expiryMinutes = 60 } = params;
    const expiresAt = new Date(Date.now() + expiryMinutes * 60 * 1000).toISOString();
    return {
      checkoutUrl: `http://localhost:5001/mock-checkout?invoice=${encodeURIComponent(invoiceNumber)}`,
      providerRef: `mock-ref-${invoiceNumber}`,
      expiresAt,
      raw: { mock: true, invoiceNumber }
    };
  }

  verifyNotification(req) {
    if (this.failVerify) return false;
    const sig = req.headers['signature'] || req.headers['Signature'];
    if (sig === 'invalid-signature') return false;
    return true;
  }

  parseNotification(body) {
    const invoiceNumber = body?.order?.invoice_number || body?.invoiceNumber || body?.invoice_number || '';
    const status = body?.status || (body?.transaction?.status === 'SUCCESS' ? 'paid' : 'pending');
    return {
      invoiceNumber,
      status: status === 'SUCCESS' ? 'paid' : status,
      paidAt: status === 'paid' ? (body?.paidAt || new Date().toISOString()) : null,
      method: body?.method || body?.channel?.id || 'MOCK_PAYMENT',
      raw: body
    };
  }

  async getStatus(invoiceNumber) {
    const mocked = this.statusMap.get(invoiceNumber);
    if (mocked) {
      return {
        status: mocked.status,
        paidAt: mocked.paidAt,
        method: mocked.method,
        raw: { mocked: true }
      };
    }
    return {
      status: 'pending',
      paidAt: null,
      method: null,
      raw: { mocked: true, pending: true }
    };
  }
}
