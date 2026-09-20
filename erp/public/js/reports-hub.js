/**
 * Reports — read-only documents (product card, purchase / sale / expense
 * sheets). Working lists stay under Purchases, Sales, Operations, Records.
 * No listing tables, no Actions column, no charts.
 */
import { esc, readLs } from './ls-rows.js';
import { fmt } from './supabaseClient.js';
import { bindOverflowTabs } from './hub-kit.js';
import {
  LOCS, plLines, TAX_IN, TAX_OUT, TAX_EXP, TAX_PI,
  dateRange, locOptions, locMatch as liveLocMatch, stockRows, activityRows,
  activityUsers, activityTypes, purchaseProductRows, expenseRows, ageingRows,
} from './report-data.js';
import { ensureCollections } from './collections-desk.js';
import {
  listPtps, queueCounts, QUEUES, gradeCounts, gradeBadge, money as colMoney,
} from './collection-ops.js';
import { listRegisterReports, getRegisterReport, wrapRegisterHtml, ghanaStamp, registerSheetCss } from './pos-register-report.js';
import {
  officialReportHtml, bindOfficialReport, reportBranch, reportWho,
} from './report-template.js';
import { loadPayments, paymentMetrics } from './bnpl-field-payments.js';
import { recordSheetHtml } from './record-view.js';

function money(n) { return fmt(n); }
function loc() { return new URLSearchParams(location.search).get('loc') || ''; }
function pane() { return new URLSearchParams(location.search).get('pane') || ''; }
function qset(extra) {
  const q = new URLSearchParams(location.search);
  Object.entries(extra || {}).forEach(([k, v]) => {
    if (v == null || v === '') q.delete(k);
    else q.set(k, v);
  });
  const s = q.toString();
  return location.pathname + (s ? '?' + s : '');
}
function go(extra) {
  const path = qset(extra);
  history.pushState({ spa: path }, '', path);
  paint();
}

function pinIco() {
  return `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#fff" stroke-width="2"><path d="M12 21s7-5.4 7-11a7 7 0 1 0-14 0c0 5.6 7 11 7 11z"/><circle cx="12" cy="10" r="2.2" fill="#fff"/></svg>`;
}
function calIco() {
  return `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="5" width="18" height="16" rx="2"/><path d="M3 10h18M8 3v4M16 3v4"/></svg>`;
}
function printIco() {
  return `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M6 9V3h12v6"/><path d="M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2"/><path d="M6 14h12v8H6z"/></svg>`;
}
function sparkIco() {
  return `<svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor"><path d="M12 2l1.6 6.4L20 10l-6.4 1.6L12 18l-1.6-6.4L4 10l6.4-1.6z"/></svg>`;
}
function infoIco() {
  return `<span class="rpt-info" title="Info">i</span>`;
}

function locSelect() {
  const on = loc();
  const opts = locOptions().map((l) => `<option value="${esc(l.code)}" ${l.code === on ? 'selected' : ''}>${esc(l.name)}</option>`).join('');
  return `<div class="rpt-loc"><span class="rpt-loc-ico">${pinIco()}</span>
    <select id="rpt-loc">${opts}</select></div>`;
}

function toolbar({ ai = false, print = true, extra = '' } = {}) {
  const { from, to } = dateRange();
  return `<div class="rpt-toolbar">
    <div class="rpt-toolbar-l">
      ${locSelect()}
      <details class="rpt-date">
        <summary class="rpt-pill">${calIco()} Filter by date</summary>
        <div class="rpt-date-box">
          <label>From <input type="date" id="rpt-from" value="${esc(from)}" /></label>
          <label>To <input type="date" id="rpt-to" value="${esc(to)}" /></label>
          <button type="button" class="rpt-pill" id="rpt-apply-dates">Apply</button>
        </div>
      </details>
      ${extra}
    </div>
    <div class="rpt-toolbar-r">
      ${ai ? `<button type="button" class="rpt-pill" id="rpt-ai">${sparkIco()} Use AI</button>` : ''}
      ${print ? `<button type="button" class="rpt-pill" id="rpt-print">${printIco()} Print</button>` : ''}
    </div>
  </div>`;
}

function bindChrome(app) {
  const sel = app.querySelector('#rpt-loc');
  if (sel) sel.onchange = () => go({ loc: sel.value });
  const apply = app.querySelector('#rpt-apply-dates');
  if (apply) apply.onclick = () => {
    go({
      from: app.querySelector('#rpt-from')?.value || '',
      to: app.querySelector('#rpt-to')?.value || '',
    });
  };
  const pr = app.querySelector('#rpt-print');
  if (pr) pr.onclick = () => window.print();
  const ai = app.querySelector('#rpt-ai');
  if (ai) ai.onclick = () => runAi(app);
}

async function runAi(app) {
  const box = app.querySelector('#rpt-ai-out') || (() => {
    const d = document.createElement('div');
    d.id = 'rpt-ai-out';
    d.className = 'rpt-ai-card';
    app.querySelector('.rpt-toolbar')?.insertAdjacentElement('afterend', d);
    return d;
  })();
  box.innerHTML = `<p class="ult-muted">Asking Grok to read this P&L…</p>`;
  const p = plLines(loc());
  try {
    const res = await fetch('/api/ai', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        title: 'Profit / Loss insight',
        fields: {
          language: 'English',
          shop: 'Delkor-Fiberk Group, Accra',
          range: `${dateRange().from} – ${dateRange().to}`,
          location: LOCS.find((l) => l.code === loc())?.name || 'All locations',
          total_sales: money(p.totalSales),
          total_purchase: money(p.totalPurchase),
          cogs: money(p.cogs),
          gross_profit: money(p.gross) + ` (${p.grossPct.toFixed(2)}%)`,
          net_profit: money(p.net) + ` (${p.netPct.toFixed(2)}%)`,
          tax_collected: money(p.taxSales),
          tax_paid: money(p.taxPurch),
          details: 'Write 4 short bullets a Ghana retail GM can act on. Mention GRA VAT and stock. No markdown fences.',
        },
      }),
    });
    const json = await res.json();
    const text = json?.text || json?.error || 'AI is not available right now.';
    box.innerHTML = `<h3>${sparkIco()} Grok on this P&L</h3><pre>${esc(text)}</pre>`;
  } catch (err) {
    box.innerHTML = `<p class="ult-muted">Could not reach AI. ${esc(err.message || err)}</p>`;
  }
}

function kvRow(label, value, { hi, sub } = {}) {
  return `<div class="rpt-kv ${hi || ''}">
    <span>${label}${sub ? `<small>${sub}</small>` : ''}</span>
    <b>${money(value)}</b>
  </div>`;
}

function mountOfficial(app, spec, after) {
  const { table, charts, ...rest } = spec || {};
  app.innerHTML = officialReportHtml({ ...rest, extraHtml: rest.extraHtml || '' });
  bindChrome(app);
  bindOfficialReport(app);
  after?.(app);
}

const DOC_CSS = `
  .df-rpt-doc{background:#fff;border:1px solid #e2e8f0;border-radius:12px;padding:4px 8px 20px;margin:8px 0 28px}
  .df-rpt-doc .rv-x,.df-rpt-doc [data-rv-close],.df-rpt-doc .rv-close{display:none !important}
  .df-rpt-pick{margin:0 0 12px;display:flex;gap:10px;flex-wrap:wrap;align-items:center}
  .df-rpt-pick select{min-width:min(560px,100%);border:1px solid #111;border-radius:8px;padding:8px 10px;font:inherit}
  .df-rpt-listlink{margin:0 0 12px;font-size:13px;color:#334155}
  .df-rpt-listlink a{font-weight:700;color:#1d4ed8}
`;

