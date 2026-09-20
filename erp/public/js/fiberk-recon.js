/** Fiberkapp books vs journals vs HP reimbursement vs catalog. No new tables. */
import { readLs, esc } from './ls-rows.js';
import { KEYS as ACC } from './accounting.js';
import { fiberkPos, purchaseBookMetrics, ensurePurchaseFlow } from './fiberk-purchases.js';
import { fiberkSales, fiberkSalesFull, fiberkSalesJournals, salesBookMetrics, ensureSalesFlow, salesPosted } from './fiberk-sales.js';
import { fiberkTransfers, fiberkStockMetrics, ensureFiberkStock } from './fiberk-stock.js';
import { fiberkProducts, fiberkProductMetrics, ensureFiberkProducts } from './fiberk-products.js';
import { loadPayments, paymentMetrics, SA_COMMISSION } from './bnpl-field-payments.js';
import { ensureBankBooks, reconOverview, categorySummary } from './bank-ledger.js';
import { migStamp, siloHref } from './fiberk-silo.js';

export function cedi(n) {
  return 'GH₵ ' + Number(n || 0).toLocaleString('en-GH', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

export function isEasyBuy(row) {
  const loc = String(row?.legacy_location || row?.location_name || row?.location_code || '');
  return /EASYBUY|EASY BUY/i.test(loc);
}

function last9(p) {
  return String(p || '').replace(/\D/g, '').slice(-9);
}

function num(v) {
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
}

function skuOf(ln) {
  return String(ln?.sku || ln?.product_sku || '').toUpperCase().trim();
}

function imeiOf(sale) {
  const blob = (sale.lines || []).map((l) => l.name || '').join(' ') + ' ' + (sale.notes || sale.sale_note || '');
  const m = blob.match(/\b(\d{15})\b/);
  return m ? m[1] : '';
}

function inRange(iso, from, to) {
  const d = String(iso || '').slice(0, 10);
  if (!d) return true;
  if (from && d < from) return false;
  if (to && d > to) return false;
  return true;
}

export function lightRecon() {
  const pos = fiberkPos();
  const sales = fiberkSales();
  const retail = sales.filter((s) => !isEasyBuy(s));
  const easy = sales.filter(isEasyBuy);
  const hpRows = readLs('df_bnpl_field_payments', []) || [];
  const hpM = hpRows.length ? paymentMetrics(hpRows) : { n: 0, xfer: 0, down: 0, commission: 0, settled: 0 };
  return {
    purchases: {
      n: pos.length,
      grand: pos.reduce((s, p) => s + num(p.grand_total), 0),
      due: pos.reduce((s, p) => s + num(p.payment_due), 0),
    },
    sales: {
      n: sales.length,
      retail_n: retail.length,
      retail_amt: retail.reduce((s, r) => s + num(r.total_amount || r.grand_total), 0),
      retail_due: retail.reduce((s, r) => s + num(r.payment_due), 0),
      easy_n: easy.length,
      easy_amt: easy.reduce((s, r) => s + num(r.total_amount || r.grand_total), 0),
    },
    hp: hpM,
  };
}

export async function hydrateRecon() {
  const { ensureDemoBooks } = await import('./accounting.js');
  await ensureDemoBooks();
  await ensurePurchaseFlow().catch(() => null);
  await ensureSalesFlow().catch(() => null);
  await Promise.all([
    ensureFiberkStock().catch(() => null),
    ensureFiberkProducts().catch(() => null),
    ensureBankBooks().catch(() => null),
    loadPayments().catch(() => []),
  ]);
}

export async function buildRecon(range = {}) {
  await hydrateRecon();
  const from = range.from || '2025-01-01';
  const to = range.to || `${new Date().getFullYear()}-12-31`;

  const pos = fiberkPos().filter((p) => inRange(p.date || p.order_date, from, to));
  const sales = fiberkSalesFull().filter((s) => inRange(s.order_date || s.created_at, from, to));
  const retail = sales.filter((s) => !isEasyBuy(s));
  const easy = sales.filter(isEasyBuy);
  const hpAll = await loadPayments();
  const hp = (hpAll || []).filter((p) => inRange(p.transfer_at || p.delivery_at, from, to));
  const hpM = paymentMetrics(hp);
  const poM = purchaseBookMetrics();
  const soM = salesBookMetrics();
  const stM = fiberkStockMetrics();
  const prM = fiberkProductMetrics();

  const jes = (readLs(ACC.journals, []) || []).filter((j) => j.source === 'fiberkapp' && inRange(j.journal_date, from, to));
  const saleJes = fiberkSalesJournals().filter((j) => inRange(j.journal_date, from, to));
  const pays = (readLs('df_purchase_payments', []) || []).filter((p) => p.source === 'fiberkapp' && inRange(p.date, from, to));

  const products = fiberkProducts();
  const prodSkus = new Set(products.map((p) => String(p.sku || '').toUpperCase()).filter(Boolean));
  const poSku = new Map();
  let poQty = 0;
  let poLines = 0;
  const poMissing = [];
  pos.forEach((po) => {
    (po.lines || []).forEach((ln) => {
      poLines += 1;
      const sku = skuOf(ln);
      const q = num(ln.qty || ln.quantity);
      poQty += q;
      if (!sku) return;
      const cur = poSku.get(sku) || { sku, name: ln.name, qty: 0, cost: 0, in_catalog: prodSkus.has(sku) };
      cur.qty += q;
      cur.cost += num(ln.line_total) || q * num(ln.unit_cost);
      poSku.set(sku, cur);
      if (!prodSkus.has(sku)) poMissing.push({ sku, name: ln.name, source: 'purchase', ref: po.reference });
    });
  });

  const soSku = new Map();
  let soQty = 0;
  let soLines = 0;
  let soNoSku = 0;
  const soMissing = [];
  sales.forEach((so) => {
    const lines = so.lines || so.items || [];
    if (!lines.length) {
      soLines += 1;
      soQty += num(so.total_items || 1);
      soNoSku += 1;
      return;
    }
    lines.forEach((ln) => {
      soLines += 1;
      const sku = skuOf(ln);
      const q = num(ln.qty || ln.quantity);
      soQty += q;
      if (!sku) {
        soNoSku += 1;
        return;
      }
      const cur = soSku.get(sku) || { sku, name: ln.name, qty: 0, amount: 0, in_catalog: prodSkus.has(sku) };
      cur.qty += q;
      cur.amount += num(ln.line_total);
      soSku.set(sku, cur);
      if (!prodSkus.has(sku)) soMissing.push({ sku, name: ln.name, source: 'sale', ref: so.invoice_no || so.reference });
    });
  });

  let xferQty = 0;
  fiberkTransfers().forEach((t) => {
    if (!inRange(t.transfer_date || t.date, from, to)) return;
    (t.lines || []).forEach((ln) => { xferQty += num(ln.qty || ln.quantity); });
  });

  const hpPhones = new Set(hp.map((p) => last9(p.phone)).filter((d) => d.length === 9));
  const hpImei = new Set(hp.map((p) => String(p.imei || '').replace(/\D/g, '')).filter((d) => d.length >= 14));
  const hpAmt = new Set(hp.map((p) => Math.round(num(p.transfer_amount) * 100)));
  let ebPhoneHit = 0;
  let ebImeiHit = 0;
  let ebAmtHit = 0;
  let ebMatched = 0;
  let ebMatchedAmt = 0;
  easy.forEach((so) => {
    const phone = last9(so.phone);
    const imei = imeiOf(so);
    const amt = Math.round(num(so.total_amount) * 100);
    const hitPhone = phone.length === 9 && hpPhones.has(phone);
    const hitImei = imei && hpImei.has(imei);
    const hitAmt = hpAmt.has(amt);
    if (hitPhone) ebPhoneHit += 1;
    if (hitImei) ebImeiHit += 1;
    if (hitAmt) ebAmtHit += 1;
    if (hitPhone || hitImei || hitAmt) {
      ebMatched += 1;
      ebMatchedAmt += num(so.total_amount);
    }
  });

  const poInCat = [...poSku.values()].filter((r) => r.in_catalog).length;
  const soInCat = [...soSku.values()].filter((r) => r.in_catalog).length;
  const withBuy = products.filter((p) => num(p.buy || p.cost_price)).length;
  const catAligned = prM.categories_aligned || products.filter((p) => p.category_id || p.category).length;

  const bank = reconOverview();
  const cats = categorySummary();
  const invBank = cats.phone_inventory || { n: 0, debit: 0, credit: 0 };

  const retailAmt = retail.reduce((s, r) => s + num(r.total_amount || r.grand_total), 0);
  const retailPaid = retail.reduce((s, r) => s + num(r.amount_paid), 0);
  const retailDue = retail.reduce((s, r) => s + num(r.payment_due), 0);
  const easyAmt = easy.reduce((s, r) => s + num(r.total_amount || r.grand_total), 0);
  const poGrand = pos.reduce((s, p) => s + num(p.grand_total), 0);
  const poDue = pos.reduce((s, p) => s + num(p.payment_due), 0);
  const poPaid = pos.reduce((s, p) => s + num(p.amount_paid), 0);

  return {
    from,
    to,
    purchases: {
      n: pos.length,
      lines: poLines,
      grand: poGrand,
      paid: poPaid,
      due: poDue,
      journals: jes.filter((j) => String(j.id || '').startsWith('je-po-') || String(j.id || '').startsWith('je-ppay-')).length || jes.length,
      payments: pays.length,
      book: poM,
    },
    sales: {
      n: sales.length,
      retail_n: retail.length,
      retail_amt: retailAmt,
      retail_paid: retailPaid,
      retail_due: retailDue,
      easy_n: easy.length,
      easy_amt: easyAmt,
      journals: saleJes.length,
      posted: salesPosted(),
      book: soM,
    },
    hp: {
      n: hpM.n,
      xfer: hpM.xfer,
      down: hpM.down,
      price: hpM.price,
      commission: hpM.commission || hpM.settled * SA_COMMISSION,
      settled: hpM.settled,
      eb_matched: ebMatched,
      eb_matched_amt: ebMatchedAmt,
      eb_unmatched: easy.length - ebMatched,
      eb_phone: ebPhoneHit,
      eb_imei: ebImeiHit,
      eb_amount: ebAmtHit,
    },
    catalog: {
      products: prM.n || products.length,
      aligned: catAligned,
      unmatched_cat: (prM.n || products.length) - catAligned,
      with_buy: withBuy,
      po_skus: poSku.size,
      po_in_catalog: poInCat,
      so_skus: soSku.size,
      so_in_catalog: soInCat,
      so_no_sku: soNoSku,
      po_missing: poMissing.slice(0, 40),
      so_missing: soMissing.slice(0, 40),
    },
    qty: { purchased: poQty, transferred: xferQty, sold: soQty, so_lines: soLines, po_lines: poLines },
    stock: stM,
    bank: {
      n: bank.bank_transactions,
      matched: bank.matched,
      unmatched: bank.unmatched,
      rate: bank.match_rate,
      inventory_n: invBank.n,
      inventory_debit: invBank.debit,
    },
    journals: { purchase: jes.length, sales: saleJes.length, total: jes.length + saleJes.length },
  };
}

export function reconBanner(m) {
  if (!m?.sales?.n && !m?.purchases?.n) {
    return `<p class="sub" style="background:#fff7ed;border:1px solid #fed7aa;border-radius:10px;padding:8px 12px">
      Fiberkapp books have not been hydrated yet.
    </p>`;
  }
  return `<p class="sub" style="background:#ecfdf5;border:1px solid #99f6e4;border-radius:10px;padding:8px 12px">
    ${migStamp()}
    Fiberkapp years <b>${esc(m.from)}</b> → <b>${esc(m.to)}</b>.
    Purchases <b>${m.purchases.n}</b> · retail sales <b>${m.sales.retail_n}</b> (${cedi(m.sales.retail_amt)}) posted as income.
    EasyBuy POS <b>${m.sales.easy_n}</b> lined up against HP Fiberk sell <b>${m.hp.n}</b> (${cedi(m.hp.xfer)}) — deposits and SA ₵100 stay off our books.
    Catalog <b>${m.catalog.products}</b> SKUs · <b>no COGS</b> · profit blank until Franko cost is on each IMEI.
    Calendar 2024 sales sit on the live sales desk. Use the date filter.
  </p>`;
}

export function reconBookCard(partial) {
  const x = lightRecon();
  if (partial?.hp) x.hp = partial.hp;
  if (partial?.purchases) Object.assign(x.purchases, partial.purchases);
  if (partial?.sales) Object.assign(x.sales, partial.sales);
  if (!x?.sales?.n && !x?.purchases?.n) return '';
  return `<div class="ov-card" id="fk-recon">
    <h2>Fiberkapp reconciliation ${migStamp()}</h2>
    <p class="sub">Purchases, retail sales, EasyBuy POS and HP reimbursement are on the same wall.
      Customer deposit and SA commission are the partner’s. Cost of sales is not posted.
      Totals follow the date filter on the live desk.</p>
    <div class="fo-ol-kpis" style="margin:12px 0 0;border:0">
      <article><span>Purchases</span><b>${x.purchases.n}</b></article>
      <article><span>Retail income</span><b>${cedi(x.sales.retail_amt)}</b></article>
      <article><span>HP Fiberk sell</span><b>${cedi(x.hp.xfer)}</b></article>
      <article><span>A/R still due</span><b>${cedi(x.sales.retail_due)}</b></article>
    </div>
    <p style="margin:12px 0 0;display:flex;gap:8px;flex-wrap:wrap">
      <a class="ult-btn ult-btn-primary" href="/accounting-reconciliation.html">Open reconciliation</a>
      <a class="ult-btn ult-btn-outline" href="/accounting-journal.html">Journal Entry</a>
      <a class="ult-btn ult-btn-outline" href="/accounting-reports.html?r=tb">Trial balance</a>
    </p>
  </div>`;
}
