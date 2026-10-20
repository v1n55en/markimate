/**
 * @file provider.js
 * Kontrak antarmuka Payment Provider Adapter untuk Markimate (PRD F14 §2.5)
 */

/**
 * @typedef {Object} CheckoutCustomer
 * @property {string} name
 * @property {string} email
 * @property {string} [phone]
 */

/**
 * @typedef {Object} CheckoutItem
 * @property {string} id
 * @property {string} name
 * @property {number} price
 * @property {number} quantity
 */

/**
 * @typedef {Object} CreateCheckoutParams
 * @property {string} invoiceNumber
 * @property {number} amount - Nilai transaksi dalam IDR
 * @property {CheckoutCustomer} customer
 * @property {CheckoutItem[]} items
 * @property {string} callbackUrl
 * @property {number} expiryMinutes
 */

/**
 * @typedef {Object} CreateCheckoutResult
 * @property {string} checkoutUrl
 * @property {string|null} providerRef
 * @property {string} expiresAt - ISO8601 string
 * @property {any} raw - Raw provider response
 */

/**
 * @typedef {'paid'|'failed'|'expired'|'pending'|'refunded'} PaymentStatus
 */

/**
 * @typedef {Object} ParsedNotification
 * @property {string} invoiceNumber
 * @property {PaymentStatus} status
 * @property {string|null} paidAt - ISO8601 string jika paid
 * @property {string|null} method - Metode bayar (e.g. 'QRIS', 'VIRTUAL_ACCOUNT', 'CREDIT_CARD')
 * @property {any} raw
 */

/**
 * @typedef {Object} StatusResult
 * @property {PaymentStatus} status
 * @property {string|null} paidAt
 * @property {string|null} method
 * @property {any} raw
 */

/**
 * Base Payment Provider Interface
 */
export class PaymentProvider {
  /**
   * @param {CreateCheckoutParams} params
   * @returns {Promise<CreateCheckoutResult>}
   */
  async createCheckout(_params) {
    throw new Error('createCheckout must be implemented by adapter');
  }

  /**
   * @param {import('express').Request} _req
   * @returns {boolean|Promise<boolean>}
   */
  verifyNotification(_req) {
    throw new Error('verifyNotification must be implemented by adapter');
  }

  /**
   * @param {any} _body
   * @returns {ParsedNotification}
   */
  parseNotification(_body) {
    throw new Error('parseNotification must be implemented by adapter');
  }

  /**
   * @param {string} _invoiceNumber
   * @returns {Promise<StatusResult>}
   */
  async getStatus(_invoiceNumber) {
    throw new Error('getStatus must be implemented by adapter');
  }
}
