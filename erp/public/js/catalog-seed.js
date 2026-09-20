/** Ghana catalog helpers. Heavy live-site seed files load on demand, not on every page.
 * Do not seed demo people, customers, suppliers, or sales unless an HQ admin explicitly asks.
 * Group names (Investors / Partners / Consultants) are structure, not demo contacts.
 */
import { readLs, writeLs, mergeRows, isTombstoned, tombstone } from './ls-rows.js';
import { TAXONOMY_CATEGORIES } from './catalog-taxonomy.js';
import { stampMerch, MERCH_TABLE_ROWS, merchTreePayload } from './catalog-merch.js';
import { stampLiveProduct, seedMovement, MOVE_KEY } from './sku-lifecycle.js';
import { isUpostJob } from './job-catalog.js';

const FLAG = 'df_catalog_live_v19';
const DAYZERO_STOCK = 'df_dayzero_stock_v1';
const y = new Date().getFullYear();
const iso = (m, d) => `${y}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`;

export const KEYS = {
  products: 'df_products',
  customers: 'df_customers',
  suppliers: 'df_suppliers',
  units: 'df_units',
  brands: 'df_brands',
  categories: 'df_categories',
  warranties: 'df_warranties',
  variations: 'df_variations',
  groups: 'df_customer_groups',
  supplier_groups: 'df_supplier_groups',
  client_groups: 'df_client_groups',
  clients: 'df_clients',
  client_comms: 'df_client_comms',
  loyalty: 'df_loyalty_cards',
  users: 'df_users',
  roles: 'df_roles',
  agents: 'df_commission_agents',
  sales: 'df_sales_orders',
  sessions: 'df_pos_sessions',
  discounts: 'df_discounts',
  audit: 'df_audit_logs',
  backups: 'df_backups',
  merch: 'df_merch_tree',
  merch_classes: 'df_merch_classes',
  movements: MOVE_KEY,
};

export const SEED_UNITS = [
  { id: 'u-pcs', name: 'Pieces', short_name: 'Pcs', allow_decimal: 0 },
  { id: 'u-kg', name: 'Kilogram', short_name: 'Kg', allow_decimal: 1 },
  { id: 'u-m', name: 'Meter', short_name: 'Mtr', allow_decimal: 1 },
  { id: 'u-ctn', name: 'Carton', short_name: 'Ctn', allow_decimal: 0 },
  { id: 'u-doz', name: 'Dozen', short_name: 'Doz', allow_decimal: 0 },
  { id: 'u-l', name: 'Litre', short_name: 'Ltr', allow_decimal: 1 },
  { id: 'u-pr', name: 'Pair', short_name: 'Pr', allow_decimal: 0 },
  { id: 'u-set', name: 'Set', short_name: 'Set', allow_decimal: 0 },
];

export let SEED_BRANDS = [];

export const SEED_CATEGORIES = TAXONOMY_CATEGORIES;

export let SEED_PRODUCTS = [];
export let SEED_MOVEMENTS = [];

let _seedP = null;
export function loadSeedCatalog() {
  if (_seedP) return _seedP;
  _seedP = Promise.all([
    import('./live-catalog.js'),
    import('./fiberk-live-catalog.js'),
    import('./oraimo-live-catalog.js'),
  ]).then(([live, fiberk, oraimo]) => {
    SEED_BRANDS = [...(live.SEED_BRANDS || []), ...(fiberk.SEED_BRANDS || []), ...(oraimo.SEED_BRANDS || [])];
    SEED_PRODUCTS = [...(live.SEED_PRODUCTS || []), ...(fiberk.SEED_PRODUCTS || []), ...(oraimo.SEED_PRODUCTS || [])]
      .filter((p) => !/official online store/i.test(String(p.name || '')))
      .map((p, i) => stampLiveProduct(p, i + 1));
    SEED_MOVEMENTS = SEED_PRODUCTS.map((p) => seedMovement(p));
    return { products: SEED_PRODUCTS, brands: SEED_BRANDS, movements: SEED_MOVEMENTS };
  });
  return _seedP;
}

