/**
 * Hub → Subsidiary → Business Location → Business Department.
 * Delkor-Fiberk is not an operational row. Fiberk Shop may receive POs directly.
 */
import {
  SUBSIDIARIES,
  getActiveSubsidiary,
  saveActiveSubsidiary,
  setActiveSubsidiaryMemory,
  supabase,
} from './supabaseClient.js';

export { getActiveSubsidiary, saveActiveSubsidiary };

export const OPS_HUB = {
  code: 'OPS-HUB',
  name: 'Operations Hub',
  subsidiary: 'ops',
  warehouse: 'OPS-HUB',
  sellable: false,
  hub: true,
  office: true,
  default_warehouse: true,
};

export const BUSINESS_LOCATIONS = [
  OPS_HUB,
  { code: 'AXI-ONLINE', name: 'Axidigetek Online Store', subsidiary: 'axidigetek', warehouse: 'axidigetek-MAIN', online: true, marketplace: true },
  { code: 'BNPL-FIELD', name: 'BNPL Market (Field)', subsidiary: 'bnpl', warehouse: 'bnpl-MAIN', primary: true, field: true, marketplace: true },
  { code: 'BNPL-ONLINE', name: 'BNPL Online Shop', subsidiary: 'bnpl', warehouse: 'bnpl-MAIN', online: true, marketplace: true },
  { code: 'DEL-ONLINE', name: 'Delkor Online', subsidiary: 'delkor', warehouse: 'delkor-MAIN', online: true, marketplace: true },
  { code: 'DEL-FURN', name: 'Delkor Furniture Market', subsidiary: 'delkor', warehouse: 'delkor-MAIN', physical: true, marketplace: true },
  { code: 'FIB-SHOP', name: 'Fiberk Shop', subsidiary: 'fiberk', warehouse: 'fiberk-MAIN', physical: true, direct_store: true, marketplace: true },
  { code: 'BNPL-FSH', name: 'Field Stock Hub', subsidiary: 'bnpl', warehouse: 'BNPL-FSH', field_hub: true, sellable: false, pick: true },
];

/** Alias: old Virtual WH is the Operations Hub default warehouse. */
export const VIRTUAL_WH = OPS_HUB;

const UPOS_LOC = /^(shop|shop\s*\d+|online market|main warehouse|virtual warehouse|virtual wh)$/i;

/** Canonical shops only — drop UPOS leftover names and duplicate labels. */
export function uniqueBusinessLocations(extra = []) {
  const seen = new Set();
  const out = [];
  const add = (l) => {
    if (!l) return;
    const name = String(l.name || '').trim();
    const code = String(l.code || l.location_id || '').trim();
    if (!name && !code) return;
    if (UPOS_LOC.test(name) || l.alias) return;
    const ck = code.toLowerCase();
    const nk = name.toLowerCase();
    if ((ck && seen.has('c:' + ck)) || (nk && seen.has('n:' + nk))) return;
    if (ck) seen.add('c:' + ck);
    if (nk) seen.add('n:' + nk);
    out.push({ code: code || name, name: name || code, subsidiary: l.subsidiary || '' });
  };
  BUSINESS_LOCATIONS.forEach(add);
  (Array.isArray(extra) ? extra : []).forEach(add);
  return out;
}

export const SUB_PREFIX = {
  axidigetek: 'AXI',
  fiberk: 'FIB',
  bnpl: 'BNP',
  delkor: 'DEL',
  ops: 'OPH',
};

export const HUB_PREFIX = 'OPH';
export const HUB_PREFIXES = new Set(['OPH', 'WHV']);
export const HUB_CODES = new Set(['OPS-HUB', 'VW-GROUP', 'GRP-HQ']);

export const SCOPE_EVENT = 'df-scope-change';
const LOC_KEY = 'df_active_location';
const AGENT_KEY = 'df_active_agent';
const _scopeFns = new Set();

function trackScopeFn(fn) {
  if (typeof fn === 'function') _scopeFns.add(fn);
}

export function onScopeChange(fn) {
  if (typeof fn !== 'function') return () => {};
  trackScopeFn(fn);
  window.addEventListener(SCOPE_EVENT, fn);
  return () => {
    window.removeEventListener(SCOPE_EVENT, fn);
    _scopeFns.delete(fn);
  };
}

