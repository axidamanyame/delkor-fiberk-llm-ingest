/** Per-user notification inbox (bell). Local cache + company database. */
import { readLs, writeLs, uid } from './ls-rows.js';
import { supabase } from './supabaseClient.js';

export const INBOX_KEY = 'df_inbox';
const READ_KEY = 'df_inbox_read';
const GONE_KEY = 'df_inbox_gone';

function readSet(key) {
  try {
    const rows = JSON.parse(localStorage.getItem(key) || '[]');
    return new Set(Array.isArray(rows) ? rows.map(String) : []);
  } catch {
    return new Set();
  }
}
function writeSet(key, set) {
  try { localStorage.setItem(key, JSON.stringify([...set].slice(0, 400))); } catch { /* ignore */ }
}

function all() {
  const rows = readLs(INBOX_KEY, []);
  return Array.isArray(rows) ? rows : [];
}

function noticeFp(n) {
  return [
    String(n?.id || ''),
    String(n?.email || '').toLowerCase(),
    String(n?.title || ''),
    String(n?.body || n?.msg || '').slice(0, 80),
    String(n?.created_at || n?.createdAt || '').slice(0, 16),
  ].join('|');
}

function isGone(n) {
  const gone = readSet(GONE_KEY);
  return gone.has(String(n?.id || '')) || gone.has(noticeFp(n));
}

function rememberGone(rows) {
  const gone = readSet(GONE_KEY);
  (rows || []).forEach((n) => {
    if (n?.id) gone.add(String(n.id));
    gone.add(noticeFp(n));
  });
  writeSet(GONE_KEY, gone);
}

function rememberRead(ids) {
  const readIds = readSet(READ_KEY);
  (ids || []).forEach((id) => { if (id) readIds.add(String(id)); });
  writeSet(READ_KEY, readIds);
}

function normalizeNotice(n, fallbackEmail) {
  const created = n.created_at || n.createdAt || new Date().toISOString();
  const title = n.title || 'Notice';
  const body = n.body || n.msg || n.message || '';
  const email = String(n.email || n.to_email || fallbackEmail || '').toLowerCase();
  const id = String(n.id || n.uuid || '').trim()
    || `loc-${email}-${title}-${String(created).slice(0, 19)}`;
  return {
    id,
    email,
    user_id: n.user_id || n.userId || null,
    title,
    body,
    kind: n.kind || 'notice',
    href: n.href || '',
    meta: n.meta && typeof n.meta === 'object' ? n.meta : {},
    read: n.read === true,
    created_at: created,
  };
}

function mine(n, email, userId) {
  const to = String(email || '').toLowerCase();
  const em = String(n.email || '').toLowerCase();
  if (em === 'broadcast' || em === '*' || n.kind === 'announcement') return true;
  if (to && em && em === to) return true;
  if (userId && n.user_id && String(n.user_id) === String(userId)) return true;
  return false;
}

function mergeRemote(rows) {
  const readIds = readSet(READ_KEY);
  const byId = new Map();
  all().forEach((n) => {
    if (!isGone(n)) byId.set(String(n.id), n);
  });
  for (const raw of rows || []) {
    const n = normalizeNotice(raw);
    if (!n.id || isGone(n)) continue;
    if (n.read && !byId.has(n.id)) continue;
    const prev = byId.get(n.id) || {};
    byId.set(n.id, {
      ...prev,
      ...n,
      read: !!(prev.read || n.read || readIds.has(String(n.id))),
    });
  }
  const next = [...byId.values()].sort((a, b) => String(b.created_at || '').localeCompare(String(a.created_at || '')));
  writeLs(INBOX_KEY, next.slice(0, 200));
  return next;
}

function ingestSaleNotices(email) {
  let sales = [];
  try { sales = JSON.parse(localStorage.getItem('df_sale_notices') || '[]'); } catch { sales = []; }
  if (!Array.isArray(sales) || !sales.length) return;
  mergeRemote(sales.map((n) => normalizeNotice({
    ...n,
    id: n.id || `sale-${n.created_at || ''}-${n.title || n.body || ''}`,
    email: n.email || email,
    kind: n.kind || 'sale',
  }, email)));
}

async function dbUpdateMine(email, userId, patch) {
  const to = String(email || '').toLowerCase();
  const jobs = [];
  if (to) jobs.push(supabase.from('app_notifications').update(patch).eq('email', to));
  if (userId) jobs.push(supabase.from('app_notifications').update(patch).eq('user_id', userId));
  await Promise.all(jobs.map((p) => p.then(() => null).catch(() => null)));
}

