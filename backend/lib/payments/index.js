import { DokuPaymentProvider } from './doku.js';
import { MockPaymentProvider } from './mock.js';

let currentProviderInstance = null;
let currentProviderName = null;

/**
 * Mendapatkan instance provider pembayaran aktif
 * @param {string} [nameOverride]
 * @returns {import('./provider.js').PaymentProvider}
 */
export function getProvider(nameOverride) {
  if (currentProviderName === 'custom' && currentProviderInstance) {
    return currentProviderInstance;
  }

  const providerName = (nameOverride || process.env.PAYMENT_PROVIDER || 'doku').toLowerCase();

  // Jika nama provider sama dan instance sudah ada, gunakan cache instance
  if (currentProviderInstance && currentProviderName === providerName && !nameOverride) {
    return currentProviderInstance;
  }

  let provider;
  if (providerName === 'mock') {
    if (process.env.NODE_ENV === 'production') {
      const err = new Error("Mock payment provider is strictly forbidden in production environment.");
      err.status = 404;
      err.code = 'NOT_FOUND';
      throw err;
    }
    provider = new MockPaymentProvider();
  } else if (providerName === 'doku') {
    provider = new DokuPaymentProvider();
  } else {
    throw new Error(`Unsupported payment provider '${providerName}'. Supported providers: doku, mock`);
  }

  if (!nameOverride) {
    currentProviderInstance = provider;
    currentProviderName = providerName;
  }
  return provider;
}

/**
 * Mengeset instance provider secara manual (berguna untuk mock di test)
 */
export function setProvider(provider) {
  currentProviderInstance = provider;
  currentProviderName = 'custom';
}
