/**
 * WMS color-coded floor — same stock books as Operations Hub.
 * Not a second warehouse. Receive / put-away / transfer / adjust / count
 * write the Hub tables; pick / pack / activity are WMS-only.
 */
import { getAuthSession } from './supabaseClient.js';
import { esc, loadRows, saveRow, readLs, writeLs, uid, isTombstoned } from './ls-rows.js';
import { KEYS, isDemoRecord } from './catalog-seed.js';
import { hubTabs, bindHubTabs, goFile, svgIco, maybePaintNest, resolveHubTab, nestsFor, onHubNavigate, floorNav, tryPaintFloor } from './hub-kit.js';
import { bindTable } from './home-tables.js';
import { confirmAction, ackResult } from './confirm-action.js';
import {
  OPS_HUB, BUSINESS_LOCATIONS, findLocation, isDirectStore, formLocOptions,
} from './scope.js';
import { applyReceivedStock, loadPurchases, savePurchase } from './purchase-docs.js';
import {
  circulateProduct, appendMovements, applyProductPatch, displaySku, transferGate, MOVE_KEY, canReceiveNewStock,
} from './sku-lifecycle.js';
import { peelWrite } from './account-rules.js';
import { ensureBankBooks, opsActivity, catLabel } from './bank-ledger.js';
import { excludeMigrated, siloGateHtml, migratedWmsNoteHtml, isMigratedRow, knownSiloCount } from './fiberk-silo.js';
import { deskHow } from './desk-manual.js';

const FILE = '/wms.html';
const PICK_KEY = 'df_wms_picks';
const PACK_KEY = 'df_wms_packs';
const ACT_KEY = 'df_wms_activity';
const SHIP_KEY = 'df_shipments';
const XFER_KEY = 'df_stock_transfers';
const ADJ_KEY = 'df_stock_adjustments';
const CARRIERS = ['Delkor Logistics', 'Ghana Post', 'DHL', 'Customer pickup'];

const TABS = [
  { key: 'floor', label: 'Floor' },
  { key: 'recv', label: 'Receiving' },
  { key: 'putaway', label: 'Put Away' },
  { key: 'pick', label: 'Picking' },
  { key: 'pack', label: 'Packing' },
  { key: 'dispatch', label: 'Dispatch' },
  { key: 'stock', label: 'Stock' },
  { key: 'xfer', label: 'Transfers' },
  { key: 'adj', label: 'Adjustments' },
  { key: 'count', label: 'Count' },
  { key: 'scan', label: 'Scan' },
  { key: 'bank', label: 'Bank Activity' },
];
const BRAND = `${svgIco('box') || '▣'} WMS`;

let _who = { email: '', name: 'Staff' };
let _cache = null;
let _scanStream = null;
let _remoteOk = true;

function tab() {
  const t = new URLSearchParams(location.search).get('tab') || 'floor';
  return resolveHubTab(t, TABS, 'floor', nestsFor(FILE));
}
function go(t) {
  stopScan();
  goFile(FILE, (!t || t === 'floor') ? '' : t);
  paint();
}
function nav(on) { return floorNav(BRAND, on, 'floor', FILE); }

function live(row, table, key) {
  if (!row || isDemoRecord(row)) return false;
  if (table && isTombstoned(table, row)) return false;
  if (key && isTombstoned(key, row)) return false;
  return true;
}
function qtyOf(p) {
  return Number(p?.current_stock ?? p?.stock ?? p?.qty ?? p?.current_stock_value ?? 0);
}
function skuEq(p, sku) {
  const want = String(sku || '').trim().toUpperCase();
  if (!want) return false;
  return [p.sku, p.catalog_sku, p.base_sku, p.vendor_sku, displaySku(p)]
    .some((s) => String(s || '').toUpperCase() === want);
}
function hubLocated(p) {
  return /OPS-HUB|VW-GROUP|GRP-HQ/i.test(String(p.location_code || OPS_HUB.code));
}
function locName(code) {
  return findLocation(code)?.name || code || '—';
}
function when(v) {
  return String(v || '').slice(0, 16).replace('T', ' ');
}
function mergeById(a, b) {
  const map = new Map();
  [...(a || []), ...(b || [])].forEach((r) => {
    const id = String(r?.id || r?.reference || r?.order_no || '');
    if (!id) return;
    map.set(id, { ...(map.get(id) || {}), ...r });
  });
  return [...map.values()];
}
function saleRef(s) {
  return s?.reference || s?.so_number || s?.order_no || s?.id || '';
}
function saleLines(s) {
  return (s?.lines || s?.items || []).map((l) => ({
    product_id: l.product_id || l.id || '',
    sku: l.sku || '',
    name: l.name || l.product_name || '',
    qty: Number(l.qty || l.quantity || 0),
  })).filter((l) => l.qty);
}

async function logAct(row) {
  const rec = {
    id: uid(),
    type: row.type || 'event',
    sku: row.sku || '',
    product_id: row.product_id || '',
    qty: Number(row.qty || 0),
    from_location: row.from_location || '',
    to_location: row.to_location || '',
    ref: row.ref || '',
    order_no: row.order_no || '',
    note: row.note || '',
    user_email: _who.email,
    created_at: new Date().toISOString(),
  };
  await saveRow('wms_activity', ACT_KEY, rec);
  return rec;
}

function patchLocalQty(product, nextQty, dest) {
  const rows = readLs(KEYS.products, []) || [];
  const i = rows.findIndex((r) => String(r.id) === String(product.id));
  if (i < 0) return product;
  const q = Math.max(0, Number(nextQty));
  const patch = {
    ...rows[i],
    current_stock: q,
    stock: q,
    qty: q,
    current_stock_value: q,
  };
  if (dest) {
    patch.location_code = dest.code;
    patch.location_name = dest.name;
    patch.warehouse_code = dest.warehouse || dest.code;
    patch.subsidiary_code = dest.subsidiary || patch.subsidiary_code;
  }
  rows[i] = patch;
  writeLs(KEYS.products, rows);
  return patch;
}

async function receiveAt(lines, locCode, ref) {
  const dest = findLocation(locCode) || OPS_HUB;
  if (!canReceiveNewStock(dest.code)) {
    ackResult(false, 'New stock lands at Operations Hub. Fiberk Shop is the only shop that can receive directly.');
    return false;
  }
  const products = readLs(KEYS.products, []) || [];
  const before = new Map(products.map((p) => [String(p.id), qtyOf(p)]));
  await applyReceivedStock(lines, false, dest.code);
  const after = readLs(KEYS.products, []) || [];
  for (const l of lines) {
    const p = after.find((x) => String(x.id) === String(l.product_id))
      || after.find((x) => skuEq(x, l.sku))
      || products.find((x) => String(x.id) === String(l.product_id));
    if (!p) continue;
    const prev = before.get(String(p.id));
    const now = qtyOf(after.find((x) => String(x.id) === String(p.id)) || p);
    if (prev == null || now === prev) {
      patchLocalQty(p, (prev ?? qtyOf(p)) + Number(l.qty || 0), dest);
    } else {
      patchLocalQty({ ...p, id: p.id }, now, dest);
    }
    await logAct({
      type: 'receive',
      sku: l.sku || p.sku,
      product_id: p.id,
      qty: Number(l.qty || 0),
      to_location: dest.code,
      ref,
      note: isDirectStore(dest.code)
        ? 'Received directly at Fiberk Shop (physical store-room).'
        : 'Received at Operations Hub. Put away to a selling location next.',
    });
  }
  return true;
}

