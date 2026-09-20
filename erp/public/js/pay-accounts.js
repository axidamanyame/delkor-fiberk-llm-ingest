/**
 * Finance module — cash, banks, statements and reports.
 * Demo books live in localStorage so the screens are never empty.
 */
import { fmt, getActiveSubsidiary, OPERATING_SUBSIDIARIES, SUBSIDIARIES } from './supabaseClient.js';
import { BUSINESS_LOCATIONS, findLocation, filterBySidebar, SUB_PREFIX } from './scope.js';
import { loadRows, saveRow, deleteRow, writeLs, readLs, uid, esc } from './ls-rows.js';
import { ensureDemoBooks, KEYS as ACC, fmtDate, tableBar, tableFoot } from './accounting.js';

export { fmt, esc, fmtDate, tableBar, tableFoot, uid, saveRow, deleteRow };

export const PAY_KEYS = {
  accounts: 'df_payment_accounts',
  types: 'df_payment_account_types',
  flows: 'df_payment_cash_flow',
  payments: 'df_payment_links',
};
export const KEYS = PAY_KEYS;
const SEED_FLAG = 'df_pay_demo_v4';
const SCALE = { axidigetek: 0.88, bnpl: 1.14, delkor: 0.64, fiberk: 1 };

export const PAY_TABS = [
  { key: 'treasury', href: '/finance.html?tab=treasury', label: 'Treasury & Cash' },
  { key: 'budget', href: '/finance.html?tab=budget', label: 'Budgeting' },
  { key: 'controls', href: '/finance.html?tab=controls', label: 'Controls' },
  { key: 'capital', href: '/finance.html?tab=capital', label: 'Capital' },
  { key: 'vendors', href: '/finance.html?tab=vendors', label: 'Vendors & Payments' },
  { key: 'revenue', href: '/finance.html?tab=revenue', label: 'Revenue & Collections' },
  { key: 'kpis', href: '/finance.html?tab=kpis', label: 'KPIs' },
];

const TYPE_SEED = [
  { id: 'pat-ca', name: 'Current Assets', parent_id: '' },
  { id: 'pat-cl', name: 'Current Liabilities', parent_id: '' },
  { id: 'pat-cap', name: 'Capital', parent_id: '' },
  { id: 'pat-cash', name: 'Cash', parent_id: 'pat-ca' },
  { id: 'pat-bank', name: 'Bank Account', parent_id: 'pat-ca' },
  { id: 'pat-momo', name: 'Mobile Money', parent_id: 'pat-ca' },
  { id: 'pat-save', name: 'Savings Account', parent_id: 'pat-bank' },
  { id: 'pat-cc', name: 'Credit Card', parent_id: 'pat-cl' },
  { id: 'pat-loan', name: 'Loan', parent_id: 'pat-cl' },
];

const ACC_TEMPLATES = [
  { key: 'cash', name: 'Cash', type: 'pat-cash', num: (p) => `${p}-CASH`, open: 18640, note: 'Till and petty cash', details: [['Location', 'Front till'], ['Custodian', 'Cashier']] },
  { key: 'eco', name: 'Ecobank Operations', type: 'pat-bank', num: (p, i) => `144100${38 + i}21`, open: 148600, note: 'Ecobank Ghana current', details: [['Bank', 'Ecobank Ghana'], ['Branch', 'Osu Oxford Street'], ['SWIFT', 'ECOCGHAC']] },
  { key: 'gcb', name: 'GCB Current', type: 'pat-bank', num: (p, i) => `101113${40 + i}08`, open: 98200, note: 'GCB Ltd operating', details: [['Bank', 'GCB Bank'], ['Branch', 'Accra High Street'], ['SWIFT', 'GCBGGHAC']] },
  { key: 'momo', name: 'MTN MoMo', type: 'pat-momo', num: (p, i) => `024${4001000 + i * 17}`, open: 35420, note: 'Merchant wallet', details: [['Network', 'MTN'], ['Wallet name', 'Delkor Collections']] },
  { key: 'telecel', name: 'Telecel Cash', type: 'pat-momo', num: (p, i) => `020${5102000 + i * 11}`, open: 12850, note: 'Telecel merchant', details: [['Network', 'Telecel'], ['Wallet name', 'Shop collections']] },
  { key: 'petty', name: 'Petty Cash', type: 'pat-cash', num: (p) => `${p}-PETTY`, open: 2500, note: 'Office float', details: [['Custodian', 'Admin']] },
];

