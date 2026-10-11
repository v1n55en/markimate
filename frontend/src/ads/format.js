// Helper format angka, rupiah, persen, dan metrik periklanan

export const formatIDR = (n) => 'Rp ' + Number(n || 0).toLocaleString('id-ID');

// Format angka ringkas: 1,2 jt / 15,3 rb / 1,5 M
export const formatCompact = (n) => {
  const num = Number(n || 0);
  const abs = Math.abs(num);
  if (abs >= 1_000_000_000) {
    return (num / 1_000_000_000).toLocaleString('id-ID', { minimumFractionDigits: 1, maximumFractionDigits: 1 }) + ' M';
  }
  if (abs >= 1_000_000) {
    return (num / 1_000_000).toLocaleString('id-ID', { minimumFractionDigits: 1, maximumFractionDigits: 1 }) + ' jt';
  }
  if (abs >= 1_000) {
    return (num / 1_000).toLocaleString('id-ID', { minimumFractionDigits: 1, maximumFractionDigits: 1 }) + ' rb';
  }
  return num.toLocaleString('id-ID');
};

// Format rupiah ringkas (Rp 1,2 jt / Rp 850 rb)
export const formatCompactIDR = (n) => {
  const num = Number(n || 0);
  const abs = Math.abs(num);
  if (abs >= 1_000_000_000) {
    return 'Rp ' + (num / 1_000_000_000).toLocaleString('id-ID', { minimumFractionDigits: 1, maximumFractionDigits: 1 }) + ' M';
  }
  if (abs >= 1_000_000) {
    return 'Rp ' + (num / 1_000_000).toLocaleString('id-ID', { minimumFractionDigits: 1, maximumFractionDigits: 1 }) + ' jt';
  }
  if (abs >= 1_000) {
    return 'Rp ' + (num / 1_000).toLocaleString('id-ID', { minimumFractionDigits: 1, maximumFractionDigits: 1 }) + ' rb';
  }
  return formatIDR(num);
};

// Format persentase dengan 2 desimal
export const formatPercent = (n, includeSign = false) => {
  const num = Number(n || 0);
  const sign = includeSign && num > 0 ? '+' : '';
  return sign + num.toLocaleString('id-ID', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + '%';
};

// Format ROAS (mis. 4.88x)
export const formatRoas = (n) => {
  return Number(n || 0).toFixed(2) + 'x';
};

// Format angka standar dengan pemisah ribuan
export const formatNumber = (n) => {
  return Number(n || 0).toLocaleString('id-ID');
};
