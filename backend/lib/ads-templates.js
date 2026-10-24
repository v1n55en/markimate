// backend/lib/ads-templates.js
// Logika Template Laporan, Metrics Custom (F5b), dan Profil Laporan (PRD F5 Langkah 4)

import crypto from 'crypto';
import { db } from '../db.js';
import {
  MARKIMATE_STANDARD_TEMPLATE,
  validateTemplate,
  calculateCredits,
  countAiPages
} from '../shared/report-template.js';
import {
  ALL_METRICS,
  validateFormula,
  evaluateFormula
} from '../shared/ads-metrics.js';

/**
 * Seed template bawaan "Markimate Standard" secara idempoten saat startup.
 */
export async function ensureDefaultReportTemplate() {
  try {
    const existing = await db.findOne('report_templates', { is_system: true, name: 'Markimate Standard' });
    if (!existing) {
      const templateId = '00000000-0000-0000-0000-000000000001';
      await db.insert('report_templates', {
        id: templateId,
        workspace_id: null,
        name: 'Markimate Standard',
        spec: MARKIMATE_STANDARD_TEMPLATE,
        is_system: true,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      });
      console.log('[Seed] Template bawaan "Markimate Standard" berhasil disemai.');
    }
  } catch (err) {
    console.warn('[Seed] Warning saat memeriksa template bawaan:', err.message);
  }
}

/**
 * Ambil daftar template yang dapat diakses oleh workspace (sistem + milik workspace).
 */
export async function listTemplates(workspaceId) {
  await ensureDefaultReportTemplate();

  const allSystem = await db.findMany('report_templates', { is_system: true });
  const allWorkspace = workspaceId ? await db.findMany('report_templates', { workspace_id: workspaceId }) : [];

  const combined = [...allSystem, ...allWorkspace];

  return combined.map((tpl) => {
    const aiPages = countAiPages(tpl.spec);
    return {
      id: tpl.id,
      name: tpl.name,
      workspace_id: tpl.workspace_id,
      is_system: Boolean(tpl.is_system),
      pagesCount: Array.isArray(tpl.spec?.pages) ? tpl.spec.pages.length : 0,
      aiPagesCount: aiPages,
      creditsEstimate: calculateCredits({ accountsCount: 1, aiPagesCount: aiPages }),
      created_at: tpl.created_at,
      updated_at: tpl.updated_at
    };
  });
}

/**
 * Ambil detail spesifikasi template berdasarkan ID.
 */
export async function getTemplateById(templateId, workspaceId) {
  await ensureDefaultReportTemplate();

  const tpl = await db.findOne('report_templates', { id: templateId });
  if (!tpl) {
    return null;
  }

  // Hanya boleh diakses jika milik workspace saat ini atau template sistem
  if (!tpl.is_system && tpl.workspace_id !== workspaceId) {
    return null;
  }

  const aiPages = countAiPages(tpl.spec);
  return {
    ...tpl,
    aiPagesCount: aiPages,
    creditsEstimate: calculateCredits({ accountsCount: 1, aiPagesCount: aiPages })
  };
}

/**
 * Buat template baru (atau duplikasi dari template yang ada).
 */
