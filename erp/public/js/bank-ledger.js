/**
 * Bank ledger book — Fiberk UBA statement mapped into Accounting, Payroll, Ops.
 * Same rows as Finance → Banking → UBA Fiberk. No second import.
 */
import { readLs, writeLs } from './ls-rows.js';
import { fmt } from './supabaseClient.js';
import { hydrateFromPack, loadUbaAccount, loadUbaTxns, bootBook, payeeOf, payrollMonth, money, classifyRemark } from './uba-fiberk-book.js';

export const LINK_KEY = 'df_transaction_links';
export const CAT_KEY = 'df_bank_txn_categories';

export const LEDGER_CATS = [
  { key: 'salary', label: 'Salary', module: 'payroll' },
  { key: 'phone_inventory', label: 'Phone inventory', module: 'inventory' },
  { key: 'rent', label: 'Rent', module: 'ops_hub' },
  { key: 'charges', label: 'Bank charges', module: 'ops_hub' },
  { key: 'loan', label: 'Loan', module: 'loan' },
  { key: 'imprest', label: 'Imprest', module: 'ops_hub' },
  { key: 'momo', label: 'MoMo', module: 'momo' },
  { key: 'collection', label: 'Collections', module: 'ops_hub' },
  { key: 'transfer', label: 'Transfers', module: 'transfer' },
  { key: 'uncategorized', label: 'Uncategorized', module: '' },
];

const OPS_CATS = new Set(['phone_inventory', 'rent', 'imprest', 'charges']);
const PAY_CATS = new Set(['salary']);

export function ledgerCategory(remarks) {
  const d = String(remarks || '').toLowerCase();
  if (d.includes('cot') || d.includes('ebundle')) return 'charges';
  if (d.includes('loan')) return 'loan';
  if (/\brent\b/.test(d)) return 'rent';
  if (d.includes('imprest') || d.includes('petty')) return 'imprest';
  if (/spark|smart|\bpop\b|phones|creditor/.test(d)) return 'phone_inventory';
  if (classifyRemark(remarks).category === 'payroll') return 'salary';
  if (d.includes('mm/wtb') || d.includes('mm/btw')) return 'momo';
  if (d.includes('hala')) return 'collection';
  if (/^ft\d/.test(d) || d.startsWith('r/ibg')) return 'transfer';
  return 'uncategorized';
}

export function catLabel(key) {
  return LEDGER_CATS.find((c) => c.key === key)?.label || key || '—';
}

export function catModule(key) {
  return LEDGER_CATS.find((c) => c.key === key)?.module || '';
}

export function getBankRole() {
  const ctx = window.__df_access || {};
  const name = String(ctx.roleName || ctx.role || '').toLowerCase();
  const perms = ctx.permissions || {};
  if (perms['*'] || perms['accounting.access'] || /hq|finance|owner|admin/.test(name)) return 'finance';
  if (perms['essentials.payroll_view'] || /payroll|hrm/.test(name)) return 'payroll';
  if (perms['field_ops.view_all'] || /ops|wms|warehouse|logistics/.test(name)) return 'ops';
  return 'finance';
}

export function visibleForRole(row, role) {
  const r = role || getBankRole();
  if (r === 'finance') return true;
  if (r === 'payroll') return PAY_CATS.has(row.category);
  if (r === 'ops') return OPS_CATS.has(row.category);
  return false;
}

function loadOverrides() {
  return readLs(CAT_KEY, {}) || {};
}

function loadLinks() {
  return readLs(LINK_KEY, []) || [];
}

export function toLedgerRow(t) {
  const overrides = loadOverrides();
  const category = overrides[t.id] || ledgerCategory(t.remarks);
  const payee = t.payee || payeeOf(t.remarks, category === 'salary' ? 'payroll' : '');
  return {
    id: t.id,
    transaction_date: t.txn_date,
    value_date: t.value_date,
    cheque_number: t.cheque_number || '',
    description: t.remarks,
    debit: Number(t.withdrawal || 0) || null,
    credit: Number(t.deposit || 0) || null,
    balance: t.running_balance,
    category,
    payee,
    module: catModule(category),
    instrument_id: t.instrument_id || '',
    account_number: t.account_number,
  };
}

