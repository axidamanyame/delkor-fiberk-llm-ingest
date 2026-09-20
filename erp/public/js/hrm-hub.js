/**
 * HRM hub — UPOS dashboard, leave, attendance, payrolls.
 */
import { esc, uid, readLs, writeLs, actMenu } from './ls-rows.js';
import { fmt, getAuthSession } from './supabaseClient.js';
import { tableBar, tableFoot } from './accounting.js';
import { bindTable } from './home-tables.js';
import { hubTabs, bindHubTabs, goFile, emptyRow, settingsCard, innerTabs, svgIco, maybePaintNest, resolveHubTab, nestsFor, bounceModuleSettings, onHubNavigate, floorNav, tryPaintFloor } from './hub-kit.js';
import { findUser, listPending } from './access-gate.js';
import { orientationBody, welcomeBody, trainingBody, INDUCTION_PANES } from './staff-learn.js';
import { confirmAction, ackResult } from './confirm-action.js';
import {
  loadPayrolls, savePayroll, listStaff, nextRef, postPaid, computeRun,
  monthLabel, todayYmd, periodStartOf, snnitArrears,
} from './hrm-payroll.js';
import { ensureBankBooks, payrollRecon } from './bank-ledger.js';
import {
  ensureFiberkHrm, fiberkEmployees, fiberkEmployeeMetrics, fiberkHrmBanner, fiberkHrmCard,
  salaryRecon, cedi, allEmployees,
} from './fiberk-hrm.js';
import { attendanceRows } from './time-clock.js';
import { todayBoard, policyHours } from './staff-kpi.js';
import { siloGateHtml } from './fiberk-silo.js';
import { chainOf } from './org-chain.js';

const FILE = '/hrm.html';
const KEY = 'df_hrm_hub_v1';
const FLAG = 'df_hrm_hub_seed_v5';
const TABS = [
  { key: 'people', label: 'People' },
  { key: 'types', label: 'Leave Type' },
  { key: 'leave', label: 'Leave' },
  { key: 'att', label: 'Attendance' },
  { key: 'payroll', label: 'Payroll' },
  { key: 'bankpay', label: 'Bank Salary' },
  { key: 'holiday', label: 'Holiday' },
  { key: 'dept', label: 'Departments' },
  { key: 'desig', label: 'Designations' },
  { key: 'induction', label: 'Staff induction' },
  { key: 'targets', label: 'Sales Targets' },
];
const BRAND = `${svgIco('people')} HRM`;

function seed() {
  try { if (localStorage.getItem(FLAG) === '1' && readLs(KEY, null)) return; } catch { /* ignore */ }
  writeLs(KEY, {
    types: [
      { id: 'lt1', name: 'Annual', days: 21 },
      { id: 'lt2', name: 'Sick', days: 10 },
      { id: 'lt3', name: 'Maternity', days: 84 },
      { id: 'lt4', name: 'Casual', days: 5 },
    ],
    leaves: [],
    attendance: [],
    holidays: [
      { id: 'h1', name: 'Founders’ Day', date: '2026-09-21' },
      { id: 'h2', name: 'Kwame Nkrumah Memorial', date: '2026-09-21' },
      { id: 'h3', name: 'Christmas', date: '2026-12-25' },
    ],
    depts: [
      { id: 'd0', name: 'Operations', company: 'Delkor-Fiberk Group' },
      { id: 'd1', name: 'Sales' },
      { id: 'd2', name: 'Warehouse' },
      { id: 'd3', name: 'Finance', company: 'Delkor-Fiberk Group' },
      { id: 'd4', name: 'HR', company: 'Delkor-Fiberk Group' },
    ],
    desigs: [{ id: 'g1', name: 'Shop lead' }, { id: 'g2', name: 'Storekeeper' }, { id: 'g3', name: 'Accountant' }, { id: 'g4', name: 'Officer' }, { id: 'g5', name: 'Group HR' }],
    targets: [],
    components: [],
    payrolls: [],
    mine: [],
    users: [],
  });
  try { localStorage.setItem(FLAG, '1'); } catch { /* ignore */ }
}
function load() { seed(); return readLs(KEY, {}); }
function save(d) { writeLs(KEY, d); }
function tab() {
  const t = new URLSearchParams(location.search).get('tab') || 'dash';
  if (t === 'mypay') return 'mypay';
  if (t === 'induction') return 'induction';
  return resolveHubTab(t, TABS, 'dash', nestsFor(FILE));
}
function go(t) { goFile(FILE, (t === 'dash' || !t) ? '' : t); paint(); }
function nav(on) { return floorNav(BRAND, on, 'dash', FILE); }