async function completeTransfer({ sku, product, fromCode, toCode, qty, note }) {
  const from = findLocation(fromCode) || OPS_HUB;
  const to = findLocation(toCode);
  if (!to) { ackResult(false, 'Pick a destination.'); return false; }
  const gate = transferGate(from, to, [product]);
  if (!gate.ok) { ackResult(false, gate.message); return false; }
  const n = Number(qty || 0);
  if (n <= 0) { ackResult(false, 'Quantity must be more than 0.'); return false; }
  const avail = qtyOf(product);
  if (String(product.location_code || '') === from.code && n > avail) {
    ackResult(false, 'Qty exceeds on-hand at ' + from.name + '.');
    return false;
  }
  const ref = 'ST' + Date.now().toString().slice(-6);
  const { product: next, events } = circulateProduct(product, {
    from, to, qty: n, reference: ref, type: 'transfer',
  });
  applyProductPatch(next);
  if (events?.length) appendMovements(events);
  await saveRow('stock_transfers', XFER_KEY, {
    reference: ref,
    status: 'completed',
    transfer_date: new Date().toISOString(),
    from_location: from.code,
    to_location: to.code,
    from_warehouse_code: from.warehouse,
    to_warehouse_code: to.warehouse,
    from_subsidiary: from.subsidiary,
    to_subsidiary: to.subsidiary,
    via_virtual: from.hub || to.hub || from.code === OPS_HUB.code || to.code === OPS_HUB.code,
    notes: note || 'WMS floor',
    lines: [{ id: product.id, sku: sku || displaySku(product), name: product.name, qty: n }],
    added_by: _who.email || _who.name,
    source: 'wms',
  });
  await logAct({
    type: note?.toLowerCase().includes('put') ? 'putaway' : 'transfer',
    sku: sku || displaySku(next),
    product_id: product.id,
    qty: n,
    from_location: from.code,
    to_location: to.code,
    ref,
    note: gate.message || note || '',
  });
  return true;
}

async function loadState() {
  const [products, purchases, transfers, adjustments, shipments, sales, picksLs, packsLs, actLs, moves] = await Promise.all([
    loadRows('products', KEYS.products, []),
    loadPurchases(),
    loadRows('stock_transfers', XFER_KEY, []),
    loadRows('stock_adjustments', ADJ_KEY, []),
    loadRows('shipments', SHIP_KEY, []),
    loadRows('sales_orders', KEYS.sales, []),
    Promise.resolve(readLs(PICK_KEY, [])),
    Promise.resolve(readLs(PACK_KEY, [])),
    Promise.resolve(readLs(ACT_KEY, [])),
    Promise.resolve(readLs(MOVE_KEY, [])),
  ]);
  let remotePicks = [], remotePacks = [], remoteAct = [];
  if (_remoteOk) {
    try {
      const { supabase } = await import('./supabaseClient.js');
      const [a, b, c] = await Promise.all([
        supabase.from('wms_picks').select('*').order('created_at', { ascending: false }).limit(400),
        supabase.from('wms_packs').select('*').order('created_at', { ascending: false }).limit(400),
        supabase.from('wms_activity').select('*').order('created_at', { ascending: false }).limit(400),
      ]);
      const miss = (q) => q?.error && /PGRST205|PGRST204|does not exist|schema cache|404/i.test(String(q.error.message || q.error.code || ''));
      if (miss(a) || miss(b) || miss(c) || (a.error && b.error && c.error)) _remoteOk = false;
      if (!a.error) remotePicks = a.data || [];
      if (!b.error) remotePacks = b.data || [];
      if (!c.error) remoteAct = c.data || [];
    } catch {
      _remoteOk = false;
    }
  }

  const liveP = (products || []).filter((p) => live(p, 'products', KEYS.products));
  const state = {
    products: liveP,
    hubStock: liveP.filter((p) => hubLocated(p) && qtyOf(p) > 0),
    incoming: (purchases || []).filter((r) => live(r, r._table || 'purchases', 'df_purchases') && String(r.status || '') !== 'received' && !isMigratedRow(r)),
    receivedN: knownSiloCount('purchases'),
    putawayN: knownSiloCount('transfers'),
    received: [],
    putaways: [],
    transfers: excludeMigrated((transfers || []).filter((r) => live(r, 'stock_transfers', XFER_KEY)))
      .sort((a, b) => String(b.transfer_date || b.created_at || '').localeCompare(String(a.transfer_date || a.created_at || ''))),
    adjustments: (adjustments || []).filter((r) => live(r, 'stock_adjustments', ADJ_KEY)),
    shipments: (shipments || []).filter((r) => live(r, 'shipments', SHIP_KEY)),
    sales: excludeMigrated((sales || []).filter((r) => live(r, 'sales_orders', KEYS.sales))),
    picks: mergeById(picksLs, remotePicks).filter((r) => live(r, 'wms_picks', PICK_KEY)),
    packs: mergeById(packsLs, remotePacks).filter((r) => live(r, 'wms_packs', PACK_KEY)),
    activity: mergeById(actLs, remoteAct).filter((r) => live(r, 'wms_activity', ACT_KEY) && !isMigratedRow(r))
      .sort((a, b) => String(b.created_at || '').localeCompare(String(a.created_at || ''))),
    moves: (moves || []).filter((m) => !isDemoRecord(m)),
  };
  writeLs(PICK_KEY, state.picks);
  writeLs(PACK_KEY, state.packs);
  // Keep Fiberkapp activity in LS; the floor tape above is live-only.
  _cache = state;
  return state;
}

function kpi(label, value, tone) {
  return `<div class="ult-kpi"><div class="ult-kpi-icon ${tone}">▣</div><div class="ult-kpi-body"><div class="ult-kpi-label">${esc(label)}</div><div class="ult-kpi-value">${esc(String(value))}</div></div></div>`;
}

function floorCard(tabKey, title, count) {
  return `<a class="wms-card" href="${FILE}?tab=${encodeURIComponent(tabKey)}" data-htab="${esc(tabKey)}">
    <strong>${esc(title)}</strong>
    <b>${esc(String(count))}</b>
  </a>`;
}