function inRange(iso) {
  const { from, to } = dateRange();
  const d = String(iso || '').slice(0, 10);
  if (!d) return true;
  if (from && d < from) return false;
  if (to && d > to) return false;
  return true;
}

function hydratePurchase(r) {
  if (!r) return r;
  const raw = Array.isArray(r.lines) && r.lines.length ? r.lines
    : (Array.isArray(r.items) && r.items.length ? r.items : []);
  let lines = raw.map((l) => ({
    ...l,
    name: l.name || l.product_name || l.product || '',
    sku: l.sku || l.product_sku || '',
    qty: l.qty ?? l.quantity ?? 1,
    unit_price: l.unit_price ?? l.unit_cost ?? l.cost ?? l.price ?? 0,
    unit_cost: l.unit_cost ?? l.unit_price ?? l.cost ?? 0,
    discount: l.discount ?? l.discount_percent ?? 0,
    tax: l.tax ?? l.tax_amount ?? 0,
    subtotal: l.subtotal ?? l.line_total ?? l.amount ?? 0,
  }));
  if (!lines.length) {
    const ref = String(r.reference || r.reference_no || r.id || '');
    lines = purchaseProductRows(loc()).filter((l) => String(l.ref) === ref).map((l) => ({
      name: l.name, sku: l.sku, qty: l.qty, unit_price: l.cost, unit_cost: l.cost,
      discount: 0, tax: 0, subtotal: Number(l.qty || 0) * Number(l.cost || 0),
    }));
  }
  let payments = r.payments || r.payments_view || [];
  if (!Array.isArray(payments)) payments = [];
  if (!payments.length && Number(r.amount_paid || 0) > 0) {
    payments = [{
      date: r.paid_on || r.payment_date || r.date || r.order_date || '',
      reference: r.payment_ref || r.payment_reference || '',
      amount: r.amount_paid,
      method: r.payment_method || r.method || r.payment_mode || '',
      note: r.payment_note || '',
    }];
  }
  const sup = r.supplier && typeof r.supplier === 'object' ? r.supplier : {};
  return {
    ...r,
    supplier_name: r.supplier_name || sup.name || (typeof r.supplier === 'string' ? r.supplier : ''),
    supplier_address: r.supplier_address || sup.address || '',
    supplier_phone: r.supplier_phone || sup.phone || sup.mobile || '',
    location_name: r.location_name || r.business || r.loc || '',
    reference: r.reference || r.reference_no || r.ref || r.id,
    order_date: r.order_date || r.date,
    total_amount: r.total_amount || r.grand_total || r.total,
    discount: r.discount ?? r.discount_amount ?? 0,
    tax: r.tax ?? r.tax_amount ?? 0,
    shipping: r.shipping ?? r.shipping_charges ?? 0,
    note: r.note || r.additional_notes || '',
    shipping_details: r.shipping_details || '',
    lines,
    payments,
  };
}

function hydrateSale(r) {
  if (!r) return r;
  const raw = Array.isArray(r.lines) && r.lines.length ? r.lines
    : (Array.isArray(r.items) && r.items.length ? r.items : []);
  const lines = raw.map((l) => ({
    ...l,
    name: l.name || l.product_name || l.product || '',
    sku: l.sku || l.product_sku || '',
    qty: l.qty ?? l.quantity ?? 1,
    unit_price: l.unit_price ?? l.price ?? l.sell ?? 0,
    subtotal: l.subtotal ?? l.line_total ?? l.amount ?? 0,
  }));
  let payments = r.payments || [];
  if (!Array.isArray(payments)) payments = [];
  if (!payments.length && Number(r.amount_paid || 0) > 0) {
    payments = [{
      date: r.paid_on || r.date || r.order_date || '',
      amount: r.amount_paid,
      method: r.payment_method || r.method || '',
      note: r.payment_note || '',
    }];
  }
  return {
    ...r,
    customer_name: r.customer_name || r.customer || 'Walk-In Customer',
    invoice_no: r.invoice_no || r.reference || r.id,
    order_date: r.order_date || r.date,
    total_amount: r.total_amount || r.grand_total || r.total,
    location_name: r.location_name || r.loc || '',
    lines,
    payments,
  };
}

function hydrateProduct(p) {
  if (!p) return p;
  const stock = (stockRows(loc()) || []).find((s) => s.sku === p.sku || s.id === p.id) || {};
  return {
    ...p,
    location_name: p.location_name || stock.loc || p.available_locations || p.loc,
    department_name: p.department_name || p.department || stock.department || '',
    stock: p.stock ?? p.current_stock ?? stock.qty,
    current_stock: p.current_stock ?? p.stock ?? stock.qty,
    units_sold: p.units_sold ?? stock.sold,
    units_transferred: p.units_transferred ?? stock.xfer,
    units_adjusted: p.units_adjusted ?? stock.adj,
    selling_price: p.selling_price ?? p.sell ?? stock.sell,
    purchase_price: p.purchase_price ?? p.buy ?? stock.buy,
    wholesale_price: p.wholesale_price ?? p.group_wholesale,
    retail_price: p.retail_price ?? p.group_retail,
  };
}

function purchaseBook() {
  const a = readLs('df_purchases', []) || [];
  const b = readLs('df_purchase_orders', []) || [];
  const seen = new Set();
  const out = [];
  [...a, ...b].forEach((r) => {
    const k = String(r.id || r.reference || r.reference_no || '');
    if (!k || seen.has(k)) return;
    seen.add(k);
    out.push(hydratePurchase(r));
  });
  return out
    .filter((r) => liveLocMatch(r.location_code || r.location_name, loc()))
    .filter((r) => inRange(r.date || r.order_date || r.created_at))
    .sort((x, y) => String(y.date || y.order_date || '').localeCompare(String(x.date || x.order_date || '')));
}

function productBook() {
  return (readLs('df_products', []) || [])
    .filter((p) => p && (p.sku || p.name))
    .filter((p) => liveLocMatch(p.location_code || p.location_name || p.loc, loc()))
    .map(hydrateProduct);
}

function salesBook() {
  const rows = (readLs('df_sales_orders', []) || []).concat(readLs('df_pos_sales', []) || []);
  return rows
    .map(hydrateSale)
    .filter((r) => liveLocMatch(r.location_code || r.location_name, loc()))
    .filter((r) => inRange(r.order_date || r.date || r.created_at))
    .sort((x, y) => String(y.order_date || y.date || '').localeCompare(String(x.order_date || x.date || '')));
}

function hydrateAdjustment(r) {
  if (!r) return r;
  const raw = Array.isArray(r.lines) && r.lines.length ? r.lines : [];
  const lines = raw.map((l) => {
    const qty = Number(l.qty ?? l.quantity ?? 0);
    const cost = Number(l.cost ?? l.unit_price ?? l.unit_cost ?? 0);
    return {
      ...l,
      name: l.name || l.product_name || '',
      sku: l.sku || '',
      qty,
      unit_price: cost,
      cost,
      subtotal: l.subtotal ?? (qty * cost),
    };
  });
  const total = Number(r.total_amount || 0) || lines.reduce((s, l) => s + Number(l.subtotal || 0), 0);
  return {
    ...r,
    reference: r.reference_no || r.reference || r.ref || r.id || '',
    reference_no: r.reference_no || r.reference || r.ref || r.id || '',
    location_name: r.location_name || r.location || r.location_code || '',
    adjustment_date: r.adjustment_date || r.date || r.created_at || '',
    kind: r.kind || r.adjustment_type || '',
    total_amount: total,
    recovered: Number(r.recovered || r.total_amount_recovered || 0),
    reason: r.reason || '',
    added_by: r.added_by || '',
    lines,
  };
}

