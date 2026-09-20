/**
 * Delkor-Fiberk Connector API
 * Resource names follow the Delkor-Fiberk ERP Connector contract so POS / Woo / mobile
 * apps can speak the same language. Every row is scoped by subsidiary_code + location_code.
 */
import { supabase, OPERATING_SUBSIDIARIES } from './supabaseClient.js';
import { BUSINESS_LOCATIONS, filterBySidebar, inferRowScope } from './scope.js';

export const CONNECTOR_VERSION = '1.0.0';

export const ENDPOINTS = [
  { tag: 'Auth', method: 'POST', path: '/connector/api/token', summary: 'Issue a personal access token', impl: 'issueToken' },
  { tag: 'Auth', method: 'GET', path: '/connector/api/user/loggedin', summary: 'Logged-in user', impl: 'loggedIn' },
  { tag: 'Attendance', method: 'GET', path: '/connector/api/get-attendance/{user_id}', summary: 'Get attendance', impl: 'getAttendance' },
  { tag: 'Attendance', method: 'POST', path: '/connector/api/clock-in', summary: 'Clock in', impl: 'clockIn' },
  { tag: 'Attendance', method: 'POST', path: '/connector/api/clock-out', summary: 'Clock out', impl: 'clockOut' },
  { tag: 'Attendance', method: 'GET', path: '/connector/api/holidays', summary: 'List holidays', impl: 'listHolidays' },
  { tag: 'Brands', method: 'GET', path: '/connector/api/brand', summary: 'List brands', impl: 'listBrands' },
  { tag: 'Brands', method: 'GET', path: '/connector/api/brand/{id}', summary: 'Get brand', impl: 'getBrand' },
  { tag: 'Locations', method: 'GET', path: '/connector/api/business-location', summary: 'List business locations', impl: 'listLocations' },
  { tag: 'Locations', method: 'GET', path: '/connector/api/business-location/{id}', summary: 'Get business location', impl: 'getLocation' },
  { tag: 'Business', method: 'GET', path: '/connector/api/business-details', summary: 'Get business details', impl: 'businessDetails' },
  { tag: 'Contacts', method: 'GET', path: '/connector/api/contactapi', summary: 'List contacts', impl: 'listContacts' },
  { tag: 'Contacts', method: 'POST', path: '/connector/api/contactapi', summary: 'Create contact', impl: 'createContact' },
  { tag: 'Contacts', method: 'GET', path: '/connector/api/contactapi/{id}', summary: 'Get contact', impl: 'getContact' },
  { tag: 'Contacts', method: 'PUT', path: '/connector/api/contactapi/{id}', summary: 'Update contact', impl: 'updateContact' },
  { tag: 'Products', method: 'GET', path: '/connector/api/product', summary: 'List products', impl: 'listProducts' },
  { tag: 'Products', method: 'GET', path: '/connector/api/product/{id}', summary: 'Get product', impl: 'getProduct' },
  { tag: 'Products', method: 'GET', path: '/connector/api/selling-price-group', summary: 'List selling price groups', impl: 'listPriceGroups' },
  { tag: 'Sales', method: 'GET', path: '/connector/api/sell', summary: 'List sells', impl: 'listSells' },
  { tag: 'Sales', method: 'POST', path: '/connector/api/sell', summary: 'Create sell', impl: 'createSell' },
  { tag: 'Sales', method: 'GET', path: '/connector/api/sell/{id}', summary: 'Get sell', impl: 'getSell' },
  { tag: 'Sales', method: 'GET', path: '/connector/api/list-sell-return', summary: 'List sell returns', impl: 'listSellReturns' },
  { tag: 'Cash register', method: 'GET', path: '/connector/api/cash-register', summary: 'List cash registers', impl: 'listRegisters' },
  { tag: 'Cash register', method: 'POST', path: '/connector/api/cash-register', summary: 'Open cash register', impl: 'openRegister' },
  { tag: 'Expenses', method: 'GET', path: '/connector/api/expense', summary: 'List expenses', impl: 'listExpenses' },
  { tag: 'Expenses', method: 'POST', path: '/connector/api/expense', summary: 'Create expense', impl: 'createExpense' },
  { tag: 'Expenses', method: 'GET', path: '/connector/api/expense-categories', summary: 'List expense categories', impl: 'listExpenseCats' },
  { tag: 'Accounts', method: 'GET', path: '/connector/api/payment-accounts', summary: 'List payment accounts', impl: 'listPayAccounts' },
  { tag: 'Accounts', method: 'GET', path: '/connector/api/payment-methods', summary: 'List payment methods', impl: 'listPayMethods' },
  { tag: 'CRM', method: 'GET', path: '/connector/api/crm/leads', summary: 'List leads', impl: 'listLeads' },
  { tag: 'CRM', method: 'GET', path: '/connector/api/crm/follow-ups', summary: 'List follow-ups', impl: 'listFollowups' },
  { tag: 'Field force', method: 'GET', path: '/connector/api/field-force', summary: 'List visits', impl: 'listVisits' },
  { tag: 'Tax', method: 'GET', path: '/connector/api/tax', summary: 'List tax rates', impl: 'listTax' },
  { tag: 'Units', method: 'GET', path: '/connector/api/unit', summary: 'List units', impl: 'listUnits' },
  { tag: 'Taxonomy', method: 'GET', path: '/connector/api/taxonomy', summary: 'List categories', impl: 'listTaxonomy' },
  { tag: 'Users', method: 'GET', path: '/connector/api/user', summary: 'List users', impl: 'listUsers' },
  { tag: 'Users', method: 'GET', path: '/connector/api/user/{id}', summary: 'Get user', impl: 'getUser' },
  { tag: 'Reports', method: 'GET', path: '/connector/api/profit-loss-report', summary: 'Profit and loss', impl: 'profitLoss' },
  { tag: 'Reports', method: 'GET', path: '/connector/api/product-stock-report', summary: 'Product current stock', impl: 'stockReport' },
  { tag: 'Reports', method: 'GET', path: '/connector/api/notifications', summary: 'Notifications', impl: 'notifications' },
];

