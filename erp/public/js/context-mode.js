/** Context Mode — fetch other modules into a drawer. Never leave the page. */
import { supabase } from './supabaseClient.js';
import { loadRows, readLs } from './ls-rows.js';
import { specKeyFromPath } from './nav-spec.js';

const TABLE_MAP = {
  customers: { table: 'customers', key: 'df_customers' },
  suppliers: { table: 'suppliers', key: 'df_suppliers' },
  products: { table: 'products', key: 'df_products' },
  accounts: { table: 'payment_accounts', key: 'df_payment_accounts' },
  collection_accounts: { table: 'collection_accounts', key: 'df_collection_accounts' },
  chart: { table: 'chart_of_accounts', key: 'df_chart_of_accounts' },
  expenses: { table: 'expenses', key: 'df_expenses' },
  purchases: { table: 'purchases', key: 'df_purchases' },
  sales: { table: 'sales_orders', key: 'df_sales_orders' },
  users: { table: 'profiles', key: 'df_users' },
  budgets: { table: 'budgets', key: 'df_acc_budgets' },
  journals: { table: 'journals', key: 'df_acc_journals' },
};

const FETCH_HREF = [
  [/customers\.html/, 'customers', 'Customers'],
  [/customer-form/, 'customers', 'Customers'],
  [/suppliers\.html/, 'suppliers', 'Suppliers'],
  [/product-form|products\.html|product-catalog/, 'products', 'Products'],
  [/payment-accounts/, 'accounts', 'Bank & wallets'],
  [/collections-desk|collections\.html/, 'collection_accounts', 'Collection accounts'],
  [/accounting\.html/, 'chart', 'Chart of accounts'],
  [/expense/, 'expenses', 'Expenses'],
  [/purchase-form|purchase-orders/, 'purchases', 'Purchases'],
  [/sales-form|sales-orders/, 'sales', 'Sales'],
  [/users\.html/, 'users', 'Users'],
  [/accounting-budget|budgets\.html/, 'budgets', 'Budgets'],
];

function domainOf(path) {
  return specKeyFromPath(path) || 'page';
}

export function setCurrentContext() {
  const path = location.pathname || '';
  const q = location.search.replace(/^\?/, '').replace(/[&=]/g, '.') || 'index';
  const ctx = `${domainOf(path)}.${(path.split('/').pop() || 'desk').replace('.html', '')}.${q}`;
  window.currentContext = ctx;
  return ctx;
}

function ensureDrawer() {
  let el = document.getElementById('erp-data-drawer');
  if (el) return el;
  el = document.createElement('aside');
  el.id = 'erp-data-drawer';
  el.hidden = true;
  el.innerHTML = `<header>
    <strong id="erp-drawer-title">Data</strong>
    <button type="button" id="erp-drawer-close">Close</button>
  </header>
  <div id="local-data-panel"></div>`;
  document.body.appendChild(el);
  document.getElementById('erp-drawer-close').onclick = () => { el.hidden = true; };
  if (!document.getElementById('erp-drawer-css')) {
    const s = document.createElement('style');
    s.id = 'erp-drawer-css';
    s.textContent = `#erp-data-drawer{position:fixed;top:0;right:0;width:min(560px,100vw);height:100vh;background:#fff;border-left:1px solid #dbe4ee;z-index:80;display:flex;flex-direction:column;box-shadow:-8px 0 24px rgba(15,23,42,.12)}
      #erp-data-drawer[hidden]{display:none}
      #erp-data-drawer header{display:flex;justify-content:space-between;align-items:center;padding:12px 16px;border-bottom:1px solid #e5e7eb;font-weight:800}
      #erp-drawer-close{border:1px solid #dbe4ee;background:#f8fafc;border-radius:8px;padding:6px 10px;font-weight:700;cursor:pointer}
      #local-data-panel{overflow:auto;padding:12px;flex:1}
      #local-data-panel table{width:100%;border-collapse:collapse;font-size:12px}
      #local-data-panel th,#local-data-panel td{border-bottom:1px solid #eef2f7;padding:6px 8px;text-align:left}
      #local-data-panel th{background:#1e4fa3;color:#fff;position:sticky;top:0}`;
    document.head.appendChild(s);
  }
  return el;
}

function colsOf(rows) {
  const prefer = ['name', 'customer_name', 'supplier_name', 'sku', 'reference', 'ref_no', 'account_type', 'status', 'amount', 'total', 'balance', 'phone', 'email'];
  const keys = Object.keys(rows[0] || {}).filter((k) => !/^_|id$|html|json|lines|note_html/i.test(k));
  const picked = prefer.filter((k) => keys.includes(k));
  return (picked.length ? picked : keys).slice(0, 6);
}

export function renderTable(sel, data) {
  const host = typeof sel === 'string' ? document.querySelector(sel) : sel;
  if (!host) return;
  const rows = Array.isArray(data) ? data : [];
  if (!rows.length) {
    host.innerHTML = '<p class="ult-muted">No rows in this book.</p>';
    return;
  }
  const cols = colsOf(rows);
  host.innerHTML = `<table><thead><tr>${cols.map((c) => `<th>${c}</th>`).join('')}</tr></thead>
    <tbody>${rows.slice(0, 80).map((r) => `<tr>${cols.map((c) => `<td>${String(r[c] ?? '—').slice(0, 80)}</td>`).join('')}</tr>`).join('')}</tbody></table>
    <p class="ult-muted">${rows.length} row${rows.length === 1 ? '' : 's'}</p>`;
}

export async function fetchData(context, table, filters = {}) {
  if (window.currentContext !== context) return [];
  const map = TABLE_MAP[table] || { table, key: 'df_' + table };
  let rows = [];
  try {
    let q = supabase.from(map.table).select('*').limit(200);
    Object.entries(filters || {}).forEach(([k, v]) => { if (v != null && v !== '') q = q.eq(k, v); });
    const { data, error } = await q;
    if (!error && Array.isArray(data) && data.length) rows = data;
  } catch { /* local book */ }
  if (!rows.length) {
    rows = await loadRows(map.table, map.key, readLs(map.key, []) || []);
  }
  ensureDrawer();
  document.getElementById('erp-drawer-title').textContent = table.replace(/_/g, ' ');
  document.getElementById('erp-data-drawer').hidden = false;
  renderTable('#local-data-panel', rows);
  return rows;
}

export function openContextTable(table, title) {
  const ctx = window.currentContext || setCurrentContext();
  document.getElementById('erp-drawer-title').textContent = title || table;
  return fetchData(ctx, table);
}

export function mountContextMode() {
  const ctx = setCurrentContext();
  ensureDrawer();
  document.querySelectorAll('#nav-spec-bar a.nav-spec-a, .fin-card a, a[data-context-fetch]').forEach((a) => {
    const href = a.getAttribute('href') || '';
    const hit = FETCH_HREF.find(([re]) => re.test(href));
    if (!hit) return;
    if (domainOf(href) === specKeyFromPath()) return;
    a.addEventListener('click', (e) => {
      e.preventDefault();
      openContextTable(hit[1], hit[2]);
    });
  });
  window.fetchData = fetchData;
  window.openContextTable = openContextTable;
  window.currentContext = ctx;
}
