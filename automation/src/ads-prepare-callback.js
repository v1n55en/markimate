// automation/src/ads-prepare-callback.js
// Penyiapan payload callback ke backend Markimate saat laporan selesai dibuat (PRD F5 §3.7 langkah 3)

const item = $input.first().json;

const callbackPayload = {
  requestId: item.requestId,
  reportId: item.reportId,
  status: 'ready',
  slidesUrl: item.slidesUrl,
  slidesFileId: item.slidesId,
  pdfPath: item.pdfPath,
  summary: item.summary,
  warnings: item.warnings || []
};

return [{
  json: {
    ...item,
    callbackPayload
  }
}];
