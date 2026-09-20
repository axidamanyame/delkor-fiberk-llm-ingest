/** Budget vs actual — same shape as the department × category SQL. */
import { readLs } from './ls-rows.js';
import { fmt } from './supabaseClient.js';
import { loadAccounts, loadBudgets, loadJournals, loadTransfers, accountBalance, scopeAccounts, scopeDocs, ensureDemoBooks } from './accounting.js';

function num(v) { return Number(v || 0) || 0; }
function ymd(v) { return String(v || '').slice(0, 10); }

function departments() {
  const rows = readLs('df_hrm_departments', []) || readLs('df_departments', []) || [];
  if (rows.length) {
    return rows.map((d) => ({
      id: String(d.id || d.code || d.name),
      department_name: d.department_name || d.name || d.code || '—',
    }));
  }
  return [
    { id: 'fiberk', department_name: 'Fiberk' },
    { id: 'bnpl', department_name: 'BuyNowPaysLater' },
    { id: 'axidigetek', department_name: 'Axidigetek' },
    { id: 'delkor', department_name: 'Delkor Logistics' },
  ];
}

function categoryOf(account) {
  return account?.account_type || account?.sub_type || 'Uncategorised';
}

function deptOf(row) {
  return String(row.department_id || row.department_code || row.subsidiary_code || row.sub || 'fiberk');
}

function budgetAmount(b) {
  if (Array.isArray(b.months)) return b.months.reduce((s, n) => s + num(n), 0);
  return num(b.budget_amount || b.amount || b.budget);
}

export async function budgetVsActual(from, to) {
  await ensureDemoBooks().catch(() => {});
  const accounts = scopeAccounts(await loadAccounts().catch(() => []));
  const budgets = await loadBudgets().catch(() => []);
  const journals = scopeDocs(await loadJournals().catch(() => []));
  const transfers = scopeDocs(await loadTransfers().catch(() => []));
  const expenses = readLs('df_expenses', []) || [];
  const depts = departments();
  const deptName = (id) => depts.find((d) => String(d.id) === String(id))?.department_name || id || '—';

  const accById = new Map(accounts.map((a) => [String(a.id), a]));

  const budgetRows = [];
  (budgets || []).forEach((b) => {
    const acc = accById.get(String(b.account_id)) || { name: b.name || b.account, account_type: b.account_type || 'Expenses' };
    budgetRows.push({
      budget_id: b.id,
      department_id: deptOf(b),
      department_name: deptName(deptOf(b)),
      category_id: String(b.category_id || acc.account_type || categoryOf(acc)),
      category_name: b.category_name || categoryOf(acc),
      account_id: b.account_id,
      account_name: acc.name || b.name || '',
      period_start: b.period_start || (b.period ? `${b.period}-01-01` : from),
      period_end: b.period_end || (b.period ? `${b.period}-12-31` : to),
      budget_amount: budgetAmount(b),
    });
  });

  if (!budgetRows.length) {
    accounts.filter((a) => a.account_type === 'Expenses' || a.account_type === 'Income').forEach((a) => {
      budgetRows.push({
        budget_id: 'impl-' + a.id,
        department_id: deptOf(a),
        department_name: deptName(deptOf(a)),
        category_id: a.account_type,
        category_name: a.account_type,
        account_id: a.id,
        account_name: a.name,
        period_start: from,
        period_end: to,
        budget_amount: 0,
      });
    });
  }

  const actualByKey = new Map();
  const addActual = (category_id, department_id, amount) => {
    const k = `${category_id}||${department_id}`;
    actualByKey.set(k, (actualByKey.get(k) || 0) + num(amount));
  };

  accounts.forEach((a) => {
    const act = accountBalance(a, journals, transfers, from, to);
    addActual(a.account_type || categoryOf(a), deptOf(a), Math.abs(act));
  });

  expenses.forEach((e) => {
    const d = ymd(e.expense_date || e.date || e.transaction_date);
    if (from && d && d < from) return;
    if (to && d && d > to) return;
    addActual(e.category || e.category_name || 'Expenses', deptOf(e), num(e.amount || e.total));
  });

  const combined = budgetRows.map((bd) => {
    const actual_amount = actualByKey.get(`${bd.category_id}||${bd.department_id}`)
      ?? actualByKey.get(`${bd.category_name}||${bd.department_id}`)
      ?? 0;
    return {
      ...bd,
      actual_amount,
      variance: num(bd.budget_amount) - num(actual_amount),
    };
  });

  combined.sort((a, b) =>
    String(a.department_name).localeCompare(String(b.department_name))
    || String(a.category_name).localeCompare(String(b.category_name)));

  return { from, to, rows: combined, departments: depts };
}

export function varianceTableHtml(result) {
  const rows = result.rows || [];
  const totB = rows.reduce((s, r) => s + num(r.budget_amount), 0);
  const totA = rows.reduce((s, r) => s + num(r.actual_amount), 0);
  return `<div class="ult-table-wrap"><table class="ult-table">
    <thead><tr>
      <th>Department</th><th>Category</th><th>Account</th>
      <th>Budget</th><th>Actual</th><th>Variance</th>
    </tr></thead>
    <tbody>${rows.map((r) => `<tr>
      <td>${r.department_name}</td>
      <td>${r.category_name}</td>
      <td>${r.account_name || '—'}</td>
      <td>${fmt(r.budget_amount)}</td>
      <td>${fmt(r.actual_amount)}</td>
      <td>${fmt(r.variance)}</td>
    </tr>`).join('') || '<tr><td colspan="6">No budget lines in this range</td></tr>'}
    <tr><td colspan="3"><b>Total</b></td><td><b>${fmt(totB)}</b></td><td><b>${fmt(totA)}</b></td><td><b>${fmt(totB - totA)}</b></td></tr>
    </tbody></table></div>`;
}
