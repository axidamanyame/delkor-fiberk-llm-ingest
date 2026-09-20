/** Pending registration → orientation wall → admin role + access key → full ERP.
 *  HQ Admin picks which jobs the key applies to in Business Settings → Modules. */
import { readLs, writeLs } from './ls-rows.js';
import { pushNotice } from './inbox.js';
import { supabase } from './supabaseClient.js';
import { peelWrite } from './account-rules.js';
import { isHqRole, isOwnerRole, canonRoleKey, roleKey, isHeadOfficeRole } from './access-rules.js';
import { readLocal } from './settings-store.js';
import { applyStaffJob } from './staff-jobs.js';

export const USERS_KEY = 'df_users';
export const PENDING_ROLE = 'Pending';
export const ORIENT_HREF = '/orientation.html';
export const PENDING_PAGES = new Set([
  'orientation.html',
  'welcome-package.html',
  'training.html',
  'profile.html',
  'login.html',
]);

function users() {
  const rows = readLs(USERS_KEY, []);
  return Array.isArray(rows) ? rows : [];
}

function persist(rows) {
  writeLs(USERS_KEY, rows);
  try { localStorage.setItem(USERS_KEY, JSON.stringify(rows)); } catch { /* ignore */ }
}

export function findUser(sessionOrEmail) {
  const email = String(
    typeof sessionOrEmail === 'string'
      ? sessionOrEmail
      : sessionOrEmail?.user?.email || sessionOrEmail?.email || '',
  ).toLowerCase();
  const id = String(
    typeof sessionOrEmail === 'object'
      ? (sessionOrEmail?.user?.id || sessionOrEmail?.id || '')
      : '',
  );
  if (!email && !id) return null;
  const hit = users().find((u) =>
    (email && String(u.email || '').toLowerCase() === email)
    || (id && String(u.id) === id),
  ) || null;
  return hit ? applyStaffJob(hit, email) : null;
}

export async function hydrateUser(sessionOrEmail) {
  const email = String(
    typeof sessionOrEmail === 'string'
      ? sessionOrEmail
      : sessionOrEmail?.user?.email || sessionOrEmail?.email || '',
  ).toLowerCase();
  const id = String(
    typeof sessionOrEmail === 'object'
      ? (sessionOrEmail?.user?.id || sessionOrEmail?.id || '')
      : '',
  );
  let remote = null;
  try {
    let q = supabase.from('profiles').select('*').limit(1);
    if (id) q = supabase.from('profiles').select('*').eq('id', id).maybeSingle();
    else if (email) q = supabase.from('profiles').select('*').ilike('email', email).maybeSingle();
    const { data } = await Promise.race([
      q,
      new Promise((resolve) => setTimeout(() => resolve({ data: null }), 4000)),
    ]);
    remote = data;
  } catch { /* local */ }
  if (remote) {
    const prev = findUser(sessionOrEmail) || {};
    const merged = { ...prev, ...remote, email: String(remote.email || prev.email || email).toLowerCase() };
    merged.role = remote.role || remote.role_name || prev.role;
    merged.role_name = remote.role_name || remote.role || prev.role_name;
    merged.role_id = remote.role_id || prev.role_id;
    if (prev.access_unlocked === true || remote.access_unlocked === true) {
      merged.access_unlocked = true;
      if (merged.status === 'keyed' || !merged.status) merged.status = 'active';
    }
    if (prev.access_key && !merged.access_key) merged.access_key = prev.access_key;
    upsertUser(merged);
  }
  return findUser(sessionOrEmail);
}

export function upsertUser(partial) {
  const email = String(partial.email || '').toLowerCase();
  const id = String(partial.id || '');
  const cur = users();
  const idx = cur.findIndex((u) =>
    (id && String(u.id) === id) || (email && String(u.email || '').toLowerCase() === email),
  );
  const prev = idx >= 0 ? cur[idx] : {};
  const next = { ...prev, ...partial, email: email || prev.email };
  if (idx >= 0) cur[idx] = next;
  else cur.unshift(next);
  persist(cur);
  return next;
}

export function isPendingRole(role) {
  return /^pending$/i.test(String(role || '').replace(/[\s_-]/g, ''));
}

/** Jobs HQ ticked under Access key. Default: Pending only. */
export function accessKeyJobs() {
  const biz = readLocal();
  const keys = Object.keys(biz || {}).filter((k) => k.startsWith('ak_role_') && biz[k]);
  if (!keys.length) return ['pending'];
  return keys.map((k) => k.slice('ak_role_'.length));
}

export function accessKeyEnabled() {
  return readLocal().access_key_enabled !== false;
}

export function accessKeyAppliesTo(row) {
  if (!row) return false;
  if (!accessKeyEnabled()) return false;
  const role = row.role_name || row.role || '';
  if (isHqRole(role) || isOwnerRole(role)) return false;
  const k = canonRoleKey(role);
  if (!k) return isPendingRole(role) || row.source === 'registration';
  return accessKeyJobs().includes(k);
}

