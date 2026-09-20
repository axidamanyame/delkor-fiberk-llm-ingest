/** List rows: try Supabase, fall back to localStorage so Settings pages work without extra SQL. */
import { supabase } from './supabaseClient.js';
import { peelWrite } from './account-rules.js';
import { promptDeleteKey, logCrud } from './delete-guard.js';
import { applyDataScope } from './data-scope.js';
import { normaliseScopes } from './legacy-scope-map.js';
import { isSupabaseJob, isUpostJob } from './job-catalog.js';
import { actionNeed } from './menu-perms.js';

export function uid() {
  return (crypto.randomUUID && crypto.randomUUID()) || ('id-' + Date.now() + '-' + Math.random().toString(16).slice(2));
}

export function esc(s) {
  return String(s ?? '').replace(/[&<>"']/g, (c) => {
    if (c === '&') return '&' + 'amp;';
    if (c === '<') return '&' + 'lt;';
    if (c === '>') return '&' + 'gt;';
    if (c === '"') return '&' + 'quot;';
    return '&#39;';
  });
}

const KEEP_FULL_LS = /sales_orders|fiberk_sales|purchase_orders|df_purchases|df_expenses|bnpl_field/i;

export function readLs(key, seed = []) {
  try {
    const raw = localStorage.getItem(key);
    if (raw != null && raw !== '') {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) {
        if (raw.length > 800000 && !KEEP_FULL_LS.test(String(key || ''))) {
          return parsed.slice(0, 400);
        }
        return parsed;
      }
    }
  } catch { /* ignore */ }
  return Array.isArray(seed) ? seed.slice() : [];
}

/** Full array, no size cap. Use for Home charts and FiberkApp books. */
export function readLsAll(key, seed = []) {
  try {
    const raw = localStorage.getItem(key);
    if (raw != null && raw !== '') {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) return parsed;
    }
  } catch { /* ignore */ }
  return Array.isArray(seed) ? seed.slice() : [];
}

export function pickRow(id, lists = []) {
  const want = String(id || '').trim();
  if (!want || want === 'undefined' || want === 'null') return null;
  const wantLow = want.toLowerCase();
  for (const list of lists) {
    const hit = (Array.isArray(list) ? list : []).find((r) => {
      if (!r || typeof r !== 'object') return false;
      const keys = [
        r.id, r.contact_code, r.code, r.sku, r.contact_id,
        r.supplier_id, r.customer_id, r.card_no, r.reference, r.reference_no,
        r.username, r.email, r.base_sku, r.catalog_sku,
      ];
      return keys.some((v) => v != null && String(v) === want)
        || keys.some((v) => v != null && String(v).toLowerCase() === wantLow);
    });
    if (hit) return hit;
  }
  return null;
}

