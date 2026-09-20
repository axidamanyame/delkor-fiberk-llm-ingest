/** Stash the table row on Edit, then fill every form so staff never re-type the record. */
import { SUBSIDIARIES } from './supabaseClient.js';
import {
  pickRow,
  allDfLists,
  stashEditRow,
  takeEditRow,
  loadFormRow,
  fillForm,
  preferFilled,
  normalizeFormRow,
  editIdFromUrl,
} from './ls-rows.js';

const FORM_MAP = {
  'supplier-form.html': { table: 'suppliers', key: 'df_suppliers', extra: ['df_customers'] },
  'customer-form.html': { table: 'customers', key: 'df_customers', extra: ['df_suppliers'] },
  'unit-edit.html': { table: 'units', key: 'df_units' },
  'warranty-edit.html': { table: 'warranties', key: 'df_warranties' },
  'discount-form.html': { table: 'discounts', key: 'df_discounts' },
  'commission-agent-edit.html': { table: 'sales_commission_agents', key: 'df_commission_agents' },
  'loyalty-card-edit.html': { table: 'loyalty_cards', key: 'df_loyalty_cards', extra: ['df_customers'] },
  'customer-group-edit.html': { table: 'customer_groups', key: 'df_customer_groups' },
  'variation-edit.html': { table: 'product_variations', key: 'df_variations' },
  'brand-edit.html': { table: 'brands', key: 'df_brands' },
  'category-edit.html': { table: 'categories', key: 'df_categories' },
  'product-form.html': { table: 'products', key: 'df_products' },
  'user-edit.html': { table: 'profiles', key: 'df_users', extra: ['df_profiles'] },
  'expense-form.html': { table: 'expenses', key: 'df_expenses' },
  'expense-category-form.html': { table: 'expense_categories', key: 'df_expense_categories' },
  'price-group-edit.html': { table: 'selling_price_groups', key: 'df_price_groups' },
  'group-edit.html': { table: 'customer_groups', key: 'df_customer_groups', extra: ['df_supplier_groups', 'df_client_groups'] },
  'roles-edit.html': { table: 'app_roles', key: 'df_roles' },
  'client-form.html': { table: 'clients', key: 'df_clients' },
  'visit-form.html': { table: 'visits', key: 'df_visits' },
  'purchase-invoice-form.html': { table: 'purchase_invoices', key: 'df_purchase_invoices', extra: ['df_purchases'] },
  'purchase-form.html': { table: 'purchases', key: 'df_purchases', extra: ['df_purchase_orders', 'df_bnpl_field_orders'] },
  'purchase-return-form.html': { table: 'purchase_returns', key: 'df_purchase_returns' },
  'investor-form.html': { table: 'investors', key: 'df_investors' },
  'partner-form.html': { table: 'partners', key: 'df_partners' },
  'consultant-form.html': { table: 'consultants', key: 'df_consultants' },
  'supplier-group-edit.html': { table: 'supplier_groups', key: 'df_supplier_groups' },
  'sales-form.html': { table: 'sales_orders', key: 'df_sales_orders' },
  'quotation-form.html': { table: 'quotations', key: 'df_quotations' },
  'draft-form.html': { table: 'drafts', key: 'df_drafts' },
  'stock-transfer-form.html': { table: 'stock_transfers', key: 'df_stock_transfers' },
  'stock-adjustment-form.html': { table: 'stock_adjustments', key: 'df_stock_adjustments' },
  'accounting-account-form.html': { table: 'accounts', key: 'df_accounts' },
  'accounting-journal-form.html': { table: 'journal_entries', key: 'df_journals' },
  'accounting-transfer-form.html': { table: 'account_transfers', key: 'df_account_transfers' },
  'accounting-map-form.html': { table: 'account_maps', key: 'df_account_maps' },
  'accounting-type-form.html': { table: 'account_types', key: 'df_account_types' },
  'module-form.html': { table: '', key: '' },
};

const HEADER_FIELD = {
  'contact id': 'contact_code',
  'contact id.': 'contact_code',
  'business name': 'business_name',
  'name': 'name',
  'email': 'email',
  'mobile': 'phone',
  'phone': 'phone',
  'tax number': 'tax_number',
  'pay term': 'pay_term',
  'opening balance': 'opening_balance',
  'advance balance': 'advance_balance',
  'added on': 'created_at',
  'address': 'address',
  'subsidiary': 'subsidiary',
  'sku': 'sku',
  'product': 'name',
  'brand': 'brand',
  'category': 'category',
  'customer': 'customer_name',
  'supplier': 'supplier_name',
  'reference': 'reference',
  'role': 'role_name',
  'username': 'username',
  'full name': 'full_name',
  'commission %': 'commission_percent',
  'card no': 'card_no',
  'points': 'points',
  'short name': 'short_name',
  'duration': 'duration',
  'city': 'city',
  'location': 'location_code',
};

function slugFromPath() {
  return (location.pathname.split('/').pop() || '').split('?')[0];
}

