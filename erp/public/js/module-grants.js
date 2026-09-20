/**
 * Module on/off for a role or a person.
 * Company ticks (business settings) are the ceiling.
 * Role map hides/shows for everyone in that role.
 * User map overrides the role for one person — they may receive a module
 * their role does not have, as long as the company still has it on.
 */
import { ADDON_MODULE_FLAGS, CORE_MODULE_FLAGS, moduleOn } from './settings-store.js';
import { isHqRole, isOwnerRole } from './access-rules.js';
import { readLs, writeLs } from './ls-rows.js';

const GRANT_KEY = 'df_module_grants';

export function allModuleFlags() {
  return [...CORE_MODULE_FLAGS, ...ADDON_MODULE_FLAGS];
}

function empty() { return { roles: {}, users: {} }; }

export function loadGrants() {
  const raw = readLs(GRANT_KEY, null);
  if (raw && typeof raw === 'object' && !Array.isArray(raw) && (raw.roles || raw.users)) {
    return { roles: raw.roles || {}, users: raw.users || {} };
  }
  try {
    const p = JSON.parse(localStorage.getItem(GRANT_KEY) || 'null');
    if (p && typeof p === 'object') return { roles: p.roles || {}, users: p.users || {} };
  } catch { /* ignore */ }
  return empty();
}

export function saveGrants(g) {
  const next = { roles: g?.roles || {}, users: g?.users || {} };
  try { localStorage.setItem(GRANT_KEY, JSON.stringify(next)); } catch { /* quota */ }
  return next;
}

function normRole(name) {
  return String(name || '').trim().toLowerCase();
}

export function roleGrantMap(name) {
  const g = loadGrants();
  return g.roles[normRole(name)] || {};
}

export function userGrantMap(userId) {
  const g = loadGrants();
  return g.users[String(userId || '')] || {};
}

export function setRoleGrants(name, flags) {
  const g = loadGrants();
  const key = normRole(name);
  if (!key) return g;
  const clean = {};
  Object.entries(flags || {}).forEach(([k, v]) => {
    if (String(k).startsWith('module_')) clean[k] = !!v;
  });
  if (!Object.keys(clean).length) delete g.roles[key];
  else g.roles[key] = clean;
  return saveGrants(g);
}

export function setUserGrants(userId, flags) {
  const g = loadGrants();
  const key = String(userId || '');
  if (!key) return g;
  const clean = {};
  Object.entries(flags || {}).forEach(([k, v]) => {
    if (String(k).startsWith('module_')) clean[k] = !!v;
  });
  if (!Object.keys(clean).length) delete g.users[key];
  else g.users[key] = clean;
  return saveGrants(g);
}

export function inheritMap(biz, roleName) {
  const out = {};
  const role = roleGrantMap(roleName);
  const hasRole = Object.keys(role).some((k) => String(k).startsWith('module_'));
  allModuleFlags().forEach(({ flag }) => {
    if (flag === 'module_home') {
      out[flag] = true;
      return;
    }
    if (!moduleOn(biz, flag)) {
      out[flag] = false;
      return;
    }
    if (isOwnerRole(roleName) || isHqRole(roleName)) {
      out[flag] = true;
      return;
    }
    if (flag === 'module_academy' && !Object.prototype.hasOwnProperty.call(role, flag)) {
      out[flag] = true;
      return;
    }
    out[flag] = hasRole ? !!role[flag] : false;
  });
  return out;
}

export function effectiveMap(biz, { roleName, userId } = {}) {
  const out = inheritMap(biz, roleName);
  if (userId) {
    const u = userGrantMap(userId);
    Object.keys(u).forEach((k) => {
      if (out[k] === undefined) return;
      if (!moduleOn(biz, k)) return;
      out[k] = !!u[k];
    });
  }
  return out;
}

