import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { randomUUID } from 'crypto';
import dotenv from 'dotenv';
import { createClient } from '@supabase/supabase-js';

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
  'oauth_pending_links'
];

const log = (msg) => console.log(`[${new Date().toISOString()}] ${msg}`);

function makeSupabase() {
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
  constructor() {
    this.file = path.join(__dirname, 'database.json');
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
      webhook_events: []
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
  _match(row, where) { return Object.entries(where).every(([k, v]) => row[k] === v); }
  async findOne(table, where) { return (this.data[table] || []).find(r => this._match(r, where)) || null; }
  async findMany(table, where = {}, opts = {}) {
    let rows = (this.data[table] || []).filter(r => this._match(r, where));
    if (opts.orderBy) rows = rows.sort((a, b) => (a[opts.orderBy] < b[opts.orderBy] ? 1 : -1) * (opts.ascending ? -1 : 1));
    if (opts.limit && opts.limit > 0) rows = rows.slice(0, opts.limit);
    return rows;
  }
  async insert(table, row) { if (!this.data[table]) this.data[table] = []; const r = { id: row.id || randomUUID(), created_at: new Date().toISOString(), ...row }; this.data[table].push(r); this.save(); return r; }
  async update(table, where, patch) { const rows = (this.data[table] || []).filter(r => this._match(r, where)); rows.forEach(r => Object.assign(r, patch, { updated_at: new Date().toISOString() })); this.save(); return rows[0] || null; }
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
    return true;
  }
}

// ---------- Supabase ----------
class SupabaseStore {
  constructor(client) { this.c = client; }
  _q(table, where) { let q = this.c.from(table).select('*'); for (const [k, v] of Object.entries(where)) q = q.eq(k, v); return q; }
  async findOne(table, where) { const { data, error } = await this._q(table, where).limit(1); if (error) throw new Error(`${table}: ${error.message}`); return data[0] || null; }
  async findMany(table, where = {}, opts = {}) { let q = this._q(table, where); if (opts.orderBy) q = q.order(opts.orderBy, { ascending: !!opts.ascending }); if (opts.limit) q = q.limit(opts.limit); const { data, error } = await q; if (error) throw new Error(`${table}: ${error.message}`); return data; }
  async insert(table, row) { const { data, error } = await this.c.from(table).insert(row).select().single(); if (error) throw new Error(`${table}: ${error.message}`); return data; }
  async update(table, where, patch) { let q = this.c.from(table).update({ ...patch, updated_at: new Date().toISOString() }); for (const [k, v] of Object.entries(where)) q = q.eq(k, v); const { data, error } = await q.select(); if (error) throw new Error(`${table}: ${error.message}`); return data[0] || null; }
  async upsert(table, where, row) { const ex = await this.findOne(table, where); return ex ? this.update(table, where, row) : this.insert(table, { ...where, ...row }); }
  async remove(table, where) { let q = this.c.from(table).delete(); for (const [k, v] of Object.entries(where)) q = q.eq(k, v); const { error, count } = await q; if (error) throw new Error(`${table}: ${error.message}`); return count ?? 1; }
  async rpc(name, params = {}) {
    const { data, error } = await this.c.rpc(name, params);
    if (error) throw new Error(`rpc ${name}: ${error.message}`);
    return data;
  }
}

const sb = makeSupabase();
export const db = sb ? new SupabaseStore(sb) : new JsonStore();
export const dbMode = sb ? 'supabase' : 'json';
export { TABLES };
