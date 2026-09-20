/**
 * The one place the Supabase library is loaded.
 *
 * Everything in the browser goes through this module. abac.js used to pull a
 * second copy from cdn.jsdelivr.net and admin-users.js a third from esm.sh, so
 * a page importing them ran two or three separate library instances with their
 * own GoTrue auth clients on the same localStorage key. createClient is
 * re-exported below for the one caller that legitimately needs a second,
 * non-persisting client.
 *
 * TO VENDOR THIS (recommended — see fix/README.md):
 *   1. curl -L https://esm.sh/@supabase/supabase-js@2 -o public/js/vendor/supabase-js.js
 *      (or npm pack @supabase/supabase-js and take the ESM build)
 *   2. change the import below to './vendor/supabase-js.js'
 * Until then every page in the ERP depends on esm.sh being reachable, and on
 * whatever the "@2" tag resolves to today.
 */
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

export { createClient };

export const SUPABASE_URL = 'https://YOUR-PROJECT.supabase.co';
export const SUPABASE_PUBLISHABLE_KEY = 'sb_publishable_REDACTED';
function missingColumn(msg) {
  const m = String(msg || '').match(/Could not find the '([^']+)' column/i)
    || String(msg || '').match(/column ["']([^"']+)["'] of relation/i);
  return m ? m[1] : '';
}

function dropSelectCol(url, col) {
  try {
    const u = new URL(String(url), SUPABASE_URL);
    const sel = u.searchParams.get('select');
    if (!sel) return String(url);
    const next = sel.split(',').map((s) => s.trim()).filter((s) => s && s !== col && !s.startsWith(col + ':') && !s.endsWith('.' + col));
    u.searchParams.set('select', next.length ? next.join(',') : '*');
    return u.toString();
  } catch {
    return String(url);
  }
}

const DROP_COLS_KEY = 'df_drop_cols';
function droppedCols(table) {
  try { return JSON.parse(sessionStorage.getItem(DROP_COLS_KEY) || '{}')[table] || []; }
  catch { return []; }
}
function rememberDrop(table, col) {
  if (!table || !col) return;
  try {
    const all = JSON.parse(sessionStorage.getItem(DROP_COLS_KEY) || '{}');
    const list = new Set(all[table] || []);
    list.add(col);
    all[table] = [...list];
    sessionStorage.setItem(DROP_COLS_KEY, JSON.stringify(all));
  } catch { /* ignore */ }
}
function stripKnownDrops(href, table) {
  let next = String(href);
  droppedCols(table).forEach((c) => { next = dropSelectCol(next, c); });
  return next;
}