export async function ensureBankBooks() {
  hydrateFromPack();
  try { await bootBook(); } catch { /* local pack is enough */ }
  autoLink();
  return { account: loadUbaAccount(), transactions: loadUbaTxns() };
}

export function ledgerRows(opts = {}) {
  const role = opts.role || getBankRole();
  const search = String(opts.search || '').toLowerCase().trim();
  const category = opts.category || '';
  const from = opts.from || '';
  const to = opts.to || '';
  let rows = loadUbaTxns().map(toLedgerRow).filter((r) => visibleForRole(r, role));
  if (category) rows = rows.filter((r) => r.category === category);
  if (from) rows = rows.filter((r) => String(r.transaction_date) >= from);
  if (to) rows = rows.filter((r) => String(r.transaction_date) <= to);
  if (search) {
    rows = rows.filter((r) =>
      String(r.description || '').toLowerCase().includes(search)
      || String(r.payee || '').toLowerCase().includes(search)
      || String(r.instrument_id || '').includes(search));
  }
  const links = loadLinks();
  rows.forEach((r) => {
    const hit = links.find((l) => String(l.transaction_id) === String(r.id));
    if (hit) {
      r.module = hit.module;
      r.module_record_id = hit.module_record_id;
      r.link_label = hit.label || hit.module;
      r.matched = true;
    }
  });
  return rows;
}

export function statementSummary() {
  const acc = loadUbaAccount() || {};
  const rows = loadUbaTxns();
  const total_debits = money(rows.reduce((s, t) => s + Number(t.withdrawal || 0), 0));
  const total_credits = money(rows.reduce((s, t) => s + Number(t.deposit || 0), 0));
  return {
    opening_balance: Number(acc.opening_balance || 10),
    closing_balance: Number(acc.total_balance || 37.72),
    total_debits,
    total_credits,
    net_movement: money(total_credits - total_debits),
    period_start: acc.statement_from || '2025-09-09',
    period_end: acc.statement_to || '2026-09-08',
    account_number: acc.account_number,
    n: rows.length,
  };
}

export function categorySummary(opts = {}) {
  const out = {};
  ledgerRows({ ...opts, category: '', search: '' }).forEach((r) => {
    const k = r.category || 'uncategorized';
    if (!out[k]) out[k] = { n: 0, debit: 0, credit: 0 };
    out[k].n += 1;
    out[k].debit = money(out[k].debit + Number(r.debit || 0));
    out[k].credit = money(out[k].credit + Number(r.credit || 0));
  });
  return out;
}

export function setCategory(transactionId, category) {
  const map = loadOverrides();
  map[transactionId] = category;
  writeLs(CAT_KEY, map);
  autoLink();
}

export function linkTransaction(transactionId, module, recordId, label) {
  const links = loadLinks().filter((l) => String(l.transaction_id) !== String(transactionId));
  links.push({
    id: 'lnk-' + transactionId,
    transaction_id: transactionId,
    module,
    module_record_id: recordId || '',
    label: label || module,
    created_at: new Date().toISOString(),
  });
  writeLs(LINK_KEY, links);
}