export function isGated(row) {
  if (!row) return false;
  if (!accessKeyAppliesTo(row)) return false;
  if (row.access_unlocked === true) return false;
  if (String(row.status || '').toLowerCase() === 'active' && !row.access_key) return false;
  if (row.access_key && row.access_unlocked !== true) return true;
  const st = String(row.status || '').toLowerCase();
  if (st === 'pending' || st === 'keyed') return true;
  if (isPendingRole(row.role || row.role_name)) return true;
  if (row.source === 'registration' && row.access_unlocked !== true) return true;
  return false;
}

export function generateAccessKey(kind = 'operations') {
  const alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let s = '';
  for (let i = 0; i < 8; i += 1) s += alphabet[Math.floor(Math.random() * alphabet.length)];
  const prefix = kind === 'head_office' ? 'HO' : 'OP';
  return `${prefix}-${s.slice(0, 4)}-${s.slice(4)}`;
}

export function normalizeKey(v) {
  return String(v || '').toUpperCase().replace(/[^A-Z0-9]/g, '');
}

/** Head-office jobs get HO- keys and the group dashboard. Everyone else gets OP- and the till/field floor. */
export function keyKindForRole(role) {
  const k = roleKey(role);
  if (k === 'cashier' || k === 'agent' || k === 'fieldagent' || k === 'delivery') return 'operations';
  if (isHeadOfficeRole(role)) return 'head_office';
  return 'operations';
}

export function kindFromKey(key) {
  const n = normalizeKey(key);
  if (!n) return '';
  if (n.startsWith('HO') || n.startsWith('DFHO')) return 'head_office';
  if (n.startsWith('OP') || n.startsWith('DFOP')) return 'operations';
  return '';
}

export function dashboardGroupForKind(kind, role) {
  const k = roleKey(role);
  if (k === 'customer' || k === 'client') return 'customer';
  if (k === 'supplier' || k === 'vendor') return 'supplier';
  return 'hq';
}

export function homeAfterUnlock(row) {
  const role = row?.role_name || row?.role || '';
  const g = dashboardGroupForKind(row?.access_key_kind || kindFromKey(row?.access_key) || keyKindForRole(role), role);
  if (g === 'customer') return '/customer-home.html';
  if (g === 'supplier') return '/supplier-home.html';
  return '/dashboard.html';
}

export function alreadyUnlocked(row) {
  if (!row) return false;
  if (row.access_unlocked === true) return true;
  const st = String(row.status || '').toLowerCase();
  if (st === 'active' && !row.access_key) return true;
  return false;
}

export function assignRoleWithKey(row, role, roleId) {
  if (alreadyUnlocked(row) || isHqRole(role) || isOwnerRole(role)) {
    return upsertUser({
      ...row,
      role,
      role_name: role,
      role_id: roleId || row.role_id || null,
      status: row.status === 'inactive' ? 'inactive' : 'active',
      access_unlocked: true,
    });
  }
  const kind = keyKindForRole(role);
  const existingKind = kindFromKey(row?.access_key);
  const keep = !!(row?.access_key && (!existingKind || existingKind === kind));
  const key = keep ? row.access_key : generateAccessKey(kind);
  return upsertUser({
    ...row,
    role,
    role_name: role,
    role_id: roleId || row.role_id || null,
    status: 'keyed',
    access_key: key,
    access_key_kind: kind,
    dashboard_group: dashboardGroupForKind(kind, role),
    access_unlocked: false,
    approved_at: row?.approved_at || new Date().toISOString(),
  });
}

export async function unlockWithKey(row, typed) {
  if (!row?.access_key) return { ok: false, reason: 'no-key' };
  if (normalizeKey(typed) !== normalizeKey(row.access_key)) return { ok: false, reason: 'mismatch' };
  const role = row.role_name || row.role || '';
  const kind = row.access_key_kind || kindFromKey(row.access_key) || keyKindForRole(role);
  const group = dashboardGroupForKind(kind, role);
  const next = upsertUser({
    ...row,
    access_unlocked: true,
    status: 'active',
    unlocked_at: new Date().toISOString(),
    access_key_kind: kind,
    dashboard_group: group,
  });
  try {
    sessionStorage.setItem('df_unlocked_' + String(next.email || '').toLowerCase(), '1');
  } catch { /* ignore */ }
  try {
    const raw = JSON.parse(localStorage.getItem('df_auth') || sessionStorage.getItem('df_auth') || '{}');
    if (raw?.user) {
      raw.user.user_metadata = {
        ...(raw.user.user_metadata || {}),
        role: next.role || next.role_name || 'Staff',
        full_name: next.full_name || raw.user.user_metadata?.full_name,
        access_unlocked: true,
        dashboard_group: group,
        access_key_kind: kind,
      };
      const text = JSON.stringify(raw);
      localStorage.setItem('df_auth', text);
      sessionStorage.setItem('df_auth', text);
    }
  } catch { /* ignore */ }
  try {
    if (next.id) {
      await peelWrite('profiles', {
        id: next.id,
        email: next.email,
        status: 'active',
        access_unlocked: true,
        unlocked_at: next.unlocked_at,
        role: next.role,
        role_name: next.role_name,
        role_id: next.role_id,
        access_key_kind: kind,
        dashboard_group: group,
      }, { id: next.id });
    }
  } catch { /* local unlock still stands */ }
  try {
    const { writeActivity } = await import('./staff-log.js');
    writeActivity({
      action: 'access_unlocked',
      type: 'Access key',
      by: next.email,
      user_id: next.id,
      note: 'Entered access key — full ERP access',
    });
    const { writeAudit } = await import('./supabaseClient.js');
    await writeAudit({
      action: 'ACCESS_UNLOCKED',
      entity_type: 'access_key',
      entity_id: next.id || next.email,
      summary: next.email + ' entered their access key',
    });
  } catch { /* ignore */ }
  return { ok: true, user: next, home: homeAfterUnlock(next) };
}