/** Map common aliases so edit forms fill even when source columns differ. */
export function normalizeFormRow(table, row) {
  if (!row || typeof row !== 'object') return row;
  const r = { ...row };
  const firstLast = [r.first_name, r.last_name].filter(Boolean).join(' ').trim();
  r.name = r.name || r.full_name || r.business_name || r.company || r.supplier_name || r.customer_name || r.contact_name || firstLast || '';
  r.full_name = r.full_name || r.name;
  const looksBiz = !!(r.business_name || r.company || r.trading_name
    || /ltd|limited|ventures|enterprise|trading|company|llc|plc/i.test(r.name || ''));
  if (!r.first_name && (r.contact_name || (!looksBiz && r.name))) {
    const parts = String(r.contact_name || r.name).trim().split(/\s+/);
    r.first_name = parts[0] || '';
    r.last_name = r.last_name || parts.slice(1).join(' ');
  }
  r.phone = r.phone || r.mobile || r.contact_number || r.phone_number || r.phone_raw || '';
  r.mobile = r.mobile || r.phone;
  r.alternate_number = r.alternate_number || r.alt_phone || r.phone2 || r.mobile2 || r.additional_number || '';
  r.landline = r.landline || r.tel || r.telephone || '';
  r.email = r.email || r.email_address || '';
  r.contact_code = r.contact_code || r.code || r.contact_id || r.supplier_code || r.customer_code || '';
  r.address_line = r.address_line || r.address || r.addr || r.address_line_1 || '';
  r.address = r.address || r.address_line;
  r.address_line2 = r.address_line2 || r.address_2 || r.address_line_2 || '';
  r.city = r.city || r.town || '';
  r.business_name = r.business_name || r.company || r.trading_name || (looksBiz ? r.name : '') || '';
  if (!r.entity) r.entity = looksBiz || r.business_name ? 'business' : 'individual';
  const t = String(table || r.contact_type || r.type || '').toLowerCase();
  if (!r.contact_type) {
    r.contact_type = t.includes('supplier') ? 'supplier' : t.includes('customer') ? 'customer' : (r.type || '');
  }
  r.group_name = r.group_name || r.customer_group || r.group || '';
  r.assigned_to = r.assigned_to || r.assigned_user_id || r.user_id || '';
  r.tax_number = r.tax_number || r.tin || r.tax_no || '';
  r.subsidiary_code = r.subsidiary_code || r.subsidiary || r.sub_code || '';
  r.location_code = r.location_code || r.location || r.loc_code || '';
  if (typeof r.contact_persons === 'string') {
    try { r.contact_persons = JSON.parse(r.contact_persons); } catch { r.contact_persons = []; }
  }
  if (!Array.isArray(r.contact_persons)) r.contact_persons = [{}, {}, {}];
  while (r.contact_persons.length < 3) r.contact_persons.push({});
  if (r.contact_name && !(r.contact_persons[0] && (r.contact_persons[0].first || r.contact_persons[0].name))) {
    const parts = String(r.contact_name).trim().split(/\s+/);
    r.contact_persons[0] = {
      ...(r.contact_persons[0] || {}),
      first: parts[0] || '',
      last: parts.slice(1).join(' '),
      name: r.contact_name,
    };
  }
  return r;
}

const EDIT_STASH = 'df_edit_stash';
const EDIT_LAST = 'df_edit_last';

export function preferFilled(base, overlay) {
  const out = base && typeof base === 'object' && !Array.isArray(base) ? { ...base } : {};
  if (!overlay || typeof overlay !== 'object' || Array.isArray(overlay)) return out;
  for (const [k, v] of Object.entries(overlay)) {
    if (v == null || v === '') {
      if (out[k] == null || out[k] === '') out[k] = v;
      continue;
    }
    if (typeof v === 'object' && !Array.isArray(v)) {
      out[k] = preferFilled(out[k] && typeof out[k] === 'object' && !Array.isArray(out[k]) ? out[k] : {}, v);
    } else {
      out[k] = v;
    }
  }
  return out;
}

export function stashEditRow(row) {
  if (!row || typeof row !== 'object') return;
  try {
    let stash = {};
    try { stash = JSON.parse(sessionStorage.getItem(EDIT_STASH) || '{}') || {}; } catch { stash = {}; }
    const ids = [row.id, row.contact_code, row.code, row.sku, row.contact_id, row.card_no]
      .filter((v) => v != null && String(v).trim() && String(v) !== 'undefined')
      .map(String);
    ids.forEach((k) => { stash[k] = row; });
    const keys = Object.keys(stash);
    if (keys.length > 80) keys.slice(0, keys.length - 60).forEach((k) => { delete stash[k]; });
    sessionStorage.setItem(EDIT_STASH, JSON.stringify(stash));
    sessionStorage.setItem(EDIT_LAST, JSON.stringify(row));
  } catch { /* quota / private */ }
}

export function takeEditRow(id) {
  const want = String(id || '').trim();
  try {
    const stash = JSON.parse(sessionStorage.getItem(EDIT_STASH) || '{}') || {};
    if (want && stash[want]) return stash[want];
    const last = JSON.parse(sessionStorage.getItem(EDIT_LAST) || 'null');
    if (last && typeof last === 'object') {
      if (!want) return last;
      const ids = [last.id, last.contact_code, last.code, last.sku, last.contact_id].map((v) => String(v || ''));
      if (ids.includes(want)) return last;
    }
  } catch { /* ignore */ }
  return null;
}

export function allDfLists() {
  const lists = [];
  try {
    for (let i = 0; i < localStorage.length; i++) {
      const k = localStorage.key(i);
      if (!k || !/^df_/.test(k) || /_cache$|_tmp$|^df_ai_|^df_deleted/.test(k)) continue;
      const rows = readLs(k, []);
      if (rows.length) lists.push(rows);
    }
  } catch { /* ignore */ }
  return lists;
}