function paintFloor(app, s) {
  const openPicks = s.picks.filter((p) => (p.status || 'pending') !== 'picked').length;
  const packed = s.packs.filter((p) => (p.status || '') === 'packed').length;
  const pendingShip = s.shipments.filter((x) => /pending|packed/i.test(x.status || 'pending')).length;
  const recent = s.activity.slice(0, 8);
  app.innerHTML = `
    ${nav('floor')}
    ${deskHow('wms', 'How this desk works')}
    ${migratedWmsNoteHtml(s.receivedN, s.putawayN)}
    <div class="ult-kpis">
      ${kpi('At Hub', s.hubStock.length, 'cyan')}
      ${kpi('To receive', s.incoming.length, 'amber')}
      ${kpi('Received book', s.receivedN || 0, 'green')}
      ${kpi('EasyBuy put-away', s.putawayN || 0, 'blue')}
      ${kpi('Open picks', openPicks, 'blue')}
      ${kpi('Awaiting dispatch', pendingShip || packed, 'green')}
    </div>
    <div class="wms-grid">
      ${floorCard('recv', 'Receiving', (s.incoming.length || 0))}
      ${floorCard('putaway', 'Put Away', s.hubStock.length)}
      ${floorCard('pick', 'Picking', openPicks)}
      ${floorCard('pack', 'Packing', s.picks.filter((p) => p.status === 'picked').length)}
      ${floorCard('dispatch', 'Dispatch', pendingShip)}
      ${floorCard('stock', 'Stock', s.products.filter((p) => qtyOf(p) > 0).length)}
      ${floorCard('xfer', 'Transfers', s.transfers.length)}
      ${floorCard('adj', 'Adjustments', s.adjustments.length)}
      ${floorCard('count', 'Count', s.adjustments.filter((a) => a.type === 'stock_count').length)}
      ${floorCard('scan', 'Scan', '—')}
    </div>
    <div class="ult-card" style="margin-top:16px">
      <h2 style="margin:0 0 8px;font-size:16px">Floor activity</h2>
      <div class="ult-table-wrap"><table class="ult-table">
        <thead><tr><th>When</th><th>Type</th><th>SKU</th><th>Qty</th><th>From</th><th>To</th><th>Ref</th></tr></thead>
        <tbody>${recent.map((a) => `<tr>
          <td>${esc(when(a.created_at))}</td>
          <td>${esc(a.type)}</td>
          <td>${esc(a.sku)}</td>
          <td>${esc(a.qty)}</td>
          <td>${esc(locName(a.from_location))}</td>
          <td>${esc(locName(a.to_location))}</td>
          <td>${esc(a.ref || a.order_no || '')}</td>
        </tr>`).join('') || '<tr data-dummy="1"><td colspan="7" style="text-align:center">No floor activity yet. Receive a purchase or pick an order.</td></tr>'}</tbody>
      </table></div>
      <p style="margin:12px 0 0"><a class="ult-btn ult-btn-outline" href="/virtual-warehouse.html">Operations Hub board</a>
      <a class="ult-btn ult-btn-outline" href="/receive-stock.html">Office Receive Stock</a>
      <a class="ult-btn ult-btn-outline" href="/paper-purchase.html">Pinaro paper invoice</a>
      <a class="ult-btn ult-btn-outline" href="/accounting-transactions.html?tab=purchase">Purchase journals</a>
      <a class="ult-btn ult-btn-outline" href="/stock-transfers.html">All transfers</a></p>
    </div>`;
}

function locSelect(id, selected, extra = '') {
  return `<select id="${id}">${formLocOptions(selected, { includeVirtual: true, allSubsidiaries: true })}${extra}</select>`;
}
function receiveLocSelect(id, selected) {
  const opts = [OPS_HUB, ...BUSINESS_LOCATIONS.filter((l) => isDirectStore(l.code) && l.code !== OPS_HUB.code)];
  const seen = new Set();
  const unique = opts.filter((l) => { if (seen.has(l.code)) return false; seen.add(l.code); return true; });
  return `<select id="${id}">${unique.map((l) => `<option value="${esc(l.code)}" ${l.code === selected ? 'selected' : ''}>${esc(l.name)}</option>`).join('')}</select>`;
}

function paintRecv(app, s) {
  const qSku = new URLSearchParams(location.search).get('sku') || '';
  app.innerHTML = `
    ${nav('recv')}
    ${deskHow('wms-recv')}
    ${siloGateHtml('purchases', s.receivedN || 0)}
    <div class="wms-split">
      <form id="wms-recv" class="ult-card wms-form">
        <h2>Walk-in receive</h2>
        <label>SKU <input id="sku" value="${esc(qSku)}" autocomplete="off" placeholder="Scan or type SKU" /></label>
        <label>Quantity <input id="qty" type="number" min="1" step="1" value="1" /></label>
        <label>Supplier / reference <input id="ref" placeholder="PO, delivery note…" /></label>
        <label>Land at ${receiveLocSelect('loc', OPS_HUB.code)}</label>
        <p class="ult-muted">Only Operations Hub and Fiberk Shop accept new stock.</p>
        <button type="submit" class="ult-btn ult-btn-primary">Receive</button>
        <div id="recv-msg" class="wms-log"></div>
      </form>
      <div class="ult-card" data-tbl="wms-po">
        <h2 style="margin:0 0 10px;font-size:16px">Unreceived purchases</h2>
        <div class="ult-table-wrap"><table class="ult-table">
          <thead><tr><th>Date</th><th>Reference</th><th>Supplier</th><th>Status</th><th></th></tr></thead>
          <tbody>${s.incoming.map((r) => `<tr>
            <td>${esc(String(r.date || '').slice(0, 10))}</td>
            <td>${esc(r.reference || '')}</td>
            <td>${esc(r.supplier_name || '')}</td>
            <td>${esc(r.status || 'ordered')}</td>
            <td><button type="button" class="ult-btn" data-recv-po="${esc(r.id)}">Receive at Hub</button></td>
          </tr>`).join('') || '<tr data-dummy="1"><td colspan="5" style="text-align:center">No incoming purchases. Add a purchase first — WMS does not invent stock.</td></tr>'}</tbody>
        </table></div>
      </div>
    </div>
  `;
  bindTable(app.querySelector('[data-tbl="wms-po"]'), { title: 'Unreceived', storageKey: 'wms-po' });
  document.getElementById('wms-recv').onsubmit = async (e) => {
    e.preventDefault();
    const sku = document.getElementById('sku').value.trim();
    const qty = Number(document.getElementById('qty').value || 0);
    const ref = document.getElementById('ref').value.trim();
    const loc = document.getElementById('loc').value;
    const msg = document.getElementById('recv-msg');
    const p = s.products.find((x) => skuEq(x, sku));
    if (!p) { msg.textContent = 'Unknown SKU. Add the product on Products first — WMS does not invent catalogue.'; return; }
    if (qty <= 0) { msg.textContent = 'Quantity must be more than 0.'; return; }
    if (!(await confirmAction('Receive this SKU?', `${qty} × ${p.name} at ${locName(loc)}`))) return;
    const ok = await receiveAt([{ product_id: p.id, sku: p.sku, qty, reference: ref }], loc, ref);
    if (ok) { ackResult(true, 'Received. Hub board and Put Away now see this qty.'); await reload(); }
  };
  app.querySelectorAll('[data-recv-po]').forEach((b) => {
    b.onclick = async () => {
      const row = s.incoming.find((r) => String(r.id) === b.dataset.recvPo);
      if (!row) return;
      if (!(await confirmAction('Receive this purchase at Operations Hub?'))) return;
      const ok = await receiveAt(row.lines || [], OPS_HUB.code, row.reference);
      if (!ok) return;
      await savePurchase({ ...row, status: 'received', location_code: OPS_HUB.code, location_name: OPS_HUB.name }, { id: row.id, table: row._table });
      ackResult(true, 'Purchase received at Operations Hub.');
      await reload();
    };
  });
}

