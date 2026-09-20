/**
 * Finance → Banking hub: Banks | Cheques | Debit Notes | Payments
 */
import { fmt, getActiveSubsidiary } from './supabaseClient.js';
import { SCOPE_EVENT } from './scope.js';
import { bindTable } from './home-tables.js';
import { tableBar, tableFoot, fmtDate } from './accounting.js';
import {
  ensureFinanceOps, FIN_KEYS, firstRows, filtersCard, bindFilt, modalShell,
  PAY_KEYS, ensureGhanaBankCat,
} from './pay-accounts.js';
import { saveRow, readLs, writeLs, uid, esc } from './ls-rows.js';

const CHQ_KEY = 'df_cheques';
const CHQ_FLAG = 'df_cheques_v2';
const STAFF = ['HQ Finance'];
const STATS = [
  ['all', 'Total Cheques'],
  ['pending', 'Pending'],
  ['received', 'Received'],
  ['dispatched', 'Dispatched'],
  ['submitted', 'Submitted to bank'],
  ['cleared', 'Cleared from bank'],
  ['bounced', 'Bounced / Returned'],
  ['cancelled', 'Cancelled'],
  ['overdue', 'Overdue Cheques'],
];
const TABS = [
  { key: 'banks', label: 'Banks' },
  { key: 'cheques', label: 'Cheques' },
  { key: 'debit', label: 'Debit Notes' },
  { key: 'payments', label: 'Payments' },
  { key: 'momo', label: 'Mobile Money' },
  { key: 'crypto', label: 'Crypto' },
  { key: 'gra', label: 'GRA Tax' },
];

function today() { return '2026-09-04'; }
function addDays(iso, n) {
  const d = new Date(iso + 'T00:00:00');
  d.setDate(d.getDate() + n);
  return d.toISOString().slice(0, 10);
}
function money(n) { return Math.round(Number(n || 0) * 100) / 100; }
function subCode() { return getActiveSubsidiary()?.code || 'group'; }
function subShort() { return getActiveSubsidiary()?.short || 'Group'; }

function ensureCheques() {
  try {
    if (localStorage.getItem(CHQ_FLAG) === '1') return;
  } catch { /* ignore */ }
  writeLs(CHQ_KEY, []);
  try { localStorage.setItem(CHQ_FLAG, '1'); } catch { /* ignore */ }
}

function packChq(dir, r, i) {
  return {
    id: 'chq-' + (i + 1),
    direction: dir,
    cheque_number: r[0],
    date: r[1],
    reference: r[2],
    party: r[3],
    amount: r[4],
    status: r[5],
    txn_type: r[6],
    assigned_to: r[7],
    due_date: r[8],
    cleared_date: r[9] || '',
    user: 'HQ Finance',
    subsidiary_code: r[10],
    bank_name: r[0].split('-')[0] === 'CHQ' ? 'GCB Bank' : (
      { GCB: 'GCB Bank', UBA: 'UBA Ghana', ECO: 'Ecobank Ghana', STAN: 'Stanbic Bank Ghana', FID: 'Fidelity Bank' }[r[0].split('-')[0]] || 'GCB Bank'
    ),
  };
}

function loadCheques() {
  ensureCheques();
  return readLs(CHQ_KEY, []);
}

const RAIL_FLAG = 'df_bank_rails_v2';
const RAIL = {
  momoProv: 'df_momo_providers',
  momoWal: 'df_momo_wallets',
  momoTxn: 'df_momo_transactions',
  cryAst: 'df_crypto_assets',
  cryWal: 'df_crypto_wallets',
  cryTxn: 'df_crypto_transactions',
  graEnt: 'df_gra_entities',
  graFil: 'df_gra_filings',
};

function ensureRails() {
  try {
    if (localStorage.getItem(RAIL_FLAG) === '1') return;
  } catch { /* ignore */ }
  const providers = [
    { id: 'mp-mtn', name: 'MTN Mobile Money', code: 'MTN', sort_order: 1, is_active: true },
    { id: 'mp-tel', name: 'Telecel Cash', code: 'TELECEL', sort_order: 2, is_active: true },
    { id: 'mp-at', name: 'AirtelTigo Money', code: 'AT', sort_order: 3, is_active: true },
  ];
  const assets = [
    { id: 'ca-usdt', code: 'USDT', name: 'Tether', network: 'TRC20', sort_order: 1, is_active: true },
    { id: 'ca-btc', code: 'BTC', name: 'Bitcoin', network: 'Bitcoin', sort_order: 2, is_active: true },
    { id: 'ca-eth', code: 'ETH', name: 'Ethereum', network: 'ERC20', sort_order: 3, is_active: true },
  ];
  const ents = [
    { id: 'ge-1', legal_name: 'Axidigetek Ltd', tin: 'C0004123381', vat_number: 'C0004123381', tax_office: 'TSC Accra', subsidiary_code: 'axidigetek' },
    { id: 'ge-2', legal_name: 'Fiberk Ltd', tin: 'C0005582104', vat_number: 'C0005582104', tax_office: 'TSC Tema', subsidiary_code: 'fiberk' },
    { id: 'ge-3', legal_name: 'Delkor Ltd', tin: 'C0006719042', vat_number: 'C0006719042', tax_office: 'TSC Kumasi', subsidiary_code: 'delkor' },
    { id: 'ge-4', legal_name: 'BuyNowPaysLater Ghana', tin: 'C0008830155', vat_number: 'C0008830155', tax_office: 'TSC Accra', subsidiary_code: 'bnpl' },
  ];
  writeLs(RAIL.momoProv, providers);
  writeLs(RAIL.cryAst, assets);
  writeLs(RAIL.graEnt, ents);
  try { localStorage.setItem(RAIL_FLAG, '1'); } catch { /* ignore */ }
}

function isOverdue(c) {
  if (['cleared', 'cancelled', 'bounced'].includes(c.status)) return false;
  return c.due_date && c.due_date < today();
}
function effectiveStatus(c) {
  return isOverdue(c) ? 'overdue' : c.status;
}

function tabFromUrl() {
  const q = new URLSearchParams(location.search);
  const t = q.get('tab') || 'banks';
  return TABS.some((x) => x.key === t) ? t : 'banks';
}
function viewFromUrl() {
  const v = new URLSearchParams(location.search).get('view') || 'dash';
  return ['dash', 'received', 'issued'].includes(v) ? v : 'dash';
}
function go(tab, view) {
  const u = new URL(location.href);
  u.pathname = '/banking.html';
  u.search = '';
  u.searchParams.set('tab', tab);
  if (tab === 'cheques') u.searchParams.set('view', view || 'dash');
  const path = u.pathname + u.search;
  history.pushState({ spa: path }, '', path);
  paint();
}

function navHtml(tab) {
  return `<nav class="bank-head-tabs">${TABS.map((t) =>
    `<a href="#" class="${t.key === tab ? 'on' : ''}" data-bank-tab="${t.key}">${esc(t.label)}</a>`
  ).join('')}</nav>`;
}

function chqNav(view) {
  const items = [
    { key: 'dash', label: 'Cheque' },
    { key: 'received', label: 'Cheques Received' },
    { key: 'issued', label: 'Cheques Issued' },
  ];
  return `<nav class="acc-inner-tabs">${items.map((t) =>
    `<a href="#" class="${t.key === view ? 'on' : ''}" data-chq-view="${t.key}">${esc(t.label)}</a>`
  ).join('')}</nav>`;
}

function pill(st) {
  const cls = {
    cleared: 'received', received: 'received', submitted: 'partial', dispatched: 'partial',
    pending: 'pending', overdue: 'overdue', bounced: 'overdue', cancelled: 'due',
  }[st] || 'pending';
  return `<span class="pill ${cls}">${esc(st.replace(/_/g, ' '))}</span>`;
}