function money(n) { return Math.round(Number(n || 0) * 100) / 100; }
function scaleOf(sub) { return SCALE[sub] || 1; }
function locFor(sub) {
  return BUSINESS_LOCATIONS.find((l) => l.subsidiary === sub) || BUSINESS_LOCATIONS[0];
}
export { locFor };
export function currentSubCode() {
  return getActiveSubsidiary()?.code || 'group';
}
export function subLabel(code) {
  return SUBSIDIARIES.find((s) => s.code === code)?.name || code || '—';
}
export function typeName(types, id) {
  return (types || []).find((t) => t.id === id)?.name || '';
}
export function typeParentName(types, id) {
  const t = (types || []).find((x) => x.id === id);
  if (!t?.parent_id) return t?.name || '';
  return typeName(types, t.parent_id) || t.name;
}

export function payNav(active) {
  return `<nav class="acc-nav">${PAY_TABS.map((t) => `
    <button type="button" class="acc-tab ${t.key === active ? 'on' : ''}" data-htab="${esc(t.key)}">${esc(t.label)}</button>`).join('')}</nav>`;
}

export function detailsText(d) {
  const rows = Array.isArray(d) ? d : [];
  return rows.filter((x) => x && x[0]).map(([k, v]) => `${k}: ${v}`).join(' · ');
}

export async function loadPayTypes() {
  const local = readLs(PAY_KEYS.types, []);
  if (local.length) return local;
  const rows = await loadRows('account_types', PAY_KEYS.types, TYPE_SEED);
  return rows.length ? rows : TYPE_SEED;
}
export async function loadPayAccounts() {
  try {
    const raw = localStorage.getItem(PAY_KEYS.accounts);
    if (raw != null) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) return parsed;
    }
  } catch { /* ignore */ }
  const rows = await loadRows('payment_accounts', PAY_KEYS.accounts, []);
  return (rows || []).filter((a) => !a.seed_key && !/^pa-/.test(String(a.id || '')));
}
export async function loadFlows() {
  const local = readLs(PAY_KEYS.flows, []);
  if (local.length) return local;
  return loadRows('payment_account_txns', PAY_KEYS.flows, []);
}
export async function loadPayments() {
  const local = readLs(PAY_KEYS.payments, []);
  if (local.length) return local;
  return loadRows('transaction_payments', PAY_KEYS.payments, []);
}
export async function loadPaySales() {
  const local = readLs(ACC.sales, []);
  if (local.length) return local;
  return loadRows('sales', ACC.sales, []);
}
export async function loadPayPurchases() {
  const local = readLs(ACC.purchases, []);
  if (local.length) return local;
  return loadRows('purchases', ACC.purchases, []);
}

export function scopePay(rows) {
  return filterBySidebar((rows || []).map((r) => ({
    ...r,
    subsidiary_code: r.subsidiary_code || r.sub || '',
    location_code: r.location_code || r.location || '',
  })));
}

export function accountBalance(acc, flows, toDate) {
  let bal = Number(acc.opening_balance || 0);
  const id = String(acc.id);
  (flows || []).forEach((f) => {
    if (String(f.account_id) !== id) return;
    if (toDate && String(f.operation_date || f.paid_on || '').slice(0, 10) > toDate) return;
    bal += Number(f.credit || 0) - Number(f.debit || 0);
  });
  return money(bal);
}

function findAcc(accounts, sub, key) {
  return accounts.find((a) => a.subsidiary_code === sub && a.seed_key === key);
}

function seedBooks() {
  if (!readLs(PAY_KEYS.types, []).length) writeLs(PAY_KEYS.types, TYPE_SEED.map((t) => ({ ...t })));
}