/** Company on AND an explicit tick. Unticked = hidden, not only locked. */
export function moduleOnFor(biz, key, access) {
  if (key === 'module_home') return true;
  if (!moduleOn(biz, key)) return false;
  if (!access) return false;
  if (isOwnerRole(access.roleName) || isHqRole(access.roleName)) return true;
  const flags = access.moduleFlags && typeof access.moduleFlags === 'object' ? access.moduleFlags : {};
  if (Object.prototype.hasOwnProperty.call(flags, key)) return !!flags[key];
  const uid = access.userId;
  const role = access.roleName;
  const u = uid ? userGrantMap(uid) : {};
  if (Object.prototype.hasOwnProperty.call(u, key)) return !!u[key];
  const r = roleGrantMap(role);
  if (Object.prototype.hasOwnProperty.call(r, key)) return !!r[key];
  if (key === 'module_academy') return true;
  return false;
}

/** Full map including false, so unticks survive on another machine. */
export function flagsFromChecks(biz, checks) {
  const out = {};
  allModuleFlags().forEach(({ flag }) => {
    if (flag === 'module_home') {
      out[flag] = true;
      return;
    }
    out[flag] = !!(moduleOn(biz, flag) && checks[flag]);
  });
  return out;
}

/** Diff vs inherit so we only store real overrides. Pass userId (even '') for a person. */
export function overridesFromChecks(biz, checks, { roleName, userId } = {}) {
  const asPerson = userId !== undefined;
  const inherit = asPerson ? inheritMap(biz, roleName) : (() => {
    const o = {};
    allModuleFlags().forEach(({ flag }) => { o[flag] = moduleOn(biz, flag); });
    return o;
  })();
  const out = {};
  allModuleFlags().forEach(({ flag }) => {
    if (!moduleOn(biz, flag)) return;
    const on = !!checks[flag];
    if (on !== !!inherit[flag]) out[flag] = on;
  });
  return out;
}

export function hydrateGrantsFromRows(roles, users) {
  const g = loadGrants();
  let dirty = false;
  (roles || []).forEach((r) => {
    const flags = r.module_flags;
    if (!flags || typeof flags !== 'object') return;
    const key = normRole(r.name);
    if (!key) return;
    if (flags && typeof flags === 'object') {
      const prev = g.roles[key] || {};
      g.roles[key] = { ...prev, ...flags };
      dirty = true;
    }
  });
  (users || []).forEach((u) => {
    const flags = u.module_flags;
    if (!flags || typeof flags !== 'object' || !u.id) return;
    const key = String(u.id);
    if (!g.users[key] || !Object.keys(g.users[key]).length) {
      g.users[key] = flags;
      dirty = true;
    }
  });
  if (dirty) saveGrants(g);
  return g;
}

export function grantChecksHtml(biz, map, { hideOff = true, flags = null } = {}) {
  return (flags || allModuleFlags()).map(({ label, flag }) => {
    const lock = flag === 'module_home';
    const company = lock || moduleOn(biz, flag);
    if (!company && hideOff) return '';
    const on = lock || (company && !!map[flag]);
    const dis = lock || !company ? 'disabled' : '';
    return `<label class="chk ${company ? '' : 'is-off'}">
      <input type="checkbox" data-gmod="${flag}" ${on ? 'checked' : ''} ${dis} />
      ${label}${lock ? ' <span class="sub">(always on)</span>' : company ? '' : ' <span class="sub">(company off)</span>'}
    </label>`;
  }).join('');
}

export function readGrantChecks(root) {
  const out = {};
  (root || document).querySelectorAll('[data-gmod]').forEach((el) => {
    out[el.dataset.gmod] = !!el.checked;
  });
  return out;
}

export async function writeRowFlags(kind, row, flags) {
  if (!row) return;
  try {
    const { saveRow } = await import('./ls-rows.js');
    const { KEYS } = await import('./catalog-seed.js');
    if (kind === 'role') {
      await saveRow('app_roles', KEYS.roles, { ...row, module_flags: flags || {} });
    } else if (row.id) {
      await saveRow('profiles', KEYS.users, { ...row, module_flags: flags || {} });
    }
  } catch { /* device grants already written */ }
}
