// automation/src/ads-prepare-callback.js
// Callback sukses ke backend (POST /api/ads/reports/callback, header X-Supermat-Key).
// pdfPath = tautan ekspor PDF Google Slides (bisa dibuka oleh owner/penerima yang diberi akses).

const job = $('Auth & Normalize (Ads)').first().json;
const proc = $('Parse Insight').first().json;
const render = $('Susun Request Slides').first().json;
const copy = $('Drive: Salin Base Deck').first().json;
const warnings = [...(proc.warnings || []), ...(render.warnings || [])];

const safeAll = (name) => {
  try {
    return $(name).all();
  } catch (e) {
    return []; // node tidak dieksekusi (cabang IF lain)
  }
};
const failed = (it) => it.json && (it.json.error || (it.json.statusCode && it.json.statusCode >= 400));
const imgIn = safeAll('Susun Request Gambar').filter((it) => it.json.hasImage);
safeAll('Slides: Ganti Gambar').forEach((it, i) => {
  if (failed(it)) warnings.push(`image_failed:${(imgIn[i] && imgIn[i].json.ref) || i}`);
});
const shareIn = safeAll('Daftar Akses').filter((it) => it.json.hasEmail);
safeAll('Drive: Bagikan Akses').forEach((it, i) => {
  if (failed(it)) warnings.push(`share_failed:${(shareIn[i] && shareIn[i].json.body.emailAddress) || i}`);
});
if (!shareIn.length) warnings.push('share_skipped:no_owner_email');

const id = copy.id;
return [{
  json: {
    callbackUrl: job.callbackUrl,
    callbackPayload: {
      requestId: job.requestId,
      reportId: job.reportId,
      status: 'ready',
      slidesUrl: `https://docs.google.com/presentation/d/${id}/edit`,
      slidesFileId: id,
      pdfPath: `https://docs.google.com/presentation/d/${id}/export/pdf`,
      summary: { ...proc.summary, spreadsheetId: $('Susun Data Grafik').first().json.spreadsheetId },
      aiPages: proc.aiPages || 0,
      warnings: [...new Set(warnings)].slice(0, 100)
    }
  }
}];