export function clearScopeListeners() {
  _scopeFns.forEach((fn) => {
    try { window.removeEventListener(SCOPE_EVENT, fn); } catch { /* ignore */ }
  });
  _scopeFns.clear();
}

export function installScopeListenerGuard() {
  if (typeof window === 'undefined' || window.__dfScopeGuard) return;
  window.__dfScopeGuard = true;
  const origAdd = window.addEventListener.bind(window);
  const origRemove = window.removeEventListener.bind(window);
  window.addEventListener = (type, fn, opts) => {
    if (type === SCOPE_EVENT) trackScopeFn(fn);
    return origAdd(type, fn, opts);
  };
  window.removeEventListener = (type, fn, opts) => {
    if (type === SCOPE_EVENT) _scopeFns.delete(fn);
    return origRemove(type, fn, opts);
  };
}

/** Only BNPL-FIELD has assignable field agents today. Extend this list if that changes. */
export const AGENT_LOCATIONS = ['BNPL-FIELD'];
export const BNPL_FIELD_LOCATION = 'BNPL-FIELD';
export const FIBERK_SHOP_CODE = 'FIB-SHOP';

/** Fiberk Shop is a real store-room and may receive / hold goods without Operations Hub. */
export function isDirectStore(code) {
  const L = findLocation(code);
  if (L?.direct_store || L?.physical) return true;
  return String(code || '').toUpperCase() === FIBERK_SHOP_CODE;
}
export const FIELD_STOCK_HUB_CODE = 'BNPL-FSH';

export function isFieldStockHub(code) {
  const c = String(code || '').toUpperCase();
  if (c === FIELD_STOCK_HUB_CODE) return true;
  const L = findLocation(code);
  return !!(L && L.field_hub);
}
export const BNPL_SUB = 'bnpl';

export function isHubWarehouse(code) {
  const c = String(code || '');
  if (HUB_CODES.has(c)) return true;
  return /ops-hub|operations hub|virtual\s*wh|vw-group|grp-hq/i.test(c);
}

export const isVirtualWh = isHubWarehouse;

export function isOnlineLocation(code) {
  const L = findLocation(code);
  return !!(L && L.online);
}

export function fulfilsFromHub(code) {
  const L = findLocation(code);
  if (!L) return false;
  return !!(L.online || L.field);
}

export function getActiveLocation() {
  try {
    const raw = sessionStorage.getItem(LOC_KEY) || '';
    if (!raw) return '';
    const L = findLocation(raw);
    if (L) {
      const code = L.alias ? 'DEL-ONLINE' : L.code;
      if (L.hub || isHubWarehouse(code)) return '';
      if (code !== raw) {
        try { sessionStorage.setItem(LOC_KEY, code); } catch { /* ignore */ }
      }
      return code;
    }
    return raw;
  } catch { return ''; }
}

export function saveActiveLocation(code) {
  try {
    if (code) sessionStorage.setItem(LOC_KEY, code);
    else sessionStorage.removeItem(LOC_KEY);
  } catch { /* ignore */ }
}

export function getActiveAgent() {
  try { return sessionStorage.getItem(AGENT_KEY) || ''; } catch { return ''; }
}

export function saveActiveAgent(id) {
  try {
    if (id) sessionStorage.setItem(AGENT_KEY, id);
    else sessionStorage.removeItem(AGENT_KEY);
  } catch { /* ignore */ }
}

export function locationSupportsAgents(locCode) {
  return AGENT_LOCATIONS.includes(String(locCode || '').toUpperCase());
}

/** True when the master sidebar is sitting on BNPL + BNPL Field Sales. */
export function isBnplFieldScope(subCode, locCode) {
  const sub = String(subCode || getActiveSubsidiary()?.code || '').toLowerCase();
  const loc = String(locCode === undefined ? getActiveLocation() : locCode || '').toUpperCase();
  return sub === BNPL_SUB && locationSupportsAgents(loc);
}

export const FIELD_OPS_PATH = '/field-ops.html';

/** Scope dropdowns only filter. Field Ops is a menu item, never opened from these boxes. */
export function activateFieldOpsIfNeeded() {
  return false;
}

