/** Report helpers. Every figure comes from the live shared books. */
import { readLs } from './ls-rows.js';
import { liveSales, livePurchases, liveRows, BOOKS } from './live-share.js';
import { BUSINESS_LOCATIONS } from './scope.js';

function num(v) { return Number(v || 0) || 0; }
function ymd(v) {
  const s = String(v || '').slice(0, 10);
  return /^\d{4}-\d{2}-\d{2}$/.test(s) ? s : '';
}
function yearStart() { return `${new Date().getFullYear()}-01-01`; }
function today() { return new Date().toISOString().slice(0, 10); }

export function dateRange() {
  const q = new URLSearchParams(location.search);
  return {
    from: q.get('from') || yearStart(),
    to: q.get('to') || today(),
  };
}

export function inDateRange(iso, range = dateRange()) {
  const d = ymd(iso);
  if (!d) return true;
  if (range.from && d < range.from) return false;
  if (range.to && d > range.to) return false;
  return true;
}

export const DATE_RANGE = '';

export function locOptions() {
  return [
    { code: '', name: 'All locations' },
    ...BUSINESS_LOCATIONS.filter((l) => !l.alias && l.marketplace !== false && l.code !== 'OPS-HUB' && l.code !== 'BNPL-FSH')
      .map((l) => ({ code: l.code, name: l.name })),
  ];
}

export const LOCS = locOptions();
export const GROUPS = ['All', 'Retail', 'Wholesale', 'VIP', 'Walk-in'];

export function mix(n) { return num(n); }

function locOf(r) {
  return r?.location_code || r?.loc || r?.location || r?.business_location || r?.location_name || '';
}

export function locMatch(rowLoc, on) {
  const want = on == null ? (new URLSearchParams(location.search).get('loc') || '') : on;
  if (!want) return true;
  const name = locOptions().find((l) => l.code === want)?.name || want;
  const have = String(rowLoc || '');
  return have === want || have === name || have.toLowerCase() === String(name).toLowerCase();
}

export function allProducts() {
  const live = liveRows(BOOKS.products);
  if (live.length) return live;
  return readLs('df_fiberk_product_headers', []) || [];
}

function qtyOf(p) {
  return num(p.qty ?? p.stock ?? p.current_stock ?? p.current_stock_value ?? p.on_hand ?? 0);
}
function costOf(p) {
  return num(p.buy ?? p.purchase_price ?? p.unit_cost ?? p.cost ?? 0);
}
function sellOf(p) {
  return num(p.sell ?? p.sell_price ?? p.unit_price ?? p.price ?? 0);
}

const productBySku = () => {
  const m = new Map();
  allProducts().forEach((p) => {
    const sku = String(p.sku || p.id || '');
    if (sku) m.set(sku, p);
    if (p.id) m.set(String(p.id), p);
  });
  return m;
};

function saleLines(sale) {
  const lines = sale.lines || sale.items || sale.product_lines || [];
  if (lines.length) return lines.map((l) => ({
    sku: l.sku || l.product_sku || '',
    name: l.name || l.product_name || l.product || '',
    qty: num(l.qty || l.quantity || l.sell_qty || 1),
    price: num(l.unit_price || l.price_inc_tax || l.sell || l.price || 0),
    cost: num(l.unit_cost || l.buy || l.purchase_price || 0),
    variation: l.variation || l.color || l.size || '',
    category: l.category || '',
  }));
  return [{
    sku: sale.sku || sale.product_sku || '',
    name: sale.product_name || sale.product || sale.name || 'Sale',
    qty: num(sale.qty || sale.total_items || 1),
    price: num(sale.total_amount || sale.price || 0),
    cost: num(sale.unit_cost || 0),
    variation: '',
    category: sale.category || '',
  }];
}

function purchLines(p) {
  const lines = p.lines || p.items || [];
  if (lines.length) return lines.map((l) => ({
    sku: l.sku || '',
    name: l.name || l.product_name || '',
    qty: num(l.qty || l.quantity || 1),
    cost: num(l.unit_cost || l.unit_price || l.buy || 0),
    supplier: p.supplier_name || p.supplier || l.supplier || '',
    ref: p.reference || p.invoice_no || p.ref || '',
    date: ymd(p.transaction_date || p.purchase_date || p.date || p.created_at),
    loc: locOf(p),
    lot: l.lot || l.lot_number || '',
  }));
  return [{
    sku: p.sku || '',
    name: p.product_name || p.name || 'Purchase',
    qty: num(p.qty || p.total_items || 1),
    cost: num(p.grand_total || p.total_amount || 0),
    supplier: p.supplier_name || p.supplier || '',
    ref: p.reference || p.invoice_no || p.ref || '',
    date: ymd(p.transaction_date || p.purchase_date || p.date || p.created_at),
    loc: locOf(p),
    lot: '',
  }];
}