export async function ensurePayBooks() {
  try { await ensureDemoBooks(); } catch { /* ignore */ }
  seedBooks();
  let flagged = false;
  try { flagged = localStorage.getItem(SEED_FLAG) === '1'; } catch { /* ignore */ }
  if (!flagged) {
    writeLs(PAY_KEYS.accounts, []);
    writeLs(PAY_KEYS.payments, []);
    writeLs(PAY_KEYS.flows, []);
    try { localStorage.setItem(SEED_FLAG, '1'); } catch { /* ignore */ }
  }
}

export function unlinkedPayments(payments) {
  return (payments || []).filter((p) => !p.account_id);
}

export function closingStock(subCode, locCode) {
  const rows = readLs('df_products', []);
  return money((rows || []).reduce((sum, p) => {
    if (locCode && String(p.location_code || '') !== String(locCode)) return sum;
    if (subCode && subCode !== 'group' && String(p.subsidiary_code || '') !== String(subCode)) return sum;
    const qty = Number(p.stock ?? p.current_stock ?? 0);
    const cost = Number(p.cost_price || p.purchase_price || 0);
    return sum + qty * cost;
  }, 0));
}

export function dues(payments, sales, purchases, from, to) {
  const inRange = (d) => {
    const x = String(d || '').slice(0, 10);
    if (from && x < from) return false;
    if (to && x > to) return false;
    return true;
  };
  const customer = (sales || []).filter((s) => inRange(s.order_date || s.date)).reduce((s, r) => {
    return s + Math.max(0, Number(r.total_amount || 0) - Number(r.amount_paid || 0));
  }, 0);
  const supplier = (purchases || []).filter((p) => inRange(p.date || p.transaction_date)).reduce((s, r) => {
    return s + Math.max(0, Number(r.grand_total || r.total_amount || 0) - Number(r.amount_paid || 0));
  }, 0);
  return { customer: money(customer), supplier: money(supplier) };
}

export function locOptions(selected) {
  return `<option value="">All locations</option>` + BUSINESS_LOCATIONS.map((l) =>
    `<option value="${esc(l.code)}" ${selected === l.code ? 'selected' : ''}>${esc(l.name)}</option>`).join('');
}

export function accountSelect(accounts, selected, placeholder = 'Please Select') {
  return `<option value="">${esc(placeholder)}</option>` + (accounts || [])
    .filter((a) => a.status !== 'Closed' && !a.is_closed)
    .map((a) => `<option value="${esc(a.id)}" ${String(selected) === String(a.id) ? 'selected' : ''}>${esc(a.name)} (${esc(a.account_number || '')})</option>`)
    .join('');
}

export function methodLabel(m) {
  const map = { cash: 'Cash', momo: 'MTN MoMo', bank: 'Bank Transfer', card: 'Card', cheque: 'Cheque', telecel: 'Telecel Cash' };
  return map[String(m || '').toLowerCase()] || (m ? String(m) : '—');
}

export function payBanner(n) {
  if (!n) return '';
  return `<div class="pay-banner">Total ${n} payment${n === 1 ? '' : 's'} not linked with any account. <a href="/payment-account-report.html?unlinked=1">View Details</a></div>`;
}

export function modalShell(title, body, footer) {
  return `<div class="pay-modal-bg" id="pay-modal">
    <div class="pay-modal" role="dialog" aria-modal="true">
      <div class="pay-modal-h"><h2>${esc(title)}</h2><button type="button" class="pay-modal-x" data-close>&times;</button></div>
      <div class="pay-modal-b">${body}</div>
      <div class="pay-modal-f">${footer}</div>
    </div>
  </div>`;
}

export function printReport(title, html) {
  const w = window.open('', '_blank', 'width=900,height=700');
  if (!w) return alert('Allow pop-ups to print');
  w.document.write(`<!doctype html><title>${esc(title)}</title>
    <style>
      body{font-family:Inter,Arial,sans-serif;color:#111;padding:28px;margin:0}
      h1{font-size:18px;margin:0 0 16px}
      table{width:100%;border-collapse:collapse}
      th,td{padding:8px 10px;border-bottom:1px solid #e5e7eb;text-align:left}
      th{background:#e5e7eb}
      .tot td,.tot th{font-weight:700;background:#eef2f7}
      .two{display:grid;grid-template-columns:1fr 1fr;gap:0}
      .two > div{border:1px solid #e5e7eb}
    </style>
    <h1>${esc(title)}</h1>${html}`);
  w.document.close();
  w.focus();
  setTimeout(() => w.print(), 200);
}

