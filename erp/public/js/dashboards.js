/**
 * Custom dashboards — groups sit above roles.
 * Groups: hq | cashier | agent | customer | supplier
 * Admin CRUD lives on /custom-dashboards.html
 *
 * Boards persist to localStorage always, and to supabase custom_dashboards
 * when that table exists (sql/47_custom_dashboards.sql).
 */
import { supabase, fmt, getActiveSubsidiary } from './supabaseClient.js';
import { getAccess } from './rbac.js';
import { filterBySidebar, BUSINESS_LOCATIONS, findLocation } from './scope.js';
import { loadRows } from './ls-rows.js';
import { KEYS as CAT_KEYS, SEED_PRODUCTS, isDemoProduct, isCirculatingProduct } from './catalog-seed.js';

export const DASH_GROUPS = [
  { id: 'hq', label: 'Head office', home: '/dashboard.html', staff: true },
  { id: 'cashier', label: 'Cashier', home: '/dashboard.html', staff: true },
  { id: 'agent', label: 'Agent', home: '/dashboard.html', staff: true },
  { id: 'customer', label: 'Customer', home: '/customer-home.html', staff: false },
  { id: 'supplier', label: 'Supplier', home: '/supplier-home.html', staff: false },
];

const OFFICE = /admin|owner|manager|hq|founder|accountant|auditor|supervisor|inventory|hr admin/;
const CASHIER = /cashier|teller|attendant/;
const AGENT = /agent|commission|sales/;
const CUST = /customer|client|buyer/;
const SUP = /supplier|vendor/;

const LS_BOARDS = 'df_custom_dashboards';
const LS_ACCESS = 'df_dash_access';
const LS_DRAFT = 'df_dash_draft';

export const WIDGETS = [
  { id: 'total_sell', label: 'Total Sales', size: 25, range: true, location: true },
  { id: 'net', label: 'Net', size: 25, range: true, location: true },
  { id: 'invoice_due', label: 'Invoice due', size: 25, range: true, location: true },
  { id: 'sell_return', label: 'Total sell return', size: 25, range: true, location: true },
  { id: 'total_purchase', label: 'Total Purchase', size: 25, range: true, location: true },
  { id: 'purchase_due', label: 'Purchase due', size: 25, range: true, location: true },
  { id: 'purchase_return', label: 'Total Purchase Return', size: 25, range: true, location: true },
  { id: 'expense', label: 'Expense', size: 25, range: true, location: true },
  { id: 'payment_recovered', label: 'Payment Recovered', size: 25, range: true, location: true },
  { id: 'current_stock_value', label: 'Current stock value', size: 25, location: true },
  { id: 'cash_register', label: 'Cash in registers', size: 25, location: true },
  { id: 'sales_last_30_days', label: 'Sales Last 30 Days', size: 100, range: true, location: true, chart: true },
  { id: 'sales_current_fy', label: 'Sales Current Financial Year', size: 100, location: true, chart: true },
  { id: 'payment_dues', label: 'Customer dues', size: 50, location: true },
  { id: 'product_stock_alert', label: 'Product Stock Alert', size: 50, location: true },
  { id: 'stock_expiry_alert', label: 'Stock expiry alert', size: 50, location: true },
  { id: 'sales_order', label: 'Sales Order', size: 50, range: true, location: true },
  { id: 'pending_shipments', label: 'Pending Shipments', size: 50, location: true },
  { id: 'top_products', label: 'Top products', size: 50, range: true, location: true },
  { id: 'top_customers', label: 'Top customers', size: 50, range: true, location: true },
  { id: 'top_staff', label: 'Top staff', size: 50, range: true, location: true },
  { id: 'payment_methods', label: 'Payment method breakdown', size: 50, range: true, location: true },
  { id: 'location_perf', label: 'Per-location performance', size: 100, range: true },
  { id: 'my_commission', label: 'My commission', size: 25, range: true },
  { id: 'my_leads', label: 'My leads', size: 50 },
  { id: 'my_tickets', label: 'My tickets', size: 50, range: true },
  { id: 'my_invoices', label: 'My invoices', size: 100 },
  { id: 'my_pos', label: 'My purchase orders', size: 100 },
  { id: 'html_text', label: 'Custom HTML / note', size: 50, html: true },
];

export const RANGES = [
  ['today', 'Today'],
  ['yesterday', 'Yesterday'],
  ['7', 'Last 7 Days'],
  ['30', 'Last 30 Days'],
  ['month', 'This Month'],
  ['last_month', 'Last Month'],
  ['year', 'This Year'],
  ['fy', 'Current financial year'],
];

export const SIZES = [25, 50, 75, 100];

