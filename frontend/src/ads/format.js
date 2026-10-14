// Helper format angka, rupiah, persen, dan metrik periklanan dengan dukungan bilingual

export const formatIDR = (n, lang = 'id') => {
  const num = Number(n || 0);
  const isEn = typeof lang === 'string' && lang.startsWith('en');
  if (isEn) {
    return 'IDR ' + num.toLocaleString('en-US');
  }
  return 'Rp ' + num.toLocaleString('id-ID');
};

// Format angka ringkas: 1,2 jt / 15,3 rb / 1,5 M vs 1.2M / 15.3K / 1.5B
export const formatCompact = (n, lang = 'id') => {
  const num = Number(n || 0);
  const abs = Math.abs(num);
  const isEn = typeof lang === 'string' && lang.startsWith('en');
  const locale = isEn ? 'en-US' : 'id-ID';

  if (abs >= 1_000_000_000) {
    const formatted = (num / 1_000_000_000).toLocaleString(locale, { minimumFractionDigits: 1, maximumFractionDigits: 1 });
    return isEn ? `${formatted}B` : `${formatted} M`;
  }
  if (abs >= 1_000_000) {
    const formatted = (num / 1_000_000).toLocaleString(locale, { minimumFractionDigits: 1, maximumFractionDigits: 1 });
    return isEn ? `${formatted}M` : `${formatted} jt`;
  }
  if (abs >= 1_000) {
    const formatted = (num / 1_000).toLocaleString(locale, { minimumFractionDigits: 1, maximumFractionDigits: 1 });
    return isEn ? `${formatted}K` : `${formatted} rb`;
  }
  return num.toLocaleString(locale);
};

// Format rupiah ringkas (Rp 1,2 jt / IDR 1.2M)
export const formatCompactIDR = (n, lang = 'id') => {
  const num = Number(n || 0);
  const abs = Math.abs(num);
  const isEn = typeof lang === 'string' && lang.startsWith('en');
  const prefix = isEn ? 'IDR ' : 'Rp ';
  const locale = isEn ? 'en-US' : 'id-ID';

  if (abs >= 1_000_000_000) {
    const formatted = (num / 1_000_000_000).toLocaleString(locale, { minimumFractionDigits: 1, maximumFractionDigits: 1 });
    return isEn ? `${prefix}${formatted}B` : `${prefix}${formatted} M`;
  }
  if (abs >= 1_000_000) {
    const formatted = (num / 1_000_000).toLocaleString(locale, { minimumFractionDigits: 1, maximumFractionDigits: 1 });
    return isEn ? `${prefix}${formatted}M` : `${prefix}${formatted} jt`;
  }
  if (abs >= 1_000) {
    const formatted = (num / 1_000).toLocaleString(locale, { minimumFractionDigits: 1, maximumFractionDigits: 1 });
    return isEn ? `${prefix}${formatted}K` : `${prefix}${formatted} rb`;
  }
  return formatIDR(num, lang);
};

// Format persentase dengan 2 desimal
export const formatPercent = (n, includeSign = false, lang = 'id') => {
  const num = Number(n || 0);
  const sign = includeSign && num > 0 ? '+' : '';
  const isEn = typeof lang === 'string' && lang.startsWith('en');
  const locale = isEn ? 'en-US' : 'id-ID';
  return sign + num.toLocaleString(locale, { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + '%';
};

// Format ROAS (mis. 4.88x)
export const formatRoas = (n) => {
  return Number(n || 0).toFixed(2) + 'x';
};

// Format angka standar dengan pemisah ribuan
export const formatNumber = (n, lang = 'id') => {
  const isEn = typeof lang === 'string' && lang.startsWith('en');
  const locale = isEn ? 'en-US' : 'id-ID';
  return Number(n || 0).toLocaleString(locale);
};