export function editIdFromUrl(search = '') {
  const q = new URLSearchParams(search || (typeof location !== 'undefined' ? location.search : ''));
  const raw = q.get('id') || q.get('customer') || q.get('code') || q.get('sku') || q.get('ref') || '';
  if (!raw) return '';
  try { return decodeURIComponent(raw).trim(); } catch { return String(raw).trim(); }
}

async function fetchRowTimed(table, id) {
  if (!table || !id) return null;
  try {
    const raced = await Promise.race([
      supabase.from(table).select('*').eq('id', id).maybeSingle(),
      new Promise((resolve) => setTimeout(() => resolve({ data: null, error: { message: 'timeout' } }), 1800)),
    ]);
    if (raced?.error || !raced?.data) return null;
    return raced.data;
  } catch {
    return null;
  }
}

/** Load the row being edited: stash → localStorage → live table. Empty remote fields never wipe local. */
export async function loadFormRow(table, key, id, extraKeys = []) {
  if (!id) return null;
  const stashed = takeEditRow(id);
  const lists = [
    key ? readLs(key, []) : [],
    ...extraKeys.map((k) => readLs(k, [])),
    ...allDfLists(),
  ];
  let hit = pickRow(id, lists) || stashed || null;
  const remote = await fetchRowTimed(table, id);
  if (remote) hit = preferFilled(hit || {}, remote);
  if (!hit && (table === 'suppliers' || table === 'customers')) {
    const other = table === 'suppliers' ? 'customers' : 'suppliers';
    const alt = await fetchRowTimed(other, id);
    if (alt) hit = alt;
  }
  if (!hit) hit = stashed;
  if (stashed && hit) hit = preferFilled(stashed, hit);
  return hit ? normalizeFormRow(table, hit) : null;
}

const FIELD_ALIASES = {
  phone: ['phone', 'mobile', 'contact_number', 'phone_number', 'phone_raw'],
  mobile: ['mobile', 'phone', 'contact_number'],
  alternate_number: ['alternate_number', 'alt_phone', 'phone2', 'mobile2', 'additional_number'],
  landline: ['landline', 'tel', 'telephone'],
  email: ['email', 'email_address'],
  contact_code: ['contact_code', 'code', 'contact_id', 'supplier_code', 'customer_code'],
  first_name: ['first_name'],
  last_name: ['last_name'],
  business_name: ['business_name', 'company', 'trading_name', 'name', 'full_name', 'supplier_name', 'customer_name'],
  name: ['name', 'full_name', 'business_name', 'company', 'title'],
  full_name: ['full_name', 'name'],
  address_line: ['address_line', 'address', 'addr', 'address_line_1'],
  address_line2: ['address_line2', 'address_2', 'address_line_2'],
  address: ['address', 'address_line'],
  city: ['city', 'town'],
  group_name: ['group_name', 'customer_group', 'group'],
  assigned_to: ['assigned_to', 'assigned_user_id', 'user_id'],
  subsidiary_code: ['subsidiary_code', 'subsidiary'],
  location_code: ['location_code', 'location'],
  tax_number: ['tax_number', 'tin', 'tax_no'],
  opening_balance: ['opening_balance', 'open_balance'],
  entity: ['entity'],
  contact_type: ['contact_type', 'type'],
  ghana_post_gps: ['ghana_post_gps', 'gps', 'digital_address'],
  region: ['region', 'state'],
  short_name: ['short_name', 'short', 'code'],
  description: ['description', 'note', 'notes'],
  duration: ['duration', 'duration_months'],
  card_no: ['card_no', 'card_number', 'loyalty_card'],
  points: ['points', 'loyalty_points'],
  customer_id: ['customer_id', 'customer'],
  commission_percent: ['commission_percent', 'commission', 'percent'],
  values: ['values', 'value_list'],
};

function valueForField(row, name) {
  if (!row || !name) return undefined;
  if (row[name] != null && row[name] !== '') return row[name];
  const aliases = FIELD_ALIASES[name];
  if (aliases) {
    for (const a of aliases) {
      if (row[a] != null && row[a] !== '') return row[a];
    }
  }
  const pm = String(name).match(/^p(\d+)_(.+)$/);
  if (pm && Array.isArray(row.contact_persons)) {
    const person = row.contact_persons[Number(pm[1])] || {};
    const k = pm[2];
    const mapped = { first: ['first', 'first_name', 'name'], last: ['last', 'last_name'], mobile: ['mobile', 'phone'], alt: ['alt', 'alternate_number'] };
    const keys = mapped[k] || [k];
    for (const key of keys) {
      if (person[key] != null && person[key] !== '') return person[key];
    }
  }
  if (name in row) return row[name];
  return undefined;
}

