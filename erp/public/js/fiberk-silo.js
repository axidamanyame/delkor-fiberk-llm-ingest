/**
 * Fiberkapp uploads are live desk rows. This file only keeps old import names
 * so existing pages do not break. It does not run a second archive or silo.
 */
import { readLs, writeLs } from './ls-rows.js';

export const FORK = 'df_upload_books_v12';

export const PACK_METRICS = {
  sales: { n: 2299 },
  purchases: { n: 154 },
  products: { n: 4294 },
  customers: { n: 692 },
  suppliers: { n: 30 },
  transfers: { n: 313 },
  expenses: { n: 122 },
  people: { n: 0 },
};

export const SILO_TABLES = [
  { id: 'sales', label: 'Sales', section: 'Sales', href: '/sales-orders.html', key: 'df_sales_orders', file: '/js/fiberkapp-dump/sales.json' },
  { id: 'purchases', label: 'Purchases', section: 'Purchases', href: '/purchase-orders.html', key: 'df_purchases', file: '/js/fiberkapp-dump/purchases.json' },
  { id: 'products', label: 'Products', section: 'Products', href: '/products.html', key: 'df_products', file: '/js/fiberkapp-dump/products.json' },
  { id: 'customers', label: 'Customers', section: 'Contacts', href: '/customers.html', key: 'df_customers', file: '/js/fiberkapp-dump/customers.json' },
  { id: 'suppliers', label: 'Suppliers', section: 'Contacts', href: '/suppliers.html', key: 'df_suppliers', file: '/js/fiberkapp-dump/suppliers.json' },
  { id: 'transfers', label: 'Transfers', section: 'Stock', href: '/stock-transfers.html', key: 'df_stock_transfers', file: '/js/fiberkapp-dump/transfers.json' },
  { id: 'expenses', label: 'Expenses', section: 'Finance', href: '/expenses.html', key: 'df_expenses', file: '/js/fiberkapp-dump/expenses.json' },
  { id: 'people', label: 'People', section: 'HRM', href: '/hrm.html', key: 'df_users', file: '/js/fiberkapp-dump/users.json' },
];

const LIVE_HREF = Object.fromEntries(SILO_TABLES.map((t) => [t.id, t.href]));

export function siloHref(table) {
  return LIVE_HREF[table] || '/dashboard.html';
}

export function migStamp() {
  return FORK;
}

export function siloGateHtml() { return ''; }
export function migratedWmsNoteHtml() { return ''; }
export function migratedDashNoteHtml() { return ''; }

export function isMigratedRow(row) {
  return false;
}

/** All uploaded Fiberkapp rows are live. No filter. */
export function excludeMigrated(rows) {
  return Array.isArray(rows) ? rows.slice() : [];
}

export function onlyMigrated(rows) {
  return Array.isArray(rows) ? rows.slice() : [];
}

export function knownSiloCount(kind) {
  return Number((PACK_METRICS[kind] || {}).n || 0);
}

function asList(data, kind) {
  if (Array.isArray(data)) return data;
  if (!data || typeof data !== 'object') return [];
  if (Array.isArray(data[kind])) return data[kind];
  if (Array.isArray(data.rows)) return data.rows;
  return [];
}

export function toIsoDate(v) {
  const s = String(v || '').trim();
  if (!s) return '';
  if (/^\d{4}-\d{2}-\d{2}/.test(s)) return s.slice(0, 10);
  const us = s.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})/);
  if (us) {
    const a = Number(us[1]);
    const b = Number(us[2]);
    const y = us[3];
    if (a > 12) return `${y}-${String(b).padStart(2, '0')}-${String(a).padStart(2, '0')}`;
    return `${y}-${String(a).padStart(2, '0')}-${String(b).padStart(2, '0')}`;
  }
  const eu = s.match(/^(\d{1,2})-(\d{1,2})-(\d{4})/);
  if (eu) return `${eu[3]}-${String(eu[2]).padStart(2, '0')}-${String(eu[1]).padStart(2, '0')}`;
  return s.slice(0, 10);
}