function blankAdjustment() {
  return hydrateAdjustment({
    id: '',
    reference_no: '—',
    location_name: '—',
    adjustment_date: '',
    kind: '',
    total_amount: 0,
    recovered: 0,
    reason: '',
    added_by: '',
    lines: [],
  });
}

function adjustmentBook() {
  return (readLs('df_stock_adjustments', []) || [])
    .filter((r) => r && (r.id || r.reference_no || r.reference || r.lines))
    .map(hydrateAdjustment)
    .filter((r) => liveLocMatch(r.location_code || r.location_name || r.location, loc()))
    .filter((r) => inRange(r.adjustment_date || r.date || r.created_at))
    .sort((x, y) => String(y.adjustment_date || y.date || '').localeCompare(String(x.adjustment_date || x.date || '')));
}

function contactBook() {
  return (readLs('df_customers', []) || [])
    .concat(readLs('df_suppliers', []) || [])
    .concat(readLs('df_contacts', []) || [])
    .filter((r) => r && (r.name || r.business_name || r.full_name || r.id));
}

function recId(r) {
  return String(r?.id || r?.reference || r?.reference_no || r?.invoice_no || r?.sku || '');
}

function paintDocReport(app, {
  title, kind, rows, labelOf, empty, notes, listHref, listLabel, blank,
}) {
  const list = (rows || []).filter(Boolean);
  const q = new URLSearchParams(location.search);
  const want = q.get('id') || recId(list[0]);
  const rec = list.find((r) => recId(r) === String(want)) || list[0] || blank || null;
  const pickList = list.filter((r) => {
    const id = recId(r);
    return id && id !== '—';
  });
  const opts = pickList.slice(0, 200).map((r) => {
    const id = recId(r);
    const on = rec && recId(r) === recId(rec);
    return `<option value="${esc(id)}" ${on ? 'selected' : ''}>${esc(labelOf(r))}</option>`;
  }).join('');
  const listNote = listHref
    ? `<p class="df-rpt-listlink">Working list: <a href="${esc(listHref)}">${esc(listLabel || 'Open list')}</a></p>`
    : '';
  app.innerHTML = `
    <style>${DOC_CSS}</style>
    <div class="rpt-head"><h1>${esc(title)}</h1>
      <p class="sub">${esc(notes || 'Read-only document. Working lists live under Purchases, Sales, Operations and Records.')}</p></div>
    ${toolbar()}
    ${listNote}
    ${pickList.length ? `<div class="df-rpt-pick"><label>This record
      <select id="doc-pick">${opts}</select></label>
      <button type="button" class="ult-btn ult-btn-primary" id="df-rpt-print">Print</button></div>` : ''}
    <div class="df-rpt-doc">${rec ? recordSheetHtml(rec, kind) : `<p class="ult-muted">${esc(empty || 'No document in this range.')}</p>`}</div>`;
  bindChrome(app);
  const pick = app.querySelector('#doc-pick');
  if (pick) pick.onchange = () => {
    const u = new URL(location.href);
    u.searchParams.set('id', pick.value);
    history.pushState({ spa: u.pathname + u.search }, '', u.pathname + u.search);
    paint();
  };
  app.querySelector('#df-rpt-print')?.addEventListener('click', () => window.print());
}

function paintPL(app) {
  const p = plLines(loc());
  app.innerHTML = officialReportHtml({
    title: 'Profit / Loss Report',
    category: 'Finance Reports',
    status: p.net >= 0 ? 'Profit' : 'Loss',
    statusTone: p.net >= 0 ? 'green' : 'red',
    filtersHtml: toolbar({ ai: true }),
    kpis: [
      { label: 'Total sales', value: money(p.totalSales), tone: 'green' },
      { label: 'Total purchase', value: money(p.totalPurchase), tone: 'amber' },
      { label: 'Gross profit', value: money(p.gross), tone: 'blue' },
      { label: 'Net profit', value: money(p.net), tone: p.net >= 0 ? 'green' : 'red' },
    ],
    extraHtml: `
    <div class="rpt-pl-grid">
      <section class="rpt-card">
        <header class="rpt-card-h"><span class="dot red"></span> COSTS & DEDUCTIONS</header>
        ${kvRow('Opening Stock<br><small>(By purchase price):</small>', p.openingPurchase)}
        ${kvRow('Opening Stock<br><small>(By sale price):</small>', p.openingSale)}
        ${kvRow('Total purchase:<br><small>(Exc. tax, Discount)</small>', p.totalPurchase, { hi: 'hl-y' })}
        ${kvRow('Total Stock Adjustment:', p.stockAdj)}
        ${kvRow('Total Expense:', p.expense)}
        ${kvRow('Total purchase shipping charge:', p.purchaseShipping)}
        ${kvRow('Purchase additional expenses:', p.purchaseAdd)}
        ${kvRow('Total transfer shipping charge:', p.transferShipping)}
        ${kvRow('Total Sell discount:', p.sellDiscount)}
        ${kvRow('Total customer reward:', p.reward)}
        ${kvRow('Total Sell Return:', p.sellReturn)}
        ${kvRow('Total Payroll:', p.payroll)}
        ${kvRow('Total Production Cost:', p.production)}
      </section>
      <section class="rpt-card">
        <header class="rpt-card-h"><span class="dot green"></span> REVENUE & INCOME</header>
        ${kvRow('Closing stock<br><small>(By purchase price):</small>', p.closingPurchase)}
        ${kvRow('Closing stock<br><small>(By sale price):</small>', p.closingSale)}
        ${kvRow('Total Sales:<br><small>(Exc. tax, Discount)</small>', p.totalSales, { hi: 'hl-g' })}
        ${kvRow('Total sell shipping charge:', p.sellShipping)}
        ${kvRow('Sell additional expenses:', p.sellAdd)}
        ${kvRow('Total Stock Recovered:', p.stockRecovered)}
        ${kvRow('Total Purchase Return:', p.purchaseReturn)}
        ${kvRow('Total Purchase discount:', p.purchaseDiscount)}
        ${kvRow('Total sell round off:', p.roundOff)}
        ${kvRow('Total Sell Return Discount:', p.sellReturnDiscount)}
        ${kvRow('Hms Total:', p.hms)}
      </section>
    </div>
    <section class="rpt-card rpt-summary">
      <p class="rpt-cogs"><b>COGS: ${money(p.cogs)}</b>
        <small>Cost of Goods Sold = Starting inventory(opening stock) + purchases − ending inventory(closing stock)</small></p>
      <p class="rpt-gp"><b>Gross Profit: ${money(p.gross)}</b> <span>(${p.grossPct.toFixed(2)}%)</span>
        <small>(Total sell price − Total purchase price) + Hms Total + Project Invoice</small></p>
      <p class="rpt-np"><b>Net Profit: ${money(p.net)}</b> <span>(${p.netPct.toFixed(2)}%)</span>
        <small>Gross Profit + (Total sell shipping charge + Sell additional expenses + Total Stock Recovered + Total Purchase discount + Total sell round off + Total Sell Return Discount + Hms Total) − (Total Stock Adjustment + Total Expense + Purchase additional expenses + Total transfer shipping charge + Purchase additional expenses + Total Sell discount + Total customer reward + Total Payroll + Total Production Cost)</small></p>
      <h3>${calIco()} Tax Summary</h3>
      <p>Tax Collected on Sales: <b>${money(p.taxSales)}</b></p>
      <p>Tax Paid on Purchases: <b>${money(p.taxPurch)}</b></p>
      <p>Net Tax Liability: <b class="${p.taxNet >= 0 ? 'rpt-pos' : 'rpt-neg'}">${money(p.taxNet)}</b></p>
      <p class="ult-muted">This section is informational only. The P&L figures above are calculated excluding tax.</p>
    </section>`,
    notes: 'P&L figures exclude tax. Tax summary is informational. Listing tables stay under Purchases / Sales / Records.',
  });
  bindChrome(app);
  bindOfficialReport(app);
}

