import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { randomUUID } from 'crypto';
import dotenv from 'dotenv';
import { createClient } from '@supabase/supabase-js';
import { validateRowContract } from './lib/schema-contract.js';

dotenv.config();

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const TABLES = [
  'accounts',
  'cms_connections',
  'keywords',
  'subscriptions',
  'seo_topic_sources',
  'credit_prices',
  'credit_wallets',
  'credit_ledger',
  'credit_cost_rates',
  'credit_trials',
  'credit_alerts',
  'credit_orders',
  // Tabel baru untuk F1 & F2 (Auth, Sesi, Workspace & Entitlement)
  'schema_migrations',
  'email_verifications',
  'password_resets',
  'refresh_tokens',
  'rate_limits',
  'workspaces',
  'workspace_members',
  'workspace_invites',
  'module_entitlements',
  'workspace_api_keys',
  'audit_logs',
  'webhook_events',
  'oauth_pending_links',
  'payments',
  'monthly_grants',
  // Tabel baru PRD F5 (Ads Report & Template Builder)
  'ad_connections',
  'ad_accounts',
  'report_templates',
  'ads_custom_metrics',
  'report_profiles',
  'ad_reports'
];

const log = (msg) => console.log(`[${new Date().toISOString()}] ${msg}`);

function makeSupabase() {
  if (process.env.NODE_ENV === 'test' || process.env.FORCE_LOCAL_DB === 'true') return null;
  const url = process.env.SUPABASE_URL, key = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_KEY;
  if (!url || !key || url.includes('placeholder') || key.includes('placeholder')) return null;
  const schema = process.env.SUPABASE_SCHEMA || 'public';
  if (schema === 'supermat') {
    log('[DB] PERINGATAN: SUPABASE_SCHEMA masih "supermat". Harap migrasikan ke "markimate"!');
  }
  try { const c = createClient(url, key, { auth: { persistSession: false }, db: { schema } }); log(`[DB] Supabase: ${url} (schema ${schema})`); return c; } catch (e) { log(`[DB] Supabase gagal init: ${e.message}`); return null; }
}