/** After paint, copy row values into matching form fields. Empty source never wipes a filled input. */
export function fillForm(form, row) {
  if (!form || !row) return;
  for (const el of form.elements) {
    const name = el.name;
    if (!name || el.type === 'file' || el.type === 'submit' || el.type === 'button') continue;
    const val = valueForField(row, name);
    if (val == null || val === '') continue;
    if (el.type === 'checkbox') {
      el.checked = val === true || val === 1 || val === '1' || val === 'true' || val === 'on';
      continue;
    }
    if (el.type === 'radio') {
      if (String(el.value) === String(val)) el.checked = true;
      continue;
    }
    const str = Array.isArray(val) ? val.filter(Boolean).join(', ') : String(val);
    if (el.tagName === 'SELECT') {
      const opts = [...el.options];
      const hit = opts.find((o) => o.value === str)
        || opts.find((o) => o.value.toLowerCase() === str.toLowerCase())
        || opts.find((o) => o.text.trim() === str)
        || opts.find((o) => o.text.trim().toLowerCase() === str.toLowerCase())
        || opts.find((o) => o.text.toLowerCase().includes(str.toLowerCase()) && str.length > 2);
      if (hit) el.value = hit.value;
      continue;
    }
    if (el.type === 'date') {
      const m = str.match(/\d{4}-\d{2}-\d{2}/);
      el.value = m ? m[0] : str.slice(0, 10);
      continue;
    }
    if (el.type === 'datetime-local') {
      el.value = str.replace(' ', 'T').slice(0, 16);
      continue;
    }
    el.value = str;
  }
}

function isQuota(err) {
  const n = err?.name || '';
  const m = String(err?.message || err || '');
  return n === 'QuotaExceededError' || n === 'NS_ERROR_DOM_QUOTA_REACHED' || /quota/i.test(m);
}

const CACHE_KEYS = [
  'df_ai_history',
  'df_wms_activity',
  'df_wms_picks',
  'df_wms_packs',
  'df_staff_mail_cache',
];

export function reclaimStorage(keep) {
  CACHE_KEYS.forEach((k) => {
    if (k === keep) return;
    try { localStorage.removeItem(k); } catch { /* ignore */ }
  });
  try {
    const drop = [];
    for (let i = 0; i < localStorage.length; i++) {
      const k = localStorage.key(i);
      if (!k || k === keep) continue;
      if (/_cache$|_tmp$|_seed_|^df_ai_/.test(k)) drop.push(k);
    }
    drop.forEach((k) => { try { localStorage.removeItem(k); } catch { /* ignore */ } });
  } catch { /* ignore */ }
}

export function lsSet(key, value) {
  let raw = value;
  try {
    if (typeof value !== 'string') raw = JSON.stringify(value);
  } catch {
    return false;
  }
  try {
    localStorage.setItem(key, raw);
    return true;
  } catch (err) {
    if (!isQuota(err)) return false;
    reclaimStorage(key);
    try {
      localStorage.setItem(key, raw);
      return true;
    } catch {
      try { localStorage.removeItem(key); } catch { /* ignore */ }
      return false;
    }
  }
}

export function writeLs(key, rows) {
  lsSet(key, rows);
}

function cloneSeed(seed) {
  try { return JSON.parse(JSON.stringify(seed || [])); } catch {
    return Array.isArray(seed) ? seed.slice() : [];
  }
}

export function mergeRows(lists) {
  const byKey = new Map();
  const extras = [];
  for (const list of lists) {
    for (const row of (list || [])) {
      if (!row || typeof row !== 'object') continue;
      const id = row.id != null ? String(row.id) : '';
      const sku = row.sku ? String(row.sku).toUpperCase() : '';
      const email = row.email ? String(row.email).toLowerCase() : '';
      const key = id || sku || email;
      if (!key) { extras.push(row); continue; }
      const prev = byKey.get(key);
      byKey.set(key, prev ? { ...prev, ...row } : row);
    }
  }
  return [...byKey.values(), ...extras];
}