export function invoiceLines(payment) {
  const total = Number(payment.amount || 0);
  const type = payment.type;
  if (type === 'Purchase') {
    return [
      { product: 'Supplier invoice — bulk restock', sku: payment.invoice_no, qty: 1, unit: 'Lot', price: total, discount: 0, tax: 0 },
    ].map((l) => ({ ...l, subtotal: money(l.qty * l.price) }));
  }
  if (type === 'Expense') {
    return [{ product: payment.details || 'Expense', sku: '', qty: 1, unit: 'Pc(s)', price: total, discount: 0, tax: 0, subtotal: total }];
  }
  return [];
}

export function fmtDateTime(s) {
  const d = fmtDate(s);
  const t = String(s || '').slice(11, 16);
  return t ? `${d} ${t}` : d;
}

export function byLoc(rows, loc) {
  if (!loc) return rows || [];
  return (rows || []).filter((r) => (r.location_code || r.location || '') === loc);
}

export function descLabel(subType) {
  const map = {
    sell: 'Sell', purchase: 'Purchase', expense: 'Expense',
    transfer: 'Fund Transfer', deposit: 'Deposit', opening: 'Opening Balance',
  };
  return map[String(subType || '').toLowerCase()] || (subType ? String(subType) : '—');
}

export function filtersCard(inner, open = true) {
  return `<section class="pf ${open ? 'open' : ''}" id="pay-filt">
    <button type="button" class="pf-btn" id="filt-tog">
      <span><span class="pf-ico">▾</span><span class="label">Filters</span></span>
      <span class="pf-chev">${open ? '▴' : '▾'}</span>
    </button>
    <div class="pf-body"><div class="filters">${inner}</div></div>
  </section>`;
}

export function bindFilt(app) {
  app.querySelector('#filt-tog')?.addEventListener('click', () => {
    const box = app.querySelector('#pay-filt');
    if (!box) return;
    box.classList.toggle('open');
    const chev = box.querySelector('.pf-chev');
    if (chev) chev.textContent = box.classList.contains('open') ? '▴' : '▾';
  });
}

export const FIN_KEYS = {
  banks: 'df_bank_accounts',
  bankTxns: 'df_bank_transactions',
  ghanaBanks: 'df_ghana_banks',
  ghanaAcc: 'df_ghana_bank_accounts',
  ghanaTxns: 'df_ghana_bank_transactions',
  debit: 'df_debit_notes',
  pay: 'df_purchase_payments',
};
const FIN_FLAG = 'df_fin_ops_v2';

const GHANA_BANK_CAT = [
  { id: 'gb-uba', name: 'UBA Ghana', code: 'UBA', sort_order: 1, is_active: true },
  { id: 'gb-gcb', name: 'GCB Bank', code: 'GCB', sort_order: 2, is_active: true },
  { id: 'gb-eco', name: 'Ecobank Ghana', code: 'ECO', sort_order: 3, is_active: true },
  { id: 'gb-stan', name: 'Stanbic Bank Ghana', code: 'STANBIC', sort_order: 4, is_active: true },
  { id: 'gb-fid', name: 'Fidelity Bank', code: 'FID', sort_order: 5, is_active: true },
  { id: 'gb-absa', name: 'Absa Ghana', code: 'ABSA', sort_order: 6, is_active: true },
];

export function ensureGhanaBankCat() {
  ensureFinanceOps();
  try {
    const rows = JSON.parse(localStorage.getItem(FIN_KEYS.ghanaBanks) || '[]');
    if (!Array.isArray(rows) || !rows.length) {
      localStorage.setItem(FIN_KEYS.ghanaBanks, JSON.stringify(GHANA_BANK_CAT));
    }
  } catch {
    try { localStorage.setItem(FIN_KEYS.ghanaBanks, JSON.stringify(GHANA_BANK_CAT)); } catch { /* quota */ }
  }
}