function paintZ(app) {
  const p = plLines(loc());
  const salesEx = p.totalSales;
  const disc = p.sellDiscount;
  const sellRet = p.sellReturn;
  const purchEx = p.totalPurchase;
  const purchDisc = p.purchaseDiscount;
  const purchRet = p.purchaseReturn;
  const delivery = p.sellShipping;
  const exp = p.expense;
  const hand = salesEx - sellRet - purchEx + purchRet + delivery - exp;
  app.innerHTML = officialReportHtml({
    title: 'Z Report',
    category: 'System Reports',
    status: hand >= 0 ? 'In hand' : 'Short',
    statusTone: hand >= 0 ? 'green' : 'red',
    filtersHtml: toolbar(),
    kpis: [
      { label: 'Item sales', value: money(salesEx), tone: 'green' },
      { label: 'Purchases', value: money(purchEx), tone: 'amber' },
      { label: 'Expenses', value: money(exp), tone: 'red' },
      { label: 'Sales in hand', value: money(hand), tone: hand >= 0 ? 'blue' : 'red' },
    ],
    extraHtml: `
    <div class="rpt-z-wrap">
      <section class="rpt-card">
        <div class="rpt-kv head"><span>Label</span><b>Amount</b></div>
        <div class="rpt-kv"><span>Total Item Sales (Without Tax) (Incl. Discount)<small>Incl. discount: ${money(disc)}</small></span><b>${money(salesEx)}</b></div>
        <div class="rpt-kv"><span>Sell Returns (−)<small>Incl. discount: ${money(0)}</small></span><b>${money(sellRet)}</b></div>
        <div class="rpt-kv"><span>Purchase (Without Tax) (Incl. Discount) (−)<small>Incl. discount: ${money(purchDisc)}</small></span><b>${money(purchEx)}</b></div>
        <div class="rpt-kv"><span>Purchase Returns (+)</span><b>${money(purchRet)}</b></div>
        <div class="rpt-kv"><span>Delivery Charge (+)</span><b>${money(delivery)}</b></div>
        <div class="rpt-kv"><span>Expenses (−)</span><b>${money(exp)}</b></div>
        <div class="rpt-kv rpt-total"><span>Total Sales in Hand</span><b class="${hand >= 0 ? '' : 'rpt-neg'}">${money(hand)}</b></div>
      </section>
    </div>`,
    notes: 'Z is sales in hand for the selected date range.',
  });
  bindChrome(app);
  bindOfficialReport(app);
}

function paintPS(app) {
  const p = plLines(loc());
  const purchTax = p.totalPurchase + (p.taxPurch || 0);
  const saleTax = p.totalSales + (p.taxSales || 0);
  const dues = ageingRows();
  const purchDue = dues.filter((r) => r.kind === 'Supplier').reduce((s, r) => s + r.current + r.d30 + r.d60 + r.d90 + r.older, 0);
  const saleDue = dues.filter((r) => r.kind === 'Customer').reduce((s, r) => s + r.current + r.d30 + r.d60 + r.d90 + r.older, 0);
  const overall = (p.totalSales - p.sellReturn) - (p.totalPurchase - p.purchaseReturn);
  const dueAmt = saleDue - purchDue;
  app.innerHTML = officialReportHtml({
    title: 'Purchase & Sale Report',
    category: 'Purchase Reports',
    status: overall >= 0 ? 'Surplus' : 'Deficit',
    statusTone: overall >= 0 ? 'green' : 'red',
    filtersHtml: toolbar(),
    kpis: [
      { label: 'Total sales', value: money(p.totalSales), tone: 'green' },
      { label: 'Total purchases', value: money(p.totalPurchase), tone: 'amber' },
      { label: 'Sale − purchase', value: money(overall), tone: overall >= 0 ? 'blue' : 'red' },
      { label: 'Net due', value: money(dueAmt), tone: 'teal' },
    ],
    extraHtml: `
    <div class="rpt-pl-grid">
      <section class="rpt-card">
        <header class="rpt-card-h muted">Purchases</header>
        ${kvRow('Total Purchase:', p.totalPurchase)}
        ${kvRow('Purchase Including tax:', purchTax)}
        ${kvRow('Total Purchase Return Including Tax:', p.purchaseReturn)}
        ${kvRow('Purchase Due: ' + infoIco(), purchDue)}
      </section>
      <section class="rpt-card">
        <header class="rpt-card-h muted">Sales</header>
        ${kvRow('Total Sale:', p.totalSales)}
        ${kvRow('Sale Including tax:', saleTax)}
        ${kvRow('Total Sell Return Including Tax:', p.sellReturn)}
        ${kvRow('Sale Due: ' + infoIco(), saleDue)}
      </section>
    </div>
    <section class="rpt-card">
      <p class="ult-muted">Overall ((Sale − Sell Return) − (Purchase − Purchase Return)) ${infoIco()}</p>
      <p class="rpt-big">Sale − Purchase: <b class="${overall >= 0 ? 'rpt-pos' : 'rpt-neg'}">${money(overall)}</b></p>
      <p class="rpt-big">Due amount: <b class="${dueAmt >= 0 ? 'rpt-pos' : 'rpt-neg'}">${money(dueAmt)}</b></p>
    </section>`,
    notes: 'Purchase & sale totals for the selected date range. Line listings stay under Purchases and Sales.',
  });
  bindChrome(app);
  bindOfficialReport(app);
}

function taxTotals(rows) {
  return rows.reduce((a, r) => {
    a.total += Number(r.total || 0);
    a.discount += Number(r.discount || 0);
    a.vat += Number(r.vat || 0);
    a.nhil += Number(r.nhil || 0);
    a.getf += Number(r.getf || 0);
    return a;
  }, { total: 0, discount: 0, vat: 0, nhil: 0, getf: 0 });
}

function paintTax(app) {
  const tab = pane() || 'in';
  const TABS = [
    { key: 'in', label: 'Input Tax ( Purchase )' },
    { key: 'out', label: 'Output Tax ( Sales )' },
    { key: 'exp', label: 'Expense Tax' },
    { key: 'pi', label: 'Output Tax (Project Invoice)' },
  ];
  const rowsSrc = tab === 'out' ? TAX_OUT : tab === 'exp' ? TAX_EXP : tab === 'pi' ? TAX_PI : TAX_IN;
  const tot = taxTotals(rowsSrc);
  const inT = taxTotals(TAX_IN).vat;
  const outT = taxTotals(TAX_OUT).vat;
  const expT = taxTotals(TAX_EXP).vat;
  const p = plLines(loc());
  const overall = (p.taxSales || outT) - (p.taxPurch || inT) - expT;
  mountOfficial(app, {
    title: 'Tax Report',
    category: 'Finance Reports',
    status: overall >= 0 ? 'Payable' : 'Credit',
    statusTone: overall >= 0 ? 'amber' : 'green',
    filtersHtml: `<nav class="hub-subtabs rpt-subtabs">${TABS.map((t) =>
      `<a href="${qset({ pane: t.key === 'in' ? '' : t.key })}" class="${tab === t.key ? 'on' : ''}" data-pane="${t.key}">${esc(t.label)}</a>`).join('')}</nav>${toolbar()}`,
    kpis: [
      { label: 'Output VAT', value: money(p.taxSales || outT), tone: 'green' },
      { label: 'Input VAT', value: money(p.taxPurch || inT), tone: 'blue' },
      { label: 'Expense tax', value: money(expT), tone: 'amber' },
      { label: 'Net GRA', value: money(overall), tone: overall >= 0 ? 'red' : 'teal' },
    ],
    extraHtml: `<section class="rpt-card">
      ${kvRow('Total amount (this tab)', tot.total)}
      ${kvRow('Discount', tot.discount)}
      ${kvRow('VAT @ 15%', tot.vat || (tab === 'out' ? p.taxSales : tab === 'in' ? p.taxPurch : 0))}
      ${kvRow('NHIL @ 2.5%', tot.nhil)}
      ${kvRow('GETFund @ 2.5%', tot.getf)}
    </section>
    <p class="df-rpt-listlink" style="padding:0 4px">Invoice lines stay on <a href="/purchase-orders.html">List Purchases</a> and Sales. This page is the GRA summary only.</p>`,
    notes: 'GRA VAT / NHIL / GETFund for the selected range. Informational — not a filing pack.',
  }, (root) => {
    root.querySelectorAll('[data-pane]').forEach((a) => {
      a.onclick = (e) => { e.preventDefault(); e.stopPropagation(); go({ pane: a.dataset.pane === 'in' ? '' : a.dataset.pane }); };
    });
  });
}

