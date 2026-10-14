// Utility format angka, mata uang, dan tanggal berbasis Intl
// Selalu mengacu pada timezone default Asia/Jakarta

const DEFAULT_TIMEZONE = 'Asia/Jakarta';

/**
 * Format angka sesuai locale (pemisah ribuan & desimal)
 * @param {number|string} value
 * @param {string} [lang='id']
 * @param {Intl.NumberFormatOptions} [options={}]
 */
export function formatNumber(value, lang = 'id', options = {}) {
  const num = Number(value);
  if (isNaN(num)) return '0';
  const locale = lang === 'en' ? 'en-US' : 'id-ID';
  return new Intl.NumberFormat(locale, options).format(num);
}

/**
 * Format mata uang Rupiah
 * ID -> Rp 150.000
 * EN -> IDR 150,000
 * @param {number|string} value
 * @param {string} [lang='id']
 */
export function formatIDR(value, lang = 'id') {
  const num = Math.round(Number(value) || 0);
  if (lang === 'en') {
    return `IDR ${formatNumber(num, 'en')}`;
  }
  return `Rp ${formatNumber(num, 'id')}`;
}

/**
 * Format tanggal
 * @param {string|number|Date} date
 * @param {string} [lang='id']
 * @param {Intl.DateTimeFormatOptions} [options={}]
 */
export function formatDate(date, lang = 'id', options = {}) {
  if (!date) return '-';
  const d = new Date(date);
  if (isNaN(d.getTime())) return '-';
  const locale = lang === 'en' ? 'en-US' : 'id-ID';
  const defaultOptions = {
    timeZone: DEFAULT_TIMEZONE,
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    ...options
  };
  return new Intl.DateTimeFormat(locale, defaultOptions).format(d);
}

/**
 * Format tanggal beserta waktu (jam:menit)
 * @param {string|number|Date} date
 * @param {string} [lang='id']
 * @param {Intl.DateTimeFormatOptions} [options={}]
 */
export function formatDateTime(date, lang = 'id', options = {}) {
  return formatDate(date, lang, {
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
    ...options
  });
}

/**
 * Format waktu relatif (e.g. 2 jam yang lalu / 2 hours ago)
 * @param {string|number|Date} date
 * @param {string} [lang='id']
 */
export function formatRelative(date, lang = 'id') {
  if (!date) return '-';
  const d = new Date(date);
  if (isNaN(d.getTime())) return '-';

  const diffSec = Math.round((d.getTime() - Date.now()) / 1000);
  const absDiff = Math.abs(diffSec);

  const units = [
    { unit: 'year', seconds: 31536000 },
    { unit: 'month', seconds: 2592000 },
    { unit: 'day', seconds: 86400 },
    { unit: 'hour', seconds: 3600 },
    { unit: 'minute', seconds: 60 },
    { unit: 'second', seconds: 1 }
  ];

  const matched = units.find(u => absDiff >= u.seconds) || units[units.length - 1];
  const count = Math.round(diffSec / matched.seconds);

  const locale = lang === 'en' ? 'en-US' : 'id-ID';
  const rtf = new Intl.RelativeTimeFormat(locale, { numeric: 'auto' });
  return rtf.format(count, matched.unit);
}