function bucketAmt(rows, from, to) {
  return rows.filter((c) => c.due_date >= from && c.due_date <= to && !['cancelled', 'cleared', 'bounced'].includes(c.status))
    .reduce((s, c) => s + Number(c.amount || 0), 0);
}
function bucketN(rows, from, to) {
  return rows.filter((c) => c.due_date >= from && c.due_date <= to && !['cancelled', 'cleared', 'bounced'].includes(c.status)).length;
}

function statBlock(title, ico, rows, dir) {
  const list = rows.filter((c) => c.direction === dir);
  const count = (st) => {
    if (st === 'all') return list;
    if (st === 'overdue') return list.filter(isOverdue);
    return list.filter((c) => c.status === st);
  };
  return `<div class="ov-card">
    <h2>${ico} ${esc(title)}</h2>
    <table class="ov-table chq-stat">
      <thead><tr><th></th><th>Total Cheques</th><th>Total Amount</th></tr></thead>
      <tbody>${STATS.map(([st, lab]) => {
        const set = count(st);
        const n = set.length;
        const amt = set.reduce((s, c) => s + Number(c.amount || 0), 0);
        return `<tr><td>${esc(lab)}</td><td>${n}</td><td>${fmt(amt)}</td></tr>`;
      }).join('')}</tbody>
    </table>
  </div>`;
}

function paintDash(app, rows) {
  const t = today();
  const tom = addDays(t, 1);
  const d7 = addDays(t, 7);
  const d30 = addDays(t, 30);
  const due = [
    ['Today', t, t, '#dc2626'],
    ['Tomorrow', tom, tom, '#ea580c'],
    ['Next 7 Days', t, d7, '#2563eb'],
    ['Next 30 Days', t, d30, '#16a34a'],
  ];
  const overdue = rows.filter(isOverdue);
  const recent = [...rows].sort((a, b) => String(b.date).localeCompare(a.date)).slice(0, 6);
  app.innerHTML = `
    ${navHtml('cheques')}
    ${chqNav('dash')}
    <div class="acc-top"><div><h1>Dashboard</h1></div></div>
    <div class="ov-grid">
      ${statBlock('Cheques Received', '↓', rows, 'in')}
      ${statBlock('Cheques Issued', '↑', rows, 'out')}
      <div class="ov-card">
        <h2>📅 Upcoming Due Cheques</h2>
        <table class="ov-table"><thead><tr><th>Due</th><th>Cheques</th><th>Amount</th></tr></thead>
        <tbody>${due.map(([lab, a, b, col]) =>
          `<tr><td style="color:${col};font-weight:700">${lab}</td><td>${bucketN(rows, a, b)}</td><td>${fmt(bucketAmt(rows, a, b))}</td></tr>`
        ).join('')}</tbody></table>
        ${bucketN(rows, t, d30) ? '' : '<p class="chq-ok">✓ No upcoming due cheques.</p>'}
      </div>
      <div class="ov-card">
        <h2>↝ Expected Cash Flow (Incoming vs Outgoing)</h2>
        <table class="ov-table"><thead><tr><th>Period</th><th>Expected Incoming</th><th>Expected Outgoing</th><th>Net Cash Flow</th></tr></thead>
        <tbody>${due.map(([lab, a, b]) => {
          const inn = bucketAmt(rows.filter((c) => c.direction === 'in'), a, b);
          const out = bucketAmt(rows.filter((c) => c.direction === 'out'), a, b);
          const net = inn - out;
          return `<tr><td>${lab}</td><td>${fmt(inn)}</td><td>${fmt(out)}</td><td style="color:${net >= 0 ? '#16a34a' : '#dc2626'}">${net >= 0 ? '+' : ''}${fmt(net)}</td></tr>`;
        }).join('')}</tbody></table>
      </div>
      <div class="ov-card">
        <h2>⚠ Overdue Cheques Alert</h2>
        ${overdue.length
          ? `<table class="ov-table"><thead><tr><th>Number</th><th>Party</th><th>Due</th><th>Amount</th></tr></thead><tbody>${
            overdue.map((c) => `<tr><td>${esc(c.cheque_number)}</td><td>${esc(c.party)}</td><td>${fmtDate(c.due_date)}</td><td>${fmt(c.amount)}</td></tr>`).join('')
          }</tbody></table>`
          : `<div class="chq-ok"><strong>✓ All Clear!</strong><br>No overdue cheques. All cheques are on track.<br><span class="ult-muted">Note: Cheques must have a due date to appear in the overdue alert.</span></div>`}
      </div>
      <div class="ov-card">
        <h2>⏱ Recent Cheques Activity</h2>
        <table class="ov-table"><thead><tr><th>Date</th><th>Number</th><th>Party</th><th>Dir</th><th>Amount</th><th>Status</th></tr></thead>
        <tbody>${recent.map((c) => `<tr>
          <td>${fmtDate(c.date)}</td><td>${esc(c.cheque_number)}</td><td>${esc(c.party)}</td>
          <td>${c.direction === 'in' ? 'Received' : 'Issued'}</td><td>${fmt(c.amount)}</td><td>${pill(effectiveStatus(c))}</td>
        </tr>`).join('')}</tbody></table>
      </div>
    </div>`;
  bindHeadClicks(app);
}

function paintList(app, rows, dir) {
  const view = dir === 'in' ? 'received' : 'issued';
  const title = dir === 'in' ? 'Cheques Received' : 'Cheques Issued';
  const partyLab = dir === 'in' ? 'Customer' : 'Supplier';
  const dateLab = dir === 'in' ? 'Received On' : 'Paid on';
  let status = '', party = '', assignee = '', q = '';
  const parties = [...new Set(rows.filter((c) => c.direction === dir).map((c) => c.party))];
  const filtered = () => rows.filter((c) => {
    if (c.direction !== dir) return false;
    if (status && (status === 'overdue' ? !isOverdue(c) : c.status !== status)) return false;
    if (party && c.party !== party) return false;
    if (assignee && c.assigned_to !== assignee) return false;
    if (q && !String(c.cheque_number).toLowerCase().includes(q.toLowerCase())) return false;
    return true;
  });

  function draw() {
    const list = filtered();
    const tot = list.reduce((s, c) => s + Number(c.amount || 0), 0);
    app.innerHTML = `
      ${navHtml('cheques')}
      ${chqNav(view)}
      <div class="acc-top"><div><h1>${title}</h1></div>
        <button type="button" class="ult-btn ult-btn-primary" id="chq-add">+ Add cheque</button></div>
      ${filtersCard(`
        <label>Status<select id="f-st"><option value="">All</option>${STATS.slice(1).map(([k, l]) => `<option value="${k}">${l}</option>`).join('')}</select></label>
        <label>${partyLab}<select id="f-party"><option value="">All</option>${parties.map((p) => `<option>${esc(p)}</option>`).join('')}</select></label>
        <label>Cheque Assigned To<select id="f-asg"><option value="">All</option>${STAFF.map((s) => `<option>${s}</option>`).join('')}</select></label>
        <label>Cheque Number<input id="f-no" placeholder="Cheque Number" /></label>
      `)}
      <div class="home-card">
        ${tableBar()}
        <div class="ult-table-wrap"><table class="ult-table" id="chq-tbl">
          <thead><tr>
            <th>Cheque Number</th><th>${dateLab}</th><th>Reference No</th><th>${partyLab}</th>
            <th>Amount</th><th>Status</th><th>Transaction Type</th><th>Cheque Assigned To</th>
            <th>Due Date</th><th>Cleared Date</th><th>User</th><th>Action</th>
          </tr></thead>
          <tbody>${list.map((c) => `<tr>
            <td><strong>${esc(c.cheque_number)}</strong></td>
            <td>${fmtDate(c.date)}</td>
            <td>${esc(c.reference)}</td>
            <td>${esc(c.party)}</td>
            <td>${fmt(c.amount)}</td>
            <td>${pill(effectiveStatus(c))}</td>
            <td>${esc(c.txn_type.replace(/_/g, ' '))}</td>
            <td>${esc(c.assigned_to)}</td>
            <td>${fmtDate(c.due_date)}</td>
            <td>${c.cleared_date ? fmtDate(c.cleared_date) : '—'}</td>
            <td>${esc(c.user)}</td>
            <td><button type="button" class="ult-btn ult-btn-outline ult-btn-sm" data-clear="${c.id}">Clear</button></td>
          </tr>`).join('') || `<tr><td colspan="12" class="ult-muted">No data available in table</td></tr>`}</tbody>
          <tfoot><tr class="tot"><th colspan="4">Total:</th><th>${fmt(tot)}</th><th colspan="7"></th></tr></tfoot>
        </table></div>
        ${tableFoot()}
      </div>`;
    app.querySelector('#f-st').value = status;
    app.querySelector('#f-party').value = party;
    app.querySelector('#f-asg').value = assignee;
    app.querySelector('#f-no').value = q;
    bindFilt(app);
    bindTable(app, { title, storageKey: 'chq-' + view });
    app.querySelector('#f-st').onchange = (e) => { status = e.target.value; draw(); };
    app.querySelector('#f-party').onchange = (e) => { party = e.target.value; draw(); };
    app.querySelector('#f-asg').onchange = (e) => { assignee = e.target.value; draw(); };
    app.querySelector('#f-no').oninput = (e) => { q = e.target.value; draw(); };
    app.querySelector('#chq-add').onclick = () => openAdd(dir, () => paint());
    app.querySelectorAll('[data-clear]').forEach((b) => {
      b.onclick = () => {
        const all = loadCheques().map((c) => String(c.id) === String(b.dataset.clear)
          ? { ...c, status: 'cleared', cleared_date: today() } : c);
        writeLs(CHQ_KEY, all);
        paint();
      };
    });
    bindHeadClicks(app);
  }
  draw();
}

