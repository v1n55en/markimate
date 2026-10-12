// Fase 6 — Ambil artikel yang sudah ada (untuk dedupe) lalu keluarkan satu item per seed keyword untuk riset Trends
const N = $input.first().json;
const H = this.helpers;
__CMS__
const existingPosts = N.cmsType ? await listExistingPosts(H, N.cmsType, N.cms, { limit: 300, siteBaseUrl: N.siteBaseUrl }) : [];
return N.seeds.map(seed => ({ json: { seed, geo: N.geo, ln: N.ln, existingPosts } }));
