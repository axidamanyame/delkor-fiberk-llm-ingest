/** ACM Payment Record — partner reimbursement for phones field agents sold. */
import { esc, readLs } from './ls-rows.js';
import { supabase } from './supabaseClient.js';
import { bindTable } from './home-tables.js';
import { workbookBtn } from './hp-workbooks.js';
import { filterBySidebar } from './scope.js';

function todayYmd() {
  try { return new Date().toLocaleDateString('en-CA', { timeZone: 'Africa/Accra' }); }
  catch { return new Date().toISOString().slice(0, 10); }
}
function addDays(ymdStr, n) {
  const d = new Date(`${ymdStr}T00:00:00`);
  d.setDate(d.getDate() + n);
  const p = (x) => String(x).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}
function startOfWeek(ymdStr) {
  const d = new Date(`${ymdStr}T00:00:00`);
  const day = d.getDay();
  return addDays(ymdStr, -(day === 0 ? 6 : day - 1));
}
function startOfMonth(ymdStr) { return `${String(ymdStr).slice(0, 7)}-01`; }
function prevMonthStart(ymdStr) {
  const [y, m] = ymdStr.split('-').map(Number);
  const pm = m === 1 ? 12 : m - 1;
  const py = m === 1 ? y - 1 : y;
  return `${py}-${String(pm).padStart(2, '0')}-01`;
}
function rangeFor(chip, t = todayYmd()) {
  if (chip === 'today') return { from: t, to: t };
  if (chip === 'this_week') return { from: startOfWeek(t), to: t };
  if (chip === 'last_week') {
    const s = startOfWeek(t);
    return { from: addDays(s, -7), to: addDays(s, -1) };
  }
  if (chip === 'this_month') return { from: startOfMonth(t), to: t };
  if (chip === 'last_month') {
    const s = startOfMonth(t);
    return { from: prevMonthStart(t), to: addDays(s, -1) };
  }
  if (chip === 'two_months') return { from: addDays(t, -61), to: t };
  return { from: '', to: '' };
}

async function loadOrders() {
  const m = await import('./bnpl-field-orders.js');
  return m.loadOrders();
}

const JSON_URL = '/js/bnpl-field-payments.json';
const LS_KEY = 'df_bnpl_field_payments';

export const PAY_COLS = [
  { key: 'apply_no', label: 'Apply No.' },
  { key: 'delivery_at', label: 'Goods Delivery Time' },
  { key: 'pos_id', label: 'Pos ID' },
  { key: 'sa_id', label: 'SA ID' },
  { key: 'pos_name', label: 'Pos Name' },
  { key: 'eb_order_id', label: 'Order id' },
  { key: 'order_status', label: 'Order Status' },
  { key: 'receipt_code', label: 'Receipt code' },
  { key: 'imei', label: 'Imei code' },
  { key: 'brand', label: 'Brand' },
  { key: 'type', label: 'Type' },
  { key: 'downpayment', label: 'Customer deposit (partner)' },
  { key: 'comment', label: 'Comment' },
  { key: 'transfer_amount', label: 'Actual Transfer Amount' },
  { key: 'transfer_at', label: 'Transfer time' },
  { key: 'auto_pay', label: 'Auto payment' },
];

export const MASTER_COLS = [
  { key: 'customer_name', label: 'Customer' },
  { key: 'phone', label: 'Phone' },
  { key: 'apply_no', label: 'Apply No.' },
  { key: 'eb_order_id', label: 'EB Order' },
  { key: 'brand_type', label: 'Brand&Type' },
  { key: 'imei', label: 'IMEI' },
  { key: 'delivery_at', label: 'Delivered' },
  { key: 'acm_status', label: 'ACM status' },
  { key: 'sa_name', label: 'SA Name' },
  { key: 'sa_id', label: 'SA ID' },
  { key: 'price', label: 'Partner price (benchmark)' },
  { key: 'downpayment', label: 'Customer deposit (partner)' },
  { key: 'loan_amount', label: 'Loan' },
  { key: 'transfer_amount', label: 'Fiberk sell' },
  { key: 'sa_commission', label: 'SA ₵100 (partner)' },
  { key: 'cost_price', label: 'Cost (Franko)' },
  { key: 'transfer_at', label: 'Transfer time' },
  { key: 'auto_pay', label: 'Auto' },
];