function productSkuKey(p) {
  const raw = String(p?.base_sku || p?.catalog_sku || p?.sku || '').toUpperCase().trim();
  if (!raw) return '';
  const m = raw.match(/^([A-Z]{3}-\d{4,8})(?:-[A-Z0-9]{4})?$/);
  return m ? m[1] : raw;
}

export function dedupeProducts(rows) {
  const by = new Map();
  for (const p of rows || []) {
    if (!p || typeof p !== 'object') continue;
    const sku = productSkuKey(p);
    const key = sku || (p.id != null ? String(p.id) : '');
    if (!key) continue;
    const prev = by.get(key);
    if (!prev) { by.set(key, p); continue; }
    const score = (x) => (x.sku_locked ? 4 : 0) + (x.open_stock ? 2 : 0) + (x.updated_at ? 1 : 0);
    by.set(key, score(p) >= score(prev) ? { ...prev, ...p, sku: prev.sku || p.sku } : { ...p, ...prev, sku: p.sku || prev.sku });
  }
  return [...by.values()];
}

const SYNC_PREFIX = 'df_sync:';
const SKIP_SYNC = new Set(['password', 'password2', 'password_hash', 'pos_pin', 'till_pin', 'secret']);

function sanitizeSync(row) {
  if (!row || typeof row !== 'object') return null;
  const out = { ...row };
  SKIP_SYNC.forEach((k) => { delete out[k]; });
  delete out._localOnly;
  delete out._error;
  delete out._shared;
  return out;
}