function openAdd(dir, onDone) {
  const host = document.createElement('div');
  host.innerHTML = modalShell(dir === 'in' ? 'Add cheque received' : 'Add cheque issued', `
    <div class="ult-form-grid">
      <div class="ult-field"><label>Cheque number</label><input id="c-no" /></div>
      <div class="ult-field"><label>${dir === 'in' ? 'Customer' : 'Supplier'}</label><input id="c-party" /></div>
      <div class="ult-field"><label>Amount</label><input id="c-amt" type="number" step="0.01" /></div>
      <div class="ult-field"><label>Date</label><input id="c-date" type="date" value="${today()}" /></div>
      <div class="ult-field"><label>Due date</label><input id="c-due" type="date" /></div>
      <div class="ult-field"><label>Assigned to</label><select id="c-asg">${STAFF.map((s) => `<option>${s}</option>`).join('')}</select></div>
      <div class="ult-field" style="grid-column:1/-1"><label>Reference</label><input id="c-ref" /></div>
    </div>`, `<button type="button" class="ult-btn ult-btn-outline" data-close>Cancel</button>
      <button type="button" class="ult-btn ult-btn-primary" id="c-save">Save</button>`);
  document.body.appendChild(host);
  host.querySelector('[data-close]').onclick = () => host.remove();
  host.querySelector('#pay-modal').onclick = (e) => { if (e.target.id === 'pay-modal') host.remove(); };
  host.querySelector('#c-save').onclick = () => {
    const no = host.querySelector('#c-no').value.trim();
    const amt = Number(host.querySelector('#c-amt').value) || 0;
    if (!no || !amt) return alert('Number and amount required');
    const rows = loadCheques();
    rows.unshift({
      id: uid(), direction: dir, cheque_number: no,
      date: host.querySelector('#c-date').value || today(),
      reference: host.querySelector('#c-ref').value.trim(),
      party: host.querySelector('#c-party').value.trim() || '—',
      amount: amt, status: 'pending', txn_type: dir === 'in' ? 'sale' : 'purchase',
      assigned_to: host.querySelector('#c-asg').value, due_date: host.querySelector('#c-due').value,
      cleared_date: '', user: 'HQ Finance', subsidiary_code: subCode(), bank_name: 'GCB Bank',
    });
    writeLs(CHQ_KEY, rows);
    host.remove();
    onDone();
  };
}

function upsertById(key, row) {
  if (!row?.id) return;
  const rows = readLs(key, []) || [];
  const i = rows.findIndex((r) => String(r.id) === String(row.id) || (row.account_number && String(r.account_number) === String(row.account_number)));
  if (i >= 0) rows[i] = { ...rows[i], ...row };
  else rows.unshift(row);
  writeLs(key, rows);
}

function payBankRows() {
  const types = new Set(['pat-bank', 'pat-save', 'Bank Account', 'Savings Account']);
  return (readLs(PAY_KEYS.accounts, []) || []).filter((a) => {
    if (a.is_closed) return false;
    const t = String(a.account_type_id || a.type || '');
    const name = String(a.name || a.note || '');
    return types.has(t) || /bank|uba|gcb|ecobank|stanbic|fidelity|absa|overdraft|oda/i.test(name + t);
  });
}

function mergeEnteredBanks() {
  ensureGhanaBankCat();
  const banks = firstRows(null, FIN_KEYS.ghanaBanks);
  const byNum = new Map();
  (firstRows(null, FIN_KEYS.ghanaAcc) || []).forEach((a) => {
    if (!a) return;
    byNum.set(String(a.account_number || a.id), a);
  });
  payBankRows().forEach((p) => {
    const num = String(p.account_number || p.id);
    if (!num || byNum.has(num)) return;
    const bankName = Array.isArray(p.account_details) ? (p.account_details.find((d) => /bank/i.test(d[0] || ''))?.[1] || '') : (p.bank_name || '');
    const cat = banks.find((b) => String(b.name).toLowerCase().includes(String(bankName || p.name || '').toLowerCase().split(' ')[0])) || banks.find((b) => /uba/i.test(p.name || ''));
    const row = {
      id: 'gba-pay-' + String(p.id),
      bank_id: cat?.id,
      label: p.name || 'Bank account',
      account_number: p.account_number || '',
      branch: Array.isArray(p.account_details) ? (p.account_details.find((d) => /branch/i.test(d[0] || ''))?.[1] || '') : (p.branch || ''),
      subsidiary_code: p.subsidiary_code || subCode(),
      ghana_banks: cat ? { name: cat.name, code: cat.code } : { name: bankName || 'Bank', code: '' },
      source: p.source || 'payment_accounts',
      opening_balance: p.opening_balance,
    };
    byNum.set(num, row);
    upsertById(FIN_KEYS.ghanaAcc, row);
  });
  return { banks, accounts: [...byNum.values()] };
}

async function pullUbaIntoBanks() {
  try {
    const book = await import('./uba-fiberk-book.js');
    book.hydrateFromPack();
    await book.postLive();
  } catch { /* uba pack optional */ }
}

function ubaJumpHtml(acc) {
  const row = acc || (readLs('df_uba_accounts', []) || []).find((a) => String(a.account_number) === '03216347302516');
  const bal = row ? Number(row.total_balance || row.available_balance || 0) : 0;
  return `<a class="uba-jump" href="/uba-fiberk.html">
      <strong>UBA Fiberk · 03216347302516</strong>
      <span>FIBERK · Overdraft (ODA)${row ? ' · ' + fmt(bal) : ''} · Internet Banking book. Open for the statement.</span>
    </a>`;
}