const ST_LAB = { S: 'Settled', C: 'Cancelled', F: 'Failed', I: 'Incomplete', P: 'Pending' };

/** ₵100 per phone, paid by the finance partner — not on the ACM table, not Fiberk payroll. */
export const SA_COMMISSION = 100;

let _book = null;

function ymd(v) { return String(v || '').slice(0, 10); }
function last9(p) { return String(p || '').replace(/\D/g, '').slice(-9); }

export function money(n) {
  if (n == null || n === '') return '—';
  const v = Number(n);
  if (!Number.isFinite(v)) return '—';
  return v.toLocaleString('en-GH');
}

export function payStatusLabel(row) {
  const k = String(row.order_status || '').toUpperCase();
  return ST_LAB[k] ? `${k} · ${ST_LAB[k]}` : (k || '—');
}

export function paymentMetrics(rows) {
  const n = rows.length;
  const xfer = rows.reduce((s, r) => s + (Number(r.transfer_amount) || 0), 0);
  const down = rows.reduce((s, r) => s + (Number(r.downpayment) || 0), 0);
  const price = rows.reduce((s, r) => s + (Number(r.price) || 0), 0);
  const loan = rows.reduce((s, r) => s + (Number(r.loan_amount) || 0), 0);
  const auto = rows.filter((r) => String(r.auto_pay).toUpperCase() === 'Y').length;
  const settled = rows.filter((r) => String(r.order_status).toUpperCase() === 'S').length;
  const commission = settled * SA_COMMISSION;
  return {
    n, xfer, down, price, loan, auto, settled, commission,
    auto_rate: n ? ((auto / n) * 100).toFixed(2) + '%' : '0.00%',
  };
}

export function filterPayments(rows, q = {}) {
  const from = ymd(q.from);
  const to = ymd(q.to);
  const st = String(q.status || '').toUpperCase();
  const sa = String(q.sa || '').trim().toLowerCase();
  const pos = String(q.pos || '').trim().toLowerCase();
  const field = q.dateField || 'transfer_at';
  return rows.filter((r) => {
    const d = ymd(r[field] || r.transfer_at || r.delivery_at);
    if (from && d && d < from) return false;
    if (to && d && d > to) return false;
    if (from && !d) return false;
    if (st && String(r.order_status || '').toUpperCase() !== st) return false;
    if (sa && !String(r.sa_id || '').toLowerCase().includes(sa) && !String(r.sa_name || '').toLowerCase().includes(sa)) return false;
    if (pos && !String(r.pos_name || '').toLowerCase().includes(pos) && !String(r.pos_id || '').toLowerCase().includes(pos)) return false;
    return true;
  });
}

function normalize(row) {
  if (!row) return row;
  return {
    ...row,
    id: row.id || row.apply_no,
    apply_no: row.apply_no || row.id,
    brand_type: row.brand_type || [row.brand, row.type].filter(Boolean).join(' '),
  };
}

function mergeById(rows) {
  const m = new Map();
  rows.forEach((r) => {
    const k = String(r?.apply_no || r?.id || r?.imei || '');
    if (!k) return;
    m.set(k, { ...(m.get(k) || {}), ...r });
  });
  return [...m.values()];
}

export async function loadPayments() {
  if (_book) return _book;
  let remote = [];
  let file = [];
  let local = [];
  try {
    const r = await Promise.race([
      supabase.from('bnpl_field_payments').select('*').limit(8000),
      new Promise((resolve) => setTimeout(() => resolve({ data: null }), 3500)),
    ]);
    if (r?.data?.length) remote = r.data;
  } catch { /* local */ }
  try {
    const res = await fetch(JSON_URL + '?v=2026-09-11c', { cache: 'no-cache' });
    if (res.ok) {
      const data = await res.json();
      file = data.payments || data || [];
    }
  } catch { /* ignore */ }
  try {
    const raw = localStorage.getItem(LS_KEY);
    if (raw) local = JSON.parse(raw);
  } catch { /* ignore */ }
  _book = mergeById([...local, ...remote, ...file].map(normalize));
  try { localStorage.setItem(LS_KEY, JSON.stringify(_book)); } catch { /* ignore */ }
  return _book;
}