function compact(kind, row) {
  if (!row || typeof row !== 'object') return null;
  const base = {
    source: row.source || 'upload',
    live: true,
  };
  if (kind === 'products') {
    const locRaw = Array.isArray(row.locations) ? row.locations.join(' ') : String(row.locations || row.location_name || '');
    const fiberkShop = /fiberk/i.test(locRaw) || !locRaw;
    return {
      ...base,
      id: row.id,
      sku: row.sku || row.view_sku || ('FBK' + row.id),
      name: row.name,
      type: row.type || 'single',
      product_type: row.type || 'single',
      category: row.view_category || row.category,
      subcategory: row.subcategory,
      brand: row.view_brand || row.brand,
      unit: row.unit,
      current_stock: Number(row.current_stock || row.stock || 0),
      stock: Number(row.current_stock || row.stock || 0),
      sell: row.sell,
      selling_price: row.sell,
      buy: row.buy,
      cost_price: row.buy,
      purchase_price: row.buy,
      inactive: row.inactive,
      not_for_selling: row.not_for_selling,
      is_active: row.inactive ? false : true,
      image_url: row.image_url || '',
      subsidiary_code: /delkor|furniture/i.test(locRaw) ? 'delkor' : 'fiberk',
      location_code: fiberkShop ? 'FIB-SHOP' : (/delkor|furniture/i.test(locRaw) ? 'DEL-ONLINE' : 'FIB-SHOP'),
      location_name: locRaw || 'Fiberk Shop',
      department_code: fiberkShop ? 'FIB-SHOP' : '',
      department_name: fiberkShop ? 'Fiberk Shop' : '',
    };
  }
  if (kind === 'sales') {
    const locRaw = String(row.location_name || row.location || '');
    const iso = toIsoDate(row.order_date || row.transaction_date || row.date);
    const fiberk = /fiberk|easybuy/i.test(locRaw) || !locRaw;
    return {
      ...base,
      id: row.id,
      reference: row.invoice_no || row.reference || row.so_number,
      invoice_no: row.invoice_no,
      so_number: row.so_number || row.invoice_no,
      order_date: iso,
      created_at: iso,
      customer_id: row.customer_id,
      customer_name: row.customer_name,
      phone: row.phone,
      location_name: locRaw || 'Fiberk Shop',
      location_code: /easybuy|field/i.test(locRaw) ? 'BNPL-FIELD' : (fiberk ? 'FIB-SHOP' : ''),
      subsidiary_code: /delkor|furniture/i.test(locRaw) ? 'delkor' : (/easybuy|field|bnpl/i.test(locRaw) ? 'bnpl' : 'fiberk'),
      department_code: /easybuy|field/i.test(locRaw) ? 'BNPL-FIELD' : 'FIB-SHOP',
      department_name: /easybuy|field/i.test(locRaw) ? 'BNPL Field' : 'Fiberk Shop',
      payment_status: row.payment_status,
      payment_method: row.method_label || row.payment_method,
      method_label: row.method_label,
      status: row.status || 'completed',
      total_amount: Number(row.total_amount || row.final_total || row.grand_total || row.total || 0),
      amount_paid: Number(row.amount_paid || 0),
      payment_due: Number(row.payment_due || 0),
      shipping_status: row.shipping_status,
      total_items: row.total_items,
      added_by: row.added_by,
      note: row.note || '',
      lines: Array.isArray(row.lines) ? row.lines : [],
    };
  }
  if (kind === 'purchases') {
    return {
      ...base,
      id: row.id,
      reference: row.reference,
      order_date: row.order_date,
      supplier_name: row.supplier_name,
      status: row.status,
      payment_status: row.payment_status,
      total_amount: Number(row.total_amount || 0),
      grand_total: Number(row.total_amount || row.grand_total || 0),
      amount_paid: Number(row.amount_paid || 0),
      payment_due: Number(row.payment_due || 0),
      location_name: row.location_name,
      added_by: row.added_by,
      lines: Array.isArray(row.lines) ? row.lines : [],
    };
  }
  if (kind === 'customers' || kind === 'suppliers') {
    return {
      ...base,
      id: row.id,
      contact_id: row.contact_id || row.id,
      contact_code: row.contact_id || row.id,
      name: row.name,
      first_name: row.first_name,
      last_name: row.last_name,
      phone: row.phone,
      email: row.email,
      address: row.address,
      city: row.city,
      state: row.state,
      group: row.group,
      balance: row.balance,
      status: row.status,
      contact_type: kind === 'suppliers' ? 'supplier' : 'customer',
    };
  }
  if (kind === 'transfers') {
    return {
      ...base,
      id: row.id,
      date: row.date,
      reference: row.ref || row.reference,
      from_location: row.from,
      to_location: row.to,
      from: row.from,
      to: row.to,
      status: row.status,
      added_by: row.added_by,
      lines: Array.isArray(row.lines) ? row.lines : [],
    };
  }
  if (kind === 'expenses') {
    return {
      ...base,
      id: row.id,
      date: row.date,
      reference: row.ref || row.reference,
      category: row.category,
      amount: Number(row.amount || 0),
      location: row.location,
      note: row.note || '',
      added_by: row.added_by,
    };
  }
  return { ...base, id: row.id, name: row.name || row.username };
}

function mergeInto(key, incoming) {
  const rows = (incoming || []).filter(Boolean);
  if (!rows.length) return 0;
  const cur = readLs(key, []) || [];
  const map = new Map();
  cur.forEach((r) => {
    const id = String(r.id || r.sku || r.contact_id || '');
    if (id) map.set(id, r);
  });
  rows.forEach((r) => {
    const id = String(r.id || r.sku || r.contact_id || '');
    if (!id) return;
    const prev = map.get(id);
    map.set(id, prev && !isMigratedRow(prev) ? { ...r, ...prev, source: prev.source || r.source } : { ...prev, ...r });
  });
  try {
    writeLs(key, [...map.values()]);
    return rows.length;
  } catch {
    return 0;
  }
}


export async function loadSilo() {
  return { rows: [] };
}

export async function hardForkMerge() {
  return { ok: true, skipped: true };
}

export const ensureUploadedBooks = hardForkMerge;
export function purgeLiveMigrated() {
  return hardForkMerge();
}

export async function liveDeskRows(kind) {
  const spec = SILO_TABLES.find((t) => t.id === kind) || { key: 'df_' + kind, id: kind };
  const table = ({
    sales: 'sales_orders',
    purchases: 'purchases',
    products: 'products',
    customers: 'customers',
    suppliers: 'suppliers',
    transfers: 'stock_transfers',
    expenses: 'expenses',
    people: 'profiles',
  })[kind] || spec.id;
  try {
    const { loadRows } = await import('./ls-rows.js');
    const rows = await loadRows(table, spec.key, []);
    if (rows.length) return rows;
  } catch { /* fall through */ }
  try { return readLs(spec.key, []) || []; } catch { return []; }
}