async function paintDash(app) {
  try { await ensureBankBooks(); } catch { /* statement pack is enough */ }
  const d = load();
  const todayB = (d.users || []).filter((u) => u.dob && u.dob.slice(5) === '09-04');
  const upB = (d.users || []).filter((u) => u.dob && u.dob.slice(5) !== '09-04');
  app.innerHTML = `
    ${nav('dash')}

    ${fiberkHrmCard()}
    <div class="hrm-top">
      <div class="ult-card"><strong>${svgIco('leaf')} My leaves</strong>
        ${(d.leaves || []).map((l) =>
          `<p>${esc(l.type)} · ${esc(l.from)} → ${esc(l.to)} · ${esc(l.status)}</p>`).join('') || '<p class="ult-muted">No data</p>'}</div>
      <div class="ult-card"><strong>${svgIco('target')} My sales targets</strong>
        <div class="hrm-tgt"><div><span class="ult-muted">Target achieved last month:</span><b class="ok">${fmt((d.targets || [])[0]?.last || 0)}</b></div>
        <div><span class="ult-muted">Target achieved this month:</span><b class="ok">${fmt((d.targets || [])[0]?.thisM || 0)}</b></div></div>
        <table class="ult-table"><thead><tr><th>Targets</th><th>Commission Percent</th></tr></thead>
        <tbody><tr><td>GHS sales</td><td>${(d.targets || [])[0]?.commission || 0}%</td></tr></tbody></table>
      </div>
      <div>
        <div class="ult-card"><strong>${svgIco('cake')} Birthdays</strong>
          <p class="ult-muted">Today</p>${todayB.map((u) => `<p>${esc(u.name)}${u.office ? ' · ' + esc(u.office) : ''}</p>`).join('') || '<p class="ult-muted">No data</p>'}
          <p class="ult-muted">Upcoming</p>${upB.map((u) => `<p>${esc(u.name)} · ${esc(u.dob)}${u.office ? ' · ' + esc(u.office) : ''}</p>`).join('') || '<p class="ult-muted">No data</p>'}
        </div>
        <button type="button" class="hrm-mypay" id="my-pay">${svgIco('doc')} My Payrolls</button>
      </div>
    </div>
    <hr class="crm-rule" />
    <div class="hrm-mid">
      ${todayBlock(`${svgIco('users')} Users`, todayB.map((u) => u.name + (u.office ? ' · ' + u.office : '')), upB.map((u) => u.name + ' · ' + u.dob + (u.office ? ' · ' + u.office : '')))}
      ${todayBlock(`${svgIco('user')} Leaves`, (d.leaves || []).filter((l) => l.from === '2026-09-04').map((l) => l.staff + ' · ' + l.type),
        (d.leaves || []).filter((l) => l.from > '2026-09-04').map((l) => l.staff + ' · ' + l.from))}
      ${todayBlock(`${svgIco('lock')} Holidays`, (d.holidays || []).filter((h) => h.date === '2026-09-04').map((h) => h.name),
        (d.holidays || []).filter((h) => h.date > '2026-09-04').map((h) => h.name + ' · ' + h.date))}
    </div>
    <div class="hrm-bot">
      <div class="ult-card"><strong>${svgIco('user')} Today's Attendance</strong>
        <style>
          tr.att-late td { background:#fef9c3; }
          tr.att-absent td { background:#fee2e2; }
          .pill.att-y { background:#fde68a; color:#92400e; font-weight:800; }
          .pill.att-r { background:#fecaca; color:#991b1b; font-weight:800; }
        </style>
        <table class="ult-table"><thead><tr><th>Employee</th><th>Office</th><th>Status</th><th>In</th><th>Hours</th></tr></thead>
        <tbody>${(todayBoard()).map((a) => `<tr class="${a.status === 'late' ? 'att-late' : a.status === 'absent' ? 'att-absent' : ''}">
          <td>${esc(a.name)}</td><td>${esc(a.office || '—')}</td>
          <td>${a.status === 'late' ? '<span class="pill att-y">late</span>' : a.status === 'absent' ? '<span class="pill att-r">absent</span>' : '<span class="pill paid">present</span>'}</td>
          <td>${esc(a.inHm || '—')}</td>
          <td>${a.hours == null ? '—' : a.hours}</td>
        </tr>`).join('') || emptyRow(5)}</tbody></table>
      </div>
      <div class="ult-card" data-tbl="st">
        <strong>${svgIco('target')} Sales targets</strong>
        ${tableBar()}
        <table class="ult-table"><thead><tr><th>User</th><th>Target achieved last month</th><th>Target achieved this month</th></tr></thead>
        <tbody>${(d.targets || []).map((t) => `<tr><td>${esc(t.user)}</td><td>${fmt(t.last)}</td><td>${fmt(t.thisM)}</td></tr>`).join('') || emptyRow(3, 'No data available in table')}</tbody></table>
        ${tableFoot()}
      </div>
    </div>`;
  bindHubTabs(app, go);
  bindTable(app.querySelector('[data-tbl="st"]'), { title: 'Sales targets', storageKey: 'hrm-st' });
  app.querySelector('#my-pay').onclick = () => go('mypay');
}

function todayBlock(title, today, upcoming) {
  return `<div class="ult-card"><strong>${title}</strong>
    <p class="ult-muted">Today</p>${today.length ? today.map((t) => `<p>${esc(t)}</p>`).join('') : '<p class="ult-muted">No data</p>'}
    <p class="ult-muted">Upcoming</p>${upcoming.length ? upcoming.map((t) => `<p>${esc(t)}</p>`).join('') : '<p class="ult-muted">No data</p>'}
  </div>`;
}


function attRowClass(status) {
  if (status === 'late') return 'att-late';
  if (status === 'absent') return 'att-absent';
  return '';
}
function attPill(status) {
  if (status === 'late') return '<span class="pill att-y">late</span>';
  if (status === 'absent') return '<span class="pill att-r">absent</span>';
  if (status === 'pending') return '<span class="pill">pending</span>';
  if (status === 'off') return '<span class="pill">exempt</span>';
  return '<span class="pill paid">present</span>';
}