export async function masterRows() {
  const [orders, pays] = await Promise.all([loadOrders(), loadPayments()]);
  const byApply = new Map(pays.map((p) => [p.apply_no, p]));
  const rows = orders.map((o) => {
    const p = byApply.get(o.order_id) || pays.find((x) => x.imei && x.imei === o.imei) || {};
    return {
      ...o,
      apply_no: p.apply_no || o.order_id,
      eb_order_id: p.eb_order_id || '',
      sa_id: p.sa_id || o.sa_id || '',
      pos_id: p.pos_id || '',
      downpayment: p.downpayment,
      transfer_amount: p.transfer_amount,
      transfer_at: p.transfer_at || '',
      auto_pay: p.auto_pay || '',
      order_status: p.order_status || '',
      sa_commission: p.apply_no ? SA_COMMISSION : 0,
      acm_status: o.status,
      paid: !!p.apply_no,
    };
  });
  return filterBySidebar(rows);
}

function stPill(row) {
  const k = String(row.order_status || '').toUpperCase();
  const lab = ST_LAB[k] ? `${k} · ${ST_LAB[k]}` : (k || '—');
  const cls = k === 'S' ? 'normal' : (k === 'F' || k === 'C' ? 'overdue_6' : 'overdue_1');
  return `<span class="fo-st fo-st-${cls}">${esc(lab)}</span>`;
}

function bindPayClicks(app) {
  if (app.dataset.hpPayBound) return;
  app.dataset.hpPayBound = '1';
  app.addEventListener('click', (e) => {
    const el = e.target.closest('[data-trail]');
    if (!el || !app.contains(el)) return;
    e.preventDefault();
    import('./hp-trail.js').then((m) => m.openTrail(el.dataset.trail));
  });
}

function filterBar(state, { agents, poss, statuses, dateName }) {
  const chips = [
    ['all', 'All'],
    ['today', 'Today'],
    ['this_week', 'This Week'],
    ['last_week', 'Last Week'],
    ['this_month', 'This Month'],
    ['last_month', 'Last Month'],
    ['two_months', 'Past two months'],
  ];
  return `<div class="filter-section"><div class="filter-header">Filters <span class="filter-chevron">▼</span></div><div class="filter-body">
  <form class="fo-ol-filters" id="fo-pay-form">
    <label>POS
      <select name="pos">
        <option value="">All POS</option>
        ${poss.map((p) => `<option value="${esc(p)}" ${state.pos === p ? 'selected' : ''}>${esc(p)}</option>`).join('')}
      </select>
    </label>
    <label>SA
      <select name="sa">
        <option value="">All agents</option>
        ${agents.map((p) => `<option value="${esc(p)}" ${state.sa === p ? 'selected' : ''}>${esc(p)}</option>`).join('')}
      </select>
    </label>
    <label>Order Status
      <select name="status">
        <option value="">All</option>
        ${statuses.map((s) => `<option value="${esc(s)}" ${state.status === s ? 'selected' : ''}>${esc(s)} · ${esc(ST_LAB[s] || s)}</option>`).join('')}
      </select>
    </label>
    <label>${esc(dateName)} from <input type="date" name="from" value="${esc(state.from)}" /></label>
    <label>to <input type="date" name="to" value="${esc(state.to)}" /></label>
    <div class="fo-ol-chips">
      ${chips.map(([k, lab]) =>
        `<button type="button" class="fo-chip ${state.chip === k ? 'on' : ''}" data-chip="${k}">${lab}</button>`).join('')}
    </div>
    <div class="fo-ol-actions">
      <button type="submit" class="ult-btn ult-btn-primary">Query</button>
      <button type="button" class="ult-btn ult-btn-outline" id="fo-pay-reset">Reset</button>
    </div>
  </form></div></div>`;
}

function readForm(state, form) {
  if (!form) return;
  const fd = new FormData(form);
  state.pos = String(fd.get('pos') || '');
  state.sa = String(fd.get('sa') || '');
  state.status = String(fd.get('status') || '');
  if (state.chip === 'all' || state.chip === 'query') {
    state.from = String(fd.get('from') || '');
    state.to = String(fd.get('to') || '');
  }
}

