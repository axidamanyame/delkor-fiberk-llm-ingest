/**
 * First-wave import from DELKOR II FIBERK (Ultimate POS) CSV exports.
 * Maps old roles onto Delkor-Fiberk ERP roles. Does not create passwords or auth logins.
 */
import { uid, readLs, writeLs } from './ls-rows.js';
import { upsertUser } from './access-gate.js';
import { KEYS, SEED_ROLES, isDemoUser } from './catalog-seed.js';
import { isHqRole, isOwnerRole, isAdminRole } from './access-rules.js';

export const LEGACY_ROLE_MAP = {
  'admin': 'Admin',
  'hr / admin': 'Admin',
  'hr/admin': 'Admin',
  'hr admin': 'HR Admin',
  'shop manager': 'Manager',
  'manager': 'Manager',
  'shop attendant pos': 'Cashier',
  'shop attendant': 'Cashier',
  'cashier': 'Cashier',
  'sales agent': 'Sales',
  'sales': 'Sales',
  'field agent': 'Field Agent',
  'data entering': 'Data Entry',
  'data entry': 'Data Entry',
  'accountant': 'Accountant',
  'accounting': 'Accountant',
  'delivery': 'Delivery',
  'pending': 'Pending',
};

const KEEP_ROLE = /^(owner|hq admin|hq_admin|admin)$/i;
const PROTECT_EMAILS = new Set([
  'dkormla@gmail.com',
  'hq@delkor-fiberk.com',
  'hq@delkorfiberk.com',
  'social.delkorfiberk@gmail.com',
]);

export function decodeSpreadsheet(input) {
  if (input instanceof ArrayBuffer || (typeof ArrayBuffer !== 'undefined' && ArrayBuffer.isView?.(input))) {
    const u8 = input instanceof ArrayBuffer ? new Uint8Array(input) : new Uint8Array(input.buffer);
    if (u8.length >= 2 && u8[0] === 0xFF && u8[1] === 0xFE) return new TextDecoder('utf-16le').decode(u8);
    if (u8.length >= 2 && u8[0] === 0xFE && u8[1] === 0xFF) return new TextDecoder('utf-16be').decode(u8);
    let zeros = 0;
    for (let i = 0; i < Math.min(u8.length, 400); i += 1) if (u8[i] === 0) zeros += 1;
    if (zeros > 40) return new TextDecoder('utf-16le').decode(u8);
    return new TextDecoder('utf-8').decode(u8);
  }
  return String(input || '').replace(/\u0000/g, '');
}

function sniffDelim(src) {
  const line = String(src || '').split(/\r?\n/).find((l) => l.trim()) || '';
  const scored = [
    [',', (line.match(/,/g) || []).length],
    [';', (line.match(/;/g) || []).length],
    ['\t', (line.match(/\t/g) || []).length],
    ['|', (line.match(/\|/g) || []).length],
  ].sort((a, b) => b[1] - a[1]);
  return scored[0][1] > 0 ? scored[0][0] : ',';
}

export function parseCsv(text) {
  const src = decodeSpreadsheet(text).replace(/^\uFEFF/, '').replace(/\u0000/g, '');
  const delim = sniffDelim(src);
  const rows = [];
  let cur = '', row = [], q = false;
  for (let i = 0; i < src.length; i += 1) {
    const ch = src[i];
    if (q) {
      if (ch === '"') {
        if (src[i + 1] === '"') { cur += '"'; i += 1; }
        else q = false;
      } else cur += ch;
      continue;
    }
    if (ch === '"') { q = true; continue; }
    if (ch === delim) { row.push(cur); cur = ''; continue; }
    if (ch === '\n' || ch === '\r') {
      if (ch === '\r' && src[i + 1] === '\n') i += 1;
      row.push(cur); cur = '';
      if (row.some((c) => String(c).trim())) rows.push(row);
      row = [];
      continue;
    }
    cur += ch;
  }
  if (cur || row.length) {
    row.push(cur);
    if (row.some((c) => String(c).trim())) rows.push(row);
  }
  return rows;
}

function norm(s) {
  return String(s || '').replace(/\s+/g, ' ').trim();
}

export function headerIndex(header) {
  const map = {};
  const aliases = {
    user_name: 'username', user: 'username', login: 'username',
    e_mail: 'email', mail: 'email', email_address: 'email',
    full_name: 'name', staff_name: 'name', employee: 'name', contact_name: 'name',
    user_role: 'role', roles: 'role', designation: 'role',
  };
  (header || []).forEach((h, i) => {
    const k = norm(h).toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_+|_+$/g, '');
    if (!k || k === 'action' || k === 'actions') return;
    map[k] = i;
    if (aliases[k]) map[aliases[k]] = i;
  });
  return map;
}

export function headerRowIndex(table, keys = ['username', 'email', 'name', 'sku', 'contact_id']) {
  const list = Array.isArray(table) ? table : [];
  for (let i = 0; i < Math.min(list.length, 20); i += 1) {
    const idx = headerIndex(list[i]);
    if (keys.some((k) => idx[k] != null)) return i;
  }
  return 0;
}