function paintPutaway(app, s) {
  const pre = new URLSearchParams(location.search).get('product') || '';
  const chosen = s.hubStock.find((p) => String(p.id) === pre) || s.hubStock[0];
  app.innerHTML = `
    ${nav('putaway')}
    ${deskHow('wms-putaway')}
    ${siloGateHtml('transfers', s.putawayN || 0)}
    <div class="wms-split">
      <form id="wms-away" class="ult-card wms-form">
        <h2>Move from Hub</h2>
        <label>SKU
          <select id="pid">${s.hubStock.map((p) => `<option value="${esc(p.id)}" ${chosen && p.id === chosen.id ? 'selected' : ''}>${esc(displaySku(p))} · ${esc(p.name)} (${qtyOf(p)})</option>`).join('') || '<option value="">Nothing at Hub</option>'}</select>
        </label>
        <label>From <input value="${esc(OPS_HUB.name)}" readonly /></label>
        <label>To ${locSelect('to', '')}</label>
        <label>Quantity <input id="qty" type="number" min="1" step="1" value="${chosen ? qtyOf(chosen) : 1}" /></label>
        <button type="submit" class="ult-btn ult-btn-primary" ${s.hubStock.length ? '' : 'disabled'}>Put away</button>
        <div id="away-msg" class="wms-log"></div>
      </form>
      <div class="ult-card" data-tbl="wms-hub">
        <h2 style="margin:0 0 10px;font-size:16px">At Operations Hub</h2>
        <div class="ult-table-wrap"><table class="ult-table">
          <thead><tr><th>SKU</th><th>Name</th><th>Qty</th><th></th></tr></thead>
          <tbody>${s.hubStock.map((p) => `<tr>
            <td>${esc(displaySku(p))}</td>
            <td>${esc(p.name || '')}</td>
            <td>${qtyOf(p)}</td>
            <td><button type="button" class="ult-btn" data-use="${esc(p.id)}">Use</button></td>
          </tr>`).join('') || '<tr data-dummy="1"><td colspan="4" style="text-align:center">Nothing at Operations Hub. Receive stock first.</td></tr>'}</tbody>
        </table></div>
      </div>
    </div>`;
  bindTable(app.querySelector('[data-tbl="wms-hub"]'), { title: 'Hub stock', storageKey: 'wms-hub' });
  document.getElementById('wms-away').onsubmit = async (e) => {
    e.preventDefault();
    const pid = document.getElementById('pid').value;
    const to = document.getElementById('to').value;
    const qty = Number(document.getElementById('qty').value || 0);
    const p = s.products.find((x) => String(x.id) === String(pid));
    const msg = document.getElementById('away-msg');
    if (!p) { msg.textContent = 'Pick a SKU at the Hub.'; return; }
    if (!(await confirmAction('Put away this SKU?', `${qty} × ${p.name} → ${locName(to)}`))) return;
    const ok = await completeTransfer({ product: p, sku: displaySku(p), fromCode: OPS_HUB.code, toCode: to, qty, note: 'WMS put away' });
    if (ok) { ackResult(true, 'Put away posted. Hub board shows the transfer.'); await reload(); }
  };
  app.querySelectorAll('[data-use]').forEach((b) => {
    b.onclick = () => {
      document.getElementById('pid').value = b.dataset.use;
      const p = s.hubStock.find((x) => String(x.id) === b.dataset.use);
      if (p) document.getElementById('qty').value = qtyOf(p);
    };
  });
}

function openSales(s) {
  const picked = new Set(s.picks.filter((p) => p.status === 'picked').map((p) => String(p.sale_id || p.order_no)));
  return s.sales.filter((sale) => {
    const st = String(sale.status || '').toLowerCase();
    if (/cancel|void|returned/.test(st)) return false;
    const ref = saleRef(sale);
    if (picked.has(String(sale.id)) || picked.has(String(ref))) return false;
    const shipped = s.shipments.some((sh) => String(sh.sales_order_id) === String(sale.id) && /shipped|delivered/.test(sh.status || ''));
    return !shipped;
  });
}

function paintPick(app, s) {
  const open = openSales(s);
  const qOrd = new URLSearchParams(location.search).get('order') || '';
  app.innerHTML = `
    ${nav('pick')}
    ${deskHow('wms-pick')}
    <div class="wms-split">
      <form id="wms-pick" class="ult-card wms-form">
        <h2>Load pick list</h2>
        <label>Order
          <select id="order">
            <option value="">Select a sale</option>
            ${open.map((o) => `<option value="${esc(o.id)}" ${qOrd && (qOrd === o.id || qOrd === saleRef(o)) ? 'selected' : ''}>${esc(saleRef(o))} · ${esc(o.customer_name || '')}</option>`).join('')}
          </select>
        </label>
        <button type="button" class="ult-btn" id="load-pick">Load</button>
        <div id="pick-list"></div>
        <button type="submit" class="ult-btn ult-btn-primary" id="do-pick" hidden>Complete pick</button>
      </form>
      <div class="ult-card" data-tbl="wms-picks">
        <h2 style="margin:0 0 10px;font-size:16px">Pick tickets</h2>
        <div class="ult-table-wrap"><table class="ult-table">
          <thead><tr><th>When</th><th>Order</th><th>Status</th><th>Lines</th></tr></thead>
          <tbody>${s.picks.slice(0, 40).map((p) => `<tr>
            <td>${esc(when(p.created_at))}</td>
            <td>${esc(p.order_no)}</td>
            <td>${esc(p.status)}</td>
            <td>${(p.lines || []).length}</td>
          </tr>`).join('') || '<tr data-dummy="1"><td colspan="4" style="text-align:center">No picks yet.</td></tr>'}</tbody>
        </table></div>
      </div>
    </div>`;
  bindTable(app.querySelector('[data-tbl="wms-picks"]'), { title: 'Picks', storageKey: 'wms-picks' });
  let loaded = null;
  const draw = (sale) => {
    loaded = sale;
    const lines = saleLines(sale);
    document.getElementById('pick-list').innerHTML = lines.length
      ? `<table class="ult-table"><thead><tr><th>SKU</th><th>Name</th><th>Qty</th></tr></thead><tbody>${
        lines.map((l) => `<tr><td>${esc(l.sku)}</td><td>${esc(l.name)}</td><td>${l.qty}</td></tr>`).join('')
      }</tbody></table>`
      : '<p class="ult-muted">This sale has no lines to pick.</p>';
    document.getElementById('do-pick').hidden = !lines.length;
  };
  document.getElementById('load-pick').onclick = () => {
    const sale = s.sales.find((o) => String(o.id) === document.getElementById('order').value);
    if (!sale) { ackResult(false, 'Pick a sale.'); return; }
    draw(sale);
  };
  if (qOrd) {
    const sale = s.sales.find((o) => String(o.id) === qOrd || saleRef(o) === qOrd);
    if (sale) {
      document.getElementById('order').value = sale.id;
      draw(sale);
    }
  }
  document.getElementById('wms-pick').onsubmit = async (e) => {
    e.preventDefault();
    if (!loaded) return;
    const lines = saleLines(loaded);
    if (!(await confirmAction('Complete this pick?', saleRef(loaded)))) return;
    const rec = {
      id: uid(),
      order_no: saleRef(loaded),
      sale_id: loaded.id,
      status: 'picked',
      lines,
      qty: lines.reduce((n, l) => n + l.qty, 0),
      location_code: OPS_HUB.code,
      user_email: _who.email,
      user_name: _who.name,
    };
    await saveRow('wms_picks', PICK_KEY, rec);
    await logAct({ type: 'pick', order_no: rec.order_no, ref: rec.order_no, qty: rec.qty, note: 'Pick completed' });
    ackResult(true, 'Picked. Packing can load this order.');
    await reload();
  };
}

