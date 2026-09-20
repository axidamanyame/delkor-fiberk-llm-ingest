/** HR people book — pull onto the current desk. */
import { readLs } from './ls-rows.js';
import { onlyMigrated } from './fiberk-silo.js';

function asList(v) {
  return Array.isArray(v) ? v : [];
}

export function cedi(n) {
  const x = Number(n || 0);
  return 'GH₵ ' + x.toLocaleString('en-GH', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

export function liveEmployees() {
  return [
    ...asList(readLs('df_employees', [])),
    ...asList(readLs('df_hrm_employees', [])),
    ...asList(readLs('df_users', [])),
    ...asList(readLs('df_profiles', [])),
  ];
}

export function fiberkEmployees() {
  const mig = onlyMigrated(liveEmployees());
  return mig.length ? mig : liveEmployees();
}

export function allEmployees() {
  const seen = new Set();
  const out = [];
  liveEmployees().forEach((e) => {
    const id = String(e.id || e.staff_id || e.email || e.name || '');
    if (!id || seen.has(id)) return;
    seen.add(id);
    out.push(e);
  });
  return out;
}

function tokens(e) {
  return [
    e.id, e.staff_id, e.employee_id, e.emp_id, e.code,
    e.email, e.phone, e.mobile,
    e.name, e.full_name, e.display_name,
    [e.first_name, e.last_name].filter(Boolean).join(' '),
    e.sa_name, e.sa_id,
  ].map((x) => String(x || '').trim().toLowerCase()).filter(Boolean);
}

export function matchEmployee(needle, list) {
  const n = String(needle || '').trim().toLowerCase();
  if (!n) return null;
  const rows = asList(list).length ? list : allEmployees();
  const exact = rows.find((e) => tokens(e).includes(n));
  if (exact) return exact;
  return rows.find((e) => tokens(e).some((t) => t.includes(n) || n.includes(t))) || null;
}

export function matchEmployees(needles, list) {
  return (needles || []).map((n) => matchEmployee(n, list)).filter(Boolean);
}

export function fiberkEmployeeMetrics() {
  const rows = fiberkEmployees();
  return { n: rows.length };
}

export function fiberkHrmBanner() {
  return '';
}

export function fiberkHrmCard() {
  return '';
}

export function salaryRecon(month) {
  const pays = [
    /* df_hrm_payroll (singular) is the key hrm-payroll.js actually writes;
       it was missing here, so salary reconciliation never saw a single run. */
    ...asList(readLs('df_hrm_payroll', [])),
    ...asList(readLs('df_hrm_payrolls', [])),
    ...asList(readLs('df_payrolls', [])),
  ].filter((p) => !month || String(p.month || p.period || '').startsWith(String(month)));
  const people = allEmployees().map((e) => {
    const paid = pays
      .filter((p) => matchEmployee(p.staff_id || p.employee_id || p.employee || p.name, [e]))
      .reduce((s, p) => s + Number(p.net || p.amount || p.paid || 0), 0);
    return { id: e.id, name: e.name || e.full_name || '', paid, matched: paid > 0 };
  });
  const rows = pays.map((p) => {
    const employee = matchEmployee(p.staff_id || p.employee_id || p.employee || p.name);
    return { ...p, matched: !!employee, employee };
  });
  return { people, rows, month: month || '' };
}

export async function ensureFiberkHrm() {
  return { ok: true, n: allEmployees().length };
}