export async function createTemplate({ workspaceId, userId, name, spec, duplicateFromId }) {
  if (!workspaceId) throw new Error('workspaceId is required');
  if (!name || typeof name !== 'string' || !name.trim()) {
    return { ok: false, code: 'PARAMS_REQUIRED', message: 'Template name is required' };
  }

  let finalSpec = spec;

  // Jika duplikasi dari template lain
  if (duplicateFromId && !spec) {
    const sourceTpl = await getTemplateById(duplicateFromId, workspaceId);
    if (!sourceTpl) {
      return { ok: false, code: 'NOT_FOUND', message: 'Source template to duplicate not found' };
    }
    finalSpec = JSON.parse(JSON.stringify(sourceTpl.spec));
  }

  if (!finalSpec || typeof finalSpec !== 'object') {
    return { ok: false, code: 'INVALID_TEMPLATE', message: 'Template specification is required' };
  }

  // Ambil daftar custom metrics yang ada di workspace untuk validasi placeholder
  const customMetrics = await db.findMany('ads_custom_metrics', { workspace_id: workspaceId });
  const customMetricIds = customMetrics.map((cm) => cm.id);

  const validation = validateTemplate(finalSpec, { customMetricIds });
  if (!validation.valid) {
    return {
      ok: false,
      code: 'INVALID_TEMPLATE',
      message: 'Template validation failed',
      errors: validation.errors
    };
  }

  const newId = crypto.randomUUID();
  const newRecord = {
    id: newId,
    workspace_id: workspaceId,
    name: name.trim(),
    spec: finalSpec,
    is_system: false,
    created_by: userId,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString()
  };

  await db.insert('report_templates', newRecord);
  return { ok: true, template: newRecord };
}

/**
 * Perbarui template milik workspace (template sistem dilarang diubah).
 */
export async function updateTemplate(templateId, workspaceId, { name, spec }) {
  const tpl = await db.findOne('report_templates', { id: templateId });
  if (!tpl) {
    return { ok: false, code: 'NOT_FOUND', message: 'Template not found' };
  }

  if (tpl.is_system) {
    return { ok: false, code: 'FORBIDDEN', message: 'System standard templates cannot be modified' };
  }

  if (tpl.workspace_id !== workspaceId) {
    return { ok: false, code: 'FORBIDDEN', message: 'Access denied to update template in another workspace' };
  }

  const updates = { updated_at: new Date().toISOString() };
  if (name && typeof name === 'string') {
    updates.name = name.trim();
  }

  if (spec && typeof spec === 'object') {
    const customMetrics = await db.findMany('ads_custom_metrics', { workspace_id: workspaceId });
    const customMetricIds = customMetrics.map((cm) => cm.id);

    const validation = validateTemplate(spec, { customMetricIds });
    if (!validation.valid) {
      return {
        ok: false,
        code: 'INVALID_TEMPLATE',
        message: 'Template validation failed',
        errors: validation.errors
      };
    }
    updates.spec = spec;
  }

  await db.update('report_templates', { id: templateId }, updates);
  const updated = await db.findOne('report_templates', { id: templateId });
  return { ok: true, template: updated };
}

/**
 * Hapus template milik workspace (dilarang menghapus jika sedang dipakai oleh profil laporan).
 */
export async function deleteTemplate(templateId, workspaceId) {
  const tpl = await db.findOne('report_templates', { id: templateId });
  if (!tpl) {
    return { ok: false, code: 'NOT_FOUND', message: 'Template not found' };
  }

  if (tpl.is_system) {
    return { ok: false, code: 'FORBIDDEN', message: 'System templates cannot be deleted' };
  }

  if (tpl.workspace_id !== workspaceId) {
    return { ok: false, code: 'FORBIDDEN', message: 'Access denied' };
  }

  // Cek apakah template digunakan oleh profil laporan
  const profilesUsing = await db.findMany('report_profiles', {
    template_id: templateId,
    workspace_id: workspaceId
  });

  if (profilesUsing.length > 0) {
    return {
      ok: false,
      code: 'TEMPLATE_IN_USE',
      message: 'Template cannot be deleted because it is used by active report profiles',
      profiles: profilesUsing.map((p) => ({ id: p.id, name: p.name }))
    };
  }

  await db.remove('report_templates', { id: templateId });
  return { ok: true };
}

// =====================================================================
// CUSTOM METRICS (F5b)
// =====================================================================

/**
 * Ambil daftar metrics: semua metrics bawaan + metrics custom workspace.
 */
export async function listAllAvailableMetrics(workspaceId) {
  const custom = workspaceId ? await db.findMany('ads_custom_metrics', { workspace_id: workspaceId }) : [];

  return {
    standard: ALL_METRICS,
    custom: custom.map((cm) => ({
      id: `custom:${cm.id}`,
      rawId: cm.id,
      name: cm.name,
      formula: cm.formula,
      unit: cm.unit,
      decimals: cm.decimals,
      created_at: cm.created_at
    }))
  };
}