export function ensureFinanceOps() {
  try {
    if (localStorage.getItem(FIN_FLAG) === '1') return;
  } catch { /* ignore */ }
  writeLs(FIN_KEYS.banks, []);
  writeLs(FIN_KEYS.bankTxns, []);
  writeLs(FIN_KEYS.ghanaBanks, GHANA_BANK_CAT);
  writeLs(FIN_KEYS.ghanaAcc, []);
  writeLs(FIN_KEYS.ghanaTxns, []);
  writeLs(FIN_KEYS.debit, []);
  writeLs(FIN_KEYS.pay, []);
  try { localStorage.setItem(FIN_FLAG, '1'); } catch { /* ignore */ }
}

export function firstRows(remote, key) {
  if (Array.isArray(remote) && remote.length) return remote;
  return readLs(key, []);
}

export function companyOf(sub) {
  const map = {
    axidigetek: { name: 'Axidigetek Ltd', addr: 'East Legon, Accra, Ghana', tin: 'C0004128891', phone: '0302 550 118', mobile: '024 411 2200' },
    bnpl: { name: 'BNPL Hire Purchase', addr: 'Tema Community 1, Ghana', tin: 'C0005017720', phone: '0303 202 441', mobile: '024 800 1190' },
    delkor: { name: 'Delkor Logistics', addr: 'Kumasi Adum, Ghana', tin: 'C0002291044', phone: '0322 204 118', mobile: '024 611 0091' },
    fiberk: { name: 'Fiberk Ltd', addr: 'Spintex Road, Accra, Ghana', tin: 'C0003987612', phone: '0302 664 210', mobile: '024 455 7788' },
    group: { name: 'Delkor-Fiberk Group', addr: 'Osu Oxford Street, Accra, Ghana', tin: 'C0003987612', phone: '0302 664 210', mobile: '024 455 7788' },
  };
  return map[sub] || map.group;
}

export function partyName(payment) {
  const d = String(payment?.details || '');
  const m = d.match(/(?:Customer|Supplier|Payee):\s*(.+)/i);
  return (m && m[1].trim()) || d || 'Walk-In Customer';
}

export function decorateFlows(accounts, flows) {
  const bals = {};
  (accounts || []).forEach((a) => { bals[a.id] = Number(a.opening_balance || 0); });
  const sorted = (flows || []).slice().sort((a, b) => {
    const da = String(a.operation_date || '').localeCompare(String(b.operation_date || ''));
    if (da) return da;
    return String(a.id).localeCompare(String(b.id));
  });
  return sorted.map((f) => {
    const d = Number(f.debit || 0);
    const c = Number(f.credit || 0);
    bals[f.account_id] = money((bals[f.account_id] || 0) + c - d);
    const total = money(Object.values(bals).reduce((s, n) => s + Number(n || 0), 0));
    return { ...f, account_balance: bals[f.account_id], total_balance: total };
  });
}

export async function linkPayment(payment, account) {
  const next = { ...payment, account_id: account.id, account_name: account.name };
  await saveRow('transaction_payments', PAY_KEYS.payments, next);
  const isIn = String(payment.type || '').toLowerCase() === 'sell';
  const amt = Number(payment.amount || 0);
  await saveRow('payment_account_txns', PAY_KEYS.flows, {
    id: uid(),
    operation_date: String(payment.paid_on || '').slice(0, 10),
    account_id: account.id,
    account_name: account.name,
    sub_type: String(payment.type || 'sell').toLowerCase(),
    method: payment.method,
    payment_details: payment.payment_ref_no,
    debit: isIn ? 0 : amt,
    credit: isIn ? amt : 0,
    subsidiary_code: payment.subsidiary_code,
    location_code: payment.location_code,
  });
  return next;
}