function paintPP(app) {
  paintDocReport(app, {
    title: 'Product Purchase Report',
    kind: 'purchase',
    rows: purchaseBook(),
    labelOf: (r) => `${r.reference || r.reference_no || r.id} · ${r.supplier_name || ''} · ${String(r.date || r.order_date || '').slice(0, 10)}`,
    empty: 'No purchases on file. Add them under Purchases → List Purchases.',
    notes: 'Read-only Purchase Details. The purchase list stays under Purchases → List Purchases.',
    listHref: '/purchase-orders.html',
    listLabel: 'List Purchases',
  });
}
function paintPpay(app) { paintPP(app); }
function paintPsp(app) { paintPP(app); }

function paintSell(app) {
  paintDocReport(app, {
    title: 'Product Sell Report',
    kind: 'sale',
    rows: salesBook(),
    labelOf: (r) => `${r.invoice_no || r.reference || r.id} · ${r.customer_name || 'Walk-in'} · ${String(r.order_date || r.date || '').slice(0, 10)}`,
    empty: 'No sales on file. Lists stay under Sales.',
    notes: 'Read-only sell details. The sales list stays under Sales.',
    listHref: '/sales-orders.html',
    listLabel: 'All sales',
  });
}
function paintSpay(app) { paintSell(app); }
function paintSalesRep(app) { paintSell(app); }
function paintSellGroup(app) { paintItems(app); }

function paintItems(app) {
  paintDocReport(app, {
    title: 'Items Report',
    kind: 'product',
    rows: productBook(),
    labelOf: (r) => `${r.sku || ''} · ${r.name || r.product_name || ''}`,
    empty: 'No products on file. Lists stay under Records → Products.',
    notes: 'Read-only product card. The product list stays under Records → List Products.',
    listHref: '/products.html',
    listLabel: 'List Products',
  });
}
function paintStock(app) { paintItems(app); }

function paintAdj(app) {
  const rows = adjustmentBook();
  paintDocReport(app, {
    title: 'Stock Adjustment Report',
    kind: 'adjustment',
    rows,
    blank: blankAdjustment(),
    labelOf: (r) => `${r.reference_no || r.reference || r.id || '—'} · ${r.location_name || ''} · ${String(r.adjustment_date || '').slice(0, 10)}`,
    empty: 'No stock adjustments in this range.',
    notes: 'Read-only stock adjustment sheet. The working list stays under Operations → List Stock Adjustments.',
    listHref: '/stock-adjustments.html',
    listLabel: 'List Stock Adjustments',
  });
}

function paintExpenseRpt(app) {
  const rows = expenseRows(loc()).map((r) => ({
    ...r,
    title: r.cat || r.to || 'Expense',
    expense_date: r.date,
    payment_to: r.to,
    category: r.cat,
    total_amount: r.amount,
    reference_no: r.ref,
  }));
  paintDocReport(app, {
    title: 'Expense Report',
    kind: 'expense',
    rows,
    labelOf: (r) => `${r.ref || r.date || ''} · ${r.cat || ''} · ${r.to || ''}`,
    empty: 'No expenses on file. Lists stay under Finance.',
    notes: 'Read-only expense sheet. Lists stay under Finance → List Expenses.',
    listHref: '/expenses.html',
    listLabel: 'List Expenses',
  });
}

function paintAge(app) {
  paintDocReport(app, {
    title: 'Payment by Age',
    kind: 'customer',
    rows: contactBook(),
    labelOf: (r) => `${r.name || r.business_name || r.full_name || r.id}`,
    empty: 'No contacts on file. Lists stay under Records.',
    notes: 'Balances live on the contact sheet. Lists stay under Records.',
    listHref: '/customers.html',
    listLabel: 'Customers',
  });
}
function paintContacts(app) { paintAge(app); }
function paintGroups(app) { paintAge(app); }

function paintContact(app) {
  const id = new URLSearchParams(location.search).get('id') || '';
  const rows = contactBook();
  const rec = rows.find((r) => String(r.id) === String(id)) || rows[0];
  const kind = String(rec?.contact_type || rec?.kind || '').toLowerCase() === 'supplier' ? 'supplier' : 'customer';
  paintDocReport(app, {
    title: 'View Contact',
    kind,
    rows,
    labelOf: (r) => `${r.name || r.business_name || r.full_name || r.id}`,
    empty: 'No contact on file.',
    notes: 'Read-only contact sheet. Lists stay under Records.',
    listHref: kind === 'supplier' ? '/suppliers.html' : '/customers.html',
    listLabel: kind === 'supplier' ? 'Suppliers' : 'Customers',
  });
}

function pill(text, kind) {
  const cls = kind === 'Paid' || kind === 'Final' ? 'ok' : kind === 'Due' ? 'due' : 'muted';
  return `<span class="rpt-badge ${cls}">${esc(text)}</span>`;
}