export const SEED_WARRANTIES = [
  { id: 'w-6', name: '6 months', duration: 6, duration_type: 'months', description: 'Standard parts' },
  { id: 'w-12', name: '1 year', duration: 1, duration_type: 'years', description: 'Manufacturer warranty' },
  { id: 'w-24', name: '2 years', duration: 2, duration_type: 'years', description: 'Extended cover' },
  { id: 'w-0', name: 'No warranty', duration: 0, duration_type: 'days', description: 'Sold as-is' },
];

export const SEED_VARIATIONS = [
  { id: 'v-col', name: 'Colour', values: 'Black, White, Silver, Gold' },
  { id: 'v-sz', name: 'Size', values: 'S, M, L, XL' },
  { id: 'v-st', name: 'Storage', values: '64GB, 128GB, 256GB' },
];

export const SEED_GROUPS = [
  { id: 'g-ret', name: 'Retail', amount: 0, price_calculation_type: 'percentage', selling_price_group: 'Retail' },
  { id: 'g-wh', name: 'Wholesale', amount: -8, price_calculation_type: 'percentage', selling_price_group: 'Wholesale' },
  { id: 'g-vip', name: 'VIP', amount: -12, price_calculation_type: 'percentage', selling_price_group: 'VIP' },
  { id: 'g-walk', name: 'Walk-in', amount: 0, price_calculation_type: 'percentage', selling_price_group: 'Retail' },
  { id: 'g-cr', name: 'Credit', amount: 0, price_calculation_type: 'percentage', selling_price_group: 'Retail' },
];

export const SEED_SUPPLIER_GROUPS = SEED_GROUPS.map((g) => ({
  ...g,
  id: 'sg-' + String(g.id).replace(/^g-/, ''),
  kind: 'supplier',
}));

export const SEED_CLIENT_GROUPS = [
  { id: 'cg-inv', name: 'Investors', kind: 'client', calculation_percentage: 0, price_group: 'Investor', notes: 'Equity and capital partners' },
  { id: 'cg-par', name: 'Partners', kind: 'client', calculation_percentage: 0, price_group: 'Partner', notes: 'Operating and channel partners' },
  { id: 'cg-con', name: 'Consultants', kind: 'client', calculation_percentage: 0, price_group: 'Consultant', notes: 'Advisors and professional services' },
];

export const SEED_ROLES = [
  { id: 'r-owner', name: 'Owner', code: 'owner', is_system: true, dashboard_group: 'hq', permissions: { '*': true, 'superadmin.packages': true } },
  { id: 'r-founder', name: 'Founder', code: 'founder', is_system: true, dashboard_group: 'hq', permissions: { '*': true, 'superadmin.packages': true } },
  { id: 'r-partner', name: 'Partner', code: 'partner', is_system: true, dashboard_group: 'hq', permissions: { '*': true, 'superadmin.packages': true } },
  { id: 'r-hq', name: 'HQ Admin', code: 'hq_admin', is_system: true, dashboard_group: 'hq', permissions: { '*': true } },
  { id: 'r-sysdev', name: 'Systems Developer', code: 'systems_developer', is_system: true, dashboard_group: 'hq', permissions: { '*': true } },
  { id: 'r-itdir', name: 'IT Director', code: 'it_director', is_system: true, dashboard_group: 'hq', permissions: { '*': true } },
  { id: 'r-pending', name: 'Pending', code: 'pending', is_system: true, permissions: { 'home.view': true } },
];

export const SEED_USERS = [];