function paintPack(app, s) {
  const ready = s.picks.filter((p) => p.status === 'picked' && !s.packs.some((k) => k.pick_id === p.id && k.status === 'packed'));
  app.innerHTML = `
    ${nav('pack')}
    ${deskHow('wms-pack')}
    <div class="wms-split">
      <form id="wms-pack" class="ult-card wms-form">
        <h2>Packing station</h2>
        <label>Picked order
          <select id="order">
            <option value="">Select a pick</option>
            ${ready.map((p) => `<option value="${esc(p.id)}">${esc(p.order_no)}</option>`).join('')}
          </select>
        </label>
        <button type="button" class="ult-btn" id="load-pack">Load items</button>
        <div id="pack-items"></div>
        <button type="submit" class="ult-btn ult-btn-primary" id="do-pack" hidden>Complete packing</button>
      </form>
      <div class="ult-card" data-tbl="wms-packs">
        <h2 style="margin:0 0 10px;font-size:16px">Packed</h2>
        <div class="ult-table-wrap"><table class="ult-table">
          <thead><tr><th>When</th><th>Order</th><th>Status</th></tr></thead>
          <tbody>${s.packs.slice(0, 40).map((p) => `<tr>
            <td>${esc(when(p.created_at))}</td>
            <td>${esc(p.order_no)}</td>
            <td>${esc(p.status)}</td>
          </tr>`).join('') || '<tr data-dummy="1"><td colspan="3" style="text-align:center">Nothing packed yet.</td></tr>'}</tbody>
        </table></div>
      </div>
    </div>`;
  bindTable(app.querySelector('[data-tbl="wms-packs"]'), { title: 'Packs', storageKey: 'wms-packs' });
  let loaded = null;
  document.getElementById('load-pack').onclick = () => {
    const pick = s.picks.find((p) => String(p.id) === document.getElementById('order').value);
    if (!pick) { ackResult(false, 'Pick a picked order.'); return; }
    loaded = pick;
    const lines = pick.lines || [];
    document.getElementById('pack-items').innerHTML = lines.length
      ? `<table class="ult-table"><thead><tr><th>SKU</th><th>Name</th><th>Qty</th></tr></thead><tbody>${
        lines.map((l) => `<tr><td>${esc(l.sku)}</td><td>${esc(l.name)}</td><td>${l.qty}</td></tr>`).join('')
      }</tbody></table>`
      : '<p class="ult-muted">No lines on this pick.</p>';
    document.getElementById('do-pack').hidden = !lines.length;
  };
  document.getElementById('wms-pack').onsubmit = async (e) => {
    e.preventDefault();
    if (!loaded) return;
    if (!(await confirmAction('Complete packing?', loaded.order_no))) return;
    const ship = await saveRow('shipments', SHIP_KEY, {
      sales_order_id: loaded.sale_id,
      reference: loaded.order_no,
      carrier: 'Delkor Logistics',
      tracking: '',
      status: 'packed',
      source: 'wms',
      added_by: _who.email,
    });
    await saveRow('wms_packs', PACK_KEY, {
      order_no: loaded.order_no,
      sale_id: loaded.sale_id,
      pick_id: loaded.id,
      shipment_id: ship.id,
      status: 'packed',
      lines: loaded.lines || [],
      user_email: _who.email,
      user_name: _who.name,
    });
    await logAct({ type: 'pack', order_no: loaded.order_no, ref: loaded.order_no, note: 'Packed · shipment pending dispatch' });
    ackResult(true, 'Packed. Dispatch can ship it.');
    await reload();
  };
}

function paintDispatch(app, s) {
  const ready = s.shipments.filter((x) => /pending|packed/i.test(x.status || 'pending'));
  const packedNoShip = s.packs.filter((p) => p.status === 'packed' && !s.shipments.some((x) => String(x.id) === String(p.shipment_id) && /shipped|delivered/.test(x.status || '')));
  app.innerHTML = `
    ${nav('dispatch')}
    ${deskHow('wms-dispatch')}
    <form id="wms-ship" class="ult-card wms-form">
      <h2>Dispatch</h2>
      <label>Shipment / order
        <select id="order">
          <option value="">Select</option>
          ${ready.map((x) => `<option value="ship:${esc(x.id)}">${esc(x.reference || x.id)} · ${esc(x.status)}</option>`).join('')}
          ${packedNoShip.filter((p) => !ready.some((x) => String(x.id) === String(p.shipment_id))).map((p) => `<option value="pack:${esc(p.id)}">${esc(p.order_no)} · packed</option>`).join('')}
        </select>
      </label>
      <label>Carrier
        <select id="carrier">${CARRIERS.map((c) => `<option>${esc(c)}</option>`).join('')}</select>
      </label>
      <label>Tracking number <input id="tracking" placeholder="Waybill / tracking" /></label>
      <button type="submit" class="ult-btn ult-btn-primary">Dispatch</button>
      <div id="ship-log" class="wms-log"></div>
    </form>
    <div class="ult-card" data-tbl="wms-ships" style="margin-top:12px">
      <h2 style="margin:0 0 10px;font-size:16px">Shipments</h2>
      <div class="ult-table-wrap"><table class="ult-table">
        <thead><tr><th>When</th><th>Ref</th><th>Carrier</th><th>Tracking</th><th>Status</th></tr></thead>
        <tbody>${s.shipments.slice(0, 40).map((x) => `<tr>
          <td>${esc(when(x.created_at || x.ship_date))}</td>
          <td>${esc(x.reference || '')}</td>
          <td>${esc(x.carrier || '')}</td>
          <td>${esc(x.tracking || '')}</td>
          <td>${esc(x.status || '')}</td>
        </tr>`).join('') || '<tr data-dummy="1"><td colspan="5" style="text-align:center">No shipments. Pack an order first.</td></tr>'}</tbody>
      </table></div>
    </div>`;
  bindTable(app.querySelector('[data-tbl="wms-ships"]'), { title: 'Shipments', storageKey: 'wms-ships' });
  document.getElementById('wms-ship').onsubmit = async (e) => {
    e.preventDefault();
    const raw = document.getElementById('order').value;
    const carrier = document.getElementById('carrier').value;
    const tracking = document.getElementById('tracking').value.trim();
    if (!raw) { ackResult(false, 'Pick an order.'); return; }
    if (!(await confirmAction('Dispatch this shipment?', carrier + (tracking ? ' · ' + tracking : '')))) return;
    let ship = null;
    if (raw.startsWith('ship:')) {
      ship = s.shipments.find((x) => String(x.id) === raw.slice(5));
    } else {
      const pack = s.packs.find((p) => String(p.id) === raw.slice(5));
      ship = pack ? s.shipments.find((x) => String(x.id) === String(pack.shipment_id)) : null;
      if (!ship && pack) {
        ship = await saveRow('shipments', SHIP_KEY, {
          sales_order_id: pack.sale_id,
          reference: pack.order_no,
          carrier,
          tracking,
          status: 'shipped',
          source: 'wms',
          added_by: _who.email,
        });
      }
    }
    if (!ship) { ackResult(false, 'Could not find the shipment.'); return; }
    await saveRow('shipments', SHIP_KEY, {
      ...ship,
      carrier,
      tracking,
      status: 'shipped',
      shipped_at: new Date().toISOString(),
      source: ship.source || 'wms',
    });
    await logAct({ type: 'dispatch', order_no: ship.reference, ref: tracking || ship.reference, note: carrier });
    ackResult(true, 'Dispatched. Shipments list is updated.');
    await reload();
  };
}

