/** Fiberkapp (DELKOR II FIBERK) purchase book — WMS receive + accounting journals. */
import { readLs, writeLs } from './ls-rows.js';
import { KEYS } from './catalog-seed.js';
import { OPS_HUB, BNPL_FIELD_LOCATION, isDirectStore, findLocation } from './scope.js';
import { appendMovements, loadMovements } from './sku-lifecycle.js';
import {
  KEYS as ACC, loadSettings, saveSettings, loadAccounts, ensureDemoBooks, seedDefaultAccounts,
} from './accounting.js';
import { migStamp, siloHref, PACK_METRICS } from './fiberk-silo.js';

const JSON_URL = '/js/fiberk-purchases.json';
const FLAG = 'df_fiberk_purchases_v2';
const FLOW = 'df_fiberk_po_wms_acc_v3';
const LS_POS = 'df_purchases';
const LS_PO = 'df_purchase_orders';
const LS_PAY = 'df_purchase_payments';
const ACT_KEY = 'df_wms_activity';
const XFER_KEY = 'df_stock_transfers';
const HEAD_KEY = 'df_fiberk_purchases';

let BOOK = null;
let MEM_JE = null;

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

export function fiberkPurchaseCount() {
  return fiberkPos().length || PACK_METRICS.purchases.n;
}

export function fiberkPos() {
  if (BOOK?.purchases?.length) return stampPos(BOOK.purchases);
  const head = readLs(HEAD_KEY, []) || [];
  if (head.length) return stampPos(head);
  return (readLs(LS_POS, []) || []).filter((r) => r.source === 'fiberkapp');
}

/** PHONE STOCKS + Fiberk Shop → fiberk books. EasyBuy → bnpl. Never ops (no operating CoA). */
function booksSub(po) {
  const loc = String(po.legacy_location || po.location_name || '').toUpperCase();
  if (loc.includes('FIBERK SHOP')) return 'fiberk';
  if (loc.startsWith('EASYBUY') || loc.includes('EASYBUY')) return 'bnpl';
  return 'fiberk';
}

function receiveLoc(po) {
  const loc = String(po.legacy_location || po.location_code || '').toUpperCase();
  if (loc.startsWith('EASYBUY') || loc.includes('EASYBUY') || loc.includes('FIELD STOCK')) return OPS_HUB.code;
  if (loc.includes('JUMIA') || loc.includes('MARKET PRICE')) return po.location_code || 'FIB-SHOP';
  if (loc.includes('FIBERK SHOP') || isDirectStore(po.location_code)) return po.location_code || 'FIB-SHOP';
  return OPS_HUB.code;
}

function fieldDest(po) {
  const loc = String(po.legacy_location || po.location_name || '').toUpperCase();
  if (loc.startsWith('EASYBUY') || loc.includes('EASYBUY')) return BNPL_FIELD_LOCATION;
  return '';
}

function stampPos(pos) {
  return (pos || []).map((po) => {
    const sub = booksSub(po);
    if (po.subsidiary_code === sub) return po;
    return { ...po, subsidiary_code: sub };
  });
}

function ymd(v) { return String(v || '').slice(0, 10); }
function inRange(row, from, to) {
  const d = ymd(row.date || row.order_date || row.transaction_date);
  if (from && d && d < from) return false;
  if (to && d && d > to) return false;
  if ((from || to) && !d) return false;
  return true;
}