function paintActivity(app) {
  const rows = activityRows();
  const users = activityUsers();
  const types = activityTypes();
  const q = new URLSearchParams(location.search);
  const user = q.get('user') || '';
  const stype = q.get('stype') || '';
  const { from, to } = dateRange();
  const acts = rows.slice(0, 80).map((r) => `
    <tr>
      <td>${esc(String(r.date).replace('T', ' ').slice(0, 16))}</td>
      <td>${esc(r.action || r.type || '')}</td>
      <td>${esc(r.by || '')}</td>
      <td>${r.invoice
        ? `Invoice No.: ${esc(r.invoice)}${r.status ? ' · ' + pill(r.status, r.status) : ''}${r.total ? ' · ' + pill(money(r.total), 'Final') : ''}`
        : esc(r.note || '')}</td>
    </tr>`).join('') || `<tr><td colspan="4" class="ult-muted">No activity in this range.</td></tr>`;
  app.innerHTML = officialReportHtml({
    title: 'Activity Log',
    category: 'System Reports',
    status: rows.length ? `${rows.length} events` : 'Quiet',
    statusTone: rows.length ? 'blue' : 'slate',
    filtersHtml: `<details class="ess-filters" open>
      <summary><span class="ess-filter-ico">▽</span> Filters</summary>
      <div class="pr-filters">
        <label>User <select id="al-user"><option value="">All</option>${users.map((u) =>
          `<option ${u === user ? 'selected' : ''}>${esc(u)}</option>`).join('')}</select></label>
        <label>Subject type <select id="al-type"><option value="">All</option>${types.map((t) =>
          `<option ${t === stype ? 'selected' : ''}>${esc(t)}</option>`).join('')}</select></label>
        <label>From <input type="date" id="al-from" value="${esc(from)}" /></label>
        <label>To <input type="date" id="al-to" value="${esc(to)}" /></label>
      </div>
    </details>${toolbar()}`,
    kpis: [
      { label: 'Events', value: String(rows.length), tone: 'blue' },
      { label: 'Users', value: String(users.length), tone: 'slate' },
      { label: 'Subject types', value: String(types.length), tone: 'teal' },
    ],
    extraHtml: `<style>${DOC_CSS}
      .df-rpt-act{width:100%;border-collapse:collapse;font-size:13px}
      .df-rpt-act th,.df-rpt-act td{text-align:left;padding:8px 4px;border-bottom:1px solid #e5e7eb}
    </style>
    <section class="rpt-card">
      <div class="rv-nl" style="padding:8px 4px 0">Activities:</div>
      <table class="df-rpt-act"><thead><tr><th>Date</th><th>Action</th><th>By</th><th>Note</th></tr></thead>
      <tbody>${acts}</tbody></table>
    </section>`,
    notes: 'Who changed what in this date range. Audit trail — not a listing of master records.',
  });
  bindChrome(app);
  bindOfficialReport(app);
  const applyAl = () => go({
    user: app.querySelector('#al-user')?.value || '',
    stype: app.querySelector('#al-type')?.value || '',
    from: app.querySelector('#al-from')?.value || '',
    to: app.querySelector('#al-to')?.value || '',
  });
  ['al-user', 'al-type', 'al-from', 'al-to'].forEach((id) => app.querySelector('#' + id)?.addEventListener('change', applyAl));
}

function paintRegister(app) {
  const all = listRegisterReports().filter((r) => r.source === 'cashier_close');
  const q = new URLSearchParams(location.search);
  const want = q.get('id') || all[0]?.id || '';
  const rec = want ? (getRegisterReport(want) || all.find((r) => r.id === want)) : all[0];
  const opts = all.map((r) => {
    const label = `${ghanaStamp(r.opened_at)} → ${ghanaStamp(r.closed_at)} · ${r.cashier || 'Cashier'} · ${r.location_name || ''}`;
    return `<option value="${esc(r.id)}" ${r.id === rec?.id ? 'selected' : ''}>${esc(label)}</option>`;
  }).join('');
  const pick = all.length ? `<div class="rpt-pick" style="margin:0 0 12px">
    <label style="font-weight:700;font-size:13px">This close
      <select id="reg-pick" style="display:block;min-width:min(520px,100%);margin-top:4px;border:1px solid #111;border-radius:8px;padding:8px 10px">${opts}</select>
    </label></div>` : '';
  app.innerHTML = officialReportHtml({
    title: 'POS Register Report',
    category: 'Sales Reports',
    status: rec ? 'Closed' : 'No close yet',
    statusTone: rec ? 'green' : 'slate',
    filtersHtml: pick + toolbar(),
    kpis: rec ? [
      { label: 'Opening', value: money(rec.opening_float), tone: 'slate' },
      { label: 'Net sales', value: money(rec.net_sales), tone: 'green' },
      { label: 'Collected', value: money(rec.collected), tone: 'blue' },
      { label: 'Expected cash', value: money(rec.expected), tone: 'amber' },
    ] : [
      { label: 'Opening', value: money(0), tone: 'slate' },
      { label: 'Net sales', value: money(0), tone: 'green' },
      { label: 'Collected', value: money(0), tone: 'blue' },
      { label: 'Expected cash', value: money(0), tone: 'amber' },
    ],
    extraHtml: `<style>${registerSheetCss()}</style>` + (rec
      ? `<section class="df-rpt-sheet" id="reg-print-src">${wrapRegisterHtml(rec)}</section>`
      : `<section class="df-rpt-sheet"><p style="margin:0;color:#334155">No register has been closed yet. Close a till from <b>Close register</b>. This page is the close sheet — not a sales list.</p></section>`),
    notes: 'Read-only. Written only when a cashier confirms Close register.',
    branch: rec?.location_name || reportBranch(),
    generatedBy: rec?.cashier || reportWho(),
  });
  bindChrome(app);
  bindOfficialReport(app);
  const pickEl = app.querySelector('#reg-pick');
  if (pickEl) pickEl.onchange = () => { location.assign('/report-register.html?id=' + encodeURIComponent(pickEl.value)); };
}

const REPORT_GROUPS = [
  {
    key: 'purchase',
    label: 'Purchase Reports',
    items: [
      { href: '/report-purchase-sell.html', label: 'Purchase & Sale', hint: 'Bought vs sold totals' },
      { href: '/reports.html?t=pp', label: 'Product Purchase Report', hint: 'Purchase Details document' },
      { href: '/reports.html?t=ppay', label: 'Purchase Payment Report', hint: 'Same purchase sheet' },
      { href: '/reports.html?t=psp', label: 'Purchase & Sale Product', hint: 'Purchase Details document' },
    ],
  },
  {
    key: 'inventory',
    label: 'Inventory Reports',
    items: [
      { href: '/report-stock.html', label: 'Stock Report', hint: 'Product card' },
      { href: '/reports.html?t=adj', label: 'Stock Adjustment Report', hint: 'Opens List Stock Adjustments' },
      { href: '/trending-products.html', label: 'Trending Products', hint: 'Product card' },
      { href: '/reports.html?t=items', label: 'Items Report', hint: 'Product card' },
    ],
  },
  {
    key: 'sales',
    label: 'Sales Reports',
    items: [
      { href: '/reports.html?t=sell', label: 'Product Sell Report', hint: 'Sell details document' },
      { href: '/reports.html?t=sell-group', label: 'Product Sell (Grouped)', hint: 'Product card' },
      { href: '/report-register.html', label: 'POS Register Report', hint: 'Till close sheet' },
      { href: '/report-sales-rep.html', label: 'Sales Representative Report', hint: 'Sell details document' },
      { href: '/sell-payments.html', label: 'Sell Payment Report', hint: 'Same sell sheet' },
    ],
  },
  {
    key: 'finance',
    label: 'Finance Reports',
    items: [
      { href: '/report-profit-loss.html', label: 'Profit / Loss Report', hint: 'P&L for the period' },
      { href: '/accounting-reports.html?r=tb', label: 'Trial Balance', hint: 'In Accounting' },
      { href: '/accounting-reports.html?r=bs', label: 'Balance Sheet', hint: 'In Accounting' },
      { href: '/accounting-reports.html?r=cf', label: 'Cash Flow', hint: 'In Accounting' },
      { href: '/report-tax.html', label: 'Tax Report', hint: 'GRA VAT summary' },
      { href: '/reports.html?t=age', label: 'Payment by Age', hint: 'Contact sheet' },
      { href: '/report-expense.html', label: 'Expense Report', hint: 'Expense sheet' },
    ],
  },
  {
    key: 'collections',
    label: 'Collections Reports',
    items: [
      { href: '/reports.html?t=col-age', label: 'Ageing & queues', hint: 'Queue totals' },
      { href: '/reports.html?t=col-ptp', label: 'Promise to pay', hint: 'PTP totals' },
      { href: '/reports.html?t=col-diary', label: 'Call diary', hint: 'Call totals' },
      { href: '/reports.html?t=col-reg', label: 'Regular payers', hint: 'On-schedule totals' },
      { href: '/reports.html?t=col-ex', label: 'Exceptions', hint: 'Hold totals' },
      { href: '/reports.html?t=col-pay', label: 'Hire purchase collections', hint: 'Partner transfer totals' },
    ],
  },
  {
    key: 'system',
    label: 'System Reports',
    items: [
      { href: '/reports.html?t=activity', label: 'Activity Log', hint: 'Who changed what' },
      { href: '/reports.html?t=z', label: 'Z Report', hint: 'Sales in hand' },
      { href: '/report-contacts.html', label: 'Customers & Suppliers', hint: 'Contact sheet' },
      { href: '/customer-groups-report.html', label: 'Customer Groups Report', hint: 'Contact sheet' },
    ],
  },
];