function autoLink() {
  const links = loadLinks();
  const have = new Set(links.map((l) => String(l.transaction_id)));
  const payrolls = readLs('df_hrm_payroll', []) || [];
  loadUbaTxns().map(toLedgerRow).forEach((r) => {
    if (have.has(String(r.id))) return;
    if (r.category === 'salary') {
      const month = payrollMonth(r.description, r.transaction_date);
      const hit = payrolls.find((p) =>
        String(p.source) === 'uba-fiberk' && String(p.id) === 'pr-' + r.id)
        || payrolls.find((p) =>
          String(p.employee_name || p.staff || '').toLowerCase() === String(r.payee || '').toLowerCase()
          && String(p.month || '') === String(month)
          && Math.abs(Number(p.net_pay || p.total || 0) - Number(r.debit || 0)) < 0.05);
      links.push({
        id: 'lnk-' + r.id,
        transaction_id: r.id,
        module: 'payroll',
        module_record_id: hit?.id || ('pr-' + r.id),
        label: r.payee || 'Payroll',
        created_at: new Date().toISOString(),
      });
      have.add(String(r.id));
      return;
    }
    if (r.category === 'charges' || r.category === 'rent' || r.category === 'imprest') {
      links.push({
        id: 'lnk-' + r.id,
        transaction_id: r.id,
        module: 'expense',
        module_record_id: 'exp-' + r.id,
        label: catLabel(r.category),
        created_at: new Date().toISOString(),
      });
      have.add(String(r.id));
      return;
    }
    if (r.category === 'momo') {
      links.push({
        id: 'lnk-' + r.id,
        transaction_id: r.id,
        module: 'momo',
        module_record_id: 'mw-fiberk-0541093516',
        label: 'Fiberk MoMo',
        created_at: new Date().toISOString(),
      });
      have.add(String(r.id));
      return;
    }
    if (r.category === 'loan' || r.category === 'collection' || r.category === 'transfer') {
      links.push({
        id: 'lnk-' + r.id,
        transaction_id: r.id,
        module: r.category,
        module_record_id: r.id,
        label: catLabel(r.category),
        created_at: new Date().toISOString(),
      });
      have.add(String(r.id));
    }
  });
  writeLs(LINK_KEY, links);
}

export function reconOverview(opts = {}) {
  const rows = ledgerRows(opts);
  const matched = rows.filter((r) => r.matched).length;
  const unmatched = rows.length - matched;
  return {
    bank_transactions: rows.length,
    matched,
    unmatched,
    match_rate: rows.length ? Math.round((matched / rows.length) * 1000) / 10 : 0,
    rows,
  };
}

export function salaryTransactions(month) {
  const rows = ledgerRows({ category: 'salary', role: 'finance' });
  const m = String(month || '').slice(0, 7);
  const filtered = m
    ? rows.filter((r) => String(r.transaction_date || '').startsWith(m))
    : rows;
  return filtered.map((r) => ({
    transaction_id: r.id,
    date: r.transaction_date,
    employee: r.payee || 'Fiberk staff',
    description: r.description,
    amount: r.debit,
    status: r.matched ? 'matched' : 'unmatched',
    payroll_id: r.module_record_id,
    month: payrollMonth(r.description, r.transaction_date),
  }));
}

export function payrollRecon(month) {
  const list = salaryTransactions(month);
  const matched = list.filter((r) => r.status === 'matched').length;
  const unmatched = list.length - matched;
  const total_paid = money(list.reduce((s, r) => s + Number(r.amount || 0), 0));
  return {
    transactions: list,
    matched,
    unmatched,
    total_paid,
    total_expected: total_paid,
    status: unmatched ? 'open' : 'balanced',
  };
}

export function opsActivity(opts = {}) {
  return ledgerRows({ ...opts, role: 'ops' }).map((r) => ({
    transaction_id: r.id,
    date: r.transaction_date,
    description: r.description,
    category: r.category,
    debit: r.debit,
    credit: r.credit,
    linked: r.link_label || '',
    warehouse: r.category === 'phone_inventory' ? 'Fiberk Shop' : '',
  }));
}

export function monthlyTrend() {
  const by = {};
  loadUbaTxns().forEach((t) => {
    const m = String(t.txn_date || '').slice(0, 7);
    if (!m) return;
    if (!by[m]) by[m] = { month: m, debits: 0, credits: 0 };
    by[m].debits = money(by[m].debits + Number(t.withdrawal || 0));
    by[m].credits = money(by[m].credits + Number(t.deposit || 0));
  });
  return Object.values(by).sort((a, b) => a.month.localeCompare(b.month));
}

export { fmt, money };