export function purchaseBookMetrics(range = {}) {
  const from = ymd(range.from);
  const to = ymd(range.to);
  let pos = fiberkPos();
  if (from || to) pos = pos.filter((p) => inRange(p, from, to));
  const jes = fiberkPurchaseJournals().filter((j) => {
    if (!(from || to)) return true;
    const d = ymd(j.journal_date || j.date);
    if (from && d && d < from) return false;
    if (to && d && d > to) return false;
    return true;
  });
  if (!pos.length) {
    return { n: 0, grand: 0, paid: 0, due: 0, journals: jes.length, lines: 0, payments: 0, years: {} };
  }
  const years = {};
  pos.forEach((p) => {
    const y = String(p.date || p.order_date || '').slice(0, 4) || '—';
    years[y] = (years[y] || 0) + 1;
  });
  return {
    n: pos.length,
    lines: pos.reduce((s, p) => s + (p.lines || []).length, 0),
    grand: pos.reduce((s, p) => s + Number(p.grand_total || 0), 0),
    due: pos.reduce((s, p) => s + Number(p.payment_due || 0), 0),
    paid: pos.reduce((s, p) => s + Number(p.amount_paid || 0), 0),
    payments: pos.reduce((s, p) => s + (p.payments || []).length, 0),
    journals: jes.length,
    putaways: 0,
    activity: 0,
    years,
  };
}

export function fiberkPurchaseBanner() {
  const x = purchaseBookMetrics();
  if (!x.n) return '';
  const yr = Object.entries(x.years || {}).sort().map(([y, n]) => `${y}: ${n}`).join(' · ') || '—';
  return `<p class="sub" style="background:#ecfdf5;border:1px solid #99f6e4;border-radius:10px;padding:8px 12px">
    Fiberkapp book migrated: <b>${x.n}</b> purchases · ${x.lines} lines · ${cedi(x.grand)} · due ${cedi(x.due)}.
    Years on Fiberkapp: ${yr}. Calendar 2024 is empty (0). Default range is 2025–${new Date().getFullYear()} so both live years show.
    Locations kept as on the source (PHONE STOCKS, FIBERK EASYBUY, EasyBuy SAs, FIBERK SHOP, Jumia).
    Historical — WMS receive is posted, on-hand is not inflated.
    <button type="button" class="ult-btn ult-btn-outline" data-fk-year="all" style="margin-left:8px">All years</button>
    <button type="button" class="ult-btn ult-btn-outline" data-fk-year="2026">2026</button>
    <button type="button" class="ult-btn ult-btn-outline" data-fk-year="2025">2025</button>
    <button type="button" class="ult-btn ult-btn-outline" data-fk-year="2024">2024</button>
  </p>`;
}

export function purchaseBookCard(m) {
  const x = m || purchaseBookMetrics();
  if (!x.n) return '';
  return `<div class="ov-card" id="po-fiberkapp">
    <h2>Fiberkapp purchase book ${migStamp()}</h2>
    <p class="sub">Historical receive posted through WMS (on-hand not inflated) and Accounting
      (Dr Uncategorised Asset / Cr A/P; payments Dr A/P / Cr Cash on hand).
      EasyBuy lands at Ops Hub then put away to BNPL Field. Fiberk Shop receives directly.
      Cost sits on the PO line — not yet allocated to each IMEI, so profit stays blank.
      Live Purchase list no longer lists these rows.</p>
    <div class="fo-ol-kpis" style="margin:12px 0 0;border:0">
      <article><span>Purchases</span><b>${x.n}</b></article>
      <article><span>Grand</span><b>${cedi(x.grand)}</b></article>
      <article><span>Still due</span><b>${cedi(x.due)}</b></article>
      <article><span>Journals</span><b>${x.journals}</b></article>
    </div>
    <p style="margin:12px 0 0;display:flex;gap:8px;flex-wrap:wrap">
      <a class="ult-btn ult-btn-primary" href="/purchase-orders.html">Purchases</a>
      <a class="ult-btn ult-btn-outline" href="/accounting-reconciliation.html">Reconciliation</a>
      <a class="ult-btn ult-btn-outline" href="/accounting-journal.html">Journal entries</a>
    </p>
  </div>`;
}

function refKey(r) {
  return String(r?.reference || r?.reference_no || '').replace(/\s+/g, '').toUpperCase();
}

