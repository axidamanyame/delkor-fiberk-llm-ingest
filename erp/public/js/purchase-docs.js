/** Purchases + purchase returns — Delkor-Fiberk ERP fields, dual-table, scope stamp. */
import { supabase, fmt } from './supabaseClient.js';
import { stampScope, subsidiarySelect, locationSelect, subsidiaryLabel } from './entity-scope.js';
import { confirmAction, ackResult } from './confirm-action.js';
import { filterBySidebar, locationSupportsAgents, getActiveAgent, OPS_HUB, BUSINESS_LOCATIONS, findLocation, isDirectStore } from './scope.js';
import { inferSubsidiary } from './org-chain.js';
import { deskHow } from './desk-manual.js';
import { parsePurchaseInvoice, aiButtonHtml } from './ai-assist.js';
import { peelWrite } from './account-rules.js';
import { appendMovements, canReceiveNewStock } from './sku-lifecycle.js';
import { uid, readLs, writeLs, saveRow, mergeRows } from './ls-rows.js';
import { findPurchaseLocal, applyPurchasePayment, ensureOpeningPurchaseDues } from './opening-dues.js';
import { applyStockUbaToFranko } from './stock-uba-match.js';
import { hydrateJuneLedgerPays, applyAug7CreditorLumps } from './june-ledger-import.js';
import { hydrateLedgerTransfers } from './june-ledger-transfers.js';
import { settleSuppliersFromEasybuyMomo } from './settle-supplier-momo.js';
import { syncReceiptsAndHr } from './receipts-hr-sync.js';
import { syncLiveAccounting } from './acc-sync-live.js';
import { ensureFiberkPurchases } from './fiberk-purchases.js';
import { hydrateRabiAtHub } from './rabi-hub-receive.js';
import { hydrateFrankoMadinaAug } from './franko-madina-aug.js';
import { attachImeiToInvoices } from './imei-assign.js';
import { promoteLinesToInventory } from './inventory-book.js';