function paintIndex(app) {
  app.innerHTML = `
    <div class="ult-chrome"><h1>Reports <span>Read-only documents. Working lists live under Purchases, Sales, Operations and Records.</span></h1></div>
    ${toolbar({ print: false })}
    <nav class="rpt-subtabs">${REPORT_GROUPS.map((g) =>
      `<a href="#rpt-g-${g.key}">${esc(g.label)}</a>`).join('')}</nav>
    <div class="rpt-groups">${REPORT_GROUPS.map((g) => `
      <section class="rpt-group" id="rpt-g-${g.key}">
        <h2>${esc(g.label)}</h2>
        <div class="rpt-index">${g.items.map((it) =>
          `<a class="rpt-card" href="${esc(it.href)}"><strong>${esc(it.label)}</strong><span>${esc(it.hint)}</span></a>`).join('')}</div>
      </section>`).join('')}</div>`;
  bindChrome(app);
}

function colTabs(on) {
  const tabs = [
    { key: 'col-age', label: 'Ageing & queues' },
    { key: 'col-ptp', label: 'Promise to pay' },
    { key: 'col-diary', label: 'Call diary' },
    { key: 'col-reg', label: 'Regular payers' },
    { key: 'col-ex', label: 'Exceptions' },
    { key: 'col-pay', label: 'Hire purchase collections' },
  ];
  return `<nav class="rpt-subtabs">${tabs.map((t) =>
    `<a href="/reports.html?t=${t.key}" class="${on === t.key ? 'on' : ''}">${esc(t.label)}</a>`).join('')}</nav>`;
}

function colAccounts() { return readLs('df_collection_accounts', []) || []; }
function colCalls() { return readLs('df_collection_calls', []) || []; }

function ageingBuckets(accounts) {
  const o = { '0-30': 0, '31-60': 0, '61-90': 0, '90+': 0, none: 0 };
  const now = Date.now();
  accounts.forEach((a) => {
    const d = a.next_follow_up || a.last_at;
    if (!d) { o.none += 1; return; }
    const days = Math.max(0, Math.floor((now - new Date(d).getTime()) / 86400000));
    if (days <= 30) o['0-30'] += 1;
    else if (days <= 60) o['31-60'] += 1;
    else if (days <= 90) o['61-90'] += 1;
    else o['90+'] += 1;
  });
  return o;
}

async function readyCollections(app, title) {
  app.innerHTML = `<div class="ult-chrome"><h1>${esc(title)}</h1></div>
    ${colTabs(CODE)}<p class="ult-muted">Loading the Easybuy collections book…</p>`;
  try { await ensureCollections(); } catch { /* local book */ }
}

function tally(list, keyFn) {
  const m = new Map();
  list.forEach((row) => {
    const k = keyFn(row) || '—';
    m.set(k, (m.get(k) || 0) + 1);
  });
  return [...m.entries()].sort((a, b) => b[1] - a[1]);
}

async function paintColAge(app) {
  await readyCollections(app, 'Ageing & queues');
  const accounts = colAccounts();
  const counts = queueCounts();
  const grades = gradeCounts();
  const age = ageingBuckets(accounts);
  mountOfficial(app, {
    title: 'Ageing & queues',
    category: 'Collections Reports',
    status: `${accounts.length} accounts`,
    statusTone: (age['90+'] || 0) > 0 ? 'red' : 'green',
    filtersHtml: colTabs('col-age') + toolbar(),
    kpis: [
      { label: 'Accounts', value: String(accounts.length), tone: 'slate' },
      { label: '0–30 days', value: String(age['0-30']), tone: 'green' },
      { label: '31–90 days', value: String((age['31-60'] || 0) + (age['61-90'] || 0)), tone: 'amber' },
      { label: '90+ days', value: String(age['90+']), tone: 'red' },
    ],
    extraHtml: `<div class="rpt-pl-grid">
      <section class="rpt-card">
        <div class="rpt-card-h">Queues</div>
        ${QUEUES.map((q) => `<div class="rpt-kv"><span>${esc(q.label)}</span><b>${counts[q.key] || 0}</b></div>`).join('')}
      </section>
      <section class="rpt-card">
        <div class="rpt-card-h">Credit grade</div>
        ${['A', 'B', 'C', 'D', 'E'].map((g) =>
          `<div class="rpt-kv"><span>${gradeBadge(g)}</span><b>${grades[g] || 0}</b></div>`).join('')}
      </section>
    </div>
    <p class="df-rpt-listlink" style="padding:0 4px">Account files stay on the <a href="/collections.html">Collections desk</a>.</p>`,
    notes: 'Easybuy / BNPL collection book totals — not the desk.',
  });
}

async function paintColPtp(app) {
  await readyCollections(app, 'Promise to pay');
  const ptps = listPtps('all') || [];
  const byStatus = tally(ptps, (p) => String(p.status || 'open').toLowerCase());
  const dueSoon = ptps.filter((p) => {
    const d = String(p.due_on || '').slice(0, 10);
    if (!d) return false;
    const days = (new Date(d).getTime() - Date.now()) / 86400000;
    return days >= 0 && days <= 7;
  }).length;
  const overdue = ptps.filter((p) => {
    const d = String(p.due_on || '').slice(0, 10);
    return d && new Date(d).getTime() < Date.now() && !/kept|paid|done/i.test(p.status || '');
  }).length;
  const amount = ptps.reduce((s, p) => s + Number(p.amount || 0), 0);
  mountOfficial(app, {
    title: 'Promise to pay',
    category: 'Collections Reports',
    status: overdue ? `${overdue} overdue` : 'On track',
    statusTone: overdue ? 'red' : 'green',
    filtersHtml: colTabs('col-ptp') + toolbar(),
    kpis: [
      { label: 'Promises', value: String(ptps.length), tone: 'slate' },
      { label: 'Due in 7 days', value: String(dueSoon), tone: 'amber' },
      { label: 'Overdue', value: String(overdue), tone: 'red' },
      { label: 'Promised value', value: colMoney(amount), tone: 'blue' },
    ],
    extraHtml: `<section class="rpt-card">
      ${byStatus.map(([k, n]) => `<div class="rpt-kv"><span>${esc(k)}</span><b>${n}</b></div>`).join('') || '<p class="ult-muted">No promises yet.</p>'}
    </section>
    <p class="df-rpt-listlink" style="padding:0 4px">PTP files stay on the <a href="/collections.html">Collections desk</a>.</p>`,
    notes: 'Summary — not the collections desk.',
  });
}