/** Copy View-popup lines from the Fiberkapp book onto live / catch-up rows with the same PO number. */
export function attachFiberkViewLines() {
  const book = stampPos(BOOK?.purchases || readLs(HEAD_KEY, []) || []);
  if (!book.length) return 0;
  const byRef = new Map(book.map((p) => [refKey(p), p]));
  let n = 0;
  function merge(key) {
    const rows = readLs(key, []) || [];
    let changed = false;
    const next = rows.map((r) => {
      const src = byRef.get(refKey(r));
      if (!src || !(src.lines || []).length) return r;
      if ((r.lines || []).length) return r;
      n += 1;
      changed = true;
      return {
        ...r,
        lines: src.lines,
        items: src.lines,
        supplier_name: r.supplier_name || src.supplier_name,
        added_by: r.added_by || src.added_by,
        date: src.date || r.date,
        order_date: src.order_date || r.order_date,
        location_name: r.location_name || src.location_name,
        legacy_location: src.legacy_location || r.legacy_location,
        upos_id: src.upos_id,
        note: (r.note || '').replace(/No stock on this row\.?/i, '').trim(),
      };
    });
    if (changed) writeLs(key, next);
  }
  merge(LS_POS);
  merge(LS_PO);
  return n;
}

export async function ensureFiberkPurchases() {
  try {
    if (BOOK?.purchases?.length >= 150) {
      attachFiberkViewLines();
      return { ok: true, skipped: true, n: BOOK.purchases.length };
    }
    const head = readLs(HEAD_KEY, []) || [];
    if (localStorage.getItem(FLAG) === '1' && head.length >= 150) {
      BOOK = { purchases: head };
      attachFiberkViewLines();
      return { ok: true, skipped: true, n: head.length };
    }
  } catch { /* continue */ }
  const res = await fetch(JSON_URL, { cache: 'force-cache' });
  if (!res.ok) return { ok: false, n: 0 };
  const book = await res.json();
  const pos = stampPos(book.purchases || []);
  BOOK = { purchases: pos, suppliers: book.suppliers || [], metrics: book.metrics };
  try { writeLs(HEAD_KEY, pos); } catch { /* quota — BOOK still serves */ }
  try { localStorage.setItem(FLAG, '1'); } catch { /* ignore */ }
  attachFiberkViewLines();
  return { ok: true, n: pos.length, suppliers: (book.suppliers || []).length };
}

function pickAcc(accounts, sub, name) {
  return (accounts || []).find((a) => a.subsidiary_code === sub && a.name === name)
    || (accounts || []).find((a) => a.name === name)
    || { id: '', name };
}

function flowPosted() {
  try {
    return localStorage.getItem(FLOW) === '1' && Array.isArray(MEM_JE) && MEM_JE.length >= 150;
  } catch { return false; }
}

export function fiberkPurchaseJournals() {
  if (Array.isArray(MEM_JE) && MEM_JE.length) return MEM_JE;
  try {
    if (typeof window !== 'undefined' && Array.isArray(window.__FK_PO_JE) && window.__FK_PO_JE.length) {
      MEM_JE = window.__FK_PO_JE;
      return MEM_JE;
    }
  } catch { /* ignore */ }
  return (readLs(ACC.journals, []) || []).filter((j) => j.source === 'fiberkapp' && String(j.id || '').startsWith('je-po-'));
}