/** Fictional staff from the seed — never re-inject. Real logins (gmail etc.) stay. */
export const DEMO_STAFF_EMAILS = new Set([
  'hr@delkor-fiberk.com',
  'accounts@delkor-fiberk.com',
  'ama.mensah@fiberk.com',
  'kojo.owusu@fiberk.com',
  'efua.boateng@axidigetek.com',
  'yaw.asante@delkor.com',
  'akosua.darko@bnpl.com',
  'kofi.asante@axidigetek.com',
  'ama.serwaa@fiberk.com',
  'finance@delkorfiberk.com',
]);
const DEMO_STAFF_IDS = new Set([
  'u-corp-hr', 'u-corp-acc', 'u-ama', 'u-kojo', 'u-efua', 'u-yaw', 'u-akos', 'u-kofi', 'u-serwaa',
  '00000000-0000-4000-a000-000000000001',
]);
const DEMO_STAFF_USERS = new Set([
  'akua.osei', 'kwabena.adjei', 'ama.mensah', 'kojo.owusu', 'efua.boateng',
  'yaw.asante', 'akosua.darko', 'kofi.asante', 'ama.serwaa',
]);

export function isDemoUser(u) {
  if (!u || typeof u !== 'object') return false;
  const email = String(u.email || '').toLowerCase().trim();
  if (email && DEMO_STAFF_EMAILS.has(email)) return true;
  if (email && /@(fiberk|delkor-fiberk|axidigetek|bnpl)\.com$/i.test(email)) return true;
  if (email && /@delkor\.com$/i.test(email) && !/@gmail\.com$/i.test(email)) return true;
  const id = String(u.id ?? '');
  if (id && DEMO_STAFF_IDS.has(id)) return true;
  if (id.startsWith('00000000-0000-4000-a000-')) return true;
  if (/^u-(corp|ama|kojo|efua|yaw|akos|kofi|serwaa)/i.test(id)) return true;
  const user = String(u.username || '').toLowerCase().trim();
  if (user && DEMO_STAFF_USERS.has(user)) return true;
  return false;
}

export const SEED_AGENTS = [];

const LIVE_SKU = /^(OPH|WHV|AXI|FIB|BNP|DEL)-\d{4,8}(?:-[A-Z0-9]{4})?$/i;
const DEMO_ID = /^p-(bnp|fib|axi|del)\d+$/i;

export function isDemoProduct(p) {
  const src = String(p?.source || p?.book || '').toLowerCase();
  if (src === 'fiberkapp' || src === 'upload' || p?.hard_fork === true) return false;
  const sku = String(p?.sku || '').toUpperCase();
  const id = String(p?.id || '');
  if (LIVE_SKU.test(sku)) return false;
  if (/^FBK/i.test(sku) || /^DKF/i.test(sku) || /^FKB/i.test(sku)) return false;
  if (DEMO_ID.test(id)) return true;
  if (/^(AXI|FIB|BNP|DEL|FRK|ELG|ORA|WHV)/i.test(sku)) return true;
  return false;
}

const DEMO_PARTY = /patricia\s*addo|kwame\s*(asante|mensah)|prince\s*owusu|nana\s*yaa|ama\s*serwaa|ama\s*boateng|ama\s*mensah|akosua\s*darko|kofi\s*asante|yaw\s*(owusu|asante|boateng)|efua\s*(asante|darko|boateng)|kojo\s*(mensah|owusu)|kwesi\s*(mensah|boateng)|nhyira\s*mart|tema\s*steel|accra\s*mall|melcom|shop2drop|univer\s*suppliers|hisense\s*distributors|nasco\s*ghana|alpha\s*clothings|delkor\s*timber|abena\s*[gy]\.?\s*owusu|abena\s*bean|kofi\s*v\.?\s*frimpong|aba\s*c\.?\s*asante|emma\s*adjik|mr\.?\s*(super\s*)?admin/i;
const DEMO_REF = /\bSO-CRM-|\bINV-DEMO|\bDEMO-|\blocal-po-|\bacc-po-|\bacc-ex-|\bSO-26090[1-5]-|\bJS-2026090[1-5]-/i;