// ---------- Fallback JSON (hanya untuk dev lokal; Vercel tidak menyimpan file) ----------
class JsonStore {
  constructor(filePath) {
    this.file = filePath || process.env.DB_JSON_PATH || path.join(__dirname, 'database.json');
    this.data = {
      accounts: [],
      cms_connections: [],
      keywords: [],
      subscriptions: [],
      seo_topic_sources: [],
      credit_prices: [],
      credit_wallets: [],
      credit_ledger: [],
      credit_cost_rates: [],
      credit_trials: [],
      credit_alerts: [],
      credit_orders: [],
      schema_migrations: [],
      email_verifications: [],
      password_resets: [],
      refresh_tokens: [],
      rate_limits: [],
      workspaces: [],
      workspace_members: [],
      workspace_invites: [],
      module_entitlements: [],
      workspace_api_keys: [],
      audit_logs: [],
      webhook_events: [],
      oauth_pending_links: [],
      payments: [],
      monthly_grants: [],
      ad_connections: [],
      ad_accounts: [],
      report_templates: [],
      ads_custom_metrics: [],
      report_profiles: [],
      ad_reports: []
    };
    try {
      if (fs.existsSync(this.file)) {
        const loaded = JSON.parse(fs.readFileSync(this.file, 'utf8'));
        Object.assign(this.data, loaded);
        for (const t of TABLES) {
          if (!this.data[t]) this.data[t] = [];
        }
      }
    } catch (e) { log(`[DB] database.json rusak: ${e.message}`); }
    log('[DB] Mode fallback database.json (tanpa Supabase)');
  }
  save() { try { fs.writeFileSync(this.file, JSON.stringify(this.data, null, 2)); } catch (e) { log(`[DB] gagal tulis database.json: ${e.message}`); } }
  _match(row, where) {
    return Object.entries(where).every(([k, v]) => row[k] === v || (v === null && (row[k] === undefined || row[k] === null)));
  }
  async findOne(table, where) { return (this.data[table] || []).find(r => this._match(r, where)) || null; }
  async findMany(table, where = {}, opts = {}) {
    let rows = (this.data[table] || []).filter(r => this._match(r, where));
    if (opts.orderBy) rows = rows.sort((a, b) => (a[opts.orderBy] < b[opts.orderBy] ? 1 : -1) * (opts.ascending ? -1 : 1));
    if (opts.limit && opts.limit > 0) rows = rows.slice(0, opts.limit);
    return rows;
  }
  async insert(table, row) {
    if (process.env.SCHEMA_CONTRACT_VALIDATION === 'true') {
      validateRowContract(table, row, true);
    }
    if (!this.data[table]) this.data[table] = [];
    const r = { id: row.id || randomUUID(), created_at: new Date().toISOString(), ...row };
    this.data[table].push(r);
    this.save();
    return r;
  }
  async update(table, where, patch) {
    if (process.env.SCHEMA_CONTRACT_VALIDATION === 'true') {
      validateRowContract(table, patch, false);
    }
    const rows = (this.data[table] || []).filter(r => this._match(r, where));
    rows.forEach(r => Object.assign(r, patch, { updated_at: new Date().toISOString() }));
    this.save();
    return rows[0] || null;
  }
  async claim(table, id, patch, nullColumn = 'fulfilled_at') {
    if (process.env.SCHEMA_CONTRACT_VALIDATION === 'true') {
      validateRowContract(table, patch, false);
    }
    const row = (this.data[table] || []).find(r => r.id === id && (r[nullColumn] === undefined || r[nullColumn] === null));
    if (!row) return null;
    Object.assign(row, patch, { updated_at: new Date().toISOString() });
    this.save();
    return row;
  }
  async upsert(table, where, row) { const ex = await this.findOne(table, where); return ex ? this.update(table, where, row) : this.insert(table, { ...where, ...row }); }
  async remove(table, where) { const before = (this.data[table] || []).length; this.data[table] = (this.data[table] || []).filter(r => !this._match(r, where)); this.save(); return before - this.data[table].length; }
  async rpc(name, params = {}) {
    if (name === 'hit_rate_limit') {
      const key = params.p_key;
      const windowSec = params.p_window_seconds || 60;
      const max = params.p_max || 10;
      const now = Date.now();
      if (!this.data.rate_limits) this.data.rate_limits = [];
      let record = this.data.rate_limits.find(r => r.key === key);
      if (!record) {
        record = { key, window_start: new Date(now).toISOString(), count: 1 };
        this.data.rate_limits.push(record);
        this.save();
        return true;
      }
      const startMs = new Date(record.window_start).getTime();
      if (now - startMs > windowSec * 1000) {
        record.window_start = new Date(now).toISOString();
        record.count = 1;
        this.save();
        return true;
      }
      record.count += 1;
      this.save();
      return record.count <= max;
    }

    if (name === 'charge_wallet_atomic') {
      const {
        p_workspace_id, p_need, p_action_key,
        p_ref_type, p_ref_id, p_usage, p_cost_actual_idr, p_note
      } = params;

      if (!p_need || p_need <= 0) {
        return { success: true, charged: 0, idempotent: false };
      }

      // 1. Cek Idempotensi
      if (p_ref_type && p_ref_id) {
        const existing = (this.data.credit_ledger || []).find(r =>
          r.workspace_id === p_workspace_id &&
          r.action_key === p_action_key &&
          r.ref_type === p_ref_type &&
          r.ref_id === String(p_ref_id) &&
          r.kind === 'usage'
        );
        if (existing) {
          return {
            success: true,
            idempotent: true,
            charged: 0,
            note: 'Idempoten: sudah pernah dipotong sebelumnya.'
          };
        }
      }

      // 2. Ambil/buat wallet
      if (!this.data.credit_wallets) this.data.credit_wallets = [];
      let wallet = this.data.credit_wallets.find(w => w.workspace_id === p_workspace_id);
      if (!wallet) {
        wallet = {
          id: randomUUID(),
          workspace_id: p_workspace_id,
          balance_trial: 0,
          trial_expires_at: null,
          balance_sub: 0,
          sub_expires_at: null,
          balance_topup: 0,
          topup_expires_at: null,
          daily_cap: 500,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        };
        this.data.credit_wallets.push(wallet);
      }

      const now = new Date();
      const trialValid = wallet.balance_trial > 0 && (!wallet.trial_expires_at || new Date(wallet.trial_expires_at) > now);
      const subValid = wallet.balance_sub > 0 && (!wallet.sub_expires_at || new Date(wallet.sub_expires_at) > now);
      const topupValid = wallet.balance_topup > 0 && (!wallet.topup_expires_at || new Date(wallet.topup_expires_at) > now);

      const activeTrial = trialValid ? Number(wallet.balance_trial) : 0;
      const activeSub = subValid ? Number(wallet.balance_sub) : 0;
      const activeTopup = topupValid ? Number(wallet.balance_topup) : 0;
      const totalBalance = activeTrial + activeSub + activeTopup;

      if (totalBalance < p_need) {
        return {
          success: false,
          error: 'INSUFFICIENT_CREDITS',
          need: p_need,
          have: totalBalance
        };
      }

      let remaining = p_need;
      let deductTrial = 0;
      let deductSub = 0;
      let deductTopup = 0;

      if (trialValid && remaining > 0) {
        deductTrial = Math.min(activeTrial, remaining);
        remaining -= deductTrial;
      }
      if (subValid && remaining > 0) {
        deductSub = Math.min(activeSub, remaining);
        remaining -= deductSub;
      }
      if (topupValid && remaining > 0) {
        deductTopup = Math.min(activeTopup, remaining);
        remaining -= deductTopup;
      }

      const oldTrial = wallet.balance_trial;
      const oldSub = wallet.balance_sub;
      const oldTopup = wallet.balance_topup;

      wallet.balance_trial -= deductTrial;
      wallet.balance_sub -= deductSub;
      wallet.balance_topup -= deductTopup;
      wallet.updated_at = new Date().toISOString();

      if (!this.data.credit_ledger) this.data.credit_ledger = [];
      let rolling = totalBalance;
      const ledgerRows = [];

      const deductions = [
        { bucket: 'trial', amt: deductTrial },
        { bucket: 'sub', amt: deductSub },
        { bucket: 'topup', amt: deductTopup }
      ].filter(d => d.amt > 0);

      try {
        for (let i = 0; i < deductions.length; i++) {
          const d = deductions[i];
          rolling -= d.amt;
          const isFirst = i === 0;
          const row = await this.insert('credit_ledger', {
            workspace_id: p_workspace_id,
            delta: -d.amt,
            bucket: d.bucket,
            kind: 'usage',
            action_key: p_action_key,
            ref_type: p_ref_type || null,
            ref_id: p_ref_id ? String(p_ref_id) : null,
            balance_after: rolling,
            usage: isFirst ? p_usage || null : null,
            cost_actual_idr: isFirst ? Number(p_cost_actual_idr || 0) : 0,
            note: p_note || `Pemakaian ${p_action_key}`
          });
          ledgerRows.push(row);
        }
        return {
          success: true,
          idempotent: false,
          charged: p_need,
          balance_after: rolling,
          ledgerRows,
          deductions: { trial: deductTrial, sub: deductSub, topup: deductTopup }
        };
      } catch (err) {
        wallet.balance_trial = oldTrial;
        wallet.balance_sub = oldSub;
        wallet.balance_topup = oldTopup;
        for (const row of ledgerRows) {
          const idx = (this.data.credit_ledger || []).findIndex(r => r.id === row.id);
          if (idx !== -1) this.data.credit_ledger.splice(idx, 1);
        }
        throw err;
      }
    }

    if (name === 'grant_wallet_atomic') {
      const {
        p_workspace_id, p_bucket, p_amount, p_expires_at,
        p_kind, p_action_key, p_ref_type, p_ref_id, p_note
      } = params;

      const amt = Number(p_amount || 0);
      if (amt <= 0) throw new Error('Credit amount must be positive.');
      if (!['trial', 'sub', 'topup'].includes(p_bucket)) {
        throw new Error(`Invalid bucket: ${p_bucket}. Must be 'trial' | 'sub' | 'topup'.`);
      }

      // Idempotensi sinkron
      if (p_ref_id) {
        const existing = (this.data.credit_ledger || []).find(r =>
          r.workspace_id === p_workspace_id &&
          r.ref_id === String(p_ref_id) &&
          (r.kind === p_kind || (r.delta && r.delta > 0))
        );
        if (existing) {
          const w = (this.data.credit_wallets || []).find(w => w.workspace_id === p_workspace_id);
          const total = w ? Number(w.balance_trial || 0) + Number(w.balance_sub || 0) + Number(w.balance_topup || 0) : 0;
          return {
            success: true,
            idempotent: true,
            ledgerRow: existing,
            total_balance: total
          };
        }
      }

      if (!this.data.credit_wallets) this.data.credit_wallets = [];
      let wallet = this.data.credit_wallets.find(w => w.workspace_id === p_workspace_id);
      if (!wallet) {
        wallet = {
          id: randomUUID(),
          workspace_id: p_workspace_id,
          balance_trial: 0,
          trial_expires_at: null,
          balance_sub: 0,
          sub_expires_at: null,
          balance_topup: 0,
          topup_expires_at: null,
          daily_cap: 500,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        };
        this.data.credit_wallets.push(wallet);
      }

      const expIso = p_expires_at instanceof Date ? p_expires_at.toISOString() : (p_expires_at || null);
      const oldTrial = wallet.balance_trial;
      const oldTrialExp = wallet.trial_expires_at;
      const oldSub = wallet.balance_sub;
      const oldSubExp = wallet.sub_expires_at;
      const oldTopup = wallet.balance_topup;
      const oldTopupExp = wallet.topup_expires_at;

      if (p_bucket === 'trial') {
        wallet.balance_trial = Number(wallet.balance_trial || 0) + amt;
        wallet.trial_expires_at = expIso;
      } else if (p_bucket === 'sub') {
        wallet.balance_sub = amt; // overwrite / reset
        wallet.sub_expires_at = expIso;
      } else if (p_bucket === 'topup') {
        wallet.balance_topup = Number(wallet.balance_topup || 0) + amt;
        wallet.topup_expires_at = expIso;
      }
      wallet.updated_at = new Date().toISOString();

      const totalAfter = Number(wallet.balance_trial || 0) + Number(wallet.balance_sub || 0) + Number(wallet.balance_topup || 0);
      const defaultActionKey = p_kind === 'grant_trial' ? 'auth.trial' : (p_bucket === 'sub' ? 'billing.sub' : 'billing.topup');

      try {
        const row = await this.insert('credit_ledger', {
          workspace_id: p_workspace_id,
          delta: amt,
          bucket: p_bucket,
          kind: p_kind || 'topup',
          action_key: p_action_key || defaultActionKey,
          ref_type: p_ref_type || null,
          ref_id: p_ref_id ? String(p_ref_id) : null,
          balance_after: totalAfter,
          usage: null,
          cost_actual_idr: 0,
          note: p_note || `Grant ${p_bucket} +${amt}`
        });

        return {
          success: true,
          idempotent: false,
          delta: amt,
          total_balance: totalAfter,
          ledgerRow: row,
          wallet
        };
      } catch (err) {
        wallet.balance_trial = oldTrial;
        wallet.trial_expires_at = oldTrialExp;
        wallet.balance_sub = oldSub;
        wallet.sub_expires_at = oldSubExp;
        wallet.balance_topup = oldTopup;
        wallet.topup_expires_at = oldTopupExp;
        throw err;
      }
    }

    if (name === 'apply_monthly_grant_atomic') {
      const { p_workspace_id, p_period, p_credits, p_expires_at } = params;
      const credits = Number(p_credits || 0);
      if (credits <= 0) {
        return { success: true, granted: false, credits: 0 };
      }

      if (!this.data.monthly_grants) this.data.monthly_grants = [];
      let existingGrant = this.data.monthly_grants.find(g =>
        g.workspace_id === p_workspace_id && g.period === p_period
      );

      if (!this.data.credit_wallets) this.data.credit_wallets = [];
      let wallet = this.data.credit_wallets.find(w => w.workspace_id === p_workspace_id);
      if (!wallet) {
        wallet = {
          id: randomUUID(),
          workspace_id: p_workspace_id,
          balance_trial: 0,
          trial_expires_at: null,
          balance_sub: 0,
          sub_expires_at: null,
          balance_topup: 0,
          topup_expires_at: null,
          daily_cap: 500,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        };
        this.data.credit_wallets.push(wallet);
      }

      const expIso = p_expires_at instanceof Date ? p_expires_at.toISOString() : (p_expires_at || null);

      if (existingGrant) {
        if (existingGrant.credits >= credits) {
          const totalAfter = Number(wallet.balance_trial || 0) + Number(wallet.balance_sub || 0) + Number(wallet.balance_topup || 0);
          return {
            success: true,
            granted: false,
            already_granted: true,
            credits: existingGrant.credits,
            total_balance: totalAfter
          };
        }

        // Upgrade kuota di tengah bulan
        const diff = credits - existingGrant.credits;
        existingGrant.credits = credits;
        wallet.balance_sub = Number(wallet.balance_sub || 0) + diff;
        wallet.sub_expires_at = expIso;
        wallet.updated_at = new Date().toISOString();

        const totalAfter = Number(wallet.balance_trial || 0) + Number(wallet.balance_sub || 0) + Number(wallet.balance_topup || 0);

        const ledgerRow = await this.insert('credit_ledger', {
          workspace_id: p_workspace_id,
          delta: diff,
          bucket: 'sub',
          kind: 'grant_monthly',
          action_key: 'billing.monthly_grant',
          ref_type: 'monthly_grant',
          ref_id: `${p_period}_upgrade`,
          balance_after: totalAfter,
          usage: null,
          cost_actual_idr: 0,
          note: `Penambahan kuota modul baru periode ${p_period} (+${diff} credit)`
        });

        return {
          success: true,
          granted: true,
          upgraded: true,
          diff,
          credits,
          total_balance: totalAfter,
          ledgerRow
        };
      }

      // Grant awal periode
      const newGrant = {
        workspace_id: p_workspace_id,
        period: p_period,
        credits,
        granted_at: new Date().toISOString()
      };
      this.data.monthly_grants.push(newGrant);

      wallet.balance_sub = credits;
      wallet.sub_expires_at = expIso;
      wallet.updated_at = new Date().toISOString();

      const totalAfter = Number(wallet.balance_trial || 0) + Number(wallet.balance_sub || 0) + Number(wallet.balance_topup || 0);

      const ledgerRow = await this.insert('credit_ledger', {
        workspace_id: p_workspace_id,
        delta: credits,
        bucket: 'sub',
        kind: 'grant_monthly',
        action_key: 'billing.monthly_grant',
        ref_type: 'monthly_grant',
        ref_id: p_period,
        balance_after: totalAfter,
        usage: null,
        cost_actual_idr: 0,
        note: `Kredit modul bulanan periode ${p_period}`
      });

      return {
        success: true,
        granted: true,
        credits,
        total_balance: totalAfter,
        ledgerRow
      };
    }

    if (name === 'expire_buckets_atomic') {
      const { p_workspace_id } = params || {};
      const now = new Date();
      if (!this.data.credit_wallets) this.data.credit_wallets = [];
      if (!this.data.credit_ledger) this.data.credit_ledger = [];

      let wallets = p_workspace_id
        ? this.data.credit_wallets.filter(w => w.workspace_id === p_workspace_id)
        : this.data.credit_wallets;

      let walletsAffected = 0;
      let totalExpired = 0;

      for (const w of wallets) {
        let expTrial = 0;
        let expSub = 0;
        let expTopup = 0;

        if (Number(w.balance_trial || 0) > 0 && w.trial_expires_at && new Date(w.trial_expires_at) <= now) {
          expTrial = Number(w.balance_trial);
          w.balance_trial = 0;
        }

        if (Number(w.balance_sub || 0) > 0 && w.sub_expires_at && new Date(w.sub_expires_at) <= now) {
          expSub = Number(w.balance_sub);
          w.balance_sub = 0;
        }

        if (Number(w.balance_topup || 0) > 0 && w.topup_expires_at && new Date(w.topup_expires_at) <= now) {
          expTopup = Number(w.balance_topup);
          w.balance_topup = 0;
        }

        if (expTrial > 0 || expSub > 0 || expTopup > 0) {
          w.updated_at = new Date().toISOString();
          const totalAfter = Number(w.balance_trial || 0) + Number(w.balance_sub || 0) + Number(w.balance_topup || 0);

          if (expTrial > 0) {
            await this.insert('credit_ledger', {
              workspace_id: w.workspace_id,
              delta: -expTrial,
              bucket: 'trial',
              kind: 'expire',
              action_key: null,
              ref_type: null,
              ref_id: null,
              balance_after: totalAfter + expSub + expTopup,
              usage: null,
              cost_actual_idr: 0,
              note: 'Trial 30 hari kadaluarsa'
            });
          }

          if (expSub > 0) {
            await this.insert('credit_ledger', {
              workspace_id: w.workspace_id,
              delta: -expSub,
              bucket: 'sub',
              kind: 'expire',
              action_key: null,
              ref_type: null,
              ref_id: null,
              balance_after: totalAfter + expTopup,
              usage: null,
              cost_actual_idr: 0,
              note: 'Kredit bulanan modul kadaluarsa'
            });
          }

          if (expTopup > 0) {
            await this.insert('credit_ledger', {
              workspace_id: w.workspace_id,
              delta: -expTopup,
              bucket: 'topup',
              kind: 'expire',
              action_key: null,
              ref_type: null,
              ref_id: null,
              balance_after: totalAfter,
              usage: null,
              cost_actual_idr: 0,
              note: 'Topup 365 hari kadaluarsa'
            });
          }

          walletsAffected++;
          totalExpired += (expTrial + expSub + expTopup);
        }
      }

      return {
        success: true,
        wallets_affected: walletsAffected,
        total_expired: totalExpired
      };
    }

    return true;
  }
  async expireBucket(workspaceId, bucket, nowIso) {
    const expiresCol = `${bucket}_expires_at`;
    const balanceCol = `balance_${bucket}`;
    const nowTime = new Date(nowIso).getTime();
    if (!this.data.credit_wallets) return [];
    const updatedRows = [];
    for (const w of this.data.credit_wallets) {
      if (workspaceId && w.workspace_id !== workspaceId) continue;
      const exp = w[expiresCol];
      const bal = Number(w[balanceCol]) || 0;
      if (bal > 0 && exp && new Date(exp).getTime() <= nowTime) {
        const oldBal = bal;
        w[balanceCol] = 0;
        w.updated_at = nowIso;
        updatedRows.push({ ...w, expiredAmount: oldBal });
      }
    }
    if (updatedRows.length > 0) this.save();
    return updatedRows;
  }
}

