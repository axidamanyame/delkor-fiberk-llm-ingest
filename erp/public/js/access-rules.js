/**
 * Deeper ERP rules (Delkor-Fiberk ERP adapted to Delkor-Fiberk).
 *
 * There is no Superadmin role. HQ Admin is the group operator
 * (all subsidiaries, all locations, ignores assigned_locations).
 * Shop Manager (was “Admin”) runs one shop — same job as Manager.
 * Operations Hub is never a till.
 */
import { supabase } from './supabaseClient.js';
import { catalogCanon } from './job-catalog.js';

export function roleKey(role) {
  return String(role || '').replace(/[^a-z0-9]+/gi, '').toLowerCase();
}

/**
 * One label per job. Old names still match; they just print the same words.
 * HQ Admin = group.
 */
const ROLE_CANON = {
  founder: { label: 'Founder', family: 'hq' },
  partner: { label: 'Partner', family: 'hq' },
  owner: { label: 'Owner', family: 'hq' },
  superadmin: { label: 'Owner', family: 'hq' },
  hqadmin: { label: 'HQ Admin', family: 'hq' },
  systemsdeveloper: { label: 'Systems Developer', family: 'hq' },
  sysdev: { label: 'Systems Developer', family: 'hq' },
  itdirector: { label: 'IT Director', family: 'hq' },
  hradmin: { label: 'HR Admin', family: 'hr' },
  accountant: { label: 'Accountant', family: 'finance' },
  accounting: { label: 'Accountant', family: 'finance' },
  agent: { label: 'Field Agent', family: 'field' },
  fieldagent: { label: 'Field Agent', family: 'field' },
  cashier: { label: 'Cashier', family: 'shop' },
  inventory: { label: 'Inventory', family: 'ops' },
  sales: { label: 'Sales', family: 'shop' },
  salesassociate: { label: 'Sales', family: 'shop' },
  dataentry: { label: 'Data Entry', family: 'ops' },
  delivery: { label: 'Delivery', family: 'ops' },
  pending: { label: 'Pending', family: 'gate' },
  ...catalogCanon(),
};

export function displayRole(name) {
  const raw = String(name || '').trim();
  if (!raw) return '';
  if (roleKey(raw) === 'shopmanager') return '';
  const hit = ROLE_CANON[roleKey(raw)];
  return hit ? hit.label : raw;
}

export function canonRoleKey(name) {
  return roleKey(displayRole(name) || name);
}

export function sameRole(a, b) {
  const ka = canonRoleKey(a);
  const kb = canonRoleKey(b);
  return !!(ka && kb && ka === kb);
}

export function roleFamily(name) {
  return ROLE_CANON[roleKey(name)]?.family || ROLE_CANON[canonRoleKey(name)]?.family || '';
}

/** Company owner — Owner and Founder. Package subscriptions. Not HQ Admin. */
export function isOwnerRole(role) {
  const k = roleKey(role) || roleKey(displayRole(role));
  return k === 'owner' || k === 'superadmin' || k === 'founder' || k === 'partner';
}

/** Group operator — Delkor-Fiberk ERP “superadmin”, but named HQ Admin. */
export function isHqRole(role) {
  const k = roleKey(role);
  const fam = roleFamily(role);
  return fam === 'hq' || k === 'hqadmin' || k === 'owner' || k === 'superadmin'
    || k === 'systemsdeveloper' || k === 'itdirector'
    || k === 'systemsadministrator' || k === 'networkadministrator'
    || k === 'erpadministrator' || k === 'databaseadministrator';
}

/** Head-office jobs that see All Subsidiaries (HQ Admin, Owner, Founder). Not cashiers. */
export function isGroupOperatorRole(role) {
  if (isHqRole(role) || isOwnerRole(role)) return true;
  const k = roleKey(role);
  const fam = roleFamily(role);
  return fam === 'group' || k === 'founder';
}

/** Office vs till is no longer a separate home. Checkboxes decide pages. */
export function isHeadOfficeRole(role) {
  const k = roleKey(role);
  if (k === 'pending') return false;
  return true;
}

/** Removed UPOS leftover. */
export function isShopManagerRole() {
  return false;
}

/** Full permissions inside a subsidiary (or the group if HQ / Founder). */
export function isAdminRole(role) {
  return isGroupOperatorRole(role) || isShopManagerRole(role);
}

export function isManagerRole(role) {
  return isAdminRole(role) || /manager/i.test(String(role || ''));
}

export function assignedCodes(profile) {
  const raw = profile?.assigned_locations;
  if (Array.isArray(raw)) return raw.filter(Boolean);
  if (!raw) return [];
  return String(raw).split(',').map((s) => s.trim()).filter(Boolean);
}

export function isVirtualLoc(code, name) {
  const blob = `${code || ''} ${name || ''}`;
  return /OPS-HUB|VW-GROUP|GRP-HQ|virtual\s*wh|operations hub/i.test(blob);
}

