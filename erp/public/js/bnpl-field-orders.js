/** ACM / Easybuy hire-purchase order book for Field Ops.
 * Column order matches GH ACM Order List. Live table is optional until SQL 117 lands.
 */
import { esc, readLs } from './ls-rows.js';
import { supabase } from './supabaseClient.js';
import { bindTable } from './home-tables.js';
import { filterBySidebar } from './scope.js';
import { deskHowLink } from './desk-manual.js';

function workbookBtn(id) {
  return deskHowLink(id === 's-hp-orders' ? 'hp-01' : (id || 'field'));
}

const JSON_URL = '/js/bnpl-field-orders.json';
const LS_KEY = 'df_bnpl_field_orders';

export const ORDER_COLS = [
  { key: 'customer_name', label: 'Customer Name' },
  { key: 'phone', label: 'Phone Number' },
  { key: 'brand_type', label: 'Brand&Type' },
  { key: 'delivery_at', label: 'Delivery Time' },
  { key: 'status', label: 'Status' },
  { key: 'sa_name', label: 'SA Name' },
  { key: 'order_id', label: 'Order ID' },
  { key: 'price', label: 'Price' },
  { key: 'downpayment', label: 'Deposit (partner)' },
  { key: 'due_on', label: 'Current Duedate' },
  { key: 'loan_amount', label: 'Loan Amount' },
  { key: 'imei', label: 'IMEI' },
  { key: 'pos_name', label: 'POS Name' },
];

const STATUS_LAB = {
  normal: 'Normal',
  overdue_1: 'Overdue 1',
  overdue_2_6: 'Overdue 2-6',
  overdue_6: 'Overdue 6+',
  finished: 'Finished',
};

let _book = null;

function ymd(v) {
  return String(v || '').slice(0, 10);
}

function todayYmd() {
  try {
    return new Date().toLocaleDateString('en-CA', { timeZone: 'Africa/Accra' });
  } catch {
    return new Date().toISOString().slice(0, 10);
  }
}

function addDays(ymdStr, n) {
  const d = new Date(`${ymdStr}T00:00:00`);
  d.setDate(d.getDate() + n);
  const p = (x) => String(x).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}

function startOfWeek(ymdStr) {
  const d = new Date(`${ymdStr}T00:00:00`);
  const day = d.getDay(); // 0 Sun
  const back = day === 0 ? 6 : day - 1;
  return addDays(ymdStr, -back);
}

function startOfMonth(ymdStr) {
  return `${ymdStr.slice(0, 7)}-01`;
}

function prevMonthStart(ymdStr) {
  const [y, m] = ymdStr.split('-').map(Number);
  const pm = m === 1 ? 12 : m - 1;
  const py = m === 1 ? y - 1 : y;
  return `${py}-${String(pm).padStart(2, '0')}-01`;
}

function last9(p) {
  return String(p || '').replace(/\D/g, '').slice(-9);
}

function money(n) {
  if (n == null || n === '') return '—';
  const v = Number(n);
  if (!Number.isFinite(v)) return '—';
  return v.toLocaleString('en-GH');
}

function pct(part, whole) {
  if (!whole) return '0.00%';
  return `${((part / whole) * 100).toFixed(2)}%`;
}

function statusKey(row) {
  return row.status_key || {
    Normal: 'normal',
    'Overdue 1': 'overdue_1',
    'Overdue 2-6': 'overdue_2_6',
    'Overdue 6+': 'overdue_6',
    Finshed: 'finished',
    Finished: 'finished',
  }[row.status] || 'normal';
}

function statusLabel(row) {
  const k = statusKey(row);
  if (k === 'finished') return 'Finished';
  return STATUS_LAB[k] || row.status || '—';
}

