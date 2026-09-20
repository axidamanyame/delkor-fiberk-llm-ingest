/**
 * Privilege ladder for UI-only admins (no Supabase dashboard).
 * Owner > HQ Admin > everyone else.
 * Nobody may assign, edit, or delete a peer or superior.
 */
import { roleKey, isOwnerRole, isHqRole, displayRole, canonRoleKey } from './access-rules.js';
import { can, getAccess } from './rbac.js';
import { isUpostJob } from './job-catalog.js';

export function rankOf(name) {
  const k = canonRoleKey(name) || roleKey(name);
  if (k === 'owner' || k === 'superadmin' || k === 'founder' || k === 'partner') return 100;
  if (k === 'hqadmin' || k === 'systemsdeveloper' || k === 'itdirector'
    || k === 'systemsadministrator' || k === 'networkadministrator'
    || k === 'erpadministrator' || k === 'databaseadministrator') return 80;
  if (k === 'accountant' || k === 'accounting') return 35;
  if (k === 'pending') return 0;
  return 10;
}

export function isOwnerLockedName(name) {
  return /^(owner|super\s*admin|superadmin|founder|partner)$/i.test(String(name || '').trim());
}

export function isSystemRoleName(name) {
  return /^(owner|super\s*admin|superadmin|founder|partner|hq admin|systems developer|it director|systems administrator|network administrator|erp administrator|database administrator|pending)$/i.test(String(name || '').trim());
}

/** Roles this actor may put on another user. */
export function assignableRoles(roles, actorRole) {
  const mine = rankOf(actorRole);
  return (roles || []).filter((r) => {
    const n = r.name || '';
    if (isOwnerLockedName(n) && !isOwnerRole(actorRole)) return false;
    if (isOwnerRole(actorRole)) return true;
    return rankOf(n) < mine;
  });
}

export function uniqueByName(roles) {
  const seen = new Map();
  const uuidRe = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
  const ticks = (r) => Object.values(r?.permissions || {}).filter((v) => v === true || v === 'true').length;
  const prefer = (a, b) => {
    const au = uuidRe.test(String(a.id || ''));
    const bu = uuidRe.test(String(b.id || ''));
    if (bu && !au) return { ...a, ...b, id: b.id, name: b.name || a.name };
    if (au && !bu) return { ...b, ...a, id: a.id, name: a.name || b.name };
    return ticks(b) >= ticks(a) ? { ...a, ...b, name: b.name || a.name } : { ...b, ...a, name: a.name || b.name };
  };
  for (const r of roles || []) {
    const label = displayRole(r.name) || String(r.name || '').trim();
    if (isUpostJob(r.name) || isUpostJob(label) || roleKey(label) === 'shopmanager') continue;
    const k = roleKey(label);
    if (!k) continue;
    const next = { ...r, name: label };
    const prev = seen.get(k);
    seen.set(k, prev ? prefer(prev, next) : next);
  }
  return [...seen.values()].sort((a, b) => String(a.name).localeCompare(String(b.name)));
}

export function canMutateUser(actorRole, targetRole, { isSelf } = {}) {
  if (isSelf) return false;
  if (isOwnerRole(actorRole)) return !isOwnerLockedName(targetRole) || isOwnerRole(actorRole);
  if (isOwnerLockedName(targetRole)) return false;
  return rankOf(actorRole) > rankOf(targetRole);
}

export function canMutateRole(actorRole, roleName) {
  if (isOwnerRole(actorRole)) return true;
  if (isOwnerLockedName(roleName)) return false;
  if (/^hq admin$/i.test(String(roleName || '')) && !isOwnerRole(actorRole)) return false;
  const actor = roleKey(actorRole);
  /* Named HQ Admin may change jobs below HQ. */
  if (actor === 'hqadmin') return rankOf(roleName) < 80;
  return rankOf(actorRole) > rankOf(roleName);
}

/** Keep the ticks the editor set. Do not strip by the editor’s own map. */
export function sanitizePerms(actorRole, perms) {
  const next = {};
  Object.entries(perms || {}).forEach(([k, v]) => {
    if (v) next[k] = true;
  });
  delete next['*'];
  if (!isOwnerRole(actorRole)) next['superadmin.packages'] = false;
  return next;
}

export function deny(msg) {
  try { window.alert(msg); } catch { /* ignore */ }
  return false;
}