/** Empty assigned list = all shops for that subsidiary (Delkor-Fiberk ERP “all locations”). */
export function locationAllowed(profile, locCode, locName) {
  if (!profile || isGroupOperatorRole(profile.role || profile.role_name)) return true;
  if (isVirtualLoc(locCode, locName)) return true; // hub is visible for stock, never a till
  const codes = assignedCodes(profile);
  if (!codes.length) return true;
  return codes.includes(locCode) || codes.includes(locName);
}

export async function loadMyProfile() {
  const timed = (p, ms) => Promise.race([
    p,
    new Promise((resolve) => setTimeout(() => resolve({ data: null, error: { message: 'timeout' } }), ms)),
  ]);
  const sess = await timed(supabase.auth.getSession(), 2500);
  const session = sess?.data?.session;
  if (!session) return null;
  const { data } = await timed(
    supabase.from('profiles')
      .select('id, email, role, role_name, designation, full_name, allow_login, assigned_locations, preferred_subsidiary, is_commission_agent, commission_percent, username, phone, dashboard_group')
      .eq('id', session.user.id)
      .maybeSingle(),
    3000,
  );
  return data || { id: session.user.id, email: session.user.email, role: session.user.user_metadata?.role || '', assigned_locations: [] };
}

export function filterLocations(list, profile) {
  if (!list) return [];
  return list.filter((l) => locationAllowed(profile, l.code || l.id, l.name));
}

/** POS / register: skip Operations Hub and disabled shops, then apply assignment. */
export function tillLocations(list, profile) {
  return filterLocations(list, profile).filter((l) => {
    if (l.is_active === false) return false;
    if (isVirtualLoc(l.code, l.name)) return false;
    if (l.sellable === false || l.office) return false;
    if (String(l.kind || '').toLowerCase() === 'virtual') return false;
    return true;
  });
}

/** Selling companies on a till. Operations Hub / Group are never a register. */
export function tillSubsidiaries(profile, allSubs, shops) {
  return subsidiariesFor(profile, allSubs, shops)
    .filter((s) => s && s.code !== 'group' && s.code !== 'ops' && !s.hub);
}

/** Subsidiaries a non-HQ user may switch into. HQ keeps the full list including Group. */
export function subsidiariesFor(profile, allSubs, shops) {
  const list = allSubs || [];
  const role = profile?.role || profile?.role_name;
  if (!profile || isGroupOperatorRole(role)) return list;
  const codes = assignedCodes(profile);
  const fromLocs = new Set();
  (shops || []).forEach((l) => {
    if (codes.includes(l.code) || codes.includes(l.name)) fromLocs.add(l.subsidiary || l.subsidiary_code);
  });
  if (fromLocs.size) {
    return list.filter((s) => s.code !== 'group' && fromLocs.has(s.code));
  }
  return list.filter((s) => s.code !== 'group' && s.code !== 'ops');
}

const DEFAULT_ROLES = new Set(['hq admin', 'hq_admin', 'admin', 'owner', 'super admin']);
export function isProtectedRole(name) {
  return DEFAULT_ROLES.has(String(name || '').toLowerCase());
}

export async function loadCommissionSettings() {
  let s = { sales_cmsn_agent: false, cmsn_agent_type: 'logged_in', cmsn_calculation_type: 'invoice' };
  try {
    const raw = JSON.parse(localStorage.getItem('ax_biz_settings') || '{}');
    s = { ...s, ...raw };
  } catch { /* ignore */ }
  try {
    const { data } = await supabase.from('business_settings').select('payload').eq('id', 1).maybeSingle();
    if (data?.payload && typeof data.payload === 'object') s = { ...s, ...data.payload };
  } catch { /* ignore */ }
  return {
    enabled: !!s.sales_cmsn_agent,
    type: s.cmsn_agent_type || 'logged_in',
    calc: s.cmsn_calculation_type || 'invoice',
  };
}

/**
 * Agents shown on POS, matching Settings → Sale → Commission agent type.
 * logged_in  → current cashier only
 * user_list  → profiles flagged is_commission_agent
 * agent_list → sales_commission_agents (no login required)
 */
export async function loadAgentsForPos(type, me) {
  if (type === 'logged_in') {
    return [{
      id: me?.id || 'me',
      full_name: me?.full_name || me?.email || 'Logged in user',
      email: me?.email || '',
      phone: me?.phone || '',
      commission_percent: Number(me?.commission_percent) || 0,
      source: 'logged_in',
    }];
  }
  if (type === 'user_list') {
    const { data } = await supabase
      .from('profiles')
      .select('id, full_name, email, phone, commission_percent, is_commission_agent, allow_login')
      .eq('is_commission_agent', true)
      .order('full_name');
    return (data || [])
      .filter((u) => u.allow_login !== false)
      .map((u) => ({
        id: u.id,
        full_name: u.full_name || u.email,
        email: u.email,
        phone: u.phone,
        commission_percent: Number(u.commission_percent) || 0,
        source: 'user',
      }));
  }
  const { data } = await supabase
    .from('sales_commission_agents')
    .select('id, full_name, email, phone, commission_percent, is_active')
    .order('full_name');
  return (data || [])
    .filter((a) => a.is_active !== false)
    .map((a) => ({ ...a, source: 'standalone' }));
}