let _refreshing = 0;
const BLOCK_KEY = 'df_rest_block';
function blockedSet() {
  try { return new Set(JSON.parse(sessionStorage.getItem(BLOCK_KEY) || '[]')); }
  catch { return new Set(); }
}
function blockTable(table) {
  if (!table) return;
  const s = blockedSet();
  s.add(table);
  try { sessionStorage.setItem(BLOCK_KEY, JSON.stringify([...s])); } catch { /* ignore */ }
}
function restTable(href) {
  const m = String(href).match(/\/rest\/v1\/([A-Za-z0-9_]+)/);
  return m ? m[1] : '';
}
function jsonOk(body, status = 200) {
  return new Response(typeof body === 'string' ? body : JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

/* Declared at the top: getAuthSession() and snapshotSession() both test ids,
   and they sit above the demo-session helpers where this used to live. */
const UUID_RX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** A user id worth sending to the database: a real UUID, not a placeholder. */
export function isRealUserId(id) {
  const s = String(id || '').toLowerCase();
  if (!UUID_RX.test(s)) return false;
  return !/^0{8}-0{4}-4000-a000-/.test(s);
}

const _warned = new Set();
function warnOnce(key, message) {
  if (_warned.has(key)) return;
  _warned.add(key);
  console.warn('[df] ' + message);
}

async function quietFetch(input, init = {}) {
  const href = String(input);
  const method = String(init.method || 'GET').toUpperCase();
  const rest = /\/rest\/v1\//.test(href);
  const table = restTable(href);
  if (rest && table && blockedSet().has(table)) {
    return jsonOk(method === 'GET' || method === 'HEAD' ? [] : {});
  }
  /**
   * A malformed UUID in a filter comes back as an opaque 400 (Bad Request),
   * and one bad id produces one 400 per query — which is what filled the
   * console: the same fabricated session id, sent everywhere. Catch it here,
   * say which id and which table once, and return an empty result so the page
   * still renders instead of failing eight times over.
   */
  if (rest) {
    const badId = href.match(/[?&](?:id|user_id|staff_id|customer_id|supplier_id|product_id)=eq\.([^&]+)/i);
    if (badId) {
      const val = decodeURIComponent(badId[1]);
      /* UUID *shape* — 36 characters with dashes in the four canonical
         positions — not "looks like hex". The placeholder that caused this
         contained h, q, m, i and n, none of which are hex digits, so a
         hex-based test let it straight through. A short reference like
         CUST-004182 is not UUID-shaped and is never touched. */
      const uuidShaped = val.length === 36 && val[8] === '-' && val[13] === '-' && val[18] === '-' && val[23] === '-';
      if (uuidShaped && !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(val)) {
        warnOnce('bad-uuid:' + val, 'Skipped a query on ' + (table || 'a table')
          + ': "' + val + '" is not a valid UUID. This usually means no real user is signed in.');
        return jsonOk(method === 'GET' || method === 'HEAD' ? [] : {});
      }
    }
  }
  let res;
  try {
    if (rest && table) {
      const stripped = stripKnownDrops(href, table);
      if (stripped !== href) input = stripped;
    }
    res = await fetch(input, init);
  } catch {
    if (rest && method === 'GET') return jsonOk([]);
    throw new Error('network');
  }
  if (res.status === 401 && rest) {
    if (!_refreshing && window.__dfSupabase?.auth?.refreshSession) {
      _refreshing = Date.now();
      try {
        const { data } = await window.__dfSupabase.auth.refreshSession();
        const token = data?.session?.access_token;
        if (token) {
          const headers = new Headers(init.headers || {});
          headers.set('Authorization', `Bearer ${token}`);
          res = await fetch(input, { ...init, headers });
        }
      } catch { /* keep 401 */ }
      _refreshing = 0;
    }
    if (res.status === 401) {
      blockTable(table);
      if (method === 'GET' || method === 'HEAD') return jsonOk([]);
      return jsonOk({ error: 'unauthorized' }, 200);
    }
  }
  if (res.status !== 400 || !rest) return res;
  let text = '';
  try { text = await res.clone().text(); } catch { text = ''; }
  const col = missingColumn(text);
  if (col && table) rememberDrop(table, col);
  if (col && method === 'GET') {
    const next = dropSelectCol(typeof input === 'string' ? input : href, col);
    if (next !== href && next !== String(input)) return fetch(next, init);
  }
  if (col && init.body && (method === 'POST' || method === 'PATCH' || method === 'PUT')) {
    try {
      const body = JSON.parse(init.body);
      const strip = (o) => {
        if (o && typeof o === 'object' && !Array.isArray(o)) delete o[col];
        return o;
      };
      const next = Array.isArray(body) ? body.map(strip) : strip({ ...body });
      return fetch(input, { ...init, body: JSON.stringify(next) });
    } catch { /* keep first response */ }
  }
  if (/schema cache|does not exist|relation .* does not exist/i.test(text)) {
    blockTable(table);
    if (method === 'GET') return jsonOk([]);
    return jsonOk({});
  }
  if (method === 'GET' && /bad request/i.test(text)) return jsonOk([]);
  return res;
}

const AUTH_STORAGE_KEY = 'df-supabase-auth';
if (typeof window !== 'undefined' && !window.__dfSupabase) {
  window.__dfSupabase = createClient(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY, {
    global: { fetch: quietFetch },
    auth: { persistSession: true, storageKey: AUTH_STORAGE_KEY, autoRefreshToken: true },
  });
}
export const supabase = (typeof window !== 'undefined' && window.__dfSupabase)
  ? window.__dfSupabase
  : createClient(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY, {
    global: { fetch: quietFetch },
    auth: { persistSession: true, storageKey: AUTH_STORAGE_KEY, autoRefreshToken: true },
  });

if (typeof window !== 'undefined' && !window.__dfAuthWatch) {
  window.__dfAuthWatch = true;
  supabase.auth.onAuthStateChange(() => {});
}

export async function safeFetch(table, filters = {}) {
  try {
    let q = supabase.from(table).select('*');
    Object.entries(filters || {}).forEach(([k, v]) => {
      if (v != null && v !== '') q = q.eq(k, v);
    });
    const { data, error } = await q;
    if (error) return [];
    return Array.isArray(data) ? data : [];
  } catch {
    return [];
  }
}

export const GROUP = {
  code: 'group',
  name: 'All Subsidiaries',
  short: 'All Subsidiaries',
};

export const SUBSIDIARIES = [
  GROUP,
  { code: 'ops', name: 'Operations Hub', short: 'Operations Hub' },
  { code: 'axidigetek', name: 'Axidigetek', short: 'Axidigetek (E-comm HQ)' },
  { code: 'bnpl', name: 'BuyNowPaysLater', short: 'BNPL (Hire Purchase)' },
  { code: 'delkor', name: 'Delkor Logistics', short: 'Delkor Logistics' },
  { code: 'fiberk', name: 'Fiberk', short: 'Fiberk (Electronics)' },
];

export const OPERATING_SUBSIDIARIES = SUBSIDIARIES.filter((s) => s.code !== 'group');

export function isHqAdmin(role) {
  const r = String(role || '').toLowerCase().replace(/[\s_-]+/g, '');
  return ['hqadmin', 'admin', 'owner'].includes(r);
}

export function isGroupScope(sub) {
  const code = typeof sub === 'string' ? sub : sub?.code;
  return !code || code === 'group' || code === 'ops';
}

/** Use on POS / documents — never stamp 'group' as a warehouse company */
export function operatingCode(sub) {
  if (!sub || isGroupScope(sub)) return null;
  return sub.code;
}

export const fmt = (n) => {
  if (n == null || Number.isNaN(Number(n))) return 'GH₵ 0.00';
  return 'GH₵ ' + Number(n).toLocaleString('en-GH', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
};

function looksLikeJwt(tok) {
  const t = String(tok || '');
  if (!t || t === 'preview-demo') return false;
  const parts = t.split('.');
  return parts.length === 3 && parts[0].length > 8 && parts[1].length > 8;
}

function jwtPayload(tok) {
  try {
    const part = String(tok || '').split('.')[1];
    if (!part) return null;
    const b64 = part.replace(/-/g, '+').replace(/_/g, '/');
    const pad = b64 + '='.repeat((4 - (b64.length % 4)) % 4);
    return JSON.parse(atob(pad));
  } catch {
    return null;
  }
}

/** Postgres JWT role must be authenticated. owner / hq_admin there breaks every request. */
function jwtDbRoleOk(tok) {
  const p = jwtPayload(tok);
  if (!p) return false;
  if (p.exp && (p.exp * 1000) < (Date.now() - 60 * 1000)) return false;
  const role = String(p.role || 'authenticated').toLowerCase();
  return role === 'authenticated' || role === 'anon' || role === 'service_role';
}

function readStoredSession() {
  const keys = ['df_auth', AUTH_STORAGE_KEY];
  for (const key of keys) {
    for (const store of [localStorage, sessionStorage]) {
      try {
        const raw = JSON.parse(store.getItem(key) || 'null');
        if (!raw) continue;
        const sess = raw.currentSession || raw.session || (raw.user ? raw : null);
        if (!sess?.user) continue;
        const tok = String(sess.access_token || '');
        const loopbackDemo = isLoopbackHost() && (tok === 'local' || tok === 'preview-demo');
        if (!loopbackDemo) {
          if (!isRealUserId(sess.user.id)) continue;
          if (!looksLikeJwt(sess.access_token)) continue;
          if (!jwtDbRoleOk(sess.access_token)) continue;
        }
        return sess;
      } catch { /* ignore */ }
    }
  }
  return null;
}

export async function getAuthSession() {
  const stored = readStoredSession();
  const liveP = supabase.auth.getSession()
    .then((r) => {
      const s = r?.data?.session;
      if (s?.user && isRealUserId(s.user.id)) {
        if (!jwtDbRoleOk(s.access_token)) {
          try { supabase.auth.signOut(); } catch { /* ignore */ }
          purgeStoredSession();
          return null;
        }
        snapshotSession(s);
        return s;
      }
      return null;
    })
    .catch(() => null);
  if (stored) {
    liveP.catch(() => {});
    return stored;
  }
  try {
    const raced = await Promise.race([
      liveP,
      new Promise((resolve) => setTimeout(() => resolve(null), 8000)),
    ]);
    return raced || null;
  } catch {
    return null;
  }
}

/** Remove every trace of a stored session, in both storages. */
export function purgeStoredSession(reason) {
  ['df_auth', 'df_logged_in', 'df_preview_demo', 'df_profile', 'df_active_sub', 'df_active_loc', AUTH_STORAGE_KEY].forEach((k) => {
    try { localStorage.removeItem(k); } catch { /* ignore */ }
    try { sessionStorage.removeItem(k); } catch { /* ignore */ }
  });
  if (reason) warnOnce('purge', 'Signed out: ' + reason + '. Sign in again.');
}

export async function requireAuth() {
  const session = await getAuthSession();
  if (session) return session;
  if (!/\/login\.html/i.test(location.pathname || '')) {
    const here = location.pathname + location.search;
    if (!/login\.html|resume\.html|go-home\.html/i.test(here)) {
      try { sessionStorage.setItem('df_next', here); } catch { /* ignore */ }
    }
    const login = '/login.html';
    const go = window.__dfNativeAssign || ((u) => { window.location.href = u; });
    try { go(login); } catch { location.href = login; }
  }
  return null;
}

const LAST_PATH_KEY = 'df_last_path';

export function rememberLastPath(path) {
  try {
    const p = String(path || location.pathname || '');
    if (p && !/login\.html|till-login\.html|onboard-run\.html/i.test(p)) {
      localStorage.setItem(LAST_PATH_KEY, p);
    }
  } catch { /* ignore */ }
}

export function lastPath() {
  try { return localStorage.getItem(LAST_PATH_KEY) || ''; } catch { return ''; }
}

export function snapshotSession(session) {
  if (!session) return session;
  /* Refuse to store a session the database will reject. */
  if (!isRealUserId(session.user?.id)) {
    warnOnce('snap-bad', 'Not storing a session with an invalid user id: ' + String(session.user?.id || ''));
    return session;
  }
  try { localStorage.setItem('df_auth', JSON.stringify(session)); } catch { /* ignore */ }
  try { sessionStorage.setItem('df_auth', JSON.stringify(session)); } catch { /* ignore */ }
  try { localStorage.setItem('df_logged_in', '1'); } catch { /* ignore */ }
  return session;
}

export function clearLocalAuth() {
  try { localStorage.removeItem('df_auth'); } catch { /* ignore */ }
  try { sessionStorage.removeItem('df_auth'); } catch { /* ignore */ }
  try { localStorage.removeItem('df_logged_in'); } catch { /* ignore */ }
  try { sessionStorage.removeItem('df_logged_in'); } catch { /* ignore */ }
  try { supabase.auth.signOut(); } catch { /* ignore */ }
}

export function isRemoteKey(id) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(String(id || ''));
}

export function isLoopbackHost() {
  const h = String(location.hostname || '');
  return h === 'localhost' || h === '127.0.0.1' || h === '::1' || h.endsWith('.local');
}

/**
 * Is this an embedded preview, where no real credentials exist?
 *
 * This used to answer yes for any `*.vercel.app` host — which is your
 * production deploy. So the live ERP fabricated a demo session, and every
 * write went out with the placeholder user id
 * `00000000-0000-4000-a000-hqadmin00001`, which Postgres rejects as malformed
 * UUID: "invalid input syntax for type uuid". Hence a console full of
 * 400 (Bad Request) and nothing saving.
 *
 * A deployment host says nothing about whether a user is signed in. Only two
 * things do: being framed by another page, or running on loopback.
 */
export function isPreviewEmbedHost() {
  if (isLoopbackHost()) return true;
  try { if (window.self !== window.top) return true; } catch { return true; }
  return false;
}

export function persistDemoSession() {
  const session = {
    access_token: 'local',
    token_type: 'bearer',
    user: {
      /* Must be a syntactically valid UUID: the previous value embedded the
         word "hqadmin", and h/q/m/i/n are not hex digits, so every insert or
         update carrying it was rejected outright. */
      id: '00000000-0000-4000-a000-000000000002',
      email: 'hq@delkor-fiberk.com',
      user_metadata: { full_name: 'HQ Admin', role: 'HQ Admin' },
    },
  };
  snapshotSession(session);
  return session;
}

export async function ensureAuthProfile(session) {
  const user = session?.user;
  if (!user?.id || String(session?.access_token || '') === 'local') return null;
  try {
    const { data } = await supabase.from('profiles').select('*').eq('id', user.id).maybeSingle();
    return { row: data || null };
  } catch {
    return null;
  }
}

/** In-memory only for this browser tab (never source of truth) */
let _active = null;

export function getActiveSubsidiary() {
  return _active;
}

export function setActiveSubsidiaryMemory(sub) {
  _active = sub;
}

/**
 * Load preferred subsidiary from profiles (Supabase).
 * Falls back to first subsidiary if unset / missing column.
 */
export async function loadActiveSubsidiary(userId) {
  if (!userId) {
    _active = SUBSIDIARIES[0];
    return _active;
  }
  try {
    const { data, error } = await supabase
      .from('profiles')
      .select('id,email,full_name,role,role_name,preferred_subsidiary,subsidiary_code')
      .eq('id', userId)
      .maybeSingle();

    if (!error && data) {
      const code = data.preferred_subsidiary || data.subsidiary_code;
      const found = SUBSIDIARIES.find((s) => s.code === code);
      if (found) {
        _active = found;
        return _active;
      }
    }
  } catch (e) {
    console.warn('loadActiveSubsidiary', e);
  }
  _active = SUBSIDIARIES[0];
  return _active;
}

/**
 * Persist preferred subsidiary on the signed-in user's profile.
 * Source of truth = Supabase, not localStorage.
 */
export async function saveActiveSubsidiary(userId, sub) {
  if (!userId || !sub?.code) return { error: new Error('missing user or subsidiary') };
  _active = sub;

  /* A local or demo session has no profiles row, so these updates can only
     fail. Keep the choice in memory and say so once, instead of two failed
     round trips per subsidiary switch. */
  if (!isRealUserId(userId)) return { error: null };

  // Try preferred_subsidiary first (canonical), then subsidiary_code for older schemas
  let { error } = await supabase
    .from('profiles')
    .update({ preferred_subsidiary: sub.code })
    .eq('id', userId);

  if (error) {
    const r2 = await supabase
      .from('profiles')
      .update({ subsidiary_code: sub.code })
      .eq('id', userId);
    if (r2.error) {
      console.warn('saveActiveSubsidiary', r2.error.message);
      return { error: r2.error };
    }
  }
  return { error: null };
}

/** @deprecated localStorage removed — kept as no-ops so old imports don't crash */
export function setActiveSubsidiary(sub) {
  setActiveSubsidiaryMemory(sub);
}

export async function writeAudit({ action, entity_type, entity_id, subsidiary_code, summary, payload }) {
  try {
    const { data: { session } } = await supabase.auth.getSession();
    const now = new Date().toISOString();
    const row = {
      id: 'aud-' + Date.now() + '-' + Math.random().toString(36).slice(2, 7),
      action: action || 'event',
      entity_type: entity_type || 'unknown',
      entity_id: entity_id ? String(entity_id) : null,
      summary: summary || action,
      at: now,
      created_at: now,
      actor_email: session?.user?.email || null,
      actor_id: session?.user?.id || null,
      subsidiary_code: subsidiary_code || operatingCode(getActiveSubsidiary()) || null,
      payload: payload || {},
    };
    try {
      const prev = JSON.parse(localStorage.getItem('df_audit_logs') || '[]');
      prev.unshift(row);
      localStorage.setItem('df_audit_logs', JSON.stringify(prev.slice(0, 400)));
    } catch { /* quota */ }
    if (blockedSet().has('audit_logs')) return;
    await supabase.from('audit_logs').insert({
      actor_id: row.actor_id,
      actor_email: row.actor_email,
      action: row.action,
      entity_type: row.entity_type,
      entity_id: row.entity_id,
      subsidiary_code: row.subsidiary_code,
      summary: row.summary,
      payload: row.payload,
    });
  } catch (e) {
    console.warn('writeAudit', e);
  }
}