export function orderMetrics(rows) {
  const sales = rows.length;
  const total = rows.reduce((s, r) => s + (Number(r.price) || 0), 0);
  const o1 = rows.filter((r) => statusKey(r) === 'overdue_1').length;
  const o26 = rows.filter((r) => statusKey(r) === 'overdue_2_6').length;
  const o6 = rows.filter((r) => statusKey(r) === 'overdue_6').length;
  const overdue = o1 + o26 + o6;
  return {
    sales,
    total,
    overdue,
    overdue_1: o1 + o26 + o6,
    overdue_6: o6,
    overdue_rate: pct(overdue, sales),
    overdue_1_rate: pct(o1 + o26 + o6, sales),
    overdue_6_rate: pct(o6, sales),
  };
}

export function rangeFor(chip, t = todayYmd()) {
  if (chip === 'today') return { from: t, to: t };
  if (chip === 'this_week') return { from: startOfWeek(t), to: t };
  if (chip === 'last_week') {
    const thisStart = startOfWeek(t);
    return { from: addDays(thisStart, -7), to: addDays(thisStart, -1) };
  }
  if (chip === 'this_month') return { from: startOfMonth(t), to: t };
  if (chip === 'last_month') {
    const thisM = startOfMonth(t);
    return { from: prevMonthStart(t), to: addDays(thisM, -1) };
  }
  if (chip === 'two_months') return { from: addDays(t, -61), to: t };
  return { from: '', to: '' };
}

export function filterOrders(rows, q = {}) {
  const from = ymd(q.from);
  const to = ymd(q.to);
  const st = q.status || '';
  const sa = String(q.sa || '').trim().toLowerCase();
  const pos = String(q.pos || '').trim().toLowerCase();
  const eval1 = q.chip === 'overdue_1p';
  const eval6 = q.chip === 'overdue_6p';
  return rows.filter((r) => {
    const d = ymd(r.delivery_at);
    if (from && d && d < from) return false;
    if (to && d && d > to) return false;
    if (from && !d) return false;
    const k = statusKey(r);
    if (eval6 && k !== 'overdue_6') return false;
    if (eval1 && !['overdue_1', 'overdue_2_6', 'overdue_6'].includes(k)) return false;
    if (st && k !== st && r.status !== st) return false;
    if (sa && !String(r.sa_name || '').toLowerCase().includes(sa)) return false;
    if (pos && !String(r.pos_name || '').toLowerCase().includes(pos)) return false;
    return true;
  });
}

function mergeById(rows) {
  const m = new Map();
  rows.forEach((r) => {
    const k = String(r?.order_id || r?.id || r?.imei || '');
    if (!k) return;
    m.set(k, { ...(m.get(k) || {}), ...r });
  });
  return [...m.values()];
}