async function paintBanks(app) {
  ensureFinanceOps();
  ensureGhanaBankCat();
  await pullUbaIntoBanks();
  const { banks, accounts } = mergeEnteredBanks();
  const txns = firstRows(null, FIN_KEYS.ghanaTxns);
  const ubaTxns = firstRows(null, 'df_uba_transactions');
  const inAmt = txns.filter((x) => x.direction === 'in').reduce((s, x) => s + Number(x.amount || x.deposit || 0), 0)
    || ubaTxns.reduce((s, x) => s + Number(x.deposit || 0), 0);
  const outAmt = txns.filter((x) => x.direction === 'out').reduce((s, x) => s + Number(x.amount || x.withdrawal || 0), 0)
    || ubaTxns.reduce((s, x) => s + Number(x.withdrawal || 0), 0);
  const ubaAcc = accounts.find((a) => String(a.account_number) === '03216347302516')
    || (readLs('df_uba_accounts', []) || []).find((a) => String(a.account_number) === '03216347302516');
  app.innerHTML = `
    ${navHtml('banks')}
    <div class="acc-top"><div><h1>Banks</h1><p class="sub">Ghana bank accounts · ${esc(subShort())}</p></div>
      <button type="button" class="ult-btn ult-btn-primary" id="add-acc">+ Add account</button></div>
    ${ubaJumpHtml(ubaAcc)}
    <div class="ult-kpis">
      <div class="ult-kpi"><div class="ult-kpi-icon blue">🏦</div><div class="ult-kpi-body"><div class="ult-kpi-label">Accounts</div><div class="ult-kpi-value">${accounts.length}</div></div></div>
      <div class="ult-kpi"><div class="ult-kpi-icon green">↓</div><div class="ult-kpi-body"><div class="ult-kpi-label">In</div><div class="ult-kpi-value">${fmt(inAmt)}</div></div></div>
      <div class="ult-kpi"><div class="ult-kpi-icon orange">↑</div><div class="ult-kpi-body"><div class="ult-kpi-label">Out</div><div class="ult-kpi-value">${fmt(outAmt)}</div></div></div>
    </div>
    <div class="ult-card">
      <strong>Banks in catalogue</strong>
      <div style="display:flex;gap:8px;flex-wrap:wrap;margin-top:8px">
        ${banks.map((p) => `<span class="ult-badge ult-badge-paid">${esc(p.name)}</span>`).join('') || '<span class="ult-muted">Catalogue will seed on this visit.</span>'}
      </div>
    </div>
    <div class="ult-card">
      <strong>Accounts</strong>
      <div class="ult-table-wrap" style="margin-top:10px"><table class="ult-table">
        <thead><tr><th>Label</th><th>Bank</th><th>Number</th><th>Branch</th></tr></thead>
        <tbody>${accounts.map((w) => `<tr>
          <td><strong>${esc(w.label || w.nickname || w.name)}</strong></td>
          <td>${esc(w.ghana_banks?.name || w.bank_name || '—')}</td>
          <td>${esc(w.account_number)}</td>
          <td>${esc(w.branch || '—')}</td>
        </tr>`).join('') || '<tr data-dummy="1"><td colspan="4">No accounts on this book yet. Use + Add account, or open UBA Fiberk to post the Internet Banking statement.</td></tr>'}</tbody>
      </table></div>
    </div>
    <div class="ult-card">
      <div style="display:flex;justify-content:space-between;margin-bottom:10px"><strong>Movements</strong>
        <button type="button" class="ult-btn ult-btn-success" id="add-txn">+ Record</button></div>
      <div class="ult-table-wrap"><table class="ult-table">
        <thead><tr><th>Date</th><th>Account</th><th>Dir</th><th>Amount</th><th>Ref</th><th>Who</th></tr></thead>
        <tbody>${(txns.length ? txns : ubaTxns).slice(0, 80).map((t) => `<tr>
          <td>${fmtDate(t.txn_date)}</td>
          <td>${esc(t.ghana_bank_accounts?.label || t.account_name || ubaAcc?.nickname || '—')}</td>
          <td>${esc(t.direction || (Number(t.withdrawal) ? 'out' : 'in'))}</td>
          <td>${fmt(t.amount || t.withdrawal || t.deposit)}</td>
          <td>${esc(t.reference || t.remarks || '—')}</td>
          <td>${esc(t.counterparty || t.payee || '—')}</td>
        </tr>`).join('') || '<tr data-dummy="1"><td colspan="6">No movements yet.</td></tr>'}</tbody>
      </table></div>
    </div>`;
  app.querySelector('#add-acc').onclick = () => addBankAccount(banks, () => paint());
  app.querySelector('#add-txn').onclick = () => addMovement(accounts, () => paint());
  bindHeadClicks(app);
}

function addBankAccount(banks, onDone) {
  const host = document.createElement('div');
  host.innerHTML = modalShell('Add account', `
    <div class="ult-form-grid">
      <div class="ult-field"><label>Bank</label><select id="a-bank">${banks.map((b) => `<option value="${esc(b.id)}">${esc(b.name)}</option>`).join('')}</select></div>
      <div class="ult-field"><label>Label</label><input id="a-label" /></div>
      <div class="ult-field"><label>Account number</label><input id="a-num" /></div>
      <div class="ult-field"><label>Branch</label><input id="a-branch" /></div>
    </div>`, `<button type="button" class="ult-btn ult-btn-outline" data-close>Cancel</button>
      <button type="button" class="ult-btn ult-btn-primary" id="a-save">Save</button>`);
  document.body.appendChild(host);
  host.querySelector('[data-close]').onclick = () => host.remove();
  host.querySelector('#a-save').onclick = async () => {
    const num = host.querySelector('#a-num').value.trim();
    if (!num) return alert('Account number required');
    const bank = banks.find((b) => String(b.id) === String(host.querySelector('#a-bank').value));
    await saveRow('ghana_bank_accounts', FIN_KEYS.ghanaAcc, {
      bank_id: bank?.id, label: host.querySelector('#a-label').value.trim() || 'Account',
      account_number: num, branch: host.querySelector('#a-branch').value.trim(),
      subsidiary_code: subCode(), ghana_banks: bank ? { name: bank.name, code: bank.code } : null,
    });
    host.remove(); onDone();
  };
}

function addMovement(accounts, onDone) {
  const host = document.createElement('div');
  host.innerHTML = modalShell('Record movement', `
    <div class="ult-form-grid">
      <div class="ult-field"><label>Account</label><select id="t-acc">${accounts.map((a) => `<option value="${esc(a.id)}">${esc(a.label)}</option>`).join('')}</select></div>
      <div class="ult-field"><label>Direction</label><select id="t-dir"><option value="in">In</option><option value="out">Out</option></select></div>
      <div class="ult-field"><label>Amount</label><input id="t-amt" type="number" step="0.01" /></div>
      <div class="ult-field"><label>Date</label><input id="t-date" type="date" value="${today()}" /></div>
      <div class="ult-field"><label>Reference</label><input id="t-ref" /></div>
      <div class="ult-field"><label>Who</label><input id="t-who" /></div>
    </div>`, `<button type="button" class="ult-btn ult-btn-outline" data-close>Cancel</button>
      <button type="button" class="ult-btn ult-btn-primary" id="t-save">Save</button>`);
  document.body.appendChild(host);
  host.querySelector('[data-close]').onclick = () => host.remove();
  host.querySelector('#t-save').onclick = async () => {
    const id = host.querySelector('#t-acc').value;
    const acc = accounts.find((a) => String(a.id) === String(id));
    await saveRow('ghana_bank_transactions', FIN_KEYS.ghanaTxns, {
      account_id: id, direction: host.querySelector('#t-dir').value,
      amount: Number(host.querySelector('#t-amt').value) || 0,
      reference: host.querySelector('#t-ref').value, counterparty: host.querySelector('#t-who').value,
      txn_date: host.querySelector('#t-date').value, subsidiary_code: subCode(),
      ghana_bank_accounts: acc ? { label: acc.label, account_number: acc.account_number } : null,
    });
    host.remove(); onDone();
  };
}