export function isDemoRecord(row) {
  if (!row || typeof row !== 'object') return false;
  if (isDemoUser(row)) return true;
  if (isDemoProduct(row)) return true;
  const blob = [
    row.customer_name, row.supplier_name, row.name, row.full_name,
    row.reference, row.invoice_no, row.ref_no, row.job_number, row.job_no, row.invoice_number,
    row.id, row.note, row.notes, row.added_by,
  ].join(' ');
  if (DEMO_REF.test(blob)) return true;
  if (DEMO_PARTY.test(blob) && !/^OPH-\d+/i.test(String(row.sku || ''))) return true;
  const phone = String(row.phone || row.mobile || row.contact_number || '');
  if (/^0{3}[-.\s]?0{3}[-.\s]?0{4}$/.test(phone)) return true;
  return false;
}

export function withoutDemo(rows) {
  return Array.isArray(rows) ? rows : [];
}

/** Hub catalog is not in circulation until open stock / transfer. */
export function isCirculatingProduct(p) {
  if (!p || isDemoProduct(p)) return false;
  return p.open_stock === true || p.sku_locked === true;
}

/** Day zero: listings only. Vendor-site quantities are not on-hand until inventory. */
export function zeroCatalogStock() {
  try {
    if (localStorage.getItem(DAYZERO_STOCK) === '1') return;
    const rows = readLs(KEYS.products, []);
    if (rows.length) {
      writeLs(KEYS.products, rows.map((p) => {
        if (p.open_stock === true || p.sku_locked === true) return p;
        return {
          ...p,
          stock: 0,
          current_stock: 0,
          qty: 0,
          alert_quantity: 0,
          min_stock: 0,
          current_stock_value: 0,
        };
      }));
    }
    const moves = readLs(KEYS.movements, []).map((m) => (
      m && m.type === 'catalog_seed' ? { ...m, qty: 0 } : m
    ));
    writeLs(KEYS.movements, moves);
    const stocks = readLs('df_product_stock', []);
    if (stocks.length) {
      const live = new Set(readLs(KEYS.products, []).filter((p) => p.open_stock === true || p.sku_locked === true).map((p) => String(p.id)));
      writeLs('df_product_stock', stocks.map((r) => (
        live.has(String(r.product_id)) ? r : { ...r, quantity: 0 }
      )));
    }
    localStorage.setItem(DAYZERO_STOCK, '1');
  } catch { /* ignore */ }
}

export function purgeDemoUsers() {
  try {
    const strip = (key) => {
      const rows = readLs(key, []);
      if (!Array.isArray(rows) || !rows.length) return;
      for (const u of rows) {
        if (isDemoUser(u)) tombstone('profiles', u.id, { email: u.email });
      }
      const next = rows.filter((u) => !isDemoUser(u) && !isTombstoned(key, u) && !isTombstoned('profiles', u));
      if (next.length !== rows.length) writeLs(key, next);
    };
    strip(KEYS.users);
    strip('df_profiles');
    for (const email of DEMO_STAFF_EMAILS) tombstone('profiles', '', { email });
    localStorage.setItem('df_demo_users_purged_v1', '1');
  } catch { /* ignore */ }
}

export function purgeDemoProducts() {
  try {
    const rows = readLs(KEYS.products, []);
    if (!Array.isArray(rows) || !rows.length) return;
    const next = rows.filter((p) => !isDemoProduct(p));
    if (next.length !== rows.length) writeLs(KEYS.products, next);
  } catch { /* ignore */ }
}

