/**
 * Four leadership logins.
 * Security class in Supabase: Owner or HQ Admin (never shown on login / profile).
 * Position (designation) is what the UI prints.
 */
import { peelWrite } from './account-rules.js';

export const STAFF_JOBS = [
  {
    emails: ['social.delkorfiberk@gmail.com'],
    usernames: ['social.delkorfiberk'],
    security: 'Owner',
    designation: 'Founder',
  },
  {
    emails: ['bernardfbk@gmail.com', 'onlinegaragegh@gmail.com'],
    usernames: ['bernardfbk', 'bennykay'],
    security: 'Owner',
    designation: 'Founder',
  },
  {
    emails: ['dkormla@gmail.com'],
    usernames: ['dkormla'],
    security: 'HQ Admin',
    designation: 'Systems Developer',
  },
  {
    emails: ['colemanharry600@gmail.com'],
    usernames: ['colemanharry600'],
    security: 'HQ Admin',
    designation: 'IT Director',
  },
];

function norm(v) {
  return String(v || '').trim().toLowerCase();
}

function isSecurityLabel(name) {
  const k = String(name || '').replace(/[^a-z0-9]+/gi, '').toLowerCase();
  return k === 'owner' || k === 'hqadmin' || k === 'superadmin' || k === 'admin' || k === 'superadminrole';
}

export function matchStaffJob(row = {}, extraEmail = '', extraUser = '') {
  const email = norm(row.email || extraEmail);
  const user = norm(row.username || extraUser);
  return STAFF_JOBS.find((j) =>
    (email && j.emails.includes(email)) || (user && j.usernames.includes(user))
  ) || null;
}

/** Position printed on login, profile, and the signed-in chip. Never Owner / HQ Admin. */
export function publicJobLabel(row = {}, extraEmail = '') {
  const hit = matchStaffJob(row, extraEmail, row.username);
  const des = String(row.designation || row.job_title || row.position || hit?.designation || '').trim();
  if (des && !isSecurityLabel(des)) return des;
  const role = String(row.role_name || row.role || '').trim();
  if (hit?.designation) return hit.designation;
  if (isSecurityLabel(role)) return hit?.designation || ( /owner|founder|partner/i.test(role) ? 'Founder' : 'Head Office');
  return role || 'Staff';
}

export function applyStaffJob(row, extraEmail = '', extraUser = '') {
  if (!row) return row;
  const hit = matchStaffJob(row, extraEmail, extraUser);
  if (!hit) return row;
  const roleOk = String(row.role_name || row.role || '') === hit.security;
  const desOk = String(row.designation || '') === hit.designation;
  if (roleOk && desOk) return row;
  return {
    ...row,
    role: hit.security,
    role_name: hit.security,
    designation: hit.designation,
    dashboard_group: 'hq',
    subsidiary_code: 'group',
    home_subsidiary: 'group',
    all_locations: true,
  };
}

export async function persistStaffJob(row) {
  if (!row?.id && !row?.email) return row;
  const hit = matchStaffJob(row);
  if (!hit) return row;
  let roleId = row.role_id;
  try {
    const { supabase } = await import('./supabaseClient.js');
    const found = await supabase.from('app_roles').select('id').ilike('name', hit.security).maybeSingle();
    if (found?.data?.id) roleId = found.data.id;
  } catch { /* keep */ }
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(String(roleId || ''))) {
    roleId = null;
  }
  const next = {
    ...row,
    role: hit.security,
    role_name: hit.security,
    designation: hit.designation,
    role_id: roleId,
    dashboard_group: 'hq',
    subsidiary_code: 'group',
    home_subsidiary: 'group',
    all_locations: true,
  };
  try {
    const { upsertUser } = await import('./access-gate.js');
    upsertUser(next);
  } catch { /* local optional */ }
  try {
    await peelWrite('profiles', {
      id: next.id,
      email: next.email,
      username: next.username,
      role: next.role,
      role_name: next.role_name,
      designation: next.designation,
      role_id: next.role_id,
      dashboard_group: 'hq',
      subsidiary_code: 'group',
      home_subsidiary: 'group',
      all_locations: true,
    }, next.id ? { id: next.id } : { email: next.email });
  } catch { /* RLS — local row still has the job */ }
  try {
    const { supabase } = await import('./supabaseClient.js');
    const sess = await supabase.auth.getSession();
    const me = sess?.data?.session?.user;
    if (me && norm(me.email) === norm(next.email)) {
      await supabase.auth.updateUser({
        data: {
          role: hit.security,
          designation: hit.designation,
          full_name: next.full_name || me.user_metadata?.full_name || hit.designation,
        },
      });
    }
  } catch { /* anon key cannot patch other auth users */ }
  return dropExemptAccessKey(next);
}

/** Owner / HQ Admin never carry an orientation key. */
export async function dropExemptAccessKey(row) {
  if (!row) return row;
  const { isHqRole, isOwnerRole } = await import('./access-rules.js');
  const role = row.role_name || row.role || '';
  if (!isHqRole(role) && !isOwnerRole(role)) return row;
  if (!row.access_key && row.status !== 'keyed') return row;
  const next = {
    ...row,
    access_key: '',
    access_key_kind: '',
    access_unlocked: true,
    status: row.status === 'inactive' ? 'inactive' : 'active',
  };
  try {
    const { upsertUser } = await import('./access-gate.js');
    upsertUser(next);
  } catch { /* ignore */ }
  try {
    await peelWrite('profiles', {
      id: next.id,
      email: next.email,
      access_key: '',
      access_key_kind: '',
      access_unlocked: true,
      status: next.status,
    }, next.id ? { id: next.id } : { email: next.email });
  } catch { /* ignore */ }
  return next;
}