function paintStock(app, s) {
  const q = new URLSearchParams(location.search).get('q') || '';
  const rows = s.products.filter((p) => qtyOf(p) > 0 || q);
  app.innerHTML = `
    ${nav('stock')}
    ${deskHow('wms-stock')}
    <div class="ult-card" data-tbl="wms-stock">
      <div class="bar" style="margin-bottom:10px">
        <input id="stock-q" value="${esc(q)}" placeholder="Search SKU or name" style="min-width:220px" />
      </div>
      <div class="ult-table-wrap"><table class="ult-table">
        <thead><tr><th>SKU</th><th>Name</th><th>Location</th><th>Qty</th></tr></thead>
        <tbody>${rows.map((p) => `<tr>
          <td>${esc(displaySku(p))}</td>
          <td>${esc(p.name || '')}</td>
          <td>${esc(p.location_name || locName(p.location_code))}</td>
          <td>${qtyOf(p)}</td>
        </tr>`).join('') || '<tr data-dummy="1"><td colspan="4" style="text-align:center">No on-hand qty. Receive stock first — catalogue listings are not stock.</td></tr>'}</tbody>
      </table></div>
    </div>`;
  bindTable(app.querySelector('[data-tbl="wms-stock"]'), { title: 'Stock', storageKey: 'wms-stock' });
  const inp = document.getElementById('stock-q');
  inp.onkeyup = () => {
    const term = inp.value.trim().toLowerCase();
    app.querySelectorAll('tbody tr').forEach((tr) => {
      if (tr.dataset.dummy) return;
      tr.hidden = term && !tr.textContent.toLowerCase().includes(term);
    });
  };
}

function paintXfer(app, s) {
  app.innerHTML = `
    ${nav('xfer')}
    ${deskHow('wms-xfer')}
    ${siloGateHtml('transfers')}
    <div class="wms-split">
      <form id="wms-xfer" class="ult-card wms-form">
        <h2>Transfer</h2>
        <label>SKU <input id="sku" autocomplete="off" placeholder="Scan or type SKU" /></label>
        <label>From ${locSelect('from', OPS_HUB.code)}</label>
        <label>To ${locSelect('to', '')}</label>
        <label>Quantity <input id="qty" type="number" min="1" step="1" value="1" /></label>
        <button type="submit" class="ult-btn ult-btn-primary">Transfer</button>
        <p><a class="ult-btn ult-btn-outline" href="/stock-transfer-form.html">Full transfer form</a></p>
        <div id="xfer-log" class="wms-log"></div>
      </form>
      <div class="ult-card" data-tbl="wms-xfer">
        <h2 style="margin:0 0 10px;font-size:16px">Recent transfers</h2>
        <div class="ult-table-wrap"><table class="ult-table">
          <thead><tr><th>Ref</th><th>From</th><th>To</th><th>Status</th></tr></thead>
          <tbody>${s.transfers.slice(0, 80).map((t) => `<tr>
            <td>${esc(t.reference || '')}</td>
            <td>${esc(locName(t.from_location))}</td>
            <td>${esc(locName(t.to_location))}</td>
            <td>${esc(t.status || '')}</td>
          </tr>`).join('') || '<tr data-dummy="1"><td colspan="4" style="text-align:center">No transfers yet.</td></tr>'}</tbody>
        </table></div>
      </div>
    </div>`;
  bindTable(app.querySelector('[data-tbl="wms-xfer"]'), { title: 'Transfers', storageKey: 'wms-xfer' });
  document.getElementById('wms-xfer').onsubmit = async (e) => {
    e.preventDefault();
    const sku = document.getElementById('sku').value.trim();
    const from = document.getElementById('from').value;
    const to = document.getElementById('to').value;
    const qty = Number(document.getElementById('qty').value || 0);
    const p = s.products.find((x) => skuEq(x, sku));
    if (!p) { ackResult(false, 'Unknown SKU.'); return; }
    if (!(await confirmAction('Post this transfer?', `${qty} × ${p.name}`))) return;
    const ok = await completeTransfer({ product: p, sku, fromCode: from, toCode: to, qty, note: 'WMS transfer' });
    if (ok) { ackResult(true, 'Transfer posted on the Hub book.'); await reload(); }
  };
}