/** Drop fake stock/purchase/history rows that were never part of the live catalog seed. */
export function purgeStockDemo() {
  try {
    if (localStorage.getItem('df_stock_demo_cleared_v1') === '1') return;
    writeLs('df_stock_transfers', []);
    writeLs('df_stock_adjustments', []);
    writeLs('df_purchase_returns', []);
    const purchases = readLs('df_purchases', []).filter((r) => {
      const id = String(r?.id || '');
      const note = String(r?.note || r?.notes || '');
      return r && !/^acc-po-|^local-po-|^demo-|^st-demo|^sa-demo/.test(id) && !/demo purchase/i.test(note);
    });
    writeLs('df_purchases', purchases);
    const moves = readLs(KEYS.movements, []).filter((m) => m && m.type === 'catalog_seed');
    writeLs(KEYS.movements, moves.length ? moves : SEED_MOVEMENTS);
    const journals = readLs('df_acc_journals', []).filter((j) => {
      const memo = `${j?.memo || ''} ${j?.note || ''} ${j?.description || ''}`;
      return !/cost of sales/i.test(memo);
    });
    writeLs('df_acc_journals', journals);
    const pay = readLs('df_payment_links', []).filter((p) => String(p?.type || '').toLowerCase() !== 'purchase');
    writeLs('df_payment_links', pay);
    const flows = readLs('df_payment_cash_flow', []).filter((f) => String(f?.sub_type || '').toLowerCase() !== 'purchase');
    writeLs('df_payment_cash_flow', flows);
    localStorage.setItem('df_stock_demo_cleared_v1', '1');
  } catch { /* ignore */ }
}

/** Drop demo customers, agents, sales, CRM/HRM/accounting/banking/project test rows. Keep live catalog + 3 vendors. */
export function purgePartyDemo() {
  try {
    if (localStorage.getItem('df_ops_demo_cleared_v4') === '1') return;
    writeLs(KEYS.customers, []);
    writeLs(KEYS.agents, []);
    writeLs(KEYS.loyalty, []);
    writeLs(KEYS.sales, []);
    writeLs(KEYS.sessions, []);
    writeLs(KEYS.discounts, []);
    writeLs(KEYS.audit, []);
    writeLs('df_expenses', []);
    writeLs('df_acc_sales', []);
    writeLs('df_acc_journals', []);
    writeLs('df_acc_transfers', []);
    writeLs('df_acc_budgets', []);
    writeLs('df_acc_purchases', []);
    writeLs('df_chart_of_accounts', []);
    writeLs('df_payment_accounts', []);
    writeLs('df_payment_links', []);
    writeLs('df_payment_cash_flow', []);
    writeLs('df_bank_accounts', []);
    writeLs('df_bank_transactions', []);
    writeLs('df_ghana_bank_accounts', []);
    writeLs('df_ghana_bank_transactions', []);
    writeLs('df_debit_notes', []);
    writeLs('df_purchase_payments', []);
    writeLs('df_cheques', []);
    writeLs('df_momo_wallets', []);
    writeLs('df_momo_transactions', []);
    writeLs('df_crypto_wallets', []);
    writeLs('df_crypto_transactions', []);
    writeLs('df_gra_filings', []);
    writeLs('df_cal_events', []);
    writeLs('df_woo_sync_log', []);
    writeLs('df_stock_transfers', []);
    writeLs('df_stock_adjustments', []);
    writeLs('df_purchase_returns', []);
    writeLs('df_purchases', []);
    writeLs('df_sell_returns', []);
    writeLs(KEYS.suppliers, SEED_SUPPLIERS.slice());
    [
      'df_crm_hub_v1', 'df_hrm_hub_v1', 'df_assets_hub_v1', 'df_ess_hub_v1', 'df_project_hub_v1',
      'df_crm_hub_seed', 'df_crm_hub_seed_v2', 'df_hrm_hub_seed_v3', 'df_hrm_hub_seed_v4',
      'df_assets_hub_seed', 'df_ess_hub_seed', 'df_project_hub_seed',
      'df_acc_demo_v6', 'df_acc_demo_v7', 'df_pay_demo_v2', 'df_pay_demo_v3',
      'df_fin_ops_v1', 'df_cheques_v1', 'df_bank_rails_v1', 'df_cal_demo_v1', 'df_woo_v2',
      'df_dash_demo_v1',
    ].forEach((k) => { try { localStorage.removeItem(k); } catch { /* ignore */ } });
    localStorage.setItem('df_ops_demo_cleared_v4', '1');
  } catch { /* ignore */ }
}