let _agentCache = null; // { key: 'sub|loc', rows: [...] }
/** Fetch active agents scoped to a subsidiary/location. Cached per sub|loc pair for the session. */
export async function fetchAgentsForScope(subCode, locCode) {
  if (!locationSupportsAgents(locCode)) return [];
  const key = `${subCode || ''}|${locCode || ''}`;
  if (_agentCache && _agentCache.key === key && _agentCache.rows.length) return _agentCache.rows;
  let remote = [];
  try {
    let q = supabase.from('sales_commission_agents').select('*').order('full_name');
    if (subCode && subCode !== 'group') q = q.eq('subsidiary_code', subCode);
    const { data, error } = await Promise.race([
      q,
      new Promise((resolve) => setTimeout(() => resolve({ data: null, error: { message: 'timeout' } }), 2500)),
    ]);
    if (!error && data?.length) {
      remote = data.filter((a) => a.is_active !== false).filter((a) => {
        const loc = String(a.location_code || '').toUpperCase();
        if (!loc) return true;
        return loc === String(locCode || '').toUpperCase();
      });
    }
  } catch { /* local / ACM */ }
  let local = [];
  try {
    const raw = JSON.parse(localStorage.getItem('df_sales_commission_agents') || '[]');
    if (Array.isArray(raw)) local = raw.filter((a) => a && a.is_active !== false);
  } catch { /* ignore */ }
  let acm = [];
  try {
    const { loadOrders, uniqueAgents } = await import('./bnpl-field-orders.js');
    const { loadPayments } = await import('./bnpl-field-payments.js');
    const [orders, pays] = await Promise.all([loadOrders(), loadPayments()]);
    acm = uniqueAgents(orders, pays).map((a) => ({
      id: a.sa_id || a.id,
      sa_id: a.sa_id || a.id,
      full_name: a.full_name,
      name: a.name,
      location_code: locCode || 'BNPL-FIELD',
      subsidiary_code: 'bnpl',
      is_active: true,
      is_field_agent: true,
      source: 'acm',
    }));
  } catch { /* pack */ }
  const by = new Map();
  [...remote, ...local, ...acm].forEach((a) => {
    if (!a) return;
    const k = String(a.sa_id || a.id || a.full_name || '').toUpperCase();
    if (!k) return;
    const prev = by.get(k);
    by.set(k, prev ? { ...a, ...prev, sa_id: prev.sa_id || a.sa_id, full_name: prev.full_name || a.full_name } : a);
  });
  const rows = [...by.values()].sort((a, b) => String(a.full_name || a.name || '').localeCompare(String(b.full_name || b.name || '')));
  _agentCache = { key, rows };
  return rows;
}

export function clearAgentCache() {
  _agentCache = null;
}

let _locGate = null;
/** Optional filter applied to header / POS location dropdowns (assigned shops). */
export function setLocationGate(fn) {
  _locGate = typeof fn === 'function' ? fn : null;
}

/** Shop/branch locations. Operations Hub is never listed under a selling company. */
export function locationsFor(subCode, opts = {}) {
  const market = BUSINESS_LOCATIONS.filter((l) => !l.alias && !l.hub && l.code !== 'OPS-HUB');
  const shops = (!subCode || subCode === 'group' || subCode === 'ops')
    ? market.slice()
    : market.filter((l) => l.subsidiary === subCode);
  if (opts.includeHub && !opts.forSale) {
    return [OPS_HUB, ...shops];
  }
  if (opts.forSale) return shops.filter((l) => l.sellable !== false && l.marketplace !== false);
  return shops;
}

export function sellingLocationsFor(subCode) {
  return locationsFor(subCode, { forSale: true });
}

export function findLocation(code) {
  if (!code) return null;
  if (isHubWarehouse(code)) return OPS_HUB;
  const s = String(code);
  return BUSINESS_LOCATIONS.find((l) =>
    l.code === s || l.name === s || String(l.name).toLowerCase() === s.toLowerCase()
  ) || null;
}

/** Shop is the source of truth. Company on a till must be that shop's parent. */
export function pairFromLocation(codeOrName, fallbackSub = '') {
  const L = findLocation(codeOrName);
  if (!L || L.hub || L.office) {
    const shops = locationsFor(fallbackSub, { forSale: true });
    const first = shops[0] || null;
    return {
      subsidiary: first?.subsidiary || fallbackSub || '',
      location_code: first?.code || '',
      location_name: first?.name || '',
      location: first,
      mismatched: true,
    };
  }
  const want = String(fallbackSub || '').toLowerCase();
  const got = String(L.subsidiary || '').toLowerCase();
  return {
    subsidiary: L.subsidiary,
    location_code: L.code,
    location_name: L.name,
    location: L,
    mismatched: !!(want && want !== 'group' && want !== 'ops' && want !== got),
  };
}