/** datetime-local needs yyyy-MM-ddThh:mm — date-only values like 2026-04-04 throw a console warning. */
export function toDatetimeLocal(v) {
  const raw = String(v || '').trim();
  if (!raw) return '';
  if (/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}/.test(raw)) return raw.slice(0, 16);
  if (/^\d{4}-\d{2}-\d{2}$/.test(raw)) return raw + 'T00:00';
  const d = new Date(raw);
  if (Number.isNaN(+d)) return '';
  const p = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}T${p(d.getHours())}:${p(d.getMinutes())}`;
}

export function esc(s) {
  return String(s ?? '').replace(/[&<>"']/g, (ch) => {
    if (ch === '&') return '&' + 'amp;';
    if (ch === '<') return '&' + 'lt;';
    if (ch === '>') return '&' + 'gt;';
    if (ch === '"') return '&' + 'quot;';
    return '&' + '#39;';
  });
}

export function normalizePurchase(r, table) {
  const grand = Number(r.grand_total ?? r.total_amount ?? r.total ?? 0);
  const paid = Number(r.amount_paid ?? r.paid ?? 0);
  const due = Number(r.payment_due ?? (grand - paid));
  return {
    ...r,
    _table: table,
    date: toDatetimeLocal(r.date || r.order_date || r.purchase_date || r.created_at || ''),
    reference: r.reference_no || r.reference || r.ref || r.po_number || '',
    supplier_name: r.supplier_name || r.supplier || '',
    status: String(r.status || r.purchase_status || 'received').toLowerCase(),
    payment_status: String(r.payment_status || (paid >= grand && grand > 0 ? 'paid' : paid > 0 ? 'partial' : 'due')).toLowerCase(),
    grand_total: grand,
    amount_paid: paid,
    payment_due: due,
    return_due: Number(r.return_due || 0),
    added_by: r.added_by || r.created_by_name || r.created_by || r.cashier_email || '',
    lines: r.lines || r.items || [],
  };
}

export async function loadPurchases() {
  try { await ensureFiberkPurchases(); } catch { /* json book */ }
  try { hydrateRabiAtHub(); } catch { /* whatsapp quote */ }
  try { hydrateFrankoMadinaAug(); } catch { /* franko aug */ }
  try { attachImeiToInvoices(); } catch { /* imei */ }
  try { ensureOpeningPurchaseDues(); } catch { /* dues */ }
  try { await applyStockUbaToFranko(); } catch { /* uba */ }
  try { hydrateJuneLedgerPays(); } catch { /* june ledger */ }
  try { hydrateLedgerTransfers(); } catch { /* ledger xfer */ }
  try { await applyAug7CreditorLumps(); } catch { /* aug7 */ }
  try { await settleSuppliersFromEasybuyMomo(); } catch { /* momo settle */ }
  try { syncReceiptsAndHr(); } catch { /* receipts hr */ }
  try { syncLiveAccounting(); } catch { /* gl */ }
  const local = () => [
    ...readLs('df_purchases', []),
    ...readLs('df_purchase_orders', []),
    ...readLs('df_fiberk_purchases', []),
  ].map((r) => normalizePurchase(r, r._table || 'purchases'));
  const loc = local();
  if (loc.filter((r) => r.source === 'fiberkapp').length >= 50) {
    return mergeRows([loc]);
  }
  const out = [];
  for (const t of ['purchases', 'purchase_orders']) {
    try {
      let q = await Promise.race([
        supabase.from(t).select('*').limit(500),
        new Promise((resolve) => setTimeout(() => resolve({ data: null, error: { message: 'timeout' } }), 6000)),
      ]);
      if (q.error) {
        q = await supabase.from(t)
          .select('id,supplier_name,supplier_id,reference,reference_no,status,payment_status,grand_total,total_amount,amount_paid,payment_due,date,order_date,location_code,subsidiary_code,added_by,created_at,lines,note')
          .limit(500);
      }
      if (q.error) continue;
      (q.data || []).forEach((r) => out.push(normalizePurchase(r, t)));
    } catch { /* table missing */ }
  }
  const merged = mergeRows([out, loc]);
  try { localStorage.setItem('df_purchases', JSON.stringify(merged.slice(0, 400))); } catch { /* ignore */ }
  return merged;
}

function mapPo(body) {
  return {
    supplier_id: body.supplier_id || null,
    supplier_name: body.supplier_name,
    reference: body.reference_no || body.reference,
    order_date: body.date || body.order_date,
    status: body.status,
    payment_status: body.payment_status,
    total_amount: body.grand_total ?? body.total_amount,
    amount_paid: body.amount_paid,
    notes: body.note || body.notes,
    lines: body.lines,
    subsidiary_code: body.subsidiary_code,
    location_code: body.location_code,
    agent_id: body.agent_id || null,
  };
}

export async function savePurchase(body, { id, table } = {}) {
  const t = table || 'purchases';
  let q = await peelWrite(t, body, { id });
  if (q.error) q = await peelWrite('purchase_orders', mapPo(body), { id: table === 'purchase_orders' ? id : undefined });
  try {
    promoteLinesToInventory(body.lines || body.items || [], {
      status: body.status,
      source: table || 'purchases',
      ref: body.reference_no || body.reference || '',
      location: body.location_code || '',
      note: 'Saved purchase',
    });
  } catch { /* local book */ }
  return q;
}

function cedi(n) {
  const v = Number(n || 0);
  return '¢ ' + v.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function mdY(s) {
  const t = String(s || '').replace('T', ' ');
  const m = t.match(/^(\d{4})-(\d{2})-(\d{2})(?:[ T](\d{2}):(\d{2}))?/);
  if (!m) return t.slice(0, 16);
  return m[4] ? `${m[2]}/${m[3]}/${m[1]} ${m[4]}:${m[5]}` : `${m[2]}/${m[3]}/${m[1]}`;
}

const BIZ = {
  'FIBERK EASYBUY': { addr: 'DIRECTLY OPPOSITE STARBITE / SHELL FILLING STATION', city: 'ASHALEY BOTWE,GREATER ACCRA,GHANA', mobile: '0244226529' },
  'FIBERK SHOP': { addr: 'ACCRA', city: 'GREATER ACCRA,GHANA', mobile: '0244226529' },
  'PHONE STOCKS': { addr: 'ACCRA', city: 'GREATER ACCRA,GHANA', mobile: '0244226529' },
};

function bizOf(row) {
  const key = String(row.legacy_location || row.location_name || '').toUpperCase();
  const hit = BIZ[key] || (key.startsWith('EASYBUY') ? BIZ['FIBERK EASYBUY'] : BIZ['PHONE STOCKS']);
  return hit;
}

function payLabel(row) {
  const raw = String(row.payment_status || '').toLowerCase();
  if (raw === 'paid') return 'Paid';
  if (raw === 'partial' || raw === 'partial overdue') return 'Partial';
  return 'Due';
}

export function paintPurchaseDetails(app, row, { suppliers = [] } = {}) {
  const sup = suppliers.find((s) => String(s.id) === String(row.supplier_id)) || {};
  const supName = row.supplier_name || sup.name || '';
  const supAddr = sup.address || row.supplier_address || '';
  const supMob = sup.mobile || sup.phone || row.supplier_mobile || '';
  const biz = bizOf(row);
  const lines = row.lines || row.items || [];
  const pays = row.payments || [];
  const net = Number(row.grand_total || row.total_amount || 0);
  const disc = Number(row.discount_amount || 0);
  const tax = Number(row.tax_amount || 0);
  const ship = Number(row.shipping_charges || 0);
  const st = String(row.status || 'received');
  const ps = payLabel(row);
  app.innerHTML = `
    <div class="po-view">
      <header class="po-view-head">
        <h1>Purchase Details (Reference No: #${esc(row.reference || row.reference_no || '')})</h1>
        <button type="button" class="po-x" data-close title="Close">×</button>
      </header>
      <div class="po-meta">
        <div>
          <div class="po-k">Supplier:</div>
          <div>${esc(supName)}${supName && !supName.endsWith(',') ? ',' : ''}</div>
          <div>${esc(supAddr)}</div>
          ${supMob ? `<div>Mobile: ${esc(supMob)}</div>` : ''}
        </div>
        <div>
          <div class="po-k">Business:</div>
          <div><b>${esc(subsidiaryLabel(inferSubsidiary(row) || row.subsidiary_code) === '—' ? 'Fiberk' : subsidiaryLabel(inferSubsidiary(row) || row.subsidiary_code))}</b></div>
          <div>${esc(row.location_name || findLocation(row.location_code)?.name || '')}</div>
          <div>${esc(biz.addr)}</div>
          <div>${esc(biz.city)}</div>
          <div>Mobile: ${esc(biz.mobile)}</div>
        </div>
        <div class="po-right">
          <div><b>Reference No:</b> #${esc(row.reference || '')}</div>
          <div><b>Date:</b> ${esc(mdY(row.date).slice(0, 10))}</div>
          <div><b>Purchase Status:</b> ${esc(st.replace(/^./, (c) => c.toUpperCase()))}</div>
          <div><b>Payment Status:</b> ${esc(ps)}</div>
        </div>
        <div class="po-date-top">Date: ${esc(mdY(row.date).slice(0, 10))}</div>
      </div>
      <div class="po-table-wrap">
        <table class="po-lines">
          <thead><tr>
            <th>#</th>
            <th>Product Name</th>
            <th>SKU</th>
            <th>Purchase Quantity</th>
            <th>Unit Cost (Before Discount)</th>
            <th>Discount Percent</th>
            <th>Unit Cost (Before Tax)</th>
            <th>Subtotal (Before Tax)</th>
            <th>Tax</th>
            <th>Unit Cost Price (After Tax)</th>
            <th>Subtotal</th>
          </tr></thead>
          <tbody>${lines.map((l, i) => {
            const qty = Number(l.qty || 0);
            const cost = Number(l.unit_cost || l.unit_price || 0);
            const sub = Number(l.line_total != null ? l.line_total : qty * cost);
            const discP = Number(l.discount || 0);
            const taxN = Number(l.tax || 0);
            return `<tr>
              <td>${i + 1}</td>
              <td>${esc(l.name)}</td>
              <td>${esc(l.sku)}</td>
              <td>${qty.toFixed(2)} Pieces</td>
              <td class="num">${cedi(cost)}</td>
              <td class="num">${discP.toFixed(2)} %</td>
              <td class="num">${cedi(cost)}</td>
              <td class="num">${cedi(sub)}</td>
              <td class="num">${cedi(taxN)}</td>
              <td class="num">${cedi(cost)}</td>
              <td class="num">${cedi(sub)}</td>
            </tr>`;
          }).join('') || `<tr><td colspan="11" style="text-align:center">
            ${net ? `GH₵ ${net.toLocaleString('en-GH')} is on this bill as a catch-up due. Lines were never stored.
            <a href="/purchase-form.html?id=${encodeURIComponent(row.id || '')}">Add the products from the supplier invoice</a>.` : 'No products'}
          </td></tr>`}</tbody>
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
              <td>${esc(p.reference)}</td>
              <td>${cedi(p.amount)}</td>
              <td>${esc(p.method)}</td>
              <td>${esc(p.note === '--' ? '' : (p.note || ''))}</td>
            </tr>`).join('') : `<tr><td colspan="6" class="empty">No payments found</td></tr>`}</tbody>
          </table>
          <div class="po-ship"><b>Shipping Details:</b><div class="po-bar">${esc(row.shipping_details || '')}</div></div>
          <h3>Activities:</h3>
          <table class="po-act">
            <thead><tr><th>Date</th><th>Action</th><th>By</th></tr></thead>
            <tbody><tr>
              <td>${esc(mdY(row.date))}</td>
              <td>Added</td>
              <td>${esc(row.added_by || '')}</td>
            </tr></tbody>
          </table>
        </div>
        <aside>
          <div class="po-tot"><span>Net Total Amount:</span><b>${cedi(net)}</b></div>
          <div class="po-tot"><span>Discount:</span><span>(-) ${cedi(disc)}</span></div>
          <div class="po-tot"><span>Purchase Tax:</span><span>(+) ${cedi(tax)}</span></div>
          <div class="po-tot"><span>Additional Shipping charges:</span><span>(+) ${cedi(ship)}</span></div>
          <div class="po-tot po-grand"><span>Purchase Total:</span><b>${cedi(net)}</b></div>
          <div class="po-notes"><b>Additional Notes:</b><div class="po-bar">${esc(row.note && !/Migrated from Fiberkapp/.test(row.note) ? row.note : '--')}</div></div>
          <div class="po-pills">
            <div><span>Status:</span> <i class="pill recv">${esc(st.replace(/^./, (c) => c.toUpperCase()))}</i></div>
            <div><span>Total:</span> <i class="pill tot">${cedi(net)}</i></div>
            <div><span>Payment Status:</span> <i class="pill ${ps.toLowerCase()}">${esc(ps)}</i></div>
          </div>
        </aside>
      </div>
      <div class="po-actions">
        <button type="button" class="po-print" data-print>Print</button>
        <button type="button" class="po-close" data-close>Close</button>
      </div>
    </div>`;
  app.querySelectorAll('[data-close]').forEach((b) => {
    b.onclick = () => { location.href = '/purchase-orders.html'; };
  });
  app.querySelector('[data-print]')?.addEventListener('click', () => window.print());
}