function ok(data) { return { success: true, data }; }
function fail(msg, status = 400) { return { success: false, msg, status }; }

function scoped(rows) {
  return filterBySidebar(rows || []).map((r) => {
    const s = inferRowScope(r);
    return { ...r, subsidiary_code: r.subsidiary_code || s.subsidiary_code, location_code: r.location_code || s.location_code };
  });
}

function pick(obj, keys) {
  const o = {};
  keys.forEach((k) => { if (obj[k] !== undefined) o[k] = obj[k]; });
  return o;
}

export async function executeConnector(method, path, { params = {}, query = {}, body = {} } = {}) {
  const m = String(method || 'GET').toUpperCase();
  const p = String(path || '');
  const id = params.id || query.id;
  const userId = params.user_id || body.user_id;

  try {
    if (p.endsWith('/token') && m === 'POST') return issueToken(body);
    if (p.includes('/user/loggedin')) return loggedIn();
    if (p.includes('/get-attendance')) return getAttendance(userId);
    if (p.endsWith('/clock-in') && m === 'POST') return clockIn(body);
    if (p.endsWith('/clock-out') && m === 'POST') return clockOut(body);
    if (p.endsWith('/holidays')) return listHolidays(query);
    if (p.match(/\/brand\/[^/]+$/) && m === 'GET') return getById('brands', id);
    if (p.endsWith('/brand')) return listTable('brands');
    if (p.includes('/business-location') && id && m === 'GET') return getLocation(id);
    if (p.endsWith('/business-location')) return listLocations();
    if (p.endsWith('/business-details')) return businessDetails();
    if (p.includes('/contactapi/') && m === 'PUT') return updateTable('customers', id, body);
    if (p.includes('/contactapi/') && m === 'GET') return getContact(id);
    if (p.endsWith('/contactapi') && m === 'POST') return createTable('customers', body);
    if (p.endsWith('/contactapi')) return listContacts(query);
    if (p.includes('/product/') && m === 'GET') return getById('products', id);
    if (p.endsWith('/product')) return listTable('products');
    if (p.endsWith('/selling-price-group')) return listTable('price_groups');
    if (p.includes('/sell/') && m === 'GET') return getById('sales_orders', id);
    if (p.endsWith('/sell') && m === 'POST') return createTable('sales_orders', body);
    if (p.endsWith('/sell')) return listTable('sales_orders');
    if (p.endsWith('/list-sell-return')) return listTable('sell_returns');
    if (p.includes('/cash-register') && m === 'POST') return createTable('pos_sessions', { ...body, status: 'open', opened_at: new Date().toISOString() });
    if (p.endsWith('/cash-register')) return listTable('pos_sessions');
    if (p.endsWith('/expense') && m === 'POST') return createTable('expenses', body);
    if (p.endsWith('/expense')) return listTable('expenses');
    if (p.endsWith('/expense-categories')) return listTable('expense_categories');
    if (p.endsWith('/payment-accounts')) return listTable('payment_accounts');
    if (p.endsWith('/payment-methods')) return ok([
      { name: 'cash', label: 'Cash' }, { name: 'card', label: 'Card' }, { name: 'momo', label: 'Mobile Money' },
      { name: 'cheque', label: 'Cheque' }, { name: 'bank_transfer', label: 'Bank Transfer' }, { name: 'bnpl', label: 'Hire Purchase' },
    ]);
    if (p.endsWith('/crm/leads')) return listTable('crm_leads');
    if (p.endsWith('/crm/follow-ups')) return listTable('crm_followups');
    if (p.endsWith('/field-force')) return listTable('visits');
    if (p.endsWith('/tax')) return listTable('tax_rates');
    if (p.endsWith('/unit')) return listTable('units');
    if (p.endsWith('/taxonomy')) return listTable('categories');
    if (p.includes('/user/') && m === 'GET') return getById('profiles', id);
    if (p.endsWith('/user')) return listUsers();
    if (p.endsWith('/profit-loss-report')) return profitLoss();
    if (p.endsWith('/product-stock-report')) return stockReport();
    if (p.endsWith('/notifications')) return listTable('notifications');
    return fail('Unknown connector path ' + p, 404);
  } catch (e) {
    return fail(e.message || String(e), 500);
  }
}