async function paintDebit(app) {
  ensureFinanceOps();
  const rows = firstRows(null, FIN_KEYS.debit);
  const tot = rows.reduce((s, r) => s + Number(r.total_amount || 0), 0);
  app.innerHTML = `
    ${navHtml('debit')}
    <div class="acc-top"><div><h1>Debit Notes</h1><p class="sub">Vendor returns and adjustments</p></div>
      <button type="button" class="ult-btn ult-btn-danger" id="dn-add">+ New Debit Note</button></div>
    <div class="ult-kpis">
      <div class="ult-kpi"><div class="ult-kpi-icon blue">#</div><div class="ult-kpi-body"><div class="ult-kpi-label">Total</div><div class="ult-kpi-value">${rows.length}</div></div></div>
      <div class="ult-kpi"><div class="ult-kpi-icon green">$</div><div class="ult-kpi-body"><div class="ult-kpi-label">Total Debited</div><div class="ult-kpi-value">${fmt(tot)}</div></div></div>
    </div>
    <div class="home-card">${tableBar()}
      <div class="ult-table-wrap"><table class="ult-table">
        <thead><tr><th>DN #</th><th>Vendor</th><th>Reason</th><th>Amount</th><th>Status</th></tr></thead>
        <tbody>${rows.map((r) => `<tr>
          <td><strong>${esc(r.reference)}</strong></td><td>${esc(r.supplier_name)}</td>
          <td>${esc(r.reason)}</td><td>${fmt(r.total_amount)}</td>
          <td><span class="pill ${r.status === 'applied' ? 'received' : 'pending'}">${esc(r.status || '')}</span></td>
        </tr>`).join('')}</tbody>
      </table></div>${tableFoot()}
    </div>`;
  bindTable(app, { title: 'Debit Notes', storageKey: 'bank-dn' });
  app.querySelector('#dn-add').onclick = () => addDebit(() => paint());
  bindHeadClicks(app);
}

function vendorNames() {
  const rows = readLs('df_suppliers', []);
  return (Array.isArray(rows) ? rows : []).map((s) => s.name).filter(Boolean);
}

function addDebit(onDone) {
  const vendors = vendorNames();
  const host = document.createElement('div');
  host.innerHTML = modalShell('New Debit Note', `
    <div class="ult-form-grid">
      <div class="ult-field"><label>Vendor</label><select id="d-sup">${vendors.map((v) => `<option>${v}</option>`).join('')}</select></div>
      <div class="ult-field"><label>Reason</label><select id="d-rs"><option value="return">Return</option><option value="adjustment">Adjustment</option><option value="other">Other</option></select></div>
      <div class="ult-field"><label>Amount</label><input id="d-amt" type="number" step="0.01" /></div>
      <div class="ult-field" style="grid-column:1/-1"><label>Details</label><input id="d-det" /></div>
    </div>`, `<button type="button" class="ult-btn ult-btn-outline" data-close>Cancel</button>
      <button type="button" class="ult-btn ult-btn-danger" id="d-save">Create</button>`);
  document.body.appendChild(host);
  host.querySelector('[data-close]').onclick = () => host.remove();
  host.querySelector('#d-save').onclick = async () => {
    const amt = Number(host.querySelector('#d-amt').value) || 0;
    if (!amt) return alert('Amount required');
    await saveRow('debit_notes', FIN_KEYS.debit, {
      reference: 'DN-' + Date.now().toString().slice(-6),
      supplier_name: host.querySelector('#d-sup').value,
      reason: host.querySelector('#d-rs').value,
      reason_details: host.querySelector('#d-det').value,
      status: 'applied', total_amount: amt, subsidiary_code: subCode(),
    });
    host.remove(); onDone();
  };
}

async function paintPay(app) {
  ensureFinanceOps();
  const rows = firstRows(null, FIN_KEYS.pay);
  const tot = rows.reduce((s, r) => s + Number(r.amount || 0), 0);
  const by = (m) => rows.filter((x) => x.method === m).reduce((s, x) => s + Number(x.amount || 0), 0);
  app.innerHTML = `
    ${navHtml('payments')}
    <div class="acc-top"><div><h1>Payments</h1><p class="sub">Vendor payments (vouchers)</p></div>
      <button type="button" class="ult-btn ult-btn-success" id="pp-add">+ Record Payment</button></div>
    <div class="ult-kpis">
      <div class="ult-kpi"><div class="ult-kpi-icon blue">#</div><div class="ult-kpi-body"><div class="ult-kpi-label">Total Payments</div><div class="ult-kpi-value">${rows.length}</div></div></div>
      <div class="ult-kpi"><div class="ult-kpi-icon green">$</div><div class="ult-kpi-body"><div class="ult-kpi-label">Total Paid</div><div class="ult-kpi-value">${fmt(tot)}</div></div></div>
      <div class="ult-kpi"><div class="ult-kpi-icon cyan">Cash</div><div class="ult-kpi-body"><div class="ult-kpi-label">Cash</div><div class="ult-kpi-value">${fmt(by('cash'))}</div></div></div>
      <div class="ult-kpi"><div class="ult-kpi-icon blue">Bank</div><div class="ult-kpi-body"><div class="ult-kpi-label">Bank</div><div class="ult-kpi-value">${fmt(by('bank'))}</div></div></div>
    </div>
    <div class="home-card">${tableBar()}
      <div class="ult-table-wrap"><table class="ult-table">
        <thead><tr><th>Payment #</th><th>Vendor</th><th>Invoice</th><th>Date</th><th>Method</th><th>Amount</th><th>Reference</th></tr></thead>
        <tbody>${rows.map((r) => `<tr>
          <td><strong>${esc(r.reference)}</strong></td><td>${esc(r.supplier_name)}</td>
          <td>${esc(r.invoice_reference || '—')}</td><td>${fmtDate(r.payment_date)}</td>
          <td><span class="pill ${r.method === 'cash' ? 'received' : r.method === 'bank' ? 'partial' : 'pending'}">${esc(r.method)}</span></td>
          <td style="color:#16a34a;font-weight:700">${fmt(r.amount)}</td>
          <td>${esc(r.external_ref || '—')}</td>
        </tr>`).join('')}</tbody>
      </table></div>${tableFoot()}
    </div>`;
  bindTable(app, { title: 'Payments', storageKey: 'bank-pp' });
  app.querySelector('#pp-add').onclick = () => addPay(() => paint());
  bindHeadClicks(app);
}

function addPay(onDone) {
  const vendors = vendorNames();
  const host = document.createElement('div');
  host.innerHTML = modalShell('Record Payment', `
    <div class="ult-form-grid">
      <div class="ult-field"><label>Vendor</label><select id="p-sup">${vendors.map((v) => `<option>${v}</option>`).join('')}</select></div>
      <div class="ult-field"><label>Method</label><select id="p-m"><option value="bank">Bank</option><option value="cash">Cash</option><option value="momo">MoMo</option><option value="cheque">Cheque</option></select></div>
      <div class="ult-field"><label>Date</label><input id="p-date" type="date" value="${today()}" /></div>
      <div class="ult-field"><label>Amount</label><input id="p-amt" type="number" step="0.01" /></div>
      <div class="ult-field" style="grid-column:1/-1"><label>Reference</label><input id="p-ref" /></div>
    </div>`, `<button type="button" class="ult-btn ult-btn-outline" data-close>Cancel</button>
      <button type="button" class="ult-btn ult-btn-success" id="p-save">Save</button>`);
  document.body.appendChild(host);
  host.querySelector('[data-close]').onclick = () => host.remove();
  host.querySelector('#p-save').onclick = async () => {
    const amt = Number(host.querySelector('#p-amt').value) || 0;
    if (!amt) return alert('Amount required');
    await saveRow('purchase_payments', FIN_KEYS.pay, {
      reference: 'PV-' + Date.now().toString().slice(-6),
      supplier_name: host.querySelector('#p-sup').value,
      payment_date: host.querySelector('#p-date').value, method: host.querySelector('#p-m').value,
      amount: amt, external_ref: host.querySelector('#p-ref').value, subsidiary_code: subCode(),
    });
    host.remove(); onDone();
  };
}

