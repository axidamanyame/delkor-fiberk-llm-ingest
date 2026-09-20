/** Fiberkapp All sales book — invoices posted to accounting (no COGS until cost is allocated). */
import { readLs, writeLs, esc } from './ls-rows.js';
import { KEYS } from './catalog-seed.js';
import {
  KEYS as ACC, loadSettings, saveSettings, loadAccounts, ensureDemoBooks, seedDefaultAccounts,
} from './accounting.js';
import { migStamp, siloHref, PACK_METRICS } from './fiberk-silo.js';

const JSON_URL = '/js/fiberk-sales.json';
const FLAG = 'df_fiberk_sales_v2';
const ACC_FLAG = 'df_fiberk_sales_acc_v2';
const SALES_KEY = KEYS.sales;
const CUST_KEY = KEYS.customers;
const HEAD_KEY = 'df_fiberk_sales_headers';
const HEAD_FIELDS = [
  'id', 'upos_id', 'reference', 'invoice_no', 'so_number', 'order_date', 'created_at',
  'customer_id', 'customer_name', 'phone', 'location_code', 'location_name', 'legacy_location',
  'subsidiary_code', 'agent_name', 'payment_status', 'payment_method', 'method_label',
  'total_amount', 'amount_paid', 'payment_due', 'return_due', 'shipping_status', 'total_items',
  'added_by', 'created_by_name', 'status', 'source', 'channel', 'is_direct_sale',
];

let BOOK = null;

function toHeader(row) {
  const o = { source: 'fiberkapp' };
  HEAD_FIELDS.forEach((k) => {
    const v = row[k];
    if (v !== '' && v != null) o[k] = v;
  });
  return o;
}

function upsert(key, rows) {
  const incoming = rows || [];
  if (!incoming.length) return;
  const ids = new Set(incoming.map((r) => String(r.id)));
  const cur = (readLs(key, []) || []).filter((r) => !ids.has(String(r.id)));
  writeLs(key, [...incoming, ...cur]);
}