/**
 * Buat custom metric baru dengan validasi rumus.
 */
export async function createCustomMetric({ workspaceId, userId, name, formula, unit = 'number', decimals = 2 }) {
  if (!name || typeof name !== 'string' || !name.trim()) {
    return { ok: false, code: 'PARAMS_REQUIRED', message: 'Metric name is required' };
  }
  if (!formula || typeof formula !== 'string' || !formula.trim()) {
    return { ok: false, code: 'PARAMS_REQUIRED', message: 'Formula is required' };
  }

  const formulaValidation = validateFormula(formula);
  if (!formulaValidation.valid) {
    return {
      ok: false,
      code: 'INVALID_FORMULA',
      message: formulaValidation.error,
      position: formulaValidation.position
    };
  }

  const newId = crypto.randomUUID();
  const record = {
    id: newId,
    workspace_id: workspaceId,
    name: name.trim(),
    formula: formula.trim(),
    unit: ['currency', 'number', 'percent', 'ratio'].includes(unit) ? unit : 'number',
    decimals: typeof decimals === 'number' ? Math.max(0, Math.min(4, decimals)) : 2,
    created_by: userId,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString()
  };

  await db.insert('ads_custom_metrics', record);
  return { ok: true, metric: record };
}

/**
 * Hapus custom metric jika tidak sedang dipakai di template.
 */
export async function deleteCustomMetric(metricId, workspaceId) {
  const cm = await db.findOne('ads_custom_metrics', { id: metricId, workspace_id: workspaceId });
  if (!cm) {
    return { ok: false, code: 'NOT_FOUND', message: 'Custom metric not found' };
  }

  // Cek apakah custom metric dipakai di template milik workspace
  const templates = await db.findMany('report_templates', { workspace_id: workspaceId });
  const customRef = `custom:${metricId}`;

  for (const tpl of templates) {
    const specStr = JSON.stringify(tpl.spec || {});
    if (specStr.includes(customRef) || specStr.includes(metricId)) {
      return {
        ok: false,
        code: 'CUSTOM_METRIC_IN_USE',
        message: `Custom metric is currently used in template '${tpl.name}'`,
        template: { id: tpl.id, name: tpl.name }
      };
    }
  }

  await db.remove('ads_custom_metrics', { id: metricId });
  return { ok: true };
}

// =====================================================================
// REPORT PROFILES
// =====================================================================

/**
 * Ambil daftar profil laporan untuk suatu workspace.
 */
export async function listReportProfiles(workspaceId) {
  const profiles = await db.findMany('report_profiles', { workspace_id: workspaceId });
  const templates = await db.findMany('report_templates', {});
  const accounts = await db.findMany('ad_accounts', { workspace_id: workspaceId });

  return profiles.map((prof) => {
    const tpl = templates.find((t) => t.id === prof.template_id);
    const linkedAccounts = accounts.filter((a) => (prof.account_ids || []).includes(a.id));
    return {
      ...prof,
      template: tpl ? { id: tpl.id, name: tpl.name, is_system: tpl.is_system } : null,
      accounts: linkedAccounts.map((a) => ({ id: a.id, name: a.name, platform: a.platform, external_id: a.external_id }))
    };
  });
}

/**
 * Buat profil laporan baru (dengan validasi kepemilikan akun IDOR).
 */