/** Local demo tickets only. Never reads or deletes live Supabase rows. */
export function purgeTestSales() {
  const goneIds = new Set();
  try {
    const keys = [KEYS.sales, 'df_acc_sales', 'df_sales_orders'];
    for (const key of [...new Set(keys)]) {
      const rows = readLs(key, []);
      if (!Array.isArray(rows) || !rows.length) continue;
      const keep = [];
      for (const r of rows) {
        if (isDemoRecord(r)) {
          if (r?.id) {
            tombstone('sales_orders', r.id, {});
            goneIds.add(String(r.id));
          }
          continue;
        }
        keep.push(r);
      }
      if (keep.length !== rows.length) writeLs(key, keep);
    }
  } catch { /* ignore */ }
  return goneIds.size;
}

export const SEED_CUSTOMERS = [];

export const SEED_SUPPLIERS = [
  { id: 's-franko', name: 'Franko Trading', mobile: '0302 221 100', email: 'sales@frankotrading.com', website: 'https://www.frankotrading.com', source: 'frankotrading.com', city: 'Accra', subsidiary_code: 'ops', location_code: 'OPS-HUB', location_name: 'Operations Hub', total_due: 0, is_active: true },
  { id: 's-electro', name: 'Electroland Ghana', mobile: '0302 774 000', email: 'sales@electrolandgh.com', website: 'https://electrolandgh.com', source: 'electrolandgh.com', city: 'Accra', subsidiary_code: 'ops', location_code: 'OPS-HUB', location_name: 'Operations Hub', total_due: 0, is_active: true },
  { id: 's-oraimo', name: 'Oraimo Ghana', mobile: '', email: 'support@oraimo.com', website: 'https://gh.oraimo.com', source: 'gh.oraimo.com', city: 'Accra', subsidiary_code: 'ops', location_code: 'OPS-HUB', location_name: 'Operations Hub', total_due: 0, is_active: true },
];

export const SEED_LOYALTY = [];
export const SEED_SALES = [];
export const SEED_SESSIONS = [];
export const SEED_DISCOUNTS = [];
export const SEED_AUDIT = [];

function put(key, rows) {
  const keep = (list) => (Array.isArray(list) ? list : []).filter((r) => !isTombstoned(key, r) && !isTombstoned('profiles', r));
  const cur = keep(readLs(key, []));
  const incoming = keep(rows);
  if (!cur.length) {
    writeLs(key, incoming);
    return;
  }
  writeLs(key, keep(mergeRows([cur, incoming])));
}