function paintAttendance(app, on) {
  const day = new Intl.DateTimeFormat('en-CA', { timeZone: 'Africa/Accra', year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date());
  const pol = policyHours();
  let rows = todayBoard();
  if (!rows.length) {
    const punches = attendanceRows([]);
    rows = punches.map((p) => ({
      name: p.staff, office: p.office, status: p.in ? 'present' : 'absent', inHm: p.in, hours: p.in ? pol.hoursDay : 0, weekPct: '', rating: '',
    }));
  }
  const nP = rows.filter((r) => r.status === 'present').length;
  const nL = rows.filter((r) => r.status === 'late').length;
  const nA = rows.filter((r) => r.status === 'absent').length;
  app.innerHTML = `${nav(on)}<h1 class="hub-h1">Time</h1>
    <p class="sub">${esc(day)} Ghana · start ${esc(pol.start)} · ${pol.hoursDay} h day. Yellow = late (minutes come off the day). Red = absent (zero hours).</p>
    <style>
      tr.att-late td { background:#fef9c3; }
      tr.att-absent td { background:#fee2e2; }
      .pill.att-y { background:#fde68a; color:#92400e; font-weight:800; }
      .pill.att-r { background:#fecaca; color:#991b1b; font-weight:800; }
    </style>
    <div class="pp-kpis" style="display:grid;grid-template-columns:repeat(3,minmax(120px,1fr));gap:10px;margin:0 0 14px">
      <article class="ult-card"><span>Present</span><b>${nP}</b></article>
      <article class="ult-card" style="background:#fef9c3"><span>Late</span><b>${nL}</b></article>
      <article class="ult-card" style="background:#fee2e2"><span>Absent</span><b>${nA}</b></article>
    </div>
    <div class="ult-card">
      <table class="ult-table"><thead><tr>
        <th>Employee</th><th>Office</th><th>Status</th><th>In</th><th>Hours today</th><th>Week attendance</th><th>Rating</th>
      </tr></thead>
      <tbody>${rows.map((r) => `<tr class="${attRowClass(r.status)}">
        <td>${esc(r.name || r.full_name || r.email)}</td>
        <td>${esc(r.office || '—')}</td>
        <td>${attPill(r.status)}</td>
        <td>${esc(r.inHm || '—')}</td>
        <td>${r.hours == null ? '—' : r.hours + ' / ' + (r.expected || pol.hoursDay)}</td>
        <td>${r.weekPct === '' || r.weekPct == null ? '—' : r.weekPct + '%'}</td>
        <td>${r.rating === '' || r.rating == null ? '—' : r.rating + '%'}</td>
      </tr>`).join('') || `<tr><td colspan="7" style="text-align:center">No staff list yet</td></tr>`}</tbody>
      </table>
    </div>`;
  bindHubTabs(app);
}

function simpleList(app, on, title, cols, html, add) {
  app.innerHTML = `${nav(on)}<h1 class="hub-h1">${title}</h1>
    <div class="ult-card">
      <div class="ss-head"><strong>${title}</strong>${add ? `<button type="button" class="ult-btn ult-btn-primary" id="add">+ Add</button>` : ''}</div>
      <table class="ult-table"><thead><tr>${cols.map((c) => `<th>${c}</th>`).join('')}</tr></thead>
      <tbody>${html}</tbody></table>
    </div>`;
  bindHubTabs(app, go);
  if (add) app.querySelector('#add').onclick = add;
}

function paintMyPay(app, payrolls) {
  const who = window.__df_hrm_who || {};
  const email = String(who.email || '').toLowerCase();
  const name = String(who.name || '').toLowerCase();
  const mine = (payrolls || []).filter((p) => {
    if (email && String(p.employee_email || '').toLowerCase() === email) return true;
    if (name && String(p.employee_name || '').toLowerCase() === name) return true;
    return false;
  });
  const d = load();
  const pane = new URLSearchParams(location.search).get('pane') === 'all' ? 'all' : 'comp';
  app.innerHTML = `${nav('mypay')}
    <h1 class="hub-h1">My Payrolls</h1>
    <p class="sub">Your payslips from the HRM payroll book. Same runs Accounting maps to Payroll Expenses.</p>
    <div class="ult-card">
      ${innerTabs([
        { key: 'comp', href: '/hrm.html?tab=mypay', label: `${svgIco('target')} Pay Components` },
        { key: 'all', href: '/hrm.html?tab=mypay&pane=all', label: `${svgIco('doc')} All Payrolls` },
      ], pane)}
      ${pane === 'comp' ? `<table class="ult-table">
        <thead><tr><th>Description</th><th>Type</th><th>Amount</th><th>Applicable Date</th></tr></thead>
        <tbody>${(d.components || []).map((c) => `<tr><td>${esc(c.desc)}</td><td>${esc(c.type)}</td><td>${fmt(c.amount)}</td><td>${esc(c.from)}</td></tr>`).join('') || emptyRow(4, 'No data found')}</tbody>
      </table>` : `<div data-tbl="pr">${tableBar()}
        <table class="ult-table"><thead><tr><th>Month/Year</th><th>Reference No</th><th>Total amount</th><th>Payment Status</th><th></th></tr></thead>
        <tbody>${mine.map((p) => `<tr><td>${esc(p.month)}</td><td>${esc(p.ref_no)}</td><td>${fmt(p.net_pay)}</td><td>${esc(p.status)}</td><td><a class="ult-btn ult-btn-outline ult-btn-sm" href="/hrm.html?tab=payroll&id=${encodeURIComponent(p.id)}">View</a></td></tr>`).join('') || emptyRow(5, 'No payrolls on this book yet')}</tbody></table>
        ${tableFoot()}</div>`}
    </div>`;
  bindHubTabs(app, go);
  app.querySelectorAll('[data-pane]').forEach((a) => {
    a.onclick = (e) => {
      e.preventDefault();
      e.stopPropagation();
      const path = a.dataset.pane === 'all' ? '/hrm.html?tab=mypay&pane=all' : '/hrm.html?tab=mypay';
      history.pushState({ spa: path }, '', path);
      paint();
    };
  });
  const tbl = app.querySelector('[data-tbl="pr"]');
  if (tbl) bindTable(tbl, { title: 'Payrolls', storageKey: 'hrm-pr' });
}

/**
 * SSNIT shortfall on rows saved before the deduction was calculated.
 * Read-only: posted payroll is never rewritten, so the arrears can be settled
 * separately without disturbing what Accounting already mapped.
 */
function arrearsBanner(rows) {
  const a = snnitArrears(rows);
  if (!a.count) return '';
  const lines = a.lines.slice(0, 8).map((l) => `<tr>
      <td>${esc(l.employee_name || '—')}</td>
      <td>${esc(l.month || '—')}</td>
      <td>${esc(l.ref_no || '—')}</td>
      <td>${fmt(l.basic)}</td>
      <td>${fmt(l.short_employee)}</td>
      <td>${fmt(l.short_employer)}</td>
    </tr>`).join('');
  return `<div class="ult-card ult-alert" style="margin-bottom:14px">
    <strong>SSNIT arrears on ${a.count} payroll ${a.count === 1 ? 'row' : 'rows'}</strong>
    <p style="margin:6px 0 10px">These were filed before the deduction was calculated. Employee 5.5% owed
      <b>${fmt(a.total_employee)}</b>, employer 13% owed <b>${fmt(a.total_employer)}</b>,
      total <b>${fmt(a.total)}</b>. Filed payroll is left exactly as posted — settle the arrears
      separately rather than restating the runs.</p>
    <div class="ult-table-wrap"><table class="ult-table">
      <thead><tr><th>Employee</th><th>Month</th><th>Reference</th><th>Basic</th><th>Employee 5.5%</th><th>Employer 13%</th></tr></thead>
      <tbody>${lines}</tbody>
    </table></div>
    ${a.count > 8 ? `<p class="ult-muted" style="margin:8px 0 0">Showing 8 of ${a.count}. Export the payroll table for the full list.</p>` : ''}
  </div>`;
}

async function paintPayroll(app) {
  const q = new URLSearchParams(location.search);
  const editId = q.get('id');
  const [rows, staff] = await Promise.all([loadPayrolls(), listStaff()]);
  const edit = editId ? rows.find((r) => String(r.id) === String(editId)) : null;
  const adding = q.get('add') === '1' || !!edit;
  const who = window.__df_hrm_who || {};

  const staffOpts = staff.map((s) => {
    const sel = edit && (String(edit.employee_email) === s.email || String(edit.employee_name) === s.name);
    return `<option value="${esc(s.email || s.id)}" data-name="${esc(s.name)}" data-office="${esc(s.office || '')}" data-sub="${esc(s.subsidiary_code || '')}" data-loc="${esc(s.location_code || '')}" ${sel ? 'selected' : ''}>${esc(s.name)}${s.email ? ' · ' + esc(s.email) : ''}</option>`;
  }).join('');

  app.innerHTML = `${nav('payroll')}<h1 class="hub-h1">Payroll</h1>
    <p class="sub">Ghana run: SNNIT employee 5.5% / employer 13% of basic. Paying posts <b>Payroll Expenses</b> and lands on Accounting → Transactions → Payroll so you can map the accounts.</p>
    <div class="bar" style="margin-bottom:12px">
      <button type="button" class="ult-btn ult-btn-primary" id="pay-add">+ Add payroll</button>
      <a class="ult-btn ult-btn-outline" href="/accounting-transactions.html?tab=payroll">Accounting map</a>
      <a class="ult-btn ult-btn-outline" href="/snnit.html">SNNIT</a>
    </div>
    ${adding ? `<form id="pay-form" class="ult-card" style="margin-bottom:16px">
      <h2 style="margin:0 0 10px;font-size:16px">${edit ? 'Edit' : 'Add'} payroll ${edit?.ref_no ? '· ' + esc(edit.ref_no) : ''}</h2>
      ${staff.length ? '' : '<p class="ult-muted">No staff on file. Add people under System → Users first.</p>'}
      <div class="doc-grid">
        <label>Pay type
          <select id="p-type">
            <option value="salary" ${(edit?.pay_type || 'salary') === 'salary' ? 'selected' : ''}>Full salary (no commission)</option>
            <option value="commission" ${edit?.pay_type === 'commission' ? 'selected' : ''}>Commission only (paid direct, no SSNIT)</option>
            <option value="salary_commission" ${edit?.pay_type === 'salary_commission' ? 'selected' : ''}>Salary + commission</option>
          </select>
        </label>
        <label>Employee
          <select id="p-emp" ${staff.length ? '' : 'disabled'} required>
            <option value="">Select staff</option>${staffOpts}
          </select>
        </label>
        <label>Period start <input id="p-a" type="date" value="${esc(edit?.period_start || periodStartOf(todayYmd()))}" required /></label>
        <label>Period end <input id="p-b" type="date" value="${esc(edit?.period_end || todayYmd())}" required /></label>
        <label>Basic (GHS) <input id="p-basic" type="number" min="0" step="0.01" value="${esc(edit?.basic || 0)}" /></label>
        <label>Allowance <input id="p-al" type="number" min="0" step="0.01" value="${esc(edit?.allowance || 0)}" /></label>
        <label>Other deduction <input id="p-de" type="number" min="0" step="0.01" value="${esc(edit?.deduction || 0)}" /></label>
        <label>Sales in period (target slab) <input id="p-sales" type="number" min="0" step="0.01" value="0" /></label>
        <label>Note <input id="p-n" value="${esc(edit?.note || '')}" /></label>
      </div>
      <p class="ult-muted" id="p-preview"></p>
      <p id="p-slabwarn" class="ult-alert" style="display:none;padding:9px 12px;border:1px solid;border-radius:8px;margin:8px 0 0;font-size:13px"></p>
      <p style="display:flex;gap:8px;flex-wrap:wrap;margin-top:10px">
        <button type="submit" class="ult-btn ult-btn-primary" ${staff.length ? '' : 'disabled'}>Save draft</button>
        <button type="button" class="ult-btn" id="p-pay" ${staff.length ? '' : 'disabled'}>Save and pay</button>
        <a class="ult-btn ult-btn-outline" href="/hrm.html?tab=payroll">Cancel</a>
      </p>
    </form>` : ''}
    ${arrearsBanner(rows)}
    <div class="ult-card" data-tbl="pay">
      <div class="ss-head"><strong>All payrolls</strong></div>
      ${tableBar()}
      <div class="ult-table-wrap"><table class="ult-table">
        <thead><tr>
          <th data-nosort="1">Action</th>
          <th>Employee</th><th>Office</th><th>Month/Year</th><th>Reference</th>
          <th>Basic</th><th>SNNIT emp</th><th>Net</th><th>Status</th>
        </tr></thead>
        <tbody>${rows.map((p) => `<tr data-id="${esc(p.id)}">
          <td>${actMenu(p.id, [
            { href: `/hrm.html?tab=payroll&id=${encodeURIComponent(p.id)}`, label: 'Edit' },
            { href: `/accounting-map-form.html?type=payroll&id=${encodeURIComponent(p.id)}`, label: 'Map accounts' },
            ...(String(p.status) === 'paid' ? [] : [{ act: 'pay', label: 'Mark paid' }]),
          ])}</td>
          <td>${esc(p.employee_name)}</td>
          <td>${esc(p.office || p.company || '—')}</td>
          <td>${esc(p.month)}</td>
          <td>${esc(p.ref_no)}</td>
          <td>${fmt(p.basic)}</td>
          <td>${fmt(p.snnit_employee)}</td>
          <td>${fmt(p.net_pay)}</td>
          <td>${esc(p.status)}</td>
        </tr>`).join('') || emptyRow(9, 'No payroll yet. Add a run or map a salary expense in Accounting.')}</tbody>
      </table></div>
      ${tableFoot()}
    </div>`;
  bindHubTabs(app, go);
  bindTable(app.querySelector('[data-tbl="pay"]'), { title: 'Payroll', storageKey: 'hrm-pay', table: 'hrm_payroll', key: 'df_hrm_payroll', onDone: paint });
  document.getElementById('pay-add')?.addEventListener('click', () => {
    history.pushState({ spa: '/hrm.html?tab=payroll&add=1' }, '', '/hrm.html?tab=payroll&add=1');
    paint();
  });

  /**
   * Pay type governs which inputs mean anything. A commission-only earner is
   * paid direct on sales, so basic, allowance, deduction and SSNIT do not
   * apply — those inputs are disabled and zeroed rather than left to be filled
   * in and silently dropped. A salaried worker has no sales slab.
   */
  const payType = () => document.getElementById('p-type')?.value || 'salary';

  function applyPayType() {
    const kind = payType();
    const salaried = kind === 'salary' || kind === 'salary_commission';
    const earnsCommission = kind === 'commission' || kind === 'salary_commission';
    const set = (id, on, hint) => {
      const el = document.getElementById(id);
      if (!el) return;
      el.disabled = !on;
      el.title = on ? '' : hint;
      const box = el.closest('label');
      if (box) box.style.opacity = on ? '' : '.45';
      if (!on) el.value = '0';
    };
    set('p-basic', salaried, 'Commission-only staff have no basic salary');
    set('p-al', salaried, 'Commission-only staff have no allowance');
    set('p-de', salaried, 'Commission-only staff are paid direct, with no deductions');
    set('p-sales', earnsCommission, 'Salaried staff earn no sales commission');
    preview();
  }

  const preview = () => {
    const el = document.getElementById('p-preview');
    if (!el) return {};
    const kind = payType();
    const salaried = kind === 'salary' || kind === 'salary_commission';
    const earnsCommission = kind === 'commission' || kind === 'salary_commission';
    const run = computeRun({
      basic: salaried ? document.getElementById('p-basic')?.value : 0,
      allowance: salaried ? document.getElementById('p-al')?.value : 0,
      deduction: salaried ? document.getElementById('p-de')?.value : 0,
      sales: earnsCommission ? document.getElementById('p-sales')?.value : 0,
      /* no statutory deduction on a direct commission payout */
      snnit: salaried,
    });
    el.textContent = salaried
      ? `Commission ${fmt(run.cmsn)} · SSNIT employee ${fmt(run.sn.employee)} / employer ${fmt(run.sn.employer)} · Net ${fmt(run.net)}`
      : `Commission ${fmt(run.cmsn)} · no SSNIT on a direct payout · Net ${fmt(run.net)}`;

    /* Misconfigured slabs used to pay zero in silence — worst on a
       commission-only run, where the whole wage comes from the slab. */
    const warn = document.getElementById('p-slabwarn');
    if (warn) {
      const problems = earnsCommission ? (run.slabProblems || []) : [];
      warn.style.display = problems.length ? '' : 'none';
      warn.innerHTML = problems.length
        ? `<strong>Commission slabs need attention${kind === 'commission' ? ' — this run pays commission only' : ''}:</strong><br />${problems.map(esc).join('<br />')}`
        : '';
    }
    return run;
  };
  ['p-basic', 'p-al', 'p-de', 'p-sales'].forEach((id) => {
    document.getElementById(id)?.addEventListener('input', preview);
  });
  document.getElementById('p-type')?.addEventListener('change', applyPayType);
  applyPayType();

  async function gather(status) {
    const sel = document.getElementById('p-emp');
    const opt = sel?.selectedOptions?.[0];
    if (!sel?.value) { ackResult(false, 'Pick an employee.'); return null; }
    const run = preview();
    const start = document.getElementById('p-a').value;
    const end = document.getElementById('p-b').value;
    return {
      id: edit?.id,
      ref_no: edit?.ref_no || await nextRef(),
      employee_email: sel.value,
      employee_name: opt?.dataset.name || opt?.textContent || sel.value,
      office: opt?.dataset.office || '',
      subsidiary_code: opt?.dataset.sub || '',
      location_code: opt?.dataset.loc || '',
      location_name: opt?.dataset.office || '',
      pay_type: payType(),
      period_start: start,
      period_end: end,
      month: monthLabel(end || start),
      basic: run.basic,
      allowance: Number(document.getElementById('p-al').value) || 0,
      deduction: Number(document.getElementById('p-de').value) || 0,
      sales_target_commission: run.cmsn,
      snnit_employee: run.sn.employee,
      snnit_employer: run.sn.employer,
      net_pay: run.net,
      status,
      note: document.getElementById('p-n').value.trim(),
      created_by: who.email || '',
      source: edit?.source || 'hrm',
    };
  }

  document.getElementById('pay-form')?.addEventListener('submit', async (e) => {
    e.preventDefault();
    const body = await gather('draft');
    if (!body) return;
    if (!(await confirmAction('Save this payroll draft?', body.ref_no))) return;
    await savePayroll(body);
    ackResult(true, 'Draft saved on the HRM payroll book.');
    history.pushState({ spa: '/hrm.html?tab=payroll' }, '', '/hrm.html?tab=payroll');
    paint();
  });
  document.getElementById('p-pay')?.addEventListener('click', async () => {
    const body = await gather('paid');
    if (!body) return;
    if (!(await confirmAction('Pay this run?', 'Posts Payroll Expenses and opens it for account mapping.'))) return;
    const saved = await postPaid(body, who.email || '');
    ackResult(true, (saved.ref_no || 'Payroll') + ' paid · mapped to Payroll Expenses.');
    history.pushState({ spa: '/hrm.html?tab=payroll' }, '', '/hrm.html?tab=payroll');
    paint();
  });
  app.querySelectorAll('[data-act="pay"]').forEach((b) => {
    b.onclick = async (e) => {
      e.preventDefault();
      const row = rows.find((r) => String(r.id) === String(b.dataset.id));
      if (!row) return;
      if (!(await confirmAction('Mark this payroll paid?', row.ref_no))) return;
      await postPaid(row, who.email || '');
      ackResult(true, 'Paid and posted to Payroll Expenses.');
      paint();
    };
  });
}

function inductionPane() {
  const p = new URLSearchParams(location.search).get('pane');
  return INDUCTION_PANES.some((x) => x.key === p) ? p : 'orient';
}

function paintInduction(app) {
  const pane = inductionPane();
  const sessionEmail = (window.__df_hrm_who || '').email || '';
  const sessionName = (window.__df_hrm_who || '').name || '';
  const welcomeDone = (() => { try { return JSON.parse(localStorage.getItem('df_welcome_pack') || '{}'); } catch { return {}; } })();
  const trainDone = (() => { try { return JSON.parse(localStorage.getItem('df_training_progress') || '{}'); } catch { return {}; } })();
  const pending = listPending();
  const inner = innerTabs(INDUCTION_PANES.map((p) => ({
    key: p.key,
    href: `/hrm.html?tab=induction&pane=${p.key}`,
    label: p.label,
  })), pane);
  let body = '';
  if (pane === 'welcome') body = welcomeBody(sessionName, sessionEmail, welcomeDone);
  else if (pane === 'train') body = `<div class="or-card"><h2>Staff classroom</h2><p>Curriculum for every new staff member. Completions save on this device.</p></div>${trainingBody(trainDone)}`;
  else body = `${orientationBody()}
    <div class="or-card"><h2>Registrations waiting</h2>
      <p>${pending.length ? pending.map((u) => `${u.full_name || u.email} · ${u.status || 'pending'}`).join('<br/>') : 'No pending registrations.'}</p>
    </div>`;
  app.innerHTML = `${nav('induction')}
    <h1 class="hub-h1">Staff induction</h1>
    <div class="ult-card">
      ${inner}
      <div class="or-wrap" style="max-width:none;margin:0">${body}</div>
    </div>`;
  bindHubTabs(app, go);
  app.querySelectorAll('[data-pane]').forEach((a) => {
    a.onclick = (e) => {
      e.preventDefault();
      e.stopPropagation();
      history.pushState({ spa: a.getAttribute('href') }, '', a.getAttribute('href'));
      paint();
    };
  });
  app.querySelectorAll('[data-welcome]').forEach((el) => {
    el.onchange = () => {
      const cur = welcomeDone;
      cur[el.dataset.welcome] = el.checked;
      localStorage.setItem('df_welcome_pack', JSON.stringify(cur));
    };
  });
  app.querySelectorAll('[data-toggle-mod]').forEach((btn) => {
    btn.onclick = () => btn.closest('.mod')?.classList.toggle('open');
  });
  app.querySelectorAll('[data-train]').forEach((btn) => {
    btn.onclick = () => {
      trainDone[btn.dataset.train] = true;
      localStorage.setItem('df_training_progress', JSON.stringify(trainDone));
      paint();
    };
  });
}

function ymd(iso) {
  const m = String(iso || '').match(/^(\d{4})-(\d{2})-(\d{2})/);
  return m ? `${m[3]}/${m[2]}/${m[1]}` : String(iso || '');
}

function empPill(e) {
  if (e.employment === 'present' || e.status === 'active') return '<span class="fo-st fo-st-normal">Present</span>';
  return '<span class="fo-st fo-st-finished">Past</span>';
}

function srcLabel(e) {
  if (e.source === 'uba-statement') return 'UBA only';
  if (e.source === 'fiberkapp') return e.allow_login === false ? 'Fiberkapp · login off' : 'Fiberkapp';
  return e.source || '—';
}

async function paintPeople(app) {
  await ensureFiberkHrm();
  const q = new URLSearchParams(location.search);
  const who = q.get('who') || 'all';
  const x = fiberkEmployeeMetrics();
  const recon = salaryRecon();
  const paidBy = new Map(recon.people.map((p) => [p.id, p]));
  let rows = fiberkEmployees().slice().sort((a, b) => {
    const pa = paidBy.get(a.id)?.paid || 0;
    const pb = paidBy.get(b.id)?.paid || 0;
    const rank = (e, paid) => (e.employment === 'present' ? 0 : paid > 0 ? 1 : 2);
    const d = rank(a, pa) - rank(b, pb);
    if (d) return d;
    if (pb !== pa) return pb - pa;
    return String(a.name || '').localeCompare(String(b.name || ''));
  });
  if (who === 'present') rows = rows.filter((e) => e.employment === 'present');
  if (who === 'past') rows = rows.filter((e) => e.employment === 'past');
  if (who === 'uba') rows = rows.filter((e) => e.source === 'uba-statement');
  if (who === 'named') rows = rows.filter((e) => Number(paidBy.get(e.id)?.paid || 0) > 0);
  const chips = [
    ['all', `All ${x.n}`],
    ['present', `Present ${x.present}`],
    ['past', `Past ${x.past}`],
    ['named', `UBA named ${recon.people.filter((p) => p.paid > 0).length}`],
    ['uba', `UBA only ${x.uba_only}`],
  ];
  function hrefWho(k) {
    return k === 'all' ? FILE + '?tab=people' : FILE + '?tab=people&who=' + k;
  }
  app.innerHTML = `${nav('people')}
    <div class="acc-top"><div>
      <h1 class="hub-h1">People</h1>
      ${fiberkHrmBanner()}
      ${siloGateHtml('people', x.n)}
    </div></div>
    <div class="fo-ol-kpis" style="grid-template-columns:repeat(4,minmax(0,1fr))">
      <article><span>Present</span><b>${x.present}</b></article>
      <article><span>Past</span><b>${x.past}</b></article>
      <article><span>Fiberkapp users</span><b>${x.fiberkapp}</b></article>
      <article><span>UBA-only past</span><b>${x.uba_only}</b></article>
    </div>
    <div class="fo-ol-chips" style="margin:0 0 14px">
      ${chips.map(([k, lab]) => `<a class="fo-chip ${who === k ? 'on' : ''}" href="${hrefWho(k)}" data-who="${k}">${esc(lab)}</a>`).join('')}
    </div>
    <div class="ult-card" data-tbl="people">
      <div class="ss-head"><strong>Staff roster</strong>
        <span class="ult-muted">${rows.length} showing · SA ₵100 field commission is not payroll</span></div>
      ${tableBar()}
      <div class="ult-table-wrap"><table class="ult-table">
        <thead><tr>
          <th>Name</th><th>Username</th><th>Role</th><th>Subsidiary</th><th>Business Location</th><th>Department</th>
          <th>Status</th><th>Source</th><th>Contact</th><th>Email</th>
          <th>UBA paid</th><th>Months</th>
        </tr></thead>
        <tbody>${rows.map((e) => {
          const p = paidBy.get(e.id) || {};
          return `<tr>
            <td><b>${esc(e.name)}</b></td>
            <td>${esc(e.username || '—')}</td>
            <td>${esc(e.role || '—')}</td>
            <td>${esc(chainOf(e).subsidiary)}</td>
            <td>${esc(chainOf(e).location !== '—' ? chainOf(e).location : (e.office || e.location_name || '—'))}</td>
            <td>${esc(chainOf(e).department !== '—' ? chainOf(e).department : (e.department || '—'))}</td>
            <td>${empPill(e)}</td>
            <td>${esc(srcLabel(e))}</td>
            <td>${esc(e.contact || '—')}</td>
            <td>${esc(e.email || '—')}</td>
            <td class="num">${p.paid ? cedi(p.paid) : '—'}</td>
            <td>${esc((p.months || []).join(', ') || '—')}</td>
          </tr>`;
        }).join('') || emptyRow(11, 'No people on this filter.')}</tbody>
      </table></div>
      ${tableFoot()}
    </div>`;
  bindHubTabs(app, go);
  bindTable(app.querySelector('[data-tbl="people"]'), { title: 'People', storageKey: 'hrm-people' });
  app.querySelectorAll('[data-who]').forEach((a) => {
    a.onclick = (e) => {
      e.preventDefault();
      const path = a.getAttribute('href');
      history.pushState({ spa: path }, '', path);
      paint();
    };
  });
}

async function paintBankPay(app) {
  await ensureFiberkHrm();
  await ensureBankBooks();
  const q = new URLSearchParams(location.search);
  const month = q.get('month') || '';
  const pane = q.get('pane') === 'people' ? 'people' : 'lines';
  const chip = q.get('chip') || 'all';
  const recon = salaryRecon(month);
  const bank = payrollRecon(month);
  let lines = recon.rows.slice();
  if (chip === 'named') lines = lines.filter((r) => r.matched);
  if (chip === 'unnamed') lines = lines.filter((r) => !r.matched);
  if (chip === 'present') lines = lines.filter((r) => r.employment === 'present');
  if (chip === 'past') lines = lines.filter((r) => r.employment === 'past');
  const paidPeople = recon.people.filter((p) => p.paid > 0);
  const chips = [
    ['all', `All ${recon.rows.length}`],
    ['named', `Named ${recon.named}`],
    ['unnamed', `Unnamed ${recon.unnamed}`],
    ['present', 'Present'],
    ['past', 'Past'],
  ];
  function hrefChip(k) {
    const p = new URLSearchParams();
    p.set('tab', 'bankpay');
    if (month) p.set('month', month);
    if (pane !== 'lines') p.set('pane', pane);
    if (k && k !== 'all') p.set('chip', k);
    return FILE + '?' + p.toString();
  }
  app.innerHTML = `${nav('bankpay')}
    <div class="acc-top"><div>
      <h1>Bank Salary</h1>
      <p class="sub">UBA Fiberk ODA salary lines matched to the Fiberkapp roster (present + past). Named lines post to the person. Unnamed “Payment of … Salary” stays unmatched — we do not guess by amount. Rent and SA ₵100 field commission are not payroll.</p>
    </div>
      <input id="pay-month" type="month" value="${esc(month)}" />
    </div>
    ${fiberkHrmBanner()}
    <div class="fo-ol-kpis" style="grid-template-columns:repeat(4,minmax(0,1fr))">
      <article><span>Named lines</span><b>${recon.named}</b></article>
      <article><span>Unnamed lines</span><b>${recon.unnamed}</b></article>
      <article><span>Named paid</span><b>${cedi(recon.named_paid)}</b></article>
      <article><span>Unnamed paid</span><b>${cedi(recon.unnamed_paid)}</b></article>
    </div>
    <div class="ult-kpis">
      <div class="ult-kpi"><div class="ult-kpi-body"><div class="ult-kpi-label">Present paid</div><div class="ult-kpi-value">${cedi(recon.present_paid)}</div></div></div>
      <div class="ult-kpi"><div class="ult-kpi-body"><div class="ult-kpi-label">Past paid</div><div class="ult-kpi-value">${cedi(recon.past_paid)}</div></div></div>
      <div class="ult-kpi"><div class="ult-kpi-body"><div class="ult-kpi-label">Statement salary</div><div class="ult-kpi-value">${cedi(recon.paid)}</div></div></div>
      <div class="ult-kpi"><div class="ult-kpi-body"><div class="ult-kpi-label">Book status</div><div class="ult-kpi-value">${esc(bank.status)}</div></div></div>
    </div>
    ${innerTabs([
      { key: 'lines', href: FILE + '?tab=bankpay' + (month ? '&month=' + encodeURIComponent(month) : ''), label: 'Statement lines' },
      { key: 'people', href: FILE + '?tab=bankpay&pane=people' + (month ? '&month=' + encodeURIComponent(month) : ''), label: 'By person' },
    ], pane)}
    ${pane === 'people' ? `<div class="ult-card" data-tbl="paypeople">
      <div class="ss-head"><strong>Named on the statement</strong>
        <span class="ult-muted">${paidPeople.length} of ${recon.people.length} people</span></div>
      ${tableBar()}
      <div class="ult-table-wrap"><table class="ult-table">
        <thead><tr><th>Employee</th><th>Status</th><th>Source</th><th>Office</th><th>Lines</th><th>Paid</th><th>Months</th></tr></thead>
        <tbody>${paidPeople.map((e) => `<tr>
          <td><b>${esc(e.name)}</b></td>
          <td>${empPill(e)}</td>
          <td>${esc(srcLabel(e))}</td>
          <td>${esc(e.office || e.location_name || '—')}</td>
          <td class="num">${e.lines}</td>
          <td class="num">${cedi(e.paid)}</td>
          <td>${esc((e.months || []).join(', '))}</td>
        </tr>`).join('') || emptyRow(7, 'No named salary lines on this month.')}</tbody>
      </table></div>
      ${tableFoot()}
    </div>` : `<div class="fo-ol-chips" style="margin:0 0 14px">
      ${chips.map(([k, lab]) => `<a class="fo-chip ${chip === k ? 'on' : ''}" href="${hrefChip(k)}" data-chip="${k}">${esc(lab)}</a>`).join('')}
    </div>
    <div class="ult-card" data-tbl="bankpay">
      <div class="ss-head"><strong>UBA salary lines</strong></div>
      ${tableBar()}
      <div class="ult-table-wrap"><table class="ult-table">
        <thead><tr><th>Date</th><th>Employee</th><th>Status</th><th>Description</th><th>Amount</th><th>Month</th><th>Match</th></tr></thead>
        <tbody>${lines.map((t) => `<tr>
          <td>${esc(ymd(t.date))}</td>
          <td>${t.matched ? `<b>${esc(t.employee_name)}</b>` : '<span class="ult-muted">Unnamed</span>'}</td>
          <td>${t.matched ? empPill(t) : '<span class="fo-st fo-st-finished">Open</span>'}</td>
          <td>${esc(t.remarks)}</td>
          <td class="num">${cedi(t.amount)}</td>
          <td>${esc(t.month)}</td>
          <td><span class="pill ${t.matched ? 'paid' : 'overdue'}">${t.matched ? 'named' : 'unmatched'}</span></td>
        </tr>`).join('') || emptyRow(7, 'No salary lines on the statement.')}</tbody>
      </table></div>
      ${tableFoot()}
    </div>`}`;
  app.querySelector('#pay-month')?.addEventListener('change', (e) => {
    const p = new URLSearchParams(location.search);
    p.set('tab', 'bankpay');
    if (e.target.value) p.set('month', e.target.value);
    else p.delete('month');
    const path = FILE + '?' + p.toString();
    history.pushState({ spa: path }, '', path);
    paint();
  });
  bindHubTabs(app, go);
  app.querySelectorAll('[data-pane]').forEach((a) => {
    a.onclick = (ev) => {
      ev.preventDefault();
      const path = a.getAttribute('href');
      history.pushState({ spa: path }, '', path);
      paint();
    };
  });
  app.querySelectorAll('[data-chip]').forEach((a) => {
    a.onclick = (ev) => {
      ev.preventDefault();
      const path = a.getAttribute('href');
      history.pushState({ spa: path }, '', path);
      paint();
    };
  });
  const tbl = app.querySelector('[data-tbl="bankpay"]') || app.querySelector('[data-tbl="paypeople"]');
  if (tbl) bindTable(tbl, { title: 'Bank Salary', storageKey: 'hrm-bankpay' });
}

async function paint() {
  const app = document.getElementById('app');
  if (!app) return;
  seed();
  const on = tab();
  const d = load();
  const payrolls = (on === 'payroll' || on === 'mypay' || on === 'dash') ? await loadPayrolls() : (d.payrolls || []);
  if (tryPaintFloor(app, on, { brand: BRAND, file: FILE, go })) return;
  if (maybePaintNest(app, on, { brand: BRAND, tabs: TABS, brandKey: 'dash', file: FILE, go })) return;
  if (on === 'dash') return paintDash(app);
  if (on === 'people') return paintPeople(app);
  if (on === 'mypay') return paintMyPay(app, payrolls);
  if (on === 'induction') return paintInduction(app);
  if (on === 'payroll') return paintPayroll(app);
  if (on === 'bankpay') return paintBankPay(app);
  if (on === 'leave') return simpleList(app, on, 'Leave', ['Staff', 'Office', 'Type', 'From', 'To', 'Status'],
    (d.leaves || []).map((l) => `<tr><td>${esc(l.staff)}</td><td>${esc(l.office || l.company || '—')}</td><td>${esc(l.type)}</td><td>${esc(l.from)}</td><td>${esc(l.to)}</td><td>${esc(l.status)}</td></tr>`).join('') || emptyRow(6),
    () => { const staff = prompt('Staff'); if (!staff) return; d.leaves.push({ id: uid(), staff, office: 'Operations Hub', company: 'Delkor-Fiberk Group', type: 'Annual', from: '2026-09-04', to: '2026-09-05', status: 'Pending' }); save(d); paint(); });
  if (on === 'att') return paintAttendance(app, on);
  if (on === 'holiday') return simpleList(app, on, 'Holiday', ['Name', 'Date'],
    (d.holidays || []).map((h) => `<tr><td>${esc(h.name)}</td><td>${esc(h.date)}</td></tr>`).join('') || emptyRow(2),
    () => { const name = prompt('Holiday'); if (!name) return; d.holidays.push({ id: uid(), name, date: '2026-12-25' }); save(d); paint(); });
  if (on === 'dept') return simpleList(app, on, 'Departments', ['Name', 'Company'],
    (d.depts || []).map((x) => `<tr><td>${esc(x.name)}</td><td>${esc(x.company || 'Operating company')}</td></tr>`).join('') || emptyRow(2),
    () => { const name = prompt('Department'); if (!name) return; d.depts.push({ id: uid(), name, company: 'Delkor-Fiberk Group' }); save(d); paint(); });
  if (on === 'desig') return simpleList(app, on, 'Designations', ['Name'],
    (d.desigs || []).map((x) => `<tr><td>${esc(x.name)}</td></tr>`).join('') || emptyRow(1),
    () => { const name = prompt('Designation'); if (!name) return; d.desigs.push({ id: uid(), name }); save(d); paint(); });
  if (on === 'targets') return simpleList(app, on, 'Sales Targets', ['User', 'Last month', 'This month', 'Commission %'],
    (d.targets || []).map((t) => `<tr><td>${esc(t.user)}</td><td>${fmt(t.last)}</td><td>${fmt(t.thisM)}</td><td>${t.commission}</td></tr>`).join('') || emptyRow(4));
  if (on === 'settings' || on === 'setting') return bounceModuleSettings();
  if (on === 'types') {
    return simpleList(app, on, 'Leave Type', ['Name', 'Days'],
      (d.types || []).map((t) => `<tr><td>${esc(t.name)}</td><td>${t.days}</td></tr>`).join('') || emptyRow(2),
      () => { const name = prompt('Leave type'); if (!name) return; d.types.push({ id: uid(), name, days: 5 }); save(d); paint(); });
  }
}

export async function bootHrmHub() {
  onHubNavigate(paint);
  try {
    const session = await getAuthSession();
    const row = findUser(session);
    window.__df_hrm_who = {
      email: row?.email || session?.user?.email || '',
      name: row?.full_name || session?.user?.user_metadata?.full_name || '',
    };
    seed();
    await ensureFiberkHrm();
    await paint();
  } catch (err) {
    console.warn('hrm-hub', err);
    const app = document.getElementById('app');
    if (app) app.innerHTML = `<div class="card" style="padding:24px"><h1>HRM</h1><p>${esc(err?.message || err)}</p></div>`;
  }
  window.addEventListener('popstate', () => paint());
}