function inferSpec() {
  const file = slugFromPath();
  if (FORM_MAP[file]) return FORM_MAP[file];
  const m = file.match(/^(.+?)(?:-form|-edit)\.html$/);
  if (!m) return { table: '', key: '', extra: [] };
  const slug = m[1].replace(/-/g, '_');
  const table = slug.endsWith('s') ? slug : `${slug}s`;
  return { table, key: `df_${table}`, extra: [] };
}

function parseTableRow(tr) {
  if (!tr) return null;
  const table = tr.closest('table');
  if (!table) return null;
  const headers = [...table.querySelectorAll('thead th')].map((th) => String(th.textContent || '').replace(/\s+/g, ' ').trim());
  const cells = [...tr.children].map((td) => String(td.textContent || '').replace(/\s+/g, ' ').trim());
  const row = {};
  headers.forEach((h, i) => {
    const key = HEADER_FIELD[h.toLowerCase()];
    const val = cells[i] || '';
    if (!key || !val || /^actions?$/i.test(h) || val === '—' || val === '-') return;
    row[key] = val;
  });
  if (row.subsidiary) {
    const hit = (SUBSIDIARIES || []).find((s) =>
      s.code === row.subsidiary
      || String(s.name || '').toLowerCase() === String(row.subsidiary).toLowerCase()
      || String(s.short || '').toLowerCase() === String(row.subsidiary).toLowerCase()
    );
    if (hit) row.subsidiary_code = hit.code;
  }
  if (row.business_name && !row.name) row.name = row.business_name;
  if (row.name && !row.business_name) row.business_name = row.name;
  return Object.keys(row).length ? row : null;
}

function idFromHref(href) {
  if (!href) return '';
  try {
    return new URL(href, location.origin).searchParams.get('id')
      || new URL(href, location.origin).searchParams.get('customer')
      || '';
  } catch {
    return '';
  }
}

function collectFromClick(el) {
  const href = el.getAttribute?.('href') || '';
  const tr = el.closest?.('tr');
  let id = idFromHref(href) || el.dataset?.act || el.dataset?.id || el.dataset?.del || '';
  if (!id && tr) {
    const btn = tr.querySelector('[data-act], [data-id]');
    id = btn?.dataset?.act || btn?.dataset?.id || '';
  }
  const fromTable = parseTableRow(tr);
  const fromLs = id ? pickRow(id, allDfLists()) : null;
  let row = preferFilled(fromTable || {}, fromLs || {});
  if (id && !row.id) row.id = id;
  if (!row.id && !Object.keys(row).length) return null;
  return normalizeFormRow('', row);
}

function isEditNav(el) {
  const href = el.getAttribute?.('href') || '';
  const label = String(el.textContent || '').replace(/\s+/g, ' ').trim();
  if (/(-form|-edit)\.html/.test(href) && /[?&](id|customer)=/.test(href)) return true;
  if (/^edit$/i.test(label)) return true;
  if (el.dataset?.act || el.dataset?.id) return true;
  return false;
}

function bindStashClicks() {
  if (window.__dfFormFillClicks) return;
  window.__dfFormFillClicks = true;
  document.addEventListener('click', (e) => {
    const el = e.target.closest?.('a[href], button[data-act], [data-act], [data-id], button[data-id]');
    if (!el) return;
    if (!isEditNav(el) && !el.dataset?.act && !el.dataset?.id) return;
    const row = collectFromClick(el);
    if (row) stashEditRow(row);
  }, true);
}

function pickForm() {
  return document.querySelector('form#f')
    || document.querySelector('main form, .ult-main form, .page form, form.card, form.ult-card')
    || document.querySelector('form');
}

let cachedRow = undefined;
let loadingRow = null;

async function resolveRow() {
  const id = editIdFromUrl();
  if (!id) return null;
  if (cachedRow !== undefined) return cachedRow;
  if (loadingRow) return loadingRow;
  const spec = inferSpec();
  loadingRow = (async () => {
    const found = await loadFormRow(spec.table || 'customers', spec.key || 'df_customers', id, spec.extra || []);
    cachedRow = found || takeEditRow(id) || null;
    return cachedRow;
  })();
  try {
    return await loadingRow;
  } finally {
    loadingRow = null;
  }
}

async function tryFill() {
  const id = editIdFromUrl();
  if (!id) return false;
  const form = pickForm();
  if (!form || form.dataset.dfFilled === '1') return !!form;
  if (!form.elements || form.elements.length < 2) return false;
  const row = await resolveRow();
  if (!row) return false;
  const live = pickForm();
  if (!live || live.dataset.dfFilled === '1') return true;
  fillForm(live, row);
  live.dataset.dfFilled = '1';
  return true;
}

export function installFormFill() {
  if (window.__dfFormFill) return;
  window.__dfFormFill = true;
  bindStashClicks();
  const id = editIdFromUrl();
  const isFormPage = /(-form|-edit)\.html$/.test(slugFromPath());
  if (!id && !isFormPage) return;
  const run = () => { tryFill().catch(() => {}); };
  run();
  const mo = new MutationObserver(() => run());
  mo.observe(document.body, { childList: true, subtree: true });
  [200, 500, 1200, 2200].forEach((ms) => setTimeout(run, ms));
}

export { fillForm, loadFormRow, stashEditRow };
