/** Finance hub — cash, budget, controls. Accounting keeps the books. */
import { fmt } from './supabaseClient.js';
import { readLs } from './ls-rows.js';
import { loadPayAccounts, loadFlows, accountBalance, scopePay, ensurePayBooks } from './pay-accounts.js';

export const FIN_TABS = [
  { key: 'treasury', label: 'Treasury & Cash' },
  { key: 'budget', label: 'Budgeting' },
  { key: 'controls', label: 'Controls' },
  { key: 'capital', label: 'Capital' },
  { key: 'vendors', label: 'Vendors & Payments' },
  { key: 'revenue', label: 'Revenue & Collections' },
  { key: 'kpis', label: 'KPIs' },
];

export function finNav(active) {
  return `<nav class="acc-nav">${FIN_TABS.map((t) =>
    `<a class="acc-tab ${t.key === active ? 'on' : ''}" href="/finance.html?tab=${t.key}" data-htab="${t.key}">${t.label}</a>`).join('')}</nav>`;
}

function num(v) { return Number(v || 0) || 0; }
function ymd(v) { return String(v || '').slice(0, 10); }

function dueDateOf(p) {
  const raw = p.payment_due_date || p.due_date || p.due_on || p.pay_by || p.payment_date;
  if (raw) return ymd(raw);
  const base = ymd(p.date || p.order_date || p.created_at);
  if (!base) return '';
  const days = Number(p.credit_days || p.payment_terms || 30) || 30;
  const t = Date.parse(base);
  if (!Number.isFinite(t)) return base;
  return new Date(t + days * 86400000).toISOString().slice(0, 10);
}

function dueAmtOf(p) {
  const due = num(p.payment_due);
  if (due) return due;
  const tot = num(p.grand_total || p.total_amount || p.total || p.amount);
  const paid = num(p.amount_paid || p.paid);
  return Math.max(0, tot - paid);
}

export async function financeSnapshot() {
  await ensurePayBooks().catch(() => {});
  const accounts = scopePay(await loadPayAccounts().catch(() => []));
  const flows = scopePay(await loadFlows().catch(() => []));
  const expenses = readLs('df_expenses', []) || [];
  const purchases = readLs('df_purchases', []) || [];
  const orders = readLs('df_bnpl_field_orders', []) || [];
  const pays = readLs('df_bnpl_field_payments', []) || [];
  const coll = readLs('df_collection_accounts', []) || [];
  const budgets = readLs('df_acc_budgets', []) || [];

  const withBal = accounts.map((a) => ({ ...a, bal: accountBalance(a, flows) }));
  const cash = withBal.filter((a) => /cash/i.test(`${a.name} ${a.account_type || ''} ${a.sub_type || ''}`));
  const bank = withBal.filter((a) => /bank|uba|overdraft/i.test(`${a.name} ${a.account_type || ''} ${a.sub_type || ''}`));
  const momo = withBal.filter((a) => /momo|mobile|wallet/i.test(`${a.name} ${a.account_type || ''} ${a.sub_type || ''}`));
  const cashPos = withBal.reduce((s, a) => s + num(a.bal), 0);

  const expMonth = expenses.reduce((s, e) => s + num(e.amount || e.total), 0);
  const today = new Date().toISOString().slice(0, 10);
  const purchDue = purchases
    .map((p) => ({
      ...p,
      due_date: dueDateOf(p),
      due_amt: dueAmtOf(p),
    }))
    .filter((p) => {
      const st = String(p.payment_status || p.status || '').toLowerCase();
      if (/^paid$/.test(st)) return false;
      return p.due_amt > 0 || /due|unpaid|partial|overdue/.test(st);
    })
    .sort((a, b) => String(a.due_date || '9999').localeCompare(String(b.due_date || '9999')));
  const scheduledToday = purchDue.filter((p) => p.due_date === today).length;
  const loanBook = orders.reduce((s, o) => s + num(o.loan_amount), 0);
  const collectedHint = pays.reduce((s, p) => s + num(p.downpayment), 0);

  const aging = { current: 0, d30: 0, d60: 0, d90: 0 };
  orders.forEach((o) => {
    const due = ymd(o.due_on);
    const amt = num(o.loan_amount);
    if (!due) { aging.current += amt; return; }
    const days = Math.floor((Date.parse(today) - Date.parse(due)) / 86400000);
    if (days <= 0) aging.current += amt;
    else if (days <= 30) aging.d30 += amt;
    else if (days <= 60) aging.d60 += amt;
    else aging.d90 += amt;
  });

  const budgetTotal = budgets.reduce((s, b) => s + num(b.amount || b.budget), 0);
  const pendingExp = expenses.filter((e) => /pend|draft|submit/i.test(String(e.status || 'pending'))).slice(0, 40);
  const pendingPo = purchases.filter((p) => /pend|draft|await/i.test(String(p.status || ''))).slice(0, 40);

  return {
    accounts: withBal,
    cashPos,
    cash: cash.reduce((s, a) => s + a.bal, 0),
    bank: bank.reduce((s, a) => s + a.bal, 0),
    momo: momo.reduce((s, a) => s + a.bal, 0),
    expMonth,
    purchDue,
    scheduledToday,
    loanBook,
    collectedHint,
    aging,
    budgetTotal,
    pendingExp,
    pendingPo,
    openColl: coll.filter((c) => c.status !== 'completed').length,
    doneColl: coll.filter((c) => c.status === 'completed').length,
    orderCount: orders.length,
    accountCount: withBal.length,
  };
}

export function kpiRow(items) {
  return `<div class="fin-kpis">${items.map((x) =>
    `<article class="fin-kpi"><span>${x.l}</span><strong>${x.v}</strong></article>`).join('')}</div>`;
}

export { fmt, num };
