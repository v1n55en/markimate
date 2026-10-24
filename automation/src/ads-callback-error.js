// automation/src/ads-callback-error.js
// Semua error output (Code/HTTP) bermuara ke sini → callback status 'error' supaya backend
// langsung me-refund kredit (tanpa menunggu timeout 15 menit).

const job = $('Auth & Normalize (Ads)').first().json;
const it = $input.first().json || {};
const raw = it.error && typeof it.error === 'object' ? (it.error.message || JSON.stringify(it.error)) : (it.error || it.message || 'unknown error');
const msg = String(raw);
// Deck milik user gagal disalin (belum dibagikan / dihapus) → kode khusus supaya UI bisa menjelaskan
let prev = '';
try { prev = $prevNode.name; } catch (e) { prev = ''; }
const code = /ADS_SOURCE_UNAVAILABLE/.test(msg)
  ? 'ADS_SOURCE_UNAVAILABLE'
  : (job.deckId && prev === 'Drive: Salin Base Deck' ? 'ADS_DECK_UNAVAILABLE' : 'ADS_REPORT_FAILED');

return [{
  json: {
    callbackUrl: job.callbackUrl,
    callbackPayload: {
      requestId: job.requestId,
      reportId: job.reportId,
      status: 'error',
      errorCode: code,
      // token tidak pernah ada di pesan error (dikirim via header), tetap dipotong supaya ringkas
      warnings: [`error:${msg.replace(/access_token=[^&\s]+/g, 'access_token=***').slice(0, 300)}`]
    }
  }
}];