function paintAdj(app, s) {
  app.innerHTML = `
    ${nav('adj')}
    ${deskHow('wms-adj')}
    <div class="wms-split">
      <form id="wms-adj" class="ult-card wms-form">
        <h2>Adjustment</h2>
        <label>SKU <input id="sku" autocomplete="off" /></label>
        <label>Type
          <select id="type">
            <option value="increase">Increase</option>
            <option value="decrease">Decrease</option>
          </select>
        </label>
        <label>Quantity <input id="qty" type="number" min="1" step="1" value="1" /></label>
        <label>Location ${locSelect('loc', OPS_HUB.code)}</label>
        <label>Note <input id="note" placeholder="Damage, found, expiry…" /></label>
        <button type="submit" class="ult-btn ult-btn-primary">Apply</button>
        <p><a class="ult-btn ult-btn-outline" href="/stock-adjustment-form.html">Full adjustment form</a></p>
      </form>
      <div class="ult-card" data-tbl="wms-adj">
        <h2 style="margin:0 0 10px;font-size:16px">Recent adjustments</h2>
        <div class="ult-table-wrap"><table class="ult-table">
          <thead><tr><th>Ref</th><th>Type</th><th>When</th></tr></thead>
          <tbody>${s.adjustments.slice(0, 30).map((a) => `<tr>
            <td>${esc(a.reference || a.reference_no || '')}</td>
            <td>${esc(a.type || a.kind || a.adjustment_type || '')}</td>
            <td>${esc(when(a.created_at || a.date))}</td>
          </tr>`).join('') || '<tr data-dummy="1"><td colspan="3" style="text-align:center">No adjustments yet.</td></tr>'}</tbody>
        </table></div>
      </div>
    </div>`;
  bindTable(app.querySelector('[data-tbl="wms-adj"]'), { title: 'Adjustments', storageKey: 'wms-adj' });
  document.getElementById('wms-adj').onsubmit = async (e) => {
    e.preventDefault();
    const sku = document.getElementById('sku').value.trim();
    const type = document.getElementById('type').value;
    const qty = Number(document.getElementById('qty').value || 0);
    const loc = findLocation(document.getElementById('loc').value) || OPS_HUB;
    const note = document.getElementById('note').value.trim();
    const p = s.products.find((x) => skuEq(x, sku));
    if (!p) { ackResult(false, 'Unknown SKU.'); return; }
    if (qty <= 0) { ackResult(false, 'Quantity must be more than 0.'); return; }
    const signed = type === 'decrease' ? -qty : qty;
    const next = Math.max(0, qtyOf(p) + signed);
    if (!(await confirmAction('Post this adjustment?', `${type} ${qty} × ${p.name}`))) return;
    const ref = 'ADJ-' + Date.now().toString(36).toUpperCase();
    await saveRow('stock_adjustments', ADJ_KEY, {
      reference: ref,
      date: new Date().toISOString().slice(0, 10),
      location_code: loc.code,
      location_name: loc.name,
      type: 'wms_' + type,
      kind: 'abnormal',
      lines: [{ product_id: p.id, sku: p.sku, name: p.name, qty: signed, system: qtyOf(p), counted: next }],
      note: note || 'WMS floor adjustment',
      added_by: _who.email,
      source: 'wms',
    });
    patchLocalQty(p, next, loc);
    try { await peelWrite('products', { current_stock: next, stock: next, current_stock_value: next }, { id: p.id }); } catch { /* local */ }
    appendMovements([{
      id: uid(), product_id: p.id, created_at: new Date().toISOString(),
      type: 'adjust', qty: signed, sku_before: p.sku, sku_after: p.sku,
      from_location: loc.code, to_location: loc.code, location_name: loc.name,
      reference: ref, note: note || type,
    }]);
    await logAct({ type: 'adjust', sku: p.sku, product_id: p.id, qty: signed, to_location: loc.code, ref, note });
    ackResult(true, 'Adjustment posted on the Hub book.');
    await reload();
  };
}

function paintCount(app, s) {
  const loc = new URLSearchParams(location.search).get('loc') || OPS_HUB.code;
  const atLoc = s.products.filter((p) => !loc || String(p.location_code || OPS_HUB.code) === loc);
  app.innerHTML = `
    ${nav('count')}
    ${deskHow('wms-count')}
    <form id="wms-count" class="ult-card">
      <div class="wms-form" style="max-width:320px;margin-bottom:12px">
        <label>Location ${locSelect('loc', loc)}</label>
      </div>
      <div class="ult-table-wrap"><table class="ult-table">
        <thead><tr><th>SKU</th><th>Name</th><th>System qty</th><th>Counted</th></tr></thead>
        <tbody>${atLoc.slice(0, 200).map((p) => `<tr>
          <td>${esc(displaySku(p))}</td>
          <td>${esc(p.name || '')}</td>
          <td>${qtyOf(p)}</td>
          <td><input name="c-${esc(p.id)}" type="number" min="0" step="1" placeholder="—" style="width:90px" /></td>
        </tr>`).join('') || '<tr data-dummy="1"><td colspan="4" style="text-align:center">No catalogue at this location.</td></tr>'}</tbody>
      </table></div>
      <p style="margin-top:12px"><button type="submit" class="ult-btn ult-btn-primary">Submit count</button>
      <a class="ult-btn ult-btn-outline" href="/stock-count.html">Office stock count</a></p>
    </form>`;
  document.getElementById('loc').onchange = () => {
    const next = document.getElementById('loc').value;
    history.replaceState({ spa: FILE + '?tab=count&loc=' + encodeURIComponent(next) }, '', FILE + '?tab=count&loc=' + encodeURIComponent(next));
    paint();
  };
  document.getElementById('wms-count').onsubmit = async (e) => {
    e.preventDefault();
    const fd = new FormData(e.target);
    const dest = findLocation(document.getElementById('loc').value) || OPS_HUB;
    const lines = [];
    for (const p of atLoc) {
      const raw = fd.get('c-' + p.id);
      if (raw === null || raw === '') continue;
      const counted = Number(raw);
      const sys = qtyOf(p);
      const diff = counted - sys;
      if (!diff) continue;
      lines.push({ product_id: p.id, sku: p.sku, name: p.name, system: sys, counted, diff });
    }
    if (!lines.length) { ackResult(false, 'Enter at least one counted quantity that differs.'); return; }
    if (!(await confirmAction('Post this count as a stock adjustment?', lines.length + ' SKU(s).'))) return;
    const ref = 'CNT-' + Date.now().toString(36).toUpperCase();
    await saveRow('stock_adjustments', ADJ_KEY, {
      reference: ref,
      date: new Date().toISOString().slice(0, 10),
      location_code: dest.code,
      location_name: dest.name,
      type: 'stock_count',
      kind: 'normal',
      lines,
      note: 'WMS physical count / audit',
      source: 'wms',
      added_by: _who.email,
    });
    const products = readLs(KEYS.products, []) || [];
    for (const l of lines) {
      const p = products.find((x) => String(x.id) === String(l.product_id));
      if (p) patchLocalQty(p, l.counted, dest);
      try { await peelWrite('products', { current_stock: l.counted, stock: l.counted, current_stock_value: l.counted }, { id: l.product_id }); } catch { /* local */ }
    }
    appendMovements(lines.map((l) => ({
      id: uid(), product_id: l.product_id, created_at: new Date().toISOString(),
      type: 'count', qty: l.diff, sku_before: l.sku, sku_after: l.sku,
      to_location: dest.code, location_name: dest.name, reference: ref, note: 'Physical count',
    })));
    await logAct({ type: 'count', ref, to_location: dest.code, qty: lines.length, note: lines.length + ' SKU(s)' });
    ackResult(true, 'Count posted. Hub adjustments list is updated.');
    await reload();
  };
}

function stopScan() {
  try { _scanStream?.getTracks?.().forEach((t) => t.stop()); } catch { /* ignore */ }
  _scanStream = null;
}