export async function createReportProfile({
  workspaceId,
  userId,
  name,
  templateId,
  accountIds = [],
  datePreset = 'last_month',
  compare = true,
  conversionEvent = 'purchase',
  currency = 'IDR',
  recipients = [],
  schedule = 'none'
}) {
  if (!name || typeof name !== 'string' || !name.trim()) {
    return { ok: false, code: 'PARAMS_REQUIRED', message: 'Profile name is required' };
  }

  // Validasi template
  if (templateId) {
    const tpl = await getTemplateById(templateId, workspaceId);
    if (!tpl) {
      return { ok: false, code: 'NOT_FOUND', message: 'Selected template not found' };
    }
  }

  // Validasi IDOR akun: semua akun di accountIds harus milik workspace ini!
  if (Array.isArray(accountIds) && accountIds.length > 0) {
    const wsAccounts = await db.findMany('ad_accounts', { workspace_id: workspaceId });
    const wsAccountIds = new Set(wsAccounts.map((a) => a.id));

    for (const accId of accountIds) {
      if (!wsAccountIds.has(accId)) {
        return {
          ok: false,
          code: 'FORBIDDEN',
          message: `Ad account '${accId}' does not belong to this workspace (IDOR protection)`
        };
      }
    }
  }

  const newId = crypto.randomUUID();
  const profile = {
    id: newId,
    workspace_id: workspaceId,
    name: name.trim(),
    template_id: templateId || null,
    account_ids: Array.isArray(accountIds) ? accountIds : [],
    date_preset: datePreset,
    compare: Boolean(compare),
    conversion_event: conversionEvent || 'purchase',
    currency: currency || 'IDR',
    recipients: Array.isArray(recipients) ? recipients : [],
    schedule: schedule === 'monthly' ? 'monthly' : 'none',
    next_run_at: schedule === 'monthly' ? new Date().toISOString() : null,
    created_by: userId,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString()
  };

  await db.insert('report_profiles', profile);
  return { ok: true, profile };
}

/**
 * Perbarui profil laporan dengan validasi IDOR.
 */
export async function updateReportProfile(profileId, workspaceId, fields = {}) {
  const profile = await db.findOne('report_profiles', { id: profileId, workspace_id: workspaceId });
  if (!profile) {
    return { ok: false, code: 'NOT_FOUND', message: 'Report profile not found' };
  }

  // Cek IDOR account_ids bila diubah
  if (Array.isArray(fields.accountIds)) {
    const wsAccounts = await db.findMany('ad_accounts', { workspace_id: workspaceId });
    const wsAccountIds = new Set(wsAccounts.map((a) => a.id));

    for (const accId of fields.accountIds) {
      if (!wsAccountIds.has(accId)) {
        return {
          ok: false,
          code: 'FORBIDDEN',
          message: `Ad account '${accId}' does not belong to this workspace (IDOR protection)`
        };
      }
    }
  }

  const updates = { updated_at: new Date().toISOString() };
  if (fields.name) updates.name = fields.name.trim();
  if (fields.templateId !== undefined) updates.template_id = fields.templateId;
  if (fields.accountIds !== undefined) updates.account_ids = fields.accountIds;
  if (fields.datePreset !== undefined) updates.date_preset = fields.datePreset;
  if (fields.compare !== undefined) updates.compare = Boolean(fields.compare);
  if (fields.conversionEvent !== undefined) updates.conversion_event = fields.conversionEvent;
  if (fields.currency !== undefined) updates.currency = fields.currency;
  if (fields.recipients !== undefined) updates.recipients = fields.recipients;
  if (fields.schedule !== undefined) {
    updates.schedule = fields.schedule === 'monthly' ? 'monthly' : 'none';
    updates.next_run_at = fields.schedule === 'monthly' ? new Date().toISOString() : null;
  }

  await db.update('report_profiles', { id: profileId }, updates);
  const updated = await db.findOne('report_profiles', { id: profileId });
  return { ok: true, profile: updated };
}

/**
 * Hapus profil laporan.
 */
export async function deleteReportProfile(profileId, workspaceId) {
  const profile = await db.findOne('report_profiles', { id: profileId, workspace_id: workspaceId });
  if (!profile) {
    return { ok: false, code: 'NOT_FOUND', message: 'Report profile not found' };
  }
  await db.remove('report_profiles', { id: profileId });
  return { ok: true };
}