export function plLines(loc = '') {
  const range = dateRange();
  let payroll = 0;
  try {
    const rows = JSON.parse(localStorage.getItem('df_hrm_payroll') || '[]');
    payroll = (Array.isArray(rows) ? rows : [])
      .filter((p) => String(p.status || '').toLowerCase() === 'paid')
      .filter((p) => !loc || p.location_code === loc)
      .filter((p) => inDateRange(p.paid_on || p.period_end || p.date, range))
      .reduce((s, p) => s + num(p.net_pay || p.total), 0);
  } catch { payroll = 0; }

  const inLoc = (r) => locMatch(locOf(r), loc);
  const sales = liveSales().filter(inLoc).filter((r) => inDateRange(r.order_date || r.transaction_date || r.date || r.created_at, range));
  const purch = livePurchases().filter(inLoc).filter((r) => inDateRange(r.transaction_date || r.purchase_date || r.date || r.created_at, range));
  const exp = liveRows(BOOKS.expenses).filter(inLoc).filter((r) => inDateRange(r.expense_date || r.date || r.created_at, range));
  const rets = (readLs('df_sell_returns', []) || []).filter(inLoc).filter((r) => inDateRange(r.date || r.created_at, range));
  const purchRets = (readLs('df_purchase_returns', []) || []).filter(inLoc).filter((r) => inDateRange(r.date || r.created_at, range));
  const adjs = (readLs('df_stock_adjustments', []) || []).filter(inLoc).filter((r) => inDateRange(r.date || r.created_at, range));

  const totalSales = sales.reduce((s, r) => s + num(r.total_amount || r.price), 0);
  const totalPurchase = purch.reduce((s, r) => s + num(r.grand_total || r.total_amount), 0);
  const expense = exp.reduce((s, r) => s + num(r.amount || r.total || r.total_amount), 0);
  const sellReturn = rets.reduce((s, r) => s + num(r.total_amount || r.amount), 0);
  const purchaseReturn = purchRets.reduce((s, r) => s + num(r.total_amount || r.amount), 0);
  const sellDiscount = sales.reduce((s, r) => s + num(r.discount_amount || r.discount), 0);
  const purchaseDiscount = purch.reduce((s, r) => s + num(r.discount_amount || r.discount), 0);
  const sellShipping = sales.reduce((s, r) => s + num(r.shipping_charges || r.shipping), 0);
  const purchaseShipping = purch.reduce((s, r) => s + num(r.shipping_charges || r.shipping), 0);
  const stockAdj = adjs.reduce((s, r) => s + num(r.total_amount || r.amount), 0);

  const products = allProducts().filter((p) => locMatch(locOf(p), loc));
  const closingPurchase = products.reduce((s, p) => s + qtyOf(p) * costOf(p), 0);
  const closingSale = products.reduce((s, p) => s + qtyOf(p) * sellOf(p), 0);

  const book = productBySku();
  const soldCost = sales.reduce((s, r) => s + saleLines(r).reduce((x, l) => {
    const p = book.get(String(l.sku)) || {};
    return x + l.qty * (l.cost || costOf(p));
  }, 0), 0);

  const openingPurchase = Math.max(0, closingPurchase - totalPurchase + soldCost);
  const openingSale = Math.max(0, closingSale - totalSales + sellReturn);
  const cogs = openingPurchase + totalPurchase - closingPurchase;
  const gross = totalSales - cogs;
  const net = gross + sellShipping - stockAdj - expense - purchaseShipping - sellDiscount - payroll;

  return {
    openingPurchase, openingSale, totalPurchase, stockAdj, expense, purchaseShipping,
    purchaseAdd: 0, transferShipping: 0, sellDiscount, reward: 0, sellReturn, payroll, production: 0,
    closingPurchase, closingSale, totalSales, sellShipping, sellAdd: 0, stockRecovered: 0,
    purchaseReturn, purchaseDiscount, roundOff: 0, sellReturnDiscount: 0, hms: 0, projectInv: 0,
    cogs, gross, net,
    taxSales: sales.reduce((s, r) => s + num(r.tax_amount || r.tax), 0),
    taxPurch: purch.reduce((s, r) => s + num(r.tax_amount || r.tax), 0),
    taxNet: 0,
    grossPct: totalSales ? (gross / totalSales) * 100 : 0,
    netPct: totalSales ? (net / totalSales) * 100 : 0,
  };
}