function w(type, heading, size, extra = {}) {
  return { type, heading, size, range: extra.range || '', location: extra.location || '', html_text: extra.html_text || '', show_data: extra.show_data || 'show_all_data' };
}

export const DASH_TEMPLATES = [
  {
    key: 'owner',
    name: 'Owner Overview',
    icon: '📈',
    n: 8,
    descr: 'High-level monthly metrics: total sales, net, expenses, sales trend, top products, top customers, and dues aging. Great default for business owners.',
    widgets: [
      w('total_sell', 'Total Sales', 25, { range: 'month' }),
      w('net', 'Net', 25, { range: 'month' }),
      w('expense', 'Expense', 25, { range: 'month' }),
      w('invoice_due', 'Invoice due', 25, { range: 'month' }),
      w('sales_last_30_days', 'Sales trend', 100, { range: '30' }),
      w('top_products', 'Top products', 50, { range: 'month' }),
      w('top_customers', 'Top customers', 50, { range: 'month' }),
      w('payment_dues', 'Dues aging', 100),
    ],
  },
  {
    key: 'cashier',
    name: 'Cashier Daily',
    icon: '🧾',
    n: 5,
    descr: "Today's sales, dues, cash register, payment breakdown, and recent activity. Perfect for cashiers at the start/end of a shift.",
    widgets: [
      w('total_sell', "Today's sales", 25, { range: 'today', show_data: 'show_own_data' }),
      w('invoice_due', 'Sales due', 25, { range: 'today', show_data: 'show_own_data' }),
      w('cash_register', 'Cash register', 25),
      w('payment_methods', 'Payment breakdown', 25, { range: 'today', show_data: 'show_own_data' }),
      w('my_tickets', 'Recent activity', 100, { range: 'today', show_data: 'show_own_data' }),
    ],
  },
  {
    key: 'manager',
    name: 'Manager Weekly',
    icon: '📅',
    n: 8,
    descr: 'Last 7 days view: sales trend, top staff, top categories, and per-location performance. For store/branch managers.',
    widgets: [
      w('total_sell', 'Total Sales', 25, { range: '7' }),
      w('net', 'Net', 25, { range: '7' }),
      w('expense', 'Expense', 25, { range: '7' }),
      w('invoice_due', 'Invoice due', 25, { range: '7' }),
      w('sales_last_30_days', 'Sales trend', 100, { range: '7' }),
      w('top_staff', 'Top staff', 50, { range: '7' }),
      w('top_products', 'Top products', 50, { range: '7' }),
      w('location_perf', 'Per-location performance', 100, { range: '7' }),
    ],
  },
  {
    key: 'inventory',
    name: 'Inventory Manager',
    icon: '📦',
    n: 5,
    descr: 'Low and expiring stock alerts, top movers, recent purchases, and pending POs/shipments. For procurement and warehouse teams.',
    widgets: [
      w('product_stock_alert', 'Low stock', 50),
      w('stock_expiry_alert', 'Expiring stock', 50),
      w('top_products', 'Top movers', 50, { range: '30' }),
      w('total_purchase', 'Recent purchases', 50, { range: '30' }),
      w('pending_shipments', 'Pending POs / shipments', 100),
    ],
  },
  {
    key: 'hq',
    name: 'Head Office',
    icon: '🏢',
    n: 8,
    descr: 'Group-wide KPIs across subsidiaries and locations. Default for HQ admin.',
    widgets: [
      w('total_sell', 'Group sales', 25, { range: 'month' }),
      w('net', 'Net', 25, { range: 'month' }),
      w('expense', 'Expense', 25, { range: 'month' }),
      w('current_stock_value', 'Stock value', 25),
      w('sales_current_fy', 'This year', 100),
      w('location_perf', 'Per-location', 100, { range: 'month' }),
      w('payment_dues', 'Customer dues', 50),
      w('purchase_due', 'Supplier dues', 50),
    ],
  },
  {
    key: 'agent_field',
    name: 'Agent Field',
    icon: '🚶',
    n: 5,
    descr: 'Field agent view: own commission, leads, and BNPL sales only.',
    widgets: [
      w('my_commission', 'My commission', 25, { range: 'month', show_data: 'show_own_data' }),
      w('total_sell', 'My sales', 25, { range: 'month', show_data: 'show_own_data' }),
      w('invoice_due', 'My dues', 25, { range: 'month', show_data: 'show_own_data' }),
      w('my_leads', 'My leads', 25, { show_data: 'show_own_data' }),
      w('my_tickets', 'My tickets', 100, { range: '30', show_data: 'show_own_data' }),
    ],
  },
  {
    key: 'customer_portal',
    name: 'Customer Portal',
    icon: '👤',
    n: 3,
    descr: 'Customer-facing: own invoices and outstanding balance only.',
    widgets: [
      w('invoice_due', 'Amount due', 50, { show_data: 'show_own_data' }),
      w('payment_recovered', 'Paid', 50, { show_data: 'show_own_data' }),
      w('my_invoices', 'My invoices', 100, { show_data: 'show_own_data' }),
    ],
  },
  {
    key: 'supplier_portal',
    name: 'Supplier Portal',
    icon: '🏭',
    n: 3,
    descr: 'Supplier-facing: purchase orders placed with them and amount due.',
    widgets: [
      w('purchase_due', 'Amount due to me', 50, { show_data: 'show_own_data' }),
      w('total_purchase', 'Orders', 50, { range: 'year', show_data: 'show_own_data' }),
      w('my_pos', 'My purchase orders', 100, { show_data: 'show_own_data' }),
    ],
  },
];