export async function issueAccessAndNotify(row, role, roleId) {
  if (alreadyUnlocked(row) || isHqRole(role) || isOwnerRole(role)) {
    const next = assignRoleWithKey(row, role, roleId);
    try {
      const { writeAudit } = await import('./supabaseClient.js');
      await writeAudit({
        action: 'PROFILE_ROLE',
        entity_type: 'profile',
        entity_id: next.id || next.email,
        summary: 'Role set to ' + role + ' — no new access key (already unlocked)',
        payload: { email: next.email, role },
      });
    } catch { /* ignore */ }
    return { user: next, key: null, role, mail: { ok: true, skipped: true } };
  }
  const hadKey = !!row?.access_key;
  const keyed = assignRoleWithKey(row, role, roleId);
  const key = keyed.access_key;
  const email = String(keyed.email || '').toLowerCase();
  const name = keyed.full_name || [keyed.first_name, keyed.last_name].filter(Boolean).join(' ') || email;
  try {
    if (keyed.id) {
      await peelWrite('profiles', {
        id: keyed.id,
        email,
        full_name: keyed.full_name || name,
        role: keyed.role,
        role_name: keyed.role_name,
        role_id: keyed.role_id,
        status: 'keyed',
        access_key: key,
        access_key_kind: keyed.access_key_kind,
        dashboard_group: keyed.dashboard_group,
        access_unlocked: false,
        approved_at: keyed.approved_at,
      }, { id: keyed.id });
    }
  } catch { /* local still has the key */ }
  if (hadKey && normalizeKey(row.access_key) === normalizeKey(key)) {
    return { user: keyed, key, role, mail: { ok: true, skipped: true } };
  }
  const kind = keyed.access_key_kind || keyKindForRole(role);
  const land = kind === 'head_office' ? 'the head-office dashboard' : 'your till / field home';
  await pushNotice({
    email,
    title: `Role assigned: ${role}`,
    body: `Your ${kind === 'head_office' ? 'head-office' : 'operations'} access key is ${key}. Enter it on Orientation. You will then open ${land}.`,
    kind: 'access-key',
    href: '/orientation.html',
    meta: { key, role, access_key_kind: kind },
  });
  let mail = { ok: true, delivered: false };
  try {
    const { sendStaffMail, accessKeyEmail } = await import('./staff-mail.js');
    mail = await sendStaffMail(accessKeyEmail({ name, email, role, key, kind: keyed.access_key_kind }));
  } catch { /* mail module optional — key is already in the bell */ }
  try {
    const { writeAudit } = await import('./supabaseClient.js');
    await writeAudit({
      action: 'ACCESS_KEY_ISSUED',
      entity_type: 'access_key',
      entity_id: keyed.id || email,
      summary: 'Access key issued to ' + email + ' (' + role + ')',
      payload: { role, kind },
    });
  } catch { /* ignore */ }
  return { user: keyed, key, role, mail };
}

export function listPending() {
  return users().filter((u) => isGated(u));
}

export function pageFile(path) {
  return String(path || location.pathname || '').split('/').pop().split('?')[0].toLowerCase() || 'dashboard.html';
}

/** If this session is still gated, return the page they must stay on. */
export function destinationForSession(session, path) {
  const file = pageFile(path);
  if (PENDING_PAGES.has(file)) return null;
  const row = findUser(session);
  const metaRole = session?.user?.user_metadata?.role;
  if (!row) {
    if (isPendingRole(metaRole)) return ORIENT_HREF;
    return null;
  }
  if (!isGated(row)) return null;
  return ORIENT_HREF;
}

export function staffFoundationNav(homeHref = '/dashboard.html') {
  return [
    { href: homeHref, label: 'Home', icon: '🏠' },
    { href: '/profile.html', label: 'My Profile', icon: '👤' },
    {
      label: 'Orientation',
      icon: '📘',
      children: [
        { href: '/orientation.html', label: 'Orientation' },
        { href: '/welcome-package.html', label: 'Welcome Package' },
      ],
    },
    { href: '/training.html', label: 'Training', icon: '🎓' },
    { href: '/manual.html', label: 'User Manual', icon: '📘' },
  ];
}

export function pendingNav() {
  return staffFoundationNav('/orientation.html');
}