export function applyTillPair(till) {
  if (!till || typeof till !== 'object') return till;
  const pair = pairFromLocation(till.location_code || till.location_name, till.subsidiary_code);
  till.subsidiary_code = pair.subsidiary;
  till.location_code = pair.location_code;
  till.location_name = pair.location_name;
  return till;
}

/** One name only — never "Field, Online, Virtual WH". */
export function singleLocationName(warehouse, opts = {}) {
  const locCode = opts.locCode ?? getActiveLocation();
  const subCode = opts.subCode ?? getActiveSubsidiary()?.code;
  if (locCode) {
    const selected = findLocation(locCode);
    if (selected) return selected.name;
  }
  if (isVirtualWh(warehouse) || isHubWarehouse(warehouse)) return OPS_HUB.name;
  const home = BUSINESS_LOCATIONS.find((l) =>
    l.warehouse === warehouse && (!subCode || subCode === 'group' || l.subsidiary === subCode)
  );
  if (home) return home.name;
  const shops = locationsFor(subCode, { forSale: true });
  const hits = shops.filter((l) => l.warehouse === warehouse);
  if (hits.length) return (hits.find((l) => l.primary) || hits[0]).name;
  return '';
}

export function homeLocationOfPrefix(prefix) {
  const sub = Object.entries(SUB_PREFIX).find(([, p]) => p === String(prefix || '').toUpperCase())?.[0];
  if (!sub) return null;
  const shops = locationsFor(sub, { forSale: true });
  return shops.find((l) => l.primary) || shops[0] || null;
}

export function primaryLocationFor(subCode) {
  const shops = locationsFor(subCode, { forSale: true });
  return shops.find((l) => l.primary) || shops[0] || null;
}

/** Fill subsidiary + shop for demo/test rows that were saved without a location. */
export function inferRowScope(row = {}, fallbackSub = '') {
  let sub = String(row.subsidiary_code || row.home_subsidiary || row.operating_code || '').toLowerCase();
  if (sub === 'group') sub = '';
  const sku = String(row.sku || '').toUpperCase();
  const skuPre = sku.slice(0, 3);
  if (!sub) {
    const fromSku = Object.entries(SUB_PREFIX).find(([, p]) => p === skuPre)?.[0];
    if (fromSku) sub = fromSku;
  }
  let loc = String(row.location_code || '').trim();
  const locHit = findLocation(loc) || findLocation(row.location_name);
  if (locHit) {
    loc = locHit.code;
    if (!sub) sub = locHit.subsidiary;
  } else {
    loc = '';
  }
  if (!sub && /bnpl|hire.?purchase/i.test(String(row.group_name || row.customer_group || ''))) sub = 'bnpl';
  if (!sub) sub = String(fallbackSub || '').toLowerCase();
  if (sub === 'group') sub = '';
  if (sub === 'bnpl' && !loc) {
    loc = OPS_HUB.code;
  }
  if (HUB_PREFIXES.has(skuPre) && !loc) loc = OPS_HUB.code;
  if (sub && !loc && sub !== 'ops') loc = primaryLocationFor(sub)?.code || '';
  if (sub === 'ops' && !loc) loc = OPS_HUB.code;
  return {
    subsidiary_code: sub || null,
    location_code: loc || null,
    location_name: (loc && findLocation(loc)?.name) || row.location_name || null,
  };
}

export function skuPrefixOf(p) {
  const sku = String(p?.sku || '').toUpperCase();
  const dashed = sku.match(/^([A-Z]{3})(?:-|\d)/);
  if (dashed) return dashed[1];
  if (/^[A-Z]{3}\d{4}/.test(sku)) return sku.slice(0, 3);
  const home = String(p?.home_subsidiary || p?.subsidiary_code || '').toLowerCase();
  if (SUB_PREFIX[home]) return SUB_PREFIX[home];
  const three = home.slice(0, 3);
  const map = { axi: 'AXI', fib: 'FIB', del: 'DEL', bnp: 'BNP', whv: 'OPH', grp: 'OPH', oph: 'OPH', ops: 'OPH' };
  if (map[three]) return map[three];
  if (/^[A-Z]{3}$/.test(sku.slice(0, 3))) return sku.slice(0, 3);
  return '';
}