export function mapLegacyRole(raw) {
  const key = norm(raw).toLowerCase();
  if (!key) return { name: 'Pending', matched: false, reason: 'No role on the old row' };
  if (LEGACY_ROLE_MAP[key]) return { name: LEGACY_ROLE_MAP[key], matched: true, reason: '' };
  const compact = key.replace(/[\s/_-]+/g, ' ');
  if (LEGACY_ROLE_MAP[compact]) return { name: LEGACY_ROLE_MAP[compact], matched: true, reason: '' };
  return { name: 'Pending', matched: false, reason: 'Unknown old role “' + raw + '” — review before they can sign in' };
}

export function usernameFrom(raw, email) {
  const u = norm(raw);
  if (!u || /^login not allowed$/i.test(u)) {
    return String(email || '').split('@')[0].replace(/[^a-zA-Z0-9._-]/g, '').toLowerCase();
  }
  return u;
}

export function loginAllowed(rawUser) {
  return !/^login not allowed$/i.test(norm(rawUser));
}

function splitName(full) {
  const parts = norm(full).replace(/^(miss|mr|mrs|ms|dr)\.?\s+/i, '').split(/\s+/);
  const last = parts.length > 1 ? parts.pop() : '';
  return { first_name: parts.join(' '), last_name: last };
}

export function previewUserRows(text) {
  const table = parseCsv(text);
  if (!table.length) return { header: [], rows: [], error: 'Empty file' };
  const start = headerRowIndex(table, ['username', 'email', 'name']);
  const idx = headerIndex(table[start]);
  if (idx.username == null && idx.email == null && idx.name == null) {
    return { header: table[0], rows: [], error: 'No Username / Name / Email header in the first rows' };
  }
  const col = (row, key, fallback) => {
    if (idx[key] != null) return norm(row[idx[key]]);
    if (fallback != null) return norm(row[fallback] || '');
    return '';
  };
  const rows = table.slice(start + (idx.username != null || idx.email != null || idx.name != null ? 1 : 0)).map((row, i) => {
    const email = col(row, 'email', 3).toLowerCase();
    const name = col(row, 'name', 1);
    const rawUser = col(row, 'username', 0);
    const rawRole = col(row, 'role', 2);
    const mapped = mapLegacyRole(rawRole);
    const allow = loginAllowed(rawUser);
    return {
      line: i + start + 2,
      email,
      full_name: name,
      username: usernameFrom(rawUser, email),
      legacy_username: rawUser,
      legacy_role: rawRole,
      role: mapped.name,
      matched: mapped.matched,
      reason: mapped.reason,
      allow_login: allow,
      skip: !email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email),
      skip_reason: !email ? 'No email' : (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) ? 'Invalid email' : ''),
    };
  }).filter((r) => r.email || r.full_name);
  return { header: table[start], rows, error: rows.length ? '' : 'Headers found but no data rows' };
}

export function existingUsers() {
  return readLs(KEYS.users, []) || [];
}

function findRole(roles, name) {
  const k = String(name || '').toLowerCase();
  return (roles || []).find((r) => String(r.name || '').toLowerCase() === k)
    || SEED_ROLES.find((r) => String(r.name || '').toLowerCase() === k)
    || null;
}

function protectExisting(prev) {
  if (!prev || !prev.email) return false;
  const role = String(prev?.role || prev?.role_name || '');
  if (KEEP_ROLE.test(role) || isOwnerRole(role) || isHqRole(role) || isAdminRole(role)) return true;
  if (PROTECT_EMAILS.has(String(prev.email || '').toLowerCase())) return true;
  // Anyone already on the ERP keeps their login and role. Import only adds missing people.
  if (prev.allow_login !== false && prev.source !== 'upos_import') return true;
  if (prev.status === 'active' || prev.access_unlocked === true) return true;
  if (/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(String(prev.id || ''))) return true;
  return false;
}

function scoreLive(u) {
  if (!u) return -1;
  let s = 0;
  if (u.source !== 'upos_import') s += 50;
  if (u.allow_login !== false) s += 25;
  if (protectExisting(u) || PROTECT_EMAILS.has(String(u.email || '').toLowerCase())) s += 40;
  if (/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(String(u.id || ''))) s += 20;
  if (u.status === 'active' || u.access_unlocked) s += 10;
  if (u.role && !/pending/i.test(String(u.role))) s += 5;
  return s;
}

export function snapshotUsers() {
  try {
    const cur = existingUsers();
    if (!cur.length) return;
    if (!localStorage.getItem('df_users_pre_import')) {
      localStorage.setItem('df_users_pre_import', JSON.stringify(cur));
    }
  } catch { /* ignore */ }
}