export async function ensurePurchaseFlow() {
  const book = await ensureFiberkPurchases();
  if (flowPosted()) return { ok: true, skipped: true, n: book.n };

  const pos = stampPos(fiberkPos());
  if (!pos.length) return { ok: true, n: 0 };

  try { await ensureDemoBooks(); } catch { /* coa may already exist */ }
  let accounts = [];
  try { accounts = await seedDefaultAccounts(); } catch { accounts = await loadAccounts().catch(() => []); }
  if (!accounts?.length) accounts = await loadAccounts().catch(() => readLs(ACC.accounts, []) || []);

  const products = readLs(KEYS.products, []) || [];
  const bySku = new Map();
  products.forEach((p) => {
    [p.sku, p.vendor_sku, p.catalog_sku].forEach((s) => {
      const k = String(s || '').toUpperCase();
      if (k) bySku.set(k, p);
    });
  });

  const movements = [];
  const activity = [];
  const journals = [];
  const pays = [];
  const xfers = [];
  const maps = { ...(loadSettings().maps || {}) };
  const newProducts = [];
  const patched = [];
  const existingMoveIds = new Set((loadMovements() || []).map((m) => String(m.id)));

  for (const po of pos) {
    const sub = booksSub(po);
    const land = receiveLoc(po);
    const landLoc = findLocation(land) || OPS_HUB;
    const field = fieldDest(po);
    const day = String(po.date || po.order_date || '').slice(0, 10);
    const grand = Number(po.grand_total || po.total_amount || 0);

    (po.lines || []).forEach((ln, i) => {
      const sku = String(ln.sku || '').toUpperCase();
      let p = bySku.get(sku);
      const cost = Number(ln.unit_cost || 0);
      if (!p && sku) {
        p = {
          id: 'p-upos-' + sku.toLowerCase().replace(/[^a-z0-9]+/g, '-'),
          name: ln.name,
          sku,
          vendor_sku: sku,
          cost_price: cost || null,
          selling_price: 0,
          stock: 0,
          current_stock: 0,
          qty: 0,
          enable_stock: true,
          subsidiary_code: sub,
          location_code: land,
          location_name: landLoc.name,
          supplier_id: po.supplier_id,
          supplier_name: po.supplier_name,
          source: 'fiberkapp',
          open_stock: true,
          is_active: true,
        };
        newProducts.push(p);
        bySku.set(sku, p);
      } else if (p && cost && (p.cost_price == null || p.cost_price === '' || Number(p.cost_price) === 0)) {
        p.cost_price = cost;
        patched.push(p);
      }
      const mid = `mv-po-${po.upos_id || po.id}-${i}`;
      if (!existingMoveIds.has(mid)) {
        movements.push({
          id: mid,
          product_id: p?.id || '',
          created_at: (po.date || day) + (String(po.date || '').includes('T') ? '' : 'T09:00:00'),
          type: 'purchase_receive',
          qty: Number(ln.qty || 0),
          sku_after: sku,
          from_location: '',
          to_location: land,
          location_name: landLoc.name,
          reference: po.reference,
          note: 'Historical Fiberkapp receive. On-hand not increased — already sold or counted separately.',
        });
      }
    });

    activity.push({
      id: 'wms-recv-' + (po.upos_id || po.id),
      type: 'receive',
      sku: (po.lines || []).map((l) => l.sku).filter(Boolean).slice(0, 3).join(', '),
      qty: (po.lines || []).reduce((s, l) => s + Number(l.qty || 0), 0),
      from_location: '',
      to_location: land,
      ref: po.reference,
      note: `Received ${po.supplier_name} at ${landLoc.name}. Historical — stock not inflated.`,
      created_at: po.date || day,
      source: 'fiberkapp',
    });

    if (field && field !== land) {
      const skipPutaway = (readLs(XFER_KEY, []) || []).filter((r) => r.source === 'fiberkapp').length >= 100;
      if (!skipPutaway) {
      const to = findLocation(field);
      xfers.push({
        id: 'st-po-' + (po.upos_id || po.id),
        reference: 'ST-' + String(po.reference || '').replace(/\//g, '-'),
        reference_no: 'ST-' + String(po.reference || '').replace(/\//g, '-'),
        transfer_date: po.date,
        created_at: po.date,
        from_location: land,
        to_location: field,
        from_subsidiary: landLoc.subsidiary || 'ops',
        to_subsidiary: 'bnpl',
        subsidiary_code: 'bnpl',
        location_code: field,
        status: 'completed',
        shipping_charges: 0,
        total_amount: 0,
        notes: `Put-away after ${po.reference}: Hub → ${po.location_name}. Cost stays on the purchase.`,
        lines: (po.lines || []).map((l) => ({ sku: l.sku, name: l.name, qty: l.qty, quantity: l.qty })),
        source: 'fiberkapp',
      });
      activity.push({
        id: 'wms-put-' + (po.upos_id || po.id),
        type: 'putaway',
        sku: (po.lines || [])[0]?.sku || '',
        qty: (po.lines || []).reduce((s, l) => s + Number(l.qty || 0), 0),
        from_location: land,
        to_location: field,
        ref: po.reference,
        note: 'Put away to BNPL Field Sales (EasyBuy location on the source PO).',
        created_at: po.date || day,
        source: 'fiberkapp',
      });
      }
    }

    const inv = pickAcc(accounts, sub, 'Uncategorised Asset');
    const ap = pickAcc(accounts, sub, 'Accounts Payable (A/P)');
    const cash = pickAcc(accounts, sub, 'Cash on hand');
    journals.push({
      id: 'je-po-' + (po.upos_id || po.id),
      journal_date: day,
      operation_date: day,
      ref_no: 'JE-' + String(po.reference || '').replace(/\//g, '-'),
      note: `Purchase ${po.reference} · ${po.supplier_name} · inventory in, payable out.`,
      added_by: po.added_by || 'Migration',
      status: 'posted',
      subsidiary_code: sub,
      location_code: po.location_code,
      location_name: po.location_name,
      total: grand,
      source: 'fiberkapp',
      lines: [
        { account_id: inv.id || '', account: inv.name, debit: grand, credit: 0, note: 'Inventory / uncategorised asset' },
        { account_id: ap.id || '', account: ap.name, debit: 0, credit: grand, note: po.supplier_name },
      ],
    });
    maps['purchase:' + po.id] = { payment_account: ap.id || ap.name, deposit_to: inv.id || inv.name, auto: true };
    maps['purchases:' + po.id] = maps['purchase:' + po.id];

    (po.payments || []).forEach((p, i) => {
      const amt = Number(p.amount || 0);
      if (!amt) return;
      const pday = String(p.date || day).slice(0, 10);
      const pid = 'ppay-' + (po.upos_id || po.id) + '-' + i;
      pays.push({
        id: pid,
        purchase_id: po.id,
        reference: p.reference || ('PAY-' + po.reference),
        amount: amt,
        method: p.method || 'Cash',
        date: p.date || pday,
        supplier_name: po.supplier_name,
        supplier_id: po.supplier_id,
        subsidiary_code: sub,
        location_code: po.location_code,
        location_name: po.location_name,
        source: 'fiberkapp',
      });
      journals.push({
        id: 'je-' + pid,
        journal_date: pday,
        operation_date: pday,
        ref_no: 'JE-' + String(p.reference || pid).replace(/\//g, '-'),
        note: `Purchase payment ${p.reference || ''} on ${po.reference} · ${p.method || 'Cash'}.`,
        added_by: po.added_by || 'Migration',
        status: 'posted',
        subsidiary_code: sub,
        location_code: po.location_code,
        location_name: po.location_name,
        total: amt,
        source: 'fiberkapp',
        lines: [
          { account_id: ap.id || '', account: ap.name, debit: amt, credit: 0, note: po.supplier_name },
          { account_id: cash.id || '', account: cash.name, debit: 0, credit: amt, note: p.method || 'Cash' },
        ],
      });
      maps['purchase_payment:' + po.id] = { payment_account: cash.id || cash.name, deposit_to: ap.id || ap.name, auto: true };
      maps['purchase_payment:' + pid] = maps['purchase_payment:' + po.id];
    });
  }

  if (typeof window !== 'undefined') window.__FK_PO_JE = journals;
  MEM_JE = journals;

  try { saveSettings({ ...loadSettings(), maps }); } catch { /* quota */ }
  try { localStorage.setItem(FLOW, '1'); } catch { /* ignore */ }
  return {
    ok: true,
    n: pos.length,
    movements: movements.length,
    journals: journals.length,
    payments: pays.length,
    transfers: xfers.length,
    products: newProducts.length,
  };
}