/** Operations Hub / parent HQ sees every subsidiary book. Fiberkapp silo is the only hide. */
export function isHubOversight(subCode) {
  const c = String(subCode ?? getActiveSubsidiary()?.code ?? '').toLowerCase();
  return !c || c === 'ops' || c === 'group' || c === 'parent' || c === 'delkor-fiberk';
}

export function stockVisibleAtLocation(p, locCode) {
  const loc = locCode === undefined ? getActiveLocation() : locCode;
  if (!loc) return true;
  if (isHubWarehouse(loc) && isHubOversight()) return true;
  const rowLoc = String(p?.location_code || p?.warehouse_code || '').trim();
  if (isHubWarehouse(loc)) return !rowLoc || isHubWarehouse(rowLoc);
  return rowLoc === loc;
}

export function productMatchesScope(p, subCode, locCode, agentId) {
  const prefix = skuPrefixOf(p);
  const sub = subCode || getActiveSubsidiary()?.code;
  const loc = locCode === undefined ? getActiveLocation() : locCode;
  if (isHubOversight(sub)) {
    if (loc && !isHubWarehouse(loc) && !stockVisibleAtLocation(p, loc)) return false;
    return agentMatches(p, loc, agentId);
  }
  if (sub && sub !== 'group') {
    const rowSub = String(p.subsidiary_code || p.home_subsidiary || '').toLowerCase();
    if (rowSub && rowSub !== sub) return false;
    const want = SUB_PREFIX[sub];
    if (want && prefix && !HUB_PREFIXES.has(prefix) && prefix !== want) return false;
  }
  if (!stockVisibleAtLocation(p, loc)) return false;
  return agentMatches(p, loc, agentId);
}

function rowAgentId(row) {
  if (!row) return '';
  return String(
    row.agent_id
    || row.field_agent_id
    || row.assigned_agent_id
    || row.commission_agent_id
    || row.sales_commission_agent_id
    || row.sa_id
    || ''
  ).trim();
}

function agentMatches(row, locCode, agentId) {
  const loc = locCode === undefined ? getActiveLocation() : locCode;
  const agent = agentId === undefined ? getActiveAgent() : agentId;
  if (!agent) return true;
  if (!locationSupportsAgents(loc)) return true;
  const want = String(agent);
  if (rowAgentId(row) === want) return true;
  const list = _agentCache?.rows || [];
  const picked = list.find((a) => String(a.id) === want || String(a.sa_id) === want);
  const saName = String(row.sa_name || row.agent_name || '').trim().toLowerCase();
  if (picked) {
    if (rowAgentId(row) && String(picked.sa_id || picked.id) === rowAgentId(row)) return true;
    const pn = String(picked.full_name || picked.name || '').trim().toLowerCase();
    if (saName && pn && saName === pn) return true;
  }
  if (saName && saName === want.toLowerCase()) return true;
  return false;
}

/** Sidebar company + location + field agent is the only filter. Unstamped rows show only under All. */
export function rowMatchesScope(row, subCode, locCode, agentId) {
  if (!row) return false;
  const inferred = inferRowScope(row);
  const sub = subCode || getActiveSubsidiary()?.code;
  const loc = locCode === undefined ? getActiveLocation() : locCode;
  const rowSub = String(row.subsidiary_code || row.home_subsidiary || inferred.subsidiary_code || '').toLowerCase();
  const rowLoc = String(row.location_code || inferred.location_code || '').trim();
  if (isHubOversight(sub)) {
    if (loc && !isHubWarehouse(loc) && !stockVisibleAtLocation({
      ...row,
      location_code: rowLoc,
      intended_location_code: row.intended_location_code,
    }, loc)) return false;
    return agentMatches(row, loc, agentId);
  }
  if (sub && sub !== 'group') {
    if (!rowSub || rowSub !== String(sub).toLowerCase()) return false;
  }
  if (loc && !stockVisibleAtLocation({
    ...row,
    location_code: rowLoc,
    intended_location_code: row.intended_location_code,
  }, loc)) {
    return false;
  }
  return agentMatches(row, loc, agentId);
}