async function pullSync(table) {
  if (!table || table === 'holidays') return [];
  try {
    const q = await Promise.race([
      supabase.from('holidays').select('id,note').eq('name', SYNC_PREFIX + table).maybeSingle(),
      new Promise((resolve) => setTimeout(() => resolve({ data: null }), 2500)),
    ]);
    if (!q?.data?.note) return [];
    const parsed = JSON.parse(q.data.note);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

async function pushSync(table, rows) {
  if (!table || table === 'holidays') return { ok: false };
  const incoming = (Array.isArray(rows) ? rows : []).map(sanitizeSync).filter(Boolean);
  const existing = await pullSync(table);
  const merged = mergeRows([incoming, existing]).slice(0, 400);
  let note = JSON.stringify(merged);
  if (note.length > 480000) note = JSON.stringify(merged.slice(0, 200));
  const name = SYNC_PREFIX + table;
  try {
    const found = await supabase.from('holidays').select('id').eq('name', name).maybeSingle();
    const body = { note };
    if (found.data?.id) {
      let u = await supabase.from('holidays').update({ note, subsidiary_code: 'group' }).eq('id', found.data.id);
      if (u.error) u = await supabase.from('holidays').update(body).eq('id', found.data.id);
      if (u.error) return { ok: false, error: u.error };
      return { ok: true };
    }
    let ins = await supabase.from('holidays').insert({ name, note, subsidiary_code: 'group' });
    if (ins.error) ins = await supabase.from('holidays').insert({ name, note });
    if (ins.error) return { ok: false, error: ins.error };
    return { ok: true };
  } catch (e) {
    return { ok: false, error: e };
  }
}

const TOMB_KEY = 'df_deleted_ids';

export function readTombs() {
  try {
    const t = JSON.parse(localStorage.getItem(TOMB_KEY) || '{}');
    return t && typeof t === 'object' ? t : {};
  } catch { return {}; }
}

export function tombstone(table, id, extra = {}) {
  if (!id && !extra.email && !extra.name) return;
  const t = readTombs();
  const add = (k, v) => {
    if (!v) return;
    t[k] = [...new Set([...(t[k] || []), String(v)])];
  };
  add(table, id);
  if (table === 'profiles' || table === 'users') {
    add('profiles', id);
    add('users', id);
    add('df_users', id);
    add('df_profiles', id);
  }
  if (extra.email) add('emails', String(extra.email).toLowerCase());
  if (extra.name) add('role_names', String(extra.name).trim().toLowerCase());
  try { localStorage.setItem(TOMB_KEY, JSON.stringify(t)); } catch { /* ignore */ }
}

export function isTombstoned(table, row) {
  if (!row) return false;
  const t = readTombs();
  const ids = new Set([
    ...(t[table] || []),
    ...(t.profiles && (table === 'users' || table === 'df_users') ? t.profiles : []),
    ...(t.users && (table === 'profiles' || table === 'df_users') ? t.users : []),
    ...(t.df_users || []),
  ].map(String));
  if (row.id != null && ids.has(String(row.id))) return true;
  const email = String(row.email || '').toLowerCase();
  if (email && (t.emails || []).includes(email)) return true;
  const nm = String(row.name || '').trim().toLowerCase();
  if (nm && (table === 'app_roles' || table === 'df_roles') && (t.role_names || []).includes(nm)) return true;
  return false;
}

function withoutTombs(table, rows) {
  return (Array.isArray(rows) ? rows : []).filter((r) => !isTombstoned(table, r));
}

const SKIP_REMOTE_SEED = new Set([
  'customers', 'contacts', 'loyalty_cards', 'sales_orders', 'purchase_orders',
  'purchases', 'purchase_returns', 'expenses', 'sales_commission_agents',
  'sell_returns', 'shipments', 'payment_accounts', 'transaction_payments',
  'debit_notes', 'cheques', 'crm_leads', 'pos_sessions', 'agents',
  'stock_transfers', 'stock_adjustments',
]);

const DEMO_STAFF_EMAILS = new Set([
  'hr@delkor-fiberk.com',
  'accounts@delkor-fiberk.com',
  'ama.mensah@fiberk.com',
  'kojo.owusu@fiberk.com',
  'efua.boateng@axidigetek.com',
  'yaw.asante@delkor.com',
  'akosua.darko@bnpl.com',
  'kofi.asante@axidigetek.com',
  'ama.serwaa@fiberk.com',
  'finance@delkorfiberk.com',
]);

function isLegacyDemoSku(p) {
  const src = String(p?.source || '').toLowerCase();
  if (src === 'fiberkapp' || src === 'upload' || p?.hard_fork === true) return false;
  const sku = String(p?.sku || '').toUpperCase();
  if (/^(OPH|WHV|AXI|FIB|BNP|DEL)-\d{4,8}(?:-[A-Z0-9]{4})?$/.test(sku)) return false;
  if (/^FBK|^DKF|^FKB/.test(sku)) return false;
  return /^(AXI|FIB|BNP|DEL|FRK|ELG|ORA|WHV)/.test(sku);
}

function opsPurged() {
  try {
    return localStorage.getItem('df_ops_demo_cleared_v3') === '1'
      || localStorage.getItem('df_ops_demo_cleared_v4') === '1';
  } catch { return false; }
}

export async function loadRows(table, key, seed = []) {
  const local = withoutTombs(table, Array.isArray(readLs(key, [])) ? readLs(key, []) : []);
  let seedRows = withoutTombs(table, Array.isArray(seed) ? cloneSeed(seed) : []);
  if (opsPurged() && SKIP_REMOTE_SEED.has(table)) {
    writeLs(key, local);
    return local;
  }
  const [remote, sync] = await Promise.all([
    safeFrom(table),
    pullSync(table),
  ]);
  let remoteRows = withoutTombs(table, Array.isArray(remote) ? remote : []);
  if (table === 'products') remoteRows = remoteRows.filter((p) => !isLegacyDemoSku(p));
  if (table === 'app_roles' && remoteRows.length) {
    seedRows = seedRows.filter((r) => /^(owner|hq admin|pending)$/i.test(String(r.name || '').trim()));
  }
  if (table === 'suppliers' && opsPurged()) {
    if (local.length) return local;
    return seedRows;
  }
  let merged = withoutTombs(table, mergeRows(
    table === 'app_roles'
      ? [seedRows, withoutTombs(table, sync), remoteRows, local]
      : [local, withoutTombs(table, sync), remoteRows, seedRows]
  ));
  if (table === 'holidays') {
    merged = merged.filter((r) => !String(r.name || '').startsWith(SYNC_PREFIX));
  }
  if (table === 'products') merged = dedupeProducts(merged.filter((p) => !isLegacyDemoSku(p)));
  if (table === 'profiles' || key === 'df_users') {
    merged = merged.filter((u) => {
      const email = String(u?.email || '').toLowerCase();
      const id = String(u?.id || '');
      if (DEMO_STAFF_EMAILS.has(email)) return false;
      if (/@(fiberk|delkor-fiberk|axidigetek|bnpl)\.com$/i.test(email)) return false;
      if (/@delkor\.com$/i.test(email)) return false;
      if (id.startsWith('00000000-0000-4000-a000-')) return false;
      return true;
    });
  }
  if (table === 'app_roles' || key === 'df_roles' || key === 'df_app_roles') {
    merged = merged.filter((r) => !isUpostJob(r?.name));
  }
  /* Persist everything, return only what the chosen data set includes. The
     archive stays on disk under every setting — this is a view filter, so
     switching back in Settings brings it straight back. */
  /* Migrated rows carry the old ERP's text labels instead of subsidiary and
     location codes, so the scope filter could not see them — pick Fiberk and
     Fiberk Shop and a migrated customer simply did not appear. Fill the codes
     in from the legacy label before anything filters on them. Existing codes
     are never overwritten. */
  const scoped = normaliseScopes(merged);
  try {
    const blob = JSON.stringify(scoped);
    if (blob.length < 400000) writeLs(key, scoped);
  } catch { /* quota — keep previous local book */ }
  return applyDataScope(scoped);
}

export async function safeFrom(table, build) {
  try {
    const q = typeof build === 'function'
      ? build(supabase.from(table))
      : supabase.from(table).select('*').limit(500);
    const raced = await Promise.race([
      q,
      new Promise((resolve) => setTimeout(() => resolve({ data: [], error: { message: 'timeout' } }), 2500)),
    ]);
    if (raced?.error) return [];
    return Array.isArray(raced?.data) ? raced.data : (raced?.data ? [raced.data] : []);
  } catch {
    return [];
  }
}

export async function saveRow(table, key, row) {
  const next = { ...row, id: row.id || uid(), updated_at: new Date().toISOString() };
  if (!next.created_at) next.created_at = next.updated_at;
  const rows = readLs(key, []);
  const existed = rows.some((r) => String(r.id) === String(next.id));
  const i = rows.findIndex((r) => String(r.id) === String(next.id));
  if (i >= 0) rows[i] = { ...rows[i], ...next };
  else rows.unshift(next);
  writeLs(key, rows);
  if (table === 'app_roles' && isUpostJob(next.name)) {
    return next;
  }
  let shared = false;
  try {
    const r = await peelWrite(table, next, existed ? { id: next.id } : {});
    if (r?.localOnly) {
      next._localOnly = true;
      next._error = r.error?.message || r.error || '';
    } else if (r?.data) {
      const j = rows.findIndex((x) => String(x.id) === String(next.id));
      if (j >= 0) rows[j] = { ...rows[j], ...r.data };
      writeLs(key, rows);
      if (!r.localOnly) shared = true;
    }
  } catch {
    next._localOnly = true;
  }
  try { await pushSync(table, readLs(key, [])); } catch { /* ignore */ }
  return { ...next, _shared: shared };
}

export async function deleteRow(table, key, id, opts = {}) {
  if (!opts.skipKey) {
    const keyed = await promptDeleteKey('Delete access key required');
    if (!keyed) return { ok: false, cancelled: true };
  }
  const existing = (readLs(key, []) || []).find((r) => String(r.id) === String(id))
    || (readLs('df_users', []) || []).find((r) => String(r.id) === String(id));
  tombstone(table, id, { email: existing?.email, name: existing?.name });
  tombstone(key, id, { email: existing?.email });
  let remoteOk = false;
  let remoteErr = null;
  for (const tbl of table === 'profiles' ? ['profiles', 'users'] : [table]) {
    try {
      const { error } = await supabase.from(tbl).delete().eq('id', id);
      if (!error) remoteOk = true;
      else remoteErr = error;
    } catch (e) { remoteErr = e; }
  }
  const drop = (k) => writeLs(k, withoutTombs(table, readLs(k, [])));
  drop(key);
  if (table === 'profiles' || key === 'df_users') {
    drop('df_users');
    drop('df_profiles');
  }
  if (table === 'sales_orders' || key === 'df_sales_orders') {
    drop('df_sales_orders');
    drop('df_acc_sales');
  }
  if (table === 'sales_commission_agents' || key === 'df_commission_agents') drop('df_commission_agents');
  if (table === 'repair_jobs' || key === 'df_repair_jobs') drop('df_repair_jobs');
  if (table === 'repair_invoices' || key === 'df_repair_invoices') drop('df_repair_invoices');
  if (table === 'quotations' || key === 'df_quotations') drop('df_quotations');
  if (table === 'shipments' || key === 'df_shipments') drop('df_shipments');
  if (table === 'stock_transfers' || key === 'df_stock_transfers') drop('df_stock_transfers');
  if (table === 'customers' || key === 'df_customers') drop('df_customers');
  try { await pushSync(table, readLs(key, [])); } catch { /* ignore */ }
  try {
    const { ackIfPending } = await import('./confirm-action.js');
    ackIfPending(true);
  } catch { /* ignore */ }
  logCrud('delete', { table, entity_type: table, entity_id: id, summary: `Deleted ${table} ${id}` });
  return { ok: true, shared: remoteOk, error: remoteOk ? null : remoteErr };
}

export async function deleteMany(table, key, ids) {
  const list = [...new Set((ids || []).map((id) => String(id || '')).filter(Boolean))];
  if (!list.length) return { ok: false, cancelled: true, count: 0 };
  const keyed = await promptDeleteKey('Delete access key required');
  if (!keyed) return { ok: false, cancelled: true, count: 0 };
  let n = 0;
  for (const id of list) {
    const existing = (readLs(key, []) || []).find((r) => String(r.id) === String(id));
    tombstone(table, id, { email: existing?.email });
    tombstone(key, id, { email: existing?.email });
    for (const tbl of table === 'profiles' ? ['profiles', 'users'] : [table]) {
      try { await supabase.from(tbl).delete().eq('id', id); } catch { /* ignore */ }
    }
    n += 1;
  }
  const drop = (k) => writeLs(k, withoutTombs(table, readLs(k, [])));
  drop(key);
  if (table === 'profiles' || key === 'df_users') {
    drop('df_users');
    drop('df_profiles');
  }
  if (table === 'sales_orders' || key === 'df_sales_orders') {
    drop('df_sales_orders');
    drop('df_acc_sales');
  }
  if (table === 'sales_commission_agents' || key === 'df_commission_agents') drop('df_commission_agents');
  if (table === 'repair_jobs' || key === 'df_repair_jobs') drop('df_repair_jobs');
  if (table === 'repair_invoices' || key === 'df_repair_invoices') drop('df_repair_invoices');
  if (table === 'quotations' || key === 'df_quotations') drop('df_quotations');
  if (table === 'shipments' || key === 'df_shipments') drop('df_shipments');
  if (table === 'stock_transfers' || key === 'df_stock_transfers') drop('df_stock_transfers');
  try { await pushSync(table, readLs(key, [])); } catch { /* ignore */ }
  logCrud('delete_bulk', { table, entity_type: table, summary: `Deleted ${n} ${table}` });
  return { ok: true, count: n };
}

export async function setDefault(table, key, id) {
  const rows = readLs(key, []).map((r) => ({ ...r, is_default: String(r.id) === String(id) }));
  writeLs(key, rows);
  const row = rows.find((r) => String(r.id) === String(id));
  if (row) {
    try { await peelWrite(table, { ...row, is_default: true }, { id }); } catch { /* ignore */ }
  }
  return rows;
}

export function actMenu(id, items) {
  const page = (typeof location !== 'undefined' ? location.pathname : '').split('/').pop() || '';
  const links = (items || []).map((it) => {
    const act = it.act || (!it.href && /view/i.test(it.label || '') ? 'view' : '')
      || (/edit/i.test(it.label || '') ? 'edit' : '')
      || (/delete|remove/i.test(it.label || '') ? 'delete' : '')
      || (/add|new/i.test(it.label || '') ? 'add' : '');
    const perm = it.perm || (act ? actionNeed(act, it.href || page) : '');
    const extra = perm ? ` data-perm="${esc(perm)}"` : '';
    if (!it.href && (it.act === 'view' || String(it.label || '').toLowerCase() === 'view')) {
      return `<button type="button" data-record-view="${esc(id)}"${extra}>${esc(it.label || 'View')}</button>`;
    }
    return it.href
      ? `<a href="${it.href}"${extra}>${esc(it.label)}</a>`
      : `<button type="button" data-act="${esc(it.act || '')}" data-id="${esc(id)}"${extra}>${esc(it.label)}</button>`;
  }).join('');
  return `<details class="act"><summary class="act-btn">Actions</summary><menu>${links}</menu></details>`;
}