export function stockRows(loc = '') {
  const range = dateRange();
  const book = productBySku();
  const sold = new Map();
  const xfer = new Map();
  const adj = new Map();
  liveSales().filter((r) => locMatch(locOf(r), loc)).filter((r) => inDateRange(r.order_date || r.date || r.created_at, range))
    .forEach((r) => saleLines(r).forEach((l) => {
      const k = String(l.sku || l.name);
      sold.set(k, (sold.get(k) || 0) + l.qty);
    }));
  (readLs('df_stock_transfers', []) || []).filter((r) => locMatch(locOf(r), loc)).forEach((r) => {
    (r.lines || [{ sku: r.sku, qty: r.qty }]).forEach((l) => {
      const k = String(l.sku || '');
      xfer.set(k, (xfer.get(k) || 0) + num(l.qty));
    });
  });
  (readLs('df_stock_adjustments', []) || []).filter((r) => locMatch(locOf(r), loc)).forEach((r) => {
    (r.lines || [{ sku: r.sku, qty: r.qty }]).forEach((l) => {
      const k = String(l.sku || '');
      adj.set(k, (adj.get(k) || 0) + num(l.qty));
    });
  });
  return allProducts().filter((p) => locMatch(locOf(p), loc)).map((p) => {
    const sku = String(p.sku || p.id || '');
    const qty = qtyOf(p);
    const cost = costOf(p);
    const sell = sellOf(p);
    const soldQty = sold.get(sku) || sold.get(String(p.id)) || 0;
    const valBuy = qty * cost;
    const valSell = qty * sell;
    return {
      id: p.id || sku,
      sku,
      name: p.name || '',
      variation: p.variation || p.color || p.size || '',
      category: p.category || p.legacy_cat || '',
      loc: locOf(p) || p.location_name || '',
      sell,
      qty,
      valBuy,
      valSell,
      profit: valSell - valBuy,
      sold: soldQty,
      xfer: xfer.get(sku) || 0,
      adj: adj.get(sku) || 0,
      supplier: p.supplier_name || p.supplier || '',
      jumia: p.jumia || p.channel === 'jumia' ? 'Yes' : '',
    };
  });
}

export function itemRows(loc = '') {
  const range = dateRange();
  const book = productBySku();
  const lastBuy = new Map();
  livePurchases().filter((r) => locMatch(locOf(r), loc)).forEach((r) => {
    purchLines(r).forEach((l) => {
      if (!l.sku) return;
      const prev = lastBuy.get(l.sku);
      if (!prev || String(l.date) >= String(prev.date)) lastBuy.set(l.sku, l);
    });
  });
  const rows = [];
  liveSales().filter((r) => locMatch(locOf(r), loc)).filter((r) => inDateRange(r.order_date || r.date || r.created_at, range))
    .forEach((r) => {
      saleLines(r).forEach((l) => {
        const p = book.get(String(l.sku)) || book.get(String(l.name)) || {};
        const buy = lastBuy.get(String(l.sku)) || {};
        const price = l.price || sellOf(p);
        rows.push({
          name: l.name || p.name || '',
          sku: l.sku || p.sku || '',
          description: p.copy || p.description || '',
          purchaseDate: buy.date || '',
          purchaseRef: buy.ref || (buy.date ? 'Opening Stock' : ''),
          lot: buy.lot || '',
          supplier: buy.supplier || p.supplier_name || '',
          purchasePrice: buy.cost || costOf(p),
          sellDate: ymd(r.order_date || r.transaction_date || r.date || r.created_at),
          saleNo: r.invoice_no || r.reference || r.id || '',
          customer: r.customer_name || r.customer || 'Walk-In Customer',
          loc: locOf(r) || locOf(p),
          qty: l.qty,
          sell: price,
          subtotal: l.qty * price,
        });
      });
    });
  return rows.sort((a, b) => String(a.name).localeCompare(String(b.name)) || String(b.sellDate).localeCompare(String(a.sellDate)));
}

