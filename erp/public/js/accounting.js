/**
 * Accounting module — Delkor-Fiberk ERP Chart of accounts / journals / transfers.
 * Scoped by the left-sidebar subsidiary + location master.
 */
import { fmt, getActiveSubsidiary, OPERATING_SUBSIDIARIES, SUBSIDIARIES } from './supabaseClient.js';
import { getActiveLocation, getActiveAgent, findLocation, filterBySidebar, SUB_PREFIX, BUSINESS_LOCATIONS } from './scope.js';
import { loadRows, saveRow, deleteRow, writeLs, readLs, uid } from './ls-rows.js';
import { DATE_PRESETS, datePreset } from './confirm-action.js';
import { headingOf } from './module-floor.js';

export const ACC_TABS = [
  { key: 'dash', href: '/accounting.html', label: 'Summary', ico: 'A' },
  { key: 'coa', href: '/accounting-coa.html', label: 'Chart of accounts' },
  { key: 'je', href: '/accounting-journal.html', label: 'Journal Entry' },
  { key: 'xfer', href: '/accounting-transfer.html', label: 'Transfer' },
  { key: 'tx', href: '/accounting-transactions.html', label: 'Transactions' },
  { key: 'budget', href: '/accounting-budget.html', label: 'Budget' },
  { key: 'reports', href: '/accounting.html?tab=reports', label: 'Reports' },
  { key: 'setup', href: '/accounting.html?tab=setup', label: 'Setup' },
  { key: 'settings', href: '/accounting.html?tab=setup', label: 'Setup' },
];

export const ACC_FLOOR = [
  { key: 'dash', href: '/accounting.html', label: 'Accounting' },
  { key: 'coa', href: '/accounting-coa.html', label: 'Chart of accounts' },
  { key: 'books', href: '/accounting.html?tab=books', label: 'Books' },
  { key: 'planning', href: '/accounting.html?tab=planning', label: 'Planning' },
  { key: 'reports', href: '/accounting.html?tab=reports', label: 'Reports' },
  { key: 'setup', href: '/accounting.html?tab=setup', label: 'Setup' },
];

export const MAP_GROUPS = [
  { key: 'sale', title: 'Sale' },
  { key: 'sell_payment', title: 'Sales Payments' },
  { key: 'purchases', title: 'Purchases' },
  { key: 'purchase_payment', title: 'Purchase Payments' },
  { key: 'expense', title: 'Expenses', wrap: true },
];

export const TYPES = ['Asset', 'Expenses', 'Income', 'Equity', 'Liability'];
export const TYPE_COLORS = {
  Asset: '#E75E82',
  Expenses: '#37A2EC',
  Income: '#FACD56',
  Equity: '#5CA85C',
  Liability: '#605CA8',
};
const SLICE_COLORS = ['#E75E82', '#37A2EC', '#FACD56', '#5CA85C', '#605CA8', '#2f7ed8', '#8bbc21', '#f28f43'];
const SEED_FLAG = 'df_acc_demo_v8';
const SUB_SCALE = { axidigetek: 0.88, bnpl: 1.14, delkor: 0.64, fiberk: 1 };
let _demoBooksP = null;

export const KEYS = {
  accounts: 'df_chart_of_accounts',
  journals: 'df_acc_journals',
  transfers: 'df_acc_transfers',
  budgets: 'df_acc_budgets',
  settings: 'df_acc_settings',
  subTypes: 'df_acc_sub_types',
  detailTypes: 'df_acc_detail_types',
  sales: 'df_acc_sales',
  purchases: 'df_purchases',
  expenses: 'df_expenses',
};