// ---------- Supabase ----------
class SupabaseStore {
  constructor(client) { this.c = client; }
  _applyFilters(q, where = {}) {
    for (const [k, v] of Object.entries(where)) {
      if (v === null) {
        q = q.is(k, null);
      } else {
        q = q.eq(k, v);
      }
    }
    return q;
  }
  _q(table, where) {
    let q = this.c.from(table).select('*');
    return this._applyFilters(q, where);
  }
  async findOne(table, where) { const { data, error } = await this._q(table, where).limit(1); if (error) throw new Error(`${table}: ${error.message}`); return data[0] || null; }
  async findMany(table, where = {}, opts = {}) {
    let q = this._q(table, where);
    if (opts.orderBy) q = q.order(opts.orderBy, { ascending: !!opts.ascending });
    if (opts.limit) q = q.limit(opts.limit);
    const { data, error } = await q;
    if (error) throw new Error(`${table}: ${error.message}`);
    return data;
  }
  async insert(table, row) { const { data, error } = await this.c.from(table).insert(row).select().single(); if (error) throw new Error(`${table}: ${error.message}`); return data; }
  async update(table, where, patch) {
    let q = this.c.from(table).update({ ...patch, updated_at: new Date().toISOString() });
    q = this._applyFilters(q, where);
    const { data, error } = await q.select();
    if (error) throw new Error(`${table}: ${error.message}`);
    return data[0] || null;
  }
  async claim(table, id, patch, nullColumn = 'fulfilled_at') {
    let q = this.c.from(table).update({ ...patch, updated_at: new Date().toISOString() }).eq('id', id).is(nullColumn, null);
    const { data, error } = await q.select();
    if (error) throw new Error(`${table}: ${error.message}`);
    return data && data.length > 0 ? data[0] : null;
  }
  async upsert(table, where, row) { const ex = await this.findOne(table, where); return ex ? this.update(table, where, row) : this.insert(table, { ...where, ...row }); }
  async remove(table, where) {
    let q = this.c.from(table).delete({ count: 'exact' });
    q = this._applyFilters(q, where);
    const { error, count } = await q;
    if (error) throw new Error(`${table}: ${error.message}`);
    return count ?? 0;
  }
  async expireBucket(workspaceId, bucket, nowIso) {
    const expiresCol = `${bucket}_expires_at`;
    const balanceCol = `balance_${bucket}`;
    let qSelect = this.c.from('credit_wallets')
      .select('workspace_id, balance_trial, balance_sub, balance_topup, ' + expiresCol)
      .lte(expiresCol, nowIso)
      .gt(balanceCol, 0);
    if (workspaceId) {
      qSelect = qSelect.eq('workspace_id', workspaceId);
    }
    const { data: targets, error: selErr } = await qSelect;
    if (selErr) throw selErr;
    if (!targets || targets.length === 0) return [];

    const results = [];
    for (const t of targets) {
      const oldAmount = Number(t[balanceCol]) || 0;
      let qUpdate = this.c.from('credit_wallets')
        .update({ [balanceCol]: 0, updated_at: nowIso })
        .eq('workspace_id', t.workspace_id)
        .lte(expiresCol, nowIso)
        .gt(balanceCol, 0)
        .select();
      const { data: updated, error: updErr } = await qUpdate;
      if (updErr) throw updErr;
      if (updated && updated.length > 0) {
        results.push({ ...updated[0], expiredAmount: oldAmount });
      }
    }
    return results;
  }
  async rpc(name, params = {}) {
    const { data, error } = await this.c.rpc(name, params);
    if (error) {
      const err = new Error(`rpc ${name}: ${error.message}`);
      err.code = error.code;
      err.details = error.details;
      err.hint = error.hint;
      throw err;
    }
    return data;
  }
}

const sb = makeSupabase();
export const db = sb ? new SupabaseStore(sb) : new JsonStore();
export const dbMode = sb ? 'supabase' : 'json';
export { TABLES, JsonStore, SupabaseStore };