function bindFilters(app, state, draw) {
  app.querySelectorAll('[data-chip]').forEach((b) => {
    b.onclick = () => {
      const chip = b.dataset.chip;
      state.chip = chip;
      const form = document.getElementById('fo-pay-form');
      readForm(state, form);
      if (chip === 'all') { state.from = ''; state.to = ''; }
      else {
        const r = rangeFor(chip);
        state.from = r.from || '';
        state.to = r.to || '';
      }
      draw();
    };
  });
  const form = document.getElementById('fo-pay-form');
  if (form) {
    form.onsubmit = (e) => {
      e.preventDefault();
      readForm(state, form);
      if (!state.chip || state.chip === 'all') state.chip = 'query';
      draw();
    };
    form.querySelectorAll('select, input[type=date]').forEach((el) => {
      el.addEventListener('change', () => {
        readForm(state, form);
        if (el.name === 'from' || el.name === 'to') state.chip = 'query';
        draw();
      });
    });
  }
  document.getElementById('fo-pay-reset')?.addEventListener('click', () => {
    state.chip = 'all';
    state.status = '';
    state.sa = '';
    state.pos = '';
    state.from = '';
    state.to = '';
    draw();
  });
}

export function paintPaymentRecord(app, { navHtml = '', accounting = false } = {}) {
  const state = { chip: 'all', status: '', sa: '', pos: '', from: '', to: '' };

  async function draw() {
    const all = filterBySidebar(await loadPayments());
    const agents = [...new Set(all.map((r) => r.sa_id).filter(Boolean))].sort();
    const poss = [...new Set(all.map((r) => r.pos_name).filter(Boolean))].sort();
    const statuses = [...new Set(all.map((r) => String(r.order_status || '').toUpperCase()).filter(Boolean))].sort();
    const rows = filterPayments(all, { ...state, dateField: 'transfer_at' });
    const m = paymentMetrics(rows);
    const body = rows.map((r) => `<tr data-id="${esc(r.apply_no)}">
      <td class="fo-mono" title="${esc(r.apply_no)}">${esc(r.apply_no)}</td>
      <td>${esc(r.delivery_at || '—')}</td>
      <td>${esc(r.pos_id || '—')}</td>
      <td>${esc(r.sa_id || '—')}</td>
      <td>${esc(r.pos_name || '—')}</td>
      <td class="fo-mono" title="${esc(r.eb_order_id)}">${esc(r.eb_order_id || '—')}</td>
      <td>${stPill(r)}</td>
      <td>${esc(r.receipt_code || '')}</td>
      <td class="fo-mono" title="${esc(r.imei)}"><a href="/field-ops.html?tab=stock&imei=${encodeURIComponent(r.imei || '')}">${esc(r.imei || '—')}</a></td>
      <td>${esc(r.brand || '—')}</td>
      <td title="${esc(r.type)}">${esc(r.type || '—')}</td>
      <td class="fo-num">${money(r.downpayment)}</td>
      <td>${esc(r.comment || '')}</td>
      <td class="fo-num">${money(r.transfer_amount)}</td>
      <td>${esc(r.transfer_at || '—')}</td>
      <td>${esc(r.auto_pay || '—')}</td>
    </tr>`).join('');

    app.innerHTML = `
      ${navHtml}
      <div class="fo-ol">
        <div class="ops-toolbar"></div>
        ${filterBar(state, { agents, poss, statuses, dateName: 'Transfer time' })}
        <div class="fo-ol-kpis">
          <article><span>Transfers</span><b>${m.n}</b></article>
          <article><span>Fiberk sell</span><b>${money(m.xfer)}</b></article>
          <article><span>Deposit (partner)</span><b>${money(m.down)}</b></article>
          <article><span>SA ₵100 (partner)</span><b>${money(m.commission)}</b></article>
          <article><span>Settled</span><b>${m.settled}</b></article>
        </div>
        <div class="home-card" data-tbl="fo-pays">
          <div class="ss-head"><strong>Payment record</strong>
            ${workbookBtn('s-hp-payments')}
            <button type="button" class="ult-btn ult-btn-outline" data-ctx-table="journals" data-ctx-title="Accounting journals">Open in Accounting</button>
            <button type="button" class="ult-btn ult-btn-outline" data-fo-tab="master">HP Book</button>
          </div>
          <div class="bar">
            <label>Show <select data-tbl-size><option>10</option><option selected>25</option><option>50</option><option>100</option><option>All</option></select> entries</label>
            <div class="grow"></div>
            <button type="button" data-exp="csv">Export CSV</button>
            <button type="button" data-exp="xls">Export Excel</button>
            <button type="button" data-exp="print">Print</button>
            <input data-tbl-search placeholder="Search apply no, IMEI, SA, EB order…" />
          </div>
          <div class="ult-table-wrap"><table class="ult-table">
            <thead><tr>${PAY_COLS.map((c) => `<th>${esc(c.label)}</th>`).join('')}</tr></thead>
            <tbody>${body || `<tr data-dummy="1"><td colspan="${PAY_COLS.length}">No transfers in this filter.</td></tr>`}</tbody>
          </table></div>
          <div style="display:flex;justify-content:space-between;margin-top:8px"><div data-tbl-info></div><div class="pager" data-tbl-pager></div></div>
        </div>
      </div>`;
    bindTable(app.querySelector('[data-tbl="fo-pays"]'), { title: 'Payment Record', storageKey: 'fo-pays', skipFilters: true });
    bindFilters(app, state, draw);
  }
  return draw();
}