export function activityRows() {
  let rows = [];
  try { rows = JSON.parse(localStorage.getItem('df_activity_logs') || '[]'); } catch { rows = []; }
  if (!Array.isArray(rows) || !rows.length) {
    try { rows = JSON.parse(localStorage.getItem('df_audit_logs') || '[]'); } catch { rows = []; }
  }
  if (!Array.isArray(rows)) rows = [];
  const range = dateRange();
  const user = new URLSearchParams(location.search).get('user') || '';
  const type = new URLSearchParams(location.search).get('stype') || '';
  return rows.filter((r) => inDateRange(r.at || r.created_at || r.date, range))
    .filter((r) => !/staff_alert|till_discrepancy|TILL_DISCREPANCY|attendance_unverified/i.test(String(r.action || r.entity_type || '')))
    .filter((r) => !user || String(r.by || r.user || r.user_email || r.actor_email || '') === user)
    .filter((r) => !type || String(r.type || r.subject_type || r.entity_type || '') === type)
    .map((r) => ({
      date: r.at || r.created_at || r.date || '',
      type: r.type || r.subject_type || r.entity_type || 'Staff',
      action: r.action || r.event || r.verb || '',
      by: r.by || r.user || r.user_email || r.actor_email || r.staff || '',
      note: r.note || r.details || r.message || r.summary || '',
      invoice: r.invoice || r.ref || '',
      status: r.status || '',
      total: r.total || 0,
      pay: r.payment_status || r.pay || '',
    }))
    .sort((a, b) => String(b.date).localeCompare(String(a.date)));
}

export function activityUsers() {
  return [...new Set(activityRows().map((r) => r.by).filter(Boolean))];
}
export function activityTypes() {
  return [...new Set(activityRows().map((r) => r.type).filter(Boolean))];
}

export function purchaseProductRows(loc = '') {
  const range = dateRange();
  const rows = [];
  livePurchases().filter((r) => locMatch(locOf(r), loc)).filter((r) => inDateRange(r.transaction_date || r.date || r.created_at, range))
    .forEach((r) => purchLines(r).forEach((l) => rows.push(l)));
  return rows;
}

export function sellProductRows(loc = '') {
  const range = dateRange();
  const rows = [];
  liveSales().filter((r) => locMatch(locOf(r), loc)).filter((r) => inDateRange(r.order_date || r.date || r.created_at, range))
    .forEach((r) => saleLines(r).forEach((l) => rows.push({
      ...l,
      date: ymd(r.order_date || r.date || r.created_at),
      customer: r.customer_name || r.customer || 'Walk-In Customer',
      staff: r.staff || r.cashier || r.created_by || '',
      loc: locOf(r),
      amount: l.qty * l.price,
    })));
  return rows;
}

export function adjustmentRows(loc = '') {
  const range = dateRange();
  return (readLs('df_stock_adjustments', []) || []).filter((r) => locMatch(locOf(r), loc))
    .filter((r) => inDateRange(r.date || r.created_at, range))
    .flatMap((r) => (r.lines || [{ sku: r.sku, name: r.product_name || r.name, qty: r.qty, type: r.type }]).map((l) => ({
      date: ymd(r.date || r.created_at),
      ref: r.reference || r.ref || r.id || '',
      sku: l.sku || '',
      name: l.name || l.product_name || '',
      loc: locOf(r),
      type: l.type || r.type || r.adjustment_type || '',
      qty: num(l.qty),
      reason: r.reason || l.reason || '',
    })));
}

export function expenseRows(loc = '') {
  const range = dateRange();
  return liveRows(BOOKS.expenses).filter((r) => locMatch(locOf(r), loc))
    .filter((r) => inDateRange(r.expense_date || r.date || r.created_at, range))
    .map((r) => ({
      date: ymd(r.expense_date || r.date || r.created_at),
      ref: r.reference_no || r.ref || r.id || '',
      cat: r.category || r.category_name || '',
      to: r.payment_to || r.vendor || '',
      loc: locOf(r),
      method: r.payment_method || r.method || '',
      amount: num(r.total_amount || r.amount),
    }));
}

export function purchasePayRows(loc = '') {
  const range = dateRange();
  const pays = readLs('df_purchase_payments', []) || [];
  const fromPurch = livePurchases().flatMap((r) => (r.payments || []).map((p) => ({
    date: ymd(p.paid_on || p.date || r.transaction_date),
    ref: r.reference || r.id,
    supplier: r.supplier_name || r.supplier || '',
    loc: locOf(r),
    method: p.method || p.payment_method || '',
    amount: num(p.amount),
  })));
  return [...pays.map((p) => ({
    date: ymd(p.paid_on || p.date),
    ref: p.reference || p.purchase_id || p.id,
    supplier: p.supplier_name || p.supplier || '',
    loc: locOf(p),
    method: p.method || p.payment_method || '',
    amount: num(p.amount),
  })), ...fromPurch]
    .filter((r) => locMatch(r.loc, loc) && inDateRange(r.date, range) && r.amount);
}