export function widgetMeta(id) {
  return WIDGETS.find((x) => x.id === id) || { id, label: id, size: 50 };
}

export function inferGroup(profile, access) {
  const role = String(access?.roleName || profile?.role || profile?.role_name || '').toLowerCase();
  if (CUST.test(role)) return 'customer';
  if (SUP.test(role)) return 'supplier';
  return 'hq';
}

export function homeForGroup(group) {
  return DASH_GROUPS.find((g) => g.id === group)?.home || '/dashboard.html';
}

export function loadLocalBoards() {
  try { return JSON.parse(localStorage.getItem(LS_BOARDS) || '[]'); } catch { return []; }
}
export function saveLocalBoards(rows) {
  localStorage.setItem(LS_BOARDS, JSON.stringify(rows));
}

const DEMO_FLAG = 'df_dash_demo_v1';
const STRIP_FLAG = 'df_dash_demo_stripped';
const DEMO_IDS = new Set(['dash-owner', 'dash-fiberk', 'dash-bnpl', 'dash-axi', 'dash-delkor', 'dash-customer', 'dash-supplier']);
const DEMO_NAMES = new Set(['owner overview', 'fiberk shop floor', 'bnpl field agent', 'axidigetek ecommerce', 'delkor warehouse', 'customer portal', 'supplier portal']);

function isSeedBoard(b) {
  if (!b) return false;
  if (DEMO_IDS.has(String(b.id))) return true;
  if (b.is_template || b.template_key) return true;
  if (String(b.created_by || '') === 'local-hq') return true;
  return DEMO_NAMES.has(String(b.name || '').trim().toLowerCase());
}

export function ensureDemoBoards() {
  return stripDemoBoards();
}

export function stripDemoBoards() {
  const existing = loadLocalBoards();
  const kept = existing.filter((b) => !isSeedBoard(b));
  if (kept.length !== existing.length) saveLocalBoards(kept);
  try {
    const acc = loadAccessSettings();
    let dirty = false;
    const scrub = (slot) => {
      if (!slot) return slot;
      const dashboards = (slot.dashboards || []).filter((id) => !DEMO_IDS.has(String(id)));
      const def = DEMO_IDS.has(String(slot.default || '')) ? '' : (slot.default || '');
      if (dashboards.length !== (slot.dashboards || []).length || def !== (slot.default || '')) dirty = true;
      return { ...slot, dashboards, default: def };
    };
    if (acc.groups) Object.keys(acc.groups).forEach((k) => { acc.groups[k] = scrub(acc.groups[k]); });
    if (acc.roles) Object.keys(acc.roles).forEach((k) => { acc.roles[k] = scrub(acc.roles[k]); });
    if (dirty) saveAccessSettings(acc);
    localStorage.removeItem(DEMO_FLAG);
    localStorage.setItem(STRIP_FLAG, '1');
  } catch { /* ignore */ }
  return kept;
}

export const DEMO_ROLES = [
  { id: 'r-hq', name: 'HQ Admin' },
  { id: 'r-acct', name: 'Accountant' },
  { id: 'r-mgr', name: 'Store Manager' },
  { id: 'r-cash', name: 'Cashier' },
  { id: 'r-agent', name: 'Sales Agent' },
  { id: 'r-cust', name: 'Customer' },
  { id: 'r-sup', name: 'Supplier' },
];

function demoBoard(id, name, tplKey, extra = {}) {
  const tpl = DASH_TEMPLATES.find((t) => t.key === tplKey) || DASH_TEMPLATES[0];
  return {
    id,
    name,
    widgets: tpl.widgets,
    auto_refresh_min: extra.auto_refresh_min || 0,
    is_template: false,
    is_public: extra.is_public || false,
    description: tpl.descr,
    created_by: extra.created_by || 'local-hq',
    created_by_name: extra.created_by_name || 'HQ Finance',
    subsidiary_code: extra.subsidiary_code || 'group',
    created_at: extra.created_at || '2026-01-08T08:00:00.000Z',
  };
}

