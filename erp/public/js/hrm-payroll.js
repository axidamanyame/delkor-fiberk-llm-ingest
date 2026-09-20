/** Payroll book used by HRM and Accounting maps. */
import { readLs, writeLs, uid } from './ls-rows.js';
import { snnitSplit, netPay, slabCommission, validateSlabs } from './hrm-rules.js';

const KEY = 'df_hrm_payroll';

export async function loadPayrolls() {
  return readLs(KEY, []) || [];
}
export async function savePayroll(row) {
  const rows = readLs(KEY, []) || [];
  const id = row.id || uid();
  const next = { ...row, id };
  const i = rows.findIndex((r) => String(r.id) === String(id));
  if (i >= 0) rows[i] = { ...rows[i], ...next };
  else rows.unshift(next);
  writeLs(KEY, rows);
  return next;
}
export function listStaff() {
  return readLs('df_hrm_employees', []) || readLs('df_employees', []) || [];
}
export function nextRef(period) {
  const n = (readLs(KEY, []) || []).filter((r) => r.period === period).length + 1;
  return `PAY-${period || 'x'}-${String(n).padStart(3, '0')}`;
}
export function postPaid(id) {
  const rows = readLs(KEY, []) || [];
  const hit = rows.find((r) => String(r.id) === String(id));
  if (hit) { hit.status = 'paid'; writeLs(KEY, rows); }
  return hit;
}
/**
 * Ghana payroll line: SSNIT employee 5.5% / employer 13% of basic, plus the
 * sales-target slab commission, then net.
 *
 * The previous version took (staffArray, period) and set net = gross, with no
 * SSNIT at all. Its only caller — the payroll form in hrm-hub.js — calls it as
 * computeRun({ basic, allowance, deduction, sales }) and reads back
 * { basic, cmsn, sn: { employee, employer }, net }, so every call threw
 * "staff.map is not a function": the preview line never rendered and the form
 * could not save. This restores the contract the caller expects and routes the
 * maths through hrm-rules.js, which had the correct formulas all along.
 *
 * The legacy array form still works, so computeRun(staffArray, period) returns
 * draft rows — now with SSNIT applied.
 */
export function computeRun(input = {}, period) {
  if (Array.isArray(input)) {
    return input.map((s) => {
      const one = computeRun({
        basic: s.salary ?? s.basic,
        allowance: s.allowance,
        deduction: s.deduction,
        sales: s.sales,
        snnit: String(s.pay_type || '').toLowerCase() !== 'commission',
      });
      return {
        id: uid(),
        staff_id: s.id,
        name: s.name || s.full_name,
        pay_type: s.pay_type || 'salary',
        period,
        basic: one.basic,
        gross: one.gross,
        allowance: one.allowance,
        deduction: one.deduction,
        sales_target_commission: one.cmsn,
        snnit_employee: one.sn.employee,
        snnit_employer: one.sn.employer,
        net: one.net,
        net_pay: one.net,
        status: 'draft',
      };
    });
  }

  const basic = Number(input.basic) || 0;
  const allowance = Number(input.allowance) || 0;
  const deduction = Number(input.deduction) || 0;
  const sales = Number(input.sales) || 0;
  const slabs = input.slabs
    || readLs('df_hrm_slabs', null)
    || readLs('df_sales_targets', null)
    || [];
  const cmsn = slabCommission(slabs, sales);
  /* Which table was used and whether it is sound, so the form can say so
     rather than quietly paying zero commission. */
  const slabProblems = validateSlabs(slabs);
  /* Commission-only staff are paid direct on sales, with no statutory
     deduction — so the split is zero rather than 5.5% of a zero basic, which
     would coincidentally agree but for the wrong reason and would break the
     moment someone recorded a token basic. */
  const sn = input.snnit === false ? { employee: 0, employer: 0 } : snnitSplit(basic);
  const net = netPay({
    basic,
    allowance,
    deduction,
    sales_target_commission: cmsn,
    snnit_employee: sn.employee,
  });
  const gross = Math.round((basic + allowance + cmsn) * 100) / 100;
  return { basic, allowance, deduction, sales, slabs, slabProblems, cmsn, sn, gross, net };
}

/**
 * SSNIT arrears: what should have been withheld on rows saved before the
 * calculation was wired up, versus what actually was. Returns per-row
 * shortfalls and the totals owed. Nothing is rewritten — posted payroll stays
 * as filed; this is the figure to settle separately.
 */
export function snnitArrears(rows) {
  const lines = (rows || []).filter((r) => {
    /* A commission-only run never owed SSNIT, so it is not in arrears. Without
       this the arrears banner would invoice every direct payout. */
    return String(r?.pay_type || '').toLowerCase() !== 'commission';
  }).map((r) => {
    const basic = Number(r.basic ?? r.gross ?? 0);
    const due = snnitSplit(basic);
    const heldEmployee = Number(r.snnit_employee || 0);
    const heldEmployer = Number(r.snnit_employer || 0);
    return {
      id: r.id,
      ref_no: r.ref_no,
      employee_name: r.employee_name || r.name,
      month: r.month || r.period,
      basic,
      due_employee: due.employee,
      due_employer: due.employer,
      held_employee: heldEmployee,
      held_employer: heldEmployer,
      short_employee: Math.round(Math.max(0, due.employee - heldEmployee) * 100) / 100,
      short_employer: Math.round(Math.max(0, due.employer - heldEmployer) * 100) / 100,
    };
  }).filter((l) => l.short_employee > 0 || l.short_employer > 0);

  const sum = (k) => Math.round(lines.reduce((a, l) => a + l[k], 0) * 100) / 100;
  return {
    lines,
    count: lines.length,
    total_employee: sum('short_employee'),
    total_employer: sum('short_employer'),
    total: Math.round((sum('short_employee') + sum('short_employer')) * 100) / 100,
  };
}
export function monthLabel(ymd) {
  const d = String(ymd || '').slice(0, 7);
  return d || '';
}
export function todayYmd() {
  return new Date().toISOString().slice(0, 10);
}
export function periodStartOf(period) {
  return period ? `${period}-01` : todayYmd().slice(0, 8) + '01';
}
export function mapTxnToHrm() { return null; }
export function isSalaryExpense(row) {
  return /payroll|salary|wage|snnit/i.test(JSON.stringify(row || {}));
}