export function sellPayRows(loc = '') {
  const range = dateRange();
  const pays = readLs('df_sell_payments', []) || [];
  const fromSales = liveSales().flatMap((r) => (r.payments || [{
    paid_on: r.order_date || r.date,
    method: r.payment_method || r.method,
    amount: r.amount_paid || r.total_amount,
  }]).map((p) => ({
    date: ymd(p.paid_on || p.date),
    invoice: r.invoice_no || r.reference || r.id,
    customer: r.customer_name || r.customer || '',
    loc: locOf(r),
    method: p.method || p.payment_method || r.payment_method || '',
    amount: num(p.amount),
  })));
  return [...pays.map((p) => ({
    date: ymd(p.paid_on || p.date),
    invoice: p.invoice_no || p.sale_id || p.id,
    customer: p.customer_name || '',
    loc: locOf(p),
    method: p.method || '',
    amount: num(p.amount),
  })), ...fromSales]
    .filter((r) => locMatch(r.loc, loc) && inDateRange(r.date, range) && r.amount);
}

export function registerRows(loc = '') {
  const range = dateRange();
  return (readLs('df_pos_sessions', []) || readLs('df_registers', []) || [])
    .filter((r) => locMatch(locOf(r), loc) && inDateRange(r.opened_at || r.date, range))
    .map((r) => ({
      date: ymd(r.opened_at || r.date),
      till: r.till || r.register || r.name || '',
      loc: locOf(r),
      cashier: r.cashier || r.user || r.opened_by || '',
      open: num(r.opening_cash || r.open),
      sales: num(r.sales_total || r.sales),
      cash: num(r.cash || r.cash_sales),
      momo: num(r.momo || r.mobile_money),
      card: num(r.card || r.card_sales),
      close: num(r.closing_cash || r.close),
    }));
}

export function salesRepRows(loc = '') {
  const range = dateRange();
  const map = new Map();
  liveSales().filter((r) => locMatch(locOf(r), loc) && inDateRange(r.order_date || r.date, range)).forEach((r) => {
    const staff = r.staff || r.cashier || r.commission_agent || r.created_by || '—';
    const cur = map.get(staff) || { staff, loc: locOf(r), invoices: 0, sales: 0, returns: 0, commission: num(r.commission_pct) };
    cur.invoices += 1;
    cur.sales += num(r.total_amount || r.price);
    map.set(staff, cur);
  });
  return [...map.values()];
}

export function ageingRows() {
  const sales = liveSales();
  const map = new Map();
  const todayS = today();
  sales.forEach((r) => {
    const due = num(r.payment_due || r.balance || (num(r.total_amount) - num(r.amount_paid)));
    if (due <= 0) return;
    const party = r.customer_name || r.customer || 'Customer';
    const cur = map.get(party) || { party, kind: 'Customer', current: 0, d30: 0, d60: 0, d90: 0, older: 0 };
    const days = Math.max(0, Math.floor((Date.parse(todayS) - Date.parse(ymd(r.order_date || r.date) || todayS)) / 86400000));
    if (days <= 0) cur.current += due;
    else if (days <= 30) cur.d30 += due;
    else if (days <= 60) cur.d60 += due;
    else if (days <= 90) cur.d90 += due;
    else cur.older += due;
    map.set(party, cur);
  });
  livePurchases().forEach((r) => {
    const due = num(r.payment_due || r.balance);
    if (due <= 0) return;
    const party = r.supplier_name || r.supplier || 'Supplier';
    const cur = map.get(party) || { party, kind: 'Supplier', current: 0, d30: 0, d60: 0, d90: 0, older: 0 };
    cur.kind = 'Supplier';
    const days = Math.max(0, Math.floor((Date.parse(todayS) - Date.parse(ymd(r.transaction_date || r.date) || todayS)) / 86400000));
    if (days <= 0) cur.current += due;
    else if (days <= 30) cur.d30 += due;
    else if (days <= 60) cur.d60 += due;
    else if (days <= 90) cur.d90 += due;
    else cur.older += due;
    map.set(party, cur);
  });
  return [...map.values()];
}

/* Legacy names some paints still import — live, not canned. */
export const PRODUCTS = [];
export const CONTACTS = [];
export function contactById() { return null; }
export const LEDGER = {};
export const TAX_IN = [];
export const TAX_OUT = [];
export const TAX_EXP = [];
export const TAX_PI = [];
export const ACTIVITY = [];
export const ADJUSTMENTS = [];
export const EXPENSES = [];
export const REGISTERS = [];
export const PURCHASE_PAYS = [];
export const SELL_PAYS = [];
export const AGEING = [];
export const REPS = [];