export function loadAccessSettings() {
  try { return JSON.parse(localStorage.getItem(LS_ACCESS) || 'null') || emptyAccess(); }
  catch { return emptyAccess(); }
}
export function saveAccessSettings(s) {
  localStorage.setItem(LS_ACCESS, JSON.stringify(s));
}
function emptyAccess() {
  const groups = {};
  DASH_GROUPS.forEach((g) => { groups[g.id] = { dashboards: [], default: '' }; });
  return { groups, roles: {} };
}

export function setDraft(d) { sessionStorage.setItem(LS_DRAFT, JSON.stringify(d)); }
export function takeDraft() {
  try {
    const v = sessionStorage.getItem(LS_DRAFT);
    sessionStorage.removeItem(LS_DRAFT);
    return v ? JSON.parse(v) : null;
  } catch { return null; }
}

export async function fetchBoards() {
  stripDemoBoards();
  let remote = [];
  let err = null;
  try {
    const r = await supabase.from('custom_dashboards').select('*').order('created_at', { ascending: false });
    if (r.error) err = r.error.message;
    else remote = r.data || [];
  } catch (e) { err = e.message; }
  const map = new Map();
  loadLocalBoards().forEach((b) => map.set(String(b.id), b));
  remote.forEach((b) => map.set(String(b.id), { ...map.get(String(b.id)), ...b }));
  const rows = [...map.values()]
    .filter((b) => !isSeedBoard(b))
    .sort((a, b) => String(b.created_at || '').localeCompare(String(a.created_at || '')));
  return { rows, err };
}

export async function saveBoard(board, session) {
  const id = board.id || (crypto.randomUUID ? crypto.randomUUID() : String(Date.now()));
  const row = {
    id,
    name: board.name,
    widgets: board.widgets || [],
    auto_refresh_min: Number(board.auto_refresh_min || 0),
    is_template: false,
    is_public: !!board.is_public,
    description: board.description || '',
    created_by: session?.user?.id || board.created_by || null,
    created_by_name: session?.user?.email || board.created_by_name || '',
    subsidiary_code: board.subsidiary_code || getActiveSubsidiary()?.code || null,
    created_at: board.created_at || new Date().toISOString(),
    updated_at: new Date().toISOString(),
  };
  const all = loadLocalBoards();
  const idx = all.findIndex((x) => String(x.id) === String(id));
  if (idx >= 0) all[idx] = { ...all[idx], ...row };
  else all.unshift(row);
  saveLocalBoards(all);

  const payload = {
    name: row.name,
    widgets: row.widgets,
    auto_refresh_min: row.auto_refresh_min,
    is_template: false,
    is_public: row.is_public,
    description: row.description,
    created_by: row.created_by,
    subsidiary_code: row.subsidiary_code,
  };
  let error = null;
  try {
    if (board.id && !String(board.id).startsWith('local-')) {
      const r = await supabase.from('custom_dashboards').update(payload).eq('id', board.id);
      error = r.error;
      if (error) {
        const r2 = await supabase.from('custom_dashboards').insert({ id, ...payload });
        error = r2.error;
      }
    } else {
      const r = await supabase.from('custom_dashboards').insert({ id, ...payload }).select('id').maybeSingle();
      error = r.error;
      if (r.data?.id) row.id = r.data.id;
    }
  } catch (e) { error = { message: e.message }; }
  return { row, error: error?.message || null };
}

export async function deleteBoard(id) {
  saveLocalBoards(loadLocalBoards().filter((b) => String(b.id) !== String(id)));
  try { await supabase.from('custom_dashboards').delete().eq('id', id); } catch { /* local only */ }
}

export async function cloneBoard(src, session) {
  return saveBoard({
    name: (src.name || 'Dashboard') + ' copy',
    widgets: src.widgets || [],
    auto_refresh_min: src.auto_refresh_min || 0,
    description: src.description || '',
    subsidiary_code: src.subsidiary_code,
  }, session);
}

export async function persistAccess(settings) {
  saveAccessSettings(settings);
  try {
    await supabase.from('custom_dashboard_access').upsert({
      id: 'default',
      settings,
      updated_at: new Date().toISOString(),
    });
  } catch { /* table optional */ }
}

export async function hydrateAccess() {
  const local = loadAccessSettings();
  try {
    const r = await supabase.from('custom_dashboard_access').select('settings').eq('id', 'default').maybeSingle();
    if (r.data?.settings) {
      const merged = { groups: { ...emptyAccess().groups, ...(r.data.settings.groups || {}) }, roles: { ...(r.data.settings.roles || {}), ...(local.roles || {}) } };
      saveAccessSettings(merged);
      return merged;
    }
  } catch { /* ignore */ }
  return local;
}

