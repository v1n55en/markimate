// automation/src/ads-deck-check-input.js
// Validasi input workflow "Markimate Ads Deck Check". API key sudah dicek node Webhook (Header Auth).

const body = $input.first().json.body || $input.first().json;
const raw = typeof body.presentationId === 'string' ? body.presentationId.trim() : '';
const m = raw.match(/\/presentation\/(?:u\/\d+\/)?d\/([A-Za-z0-9_-]+)/);
const id = m ? m[1] : raw;

if (!/^[A-Za-z0-9_-]{20,100}$/.test(id)) {
  return [{ json: { ok: false, statusCode: 400, error: 'presentationId is invalid' } }];
}
return [{ json: { ok: true, presentationId: id } }];