export async function loadOrders() {
  if (_book) return _book;
  let remote = [];
  let file = [];
  let local = [];
  try {
    const r = await Promise.race([
      supabase.from('bnpl_field_orders').select('*').limit(8000),
      new Promise((resolve) => setTimeout(() => resolve({ data: null }), 3500)),
    ]);
    if (r?.data?.length) remote = r.data;
  } catch { /* local book */ }
  try {
    const res = await fetch(JSON_URL + '?v=2026-09-11c', { cache: 'no-cache' });
    if (res.ok) {
      const data = await res.json();
      file = data.orders || data || [];
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

function normalize(row) {
  if (!row) return row;
  return {
    ...row,
    id: row.id || row.order_id,
    order_id: row.order_id || row.id,
    status_key: row.status_key || statusKey(row),
  };
}

function pill(row) {
  const k = statusKey(row);
  return `<span class="fo-st fo-st-${esc(k)}">${esc(statusLabel(row))}</span>`;
}

function ghWa(phone) {
  const d = String(phone || '').replace(/\D/g, '');
  if (!d) return '';
  const intl = d.startsWith('0') ? `233${d.slice(1)}` : (d.startsWith('233') ? d : `233${d}`);
  return `https://wa.me/${intl}`;
}

export function paintOrderList(app, { navHtml = '' } = {}) {
  const state = {
    chip: 'all',
    status: '',
    sa: '',
    pos: '',
    from: '',
    to: '',
  };

  async function draw() {
    try { await import('./hp-trail.js').then((m) => m.matchCounts()); } catch { /* book */ }
    const all = filterBySidebar(await loadOrders());
    let payByApply = new Map();
    try {
      const { loadPayments } = await import('./bnpl-field-payments.js');
      const pays = await loadPayments();
      payByApply = new Map(pays.map((p) => [p.apply_no, p]));
    } catch { /* payments book */ }
    const colPhones = new Set((readLs('df_collection_accounts', []) || []).map((a) => last9(a.phone)).filter(Boolean));
    const linkedN = all.filter((r) => colPhones.has(last9(r.phone))).length;
    const agents = [...new Set(all.map((r) => r.sa_name).filter(Boolean))].sort((a, b) => a.localeCompare(b));
    const poss = [...new Set(all.map((r) => r.pos_name).filter(Boolean))].sort();
    const rows = filterOrders(all, state);
    const m = orderMetrics(rows);
    const chips = [
      ['all', 'All'],
      ['today', 'Today'],
      ['this_week', 'This Week'],
      ['last_week', 'Last Week'],
      ['this_month', 'This Month'],
      ['last_month', 'Last Month'],
      ['two_months', 'Past two months'],
      ['overdue_1p', 'Overdue 1+'],
      ['overdue_6p', 'Overdue 6+'],
    ];
    const body = rows.map((r) => `<tr data-id="${esc(r.order_id)}">
      <td><a href="#" data-trail="${esc(r.phone)}">${esc(r.customer_name)}</a>${colPhones.has(last9(r.phone)) ? ' <span class="hp-hit">Collections</span>' : ''}</td>
      <td>${r.phone ? `<a href="tel:${esc(r.phone)}">${esc(r.phone)}</a>${ghWa(r.phone) ? ` · <a href="${esc(ghWa(r.phone))}" target="_blank" rel="noopener">WA</a>` : ''}` : '—'}</td>
      <td title="${esc(r.brand_type)}">${esc(r.brand_type)}</td>
      <td>${esc(r.delivery_at || '—')}</td>
      <td>${pill(r)}</td>
      <td>${esc(r.sa_name || '—')}</td>
      <td class="fo-mono" title="${esc(r.order_id)}">${esc(r.order_id)}</td>
      <td class="fo-num">${money(r.price)}</td>
      <td class="fo-num">${money((payByApply.get(r.order_id) || {}).downpayment)}</td>
      <td>${esc(r.due_on || '—')}</td>
      <td class="fo-num">${money(r.loan_amount)}</td>
      <td class="fo-mono" title="${esc(r.imei)}"><a href="/field-ops.html?tab=stock&imei=${encodeURIComponent(r.imei || '')}">${esc(r.imei || '—')}</a></td>
      <td>${esc(r.pos_name || '—')}</td>
    </tr>`).join('');

    app.innerHTML = `
      ${navHtml}
      <div class="fo-ol">
        <div class="ops-toolbar">
          <p class="ops-sub">Fiberk Phones DSA hire-purchase book. Price and loan are the customer contract. Deposit is what they paid the finance partner — not Fiberk cash — synced from Payment Record so price vs loan is readable. ${linkedN} phones also sit on Collections. Click a name for the trail.</p>
        </div>
        <form class="fo-ol-filters" id="fo-ol-form">
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
          <label>Status
            <select name="status">
              <option value="">All</option>
              <option value="normal" ${state.status === 'normal' ? 'selected' : ''}>Normal</option>
              <option value="overdue_1" ${state.status === 'overdue_1' ? 'selected' : ''}>Overdue 1</option>
              <option value="overdue_2_6" ${state.status === 'overdue_2_6' ? 'selected' : ''}>Overdue 2-6</option>
              <option value="overdue_6" ${state.status === 'overdue_6' ? 'selected' : ''}>Overdue 6+</option>
              <option value="finished" ${state.status === 'finished' ? 'selected' : ''}>Finished</option>
            </select>
          </label>
          <label>Delivery from <input type="date" name="from" value="${esc(state.from)}" /></label>
          <label>to <input type="date" name="to" value="${esc(state.to)}" /></label>
          <div class="fo-ol-chips">
            ${chips.map(([k, lab]) =>
              `<button type="button" class="fo-chip ${state.chip === k ? 'on' : ''}" data-chip="${k}">${lab}</button>`).join('')}
          </div>
          <div class="fo-ol-actions">
            <button type="submit" class="ult-btn ult-btn-primary">Query</button>
            <button type="button" class="ult-btn ult-btn-outline" id="fo-ol-reset">Reset</button>
          </div>
        </form>
        <div class="fo-ol-kpis">
          <article><span>Sales</span><b>${m.sales}</b></article>
          <article><span>Total price</span><b>${money(m.total)}</b></article>
          <article><span>Overdue rate</span><b>${m.overdue_rate}</b></article>
          <article><span>Overdue 1+ rate</span><b>${m.overdue_1_rate}</b></article>
          <article><span>Overdue 6+ rate</span><b>${m.overdue_6_rate}</b></article>
        </div>
        <div class="home-card" data-tbl="fo-orders">
          <div class="ss-head"><strong>Order Detail</strong>${workbookBtn('s-hp-orders')}</div>
          <div class="bar">
            <label>Show <select data-tbl-size><option>10</option><option selected>25</option><option>50</option><option>100</option><option>All</option></select> entries</label>
            <div class="grow"></div>
            <button type="button" data-exp="csv">Export CSV</button>
            <button type="button" data-exp="xls">Export Excel</button>
            <button type="button" data-exp="print">Print</button>
            <input data-tbl-search placeholder="Search name, phone, IMEI, order…" />
          </div>
          <div class="ult-table-wrap"><table class="ult-table">
            <thead><tr>${ORDER_COLS.map((c) => `<th>${esc(c.label)}</th>`).join('')}</tr></thead>
            <tbody>${body || `<tr data-dummy="1"><td colspan="${ORDER_COLS.length}">No orders in this filter.</td></tr>`}</tbody>
          </table></div>
          <div style="display:flex;justify-content:space-between;margin-top:8px"><div data-tbl-info></div><div class="pager" data-tbl-pager></div></div>
        </div>
      </div>`;

    bindTable(app.querySelector('[data-tbl="fo-orders"]'), {
      title: 'Order List',
      storageKey: 'fo-orders',
      skipFilters: true,
    });
    if (!app.dataset.hpTrailBound) {
      app.dataset.hpTrailBound = '1';
      app.addEventListener('click', (e) => {
        const el = e.target.closest('[data-trail]');
        if (!el || !app.contains(el)) return;
        e.preventDefault();
        import('./hp-trail.js').then((m) => m.openTrail(el.dataset.trail));
      });
    }

    app.querySelectorAll('[data-chip]').forEach((b) => {
      b.onclick = () => {
        const chip = b.dataset.chip;
        state.chip = chip;
        if (chip === 'overdue_1p' || chip === 'overdue_6p' || chip === 'all') {
          state.from = '';
          state.to = '';
        } else {
          const r = rangeFor(chip);
          state.from = r.from;
          state.to = r.to;
        }
        draw();
      };
    });
    const form = document.getElementById('fo-ol-form');
    form.onsubmit = (e) => {
      e.preventDefault();
      const fd = new FormData(form);
      state.pos = String(fd.get('pos') || '');
      state.sa = String(fd.get('sa') || '');
      state.status = String(fd.get('status') || '');
      state.from = String(fd.get('from') || '');
      state.to = String(fd.get('to') || '');
      state.chip = state.from || state.to || state.status || state.sa || state.pos ? 'query' : 'all';
      draw();
    };
    document.getElementById('fo-ol-reset').onclick = () => {
      state.chip = 'all';
      state.status = '';
      state.sa = '';
      state.pos = '';
      state.from = '';
      state.to = '';
      draw();
    };
  }

  return draw();
}

export function uniqueCustomers(rows) {
  const map = new Map();
  for (const r of rows || []) {
    const digits = String(r.phone || '').replace(/\D/g, '');
    const key = digits || String(r.customer_name || '').trim().toLowerCase();
    if (!key || map.has(key)) continue;
    map.set(key, {
      id: `acm-${r.order_id || r.id}`,
      name: r.customer_name,
      full_name: r.customer_name,
      phone: r.phone,
      mobile: r.phone,
      source: 'acm',
      sa_name: r.sa_name,
      status: r.status,
      order_id: r.order_id,
      location_code: 'BNPL-FIELD',
      subsidiary_code: 'bnpl',
    });
  }
  return [...map.values()];
}

export function uniqueAgents(rows, payments = []) {
  const map = new Map();
  function keyOf(name, saId) {
    const id = String(saId || '').trim();
    if (id) return 'id:' + id.toUpperCase();
    return 'n:' + String(name || '').trim().toLowerCase();
  }
  function rec(name, saId) {
    const k = keyOf(name, saId);
    if (!k || k === 'n:') return null;
    if (!map.has(k)) {
      map.set(k, {
        id: saId || `sa-${String(name).toLowerCase().replace(/\s+/g, '-')}`,
        full_name: name || saId,
        name: name || saId,
        sa_id: saId || '',
        phone: '',
        email: '',
        source: 'acm',
        pos_name: '',
        pos_id: '',
        n: 0,
        n_pays: 0,
        transfer: 0,
        commission: 0,
        last_at: '',
        location_code: 'BNPL-FIELD',
        subsidiary_code: 'bnpl',
      });
    }
    return map.get(k);
  }
  for (const r of rows || []) {
    const name = String(r.sa_name || '').trim();
    const a = rec(name, r.sa_id);
    if (!a) continue;
    a.n += 1;
    if (r.pos_name) a.pos_name = r.pos_name;
    const at = String(r.delivery_at || '');
    if (at && at > a.last_at) a.last_at = at;
  }
  for (const r of payments || []) {
    const name = String(r.sa_name || '').trim();
    const a = rec(name, r.sa_id);
    if (!a) continue;
    if (r.sa_id) a.sa_id = r.sa_id;
    if (name && (!a.full_name || a.full_name === a.sa_id)) {
      a.full_name = name;
      a.name = name;
    }
    if (r.pos_name) a.pos_name = r.pos_name;
    if (r.pos_id) a.pos_id = r.pos_id;
    a.n_pays += 1;
    a.transfer += Number(r.transfer_amount) || 0;
    if (r.apply_no) a.commission += 100;
    const at = String(r.transfer_at || r.delivery_at || '');
    if (at && at > a.last_at) a.last_at = at;
  }
  const byName = new Map();
  for (const a of map.values()) {
    const n = String(a.full_name || a.name || '').trim().toLowerCase();
    const k = n || String(a.sa_id || a.id);
    if (!k) continue;
    const prev = byName.get(k);
    if (!prev) { byName.set(k, a); continue; }
    const primary = a.sa_id ? a : prev;
    const other = primary === a ? prev : a;
    primary.n += other.n;
    primary.n_pays += other.n_pays;
    primary.transfer += other.transfer;
    primary.commission += other.commission;
    if (!primary.sa_id) primary.sa_id = other.sa_id;
    if (!primary.pos_id) primary.pos_id = other.pos_id;
    if (!primary.pos_name) primary.pos_name = other.pos_name;
    if (other.last_at > primary.last_at) primary.last_at = other.last_at;
    if (other.full_name && other.full_name !== other.sa_id) {
      primary.full_name = other.full_name;
      primary.name = other.name;
    }
    byName.set(k, primary);
  }
  return [...byName.values()].sort((a, b) => String(a.full_name).localeCompare(String(b.full_name)));
}