function paintScan(app, s) {
  const supported = typeof window.BarcodeDetector === 'function';
  app.innerHTML = `
    ${nav('scan')}
    ${deskHow('wms-scan')}
    <div class="wms-split">
      <form id="wms-scan" class="ult-card wms-form">
        <h2>Scan item</h2>
        <label>Code <input id="code" autocomplete="off" placeholder="Focus here and scan" /></label>
        <div id="scan-result" class="wms-log"></div>
        <div class="wms-scan-actions">
          <button type="submit" class="ult-btn ult-btn-primary">Look up</button>
          <button type="button" class="ult-btn" data-send="recv">Send to Receiving</button>
          <button type="button" class="ult-btn" data-send="pick">Send to Picking</button>
          <button type="button" class="ult-btn" data-send="stock">Open Stock</button>
        </div>
      </form>
      <div class="ult-card">
        <h2 style="margin:0 0 10px;font-size:16px">Camera</h2>
        ${supported
          ? `<video id="camera" class="scan-video" playsinline></video>
             <p><button type="button" class="ult-btn" id="cam-start">Start camera</button>
             <button type="button" class="ult-btn ult-btn-outline" id="cam-stop">Stop</button></p>`
          : '<p class="ult-muted">This device has no camera barcode reader. Use a USB or Bluetooth scanner in the code box — it types the SKU and presses Enter.</p>'}
      </div>
    </div>`;
  const show = (code) => {
    const p = s.products.find((x) => skuEq(x, code));
    const el = document.getElementById('scan-result');
    document.getElementById('code').value = code;
    if (!p) {
      el.innerHTML = `<strong>${esc(code)}</strong><div class="ult-muted">Unknown SKU. Add the product first.</div>`;
      return;
    }
    el.innerHTML = `<strong>${esc(displaySku(p))}</strong> · ${esc(p.name || '')}
      <div>${qtyOf(p)} on hand at ${esc(p.location_name || locName(p.location_code))}</div>`;
  };
  const form = document.getElementById('wms-scan');
  form.onsubmit = (e) => {
    e.preventDefault();
    const code = document.getElementById('code').value.trim();
    if (code) show(code);
  };
  document.getElementById('code').addEventListener('keydown', (e) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      const code = e.target.value.trim();
      if (code) show(code);
    }
  });
  app.querySelectorAll('[data-send]').forEach((b) => {
    b.onclick = () => {
      const code = document.getElementById('code').value.trim();
      if (!code) { ackResult(false, 'Scan a code first.'); return; }
      const dest = b.dataset.send;
      if (dest === 'recv') {
        history.pushState({ spa: FILE + '?tab=recv&sku=' + encodeURIComponent(code) }, '', FILE + '?tab=recv&sku=' + encodeURIComponent(code));
        paint();
      } else if (dest === 'pick') go('pick');
      else {
        history.pushState({ spa: FILE + '?tab=stock&q=' + encodeURIComponent(code) }, '', FILE + '?tab=stock&q=' + encodeURIComponent(code));
        paint();
      }
    };
  });
  document.getElementById('cam-start')?.addEventListener('click', async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment' } });
      _scanStream = stream;
      const video = document.getElementById('camera');
      video.srcObject = stream;
      await video.play();
      const det = new window.BarcodeDetector({ formats: ['code_128', 'ean_13', 'ean_8', 'qr_code', 'upc_a', 'upc_e'] });
      const tick = async () => {
        if (!_scanStream) return;
        try {
          const marks = await det.detect(video);
          if (marks?.[0]?.rawValue) show(marks[0].rawValue);
        } catch { /* keep scanning */ }
        if (_scanStream) requestAnimationFrame(tick);
      };
      requestAnimationFrame(tick);
    } catch (err) {
      ackResult(false, 'Camera unavailable. Use a USB scanner.');
    }
  });
  document.getElementById('cam-stop')?.addEventListener('click', stopScan);
}

async function paintBank(app) {
  await ensureBankBooks();
  const rows = opsActivity({ from: '2026-06-01', to: '2026-09-08' });
  function ymd(iso) {
    const m = String(iso || '').match(/^(\d{4})-(\d{2})-(\d{2})/);
    return m ? `${m[3]}/${m[2]}/${m[1]}` : String(iso || '');
  }
  app.innerHTML = `${nav('bank')}
    <div class="acc-top"><div>
      <h1>Bank Activity</h1>
      <p class="sub">Inventory, rent, imprest and bank charges from Fiberk UBA · ${rows.length} lines</p>
    </div></div>
    <div class="ult-card">
      <div class="ult-table-wrap"><table class="ult-table">
        <thead><tr><th>Date</th><th>Description</th><th>Category</th><th>Amount</th><th>Warehouse</th><th>Linked</th></tr></thead>
        <tbody>${rows.map((r) => `<tr>
          <td>${esc(ymd(r.date))}</td>
          <td>${esc(r.description)}</td>
          <td>${esc(catLabel(r.category))}</td>
          <td class="num">${(r.debit || r.credit) ? Number(r.debit || r.credit).toLocaleString('en-GH', { minimumFractionDigits: 2 }) : ''}</td>
          <td>${esc(r.warehouse || '—')}</td>
          <td>${esc(r.linked || '—')}</td>
        </tr>`).join('') || '<tr><td colspan="6">No operational bank lines.</td></tr>'}</tbody>
      </table></div>
    </div>`;
}

async function paint() {
  const app = document.getElementById('app');
  if (!app) return;
  const s = _cache || await loadState();
  const on = tab();
  document.body.classList.add('wms-hub');
  if (tryPaintFloor(app, on, { brand: BRAND, file: FILE, go: (k) => { _cache = s; go(k); } })) return;
  if (maybePaintNest(app, on, { brand: BRAND, tabs: TABS, brandKey: 'floor', file: FILE, go: (k) => { _cache = s; go(k); } })) return;
  if (on === 'recv') paintRecv(app, s);
  else if (on === 'putaway') paintPutaway(app, s);
  else if (on === 'pick') paintPick(app, s);
  else if (on === 'pack') paintPack(app, s);
  else if (on === 'dispatch') paintDispatch(app, s);
  else if (on === 'stock') paintStock(app, s);
  else if (on === 'xfer') paintXfer(app, s);
  else if (on === 'adj') paintAdj(app, s);
  else if (on === 'count') paintCount(app, s);
  else if (on === 'scan') paintScan(app, s);
  else if (on === 'bank') await paintBank(app);
  else paintFloor(app, s);
  bindHubTabs(app, (k) => { _cache = s; go(k); });
}

async function reload() {
  _cache = null;
  await loadState();
  await paint();
}

export async function bootWmsHub(session) {
  onHubNavigate(paint);
  const auth = session || await getAuthSession().catch(() => null);
  _who = {
    email: auth?.user?.email || auth?.profile?.email || '',
    name: auth?.profile?.full_name || auth?.user?.email || 'Staff',
  };
  document.body.classList.add('wms-hub');
  await loadState();
  await paint();
  window.addEventListener('popstate', () => paint());
  window.addEventListener('pagehide', stopScan);
}