export async function applyReceivedStock(lines, reverse = false, locCode = OPS_HUB.code) {
  const dest = findLocation(locCode) || OPS_HUB;
  const events = [];
  for (const l of lines || []) {
    if (!l.product_id) continue;
    const qty = Number(l.qty || 0) * (reverse ? -1 : 1);
    if (!qty) continue;
    const { data: p } = await supabase.from('products').select('id,current_stock_value,sku,name').eq('id', l.product_id).maybeSingle();
    if (!p) continue;
    const patch = { current_stock_value: Math.max(0, Number(p.current_stock_value || p.stock || 0) + qty) };
    if (!reverse) {
      patch.location_code = dest.code;
      patch.location_name = dest.name;
      patch.subsidiary_code = dest.subsidiary || (isDirectStore(dest.code) ? 'fiberk' : 'ops');
      patch.warehouse_code = dest.warehouse || dest.code;
    }
    await peelWrite('products', patch, { id: p.id });
    if (!reverse) {
      const direct = isDirectStore(dest.code);
      events.push({
        id: uid(),
        product_id: p.id,
        created_at: new Date().toISOString(),
        type: 'purchase_receive',
        qty: Math.abs(qty),
        sku_before: p.sku || l.sku || '',
        sku_after: p.sku || l.sku || '',
        from_location: '',
        to_location: dest.code,
        location_name: dest.name,
        reference: l.reference || '',
        note: dest.code,
      });
    }
  }
  if (events.length) appendMovements(events);
  if (!reverse) {
    try {
      promoteLinesToInventory(lines, {
        stage: 'on_hand',
        source: 'purchase_receive',
        location: dest.code,
        note: 'Received into inventory',
      });
    } catch { /* book */ }
  }
}

export async function ensureDemoPurchases() {
  return loadPurchases();
}

function lineNet(l) {
  const qty = Number(l.qty || 0);
  const before = Number(l.unit_cost || 0);
  const disc = Number(l.discount || 0);
  const after = before * (1 - disc / 100);
  const tax = after * (Number(l.tax_rate || 0) / 100);
  const sell = Number(l.selling_price || 0);
  const margin = after > 0 ? ((sell - after) / after) * 100 : 0;
  return { qty, before, after, tax, sell, margin, line: (after + tax) * qty };
}