export function sellDetailsHtml(payment) {
  const lines = invoiceLines(payment);
  const subtotal = money(lines.reduce((s, l) => s + Number(l.subtotal || 0), 0));
  const payable = Number(payment.amount || 0);
  const disc = money(Math.max(0, subtotal - payable));
  const discPct = subtotal ? money((disc / subtotal) * 100) : 0;
  const party = partyName(payment);
  const co = companyOf(payment.subsidiary_code);
  const paidOn = fmtDate(payment.paid_on);
  const isSell = String(payment.type || '') === 'Sell';
  return `
    <div class="sell-grid">
      <div>
        <div><strong>Invoice No. :</strong> #${esc(payment.invoice_no || '')}</div>
        <div><strong>Status:</strong> Final</div>
        <div><strong>Payment Status:</strong> Paid</div>
      </div>
      <div>
        <div><strong>${isSell ? 'Customer name' : payment.type === 'Purchase' ? 'Supplier' : 'Payee'}:</strong> ${esc(party)}</div>
        <div><strong>Address:</strong><br>${esc(party)},<br>${esc(co.addr)}<br>Mobile: ${esc(co.mobile)}</div>
      </div>
      <div>
        <div><strong>Shipping:</strong> --</div>
        <div><strong>Date:</strong> ${esc(paidOn)}</div>
      </div>
    </div>
    <h4>Products:</h4>
    <table class="sell-prod">
      <thead><tr><th>#</th><th>Product</th><th>Quantity</th><th>Unit Price</th><th>Discount</th><th>Tax</th><th>Price inc. tax</th><th>Subtotal</th></tr></thead>
      <tbody>${lines.map((l, i) => `<tr>
        <td>${i + 1}</td>
        <td>${esc(l.product)}${l.sku ? ` — ${esc(l.sku)}` : ''}</td>
        <td>${l.qty.toFixed(2)} ${esc(l.unit || 'Pc(s)')}</td>
        <td>${fmt(l.price)}</td>
        <td>${fmt(l.discount || 0)}</td>
        <td>${fmt(l.tax || 0)}</td>
        <td>${fmt(l.price)}</td>
        <td>${fmt(l.subtotal)}</td>
      </tr>`).join('')}</tbody>
    </table>
    <div class="sell-split">
      <div>
        <h4>Payment info:</h4>
        <table class="sell-pay">
          <thead><tr><th>#</th><th>Date</th><th>Reference No</th><th>Amount</th><th>Payment mode</th><th>Payment note</th></tr></thead>
          <tbody><tr>
            <td>1</td><td>${esc(paidOn)}</td><td>${esc(payment.payment_ref_no || '')}</td>
            <td>${fmt(payable)}</td><td>${esc(methodLabel(payment.method))}</td><td>--</td>
          </tr></tbody>
        </table>
      </div>
      <div>
        <table class="sell-tot">
          <tr><td>Total:</td><td>${fmt(subtotal)}</td></tr>
          <tr><td>Discount:</td><td>(-) ${discPct} %</td></tr>
          <tr><td>Order Tax:</td><td>(+) ${fmt(0)}</td></tr>
          <tr><td>Shipping:</td><td>(+) ${fmt(0)}</td></tr>
          <tr><td>Round Off:</td><td>${fmt(0)}</td></tr>
          <tr><td>Total Payable:</td><td>${fmt(payable)}</td></tr>
          <tr><td>Total paid:</td><td>${fmt(payable)}</td></tr>
          <tr><td>Total remaining:</td><td>${fmt(0)}</td></tr>
        </table>
      </div>
    </div>
    <div class="sell-notes">
      <div><strong>${isSell ? 'Sell' : payment.type} note:</strong><div class="note-box">--</div></div>
      <div><strong>Staff note:</strong><div class="note-box">--</div></div>
    </div>
    <h4>Activities:</h4>
    <table class="sell-act">
      <thead><tr><th>Date</th><th>Action</th><th>By</th><th>Note</th></tr></thead>
      <tbody><tr>
        <td>${esc(fmtDateTime(payment.paid_on))}</td>
        <td>Added</td>
        <td>${esc(payment.added_by || payment.created_by || '—')}</td>
        <td>Status: <span class="pill received">Final</span> &nbsp; Total: <span class="pill received">${fmt(payable)}</span> &nbsp; Payment Status: <span class="pill received">Paid</span></td>
      </tr></tbody>
    </table>`;
}