function assignedDefault(settings, group, roleName) {
  const rn = String(roleName || '').toLowerCase();
  const roleDef = settings.roles?.[rn]?.default;
  const groupDef = settings.groups?.[group]?.default;
  return roleDef || groupDef || '';
}

export async function resolveHome(profile) {
  const access = getAccess();
  const group = inferGroup(profile, access);
  return { group, href: homeForGroup(group) };
}

export function goHome(profile) {
  resolveHome(profile).then(({ href }) => {
    if (!location.pathname.endsWith(href.split('?')[0].split('/').pop())) location.replace(href);
  });
}

export const AI_EXAMPLES = [
  'I run a grocery store and need to track daily sales, stock alerts, and top products.',
  'Restaurant owner — I want to see revenue trends, top selling items, and payment breakdowns.',
  'I manage a sales team and need weekly performance, top staff, and pending orders.',
  'Warehouse manager — Show me stock alerts, pending shipments, and purchase orders.',
];

export function aiSuggest(description) {
  const t = String(description || '').toLowerCase();
  const picked = [];
  const add = (type, heading, size, extra) => {
    if (picked.some((p) => p.type === type && p.heading === heading)) return;
    picked.push(w(type, heading, size, extra));
  };
  if (/grocery|retail|shop|store|owner|business/.test(t)) {
    add('total_sell', 'Total Sales', 25, { range: 'today' });
    add('net', 'Net', 25, { range: 'today' });
    add('invoice_due', 'Invoice due', 25, { range: 'today' });
    add('current_stock_value', 'Stock value', 25);
  }
  if (/restaurant|food|cafe/.test(t)) {
    add('total_sell', 'Revenue', 25, { range: 'today' });
    add('top_products', 'Top selling items', 50, { range: '7' });
    add('payment_methods', 'Payment breakdown', 50, { range: 'today' });
    add('sales_last_30_days', 'Revenue trend', 100, { range: '30' });
  }
  if (/sales team|staff|weekly|performance|manager/.test(t)) {
    add('top_staff', 'Top staff', 50, { range: '7' });
    add('sales_last_30_days', 'Weekly trend', 100, { range: '7' });
    add('sales_order', 'Pending orders', 50, { range: '7' });
  }
  if (/warehouse|stock|inventory|shipment|purchase/.test(t)) {
    add('product_stock_alert', 'Stock alerts', 50);
    add('pending_shipments', 'Pending shipments', 50);
    add('total_purchase', 'Purchase orders', 50, { range: '30' });
  }
  if (/daily|today/.test(t)) add('total_sell', 'Daily sales', 25, { range: 'today' });
  if (/due|aging|overdue/.test(t)) add('payment_dues', 'Customer dues', 50);
  if (/customer/.test(t)) add('top_customers', 'Top customers', 50, { range: 'month' });
  if (/product/.test(t)) add('top_products', 'Top products', 50, { range: 'month' });
  if (/cashier|till|register/.test(t)) add('cash_register', 'Cash register', 25);
  if (/agent|commission|field/.test(t)) add('my_commission', 'My commission', 25, { range: 'month', show_data: 'show_own_data' });
  if (/lead/.test(t)) add('my_leads', 'Leads', 50);
  if (/chart|trend/.test(t)) add('sales_last_30_days', 'Sales trend', 100, { range: '30' });
  if (!picked.length) return { name: 'AI dashboard', widgets: DASH_TEMPLATES[0].widgets };
  const name = /restaurant/.test(t) ? 'Restaurant dashboard'
    : /warehouse|inventory/.test(t) ? 'Inventory dashboard'
    : /cashier/.test(t) ? 'Cashier dashboard'
    : /agent/.test(t) ? 'Agent dashboard'
    : 'AI dashboard';
  return { name, widgets: picked };
}

function ymd(d) { return d.toISOString().slice(0, 10); }
function start(d) { const x = new Date(d); x.setHours(0, 0, 0, 0); return x; }

export function rangeBounds(key) {
  const now = start(new Date());
  const y = now.getFullYear();
  const m = now.getMonth();
  if (key === 'today') return { from: ymd(now), to: ymd(now) };
  if (key === 'yesterday') { const d = new Date(now); d.setDate(d.getDate() - 1); return { from: ymd(d), to: ymd(d) }; }
  if (key === '7' || key === '30') { const d = new Date(now); d.setDate(d.getDate() - (Number(key) - 1)); return { from: ymd(d), to: ymd(now) }; }
  if (key === 'month') return { from: ymd(new Date(y, m, 1)), to: ymd(now) };
  if (key === 'last_month') return { from: ymd(new Date(y, m - 1, 1)), to: ymd(new Date(y, m, 0)) };
  if (key === 'year' || key === 'fy') return { from: `${y}-01-01`, to: ymd(now) };
  return { from: ymd(now), to: ymd(now) };
}

