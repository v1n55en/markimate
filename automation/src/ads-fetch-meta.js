// automation/src/ads-fetch-meta.js
// Penyiapan dan pemanggilan data Meta Insights API (PRD F5 §3.7)

const input = $input.first().json;
const { accounts, period, prevPeriod, needsTrends, needsBreakdowns, needsCampaigns, needsCreatives, conversionEvent } = input;
const warnings = [...(input.warnings || [])];

// Struktur penampung data per akun
const fetchedData = {
  accounts: [],
  accountSummaries: [],
  prevSummaries: [],
  dailyTrends: [],
  monthlyTrends: [],
  campaigns: [],
  breakdowns: {
    objective: [],
    platform: [],
    demographics: []
  },
  creatives: []
};

// Iterasi setiap akun iklan Meta yang dihubungkan
for (const acc of accounts) {
  if (acc.platform !== 'meta') {
    warnings.push(`Platform ${acc.platform} is not currently supported in this phase`);
    continue;
  }

  const actId = acc.externalId.startsWith('act_') ? acc.externalId : `act_${acc.externalId}`;
  const token = acc.accessToken;

  // Jika tidak ada token (misal dry-run / mock testing fixture):
  if (!token || token.startsWith('demo_') || token.startsWith('mock_')) {
    // Generate data representatif untuk keperluan fixture / testing
    fetchedData.accounts.push({ id: actId, name: acc.name || 'Account ' + actId, currency: acc.currency || 'IDR' });
    fetchedData.accountSummaries.push({
      account_id: actId,
      spend: 15400000,
      impressions: 480000,
      reach: 320000,
      clicks: 12500,
      inline_link_clicks: 9800,
      actions: [{ action_type: conversionEvent, value: 340 }],
      action_values: [{ action_type: conversionEvent, value: 58500000 }]
    });
    fetchedData.prevSummaries.push({
      account_id: actId,
      spend: 14200000,
      impressions: 440000,
      reach: 290000,
      clicks: 11200,
      inline_link_clicks: 8900,
      actions: [{ action_type: conversionEvent, value: 295 }],
      action_values: [{ action_type: conversionEvent, value: 51000000 }]
    });
    continue;
  }

  // Parameter umum Meta Insights API
  const baseUrl = `https://graph.facebook.com/v21.0/${actId}`;
  const headers = { Authorization: `Bearer ${token}` };

  // Catatan: Pada n8n node, fetch dipanggil secara terisolasi atau dieksekusi HTTP node.
  // Kode ini menampung schema dan parsing normalisasi response dari Graph API v21.0.
  fetchedData.accounts.push({
    id: actId,
    name: acc.name || actId,
    currency: acc.currency || 'IDR',
    endpoint: `${baseUrl}/insights`,
    params: {
      time_range: JSON.stringify({ since: period.start, until: period.end }),
      fields: 'spend,impressions,reach,clicks,inline_link_clicks,actions,action_values'
    }
  });
}

return [{
  json: {
    ...input,
    fetchedData,
    warnings
  }
}];