async function paintColDiary(app) {
  await readyCollections(app, 'Call diary');
  const hist = colCalls();
  const byOut = tally(hist, (c) => String(c.outcome || 'attempt').toLowerCase());
  const people = new Set(hist.map((c) => String(c.phone || c.name || ''))).size;
  const week = hist.filter((c) => {
    const d = String(c.called_on || c.at || '').slice(0, 10);
    if (!/^\d{4}-\d{2}-\d{2}$/.test(d)) return false;
    return (Date.now() - new Date(d).getTime()) / 86400000 <= 7;
  }).length;
  mountOfficial(app, {
    title: 'Call diary',
    category: 'Collections Reports',
    status: `${hist.length} calls`,
    statusTone: 'blue',
    filtersHtml: colTabs('col-diary') + toolbar(),
    kpis: [
      { label: 'Calls logged', value: String(hist.length), tone: 'blue' },
      { label: 'Customers reached', value: String(people), tone: 'green' },
      { label: 'Last 7 days', value: String(week), tone: 'amber' },
      { label: 'Outcomes', value: String(byOut.length), tone: 'slate' },
    ],
    extraHtml: `<section class="rpt-card">
      ${byOut.map(([k, n]) => `<div class="rpt-kv"><span>${esc(k)}</span><b>${n}</b></div>`).join('') || '<p class="ult-muted">No calls yet.</p>'}
    </section>
    <p class="df-rpt-listlink" style="padding:0 4px">The call log stays on the <a href="/collections.html">Collections desk</a>.</p>`,
    notes: 'Volume summary — not the call log.',
  });
}

async function paintColReg(app) {
  await readyCollections(app, 'Regular payers');
  const all = colAccounts();
  const rows = all.filter((a) => a.regular);
  const byStatus = tally(rows, (a) => String(a.status || 'open').toLowerCase());
  const completed = rows.filter((a) => /complete|done|paid/i.test(a.status || '') || /complete/i.test(a.last_follow || '')).length;
  mountOfficial(app, {
    title: 'Regular payers',
    category: 'Collections Reports',
    status: all.length ? Math.round((rows.length / all.length) * 100) + '% of book' : 'Empty',
    statusTone: 'green',
    filtersHtml: colTabs('col-reg') + toolbar(),
    kpis: [
      { label: 'Regular payers', value: String(rows.length), tone: 'green' },
      { label: 'Share of accounts', value: all.length ? Math.round((rows.length / all.length) * 100) + '%' : '—', tone: 'blue' },
      { label: 'Completed', value: String(completed), tone: 'teal' },
      { label: 'Accounts', value: String(all.length), tone: 'slate' },
    ],
    extraHtml: `<section class="rpt-card">
      ${byStatus.map(([k, n]) => `<div class="rpt-kv"><span>${esc(k)}</span><b>${n}</b></div>`).join('') || '<p class="ult-muted">No regular payers flagged.</p>'}
    </section>
    <p class="df-rpt-listlink" style="padding:0 4px">Account files stay on the <a href="/collections.html">Collections desk</a>.</p>`,
    notes: 'Schedule summary — not the account list.',
  });
}

async function paintColEx(app) {
  await readyCollections(app, 'Exceptions');
  const all = colAccounts();
  const rows = all.filter((a) => a.exception || (a.flags || []).length);
  const byFlag = tally(rows.flatMap((a) => (a.flags || []).length ? a.flags : ['exception']), (f) => String(f).toLowerCase());
  const hold = rows.filter((a) => /hold/i.test(a.status || '') || /hold/i.test(a.last_follow || '')).length;
  mountOfficial(app, {
    title: 'Exceptions',
    category: 'Collections Reports',
    status: hold ? `${hold} on hold` : 'Clear',
    statusTone: hold ? 'amber' : 'green',
    filtersHtml: colTabs('col-ex') + toolbar(),
    kpis: [
      { label: 'Exception accounts', value: String(rows.length), tone: 'amber' },
      { label: 'On hold', value: String(hold), tone: 'red' },
      { label: 'Share of book', value: all.length ? Math.round((rows.length / all.length) * 100) + '%' : '—', tone: 'slate' },
      { label: 'Accounts', value: String(all.length), tone: 'blue' },
    ],
    extraHtml: `<section class="rpt-card">
      ${byFlag.map(([k, n]) => `<div class="rpt-kv"><span>${esc(k)}</span><b>${n}</b></div>`).join('') || '<p class="ult-muted">No exceptions.</p>'}
    </section>
    <p class="df-rpt-listlink" style="padding:0 4px">Case files stay on the <a href="/collections.html">Collections desk</a>.</p>`,
    notes: 'Case totals — not the case file.',
  });
}

async function paintColPay(app) {
  app.innerHTML = `<div class="ult-chrome"><h1>Hire purchase collections</h1></div>
    ${colTabs('col-pay')}<p class="ult-muted">Loading ACM payment record…</p>`;
  const pays = await loadPayments().catch(() => []);
  const m = paymentMetrics(pays);
  mountOfficial(app, {
    title: 'Hire purchase collections',
    category: 'Collections Reports',
    status: `${m.n || 0} settlements`,
    statusTone: 'green',
    filtersHtml: colTabs('col-pay') + toolbar(),
    kpis: [
      { label: 'Settlements', value: String(m.n || 0), tone: 'slate' },
      { label: 'Transferred', value: money(m.xfer), tone: 'green' },
      { label: 'Customer deposits', value: money(m.down), tone: 'blue' },
      { label: 'Loan book', value: money(m.loan), tone: 'amber' },
    ],
    extraHtml: `<p class="df-rpt-listlink" style="padding:0 4px">The payment register stays under <a href="/field-ops.html">Field operations</a>.</p>`,
    notes: 'Partner transfer summary — not the payment register.',
  });
}

const PAINT = {
  'profit-loss': paintPL,
  z: paintZ,
  'purchase-sell': paintPS,
  tax: paintTax,
  contacts: paintContacts,
  groups: paintGroups,
  activity: paintActivity,
  contact: paintContact,
  adj: paintAdj,
  items: paintItems,
  pp: paintPP,
  sell: paintSell,
  'sell-group': paintSellGroup,
  psp: paintPsp,
  ppay: paintPpay,
  spay: paintSpay,
  age: paintAge,
  stock: paintStock,
  expense: paintExpenseRpt,
  register: paintRegister,
  'sales-rep': paintSalesRep,
  index: paintIndex,
  'col-age': paintColAge,
  'col-ptp': paintColPtp,
  'col-diary': paintColDiary,
  'col-reg': paintColReg,
  'col-ex': paintColEx,
  'col-pay': paintColPay,
};

let CODE = 'index';
const FILE_CODE = {
  'reports.html': 'index',
  'report-profit-loss.html': 'profit-loss',
  'report-stock.html': 'stock',
  'report-purchase-sell.html': 'purchase-sell',
  'report-tax.html': 'tax',
  'report-contacts.html': 'contacts',
  'customer-groups-report.html': 'groups',
  'report-expense.html': 'expense',
  'report-register.html': 'register',
  'report-sales-rep.html': 'sales-rep',
  'sell-payments.html': 'spay',
  'pos-sales.html': 'sell',
  'trending-products.html': 'items',
};

function codeFromUrl(fallback) {
  const t = new URLSearchParams(location.search).get('t');
  if (t) return t;
  const file = (location.pathname.split('/').pop() || '').toLowerCase();
  return FILE_CODE[file] || fallback || 'index';
}

async function paint() {
  const app = document.getElementById('app');
  if (!app) return;
  await (PAINT[CODE] || paintIndex)(app);
  bindOverflowTabs(app);
}

export async function bootReportsHub(code = 'index') {
  CODE = code || codeFromUrl('index');
  await paint();
  if (document.documentElement.dataset.rptBoot === '1') return;
  document.documentElement.dataset.rptBoot = '1';
  const nav = () => {
    CODE = codeFromUrl(CODE);
    paint();
  };
  window.addEventListener('popstate', nav);
  window.addEventListener('df-tab', nav);
}

export async function bootContactView() {
  CODE = 'contact';
  await paint();
  window.addEventListener('popstate', () => { paint(); });
}