function paintMomo(app) {
  ensureRails();
  const providers = readLs(RAIL.momoProv, []);
  const wallets = readLs(RAIL.momoWal, []);
  const txns = readLs(RAIL.momoTxn, []);
  const inAmt = txns.filter((x) => x.direction === 'in').reduce((s, x) => s + Number(x.amount), 0);
  const outAmt = txns.filter((x) => x.direction === 'out').reduce((s, x) => s + Number(x.amount), 0);
  app.innerHTML = `
    ${navHtml('momo')}
    <div class="acc-top"><div><h1>Mobile Money</h1><p class="sub">Ghana wallets · MTN, Telecel, AirtelTigo · ${esc(subShort())}</p></div>
      <button type="button" class="ult-btn ult-btn-primary" id="mw-add">+ Add wallet</button></div>
    <div class="ult-kpis">
      <div class="ult-kpi"><div class="ult-kpi-icon amber">📱</div><div class="ult-kpi-body"><div class="ult-kpi-label">Wallets</div><div class="ult-kpi-value">${wallets.length}</div></div></div>
      <div class="ult-kpi"><div class="ult-kpi-icon green">↓</div><div class="ult-kpi-body"><div class="ult-kpi-label">In</div><div class="ult-kpi-value">${fmt(inAmt)}</div></div></div>
      <div class="ult-kpi"><div class="ult-kpi-icon orange">↑</div><div class="ult-kpi-body"><div class="ult-kpi-label">Out</div><div class="ult-kpi-value">${fmt(outAmt)}</div></div></div>
    </div>
    <div class="ult-card"><strong>Providers</strong>
      <div style="display:flex;gap:8px;flex-wrap:wrap;margin-top:8px">
        ${providers.map((p) => `<span class="ult-badge ult-badge-paid">${esc(p.name)}</span>`).join('')}
      </div>
    </div>
    <div class="ult-card"><strong>Wallets</strong>
      <div class="ult-table-wrap" style="margin-top:10px"><table class="ult-table">
        <thead><tr><th>Label</th><th>Provider</th><th>Number</th><th>Name</th></tr></thead>
        <tbody>${wallets.map((w) => `<tr>
          <td><strong>${esc(w.label)}</strong></td>
          <td>${esc(w.momo_providers?.name || '—')}</td>
          <td>${esc(w.msisdn)}</td>
          <td>${esc(w.account_name || '—')}</td>
        </tr>`).join('')}</tbody>
      </table></div>
    </div>
    <div class="ult-card">
      <div style="display:flex;justify-content:space-between;margin-bottom:10px"><strong>Transactions</strong>
        <button type="button" class="ult-btn ult-btn-success" id="mt-add">+ Record</button></div>
      <div class="ult-table-wrap"><table class="ult-table">
        <thead><tr><th>Date</th><th>Wallet</th><th>Dir</th><th>Amount</th><th>Ref</th><th>Who</th></tr></thead>
        <tbody>${txns.map((t) => `<tr>
          <td>${fmtDate(t.txn_date)}</td>
          <td>${esc(t.momo_wallets?.label || '—')}</td>
          <td>${esc(t.direction)}</td>
          <td>${fmt(t.amount)}</td>
          <td>${esc(t.reference || '—')}</td>
          <td>${esc(t.counterparty || '—')}</td>
        </tr>`).join('')}</tbody>
      </table></div>
    </div>`;
  app.querySelector('#mw-add').onclick = () => addMomoWallet(providers, () => paint());
  app.querySelector('#mt-add').onclick = () => addMomoTxn(wallets, () => paint());
  bindHeadClicks(app);
}

function addMomoWallet(providers, onDone) {
  const host = document.createElement('div');
  host.innerHTML = modalShell('Add wallet', `
    <div class="ult-form-grid">
      <div class="ult-field"><label>Provider</label><select id="w-prov">${providers.map((p) => `<option value="${esc(p.id)}">${esc(p.name)}</option>`).join('')}</select></div>
      <div class="ult-field"><label>Label</label><input id="w-label" placeholder="MTN Shop Accra" /></div>
      <div class="ult-field"><label>MSISDN</label><input id="w-msisdn" placeholder="024xxxxxxx" /></div>
      <div class="ult-field"><label>Account name</label><input id="w-name" /></div>
    </div>`, `<button type="button" class="ult-btn ult-btn-outline" data-close>Cancel</button>
      <button type="button" class="ult-btn ult-btn-primary" id="w-save">Save</button>`);
  document.body.appendChild(host);
  host.querySelector('[data-close]').onclick = () => host.remove();
  host.querySelector('#w-save').onclick = () => {
    const msisdn = host.querySelector('#w-msisdn').value.trim();
    if (!msisdn) return alert('MSISDN required');
    const prov = providers.find((p) => String(p.id) === String(host.querySelector('#w-prov').value));
    const rows = readLs(RAIL.momoWal, []);
    rows.unshift({
      id: uid(), provider_id: prov?.id, label: host.querySelector('#w-label').value.trim() || 'Wallet',
      msisdn, account_name: host.querySelector('#w-name').value.trim(), subsidiary_code: subCode(),
      momo_providers: prov ? { name: prov.name, code: prov.code } : null,
    });
    writeLs(RAIL.momoWal, rows);
    host.remove(); onDone();
  };
}

function addMomoTxn(wallets, onDone) {
  const host = document.createElement('div');
  host.innerHTML = modalShell('Record MoMo', `
    <div class="ult-form-grid">
      <div class="ult-field"><label>Wallet</label><select id="t-w">${wallets.map((w) => `<option value="${esc(w.id)}">${esc(w.label)}</option>`).join('')}</select></div>
      <div class="ult-field"><label>Direction</label><select id="t-dir"><option value="in">In (received)</option><option value="out">Out (sent)</option></select></div>
      <div class="ult-field"><label>Amount (GHS)</label><input id="t-amt" type="number" step="0.01" /></div>
      <div class="ult-field"><label>Date</label><input id="t-date" type="date" value="${today()}" /></div>
      <div class="ult-field"><label>Reference / MoMo ID</label><input id="t-ref" /></div>
      <div class="ult-field"><label>Counterparty</label><input id="t-who" /></div>
    </div>`, `<button type="button" class="ult-btn ult-btn-outline" data-close>Cancel</button>
      <button type="button" class="ult-btn ult-btn-primary" id="t-save">Save</button>`);
  document.body.appendChild(host);
  host.querySelector('[data-close]').onclick = () => host.remove();
  host.querySelector('#t-save').onclick = () => {
    const id = host.querySelector('#t-w').value;
    const w = wallets.find((x) => String(x.id) === String(id));
    const amt = Number(host.querySelector('#t-amt').value) || 0;
    if (!amt) return alert('Amount required');
    const rows = readLs(RAIL.momoTxn, []);
    rows.unshift({
      id: uid(), wallet_id: id, direction: host.querySelector('#t-dir').value, amount: amt,
      reference: host.querySelector('#t-ref').value, counterparty: host.querySelector('#t-who').value,
      txn_date: host.querySelector('#t-date').value, subsidiary_code: subCode(),
      momo_wallets: w ? { label: w.label, msisdn: w.msisdn } : null,
    });
    writeLs(RAIL.momoTxn, rows);
    host.remove(); onDone();
  };
}