export function esc(s) {
  const map = {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'};
  return String(s ?? '').replace(/[&<>"']/g, (c) => map[c]);
}

export function accNav(active) {
  const heading = headingOf('/accounting.html', active === 'settings' ? 'setup' : active);
  const current = ACC_FLOOR.find((t) => t.key === heading) || ACC_FLOOR[0];
  const phone = document.documentElement.classList.contains('ult-phone')
    || /Android|iPhone|SamsungBrowser/i.test(navigator.userAgent || '');
  return `<div class="topic-drop${phone ? ' is-phone' : ''}">
    <button type="button" class="topic-drop-btn" aria-haspopup="true" aria-expanded="false"><span>${esc(current?.label || 'Accounting')}</span><span class="topic-drop-caret" aria-hidden="true">▾</span></button>
    <nav class="acc-nav" data-hub-file="/accounting.html" data-hub-on="${esc(heading || '')}">${ACC_FLOOR.map((t) => `
    <a class="acc-tab ${t.key === heading ? 'on' : ''}" href="${esc(t.href)}" data-htab="${esc(t.key)}">
      ${t.key === 'dash' ? `<span class="acc-ico">A</span>` : ''}${esc(t.label)}
    </a>`).join('')}</nav>
  </div>`;
}

export function mapTransactionsHtml(accounts, settings) {
  const maps = settings.default_map || {};
  const locs = (BUSINESS_LOCATIONS || []).filter((l) => l.code !== 'VW-GROUP');
  const pair = (loc, g, m) => `
    <div class="st-grid4">
      <label class="fld">Payment account:
        <select data-map="${esc(loc.code)}" data-g="${g.key}" data-k="payment_account">${accountOpts(accounts, m[g.key]?.payment_account, 'Payment account')}</select>
      </label>
      <label class="fld">Deposit to:
        <select data-map="${esc(loc.code)}" data-g="${g.key}" data-k="deposit_to">${accountOpts(accounts, m[g.key]?.deposit_to, 'Deposit to')}</select>
      </label>
    </div>`;
  return `
    <div style="margin-bottom:12px">
      <button type="button" class="ult-btn" id="reset" style="background:#e11d48;color:#fff;border:0;border-radius:8px;padding:8px 14px;cursor:pointer;font-weight:700">Reset data</button>
    </div>
    <div class="st-grid4">
      <label class="fld">Journal Entry Prefix:
        <input id="jpre" value="${esc(settings.journal_prefix || '')}" />
      </label>
      <label class="fld">Transfer Prefix:
        <input id="tpre" value="${esc(settings.transfer_prefix || '')}" />
      </label>
    </div>
    <hr class="set-hr"/>
    <h3>Map Transactions</h3>
    ${locs.map((loc) => {
      const m = maps[loc.code] || maps[loc.subsidiary] || {};
      return `<div class="map-box">
        <h3 class="box-title">${esc(loc.name)}</h3>
        ${MAP_GROUPS.map((g) => `<div class="${g.wrap ? 'map-exp' : ''}">
          <strong>${esc(g.title)}</strong>${pair(loc, g, m)}${g.wrap ? '' : '<hr/>'}
        </div>`).join('')}
      </div>`;
    }).join('')}
    <div class="set-update-wrap"><button type="button" class="btn-update-settings" id="save-map">Update</button></div>`;
}

export function bindMapForm(root, { resetAccounting, toast, confirmAction }) {
  root.querySelector('#reset')?.addEventListener('click', async () => {
    const ok = await confirmAction('Reset accounting data?', 'This will delete all accounting data. And data cannot be reverted back.');
    if (!ok) return;
    await resetAccounting();
    toast('Accounting data reset');
  });
  root.querySelector('#save-map')?.addEventListener('click', async () => {
    const ok = await confirmAction('Update accounting settings?', 'Default mappings apply to new documents.');
    if (!ok) return;
    const next = loadSettings();
    next.journal_prefix = root.querySelector('#jpre')?.value.trim() || '';
    next.transfer_prefix = root.querySelector('#tpre')?.value.trim() || '';
    next.default_map = next.default_map || {};
    root.querySelectorAll('[data-map]').forEach((sel) => {
      const loc = sel.dataset.map;
      const g = sel.dataset.g;
      const k = sel.dataset.k;
      next.default_map[loc] = next.default_map[loc] || {};
      next.default_map[loc][g] = next.default_map[loc][g] || {};
      next.default_map[loc][g][k] = sel.value;
    });
    saveSettings(next);
    toast('Settings updated');
  });
}

export function tableBar() {
  return `<div class="bar">
    <label>Show <select data-tbl-size><option selected>25</option><option>50</option><option>100</option><option>All</option></select> entries</label>
    <div class="grow"></div>
    <button type="button" data-exp="csv">Export CSV</button>
    <button type="button" data-exp="xls">Export Excel</button>
    <button type="button" data-exp="print">Print</button>
    <button type="button" data-exp="cols">Column visibility</button>
    <button type="button" data-exp="pdf">Export PDF</button>
    <input data-tbl-search placeholder="Search …" />
  </div>`;
}

export function tableFoot() {
  return `<div class="tbl-foot"><span data-tbl-info></span><div data-tbl-pager></div></div>`;
}

export const SUB_TYPES = [
  { name: 'Accounts Receivable (A/R)', account_type: 'Asset', show_balance: 1 },
  { name: 'Current assets', account_type: 'Asset', show_balance: 1 },
  { name: 'Cash and cash equivalents', account_type: 'Asset', show_balance: 1 },
  { name: 'Fixed assets', account_type: 'Asset', show_balance: 1 },
  { name: 'Non-current assets', account_type: 'Asset', show_balance: 1 },
  { name: 'Accounts Payable (A/P)', account_type: 'Liability', show_balance: 1 },
  { name: 'Credit Card', account_type: 'Liability', show_balance: 1 },
  { name: 'Current liabilities', account_type: 'Liability', show_balance: 1 },
  { name: 'Non-current liabilities', account_type: 'Liability', show_balance: 1 },
  { name: "Owner's Equity", account_type: 'Equity', show_balance: 1 },
  { name: 'Income', account_type: 'Income', show_balance: 0 },
  { name: 'Other income', account_type: 'Income', show_balance: 0 },
  { name: 'Cost of sales', account_type: 'Expenses', show_balance: 0 },
  { name: 'Expenses', account_type: 'Expenses', show_balance: 0 },
  { name: 'Other Expense', account_type: 'Expenses', show_balance: 0 },
];

export const DETAIL_TYPES = [
  { name: 'Accounts Receivable (A/R)', parent: 'Accounts Receivable (A/R)', description: 'Unpaid invoices from customers.' },
  { name: 'Undeposited Funds', parent: 'Current assets', description: 'Payments received but not yet deposited.' },
  { name: 'Other current assets', parent: 'Current assets', description: 'Assets expected to convert to cash within a year.' },
  { name: 'Cash on hand', parent: 'Cash and cash equivalents', description: 'Till and petty cash.' },
  { name: 'Bank', parent: 'Cash and cash equivalents', description: 'Bank current / savings accounts.' },
  { name: 'Mobile Money', parent: 'Cash and cash equivalents', description: 'MTN MoMo, Vodafone Cash, AirtelTigo.' },
  { name: 'Buildings', parent: 'Fixed assets', description: 'Land and buildings.' },
  { name: 'Furniture and fixtures', parent: 'Fixed assets', description: 'Office and shop furniture.' },
  { name: 'Other non-current assets', parent: 'Non-current assets', description: 'Assets held longer than a year.' },
  { name: 'Accounts Payable (A/P)', parent: 'Accounts Payable (A/P)', description: 'Unpaid bills from suppliers.' },
  { name: 'Credit Card', parent: 'Credit Card', description: 'Credit card liability.' },
  { name: 'Current liabilities', parent: 'Current liabilities', description: 'Amounts due within a year.' },
  { name: 'Non-current liabilities', parent: 'Non-current liabilities', description: 'Long-term loans and bonds.' },
  { name: "Owner's Equity", parent: "Owner's Equity", description: 'Owner capital and retained earnings.' },
  { name: 'Sales of Product Income', parent: 'Income', description: 'Income from product sales.' },
  { name: 'Unapplied Cash Payment Income', parent: 'Income', description: 'Customer payments not yet applied.' },
  { name: 'Other income', parent: 'Other income', description: 'Income not from core operations.' },
  { name: 'Unrealised loss on securities, net of tax', parent: 'Other income', description: 'Mark-to-market gains and losses.' },
  { name: 'Cost of labour - COS', parent: 'Cost of sales', description: 'Direct labour in cost of sales.' },
  { name: 'Cost of sales', parent: 'Cost of sales', description: 'Direct cost of goods sold.' },
  { name: 'Payroll Expenses', parent: 'Expenses', description: 'Salaries, wages and SNNIT.' },
  { name: 'Utilities', parent: 'Expenses', description: 'Electricity, water, internet.' },
  { name: 'Travel expenses - selling expense', parent: 'Expenses', description: 'Field and sales travel.' },
  { name: 'Travel expenses - general and admin expenses', parent: 'Expenses', description: 'Admin travel.' },
  { name: 'Taxes Paid', parent: 'Expenses', description: 'GRA taxes and levies.' },
  { name: 'Office/General Administrative Expenses', parent: 'Expenses', description: 'Stationery, printing, office.' },
  { name: 'Other Miscellaneous Service Cost', parent: 'Expenses', description: 'Uncategorised operating cost.' },
  { name: 'Other Expense', parent: 'Other Expense', description: 'Non-operating expenses.' },
];

/** Delkor-Fiberk ERP default CoA (names match the tabular screenshot). */
export const DEFAULT_COA = [
  { name: 'Accounts Receivable (A/R)', gl: '1100', type: 'Asset', sub_type: 'Accounts Receivable (A/R)', detail_type: 'Accounts Receivable (A/R)', opening: 78640 },
  { name: 'Undeposited Funds', gl: '1200', type: 'Asset', sub_type: 'Current assets', detail_type: 'Undeposited Funds', opening: 12850 },
  { name: 'Uncategorised Asset', gl: '1290', type: 'Asset', sub_type: 'Current assets', detail_type: 'Other current assets', opening: 4200 },
  { name: 'Cash and cash equivalents', gl: '1000', type: 'Asset', sub_type: 'Cash and cash equivalents', detail_type: 'Cash on hand', opening: 0 },
  { name: 'Cash on hand', gl: '1010', type: 'Asset', sub_type: 'Cash and cash equivalents', detail_type: 'Cash on hand', opening: 18640 },
  { name: 'Bank', gl: '1020', type: 'Asset', sub_type: 'Cash and cash equivalents', detail_type: 'Bank', opening: 246800 },
  { name: 'Mobile Money', gl: '1030', type: 'Asset', sub_type: 'Cash and cash equivalents', detail_type: 'Mobile Money', opening: 56420 },
  { name: 'Fixed assets', gl: '1500', type: 'Asset', sub_type: 'Fixed assets', detail_type: 'Furniture and fixtures', opening: 185000 },
  { name: 'Non-current assets', gl: '1600', type: 'Asset', sub_type: 'Non-current assets', detail_type: 'Other non-current assets', opening: 42000 },
  { name: 'Accounts Payable (A/P)', gl: '2000', type: 'Liability', sub_type: 'Accounts Payable (A/P)', detail_type: 'Accounts Payable (A/P)', opening: 61240 },
  { name: 'Credit Card', gl: '2100', type: 'Liability', sub_type: 'Credit Card', detail_type: 'Credit Card', opening: 9840 },
  { name: 'Current liabilities', gl: '2200', type: 'Liability', sub_type: 'Current liabilities', detail_type: 'Current liabilities', opening: 24600 },
  { name: 'Non-current liabilities', gl: '2300', type: 'Liability', sub_type: 'Non-current liabilities', detail_type: 'Non-current liabilities', opening: 80000 },
  { name: "Owner's Equity", gl: '3000', type: 'Equity', sub_type: "Owner's Equity", detail_type: "Owner's Equity", opening: 410000 },
  { name: 'Income', gl: '4000', type: 'Income', sub_type: 'Income', detail_type: 'Sales of Product Income', opening: 0 },
  { name: 'Uncategorised Income', gl: '4010', type: 'Income', sub_type: 'Income', detail_type: 'Sales of Product Income', opening: 0 },
  { name: 'Unapplied Cash Payment Income', gl: '4020', type: 'Income', sub_type: 'Income', detail_type: 'Unapplied Cash Payment Income', opening: 0 },
  { name: 'Other income', gl: '4100', type: 'Income', sub_type: 'Other income', detail_type: 'Other income', opening: 0 },
  { name: 'Unrealised loss on securities, net of tax', gl: '4110', type: 'Income', sub_type: 'Other income', detail_type: 'Unrealised loss on securities, net of tax', opening: 0 },
  { name: 'Cost of sales', gl: '5000', type: 'Expenses', sub_type: 'Cost of sales', detail_type: 'Cost of sales', opening: 0 },
  { name: 'Subcontractors - COS', gl: '5010', type: 'Expenses', sub_type: 'Cost of sales', detail_type: 'Cost of labour - COS', opening: 0 },
  { name: 'Expenses', gl: '6000', type: 'Expenses', sub_type: 'Expenses', detail_type: 'Other Miscellaneous Service Cost', opening: 0 },
  { name: 'Payroll Expenses', gl: '6100', type: 'Expenses', sub_type: 'Expenses', detail_type: 'Payroll Expenses', opening: 0 },
  { name: 'Utilities', gl: '6200', type: 'Expenses', sub_type: 'Expenses', detail_type: 'Utilities', opening: 0 },
  { name: 'Travel expenses - selling expense', gl: '6300', type: 'Expenses', sub_type: 'Expenses', detail_type: 'Travel expenses - selling expense', opening: 0 },
  { name: 'Travel expenses - general and admin expenses', gl: '6310', type: 'Expenses', sub_type: 'Expenses', detail_type: 'Travel expenses - general and admin expenses', opening: 0 },
  { name: 'Supplies', gl: '6400', type: 'Expenses', sub_type: 'Expenses', detail_type: 'Taxes Paid', opening: 0 },
  { name: 'Stationery and printing', gl: '6500', type: 'Expenses', sub_type: 'Expenses', detail_type: 'Office/General Administrative Expenses', opening: 0 },
  { name: 'Uncategorised Expense', gl: '6900', type: 'Expenses', sub_type: 'Expenses', detail_type: 'Other Miscellaneous Service Cost', opening: 0 },
  { name: 'Other Expense', gl: '7000', type: 'Expenses', sub_type: 'Other Expense', detail_type: 'Other Expense', opening: 0 },
];

export function currentSubCode() {
  const s = getActiveSubsidiary();
  return s?.code || 'group';
}

export function subLabel(code) {
  return SUBSIDIARIES.find((s) => s.code === code)?.name || code || '—';
}

export function seedSubs() {
  const code = currentSubCode();
  if (!code || code === 'group') return OPERATING_SUBSIDIARIES.map((s) => s.code);
  return [code];
}

function prefixFor(sub) {
  return SUB_PREFIX[sub] || String(sub || 'GRP').slice(0, 3).toUpperCase();
}

function scaleOf(sub) {
  return SUB_SCALE[sub] || 1;
}

export async function loadAccounts() {
  const local = readLs(KEYS.accounts, []);
  if (local.length >= 20) return local;
  return loadRows('chart_of_accounts', KEYS.accounts, local);
}

export async function loadJournals() {
  const local = readLs(KEYS.journals, []);
  const base = local.length >= 8 ? local : await loadRows('journals', KEYS.journals, local);
  return Array.isArray(base) ? base : [];
}

export async function loadTransfers() {
  const local = readLs(KEYS.transfers, []);
  if (local.length >= 3) return local;
  return loadRows('accounting_transfers', KEYS.transfers, local);
}

export async function loadBudgets() {
  const local = readLs(KEYS.budgets, []);
  if (local.length >= 4) return local;
  return loadRows('budgets', KEYS.budgets, local);
}

export function loadSettings() {
  const d = {
    journal_prefix: 'JE',
    transfer_prefix: 'TR',
    fy_start_month: 1,
    maps: {},
  };
  try { return { ...d, ...(JSON.parse(localStorage.getItem(KEYS.settings) || '{}')) }; }
  catch { return d; }
}

export function saveSettings(s) {
  try { localStorage.setItem(KEYS.settings, JSON.stringify(s)); } catch { /* quota */ }
  try { if (s.fy_start_month) localStorage.setItem('df_fy_start_month', String(s.fy_start_month)); } catch { /* quota */ }
}

export async function loadSubTypes() {
  seedTypeCatalogs();
  const rows = await loadRows('account_sub_types', KEYS.subTypes, SUB_TYPES);
  return rows.length ? rows : SUB_TYPES;
}

export async function loadDetailTypes() {
  seedTypeCatalogs();
  const rows = await loadRows('account_detail_types', KEYS.detailTypes, DETAIL_TYPES);
  return rows.length ? rows : DETAIL_TYPES;
}

function seedTypeCatalogs() {
  if (!readLs(KEYS.subTypes, []).length) {
    writeLs(KEYS.subTypes, SUB_TYPES.map((s) => ({ ...s, id: uid() })));
  }
  if (!readLs(KEYS.detailTypes, []).length) {
    writeLs(KEYS.detailTypes, DETAIL_TYPES.map((d) => ({ ...d, id: uid() })));
  }
}

export function scopeAccounts(rows) {
  const sub = currentSubCode();
  const loc = getActiveLocation();
  let out = rows.slice();
  if (sub && sub !== 'group') out = out.filter((r) => !r.subsidiary_code || r.subsidiary_code === sub || r.subsidiary_code === 'group');
  if (loc) {
    const locSub = findLocation(loc)?.subsidiary;
    if (locSub) out = out.filter((r) => !r.location_code || r.location_code === loc || r.subsidiary_code === locSub);
  }
  return out;
}

export function scopeDocs(rows) {
  const sub = currentSubCode();
  const loc = getActiveLocation();
  const agent = getActiveAgent();
  let out = (rows || []).map((r) => ({
    ...r,
    subsidiary_code: r.subsidiary_code || r.sub || '',
    location_code: r.location_code || r.location || '',
  }));
  if (sub && sub !== 'group') {
    out = out.filter((r) => {
      const rs = String(r.subsidiary_code || '').toLowerCase();
      return !rs || rs === sub || rs === 'group';
    });
  }
  if (loc) {
    const L = findLocation(loc);
    out = out.filter((r) => {
      const rl = String(r.location_code || '').trim();
      if (!rl) return true;
      if (L && rl === L.code) return true;
      return rl === loc;
    });
  }
  if (agent) out = out.filter((r) => !r.agent_id || String(r.agent_id) === String(agent));
  return out;
}

export function inRange(isoDate, from, to, { allowBlank = false } = {}) {
  const d = String(isoDate || '').slice(0, 10);
  if (!d) return !!allowBlank;
  if (from && d < from) return false;
  if (to && d > to) return false;
  return true;
}

function isPnl(account) {
  return account?.account_type === 'Income' || account?.account_type === 'Expenses';
}

export async function seedDefaultAccounts() {
  seedTypeCatalogs();
  const existing = await loadAccounts();
  const have = new Set(existing.map((a) => `${a.subsidiary_code}::${a.name}`));
  const rows = [];
  const subs = OPERATING_SUBSIDIARIES.map((s) => s.code).filter(Boolean);
  for (const sub of subs) {
    for (const a of DEFAULT_COA) {
      const key = `${sub}::${a.name}`;
      if (have.has(key)) continue;
      have.add(key);
      rows.push({
        id: `coa-${sub}-${a.gl}`,
        name: a.name,
        gl_code: a.gl,
        account_code: a.gl,
        account_type: a.type,
        sub_type: a.sub_type,
        detail_type: a.detail_type,
        opening_balance: 0,
        as_of: '2026-01-01',
        status: 'Active',
        subsidiary_code: sub,
        source: 'default_coa',
      });
    }
  }
  if (!rows.length) {
    if (existing.length) seedDefaultMaps(existing);
    return existing;
  }
  const next = [...existing, ...rows];
  writeLs(KEYS.accounts, next);
  seedDefaultMaps(next);
  return next;
}

function findAcc(accounts, sub, name) {
  return accounts.find((a) => a.subsidiary_code === sub && a.name === name);
}

function je(sub, date, ref, note, addedBy, lines) {
  const clean = lines.filter((ln) => ln.account && ln.account.id);
  if (clean.length < 2) return null;
  const loc = locFor(sub);
  return {
    id: uid(),
    journal_date: date,
    operation_date: date,
    ref_no: ref,
    note,
    added_by: addedBy,
    status: 'posted',
    subsidiary_code: sub,
    location_code: loc?.code || '',
    location_name: loc?.name || '',
    lines: clean.map((ln) => ({
      id: uid(),
      account_id: ln.account.id,
      account: ln.account.name,
      debit: ln.debit || 0,
      credit: ln.credit || 0,
      note: ln.note || '',
    })),
    created_at: date + 'T09:00:00.000Z',
  };
}

function money(n) {
  return Math.round(n * 100) / 100;
}

export async function seedDemoActivity(accounts) {
  return accounts || [];
}

function locFor(sub) {
  return BUSINESS_LOCATIONS.find((l) => l.subsidiary === sub) || BUSINESS_LOCATIONS[0];
}

function seedDefaultMaps(accounts) {
  const s = loadSettings();
  const pick = (sub, name) => accounts.find((a) => a.subsidiary_code === sub && a.name === name)?.id || '';
  const payrollMap = (sub) => ({ payment_account: pick(sub, 'Bank'), deposit_to: pick(sub, 'Payroll Expenses') });
  if (s.default_map && Object.keys(s.default_map).length) {
    let changed = false;
    Object.keys(s.default_map).forEach((sub) => {
      if (!s.default_map[sub]?.payroll) {
        s.default_map[sub] = { ...(s.default_map[sub] || {}), payroll: payrollMap(sub) };
        changed = true;
      }
    });
    if (changed) saveSettings(s);
    return;
  }
  const maps = {};
  OPERATING_SUBSIDIARIES.forEach((subRow) => {
    const sub = subRow.code;
    maps[sub] = {
      sale: { payment_account: pick(sub, 'Income'), deposit_to: pick(sub, 'Bank') },
      sell_payment: { payment_account: pick(sub, 'Accounts Receivable (A/R)'), deposit_to: pick(sub, 'Bank') },
      purchases: { payment_account: pick(sub, 'Accounts Payable (A/P)'), deposit_to: pick(sub, 'Uncategorised Asset') },
      purchase_payment: { payment_account: pick(sub, 'Bank'), deposit_to: pick(sub, 'Accounts Payable (A/P)') },
      expense: { payment_account: pick(sub, 'Bank'), deposit_to: pick(sub, 'Utilities') },
      payroll: payrollMap(sub),
    };
  });
  saveSettings({ ...s, default_map: maps });
}

function seedDemoDocuments(accounts) {
  return accounts || [];
}


/** Keep the CoA in place and post live sales / expenses / purchases into the journals. */
export async function ensureDemoBooks() {
  if (_demoBooksP) return _demoBooksP;
  _demoBooksP = (async () => {
    seedTypeCatalogs();
    const accounts = await seedDefaultAccounts();
    try {
      const { syncLiveAccounting } = await import('./acc-sync-live.js');
      syncLiveAccounting();
    } catch { /* purchases optional */ }
    try { syncOpsToBooks(accounts); } catch { /* sales/expenses optional */ }
    return loadAccounts();
  })();
  try {
    return await _demoBooksP;
  } finally {
    /* keep the resolved promise so later callers reuse it */
  }
}

function accNamed(accounts, sub, names) {
  const want = names.map((n) => String(n).toLowerCase());
  return accounts.find((a) => a.subsidiary_code === sub && want.includes(String(a.name || '').toLowerCase()))
    || accounts.find((a) => want.includes(String(a.name || '').toLowerCase()))
    || { id: '', name: names[0] };
}

function ymBucket(map, sub, day, field, amt) {
  if (!(amt > 0) || !day) return;
  const d = String(day).slice(0, 10);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(d)) return;
  const k = `${sub}|${d}`;
  const row = map.get(k) || { sub, day: d, sales: 0, paid: 0, expense: 0 };
  row[field] = (row[field] || 0) + amt;
  map.set(k, row);
}

/** One journal per subsidiary per day from live sales and expenses, so the date filter hits the right window. */
export function syncOpsToBooks(accounts) {
  if (!accounts?.length) return 0;
  const jes = (readLs(KEYS.journals, []) || []).filter((j) =>
    j.source !== 'ops-sync' && !String(j.id || '').startsWith('je-ops-')
  );
  const have = new Set(jes.map((j) => String(j.id)));
  const add = [];
  const sales = [
    ...(readLs(KEYS.sales, []) || []),
    ...(readLs('df_sales_orders', []) || []),
    ...(readLs('df_bnpl_orders', []) || []),
    ...(readLs('df_pos_sales', []) || []),
  ];
  const saleMap = new Map();
  sales.forEach((s) => {
    if (/draft|quot|cancel/i.test(s.status || '')) return;
    const amt = Number(s.total_amount || s.grand_total || s.final_total || s.price || s.transfer_amount || 0);
    if (!(amt > 0)) return;
    const paid = Number(s.amount_paid || s.paid || s.downpayment || 0);
    const day = String(s.order_date || s.transaction_date || s.date || s.delivery_at || s.sold_at || s.created_at || '').slice(0, 10);
    const sub = s.subsidiary_code || s._sub || 'fiberk';
    ymBucket(saleMap, sub, day, 'sales', amt);
    ymBucket(saleMap, sub, day, 'paid', Math.min(Math.max(0, paid), amt));
  });
  for (const b of saleMap.values()) {
    const id = `je-ops-sale-${b.sub}-${b.day}`;
    if (have.has(id)) continue;
    const income = accNamed(accounts, b.sub, ['Income', 'Sales of Product Income', 'Uncategorised Income']);
    const bank = accNamed(accounts, b.sub, ['Bank', 'Cash on hand', 'Mobile Money']);
    const ar = accNamed(accounts, b.sub, ['Accounts Receivable (A/R)']);
    const paid = Math.min(b.paid || 0, b.sales);
    const due = Math.max(0, b.sales - paid);
    const lines = [];
    if (paid > 0) lines.push({ account: bank, debit: money(paid), credit: 0, note: 'Receipts' });
    if (due > 0) lines.push({ account: ar, debit: money(due), credit: 0, note: 'On account' });
    lines.push({ account: income, debit: 0, credit: money(b.sales), note: 'Sales' });
    const row = je(b.sub, b.day, 'JE-SALE-' + b.day, `Sales ${b.day}`, 'ops-sync', lines);
    if (row) { row.id = id; row.source = 'ops-sync'; add.push(row); have.add(id); }
  }

  const expMap = new Map();
  [
    ...(readLs(KEYS.expenses, []) || []),
    ...(readLs('df_acc_expenses', []) || []),
  ].forEach((e) => {
    const amt = Number(e.total_amount || e.amount || e.withdrawal || 0);
    if (!(amt > 0)) return;
    const day = String(e.expense_date || e.date || e.txn_date || e.created_at || '').slice(0, 10);
    const sub = e.subsidiary_code || 'fiberk';
    ymBucket(expMap, sub, day, 'expense', amt);
  });
  for (const b of expMap.values()) {
    const id = `je-ops-exp-${b.sub}-${b.day}`;
    if (have.has(id)) continue;
    const exp = accNamed(accounts, b.sub, ['Expenses', 'Uncategorised Expense']);
    const bank = accNamed(accounts, b.sub, ['Bank', 'Cash on hand']);
    const row = je(b.sub, b.day, 'JE-EXP-' + b.day, `Expenses ${b.day}`, 'ops-sync', [
      { account: exp, debit: money(b.expense), credit: 0, note: 'Operating' },
      { account: bank, debit: 0, credit: money(b.expense), note: 'Paid' },
    ]);
    if (row) { row.id = id; row.source = 'ops-sync'; add.push(row); have.add(id); }
  }
  writeLs(KEYS.journals, [...add, ...jes]);
  return add.length;
}

export async function resetAccounting() {
  _demoBooksP = null;
  writeLs(KEYS.accounts, []);
  writeLs(KEYS.journals, []);
  writeLs(KEYS.transfers, []);
  writeLs(KEYS.budgets, []);
  try { localStorage.removeItem(SEED_FLAG); } catch { /* ignore */ }
}

export function nextRef(kind, rows) {
  const s = loadSettings();
  const prefix = kind === 'transfer' ? (s.transfer_prefix || 'TR') : (s.journal_prefix || 'JE');
  const year = new Date().getFullYear();
  const n = rows.filter((r) => String(r.ref_no || '').includes(String(year))).length + 1;
  return `${prefix}${year}/${String(n).padStart(4, '0')}`;
}

function lineHitsAccount(ln, account, journal) {
  const id = String(account.id || '');
  if (ln.account_id) return String(ln.account_id) === id;
  if (String(ln.account || '') !== String(account.name || '')) return false;
  const sub = account.subsidiary_code || '';
  const jsub = journal?.subsidiary_code || ln.subsidiary_code || '';
  if (sub && jsub && String(sub) !== String(jsub)) return false;
  return true;
}

function signedMove(account, debit, credit) {
  if (account.account_type === 'Asset' || account.account_type === 'Expenses') return Number(debit || 0) - Number(credit || 0);
  return Number(credit || 0) - Number(debit || 0);
}

/** Closing balance as of `to` (balance-sheet). Opening counts only if as-of ≤ to. */
export function accountBalanceAsOf(account, journals, transfers, asOf) {
  const openDate = String(account.as_of || account.opening_date || '2026-01-01').slice(0, 10);
  let bal = 0;
  if (!asOf || openDate <= asOf) bal = Number(account.opening_balance || 0);
  (journals || []).forEach((j) => {
    if (j.status === 'void') return;
    const d = String(j.journal_date || j.operation_date || '').slice(0, 10);
    if (!d || (asOf && d > asOf)) return;
    (j.lines || []).forEach((ln) => {
      if (!lineHitsAccount(ln, account, j)) return;
      bal += signedMove(account, ln.debit, ln.credit);
    });
  });
  (transfers || []).forEach((t) => {
    const d = String(t.transfer_date || t.operation_date || '').slice(0, 10);
    if (!d || (asOf && d > asOf)) return;
    const amt = Number(t.amount || 0);
    const id = String(account.id);
    const name = account.name;
    if (String(t.from_account_id) === id || t.from_account === name) bal -= (account.account_type === 'Asset' || account.account_type === 'Expenses') ? amt : -amt;
    if (String(t.to_account_id) === id || t.to_account === name) bal += (account.account_type === 'Asset' || account.account_type === 'Expenses') ? amt : -amt;
  });
  return bal;
}

/** P&L activity inside from–to only. Undated lines are excluded. */
export function accountPeriodActivity(account, journals, transfers, from, to) {
  let bal = 0;
  const openDate = String(account.as_of || account.opening_date || '').slice(0, 10);
  if (openDate && inRange(openDate, from, to)) bal += Number(account.opening_balance || 0);
  (journals || []).forEach((j) => {
    if (j.status === 'void') return;
    if (!inRange(j.journal_date || j.operation_date, from, to)) return;
    (j.lines || []).forEach((ln) => {
      if (!lineHitsAccount(ln, account, j)) return;
      bal += signedMove(account, ln.debit, ln.credit);
    });
  });
  (transfers || []).forEach((t) => {
    if (!inRange(t.transfer_date || t.operation_date, from, to)) return;
    const amt = Number(t.amount || 0);
    const id = String(account.id);
    const name = account.name;
    if (String(t.from_account_id) === id || t.from_account === name) {
      bal -= (account.account_type === 'Asset' || account.account_type === 'Expenses') ? amt : -amt;
    }
    if (String(t.to_account_id) === id || t.to_account === name) {
      bal += (account.account_type === 'Asset' || account.account_type === 'Expenses') ? amt : -amt;
    }
  });
  return bal;
}

/** Opening + posted journal lines + transfers in range. */
export function accountBalance(account, journals, transfers, from, to) {
  if (isPnl(account)) return accountPeriodActivity(account, journals, transfers, from, to);
  return accountBalanceAsOf(account, journals, transfers, to || from);
}

/** Opening (as of `from`), period debit/credit, and closing for Trial Balance. */
export function accountPeriod(account, journals, transfers, from, to) {
  const isDebit = account.account_type === 'Asset' || account.account_type === 'Expenses';
  const id = String(account.id);
  const name = account.name;
  let opening = Number(account.opening_balance || 0);
  let debit = 0;
  let credit = 0;
  (journals || []).forEach((j) => {
    if (j.status === 'void') return;
    const d = String(j.journal_date || j.operation_date || '').slice(0, 10);
    (j.lines || []).forEach((ln) => {
      if (!lineHitsAccount(ln, account, j)) return;
      const dd = Number(ln.debit || 0);
      const cc = Number(ln.credit || 0);
      if (from && d && d < from) opening += isDebit ? (dd - cc) : (cc - dd);
      else if (inRange(d, from, to)) { debit += dd; credit += cc; }
    });
  });
  (transfers || []).forEach((t) => {
    const d = String(t.transfer_date || t.operation_date || '').slice(0, 10);
    const amt = Number(t.amount || 0);
    const fromMe = String(t.from_account_id) === id || t.from_account === name;
    const toMe = String(t.to_account_id) === id || t.to_account === name;
    if (!fromMe && !toMe) return;
    const dd = toMe ? amt : 0;
    const cc = fromMe ? amt : 0;
    if (from && d && d < from) opening += isDebit ? (dd - cc) : (cc - dd);
    else if (inRange(d, from, to)) { debit += dd; credit += cc; }
  });
  const closing = isDebit ? opening + debit - credit : opening + credit - debit;
  return { opening, debit, credit, closing };
}

export function typeTotals(accounts, journals, transfers, from, to) {
  const totals = Object.fromEntries(TYPES.map((t) => [t, 0]));
  const bySub = {};
  accounts.forEach((a) => {
    const b = accountPeriodActivity(a, journals, transfers, from, to);
    totals[a.account_type] = (totals[a.account_type] || 0) + b;
    const k = a.account_type + '|' + (a.sub_type || a.name);
    bySub[k] = (bySub[k] || 0) + b;
  });
  return { totals, bySub };
}

export function slicesForType(type, bySub) {
  const colors = SLICE_COLORS;
  const subs = SUB_TYPES.filter((s) => s.account_type === type);
  const raw = subs.length
    ? subs.map((s, i) => ({
      label: s.name,
      value: Math.abs(Number(bySub[type + '|' + s.name] || 0)),
      color: colors[i % colors.length],
    }))
    : [{ label: type, value: Math.abs(bySub[type + '|' + type] || 0), color: TYPE_COLORS[type] || colors[0] }];
  const live = raw.filter((s) => s.value > 0);
  return live.length ? live : [{ label: type, value: 0, color: TYPE_COLORS[type] || colors[0] }];
}

function polar(cx, cy, r, angle) {
  return [cx + r * Math.cos(angle), cy + r * Math.sin(angle)];
}

export function pieSvg(slices, size = 220) {
  const data = (slices || []).map((s, i) => ({
    label: s.label,
    value: Math.abs(Number(s.value) || 0),
    color: s.color || SLICE_COLORS[i % SLICE_COLORS.length],
  }));
  const total = data.reduce((s, x) => s + x.value, 0);
  const cx = size / 2;
  const cy = size / 2;
  const r = size / 2 - 4;
  if (!total) {
    return `<svg class="pie-svg" width="${size}" height="${size}" viewBox="0 0 ${size} ${size}">
      <circle cx="${cx}" cy="${cy}" r="${r}" fill="none" stroke="#d1d5db" stroke-width="1.5"/></svg>`;
  }
  const live = data.filter((d) => d.value > 0);
  if (live.length === 1) {
    const sl = live[0];
    const pct = ((sl.value / total) * 100).toFixed(1);
    return `<svg class="pie-svg" width="${size}" height="${size}" viewBox="0 0 ${size} ${size}">
      <circle class="pie-slice" cx="${cx}" cy="${cy}" r="${r}" fill="${sl.color}"
        data-label="${esc(sl.label)}" data-val="${sl.value}" data-pct="${pct}">
        <title>${esc(sl.label)}: ${fmt(sl.value)} (${pct}%)</title>
      </circle></svg>`;
  }
  let a = -Math.PI / 2;
  const parts = live.map((sl) => {
    const sweep = (sl.value / total) * Math.PI * 2;
    const [x1, y1] = polar(cx, cy, r, a);
    a += sweep;
    const [x2, y2] = polar(cx, cy, r, a);
    const large = sweep > Math.PI ? 1 : 0;
    const pct = ((sl.value / total) * 100).toFixed(1);
    return `<path class="pie-slice" d="M ${cx} ${cy} L ${x1.toFixed(2)} ${y1.toFixed(2)} A ${r} ${r} 0 ${large} 1 ${x2.toFixed(2)} ${y2.toFixed(2)} Z"
      fill="${sl.color}" data-label="${esc(sl.label)}" data-val="${sl.value}" data-pct="${pct}">
      <title>${esc(sl.label)}: ${fmt(sl.value)} (${pct}%)</title></path>`;
  }).join('');
  return `<svg class="pie-svg" width="${size}" height="${size}" viewBox="0 0 ${size} ${size}">${parts}</svg>`;
}

export function pieLegend(slices, showValue = true) {
  return `<div class="pie-legend">${(slices || []).map((s, i) => `
    <span><i style="background:${s.color || SLICE_COLORS[i % SLICE_COLORS.length]}"></i>${esc(s.label)}${showValue ? ` <b>${fmt(s.value || 0)}</b>` : ''}</span>`).join('')}</div>`;
}

export function chartCard(title, slices, size = 220) {
  const payload = encodeURIComponent(JSON.stringify({ title, slices }));
  return `<div class="pie-card" data-chart="${payload}">
    <div class="pie-head"><span>${esc(title)}</span>
      <button type="button" class="pie-menu-btn" aria-label="Chart menu">☰</button>
    </div>
    <div class="pie-body">${pieSvg(slices, size)}</div>
    ${pieLegend(slices, false)}
  </div>`;
}

export function bindPieTips(root) {
  let tip = document.getElementById('pie-tip');
  if (!tip) {
    tip = document.createElement('div');
    tip.id = 'pie-tip';
    tip.className = 'pie-tip';
    tip.hidden = true;
    document.body.appendChild(tip);
  }
  root.querySelectorAll('.pie-slice').forEach((el) => {
    el.addEventListener('mousemove', (e) => {
      const label = el.getAttribute('data-label') || '';
      const val = Number(el.getAttribute('data-val') || 0);
      const pct = el.getAttribute('data-pct') || '';
      tip.hidden = false;
      tip.innerHTML = `<strong>${esc(label)}</strong><span>${fmt(val)} · ${esc(pct)}%</span>`;
      tip.style.left = `${e.clientX + 12}px`;
      tip.style.top = `${e.clientY + 12}px`;
    });
    el.addEventListener('mouseleave', () => { tip.hidden = true; });
  });
}

export function bindChartMenus(root) {
  bindPieTips(root);
  document.querySelectorAll('.pie-pop').forEach((p) => p.remove());
  root.querySelectorAll('.pie-card').forEach((card) => {
    const btn = card.querySelector('.pie-menu-btn');
    if (!btn) return;
    btn.onclick = (e) => {
      e.preventDefault();
      e.stopPropagation();
      document.querySelectorAll('.pie-pop').forEach((p) => p.remove());
      const pop = document.createElement('div');
      pop.className = 'pie-pop';
      pop.setAttribute('role', 'menu');
      pop.innerHTML = `
        <button type="button" data-c="full">View in full screen</button>
        <button type="button" data-c="print">Print chart</button>
        <hr/>
        <button type="button" data-c="png">Download PNG image</button>
        <button type="button" data-c="jpg">Download JPEG image</button>
        <button type="button" data-c="pdf">Download PDF document</button>
        <button type="button" data-c="svg">Download SVG vector image</button>`;
      document.body.appendChild(pop);
      const r = btn.getBoundingClientRect();
      pop.style.position = 'fixed';
      pop.style.zIndex = '10060';
      pop.style.left = 'auto';
      pop.style.right = `${Math.max(8, window.innerWidth - r.right)}px`;
      const ph = pop.offsetHeight || 220;
      let top = r.bottom + 4;
      if (top + ph > window.innerHeight - 8) top = Math.max(8, r.top - ph - 4);
      pop.style.top = `${top}px`;
      pop.onclick = (ev) => ev.stopPropagation();
      pop.querySelectorAll('button').forEach((b) => {
        b.onclick = (ev) => {
          ev.stopPropagation();
          runChartAction(card, b.dataset.c);
          pop.remove();
        };
      });
      const closer = (ev) => {
        if (ev.target.closest('.pie-pop, .pie-menu-btn')) return;
        pop.remove();
        document.removeEventListener('click', closer, true);
      };
      setTimeout(() => document.addEventListener('click', closer, true), 30);
    };
  });
}

function svgXml(card) {
  const svg = card.querySelector('svg');
  return svg ? new XMLSerializer().serializeToString(svg) : '';
}

function download(name, blob) {
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = name;
  a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 1500);
}

function raster(card, mime, name) {
  const svg = card.querySelector('svg');
  if (!svg) return;
  const xml = svgXml(card);
  const img = new Image();
  const url = URL.createObjectURL(new Blob([xml], { type: 'image/svg+xml' }));
  img.onload = () => {
    const c = document.createElement('canvas');
    c.width = 720; c.height = 720;
    const ctx = c.getContext('2d');
    ctx.fillStyle = '#fff';
    ctx.fillRect(0, 0, 720, 720);
    ctx.drawImage(img, 40, 40, 640, 640);
    c.toBlob((blob) => { if (blob) download(name, blob); URL.revokeObjectURL(url); }, mime, 0.92);
  };
  img.src = url;
}

function runChartAction(card, kind) {
  const title = card.querySelector('.pie-head span')?.textContent || 'chart';
  const svg = svgXml(card);
  if (kind === 'full') {
    const wrap = document.createElement('div');
    wrap.className = 'pie-full';
    wrap.innerHTML = `<div class="pie-full-inner"><button type="button" class="pie-full-x">×</button>${card.innerHTML}</div>`;
    document.body.appendChild(wrap);
    wrap.querySelector('.pie-menu-btn')?.remove();
    wrap.onclick = (e) => { if (e.target === wrap || e.target.classList.contains('pie-full-x')) wrap.remove(); };
    bindPieTips(wrap);
    return;
  }
  if (kind === 'print' || kind === 'pdf') {
    const w = window.open('', '_blank', 'width=800,height=700');
    if (!w) return alert('Allow pop-ups to print');
    w.document.write(`<!doctype html><title>${esc(title)}</title>
      <style>body{font-family:Inter,Arial,sans-serif;color:#111;padding:24px;text-align:center}
      h1{font-size:18px}svg{width:420px;height:420px}.pie-legend{display:flex;gap:12px;justify-content:center;flex-wrap:wrap;margin-top:12px}
      .pie-legend i{display:inline-block;width:10px;height:10px;border-radius:50%;margin-right:6px}
      .pie-head,.pie-menu-btn{display:none}</style>
      <h1>${esc(title)}</h1>${card.querySelector('.pie-body')?.innerHTML || ''}${card.querySelector('.pie-legend')?.outerHTML || ''}`);
    w.document.close();
    w.focus();
    setTimeout(() => w.print(), 250);
    return;
  }
  if (kind === 'svg') download(title.replace(/\s+/g, '-').toLowerCase() + '.svg', new Blob([svg], { type: 'image/svg+xml' }));
  if (kind === 'png') raster(card, 'image/png', title.replace(/\s+/g, '-').toLowerCase() + '.png');
  if (kind === 'jpg') raster(card, 'image/jpeg', title.replace(/\s+/g, '-').toLowerCase() + '.jpg');
}

export function dateFilterBtn(selected = 'this_year', from = '', to = '') {
  const r = (from && to) ? { from, to } : (datePreset(selected) || datePreset('this_year'));
  const label = `${r.from || ''} → ${r.to || ''}`;
  return `<div class="acc-date-wrap">
    <button type="button" class="acc-date-btn" id="date-btn">Filter by date · ${esc(label)} ▾</button>
    <div class="acc-date-menu" id="date-menu" hidden>
      ${DATE_PRESETS.map(([k, l]) => `<button type="button" class="range-pre ${k === selected ? 'on' : ''}" data-pre="${k}">${esc(l)}</button>`).join('')}
      <button type="button" class="range-pre" data-pre="custom">Custom Range</button>
      <div class="range-custom" id="range-custom" hidden>
        <input id="f-from" type="date" value="${esc(r.from)}" />
        <input id="f-to" type="date" value="${esc(r.to)}" />
        <button type="button" class="ult-add" id="date-apply" style="margin-top:6px">Apply</button>
      </div>
    </div>
  </div>`;
}

export function bindDateFilter(root, state, onChange) {
  const btn = root.querySelector('#date-btn');
  const menu = root.querySelector('#date-menu');
  if (!btn || !menu) return;
  document.querySelectorAll('#date-menu').forEach((m) => { if (m !== menu) m.remove(); });
  const place = () => {
    const r = btn.getBoundingClientRect();
    if (menu.parentNode !== document.body) document.body.appendChild(menu);
    menu.style.position = 'fixed';
    menu.style.zIndex = '10060';
    menu.style.top = `${r.bottom + 6}px`;
    menu.style.right = `${Math.max(8, window.innerWidth - r.right)}px`;
    menu.style.left = 'auto';
  };
  btn.onclick = (e) => {
    e.stopPropagation();
    menu.hidden = !menu.hidden;
    if (!menu.hidden) place();
  };
  menu.querySelectorAll('[data-pre]').forEach((b) => {
    b.onclick = (e) => {
      e.stopPropagation();
      const k = b.dataset.pre;
      if (k === 'custom') {
        menu.querySelector('#range-custom').hidden = false;
        place();
        return;
      }
      const r = datePreset(k);
      if (!r) return;
      state.preset = k;
      state.from = r.from;
      state.to = r.to;
      menu.hidden = true;
      onChange();
    };
  });
  menu.querySelector('#date-apply')?.addEventListener('click', (e) => {
    e.stopPropagation();
    state.preset = 'custom';
    state.from = menu.querySelector('#f-from').value;
    state.to = menu.querySelector('#f-to').value;
    menu.hidden = true;
    onChange();
  });
  if (document.documentElement.dataset.accDateBound !== '1') {
    document.documentElement.dataset.accDateBound = '1';
    document.addEventListener('click', (e) => {
      if (e.target.closest('.acc-date-wrap, #date-menu, #date-btn')) return;
      document.querySelectorAll('#date-menu').forEach((m) => { m.hidden = true; });
    });
  }
}

export function accountOpts(accounts, selected, placeholder = 'Please Select') {
  return `<option value="">${esc(placeholder)}</option>` + accounts
    .filter((a) => a.status !== 'Inactive')
    .map((a) => `<option value="${esc(a.id)}" ${String(selected) === String(a.id) ? 'selected' : ''}>${esc(a.name)} (${esc(a.gl_code || '')})</option>`)
    .join('');
}

export function fmtDate(s) {
  if (!s) return '';
  const d = new Date(s);
  if (Number.isNaN(d.getTime())) {
    const [y, m, dd] = String(s).slice(0, 10).split('-');
    return y ? `${dd}/${m}/${y}` : String(s);
  }
  const p = (n) => String(n).padStart(2, '0');
  return `${p(d.getDate())}/${p(d.getMonth() + 1)}/${d.getFullYear()}`;
}

export function statusPill(s) {
  const on = String(s || 'Active') === 'Active';
  return `<span class="status-pill ${on ? 'on' : 'off'}">${esc(on ? 'Active' : 'Inactive')}</span>`;
}

export { fmt, uid, saveRow, deleteRow, writeLs, readLs, DATE_PRESETS, datePreset };

/** Fiberkapp live years on the source (2024 is empty). Use on dash / journals / reports. */
export function fiberkDateRange() {
  const y = new Date().getFullYear();
  return { preset: 'fiberkapp', from: '2025-01-01', to: `${y}-12-31` };
}