async function dbDeleteMine(email, userId, ids) {
  const to = String(email || '').toLowerCase();
  const jobs = [];
  (ids || []).forEach((id) => {
    if (id) jobs.push(supabase.from('app_notifications').delete().eq('id', id));
  });
  if (to) jobs.push(supabase.from('app_notifications').delete().eq('email', to));
  if (userId) jobs.push(supabase.from('app_notifications').delete().eq('user_id', userId));
  await Promise.all(jobs.map((p) => p.then(() => null).catch(() => null)));
}

export async function pushNotice({ email, title, body, kind, href, meta, userId } = {}) {
  const to = String(email || '').toLowerCase();
  if (!to) return null;
  const row = normalizeNotice({
    id: uid(),
    email: to,
    user_id: userId || null,
    title: title || 'Notice',
    body: body || '',
    kind: kind || 'notice',
    href: href || '',
    meta: meta || {},
    read: false,
    created_at: new Date().toISOString(),
  }, to);
  writeLs(INBOX_KEY, [row, ...all()].slice(0, 200));
  try {
    await supabase.from('app_notifications').insert({
      id: row.id,
      email: to,
      user_id: row.user_id,
      title: row.title,
      body: row.body,
      kind: row.kind,
      href: row.href,
      meta: row.meta,
      read: false,
    });
  } catch { /* local still holds it for this browser */ }
  return row;
}

export function listNotices(email, userId, opts = {}) {
  const readIds = readSet(READ_KEY);
  let rows = all()
    .filter((n) => !isGone(n) && mine(n, email, userId))
    .map((n) => ({ ...n, read: !!(n.read || readIds.has(String(n.id))) }));
  if (opts.unreadOnly) rows = rows.filter((n) => !n.read);
  return rows;
}

export async function pullNotices(email, userId) {
  const to = String(email || '').toLowerCase();
  if (!to && !userId) return [];
  ingestSaleNotices(to);
  const remote = [];
  async function take(builder) {
    try {
      const { data, error } = await builder;
      if (!error && Array.isArray(data)) remote.push(...data);
    } catch { /* keep local */ }
  }
  if (to) {
    await take(
      supabase.from('app_notifications').select('*').eq('email', to).order('created_at', { ascending: false }).limit(80)
    );
  }
  if (userId) {
    await take(
      supabase.from('app_notifications').select('*').eq('user_id', userId).order('created_at', { ascending: false }).limit(80)
    );
  }
  mergeRemote(remote.map((n) => normalizeNotice(n, to)));
  return listNotices(to, userId);
}

export function unreadCount(email, userId) {
  return listNotices(email, userId, { unreadOnly: true }).length;
}

export async function markAllRead(email, userId) {
  const mineRows = listNotices(email, userId);
  rememberRead(mineRows.map((n) => n.id));
  writeLs(INBOX_KEY, all().map((n) => (mine(n, email, userId) ? { ...n, read: true } : n)));
  await dbUpdateMine(email, userId, { read: true });
}

export async function clearNotices(email, userId) {
  const mineRows = listNotices(email, userId);
  rememberGone(mineRows);
  rememberRead(mineRows.map((n) => n.id));
  writeLs(INBOX_KEY, all().filter((n) => !mine(n, email, userId)));
  await dbDeleteMine(email, userId, mineRows.map((n) => n.id));
  await dbUpdateMine(email, userId, { read: true });
}

export async function markNoticeRead(id) {
  rememberRead([id]);
  writeLs(INBOX_KEY, all().map((n) => (String(n.id) === String(id) ? { ...n, read: true } : n)));
  try { await supabase.from('app_notifications').update({ read: true }).eq('id', id); } catch { /* ignore */ }
}

export function listAllNotices() {
  return all().slice().sort((a, b) => String(b.created_at || '').localeCompare(String(a.created_at || '')));
}

export async function pullAllNotices() {
  ingestSaleNotices('');
  try {
    const { data, error } = await supabase
      .from('app_notifications')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(500);
    if (!error && Array.isArray(data)) mergeRemote(data.map((n) => normalizeNotice(n)));
  } catch { /* keep local */ }
  return listAllNotices();
}

export async function deleteNotice(id) {
  const row = all().find((n) => String(n.id) === String(id));
  if (row) rememberGone([row]);
  else rememberGone([{ id }]);
  writeLs(INBOX_KEY, all().filter((n) => String(n.id) !== String(id)));
  try { await supabase.from('app_notifications').delete().eq('id', id); } catch { /* local */ }
  try { await supabase.from('app_notifications').update({ read: true }).eq('id', id); } catch { /* ignore */ }
}