function paintCrypto(app) {
  ensureRails();
  const assets = readLs(RAIL.cryAst, []);
  const wallets = readLs(RAIL.cryWal, []);
  const txns = readLs(RAIL.cryTxn, []);
  const ghs = txns.reduce((s, x) => s + Number(x.amount_ghs || 0) * (x.direction === 'in' ? 1 : -1), 0);
  app.innerHTML = `
    ${navHtml('crypto')}
    <div class="acc-top"><div><h1>Crypto</h1><p class="sub">Wallets & movements · USDT / BTC / ETH · ${esc(subShort())}</p></div>
      <button type="button" class="ult-btn ult-btn-primary" id="cw-add">+ Add wallet</button></div>
    <div class="ult-kpis">
      <div class="ult-kpi"><div class="ult-kpi-icon amber">₿</div><div class="ult-kpi-body"><div class="ult-kpi-label">Wallets</div><div class="ult-kpi-value">${wallets.length}</div></div></div>
      <div class="ult-kpi"><div class="ult-kpi-icon green">₵</div><div class="ult-kpi-body"><div class="ult-kpi-label">Net GHS (logged)</div><div class="ult-kpi-value">${fmt(ghs)}</div></div></div>
    </div>
    <div class="ult-card"><strong>Assets in catalogue</strong>
      <div style="display:flex;gap:8px;flex-wrap:wrap;margin-top:8px">
        ${assets.map((p) => `<span class="ult-badge ult-badge-paid">${esc(p.code)} · ${esc(p.network || '')}</span>`).join('')}
      </div>
    </div>
    <div class="ult-card"><strong>Wallets</strong>
      <div class="ult-table-wrap" style="margin-top:10px"><table class="ult-table">
        <thead><tr><th>Label</th><th>Asset</th><th>Address</th></tr></thead>
        <tbody>${wallets.map((w) => `<tr>
          <td><strong>${esc(w.label)}</strong></td>
          <td>${esc(w.crypto_assets?.code || '—')}</td>
          <td style="font-size:12px;word-break:break-all">${esc(w.address || '—')}</td>
        </tr>`).join('')}</tbody>
      </table></div>
    </div>
    <div class="ult-card">
      <div style="display:flex;justify-content:space-between;margin-bottom:10px"><strong>Transactions</strong>
        <button type="button" class="ult-btn ult-btn-success" id="ct-add">+ Record</button></div>
      <div class="ult-table-wrap"><table class="ult-table">
        <thead><tr><th>Date</th><th>Wallet</th><th>Dir</th><th>Amount</th><th>GHS</th><th>Hash</th></tr></thead>
        <tbody>${txns.map((t) => `<tr>
          <td>${fmtDate(t.txn_date)}</td>
          <td>${esc(t.crypto_wallets?.label || '—')}</td>
          <td>${esc(t.direction)}</td>
          <td>${t.amount}</td>
          <td>${fmt(t.amount_ghs)}</td>
          <td style="font-size:11px;word-break:break-all">${esc(t.tx_hash || '—')}</td>
        </tr>`).join('')}</tbody>
      </table></div>
    </div>`;
  app.querySelector('#cw-add').onclick = () => addCryWallet(assets, () => paint());
  app.querySelector('#ct-add').onclick = () => addCryTxn(wallets, () => paint());
  bindHeadClicks(app);
}

function addCryWallet(assets, onDone) {
  const host = document.createElement('div');
  host.innerHTML = modalShell('Add crypto wallet', `
    <div class="ult-form-grid">
      <div class="ult-field"><label>Asset</label><select id="w-asset">${assets.map((a) => `<option value="${esc(a.id)}">${esc(a.code)} — ${esc(a.name)}</option>`).join('')}</select></div>
      <div class="ult-field"><label>Label</label><input id="w-label" placeholder="Ops USDT TRC20" /></div>
      <div class="ult-field" style="grid-column:1/-1"><label>Address</label><input id="w-addr" /></div>
    </div>`, `<button type="button" class="ult-btn ult-btn-outline" data-close>Cancel</button>
      <button type="button" class="ult-btn ult-btn-primary" id="w-save">Save</button>`);
  document.body.appendChild(host);
  host.querySelector('[data-close]').onclick = () => host.remove();
  host.querySelector('#w-save').onclick = () => {
    const ast = assets.find((a) => String(a.id) === String(host.querySelector('#w-asset').value));
    const rows = readLs(RAIL.cryWal, []);
    rows.unshift({
      id: uid(), asset_id: ast?.id, label: host.querySelector('#w-label').value.trim() || 'Wallet',
      address: host.querySelector('#w-addr').value.trim(), subsidiary_code: subCode(),
      crypto_assets: ast ? { code: ast.code, name: ast.name } : null,
    });
    writeLs(RAIL.cryWal, rows);
    host.remove(); onDone();
  };
}

function addCryTxn(wallets, onDone) {
  const host = document.createElement('div');
  host.innerHTML = modalShell('Record crypto movement', `
    <div class="ult-form-grid">
      <div class="ult-field"><label>Wallet</label><select id="t-w">${wallets.map((w) => `<option value="${esc(w.id)}">${esc(w.label)}</option>`).join('')}</select></div>
      <div class="ult-field"><label>Direction</label><select id="t-dir"><option value="in">In</option><option value="out">Out</option></select></div>
      <div class="ult-field"><label>Amount (crypto)</label><input id="t-amt" type="number" step="0.00000001" /></div>
      <div class="ult-field"><label>GHS equivalent</label><input id="t-ghs" type="number" step="0.01" /></div>
      <div class="ult-field"><label>Tx hash</label><input id="t-hash" /></div>
      <div class="ult-field"><label>Date</label><input id="t-date" type="date" value="${today()}" /></div>
    </div>`, `<button type="button" class="ult-btn ult-btn-outline" data-close>Cancel</button>
      <button type="button" class="ult-btn ult-btn-primary" id="t-save">Save</button>`);
  document.body.appendChild(host);
  host.querySelector('[data-close]').onclick = () => host.remove();
  host.querySelector('#t-save').onclick = () => {
    const id = host.querySelector('#t-w').value;
    const w = wallets.find((x) => String(x.id) === String(id));
    const rows = readLs(RAIL.cryTxn, []);
    rows.unshift({
      id: uid(), wallet_id: id, direction: host.querySelector('#t-dir').value,
      amount: Number(host.querySelector('#t-amt').value) || 0,
      amount_ghs: Number(host.querySelector('#t-ghs').value) || 0,
      tx_hash: host.querySelector('#t-hash').value, txn_date: host.querySelector('#t-date').value,
      subsidiary_code: subCode(), crypto_wallets: w ? { label: w.label } : null,
    });
    writeLs(RAIL.cryTxn, rows);
    host.remove(); onDone();
  };
}