export function filterBySidebar(rows) {
  return (rows || []).filter((r) => rowMatchesScope(r));
}

/**
 * sales_orders does NOT reliably carry location_code (POS writes location_id + location_name
 * only — see public/pos.html insert payload). Match on location_name/subsidiary_code instead,
 * and optionally on the commission agent tied to the sale.
 */
export function salesOrderMatchesScope(row, subCode, locCode, agentId) {
  if (!row) return false;
  const sub = subCode || getActiveSubsidiary()?.code;
  const loc = locCode === undefined ? getActiveLocation() : locCode;
  const agent = agentId === undefined ? getActiveAgent() : agentId;
  const rowSub = String(row.subsidiary_code || '').toLowerCase();
  if (sub && sub !== 'group' && rowSub && rowSub !== String(sub).toLowerCase()) return false;
  if (loc) {
    const L = findLocation(loc);
    const rowLocName = String(row.location_name || '').trim().toLowerCase();
    const rowLoc = String(row.location_code || '').trim();
    if (isVirtualWh(loc)) {
      if (!isVirtualWh(rowLocName + ' ' + rowLoc)) return false;
    } else if (L) {
      const hit = findLocation(rowLoc) || findLocation(row.location_name);
      if (hit) {
        const code = hit.alias ? 'DEL-ONLINE' : hit.code;
        if (code !== L.code && hit.name !== L.name) return false;
      } else if (rowLoc && rowLoc !== L.code) return false;
      else if (!rowLoc && rowLocName && rowLocName !== L.name.toLowerCase()) return false;
    }
  }
  if (agent && String(row.commission_agent_id || row.agent_id || '') !== String(agent)) return false;
  return true;
}

export function scopeCaption() {
  const sub = getActiveSubsidiary();
  const loc = getActiveLocation();
  const L = loc ? findLocation(loc) : null;
  const company = !sub || sub.code === 'group' ? 'All Subsidiaries'
    : sub.code === 'ops' ? 'Operations Hub'
    : (sub.name || sub.code);
  const shop = !loc ? 'All Locations' : (L?.name || loc);
  const agent = getActiveAgent();
  if (agent && locationSupportsAgents(loc)) {
    const label = document.querySelector('[data-scope-agent] option:checked')?.textContent || 'Selected agent';
    return `${company} · ${shop} · ${label}`;
  }
  if (locationSupportsAgents(loc)) return `${company} · ${shop} · All Agents`;
  return `${company} · ${shop}`;
}

/** Markup for page filter cards — only when BNPL Field is the active location. */
export function filterAgentHtml(id = 'f-agent') {
  const loc = getActiveLocation();
  if (!locationSupportsAgents(loc)) return '';
  return `<div data-scope-agent-wrap>
    Field Agent:<br>
    <select id="${id}" data-scope-agent title="Field agent"></select>
  </div>`;
}

export function fillLocSelect(sel, subCode, locCode) {
  if (!sel) return;
  const forSale = sel.getAttribute('data-scope-loc') === 'sale';
  let locs = locationsFor(subCode, { forSale });
  if (_locGate) {
    try { locs = _locGate(locs, subCode) || locs; } catch { /* keep unfiltered */ }
  }
  const cur = locCode ?? getActiveLocation() ?? '';
  const first = sel.getAttribute('data-empty-label') || 'All Locations';
  sel.innerHTML = `<option value="">${first}</option>` +
    locs.map((l) => `<option value="${l.code}" ${l.code === cur ? 'selected' : ''}>${l.name}</option>`).join('');
  sel.value = cur && [...sel.options].some((o) => o.value === cur) ? cur : '';
}