export async function mountPurchaseForm() {
  const app = document.getElementById('app');
  const id = new URLSearchParams(location.search).get('id');
  const payOnly = new URLSearchParams(location.search).get('pay') === '1';
  const viewOnly = new URLSearchParams(location.search).get('view') === '1';
  const now = new Date();
  const pad = (n) => String(n).padStart(2, '0');
  const stamp = `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}T${pad(now.getHours())}:${pad(now.getMinutes())}`;
  let row = {
    status: 'received',
    payment_status: 'due',
    date: stamp,
    lines: [],
    discount_type: 'percentage',
    discount_amount: 0,
    tax_rate: 0,
    shipping_charges: 0,
    pay_amount: 0,
    pay_method: 'cash',
    extra_exp: [{ name: '', amount: 0 }, { name: '', amount: 0 }],
  };
  let srcTable = 'purchases';
  try {
    if (id) await ensureFiberkPurchases();
  } catch { /* local book */ }
  if (id) {
    const local = findPurchaseLocal(id);
    if (local) {
      row = { ...row, ...normalizePurchase(local, local._table || 'purchases'), extra_exp: local.extra_exp || row.extra_exp, payments: local.payments || [], added_by: local.added_by, location_name: local.location_name, legacy_location: local.legacy_location, supplier_id: local.supplier_id };
      srcTable = local._table || 'purchases';
    }
    if (!row.id || String(row.id) !== String(id)) {
      for (const t of ['purchases', 'purchase_orders']) {
        const { data } = await supabase.from(t).select('*').eq('id', id).maybeSingle();
        if (data) {
          row = { ...row, ...normalizePurchase(data, t), extra_exp: data.extra_exp || row.extra_exp };
          srcTable = t;
          break;
        }
      }
    }
    if (payOnly) row.pay_amount = 0;
    const packed = (row.lines || []).length;
    const hpBook = /PO-HP-FRANKO|hp-field|easybuy/i.test(`${row.reference || ''} ${row.source || ''}`);
    if (hpBook && packed > 12) {
      const qty = (row.lines || []).reduce((s, l) => s + Number(l.qty || 0), 0);
      row.lines = [{
        product_id: 'hp-book',
        sku: 'HP-BOOK',
        name: `${qty || packed} EasyBuy units — individual contracts on Field Ops → Order List`,
        qty: qty || packed,
        unit_cost: 0,
        discount: 0,
        tax_rate: 0,
        selling_price: 0,
      }];
      row._easybuy_book = packed;
    }
  }
  const wantPrint = new URLSearchParams(location.search).get('print') === '1';
  if (id && (viewOnly || wantPrint)) {
    const lsSups = readLs('df_suppliers', []);
    paintPurchaseDetails(app, row, { suppliers: lsSups });
    if (wantPrint) setTimeout(() => window.print(), 250);
    return;
  }
  const [{ data: suppliers }, { data: products }, { data: accounts }] = await Promise.all([
    supabase.from('suppliers').select('id,name,phone,pay_term,subsidiary_code,location_code').order('name').limit(800),
    supabase.from('products').select('id,name,sku,cost_price,selling_price,tax_name,unit,subsidiary_code,location_code').order('name').limit(800),
    supabase.from('payment_accounts').select('id,name,code').limit(80),
  ]);
  if (id) {
    const inferred = inferSubsidiary(row);
    if (inferred) row.subsidiary_code = inferred;
  }
  const lsSups = readLs('df_suppliers', []);
  const sups = mergeRows([lsSups, suppliers || []]);
  if (row.supplier_id && !sups.some((s) => String(s.id) === String(row.supplier_id))) {
    sups.unshift({ id: row.supplier_id, name: row.supplier_name || row.supplier || 'Supplier' });
  }
  const cats = products || [];
  let showExp = false;
  let showImport = false;

  function totals() {
    const items = row.lines.reduce((s, l) => s + Number(l.qty || 0), 0);
    const net = row.lines.reduce((s, l) => s + lineNet(l).after * Number(l.qty || 0), 0);
    const lineTax = row.lines.reduce((s, l) => s + lineNet(l).tax * Number(l.qty || 0), 0);
    const disc = row.discount_type === 'fixed'
      ? Number(row.discount_amount || 0)
      : net * (Number(row.discount_amount || 0) / 100);
    const taxed = Math.max(0, net - disc);
    const tax = taxed * (Number(row.tax_rate || 0) / 100) + lineTax;
    const ship = Number(row.shipping_charges || 0);
    const extra = (row.extra_exp || []).reduce((s, e) => s + Number(e.amount || 0), 0);
    const payable = taxed + tax + ship + extra;
    const paid = Number(row.pay_amount || 0);
    return { items, net, disc, tax, ship, extra, payable, paid, due: Math.max(0, payable - paid) };
  }

  function paint() {
    const t = totals();
    const sup = sups.find((s) => String(s.id) === String(row.supplier_id));
    app.innerHTML = `
      <h1 style="margin:0 0 6px;font-size:22px;color:#111">${id ? 'Edit Purchase' : 'Add Purchase'}</h1>
      ${deskHow('purch-edit')}
      ${id ? `<p style="margin:0 0 14px;font-weight:700;color:#0f172a">${esc(row.reference || row.reference_no || id)}
        · ${esc(row.supplier_name || sup?.name || '—')}
        · ${esc(String(row.date || '').slice(0, 10) || '—')}
        · ${fmt(row.grand_total || t.payable || 0)}</p>` : ''}
      ${row._easybuy_book ? `<p style="margin:-8px 0 14px"><a class="ult-btn ult-btn-outline" href="/field-ops.html?tab=orders">Open Order List</a></p>` : ''}
      <form id="f">
        <div class="sell-card">
          <div class="sell-grid">
            ${subsidiarySelect(inferSubsidiary(row) || row.subsidiary_code || '')}
            <label class="fld">Receive into:*
              <select name="location_code" required>
                ${[OPS_HUB, ...BUSINESS_LOCATIONS].filter((l, i, a) => a.findIndex((x) => x.code === l.code) === i).map((l) =>
                  `<option value="${esc(l.code)}" ${String(row.location_code || '') === l.code ? 'selected' : ''}>${esc(l.name)}</option>`
                ).join('')}
              </select>
            </label>
            <label class="fld">Supplier:*
              <span style="display:flex;gap:6px">
                <select name="supplier_id" required style="flex:1">
                  <option value="">Please Select</option>
                  ${sups.map((s) => `<option value="${s.id}" ${String(s.id)===String(row.supplier_id)?'selected':''}>${esc(s.name)}${s.phone?(' / '+s.phone):''}</option>`).join('')}
                </select>
                <a class="ult-btn ult-btn-outline" href="/supplier-form.html" title="Add supplier">+</a>
              </span>
            </label>
            <label class="fld">Reference No:
              <input name="reference_no" value="${esc(row.reference||row.reference_no||'')}" placeholder="Leave blank to auto generate" />
            </label>
            <label class="fld">Purchase Date:*
              <input name="date" type="datetime-local" required value="${esc(toDatetimeLocal(row.date||stamp))}" />
            </label>
            <label class="fld">Purchase Status:*
              <select name="status" required>
                <option value="received" ${row.status==='received'?'selected':''}>Received</option>
                <option value="pending" ${row.status==='pending'?'selected':''}>Pending</option>
                <option value="ordered" ${row.status==='ordered'?'selected':''}>Ordered</option>
              </select>
            </label>
            <label class="fld">Pay term:
              <span style="display:flex;gap:6px">
                <input name="pay_term_number" type="number" value="${esc(row.pay_term_number||'')}" placeholder="Pay term" style="width:40%" />
                <select name="pay_term_type" style="width:60%">
                  <option value="">Please Select</option>
                  <option value="days" ${row.pay_term_type==='days'?'selected':''}>Days</option>
                  <option value="months" ${row.pay_term_type==='months'?'selected':''}>Months</option>
                </select>
              </span>
            </label>
            <label class="fld">Attach Document:
              <input name="document" type="file" accept=".pdf,.csv,.zip,.doc,.docx,.jpeg,.jpg,.png" />
              <small style="font-weight:400">Max 5MB · pdf csv zip doc jpg png</small>
            </label>
          </div>
        </div>

        <div class="sell-card">
          <div class="ult-table-wrap">
            <table class="ult-table dest-table">
              <thead><tr>
                <th>#</th><th>Product</th><th>Purchase Quantity</th><th>Unit Cost (Before Discount)</th>
                <th>Discount Percent</th><th>Unit Cost (After Discount)</th><th>Product Tax</th>
                <th>Profit Margin %</th><th>Unit Selling Price</th><th>Line Total</th>
                <th>Lot Number</th><th>MFG Date</th><th>EXP Date</th><th></th>
              </tr></thead>
              <tbody>${row.lines.map((l, i) => {
                const n = lineNet(l);
                return `<tr>
                  <td>${i + 1}</td>
                  <td>${esc(l.name)}<br><small>${esc(l.sku || '')}</small></td>
                  <td><input data-k="qty" data-i="${i}" type="number" min="0" step="0.01" value="${l.qty || 1}" /></td>
                  <td><input data-k="unit_cost" data-i="${i}" type="number" min="0" step="0.01" value="${l.unit_cost || 0}" /></td>
                  <td><input data-k="discount" data-i="${i}" type="number" min="0" step="0.01" value="${l.discount || 0}" /></td>
                  <td>${fmt(n.after)}</td>
                  <td><input data-k="tax_rate" data-i="${i}" type="number" min="0" step="0.01" value="${l.tax_rate || 0}" /></td>
                  <td>${n.margin.toFixed(2)}</td>
                  <td><input data-k="selling_price" data-i="${i}" type="number" min="0" step="0.01" value="${l.selling_price || 0}" /></td>
                  <td>${fmt(n.line)}</td>
                  <td><input data-t="lot" data-i="${i}" value="${esc(l.lot || '')}" /></td>
                  <td><input data-t="mfg" data-i="${i}" type="date" value="${esc(l.mfg || '')}" /></td>
                  <td><input data-t="exp" data-i="${i}" type="date" value="${esc(l.exp || '')}" /></td>
                  <td><button type="button" data-rm="${i}">×</button></td>
                </tr>`;
              }).join('') || '<tr><td colspan="14" style="text-align:center">No products added</td></tr>'}</tbody>
            </table>
          </div>
          <p style="text-align:right;font-weight:700">Items: ${t.items} &nbsp; Net Total: ${fmt(t.net)}</p>
          <label class="fld" style="max-width:720px;margin:0 auto">Enter Product name / SKU / Scan bar code
            <input id="q" placeholder="Enter Product name / SKU / Scan bar code" autocomplete="off" />
          </label>
          <div id="hits"></div>
          <p style="text-align:center;margin-top:10px">
            <button type="button" id="tog-imp" class="ult-btn ult-btn-outline">Import products</button>
            ${aiButtonHtml('use-ai', 'Use AI')}
          </p>
          <div id="imp" ${showImport ? '' : 'hidden'} style="margin-top:10px">
            <p style="font-weight:600">CSV order: SKU, Purchase Quantity, Unit Cost (Before Discount), Discount Percent, Product Tax, Lot Number, MFG Date, EXP Date</p>
            <input id="imp-file" type="file" accept=".csv,.txt" />
            <p><a href="#" id="imp-tpl">Download template file</a></p>
          </div>
        </div>

        <div class="sell-card">
          <div class="sell-grid">
            <label class="fld">Discount Type:*
              <select name="discount_type">
                <option value="percentage" ${row.discount_type!=='fixed'?'selected':''}>Percentage</option>
                <option value="fixed" ${row.discount_type==='fixed'?'selected':''}>Fixed</option>
              </select>
            </label>
            <label class="fld">Discount Amount:*
              <input name="discount_amount" type="number" step="0.01" value="${row.discount_amount || 0}" />
            </label>
            <p><b>Discount:</b> (−) ${fmt(t.disc)}</p>
            <label class="fld">Purchase Tax:*
              <select name="tax_rate">
                <option value="0">None</option>
                <option value="10" ${Number(row.tax_rate)===10?'selected':''}>VAT@10%</option>
                <option value="18" ${Number(row.tax_rate)===18?'selected':''}>GST@18%</option>
              </select>
            </label>
            <p><b>Purchase Tax:</b> (+) ${fmt(t.tax)}</p>
            <label class="fld">Additional Notes
              <textarea name="note" rows="3">${esc(row.note || row.notes || '')}</textarea>
            </label>
            <label class="fld">Shipping Details
              <textarea name="shipping_details" rows="3">${esc(row.shipping_details || '')}</textarea>
            </label>
            <label class="fld">Shipping Charges
              <input name="shipping_charges" type="number" step="0.01" value="${row.shipping_charges || 0}" />
            </label>
          </div>
          <p style="text-align:center;margin:12px 0">
            <button type="button" id="tog-exp" class="ult-btn ult-btn-primary">+ Add additional expenses</button>
          </p>
          <div id="exp" ${showExp ? '' : 'hidden'}>
            <table class="ult-table"><thead><tr><th>Additional expense name</th><th>Amount</th></tr></thead>
            <tbody>${row.extra_exp.map((e, i) => `<tr>
              <td><input data-en="${i}" value="${esc(e.name || '')}" /></td>
              <td><input data-ea="${i}" type="number" step="0.01" value="${e.amount || 0}" /></td>
            </tr>`).join('')}</tbody></table>
          </div>
          <p style="text-align:right;font-size:16px"><b>Grand Total:</b> ${fmt(t.payable)}</p>
        </div>

        <div class="sell-card">
          <h3 style="margin:0 0 12px">Add payment</h3>
          <div class="sell-grid">
            <label class="fld">Amount:*<input name="pay_amount" type="number" step="0.01" value="${row.pay_amount || 0}" /></label>
            <label class="fld">Paid on:*<input name="paid_on" type="datetime-local" value="${esc(toDatetimeLocal(row.paid_on || stamp))}" /></label>
            <label class="fld">Payment Method:*
              <select name="pay_method">
                ${['cash','card','cheque','bank_transfer','momo','other'].map((m) => `<option value="${m}" ${row.pay_method===m?'selected':''}>${m.replace('_',' ')}</option>`).join('')}
              </select>
            </label>
            <label class="fld">Paid from:
              <select name="pay_account">
                <option value="">None</option>
                ${(accounts||[]).map((a)=>`<option value="${a.id}" ${row.pay_account===a.id?'selected':''}>${esc(a.name||a.code)}</option>`).join('')}
              </select>
            </label>
            <label class="fld" style="grid-column:1/-1">Payment note:<textarea name="pay_note" rows="2">${esc(row.pay_note||'')}</textarea></label>
          </div>
          <p style="text-align:right"><b>Payment due:</b> ${fmt(t.due)} <small>(−ve = amount to receive · +ve = amount to pay)</small></p>
        </div>

        <p style="text-align:center;margin:20px 0">
          <button type="submit" class="ult-btn ult-btn-primary" style="padding:12px 28px;font-size:16px">Save</button>
          <button type="button" id="save-print" class="ult-btn" style="background:#16a34a;color:#fff;padding:12px 28px;font-size:16px;border:0;border-radius:8px">Save and print</button>
        </p>
        <p id="err" style="color:#b91c1c;text-align:center"></p>
      </form>`;
    bind(t);
    if (wantPrint && id) printPurchase(row, t);
  }

  function grabForm() {
    const f = document.getElementById('f');
    if (!f) return;
    const fd = new FormData(f);
    row.supplier_id = fd.get('supplier_id');
    row.reference = fd.get('reference_no');
    row.date = fd.get('date');
    row.status = fd.get('status');
    row.pay_term_number = fd.get('pay_term_number');
    row.pay_term_type = fd.get('pay_term_type');
    row.discount_type = fd.get('discount_type');
    row.discount_amount = Number(fd.get('discount_amount') || 0);
    row.tax_rate = Number(fd.get('tax_rate') || 0);
    row.note = fd.get('note');
    row.shipping_details = fd.get('shipping_details');
    row.shipping_charges = Number(fd.get('shipping_charges') || 0);
    row.pay_amount = Number(fd.get('pay_amount') || 0);
    row.pay_method = fd.get('pay_method');
    row.pay_account = fd.get('pay_account');
    row.pay_note = fd.get('pay_note');
    row.paid_on = fd.get('paid_on');
    row.subsidiary_code = fd.get('subsidiary_code');
    row.location_code = fd.get('location_code');
  }

  function bind() {
    const f = document.getElementById('f');
    ['discount_type','discount_amount','tax_rate','shipping_charges','pay_amount','status','supplier_id'].forEach((n) => {
      f.querySelector(`[name="${n}"]`)?.addEventListener('change', () => { grabForm(); paint(); });
    });
    f.querySelector('[name="subsidiary_code"]')?.addEventListener('change', () => { grabForm(); paint(); });
    document.getElementById('tog-exp').onclick = () => { grabForm(); showExp = !showExp; paint(); };
    document.getElementById('tog-imp').onclick = () => { grabForm(); showImport = !showImport; paint(); };
    app.querySelectorAll('[data-k]').forEach((inp) => {
      inp.onchange = () => { row.lines[+inp.dataset.i][inp.dataset.k] = Number(inp.value || 0); paint(); };
    });
    app.querySelectorAll('[data-t]').forEach((inp) => {
      inp.onchange = () => { row.lines[+inp.dataset.i][inp.dataset.t] = inp.value; };
    });
    app.querySelectorAll('[data-rm]').forEach((b) => {
      b.onclick = () => { row.lines.splice(+b.dataset.rm, 1); paint(); };
    });
    app.querySelectorAll('[data-en]').forEach((inp) => {
      inp.onchange = () => { row.extra_exp[+inp.dataset.en].name = inp.value; };
    });
    app.querySelectorAll('[data-ea]').forEach((inp) => {
      inp.onchange = () => { row.extra_exp[+inp.dataset.ea].amount = Number(inp.value || 0); paint(); };
    });
    const q = document.getElementById('q');
    const hits = document.getElementById('hits');
    q.oninput = () => {
      const term = q.value.trim().toLowerCase();
      if (!term) { hits.innerHTML = ''; return; }
      hits.innerHTML = cats.filter((p) => (p.name + ' ' + (p.sku || '')).toLowerCase().includes(term)).slice(0, 10)
        .map((p) => `<button type="button" class="ult-btn ult-btn-outline" data-add="${p.id}" style="margin:4px">${esc(p.name)} · ${esc(p.sku||'')} · ${fmt(p.cost_price)}</button>`).join('');
    };
    hits.onclick = (e) => {
      const pid = e.target.dataset.add;
      if (!pid) return;
      const p = cats.find((x) => String(x.id) === String(pid));
      if (!p) return;
      row.lines.push({
        product_id: p.id, name: p.name, sku: p.sku, qty: 1,
        unit_cost: Number(p.cost_price || 0), discount: 0, tax_rate: Number(p.tax_rate || 0),
        selling_price: Number(p.selling_price || 0), lot: '', mfg: '', exp: '',
      });
      paint();
    };
    document.getElementById('imp-tpl')?.addEventListener('click', (e) => {
      e.preventDefault();
      const csv = 'SKU,Purchase Quantity,Unit Cost (Before Discount),Discount Percent,Product Tax,Lot Number,MFG Date,EXP Date\nBNP2001,10,1500,0,0,,,';
      const a = document.createElement('a');
      a.href = URL.createObjectURL(new Blob([csv], { type: 'text/csv' }));
      a.download = 'import_purchase_products_template.csv';
      a.click();
    });
    document.getElementById('imp-file')?.addEventListener('change', async (e) => {
      const file = e.target.files?.[0];
      if (!file) return;
      const text = await file.text();
      text.split(/\r?\n/).slice(1).forEach((line) => {
        const [sku, qty, cost, disc, tax, lot, mfg, exp] = line.split(',').map((x) => (x || '').trim());
        if (!sku) return;
        const p = cats.find((x) => String(x.sku || '').toUpperCase() === sku.toUpperCase());
        if (!p) return;
        row.lines.push({
          product_id: p.id, name: p.name, sku: p.sku, qty: Number(qty || 1),
          unit_cost: Number(cost || p.cost_price || 0), discount: Number(disc || 0),
          tax_rate: Number(tax || 0), selling_price: Number(p.selling_price || 0),
          lot, mfg, exp,
        });
      });
      paint();
    });
    document.getElementById('use-ai')?.addEventListener('click', () => {
      const wrap = document.createElement('div');
      wrap.className = 'ai-sheet';
      wrap.innerHTML = `<div class="ai-sheet-card">
        <header><h3>Use AI — Purchase invoice</h3><button type="button" data-x>×</button></header>
        <form class="ai-sheet-body">
          <p style="margin:0 0 8px;font-size:13px;font-weight:400">Paste supplier invoice lines. Format: <b>SKU, quantity, unit cost</b> (CSV) or one SKU per line. Matching products are added to this purchase.</p>
          <textarea name="blob" rows="10" placeholder="BNP2001, 10, 1500&#10;FIB-8821, 4, 220" required></textarea>
          <div class="missing-product-warning"></div>
          <p style="margin:12px 0 0;text-align:right;display:flex;gap:8px;justify-content:flex-end">
            <button type="button" data-x class="ult-btn ult-btn-outline">Close</button>
            <button type="submit" class="ai-btn" style="margin:0">✦ Apply</button>
          </p>
        </form>
      </div>`;
      wrap.querySelectorAll('[data-x]').forEach((b) => b.onclick = () => wrap.remove());
      wrap.addEventListener('click', (e) => { if (e.target === wrap) wrap.remove(); });
      wrap.querySelector('form').onsubmit = (e) => {
        e.preventDefault();
        const { lines, missing } = parsePurchaseInvoice(e.target.blob.value, cats);
        const box = wrap.querySelector('.missing-product-warning');
        if (missing.length) {
          box.className = 'missing-sku';
          box.innerHTML = '<b>Missing SKUs:</b><br>' + missing.map((m) => `Row ${m.row} — ${m.sku}`).join('<br>');
        } else box.innerHTML = '';
        lines.forEach((l) => {
          if (!row.lines.some((x) => String(x.product_id) === String(l.product_id))) row.lines.push(l);
        });
        if (lines.length) { wrap.remove(); paint(); }
      };
      document.body.appendChild(wrap);
    });
    window.onkeydown = (ev) => {
      if (ev.key === 'F4') { ev.preventDefault(); document.getElementById('q')?.focus(); }
    };
    f.onsubmit = (e) => save(e, false);
    document.getElementById('save-print').onclick = () => save({ preventDefault() {}, target: f }, true);
  }

  function printPurchase(r, t) {
    const w = window.open('', '_blank');
    if (!w) return;
    w.document.write(`<!doctype html><title>${esc(r.reference || 'Purchase')}</title>
      <style>body{font-family:Inter,Arial,sans-serif;padding:24px;color:#111}table{width:100%;border-collapse:collapse}th,td{border:1px solid #111;padding:6px;text-align:left}</style>
      <h1>Purchase ${esc(r.reference || '')}</h1>
      <p>${esc(r.supplier_name || '')} · ${esc(String(r.date || '').slice(0, 10))} · ${esc(r.status)}</p>
      <table><thead><tr><th>Product</th><th>Qty</th><th>Cost</th><th>Total</th></tr></thead>
      <tbody>${(r.lines||[]).map((l)=>`<tr><td>${esc(l.name)}</td><td>${l.qty}</td><td>${fmt(l.unit_cost)}</td><td>${fmt(lineNet(l).line)}</td></tr>`).join('')}</tbody></table>
      <p><b>Grand Total ${fmt(t.payable)}</b> · Paid ${fmt(t.paid)} · Due ${fmt(t.due)}</p>`);
    w.document.close();
    w.print();
  }

  async function save(e, printAfter) {
    e.preventDefault();
    grabForm();
    const err = document.getElementById('err');
    err.textContent = '';
    if (!row.lines.length && !row.opening_due && !payOnly) { err.textContent = 'Add at least one product.'; return; }
    if (!(await confirmAction('Save this purchase?', row.opening_due || payOnly ? 'This records a payment against the opening due. Stock is not changed.' : 'These lines join Product Inventory the moment you save, at any order stage. On-hand quantity only moves when status is Received.'))) return;
    const t = totals();
    const sup = sups.find((s) => String(s.id) === String(row.supplier_id));
    if (row.opening_due || payOnly) {
      const add = Number(row.pay_amount || 0);
      const r = await applyPurchasePayment(id || row.id, {
        amount: add,
        method: row.pay_method,
        paid_on: row.paid_on,
        note: row.pay_note,
      });
      if (!r.ok) { err.textContent = r.error; return; }
      if (printAfter) printPurchase({ ...row, ...r.row }, { ...t, paid: r.row.amount_paid, due: r.row.payment_due, payable: r.row.grand_total || r.row.total_amount });
      location.assign('/dashboard.html');
      return;
    }
    const prevStatus = id ? (await (async () => {
      const { data } = await supabase.from(srcTable).select('status').eq('id', id).maybeSingle();
      return String(data?.status || '').toLowerCase();
    })()) : '';
    const body = {
      supplier_id: row.supplier_id || null,
      supplier_name: sup?.name || null,
      reference_no: row.reference || ('PO-' + Date.now().toString().slice(-8)),
      date: String(row.date || '').slice(0, 10),
      status: row.status,
      payment_status: t.due <= 0.001 ? 'paid' : (t.paid > 0 ? 'partial' : 'due'),
      grand_total: t.payable,
      amount_paid: t.paid,
      payment_due: t.due,
      note: row.note || null,
      shipping_details: row.shipping_details || null,
      shipping_charges: t.ship,
      extra_exp: row.extra_exp,
      lines: row.lines,
      pay_method: row.pay_method,
      pay_note: row.pay_note,
      added_by: row.added_by || null,
    };
    try { stampScope(body, document.getElementById('f')); } catch (ex) { err.textContent = ex.message; return; }
    if (!canReceiveNewStock(body.location_code)) {
      err.textContent = 'New stock must be received at Operations Hub, or directly at Fiberk Shop.';
      return;
    }
    if (locationSupportsAgents(body.location_code) && getActiveAgent()) body.agent_id = getActiveAgent();
    const q = await savePurchase(body, { id, table: srcTable });
    if (q.error) { err.textContent = q.error.message; return; }
    try {
      promoteLinesToInventory(row.lines, {
        status: row.status,
        source: 'purchase',
        ref: body.reference_no,
        location: body.location_code,
        note: 'Purchase ' + (row.status || 'ordered'),
      });
    } catch { /* book is local */ }
    if (row.status === 'received' && prevStatus !== 'received') await applyReceivedStock(row.lines, false, body.location_code);
    if (prevStatus === 'received' && row.status !== 'received') await applyReceivedStock(row.lines, true, body.location_code);
    if (printAfter) printPurchase({ ...row, ...body, supplier_name: body.supplier_name, reference: body.reference_no }, t);
    location.assign('/purchase-orders.html');
  }

  paint();
}