function dateOf(row) {
  return String(row.order_date || row.invoice_date || row.expense_date || row.return_date || row.shipped_on || row.created_at || '').slice(0, 10);
}
function inRange(row, from, to) {
  if (!from && !to) return true;
  const d = dateOf(row);
  return d && (!from || d >= from) && (!to || d <= to);
}
function liveSale(s) { return !/draft|quot|cancel/i.test(s.status || ''); }
function dueOf(s) { return Math.max(0, Number(s.total_amount || 0) - Number(s.amount_paid || 0)); }
function locMatch(row, loc) {
  if (!loc) return true;
  const L = findLocation(loc);
  if (row.location_code && L && row.location_code !== L.code && row.location_code !== loc) return false;
  if (row.location_name && L && String(row.location_name).toLowerCase() !== String(L.name).toLowerCase()) return false;
  return true;
}

export async function loadFacts(session) {
  const [so, po, exp, sret, pret, catalog, ships, leads, sessions] = await Promise.all([
    supabase.from('sales_orders').select('*').limit(500),
    supabase.from('purchase_orders').select('*').limit(1500),
    supabase.from('expenses').select('*').limit(800),
    supabase.from('sell_returns').select('*').limit(500),
    supabase.from('purchase_returns').select('*').limit(500),
    loadRows('products', CAT_KEYS.products, SEED_PRODUCTS),
    supabase.from('shipments').select('*').limit(400),
    supabase.from('crm_leads').select('id,name,phone,status,assigned_to').limit(400),
    supabase.from('pos_sessions').select('*').limit(200),
  ]);
  const products = (catalog || []).filter((p) => !isDemoProduct(p));
  return {
    sales: filterBySidebar(so.data || []),
    purchases: filterBySidebar(po.data || []),
    expenses: filterBySidebar(exp.data || []),
    sellReturns: filterBySidebar(sret.data || []),
    purchaseReturns: filterBySidebar(pret.data || []),
    products: filterBySidebar(products),
    ships: filterBySidebar(ships.data || []),
    leads: leads.data || [],
    sessions: sessions.data || [],
    uid: session?.user?.id || '',
    mail: (session?.user?.email || '').toLowerCase(),
  };
}

function ownRow(row, facts) {
  const uid = facts.uid;
  const mail = facts.mail;
  const blob = `${row.cashier_id || ''} ${row.cashier_email || ''} ${row.created_by || ''} ${row.agent_email || ''} ${row.sold_by || ''} ${row.assigned_to || ''} ${row.customer_email || ''} ${row.supplier_email || ''}`.toLowerCase();
  return blob.includes(String(uid).toLowerCase()) || (mail && blob.includes(mail));
}

function scopedRows(rows, widget, facts) {
  const { from, to } = widget.range ? rangeBounds(widget.range) : { from: '', to: '' };
  return (rows || []).filter((r) => {
    if (widget.range && !inRange(r, from, to)) return false;
    if (widget.location && !locMatch(r, widget.location)) return false;
    if (widget.show_data === 'show_own_data' && !ownRow(r, facts)) return false;
    return true;
  });
}

function sum(rows, key) { return (rows || []).reduce((a, r) => a + Number(r[key] || 0), 0); }

function spark(points) {
  const w = 640, h = 160, pad = 24;
  const max = Math.max(1, ...points.map((p) => p.v));
  const n = Math.max(1, points.length - 1);
  const xy = points.map((p, i) => ({ x: pad + (i / n) * (w - pad * 2), y: h - pad - (p.v / max) * (h - pad * 2), ...p }));
  const d = xy.map((p, i) => `${i ? 'L' : 'M'}${p.x} ${p.y}`).join(' ');
  const labels = xy.filter((_, i) => !(i % Math.ceil(points.length / 8)) || i === points.length - 1)
    .map((p) => `<text x="${p.x}" y="${h - 6}" text-anchor="middle" font-size="10" fill="#111">${p.l}</text>`).join('');
  return `<svg viewBox="0 0 ${w} ${h}" width="100%" height="160">${labels}<path d="${d}" fill="none" stroke="#004EEB" stroke-width="2.4"/></svg>`;
}

function seriesDays(sales, from, to) {
  const days = [];
  const a = new Date(from || to || new Date());
  const b = new Date(to || from || new Date());
  for (let d = new Date(a); d <= b; d.setDate(d.getDate() + 1)) {
    const k = ymd(d);
    const v = sales.filter((s) => dateOf(s) === k).reduce((n, s) => n + Number(s.total_amount || 0), 0);
    days.push({ l: k.slice(5), v });
  }
  return days.length ? days : [{ l: '—', v: 0 }];
}