/** Put live ERP accounts back on top of a bad import. Merge by email, never by random id. */
export function restoreLiveUsers(remote = []) {
  let snap = [];
  try { snap = JSON.parse(localStorage.getItem('df_users_pre_import') || '[]'); } catch { snap = []; }
  if (!Array.isArray(snap)) snap = [];
  const local = existingUsers();
  const byEmail = new Map();
  for (const list of [snap, remote || [], local]) {
    for (const u of list || []) {
      const email = String(u?.email || '').toLowerCase().trim();
      if (!email) continue;
      if (isDemoUser(u)) continue;
      const prev = byEmail.get(email);
      if (!prev) { byEmail.set(email, { ...u, email }); continue; }
      const take = scoreLive(u) >= scoreLive(prev) ? u : prev;
      const drop = take === u ? prev : u;
      byEmail.set(email, {
        ...drop,
        ...take,
        email,
        id: scoreLive(take) >= scoreLive(drop) ? (take.id || drop.id) : (drop.id || take.id),
        role: take.role || drop.role,
        role_name: take.role_name || drop.role_name,
        role_id: take.role_id || drop.role_id,
        allow_login: (take.allow_login !== false) || (drop.allow_login !== false),
        status: take.source === 'upos_import' && drop.source !== 'upos_import' ? (drop.status || 'active') : (take.status || drop.status),
        access_key: take.access_key || drop.access_key,
        access_unlocked: take.access_unlocked === true || drop.access_unlocked === true,
        source: take.source === 'upos_import' && drop.source !== 'upos_import' ? drop.source : take.source,
        legacy_role: take.legacy_role || drop.legacy_role,
        username: take.username || drop.username,
        full_name: take.full_name || drop.full_name,
        subsidiary_code: take.subsidiary_code || drop.subsidiary_code,
        home_subsidiary: take.home_subsidiary || drop.home_subsidiary,
        location_code: take.location_code || drop.location_code,
        all_locations: take.all_locations || drop.all_locations,
      });
    }
  }
  const next = [...byEmail.values()];
  writeLs(KEYS.users, next);
  try {
    const profiles = readLs('df_profiles', []);
    if (Array.isArray(profiles) && profiles.length) {
      const seen = new Set(next.map((u) => String(u.email || '').toLowerCase()));
      const extra = profiles.filter((p) => p?.email && !seen.has(String(p.email).toLowerCase()));
      if (extra.length) writeLs(KEYS.users, [...next, ...extra]);
    } else {
      writeLs('df_profiles', next);
    }
  } catch { /* ignore */ }
  return readLs(KEYS.users, next);
}

export function undoUserImport() {
  try {
    const raw = localStorage.getItem('df_users_pre_import');
    if (!raw) return { ok: false, count: 0 };
    const snap = JSON.parse(raw);
    if (!Array.isArray(snap)) return { ok: false, count: 0 };
    writeLs(KEYS.users, snap);
    writeLs('df_profiles', snap);
    return { ok: true, count: snap.length };
  } catch {
    return { ok: false, count: 0 };
  }
}

export function applyUserImport(previewRows, { roles } = {}) {
  snapshotUsers();
  const roleList = roles && roles.length ? roles : (readLs(KEYS.roles, SEED_ROLES) || SEED_ROLES);
  const result = { created: 0, updated: 0, skipped: 0, protected: 0, errors: [] };
  for (const row of previewRows || []) {
    if (row.skip || !row.email) {
      result.skipped += 1;
      continue;
    }
    const roleName = row.role || 'Pending';
    const roleRec = findRole(roleList, roleName);
    const names = splitName(row.full_name);
    const prev = existingUsers().find((u) => String(u.email || '').toLowerCase() === row.email);
    if (prev && protectExisting(prev)) {
      upsertUser({
        ...prev,
        username: prev.username || row.username,
        full_name: prev.full_name || row.full_name,
        legacy_role: row.legacy_role,
        import_note: prev.import_note || 'Matched a DELKOR II FIBERK export. Live login and role were left as they are.',
      });
      result.protected += 1;
      continue;
    }
    if (prev) {
      upsertUser({
        ...prev,
        username: prev.username || row.username,
        full_name: prev.full_name || row.full_name,
        first_name: prev.first_name || names.first_name,
        last_name: prev.last_name || names.last_name,
        legacy_role: row.legacy_role,
      });
      result.updated += 1;
      continue;
    }
    const payload = {
      id: uid(),
      email: row.email,
      username: row.username || row.email.split('@')[0],
      full_name: row.full_name || '',
      first_name: names.first_name,
      last_name: names.last_name,
      role: roleName,
      role_name: roleName,
      role_id: roleRec?.id || '',
      allow_login: false,
      is_active: true,
      status: 'imported',
      source: 'upos_import',
      legacy_role: row.legacy_role,
      subsidiary_code: 'group',
      home_subsidiary: 'group',
      all_locations: true,
      import_note: row.allow_login
        ? 'Imported from DELKOR II FIBERK. Password not carried over — set one before they sign in.'
        : 'Imported from DELKOR II FIBERK. Login was not allowed on the old system.',
      country: 'Ghana',
    };
    try {
      upsertUser(payload);
      result.created += 1;
    } catch (e) {
      result.errors.push((row.email || '') + ': ' + (e.message || e));
    }
  }
  restoreLiveUsers([]);
  return result;
}

export const USER_IMPORT_TEMPLATE = 'Username,Name,Role,Email\nshop.cashier,Jane Mensah,SHOP ATTENDANT POS,jane@example.com\n';