export async function mountPurchaseReturnForm() {
  const app = document.getElementById('app');
  const params = new URLSearchParams(location.search);
  const parentId = params.get('purchase');
  const existingId = params.get('id');
  const viewOnly = params.get('view') === '1' || params.get('print') === '1';
  const [{ data: suppliers }, purchases] = await Promise.all([
    supabase.from('suppliers').select('id,name,phone,subsidiary_code,location_code').order('name').limit(800),
    loadPurchases(),
  ]);
  const scopedPurchases = filterBySidebar(purchases);
  const sups = filterBySidebar(suppliers || []);
  let parent = scopedPurchases.find((p) => String(p.id) === String(parentId)) || null;
  let existing = null;
  if (existingId) {
    const local = readLs('df_purchase_returns', []) || [];
    existing = local.find((r) => String(r.id) === String(existingId)) || null;
  }
  if (existing) {
    parent = scopedPurchases.find((p) => String(p.id) === String(existing.parent_purchase_id)) || parent;
  }
  let row = {
    supplier_id: existing?.supplier_id || parent?.supplier_id || '',
    date: existing?.date || new Date().toISOString().slice(0, 16),
    reference_no: existing?.reference_no || existing?.reference || '',
    discount_type: existing?.discount_type || 'percentage',
    discount_amount: existing?.discount_amount || 0,
    tax_rate: existing?.tax_rate || 0,
    notes: existing?.notes || '',
    subsidiary_code: existing?.subsidiary_code || parent?.subsidiary_code || '',
    location_code: existing?.location_code || parent?.location_code || '',
  };
  let lines = existing?.lines
    || (parent?.lines || []).map((l) => ({ ...l, return_qty: 0 }));

  function totals() {
    const net = lines.reduce((s, l) => s + Number(l.return_qty || 0) * Number(l.unit_cost || 0), 0);
    const disc = row.discount_type === 'fixed'
      ? Number(row.discount_amount || 0)
      : net * (Number(row.discount_amount || 0) / 100);
    const taxed = Math.max(0, net - disc);
    const tax = taxed * (Number(row.tax_rate || 0) / 100);
    return { net, disc, tax, payable: taxed + tax };
  }

  function setParent(id) {
    parent = scopedPurchases.find((p) => String(p.id) === String(id)) || null;
    row.supplier_id = parent?.supplier_id || row.supplier_id;
    row.subsidiary_code = parent?.subsidiary_code || row.subsidiary_code;
    row.location_code = parent?.location_code || row.location_code;
    lines = (parent?.lines || []).map((l) => ({ ...l, return_qty: 0 }));
  }

  function paint() {
    const t = totals();
    const bySup = scopedPurchases.filter((p) => !row.supplier_id || String(p.supplier_id) === String(row.supplier_id));
    app.innerHTML = `
      <h1 style="margin:0 0 14px;font-size:22px;color:#111">${viewOnly ? 'Purchase Return' : (existingId ? 'Edit Purchase Return' : 'Add Purchase Return')}</h1>
      <form id="f">
        <div class="sell-card">
          <div class="sell-grid">
            ${subsidiarySelect(row.subsidiary_code || '')}
            ${locationSelect(row.subsidiary_code || '', row.location_code || '')}
            <label class="fld">Supplier:*
              <span style="display:flex;gap:6px">
                <select name="supplier_id" required style="flex:1">
                  <option value="">Please Select</option>
                  ${sups.map((s) => `<option value="${s.id}" ${String(s.id)===String(row.supplier_id)?'selected':''}>${esc(s.name)}${s.phone?(' / '+s.phone):''}</option>`).join('')}
                </select>
                <a class="ult-btn ult-btn-outline" href="/supplier-form.html" title="Add supplier">+</a>
              </span>
            </label>
            <label class="fld">Search Purchase:*
              <select name="parent_id" required>
                <option value="">Please Select</option>
                ${bySup.map((p) => `<option value="${p.id}" ${parent && p.id===parent.id?'selected':''}>${esc(p.reference)} · ${esc(p.supplier_name)} · ${fmt(p.grand_total)}</option>`).join('')}
              </select>
            </label>
            <label class="fld">Date:*
              <input name="date" type="datetime-local" required value="${esc(toDatetimeLocal(row.date||''))}" />
            </label>
            <label class="fld">Reference No:
              <input name="reference_no" value="${esc(row.reference_no)}" placeholder="Leave blank to auto generate" />
            </label>
          </div>
        </div>

        <div class="sell-card">
          <div class="ult-table-wrap">
            <table class="ult-table dest-table">
              <thead><tr>
                <th>#</th><th>Product</th><th>Purchase Quantity</th><th>Unit Cost</th>
                <th>Return Quantity</th><th>Return Subtotal</th>
              </tr></thead>
              <tbody>${lines.map((l, i) => `<tr>
                <td>${i + 1}</td>
                <td>${esc(l.name)}<br><small>${esc(l.sku || '')}</small></td>
                <td>${l.qty || 0}</td>
                <td>${fmt(l.unit_cost)}</td>
                <td><input data-rq="${i}" type="number" min="0" max="${l.qty || 0}" step="0.01" value="${l.return_qty || 0}" /></td>
                <td>${fmt(Number(l.return_qty || 0) * Number(l.unit_cost || 0))}</td>
              </tr>`).join('') || '<tr><td colspan="6" style="text-align:center">Select a parent purchase to load products</td></tr>'}</tbody>
            </table>
          </div>
          <p style="text-align:right;font-weight:700">Net Total: ${fmt(t.net)}</p>
        </div>

        <div class="sell-card">
          <div class="sell-grid">
            <label class="fld">Discount Type:
              <select name="discount_type">
                <option value="percentage" ${row.discount_type!=='fixed'?'selected':''}>Percentage</option>
                <option value="fixed" ${row.discount_type==='fixed'?'selected':''}>Fixed</option>
              </select>
            </label>
            <label class="fld">Discount Amount:
              <input name="discount_amount" type="number" step="0.01" value="${row.discount_amount || 0}" />
            </label>
            <p><b>Discount:</b> (−) ${fmt(t.disc)}</p>
            <label class="fld">Purchase Tax:
              <select name="tax_rate">
                <option value="0">None</option>
                <option value="10" ${Number(row.tax_rate)===10?'selected':''}>VAT@10%</option>
                <option value="18" ${Number(row.tax_rate)===18?'selected':''}>GST@18%</option>
              </select>
            </label>
            <p><b>Purchase Tax:</b> (+) ${fmt(t.tax)}</p>
            <label class="fld" style="grid-column:1/-1">Additional Notes
              <textarea name="notes" rows="3" placeholder="Damaged, excess, wrong item">${esc(row.notes)}</textarea>
            </label>
          </div>
          <p style="text-align:right;font-size:16px"><b>Grand Total:</b> ${fmt(t.payable)}</p>
        </div>

        <p style="text-align:center;margin:20px 0">
          ${viewOnly ? '' : `<button type="submit" class="ult-btn ult-btn-primary" style="padding:12px 28px;font-size:16px">Save</button>
          <button type="button" id="save-print" class="ult-btn" style="background:#16a34a;color:#fff;padding:12px 28px;font-size:16px;border:0;border-radius:8px">Save and print</button>`}
          <a class="ult-btn ult-btn-outline" href="/purchase-returns.html">Back</a>
        </p>
        <p id="err" style="color:#b91c1c;text-align:center"></p>
      </form>`;
    bind();
  }

  function grab() {
    const f = document.getElementById('f');
    const fd = new FormData(f);
    row.supplier_id = fd.get('supplier_id');
    row.date = fd.get('date');
    row.reference_no = fd.get('reference_no');
    row.discount_type = fd.get('discount_type');
    row.discount_amount = Number(fd.get('discount_amount') || 0);
    row.tax_rate = Number(fd.get('tax_rate') || 0);
    row.notes = fd.get('notes');
    row.subsidiary_code = fd.get('subsidiary_code');
    row.location_code = fd.get('location_code');
  }

  function bind() {
    const f = document.getElementById('f');
    f.querySelector('[name="supplier_id"]').onchange = () => {
      grab();
      if (parent && String(parent.supplier_id) !== String(row.supplier_id)) {
        parent = null;
        lines = [];
      }
      paint();
    };
    f.querySelector('[name="parent_id"]').onchange = (e) => {
      grab();
      setParent(e.target.value);
      paint();
    };
    ['discount_type','discount_amount','tax_rate'].forEach((n) => {
      f.querySelector(`[name="${n}"]`)?.addEventListener('change', () => { grab(); paint(); });
    });
    f.querySelector('[name="subsidiary_code"]')?.addEventListener('change', () => { grab(); paint(); });
    app.querySelectorAll('[data-rq]').forEach((inp) => {
      inp.onchange = () => { lines[+inp.dataset.rq].return_qty = Number(inp.value || 0); paint(); };
    });
    f.onsubmit = (e) => save(e, false);
    document.getElementById('save-print')?.addEventListener('click', () => save({ preventDefault() {} }, true));
    if (viewOnly) {
      f.querySelectorAll('input,select,textarea').forEach((el) => { el.disabled = true; });
      if (params.get('print') === '1') setTimeout(() => window.print(), 300);
    }
  }

  async function save(e, printAfter) {
    e.preventDefault();
    grab();
    const err = document.getElementById('err');
    err.textContent = '';
    const returned = lines.filter((l) => Number(l.return_qty) > 0);
    if (!parent) { err.textContent = 'Select the parent purchase.'; return; }
    if (!returned.length) { err.textContent = 'Enter a return quantity on at least one product.'; return; }
    if (!(await confirmAction('Save this purchase return?', 'Stock will be reduced for received items.'))) return;
    const t = totals();
    const body = {
      parent_purchase_id: parent.id,
      parent_purchase: parent.reference,
      supplier_id: parent.supplier_id || row.supplier_id || null,
      supplier_name: parent.supplier_name || null,
      reference_no: row.reference_no || ('PR-' + Date.now().toString().slice(-8)),
      date: String(row.date || '').slice(0, 10),
      payment_status: 'due',
      grand_total: t.payable,
      payment_due: t.payable,
      notes: row.notes || null,
      lines: returned,
    };
    try { stampScope(body, document.getElementById('f')); } catch (ex) { err.textContent = ex.message; return; }
    const q = await peelWrite('purchase_returns', existingId ? { ...body, id: existingId } : body, existingId ? { id: existingId } : {});
    if (q.error) { err.textContent = q.error.message; return; }
    await applyReceivedStock(returned.map((l) => ({ ...l, qty: l.return_qty })), true);
    if (parent.id && parent._table) {
      await peelWrite(parent._table, { return_due: Number(parent.return_due || 0) + t.payable }, { id: parent.id });
    }
    if (printAfter) {
      const w = window.open('', '_blank');
      if (w) {
        w.document.write(`<!doctype html><title>${esc(body.reference_no)}</title>
          <style>body{font-family:Inter,Arial,sans-serif;padding:24px;color:#111}table{width:100%;border-collapse:collapse}th,td{border:1px solid #111;padding:6px}</style>
          <h1>Purchase Return ${esc(body.reference_no)}</h1>
          <p>${esc(body.supplier_name || '')} · Parent ${esc(body.parent_purchase)} · ${esc(body.date)}</p>
          <table><thead><tr><th>Product</th><th>Qty</th><th>Cost</th></tr></thead>
          <tbody>${returned.map((l)=>`<tr><td>${esc(l.name)}</td><td>${l.return_qty}</td><td>${fmt(l.unit_cost)}</td></tr>`).join('')}</tbody></table>
          <p><b>Grand Total ${fmt(t.payable)}</b></p>`);
        w.document.close();
        w.print();
      }
    }
    location.assign('/purchase-returns.html');
  }

  paint();
}