async function listTable(table) {
  const { data, error } = await supabase.from(table).select('*').limit(2000);
  if (error) return fail(error.message);
  return ok(scoped(data));
}
async function getById(table, id) {
  if (!id) return fail('id required');
  const { data, error } = await supabase.from(table).select('*').eq('id', id).maybeSingle();
  if (error) return fail(error.message);
  return ok(data ? scoped([data]) : []);
}
async function createTable(table, body) {
  const row = { ...body };
  delete row.agent_id;
  const { data, error } = await supabase.from(table).insert(row).select('*').maybeSingle();
  if (error) return fail(error.message);
  return ok(data);
}
async function updateTable(table, id, body) {
  if (!id) return fail('id required');
  const row = { ...body }; delete row.id; delete row.agent_id;
  const { data, error } = await supabase.from(table).update(row).eq('id', id).select('*').maybeSingle();
  if (error) return fail(error.message);
  return ok(data);
}

async function issueToken(body) {
  const token = 'df_' + crypto.randomUUID().replace(/-/g, '');
  const row = {
    token,
    name: body.name || 'Personal access token',
    scopes: body.scopes || ['read', 'write'],
    subsidiary_code: body.subsidiary_code || null,
    location_code: body.location_code || null,
    is_active: true,
  };
  const { data, error } = await supabase.from('connector_tokens').insert(row).select('*').maybeSingle();
  if (error) return fail(error.message + ' — run sql/25_connector.sql in Supabase if the table is missing');
  return { success: true, access_token: token, token_type: 'Bearer', data };
}

async function loggedIn() {
  const { data: { session } } = await supabase.auth.getSession();
  if (!session) return fail('Not signed in', 401);
  const { data } = await supabase.from('profiles').select('*').eq('id', session.user.id).maybeSingle();
  return ok(data || { id: session.user.id, email: session.user.email });
}

async function getAttendance(userId) {
  let q = supabase.from('attendance').select('*').order('clock_in_time', { ascending: false }).limit(1);
  if (userId) q = q.eq('user_id', userId);
  const { data, error } = await q.maybeSingle();
  if (error) return fail(error.message);
  return ok(data);
}
async function clockIn(body) {
  const { data: { session } } = await supabase.auth.getSession();
  const row = {
    user_id: body.user_id || session?.user?.id,
    clock_in_time: body.clock_in_time || new Date().toISOString(),
    clock_in_note: body.clock_in_note || null,
    ip_address: body.ip_address || null,
    latitude: body.latitude || null,
    longitude: body.longitude || null,
    subsidiary_code: body.subsidiary_code || null,
    location_code: body.location_code || null,
  };
  const { error } = await supabase.from('attendance').insert(row);
  if (error) return fail(error.message);
  return { success: true, msg: 'Clocked In successfully', type: 'clock_in' };
}
async function clockOut(body) {
  const { data: { session } } = await supabase.auth.getSession();
  const uid = body.user_id || session?.user?.id;
  const { data: open } = await supabase.from('attendance').select('id').eq('user_id', uid).is('clock_out_time', null).order('clock_in_time', { ascending: false }).limit(1).maybeSingle();
  if (!open) return fail('No open clock-in');
  const { error } = await supabase.from('attendance').update({
    clock_out_time: body.clock_out_time || new Date().toISOString(),
    clock_out_note: body.clock_out_note || null,
  }).eq('id', open.id);
  if (error) return fail(error.message);
  return { success: true, msg: 'Clocked Out successfully', type: 'clock_out' };
}
async function listHolidays(query) {
  let q = supabase.from('holidays').select('*').order('start_date');
  if (query.location_code) q = q.eq('location_code', query.location_code);
  const { data, error } = await q;
  if (error) return fail(error.message);
  return ok(scoped(data));
}