export function paintMasterBook(app, { navHtml = '' } = {}) {
  const state = { chip: 'all', status: '', sa: '', pos: '', from: '', to: '' };

  async function draw() {
    const all = await masterRows();
    const agents = [...new Set(all.map((r) => r.sa_name || r.sa_id).filter(Boolean))].sort((a, b) => a.localeCompare(b));
    const poss = [...new Set(all.map((r) => r.pos_name).filter(Boolean))].sort();
    const statuses = [...new Set(all.map((r) => String(r.order_status || '').toUpperCase()).filter(Boolean))].sort();
    const rows = filterPayments(all, { ...state, dateField: 'delivery_at' });
    const m = paymentMetrics(rows);
    const unpaid = rows.filter((r) => !r.paid).length;
    const colPhones = new Set((readLs('df_collection_accounts', []) || []).map((a) => last9(a.phone)).filter(Boolean));
    const body = rows.map((r) => `<tr data-id="${esc(r.apply_no)}">
      <td><a href="#" data-trail="${esc(r.phone)}">${esc(r.customer_name || '—')}</a>${colPhones.has(last9(r.phone)) ? ' <span class="hp-hit">Collections</span>' : ''}${r.paid ? '' : ' <span class="hp-miss">No transfer</span>'}</td>
      <td>${r.phone ? `<a href="tel:${esc(r.phone)}">${esc(r.phone)}</a>` : '—'}</td>
      <td class="fo-mono" title="${esc(r.apply_no)}">${esc(r.apply_no)}</td>
      <td class="fo-mono" title="${esc(r.eb_order_id)}">${esc(r.eb_order_id || '—')}</td>
      <td title="${esc(r.brand_type)}">${esc(r.brand_type || '—')}</td>
      <td class="fo-mono" title="${esc(r.imei)}"><a href="/field-ops.html?tab=stock&imei=${encodeURIComponent(r.imei || '')}">${esc(r.imei || '—')}</a></td>
      <td>${esc(r.delivery_at || '—')}</td>
      <td>${esc(r.acm_status || '—')}</td>
      <td>${esc(r.sa_name || '—')}</td>
      <td>${esc(r.sa_id || '—')}</td>
      <td class="fo-num">${money(r.price)}</td>
      <td class="fo-num">${money(r.downpayment)}</td>
      <td class="fo-num">${money(r.loan_amount)}</td>
      <td class="fo-num">${money(r.transfer_amount)}</td>
      <td class="fo-num">${r.sa_commission ? money(r.sa_commission) : '—'}</td>
      <td class="fo-num">—</td>
      <td>${esc(r.transfer_at || '—')}</td>
      <td>${esc(r.auto_pay || '—')}</td>
    </tr>`).join('');

    app.innerHTML = `
      ${navHtml}
      <div class="fo-ol">
        <div class="ops-toolbar">
          <p class="ops-sub"></p>
        </div>
        ${filterBar(state, { agents, poss, statuses, dateName: 'Delivery' })}
        <div class="fo-ol-kpis">
          <article><span>Contracts</span><b>${m.n}</b></article>
          <article><span>Partner price</span><b>${money(m.price)}</b></article>
          <article><span>Loan</span><b>${money(m.loan)}</b></article>
          <article><span>Fiberk sell</span><b>${money(m.xfer)}</b></article>
          <article><span>Cost (Franko)</span><b>—</b></article>
        </div>
        <div class="home-card" data-tbl="fo-master">
          <div class="ss-head"><strong>HP Book</strong>
            ${workbookBtn('s-hp-master')}
            <a class="ult-btn ult-btn-outline" href="/field-ops.html?tab=orders">Order List</a>
            <a class="ult-btn ult-btn-outline" href="/field-ops.html?tab=payments">Payment Record</a>
            <a class="ult-btn ult-btn-outline" href="/accounting-hp.html">Accounting</a>
          </div>
          <div class="bar">
            <label>Show <select data-tbl-size><option>10</option><option selected>25</option><option>50</option><option>100</option><option>All</option></select> entries</label>
            <div class="grow"></div>
            <button type="button" data-exp="csv">Export CSV</button>
            <button type="button" data-exp="xls">Export Excel</button>
            <button type="button" data-exp="print">Print</button>
            <input data-tbl-search placeholder="Search name, phone, IMEI, apply no…" />
          </div>
          <div class="ult-table-wrap"><table class="ult-table">
            <thead><tr>${MASTER_COLS.map((c) => `<th>${esc(c.label)}</th>`).join('')}</tr></thead>
            <tbody>${body || `<tr data-dummy="1"><td colspan="${MASTER_COLS.length}">No rows in this filter.</td></tr>`}</tbody>
          </table></div>
          <div style="display:flex;justify-content:space-between;margin-top:8px"><div data-tbl-info></div><div class="pager" data-tbl-pager></div></div>
        </div>
      </div>`;
    bindTable(app.querySelector('[data-tbl="fo-master"]'), { title: 'HP Book', storageKey: 'fo-master', skipFilters: true });
    bindFilters(app, state, draw);
    bindPayClicks(app);
  }
  return draw();
}