function topN(rows, key, amountKey, n = 5) {
  const map = {};
  rows.forEach((r) => {
    const k = r[key] || '—';
    map[k] = (map[k] || 0) + Number(r[amountKey] || r.total_amount || 1);
  });
  return Object.entries(map).sort((a, b) => b[1] - a[1]).slice(0, n);
}

function listHtml(items) {
  if (!items.length) return '<p class="muted">No rows in this scope.</p>';
  return `<table class="mini"><tbody>${items.map(([k, v]) => `<tr><td>${esc(k)}</td><td class="num">${typeof v === 'number' ? fmt(v) : esc(v)}</td></tr>`).join('')}</tbody></table>`;
}

export function esc(s) {
  return String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&', '<': '<', '>': '>', '"': '"', "'": '&#39;' }[c]));
}

export function renderWidget(widget, facts) {
  const meta = widgetMeta(widget.type);
  const heading = widget.heading || meta.label;
  const rangeLabel = widget.range ? (RANGES.find((r) => r[0] === widget.range)?.[1] || widget.range) : '';
  const locLabel = widget.location ? (findLocation(widget.location)?.name || widget.location) : '';
  const cap = [rangeLabel, locLabel].filter(Boolean).join(' · ');
  let body = '';
  const sales = scopedRows((facts.sales || []).filter(liveSale), widget, facts);
  const purchases = scopedRows(facts.purchases || [], widget, facts);
  const expenses = scopedRows(facts.expenses || [], widget, facts);
  const sret = scopedRows(facts.sellReturns || [], widget, facts);
  const pret = scopedRows(facts.purchaseReturns || [], widget, facts);
  const products = (facts.products || []).filter((r) => locMatch(r, widget.location));
  const ships = scopedRows(facts.ships || [], { ...widget, range: '' }, facts);
  const t = widget.type;
  if (t === 'total_sell') body = `<div class="kpi">${fmt(sum(sales, 'total_amount'))}</div>`;
  else if (t === 'net') body = `<div class="kpi">${fmt(sum(sales, 'total_amount') - sum(expenses, 'amount') - sum(sret, 'total_amount'))}</div>`;
  else if (t === 'invoice_due') body = `<div class="kpi">${fmt(sales.reduce((a, s) => a + dueOf(s), 0))}</div>`;
  else if (t === 'sell_return') body = `<div class="kpi">${fmt(sum(sret, 'total_amount'))}</div>`;
  else if (t === 'total_purchase') body = `<div class="kpi">${fmt(sum(purchases, 'total_amount'))}</div>`;
  else if (t === 'purchase_due') body = `<div class="kpi">${fmt(purchases.reduce((a, s) => a + dueOf(s), 0))}</div>`;
  else if (t === 'purchase_return') body = `<div class="kpi">${fmt(sum(pret, 'total_amount'))}</div>`;
  else if (t === 'expense') body = `<div class="kpi">${fmt(sum(expenses, 'amount') || sum(expenses, 'total_amount'))}</div>`;
  else if (t === 'payment_recovered') body = `<div class="kpi">${fmt(sum(sales, 'amount_paid'))}</div>`;
  else if (t === 'current_stock_value') {
    const v = products.reduce((a, p) => a + Number(p.stock || p.current_stock_value || 0) * Number(p.cost || p.cost_price || p.selling_price || 0), 0);
    body = `<div class="kpi">${fmt(v)}</div>`;
  } else if (t === 'cash_register') {
    const open = (facts.sessions || []).filter((s) => String(s.status || '').toLowerCase() === 'open');
    const cash = open.reduce((a, s) => a + Number(s.closing_amount || s.opening_amount || 0), 0);
    body = `<div class="kpi">${fmt(cash)}</div><p class="muted">${open.length} open register${open.length === 1 ? '' : 's'}</p>`;
  } else if (t === 'sales_last_30_days' || t === 'sales_current_fy') {
    const rb = rangeBounds(widget.range || (t === 'sales_current_fy' ? 'fy' : '30'));
    body = spark(seriesDays(sales, rb.from, rb.to));
  } else if (t === 'payment_dues') {
    const due = sales.filter((s) => dueOf(s) > 0.004).slice(0, 8)
      .map((s) => [s.customer_name || s.reference || s.id, dueOf(s)]);
    body = listHtml(due);
  } else if (t === 'product_stock_alert') {
    const low = products.filter((p) => isCirculatingProduct(p)
      && p.alert_quantity != null && p.alert_quantity !== ''
      && Number(p.stock || p.current_stock || p.current_stock_value || 0) <= Number(p.alert_quantity)).slice(0, 8)
      .map((p) => [`${p.name || p.sku} (${p.stock ?? p.current_stock ?? p.current_stock_value ?? 0})`, Number(p.stock || p.current_stock || p.current_stock_value || 0)]);
    body = low.length ? `<table class="mini"><tbody>${low.map(([k, v]) => `<tr><td>${esc(k)}</td><td class="num">${v}</td></tr>`).join('')}</tbody></table>` : '<p class="muted">No low-stock items.</p>';
  } else if (t === 'stock_expiry_alert') {
    const soon = products.filter((p) => p.expiry_date && String(p.expiry_date).slice(0, 10) <= ymd(new Date(Date.now() + 86400000 * 30))).slice(0, 8)
      .map((p) => [p.name || p.sku, p.expiry_date]);
    body = soon.length ? `<table class="mini"><tbody>${soon.map(([k, v]) => `<tr><td>${esc(k)}</td><td>${esc(v)}</td></tr>`).join('')}</tbody></table>` : '<p class="muted">No items expiring in 30 days.</p>';
  } else if (t === 'sales_order' || t === 'my_tickets') {
    const rows = sales.slice(0, 8).map((s) => [s.reference || s.id, Number(s.total_amount || 0)]);
    body = listHtml(rows);
  } else if (t === 'pending_shipments') {
    const pending = ships.filter((s) => !/deliver|cancel/i.test(s.status || 'pending')).slice(0, 8)
      .map((s) => [s.reference || s.id, s.status || 'pending']);
    body = pending.length ? `<table class="mini"><tbody>${pending.map(([k, v]) => `<tr><td>${esc(k)}</td><td>${esc(v)}</td></tr>`).join('')}</tbody></table>` : '<p class="muted">No pending shipments.</p>';
  } else if (t === 'top_products') body = listHtml(topN(sales.flatMap((s) => (s.lines || s.items || []).map((l) => ({ name: l.name || l.product_name, total_amount: Number(l.line_total || l.qty * l.unit_price || 0) }))), 'name', 'total_amount'));
  else if (t === 'top_customers') body = listHtml(topN(sales, 'customer_name', 'total_amount'));
  else if (t === 'top_staff') body = listHtml(topN(sales.map((s) => ({ ...s, staff: s.cashier_email || s.created_by_name || s.added_by || '—' })), 'staff', 'total_amount'));
  else if (t === 'payment_methods') body = listHtml(topN(sales.map((s) => ({ ...s, method: s.payment_method || s.pay_method || s.method || 'cash' })), 'method', 'total_amount'));
  else if (t === 'location_perf') {
    const by = {};
    sales.forEach((s) => {
      const k = s.location_name || s.location_code || '—';
      by[k] = (by[k] || 0) + Number(s.total_amount || 0);
    });
    body = listHtml(Object.entries(by).sort((a, b) => b[1] - a[1]));
  } else if (t === 'my_commission') {
    const mine = sales.filter((s) => ownRow(s, facts));
    body = `<div class="kpi">${fmt(sum(mine, 'commission_amount'))}</div>`;
  } else if (t === 'my_leads') {
    const mine = (facts.leads || []).filter((l) => ownRow(l, facts) || widget.show_data !== 'show_own_data');
    body = mine.slice(0, 8).map((l) => `<p class="rowline"><b>${esc(l.name || l.phone)}</b> · ${esc(l.status || 'new')}</p>`).join('') || '<p class="muted">No leads.</p>';
  } else if (t === 'my_invoices') body = listHtml(sales.slice(0, 10).map((s) => [s.reference || s.id, Number(s.total_amount || 0)]));
  else if (t === 'my_pos') body = listHtml(purchases.slice(0, 10).map((s) => [s.reference || s.id, Number(s.total_amount || 0)]));
  else if (t === 'html_text') body = `<div class="note">${esc(widget.html_text || '').replace(/\n/g, '<br>') || '<span class="muted">Empty note</span>'}</div>`;
  else body = `<p class="muted">${esc(meta.label)}</p>`;

  return `<article class="wcard" style="flex:1 1 ${Number(widget.size || meta.size || 50)}%;max-width:${Number(widget.size || 50) >= 100 ? '100%' : '100%'}">
    <header><h3>${esc(heading)}</h3>${cap ? `<span class="cap">${esc(cap)}</span>` : ''}</header>
    <div class="wbody">${body}</div>
  </article>`;
}

export function locationOptions(selected) {
  return `<option value="">All locations</option>${(BUSINESS_LOCATIONS || []).map((l) =>
    `<option value="${esc(l.code)}" ${selected === l.code ? 'selected' : ''}>${esc(l.name)}</option>`).join('')}`;
}

export { BUSINESS_LOCATIONS };