async function listLocations() {
  const { data } = await supabase.from('business_locations').select('*').limit(200);
  const rows = (data && data.length) ? data : BUSINESS_LOCATIONS.map((l) => ({
    id: l.code, name: l.name, location_id: l.code, subsidiary_code: l.subsidiary,
    is_active: 1, country: 'Ghana', city: 'Accra',
    payment_methods: [
      { name: 'cash', label: 'Cash' }, { name: 'momo', label: 'Mobile Money' },
      { name: 'card', label: 'Card' }, { name: 'bnpl', label: 'Hire Purchase' },
    ],
  }));
  return ok(scoped(rows));
}
async function getLocation(id) {
  const all = await listLocations();
  const hit = (all.data || []).find((l) => String(l.id) === String(id) || l.code === id || l.location_id === id);
  return ok(hit ? [hit] : []);
}
async function businessDetails() {
  return ok({
    name: 'Delkor-Fiberk Group',
    currency: 'GHS',
    timezone: 'Africa/Accra',
    subsidiaries: OPERATING_SUBSIDIARIES,
    locations: BUSINESS_LOCATIONS,
    fy_start_month: 1,
    time_format: '24',
    connector_version: CONNECTOR_VERSION,
  });
}

async function listContacts(query) {
  const type = String(query.type || query.contact_type || '').toLowerCase();
  const tables = type === 'supplier' ? ['suppliers'] : type === 'customer' ? ['customers'] : ['customers', 'suppliers'];
  const out = [];
  for (const t of tables) {
    const { data } = await supabase.from(t).select('*').limit(1500);
    (data || []).forEach((r) => out.push({ ...r, contact_type: t === 'suppliers' ? 'supplier' : 'customer' }));
  }
  return ok(scoped(out));
}
async function getContact(id) {
  for (const t of ['customers', 'suppliers']) {
    const { data } = await supabase.from(t).select('*').eq('id', id).maybeSingle();
    if (data) return ok([{ ...data, contact_type: t === 'suppliers' ? 'supplier' : 'customer' }]);
  }
  return ok([]);
}

async function listUsers() {
  const { data, error } = await supabase.from('profiles').select('id,full_name,email,role,subsidiary_code,location_code,is_active,created_at').limit(500);
  if (error) return fail(error.message);
  return ok((data || []).map((u) => ({
    id: u.id,
    user_type: 'user',
    first_name: (u.full_name || '').split(' ')[0] || u.email,
    last_name: (u.full_name || '').split(' ').slice(1).join(' '),
    email: u.email,
    status: u.is_active === false ? 'inactive' : 'active',
    subsidiary_code: u.subsidiary_code,
    location_code: u.location_code,
    allow_login: 1,
  })));
}

async function profitLoss() {
  const [{ data: sales }, { data: purchases }, { data: expenses }] = await Promise.all([
    supabase.from('sales_orders').select('total_amount,subsidiary_code,location_code').limit(5000),
    supabase.from('purchase_orders').select('total_amount,subsidiary_code,location_code').limit(5000),
    supabase.from('expenses').select('amount,subsidiary_code,location_code').limit(5000),
  ]);
  const s = scoped(sales).reduce((a, r) => a + Number(r.total_amount || 0), 0);
  const p = scoped(purchases).reduce((a, r) => a + Number(r.total_amount || 0), 0);
  const e = scoped(expenses).reduce((a, r) => a + Number(r.amount || 0), 0);
  return ok({ total_sell: s, total_purchase: p, total_expense: e, gross_profit: s - p, net_profit: s - p - e });
}
async function stockReport() {
  const { data, error } = await supabase.from('products').select('id,name,sku,current_stock_value,selling_price,cost_price,subsidiary_code,location_code').limit(4000);
  if (error) return fail(error.message);
  return ok(scoped(data).map((p) => ({
    ...p,
    stock: Number(p.stock ?? p.current_stock ?? 0),
    stock_value: Number(p.stock ?? p.current_stock ?? 0) * Number(p.cost_price || 0),
  })));
}