export function ensureLocalCatalog() {
  try {
    if (localStorage.getItem(FLAG) === '1') return;
    const raw = localStorage.getItem(KEYS.products) || '';
    if (raw.length > 80000) {
      localStorage.setItem(FLAG, '1');
      return;
    }
  } catch { return; }
  try {
    const have = readLs(KEYS.products, []);
    const live = localStorage.getItem(FLAG) === '1';
    if (have.length && !live) {
      const next = have.map((p) => {
        if (/official online store/i.test(String(p.name || ''))) return null;
        return stampMerch({
          ...p,
          source_category: p.source_category || p.category,
        });
      });
      writeLs(KEYS.products, next.filter(Boolean));
      writeLs(KEYS.categories, SEED_CATEGORIES);
      writeLs(KEYS.merch, merchTreePayload());
      writeLs(KEYS.merch_classes, MERCH_TABLE_ROWS);
      localStorage.setItem(FLAG, '1');
    }
    if (localStorage.getItem(FLAG) === '1' && readLs(KEYS.products, []).length) {
      purgeDemoProducts();
      purgeStockDemo();
      purgePartyDemo();
      purgeDemoUsers();
      purgeTestSales();
      zeroCatalogStock();
      try {
        import('./paper-purchase.js').then((m) => m.hydratePinaroAtBnpl && m.hydratePinaroAtBnpl()).catch(() => {});
      } catch { /* optional */ }
      if (readLs(KEYS.units, []).length) {
        backfillCorporateStaff();
        backfillPendingRole();
        backfillPartyGroups();
        return;
      }
    }
  } catch { /* ignore */ }
  loadSeedCatalog().then(({ products, brands, movements }) => {
    try {
      if (!readLs(KEYS.products, []).length) writeLs(KEYS.products, products);
      else put(KEYS.products, products);
      put(KEYS.brands, brands);
      put(KEYS.movements, movements);
      put(KEYS.customers, SEED_CUSTOMERS);
      writeLs(KEYS.suppliers, SEED_SUPPLIERS.slice());
      put(KEYS.units, SEED_UNITS);
      writeLs(KEYS.categories, SEED_CATEGORIES);
      writeLs(KEYS.merch, merchTreePayload());
      writeLs(KEYS.merch_classes, MERCH_TABLE_ROWS);
      put(KEYS.warranties, SEED_WARRANTIES);
      put(KEYS.variations, SEED_VARIATIONS);
      put(KEYS.groups, SEED_GROUPS);
      put(KEYS.supplier_groups, SEED_SUPPLIER_GROUPS);
      put(KEYS.loyalty, SEED_LOYALTY);
      purgeDemoUsers();
      put(KEYS.roles, SEED_ROLES);
      put(KEYS.agents, SEED_AGENTS);
      put(KEYS.sales, SEED_SALES);
      put(KEYS.sessions, SEED_SESSIONS);
      put(KEYS.discounts, SEED_DISCOUNTS);
      put(KEYS.audit, SEED_AUDIT);
      localStorage.setItem(FLAG, '1');
      purgeDemoProducts();
      purgeStockDemo();
      purgePartyDemo();
      purgeDemoUsers();
      purgeTestSales();
      zeroCatalogStock();
      try {
        import('./paper-purchase.js').then((m) => m.hydratePinaroAtBnpl && m.hydratePinaroAtBnpl()).catch(() => {});
      } catch { /* optional */ }
      backfillCorporateStaff();
      backfillPendingRole();
      backfillPartyGroups();
    } catch (e) { console.warn('catalog seed', e); }
  }).catch((e) => console.warn('catalog seed', e));
}

function backfillPartyGroups() {
  try {
    if (!readLs(KEYS.supplier_groups, []).length) writeLs(KEYS.supplier_groups, SEED_SUPPLIER_GROUPS.slice());
  } catch { /* ignore */ }
}

function backfillPendingRole() {
  try {
    const roles = (readLs(KEYS.roles, []) || []).filter((r) => !isUpostJob(r?.name));
    if (!roles.some((r) => r.id === 'r-pending' || String(r.name) === 'Pending')) {
      roles.unshift({ id: 'r-pending', name: 'Pending', permissions: {} });
    }
    writeLs(KEYS.roles, roles);
  } catch { /* ignore */ }
}

function backfillCorporateStaff() {
  try {
    const users = readLs(KEYS.users, []).filter((u) => !isDemoUser(u));
    const next = users.map((u) => {
      const group = String(u.subsidiary_code || u.home_subsidiary || '') === 'group'
        || /hq admin|owner|^admin$/i.test(String(u.role || ''));
      if (group && !u.location_code) {
        return { ...u, subsidiary_code: u.subsidiary_code || 'group', location_code: 'OPS-HUB' };
      }
      return u;
    });
    writeLs(KEYS.users, next);
    localStorage.setItem('df_corp_office_v1', '1');
  } catch { /* ignore */ }
}