export function packingSlipHtml(payment) {
  const co = companyOf(payment.subsidiary_code);
  const party = partyName(payment);
  const lines = invoiceLines(payment);
  return `<div class="print-doc">
    <div class="print-top">
      <div>
        <h2>${esc(co.name)}</h2>
        <div>${esc(co.addr)}</div>
        <div>TIN: ${esc(co.tin)}</div>
      </div>
      <div class="print-right">
        <h2>Packing Slip</h2>
        <div><strong>Invoice No.</strong> ${esc(payment.invoice_no || '')}</div>
        <div><strong>Date</strong> ${esc(fmtDateTime(payment.paid_on))}</div>
      </div>
    </div>
    <div class="print-party">
      <div><strong>Customer</strong><br>${esc(party)}<br>${esc(co.addr)}<br><strong>Mobile:</strong> ${esc(co.mobile)}</div>
      <div><strong>Shipping Address:</strong></div>
    </div>
    <table class="print-tbl">
      <thead><tr><th>#</th><th>Product</th><th>Quantity</th></tr></thead>
      <tbody>${lines.map((l, i) => `<tr><td>${i + 1}</td><td>${esc(l.product)}${l.sku ? `, ${esc(l.sku)}` : ''}</td><td>${l.qty.toFixed(2)} ${esc(l.unit || 'Pc(s)')}</td></tr>`).join('')}</tbody>
    </table>
    <p style="margin-top:48px"><strong>Authorized Signatory</strong></p>
  </div>`;
}

export function invoicePrintHtml(payment) {
  const co = companyOf(payment.subsidiary_code);
  const party = partyName(payment);
  const lines = invoiceLines(payment);
  const subtotal = money(lines.reduce((s, l) => s + Number(l.subtotal || 0), 0));
  const payable = Number(payment.amount || 0);
  const disc = money(Math.max(0, subtotal - payable));
  const discPct = subtotal ? money((disc / subtotal) * 100) : 0;
  return `<div class="print-doc">
    <div style="text-align:center">
      <h2 style="margin:0">${esc(co.name)}</h2>
      <div>${esc(co.addr)}</div>
      <div><strong>TIN:</strong> ${esc(co.tin)}</div>
      <h3 style="margin:12px 0 18px">Invoice</h3>
    </div>
    <div class="print-top">
      <div>
        <div><strong>Invoice No.</strong> ${esc(payment.invoice_no || '')}</div>
        <div><strong>Customer</strong><br>${esc(party)}<br>${esc(co.addr)}<br><strong>Mobile:</strong> ${esc(co.mobile)}</div>
      </div>
      <div class="print-right"><strong>Date</strong> ${esc(fmtDateTime(payment.paid_on))}</div>
    </div>
    <table class="print-tbl">
      <thead><tr><th>Product</th><th>Quantity</th><th>Unit Price</th><th>Subtotal</th></tr></thead>
      <tbody>${lines.map((l) => `<tr>
        <td>${esc(l.product)}${l.sku ? `, ${esc(l.sku)}` : ''}</td>
        <td>${l.qty.toFixed(2)} ${esc(l.unit || 'Pc(s)')}</td>
        <td>${fmt(l.price)}</td>
        <td>${fmt(l.subtotal)}</td>
      </tr>`).join('')}</tbody>
    </table>
    <div class="print-foot">
      <div>
        <div>${esc(methodLabel(payment.method))} &nbsp; ${fmt(payable)} &nbsp; ${esc(fmtDate(payment.paid_on))}</div>
        <div><strong>Total Paid</strong> ${fmt(payable)}</div>
      </div>
      <div>
        <div>Subtotal: ${fmt(subtotal)}</div>
        <div>Discount (${discPct}%): (-) ${fmt(disc)}</div>
        <div><strong>Total:</strong> ${fmt(payable)}</div>
      </div>
    </div>
  </div>`;
}

export { ACC, money };