function cedi(n) {
  return 'GH₵ ' + Number(n || 0).toLocaleString('en-GH', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function mdY(s) {
  const m = String(s || '').match(/^(\d{4})-(\d{2})-(\d{2})(?:[T ](\d{2}):(\d{2}))?/);
  if (m) return `${m[2]}/${m[3]}/${m[1]}${m[4] ? ' ' + m[4] + ':' + m[5] : ''}`;
  return String(s || '').slice(0, 16);
}

function pickAcc(accounts, sub, name) {
  return (accounts || []).find((a) => a.subsidiary_code === sub && a.name === name)
    || (accounts || []).find((a) => a.name === name)
    || { id: '', name };
}

function cashAccountName(method) {
  const m = String(method || 'cash').toLowerCase();
  if (/momo|mtn|telecel|airteltigo|vodafone/.test(m)) return 'Mobile Money';
  if (/bank/.test(m)) return 'Bank';
  return 'Cash on hand';
}

export function fiberkSales() {
  const head = readLs(HEAD_KEY, []) || [];
  if (head.length) return head;
  if (BOOK?.sales?.length) return BOOK.sales.map(toHeader);
  return (readLs(SALES_KEY, []) || []).filter((r) => r.source === 'fiberkapp');
}

/** Full invoices with lines — for catalog / HP recon. Headers if the book is not in memory. */
export function fiberkSalesFull() {
  if (BOOK?.sales?.length) return BOOK.sales;
  return fiberkSales();
}

export function fiberkSaleCount() {
  return fiberkSales().length;
}

export function findFiberkSale(id) {
  const sid = String(id || '');
  const full = (BOOK?.sales || []).find((r) => String(r.id) === sid);
  if (full) return full;
  return fiberkSales().find((r) => String(r.id) === sid)
    || (readLs(SALES_KEY, []) || []).find((r) => String(r.id) === sid)
    || null;
}

function ymd(v) { return String(v || '').slice(0, 10); }
function saleInRange(row, from, to) {
  const d = ymd(row.transaction_date || row.order_date || row.date || row.sale_date);
  if (from && d && d < from) return false;
  if (to && d && d > to) return false;
  if ((from || to) && !d) return false;
  return true;
}

export function fiberkSalesMetrics(range = {}) {
  const from = ymd(range.from);
  const to = ymd(range.to);
  let rows = fiberkSales();
  if (from || to) rows = rows.filter((r) => saleInRange(r, from, to));
  if (!(from || to) && BOOK?.metrics) {
    return {
      n: BOOK.metrics.sales || rows.length,
      lines: BOOK.metrics.lines || 0,
      grand: BOOK.metrics.grand || 0,
      paid: BOOK.metrics.paid || 0,
      due: BOOK.metrics.due || 0,
      customers: (BOOK.customers || []).length,
    };
  }
  if (!rows.length) return { n: 0, lines: 0, grand: 0, paid: 0, due: 0, customers: 0 };
  return {
    n: rows.length,
    lines: rows.reduce((s, r) => s + Number(r.total_items || (r.lines || []).length || 0), 0),
    grand: rows.reduce((s, r) => s + Number(r.total_amount || r.grand_total || 0), 0),
    paid: rows.reduce((s, r) => s + Number(r.amount_paid || 0), 0),
    due: rows.reduce((s, r) => s + Number(r.payment_due || 0), 0),
    customers: new Set(rows.map((r) => r.customer_id).filter(Boolean)).size,
  };
}

export function salesPosted() {
  try { return localStorage.getItem(ACC_FLAG) === '1'; } catch { return false; }
}

export function fiberkSalesBanner() {
  const x = fiberkSalesMetrics();
  if (!x.n) {
    return `<p class="sub" style="background:#fff7ed;border:1px solid #fed7aa;border-radius:10px;padding:8px 12px">
      Fiberkapp All sales has not been hydrated yet.
    </p>`;
  }
  const posted = salesPosted();
  return `<p class="sub" style="background:#ecfdf5;border:1px solid #99f6e4;border-radius:10px;padding:8px 12px">
    Fiberkapp All sales migrated: <b>${x.n}</b> invoices · ${x.lines} lines · ${cedi(x.grand)}
    (paid ${cedi(x.paid)} · due ${cedi(x.due)}).
    Locations kept as on the source (FIBERK SHOP, PHONE STOCKS, EasyBuy SAs, Jumia channels).
    ${posted
      ? `Posted to Accounting: Dr Cash / A/R · Cr Sales of Product Income. <b>No COGS</b> until purchase cost is allocated to each IMEI.`
      : `Lined up for accounting — not posted to journals yet.`}
    Date filter defaults to Fiberkapp years 2025–${new Date().getFullYear()}. Calendar 2024 is empty (0 invoices).
    <button type="button" class="ult-btn ult-btn-outline" id="fk-all" style="margin-left:8px">Show all Fiberkapp sales</button>
    <a class="ult-btn ult-btn-outline" href="/accounting-reconciliation.html">Reconciliation</a>
    <a class="ult-btn ult-btn-outline" href="/accounting-transactions.html?tab=sell">Sales transactions</a>
    <a class="ult-btn ult-btn-outline" href="/accounting-journal.html">Journals</a>
    <a class="ult-btn ult-btn-outline" href="/stock-transfers.html">Stock transfers</a>
  </p>`;
}

export function salesBookMetrics(range = {}) {
  const x = fiberkSalesMetrics(range);
  const from = String(range.from || '').slice(0, 10);
  const to = String(range.to || '').slice(0, 10);
  const jes = (fiberkSalesJournals() || []).filter((j) => {
    if (!(from || to)) return true;
    const d = String(j.journal_date || j.date || '').slice(0, 10);
    if (from && d && d < from) return false;
    if (to && d && d > to) return false;
    return true;
  });
  return { ...x, journals: jes.length, posted: salesPosted() };
}

export function salesBookCard(m) {
  const x = m || salesBookMetrics();
  if (!x.n) return '';
  return `<div class="ov-card" id="so-fiberkapp">
    <h2>Fiberkapp sales book ${migStamp()}</h2>
    <p class="sub">Historical POS invoices posted through Accounting
      (Dr Cash on hand for the paid amount, Dr A/R for anything still due, Cr Sales of Product Income).
      <b>No Cost of sales</b> — purchase cost is still blank on the IMEI, so profit stays off the books.
      HP field reimbursement invoices stay on their own book and are not mixed in here.
      Live All Sales lists these invoices on the shop book.</p>
    <div class="fo-ol-kpis" style="margin:12px 0 0;border:0">
      <article><span>Invoices</span><b>${x.n}</b></article>
      <article><span>Grand</span><b>${cedi(x.grand)}</b></article>
      <article><span>Still due</span><b>${cedi(x.due)}</b></article>
      <article><span>Journals</span><b>${x.journals}</b></article>
    </div>
    <p style="margin:12px 0 0;display:flex;gap:8px;flex-wrap:wrap">
      <a class="ult-btn ult-btn-primary" href="${siloHref('sales')}">All sales</a>
      <a class="ult-btn ult-btn-outline" href="/accounting-reconciliation.html">Reconciliation</a>
      <a class="ult-btn ult-btn-outline" href="/accounting-journal.html">Journal entries</a>
    </p>
  </div>`;
}

export async function ensureFiberkSales() {
  try {
    if (localStorage.getItem(FLAG) === '1' && fiberkSaleCount() >= 2200 && BOOK) {
      return { ok: true, skipped: true, n: fiberkSaleCount() };
    }
  } catch { /* continue */ }
  const res = await fetch(JSON_URL, { cache: 'force-cache' });
  if (!res.ok) return { ok: false, n: 0 };
  BOOK = await res.json();
  const sales = BOOK.sales || [];
  const headers = sales.map(toHeader);
  try {
    writeLs(HEAD_KEY, headers);
    if (fiberkSaleCount() >= 2200) localStorage.setItem(FLAG, '1');
  } catch (e) { console.warn('fiberk sales ls', e); }
  return { ok: true, n: sales.length, lines: BOOK.metrics?.lines || 0, grand: BOOK.metrics?.grand || 0 };
}

function saleToJournal(sale, accounts) {
  const sub = sale.subsidiary_code || 'fiberk';
  const day = String(sale.order_date || sale.created_at || '').slice(0, 10);
  const total = Number(sale.total_amount || sale.grand_total || 0);
  const paid = Number(sale.amount_paid || 0);
  const due = Number(sale.payment_due != null ? sale.payment_due : Math.max(0, total - paid));
  const cash = pickAcc(accounts, sub, cashAccountName(sale.payment_method || sale.method));
  const ar = pickAcc(accounts, sub, 'Accounts Receivable (A/R)');
  const inc = pickAcc(accounts, sub, 'Sales of Product Income');
  const lines = [];
  if (paid > 0) {
    lines.push({ account_id: cash.id || '', account: cash.name, debit: paid, credit: 0, note: sale.method_label || sale.payment_method || 'Cash' });
  }
  if (due > 0) {
    lines.push({ account_id: ar.id || '', account: ar.name, debit: due, credit: 0, note: sale.customer_name || 'Customer' });
  }
  if (total > 0 || lines.length) {
    lines.push({ account_id: inc.id || '', account: inc.name, debit: 0, credit: total, note: 'No COGS — cost not allocated' });
  }
  return {
    id: 'je-so-' + (sale.upos_id || sale.id),
    journal_date: day,
    operation_date: day,
    ref_no: 'JE-' + String(sale.invoice_no || sale.reference || sale.id).replace(/\//g, '-'),
    note: `Sale ${sale.invoice_no || sale.reference} · ${sale.customer_name || 'Walk-In'} · ${sale.legacy_location || sale.location_name || ''} · no COGS.`,
    added_by: sale.added_by || sale.created_by_name || 'Migration',
    status: 'posted',
    subsidiary_code: sub,
    location_code: sale.location_code,
    location_name: sale.legacy_location || sale.location_name,
    total,
    source: 'fiberkapp',
    source_doc: 'sale',
    lines,
  };
}

export function fiberkSalesJournals(accounts) {
  if (typeof window !== 'undefined' && Array.isArray(window.__FK_SALES_JE) && window.__FK_SALES_JE.length >= 2200) {
    return window.__FK_SALES_JE;
  }
  const acc = accounts || (typeof window !== 'undefined' ? window.__FK_SALES_ACC : null) || [];
  const jes = fiberkSales().map((s) => saleToJournal(s, acc));
  if (typeof window !== 'undefined' && jes.length) window.__FK_SALES_JE = jes;
  return jes;
}

export function fiberkSaleMapped(id) {
  if (!salesPosted()) return null;
  const maps = loadSettings().maps || {};
  return maps['sell:' + id] || maps['sale:' + id] || maps['sell_payment:' + id] || {
    payment_account: 'Cash on hand',
    deposit_to: 'Sales of Product Income',
    auto: true,
  };
}

export async function ensureSalesFlow() {
  const book = await ensureFiberkSales();
  try {
    if (localStorage.getItem(ACC_FLAG) === '1' && typeof window !== 'undefined' && window.__FK_SALES_JE?.length >= 2200) {
      return { ok: true, skipped: true, n: window.__FK_SALES_JE.length };
    }
  } catch { /* continue */ }

  try { await ensureDemoBooks(); } catch { /* coa may already exist */ }
  let accounts = [];
  try { accounts = await seedDefaultAccounts(); } catch { accounts = await loadAccounts().catch(() => []); }
  if (!accounts?.length) accounts = await loadAccounts().catch(() => readLs(ACC.accounts, []) || []);
  if (typeof window !== 'undefined') window.__FK_SALES_ACC = accounts;

  const sales = fiberkSales();
  const jes = sales.map((s) => saleToJournal(s, accounts));
  if (typeof window !== 'undefined') window.__FK_SALES_JE = jes;

  const maps = { ...(loadSettings().maps || {}) };
  maps['sell:fiberkapp'] = { payment_account: 'Cash on hand', deposit_to: 'Sales of Product Income', auto: true };
  maps['sale:fiberkapp'] = maps['sell:fiberkapp'];
  try { saveSettings({ ...loadSettings(), maps }); } catch { /* quota */ }
  try { if (jes.length >= 2200) localStorage.setItem(ACC_FLAG, '1'); } catch { /* ignore */ }

  return { ok: true, n: sales.length, journals: jes.length, grand: book.grand || fiberkSalesMetrics().grand };
}

export function paintSellDetails(app, row) {
  const lines = row.lines || row.items || [];
  const pays = row.payments || [];
  const net = Number(row.total_amount || row.grand_total || 0);
  const disc = Number(row.discount_amount || 0);
  const tax = Number(row.tax_amount || 0);
  const ship = Number(row.shipping_charges || 0);
  const pack = Number(row.packing_charge || 0);
  const round = Number(row.round_off || 0);
  const paid = Number(row.amount_paid || 0);
  const due = Number(row.payment_due != null ? row.payment_due : Math.max(0, net - paid));
  const st = String(row.status || 'final').replace(/_/g, ' ');
  const stCap = st.replace(/^./, (c) => c.toUpperCase());
  const ps = String(row.payment_status || 'due').replace(/^./, (c) => c.toUpperCase());
  const loc = row.legacy_location || row.location_name || row.location_code || '';
  const notes = (row.sale_note || row.notes || '').trim() || '--';
  const staff = (row.staff_note || '').trim() || '--';
  app.innerHTML = `
    <div class="po-view sell-view">
      <header class="po-view-head">
        <h1>Sell Details (Invoice No. : ${esc(row.invoice_no || row.reference || '')})</h1>
        <button type="button" class="po-x" data-close title="Close">×</button>
      </header>
      <div class="po-meta">
        <div>
          <div><b>Invoice No. :</b> #${esc(row.invoice_no || row.reference || '')}</div>
          <div><b>Status:</b> ${esc(stCap)}</div>
          <div><b>Payment Status:</b> ${esc(ps)}</div>
          <div><b>Location:</b> ${esc(loc)}</div>
        </div>
        <div>
          <div class="po-k">Customer name:</div>
          <div><b>${esc(row.customer_name || 'Walk-In Customer')}</b></div>
          <div>Address:</div>
          <div>${esc(row.customer_address || row.customer_name || '')}</div>
          ${row.phone ? `<div>Mobile: ${esc(row.phone)}</div>` : ''}
        </div>
        <div>
          <div><b>Cashier staff:</b></div>
          <div>${esc(row.service_staff || '')}</div>
          <div><b>Shipping:</b></div>
          <div>${esc(row.shipping_status || row.shipping_details || '--')}</div>
        </div>
        <div class="po-date-top">Date: ${esc(mdY(row.order_date || row.date).slice(0, 10))}</div>
      </div>
      <div class="po-table-wrap">
        <h3 style="margin:0 0 8px">Products:</h3>
        <table class="po-lines">
          <thead><tr>
            <th>#</th>
            <th>Product</th>
            <th>Quantity</th>
            <th>Unit Price</th>
            <th>Discount</th>
            <th>Tax</th>
            <th>Price inc. tax</th>
            <th>Subtotal</th>
          </tr></thead>
          <tbody>${lines.map((l, i) => {
            const qty = Number(l.qty || l.quantity || 0);
            const unit = Number(l.unit_price || l.price_inc_tax || 0);
            const sub = Number(l.line_total != null ? l.line_total : qty * unit);
            const sku = l.sku ? ` ${esc(l.sku)}` : '';
            const brand = l.brand ? `, ${esc(l.brand)}` : '';
            return `<tr>
              <td>${i + 1}</td>
              <td>${esc(l.name || '')}${sku}${brand}</td>
              <td>${qty.toFixed(2)} Pc(s)</td>
              <td class="num">${cedi(unit)}</td>
              <td class="num">${cedi(l.discount || 0)}</td>
              <td class="num">${cedi(l.tax || 0)}</td>
              <td class="num">${cedi(l.price_inc_tax || unit)}</td>
              <td class="num">${cedi(sub)}</td>
            </tr>`;
          }).join('') || `<tr><td colspan="8" style="text-align:center">No products</td></tr>`}</tbody>
        </table>
      </div>
      <div class="po-lower">
        <div>
          <h3>Payment info:</h3>
          <table class="po-pay">
            <thead><tr>
              <th>#</th><th>Date</th><th>Reference No</th><th>Amount</th><th>Payment mode</th><th>Payment note</th>
            </tr></thead>
            <tbody>${pays.length ? pays.map((p, i) => `<tr>
              <td>${i + 1}</td>
              <td>${esc(mdY(p.date).slice(0, 10))}</td>
              <td>${esc(p.reference || '')}</td>
              <td class="num">${cedi(p.amount)}</td>
              <td>${esc(p.method_label || p.method || '')}</td>
              <td>${esc(p.note || '--')}</td>
            </tr>`).join('') : `<tr><td colspan="6" class="empty">No payments</td></tr>`}</tbody>
          </table>
          <div class="po-notes"><b>Sell note:</b><div class="po-bar">${esc(notes)}</div></div>
          <div class="po-notes"><b>Staff note:</b><div class="po-bar">${esc(staff)}</div></div>
          <h3>Activities:</h3>
          <table class="po-act">
            <thead><tr><th>Date</th><th>Action</th><th>By</th><th>Note</th></tr></thead>
            <tbody><tr>
              <td>${esc(mdY(row.order_date || row.created_at))}</td>
              <td>Added</td>
              <td>${esc(row.added_by || row.created_by_name || '')}</td>
              <td>
                <div>Status: ${esc(stCap)}</div>
                <div>Total: ${cedi(net)}</div>
                <div>Payment Status: ${esc(ps)}</div>
              </td>
            </tr></tbody>
          </table>
        </div>
        <aside>
          <div class="po-tot"><span>Total:</span><b>${cedi(net)}</b></div>
          <div class="po-tot"><span>Discount:</span><span>(-) ${cedi(disc)}</span></div>
          <div class="po-tot"><span>Packing Charge:</span><span>(+) ${cedi(pack)}</span></div>
          <div class="po-tot"><span>Order Tax:</span><span>(+) ${cedi(tax)}</span></div>
          <div class="po-tot"><span>Shipping:</span><span>(+) ${cedi(ship)}</span></div>
          <div class="po-tot"><span>Round Off:</span><span>${cedi(round)}</span></div>
          <div class="po-tot po-grand"><span>Total Payable:</span><b>${cedi(net)}</b></div>
          <div class="po-tot"><span>Total paid:</span><b>${cedi(paid)}</b></div>
          <div class="po-tot"><span>Total remaining:</span><b>${cedi(due)}</b></div>
        </aside>
      </div>
      <div class="po-actions">
        <a class="po-print" href="/sales-form.html?id=${encodeURIComponent(row.id)}&print=1">Print Invoice</a>
        <button type="button" class="po-close" data-close>Close</button>
      </div>
    </div>`;
  app.querySelectorAll('[data-close]').forEach((b) => {
    b.onclick = () => { location.href = '/sales-orders.html'; };
  });
}