export function promptStatus(current) {
  return new Promise((resolve) => {
    const wrap = document.createElement('div');
    wrap.style.cssText = 'position:fixed;inset:0;background:rgba(15,23,42,.55);z-index:10000;display:flex;align-items:center;justify-content:center;padding:16px';
    wrap.innerHTML = `<form style="background:#fff;color:#111;border-radius:12px;max-width:420px;width:100%;padding:20px 22px">
      <h3 style="margin:0 0 12px">Update Status</h3>
      <label class="fld">Purchase Status:*
        <select name="status" required>
          <option value="">Please Select</option>
          ${['received','pending','ordered'].map((s) => `<option value="${s}" ${s===current?'selected':''}>${s[0].toUpperCase()+s.slice(1)}</option>`).join('')}
        </select>
      </label>
      <p style="display:flex;justify-content:flex-end;gap:8px;margin-top:16px">
        <button type="button" data-no class="ult-btn ult-btn-outline">Close</button>
        <button type="submit" class="ult-btn ult-btn-primary">Update</button>
      </p>
    </form>`;
    wrap.querySelector('[data-no]').onclick = () => { wrap.remove(); resolve(null); };
    wrap.querySelector('form').onsubmit = (e) => { e.preventDefault(); const v = wrap.querySelector('[name="status"]').value; wrap.remove(); resolve(v); };
    wrap.addEventListener('click', (e) => { if (e.target === wrap) { wrap.remove(); resolve(null); } });
    document.body.appendChild(wrap);
  });
}