function _esc(s) {
  return String(s ?? '').replace(/[&<>"']/g, (c) =>
    ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}

/** Current left-rail master. Empty locCode means All Locations. */
export function masterScope() {
  const sub = getActiveSubsidiary();
  return {
    subCode: sub?.code || 'group',
    locCode: getActiveLocation() || '',
    agentId: getActiveAgent() || '',
    sub,
  };
}

/** Shops the active subsidiary may pick. Pass includeVirtual to add Operations Hub as a warehouse hop. */
export function scopedLocations({ includeVirtual = false, allSubsidiaries = false, forSale = false } = {}) {
  const sub = allSubsidiaries ? 'group' : (getActiveSubsidiary()?.code || 'group');
  let locs = locationsFor(sub, { forSale, includeHub: includeVirtual });
  if (!includeVirtual) locs = locs.filter((l) => !isVirtualWh(l.code));
  return locs;
}

export function defaultFormLocation(existing) {
  if (existing) return existing;
  return getActiveLocation() || '';
}

export function defaultFormSubsidiary(existing) {
  if (existing) return existing;
  const code = getActiveSubsidiary()?.code;
  return code && code !== 'group' ? code : '';
}

/** <option> list for a record Location field. Defaults to the left master. */
export function formLocOptions(selected, {
  includeVirtual = false,
  allSubsidiaries = false,
  forSale = false,
  placeholder = 'Please Select',
} = {}) {
  const cur = defaultFormLocation(selected);
  let locs = scopedLocations({ includeVirtual, allSubsidiaries, forSale });
  if (cur && !locs.some((l) => l.code === cur)) {
    const extra = findLocation(cur);
    if (extra) locs = locs.concat(extra);
  }
  return `<option value="">${_esc(placeholder)}</option>` +
    locs.map((l) => `<option value="${_esc(l.code)}" ${l.code === cur ? 'selected' : ''}>${_esc(l.name)}</option>`).join('');
}

const FILTER_SUB = 'select[data-scope-sub], select#f-sub, select#ult-sub, select[data-filter-sub]';
const FILTER_LOC = 'select[data-scope-loc], select#f-loc, select#ult-loc, select[data-filter-loc]';
const FILTER_AGENT = 'select[data-scope-agent], select#f-agent, select#ult-agent, select[data-filter-agent]';

/** After a list page paints, force its filter sub/loc to the left master. */
export function wirePageFilters(root = document) {
  const { subCode, locCode, agentId } = masterScope();
  root.querySelectorAll('select#f-sub, select[data-filter-sub], select[data-scope-sub]').forEach((sel) => {
    if (sel.id === 'ult-sub') return;
    if (!sel.hasAttribute('data-scope-sub')) sel.setAttribute('data-scope-sub', '');
    const want = !subCode || subCode === 'group' ? '' : subCode;
    if ([...sel.options].some((o) => o.value === want)) sel.value = want;
    else if ([...sel.options].some((o) => o.value === subCode)) sel.value = subCode;
  });
  root.querySelectorAll('select#f-loc, select[data-filter-loc], select[data-scope-loc]').forEach((sel) => {
    if (sel.id === 'ult-loc') return;
    if (!sel.hasAttribute('data-scope-loc')) sel.setAttribute('data-scope-loc', '');
    fillLocSelect(sel, subCode, locCode);
  });
  root.querySelectorAll('select#f-agent, select[data-filter-agent], select[data-scope-agent]').forEach((sel) => {
    if (sel.id === 'ult-agent') return;
    fillAgentSelect(sel, subCode, locCode, agentId);
  });
}

export async function fillAgentSelect(sel, subCode, locCode, agentId) {
  if (!sel) return;
  const supports = locationSupportsAgents(locCode);
  sel.closest('[data-scope-agent-wrap]')?.toggleAttribute('hidden', !supports);
  sel.disabled = !supports;
  if (!supports) {
    sel.innerHTML = '<option value="">All Agents</option>';
    sel.dataset.filled = '1';
    return;
  }
  const agents = await fetchAgentsForScope(subCode, locCode);
  const cur = agentId ?? getActiveAgent() ?? '';
  sel.innerHTML = `<option value="">All Agents</option>` +
    agents.map((a) => {
      const lab = a.full_name || a.name || a.email || a.id;
      const id = a.sa_id && a.sa_id !== lab ? ` · ${a.sa_id}` : '';
      return `<option value="${a.id}" ${String(a.id) === String(cur) ? 'selected' : ''}>${lab}${id}</option>`;
    }).join('');
  sel.dataset.filled = '1';
}

export function syncScopeDom(subCode, locCode, agentId) {
  const sub = subCode || getActiveSubsidiary()?.code || 'group';
  const loc = locCode === undefined ? getActiveLocation() : locCode;
  const agent = agentId === undefined ? getActiveAgent() : agentId;
  document.querySelectorAll(FILTER_SUB).forEach((sel) => {
    const want = !sub || sub === 'group' ? (sel.id === 'ult-sub' ? 'group' : '') : sub;
    if ([...sel.options].some((o) => o.value === want)) sel.value = want;
    else if ([...sel.options].some((o) => o.value === sub)) sel.value = sub;
  });
  document.querySelectorAll(FILTER_LOC).forEach((sel) => fillLocSelect(sel, sub, loc));
  document.querySelectorAll(FILTER_AGENT).forEach((sel) => { fillAgentSelect(sel, sub, loc, agent); });
}

export async function commitScope({ userId, subCode, locCode, agentId, reload = false, source } = {}) {
  const sub = SUBSIDIARIES.find((s) => s.code === (subCode || 'group')) || SUBSIDIARIES[0];
  if (userId) await saveActiveSubsidiary(userId, sub);
  else setActiveSubsidiaryMemory(sub);

  let loc = locCode === undefined ? getActiveLocation() : (locCode || '');
  const L = findLocation(loc);
  if (L && L.subsidiary && L.subsidiary !== 'ops' && sub.code !== 'ops' && sub.code !== 'group' && L.subsidiary !== sub.code) {
    loc = '';
  }
  const allowed = locationsFor(sub.code).map((l) => l.code);
  if (sub.code === 'ops' || sub.code === 'group') {
    if (loc === OPS_HUB.code || isHubWarehouse(loc)) loc = '';
  } else if (loc && !allowed.includes(loc)) {
    loc = allowed[0] || '';
  }
  saveActiveLocation(loc);

  let agent = agentId === undefined ? getActiveAgent() : (agentId || '');
  if (agent && !locationSupportsAgents(loc)) agent = '';
  saveActiveAgent(agent);

  syncScopeDom(sub.code, loc, agent);
  window.dispatchEvent(new CustomEvent(SCOPE_EVENT, { detail: { subCode: sub.code, locCode: loc, agentId: agent } }));
  if (reload) {
    if (typeof window.__dfRefreshPane === 'function') window.__dfRefreshPane();
    else window.dispatchEvent(new CustomEvent('df-tab', { detail: location.pathname + location.search }));
  }
  return { sub, loc, agent };
}

export function watchScopeSelects(userId) {
  if (typeof window === 'undefined') return;
  installScopeListenerGuard();
  window.__dfUserId = userId;
  syncScopeDom();
  startScopeMirror();
  if (window.__dfScopeWatch) return;
  window.__dfScopeWatch = true;
  document.addEventListener('change', (e) => {
    const t = e.target;
    if (!(t instanceof HTMLSelectElement)) return;
    if (t.matches('select[data-scope-sub], select#f-sub, select[data-filter-sub]')) {
      commitScope({ userId: window.__dfUserId, subCode: t.value, locCode: getActiveLocation(), agentId: '', reload: false, source: 'sub' });
    } else if (t.matches('select[data-scope-loc], select#f-loc, select[data-filter-loc]')) {
      let sub = getActiveSubsidiary()?.code || 'group';
      const loc = findLocation(t.value);
      if (loc && loc.subsidiary && loc.subsidiary !== 'group' && !isVirtualWh(loc.code)) {
        sub = loc.subsidiary;
      }
      commitScope({ userId: window.__dfUserId, subCode: sub, locCode: t.value, agentId: '', reload: false, source: 'loc' });
    } else if (t.matches('select[data-scope-agent], select#f-agent, select[data-filter-agent]')) {
      commitScope({ userId: window.__dfUserId, subCode: getActiveSubsidiary()?.code, locCode: getActiveLocation(), agentId: t.value, reload: false, source: 'agent' });
    }
  });
}

/** Left master and right-pane filter cards stay the same value after every paint. */
function startScopeMirror() {
  if (typeof window === 'undefined' || window.__dfScopeMirror) return;
  window.__dfScopeMirror = true;
  let t = 0;
  const run = () => {
    if (t) clearTimeout(t);
    t = setTimeout(() => {
      try { wirePageFilters(document); } catch { /* ignore */ }
    }, 30);
  };
  window.addEventListener(SCOPE_EVENT, run);
  window.addEventListener('df-tab', run);
  window.addEventListener('popstate', run);
  const app = document.getElementById('app') || document.body;
  if (app && typeof MutationObserver !== 'undefined') {
    const obs = new MutationObserver(run);
    obs.observe(app, { childList: true, subtree: true });
  }
}