export function hpFinanceCard(m) {
  return `<div class="ov-card" id="hp-finance">
    <h2>HP partner reimbursement</h2>
    <p class="sub">Only <b>Fiberk sell</b> (the partner reimbursement) belongs on our books as the selling price. Partner price is their customer benchmark, not our sale. Customer deposit and the ₵100 SA commission are the partner’s. Cost from Franko is not booked — profit is not calculated.</p>
    <div class="fo-ol-kpis" style="margin:12px 0 0;border:0">
      <article><span>Transfers</span><b>${m.n}</b></article>
      <article><span>Fiberk sell</span><b>${money(m.xfer)}</b></article>
      <article><span>Deposit (not ours)</span><b>${money(m.down)}</b></article>
      <article><span>Cost (Franko)</span><b>—</b></article>
    </div>
    <p style="margin:12px 0 0;display:flex;gap:8px;flex-wrap:wrap">
      <a class="ult-btn ult-btn-primary" href="/accounting-reconciliation.html">Reconciliation</a>
      <a class="ult-btn ult-btn-outline" href="/accounting-hp.html">Payment Record</a>
      <a class="ult-btn ult-btn-outline" href="/spreadsheet.html?sheet=s-hp-payments">Open workbook</a>
      <a class="ult-btn ult-btn-outline" href="/field-ops.html?tab=books">All workbooks</a>
      <a class="ult-btn ult-btn-outline" href="/field-ops.html?tab=master">HP Book</a>
      <a class="ult-btn ult-btn-outline" href="/accounting-bank-ledger.html">Bank Ledger</a>
    </p>
  </div>`;
}