function paintGra(app) {
  ensureRails();
  const ents = readLs(RAIL.graEnt, []);
  const fils = readLs(RAIL.graFil, []);
  const due = fils.filter((x) => x.status === 'due' || x.status === 'overdue').length;
  app.innerHTML = `
    ${navHtml('gra')}
    <div class="acc-top"><div><h1>GRA Tax</h1><p class="sub">Ghana Revenue Authority · file & pay via official portals · ${esc(subShort())}</p></div>
      <button type="button" class="ult-btn ult-btn-primary" id="ge-add">+ Add TIN / company</button></div>
    <div class="ult-card">
      <strong>Official portals</strong>
      <p class="ult-muted">GRA does not offer a public API we can embed. Keep TIN and filing dates here; file on their portals.</p>
      <div style="display:flex;gap:8px;flex-wrap:wrap;margin-top:10px">
        <a class="ult-btn ult-btn-primary" href="https://taxpayersportal.com" target="_blank" rel="noopener">Open Taxpayers Portal</a>
        <a class="ult-btn ult-btn-outline" href="https://gra.gov.gh" target="_blank" rel="noopener">gra.gov.gh</a>
        <a class="ult-btn ult-btn-success" href="https://www.ghana.gov.gh" target="_blank" rel="noopener">Pay on Ghana.gov</a>
      </div>
    </div>
    <div class="ult-kpis">
      <div class="ult-kpi"><div class="ult-kpi-icon blue">🏛️</div><div class="ult-kpi-body"><div class="ult-kpi-label">Entities / TINs</div><div class="ult-kpi-value">${ents.length}</div></div></div>
      <div class="ult-kpi"><div class="ult-kpi-icon amber">📅</div><div class="ult-kpi-body"><div class="ult-kpi-label">Due / overdue</div><div class="ult-kpi-value">${due}</div></div></div>
    </div>
    <div class="ult-card"><strong>Registered entities</strong>
      <div class="ult-table-wrap" style="margin-top:10px"><table class="ult-table">
        <thead><tr><th>Name</th><th>TIN</th><th>VAT</th><th>Tax office</th></tr></thead>
        <tbody>${ents.map((e) => `<tr>
          <td><strong>${esc(e.legal_name)}</strong></td>
          <td>${esc(e.tin || '—')}</td>
          <td>${esc(e.vat_number || '—')}</td>
          <td>${esc(e.tax_office || '—')}</td>
        </tr>`).join('')}</tbody>
      </table></div>
    </div>
    <div class="ult-card">
      <div style="display:flex;justify-content:space-between;margin-bottom:10px"><strong>Filing calendar</strong>
        <button type="button" class="ult-btn ult-btn-success" id="gf-add">+ Add filing</button></div>
      <div class="ult-table-wrap"><table class="ult-table">
        <thead><tr><th>Type</th><th>Period</th><th>Entity</th><th>Due</th><th>Amount</th><th>Status</th></tr></thead>
        <tbody>${fils.map((f) => `<tr>
          <td>${esc(f.tax_type)}</td>
          <td>${esc(f.period_label || '—')}</td>
          <td>${esc(f.gra_entities?.legal_name || '—')}</td>
          <td>${fmtDate(f.due_date)}</td>
          <td>${fmt(f.amount)}</td>
          <td><span class="pill ${f.status === 'paid' || f.status === 'filed' ? 'received' : f.status === 'overdue' ? 'overdue' : 'pending'}">${esc(f.status)}</span></td>
        </tr>`).join('')}</tbody>
      </table></div>
    </div>`;
  app.querySelector('#ge-add').onclick = () => addGraEnt(() => paint());
  app.querySelector('#gf-add').onclick = () => addGraFil(ents, () => paint());
  bindHeadClicks(app);
}

function addGraEnt(onDone) {
  const host = document.createElement('div');
  host.innerHTML = modalShell('Add TIN / company', `
    <div class="ult-form-grid">
      <div class="ult-field"><label>Legal name</label><input id="e-name" placeholder="Axidigetek Ltd" /></div>
      <div class="ult-field"><label>TIN</label><input id="e-tin" /></div>
      <div class="ult-field"><label>VAT number</label><input id="e-vat" /></div>
      <div class="ult-field"><label>Tax office</label><input id="e-office" placeholder="TSC Accra" /></div>
    </div>`, `<button type="button" class="ult-btn ult-btn-outline" data-close>Cancel</button>
      <button type="button" class="ult-btn ult-btn-primary" id="e-save">Save</button>`);
  document.body.appendChild(host);
  host.querySelector('[data-close]').onclick = () => host.remove();
  host.querySelector('#e-save').onclick = () => {
    const legal_name = host.querySelector('#e-name').value.trim();
    if (!legal_name) return alert('Name required');
    const rows = readLs(RAIL.graEnt, []);
    rows.unshift({
      id: uid(), legal_name, tin: host.querySelector('#e-tin').value.trim(),
      vat_number: host.querySelector('#e-vat').value.trim(),
      tax_office: host.querySelector('#e-office').value.trim(), subsidiary_code: subCode(),
    });
    writeLs(RAIL.graEnt, rows);
    host.remove(); onDone();
  };
}

function addGraFil(ents, onDone) {
  const host = document.createElement('div');
  host.innerHTML = modalShell('Add filing', `
    <div class="ult-form-grid">
      <div class="ult-field"><label>Entity</label><select id="f-ent">${ents.map((e) => `<option value="${esc(e.id)}">${esc(e.legal_name)}</option>`).join('')}</select></div>
      <div class="ult-field"><label>Tax type</label>
        <select id="f-type"><option>VAT</option><option>CIT</option><option>PIT</option><option>PAYE</option><option>WHT</option><option>NHIL</option><option>GETFund</option><option>Other</option></select></div>
      <div class="ult-field"><label>Period</label><input id="f-period" placeholder="Aug 2026" /></div>
      <div class="ult-field"><label>Due date</label><input id="f-due" type="date" /></div>
      <div class="ult-field"><label>Amount (GHS)</label><input id="f-amt" type="number" step="0.01" value="0" /></div>
      <div class="ult-field"><label>Status</label><select id="f-st"><option>due</option><option>filed</option><option>paid</option><option>overdue</option></select></div>
    </div>`, `<button type="button" class="ult-btn ult-btn-outline" data-close>Cancel</button>
      <button type="button" class="ult-btn ult-btn-primary" id="f-save">Save</button>`);
  document.body.appendChild(host);
  host.querySelector('[data-close]').onclick = () => host.remove();
  host.querySelector('#f-save').onclick = () => {
    const ent = ents.find((e) => String(e.id) === String(host.querySelector('#f-ent').value));
    const rows = readLs(RAIL.graFil, []);
    rows.unshift({
      id: uid(), entity_id: ent?.id, tax_type: host.querySelector('#f-type').value,
      period_label: host.querySelector('#f-period').value.trim(),
      due_date: host.querySelector('#f-due').value,
      amount: Number(host.querySelector('#f-amt').value) || 0,
      status: host.querySelector('#f-st').value, subsidiary_code: subCode(),
      gra_entities: ent ? { legal_name: ent.legal_name, tin: ent.tin } : null,
    });
    writeLs(RAIL.graFil, rows);
    host.remove(); onDone();
  };
}

function bindHeadClicks(app) {
  app.querySelectorAll('[data-bank-tab]').forEach((a) => {
    a.onclick = (e) => { e.preventDefault(); e.stopPropagation(); go(a.dataset.bankTab, 'dash'); };
  });
  app.querySelectorAll('[data-chq-view]').forEach((a) => {
    a.onclick = (e) => { e.preventDefault(); e.stopPropagation(); go('cheques', a.dataset.chqView); };
  });
}

export async function paint() {
  const app = document.getElementById('app');
  if (!app) return;
  ensureFinanceOps();
  ensureCheques();
  ensureRails();
  const tab = tabFromUrl();
  if (tab === 'cheques') {
    const rows = loadCheques();
    const view = viewFromUrl();
    if (view === 'received') return paintList(app, rows, 'in');
    if (view === 'issued') return paintList(app, rows, 'out');
    return paintDash(app, rows);
  }
  if (tab === 'debit') return paintDebit(app);
  if (tab === 'payments') return paintPay(app);
  if (tab === 'momo') return paintMomo(app);
  if (tab === 'crypto') return paintCrypto(app);
  if (tab === 'gra') return paintGra(app);
  return paintBanks(app);
}

export async function bootBanking() {
  await paint();
  const load = () => paint();
  window.addEventListener(SCOPE_EVENT, load);
  window.addEventListener('df-spa-leave', () => window.removeEventListener(SCOPE_EVENT, load), { once: true });
  if (!window.__dfBankPop) {
    window.__dfBankPop = true;
    window.addEventListener('popstate', () => paint());
  }
}