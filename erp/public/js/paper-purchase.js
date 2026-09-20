/** Paper supplier invoice → WMS receive → BNPL Field. Live books only (not Fiberkapp silo). */
import { supabase } from './supabaseClient.js';
import { uid, esc, readLs, writeLs, saveRow } from './ls-rows.js';
import { KEYS } from './catalog-seed.js';
import { OPS_HUB, BNPL_FIELD_LOCATION, findLocation } from './scope.js';
import { applyReceivedStock, savePurchase } from './purchase-docs.js';
import { circulateProduct, appendMovements, applyProductPatch, displaySku, transferGate } from './sku-lifecycle.js';
import { peelWrite } from './account-rules.js';
import { promoteToInventory, promoteLinesToInventory } from './inventory-book.js';
import { attachImeiToInvoices } from './imei-assign.js';

export const JOB_KEY = 'df_paper_jobs';
export const PINARO_JOB_ID = 'paper-pinaro-00475';

export const PINARO_SLIP = '/uploads/invoices/pinaro-00475.jpg';

/** One live supplier: Mr Jeremiah Odjeawo = Pinaro General Ventures. */
export const PINARO_PARTY = {
  id: 'pin-sup-pinaro',
  name: 'Pinaro General Ventures',
  business_name: 'Pinaro General Ventures',
  legal_name: 'Pinaro General Ventures',
  contact_name: 'Mr Jeremiah Odjeawo',
  also_known_as: ['Mr Jeremiah Odjeawo', 'Jeremiah Odjeawo', 'Pinaro Ventures', 'PINARO GENERAL VENTURES', 'Philip Odjeawon'],
  phone: '0203964954',
  mobile: '0545325648',
  email: 'philipodjeawon@gmail.com',
  address: 'P.O. BOX 21, Odumase, Madina and Circle',
  city: 'Madina',
  country: 'Ghana',
  type: 'supplier',
  source: 'paper-invoice',
  subsidiary_code: 'fiberk',
};

const PINARO_ALIAS_RE = /pinaro|odjeawo|odjeawon|philipodjeawon|jeremiah\s+odjeaw/i;

export function isPinaroParty(row) {
  if (!row) return false;
  if (String(row.id) === PINARO_PARTY.id || String(row.supplier_id) === PINARO_PARTY.id) return true;
  return PINARO_ALIAS_RE.test([
    row.name, row.business_name, row.legal_name, row.contact_name,
    row.supplier_name, row.email, row.phone, row.mobile,
  ].join(' '));
}

export function pinaroSupplierRow() {
  return {
    ...PINARO_PARTY,
    display_name: 'Pinaro General Ventures · Mr Jeremiah Odjeawo',
    notes: 'Mr Jeremiah Odjeawo and Pinaro General Ventures are the same supplier. Slip contact email philipodjeawon@gmail.com.',
    updated_at: new Date().toISOString(),
  };
}

export function displaySupplierName(row) {
  if (isPinaroParty(row)) return 'Pinaro General Ventures · Mr Jeremiah Odjeawo';
  return row?.supplier_name || row?.name || row?.business_name || '—';
}

export function syncPinaroSupplier() {
  const list = readLs(KEYS.suppliers, []) || [];
  const keep = list.filter((r) => !isPinaroParty(r));
  const merged = { ...(list.find((r) => String(r.id) === PINARO_PARTY.id) || {}), ...pinaroSupplierRow() };
  writeLs(KEYS.suppliers, [merged, ...keep]);
  ['df_purchases', 'df_purchase_orders', 'df_purchase_invoices'].forEach((key) => {
    const rows = readLs(key, []) || [];
    let changed = false;
    rows.forEach((r) => {
      if (!isPinaroParty(r)) return;
      r.supplier_id = PINARO_PARTY.id;
      r.supplier_name = 'Pinaro General Ventures · Mr Jeremiah Odjeawo';
      r.contact_name = PINARO_PARTY.contact_name;
      changed = true;
    });
    if (changed) writeLs(key, rows);
  });
  const products = readLs(KEYS.products, []) || [];
  let pChanged = false;
  products.forEach((p) => {
    if (!isPinaroParty(p) && !/pinaro|odjeaw/i.test(String(p.supplier_name || ''))) return;
    p.supplier_id = PINARO_PARTY.id;
    p.supplier_name = PINARO_PARTY.name;
    pChanged = true;
  });
  if (pChanged) writeLs(KEYS.products, products);
  return merged;
}

export const PINARO_BILL = {
  id: PINARO_JOB_ID,
  vendor_invoice_no: '00475',
  reference: 'PIN-00475',
  slip_url: PINARO_SLIP,
  supplier: {
    name: 'Pinaro General Ventures',
    legal_name: 'Pinaro General Ventures',
    contact_name: 'Mr Jeremiah Odjeawo',
    address: 'P.O. BOX 21, Odumase, Madina and Circle',
    phone: '0203964954',
    phone2: '0545325648',
    email: 'philipodjeawon@gmail.com',
    city: 'Madina',
  },
  lines: [
    { hint: 'Spark 50', name: 'TECNO SPARK 50', brand: 'Tecno', qty: 5, unit_cost: 1835, amount: 9175 },
    { hint: 'Hot 70', name: 'INFINIX HOT 70', brand: 'Infinix', qty: 3, unit_cost: 1736, amount: 5208 },
    { hint: 'Smart 20', name: 'INFINIX SMART 20', brand: 'Infinix', qty: 1, unit_cost: 1581, amount: 1581 },
    { hint: 'A200', name: 'ITEL A200', brand: 'Itel', qty: 6, unit_cost: 995, amount: 5970 },
  ],
  grand_total: 21934,
  terms: 'Goods sold out are not returnable.',
  destination: BNPL_FIELD_LOCATION,
};

function slipAttachment(bill) {
  return [{
    id: 'att-pinaro-00475',
    name: 'Pinaro paper invoice 00475',
    url: bill.slip_url || PINARO_SLIP,
    mime: 'image/jpeg',
    kind: 'vendor_slip',
  }];
}

function slugHint(line) {
  return String(line.hint || line.name || 'item').toLowerCase().replace(/[^a-z0-9]+/g, '');
}

function stableProductId(line) {
  return 'pin-prod-' + slugHint(line);
}

function movementKey(n) {
  const ALPHA = '23456789ABCDEFGHJKMNPQRSTVWXYZ';
  let x = ((Number(n) || 0) + 1) * 7919 + 104729;
  let out = '';
  for (let i = 0; i < 4; i += 1) {
    out = ALPHA[x % ALPHA.length] + out;
    x = Math.floor(x / ALPHA.length);
  }
  return out;
}

function pinaroProductsAtBnpl() {
  const dest = findLocation(BNPL_FIELD_LOCATION) || { code: BNPL_FIELD_LOCATION, name: 'BNPL Field Sales', subsidiary: 'bnpl', warehouse: 'bnpl-MAIN' };
  const seqBase = 47501;
  return PINARO_BILL.lines.map((line, i) => {
    const seq = seqBase + i;
    const catalog = `OPH-${String(seq).padStart(6, '0')}`;
    const base = `BNP-${String(seq).padStart(6, '0')}`;
    const key = movementKey(1);
    return {
      id: stableProductId(line),
      name: line.name,
      sku: `${base}-${key}`,
      catalog_sku: catalog,
      base_sku: base,
      sku_locked: true,
      open_stock: true,
      brand: line.brand,
      type: 'Single',
      category: 'Phones',
      cost_price: line.unit_cost,
      selling_price: 0,
      current_stock: line.qty,
      stock: line.qty,
      qty: line.qty,
      current_stock_value: line.qty * line.unit_cost,
      unit: 'Pc',
      source: 'paper-invoice',
      vendor_invoice_no: PINARO_BILL.vendor_invoice_no,
      purchase_ref: PINARO_BILL.reference,
      subsidiary_code: dest.subsidiary,
      location_code: dest.code,
      location_name: dest.name,
      warehouse_code: dest.warehouse || dest.code,
      home_subsidiary: dest.subsidiary,
      intended_location_code: dest.code,
      movement_seq: 1,
      movement_key: key,
      supplier_name: PINARO_BILL.supplier.name,
    };
  });
}

function mergeById(key, incoming) {
  const cur = readLs(key, []) || [];
  const map = new Map(cur.map((r) => [String(r.id), r]));
  incoming.forEach((r) => {
    if (!r?.id) return;
    map.set(String(r.id), { ...(map.get(String(r.id)) || {}), ...r });
  });
  const next = [...map.values()];
  writeLs(key, next);
  return next;
}

/** Idempotent: 15 Pinaro phones sit on BNPL Field with locked BNP SKUs. */
export function hydratePinaroAtBnpl() {
  const dest = findLocation(BNPL_FIELD_LOCATION) || { code: 'BNPL-FIELD', name: 'BNPL Field Sales', subsidiary: 'bnpl', warehouse: 'bnpl-MAIN' };
  const from = OPS_HUB;
  const products = pinaroProductsAtBnpl();
  mergeById(KEYS.products, products);
  try {
    products.forEach((p, i) => promoteToInventory(p, {
      qty: PINARO_BILL.lines[i]?.qty || p.stock || 0,
      stage: 'on_hand',
      source: 'paper-invoice',
      ref: PINARO_BILL.reference,
      location: dest.code,
      note: 'Pinaro 00475 live at BNPL Field',
    }));
  } catch { /* book */ }
  const supplier = syncPinaroSupplier();
  mergeById(KEYS.suppliers, [supplier]);
  const mapped = products.map((p, i) => {
    const line = PINARO_BILL.lines[i];
    return {
      product_id: p.id,
      sku: p.sku,
      name: p.name,
      product_name: p.name,
      qty: line.qty,
      quantity: line.qty,
      unit_cost: line.unit_cost,
      unit_price: line.unit_cost,
      tax_percent: 0,
      line_total: line.amount,
    };
  });
  const purchase = {
    id: 'pin-po-00475',
    supplier_id: supplier.id,
    supplier_name: supplier.name,
    reference: PINARO_BILL.reference,
    reference_no: PINARO_BILL.reference,
    vendor_invoice_no: PINARO_BILL.vendor_invoice_no,
    date: '2026-09-09',
    order_date: '2026-09-09',
    status: 'received',
    payment_status: 'paid',
    grand_total: PINARO_BILL.grand_total,
    total_amount: PINARO_BILL.grand_total,
    amount_paid: PINARO_BILL.grand_total,
    payment_due: 0,
    note: `${PINARO_BILL.supplier.address}. Tel ${PINARO_BILL.supplier.phone} / ${PINARO_BILL.supplier.phone2}. ${PINARO_BILL.terms} Paper slip #${PINARO_BILL.vendor_invoice_no}. Posted WMS Hub → BNPL Field.`,
    attachment_url: PINARO_BILL.slip_url,
    attachments: slipAttachment(PINARO_BILL),
    lines: mapped,
    subsidiary_code: dest.subsidiary,
    location_code: dest.code,
    location_name: dest.name,
    source: 'paper-invoice',
    added_by: 'HQ',
  };
  mergeById('df_purchases', [purchase]);
  mergeById('df_purchase_invoices', [{
    id: 'pin-inv-00475',
    reference: PINARO_BILL.reference,
    vendor_invoice_no: PINARO_BILL.vendor_invoice_no,
    supplier_id: supplier.id,
    supplier_name: supplier.name,
    invoice_date: '2026-09-09',
    due_days: 0,
    status: 'paid',
    subtotal: PINARO_BILL.grand_total,
    tax_amount: 0,
    total_amount: PINARO_BILL.grand_total,
    amount_paid: PINARO_BILL.grand_total,
    lines: mapped,
    notes: purchase.note,
    attachment_url: PINARO_BILL.slip_url,
    attachments: slipAttachment(PINARO_BILL),
    subsidiary_code: dest.subsidiary,
    location_code: dest.code,
    source: 'paper-invoice',
    lines: mapped,
  }]);
  mergeById('df_stock_transfers', [{
    id: 'pin-st-00475',
    reference: 'PIN-ST-00475',
    status: 'completed',
    transfer_date: '2026-09-09T12:00:00.000Z',
    from_location: from.code,
    to_location: dest.code,
    from_warehouse_code: from.warehouse,
    to_warehouse_code: dest.warehouse,
    from_subsidiary: from.subsidiary,
    to_subsidiary: dest.subsidiary,
    via_virtual: true,
    notes: 'Pinaro paper 00475 → BNPL Field (test posted)',
    lines: mapped.map((l) => ({ id: l.product_id, sku: l.sku, name: l.name, qty: l.qty })),
    added_by: 'HQ',
    source: 'paper-invoice',
  }]);
  const moves = products.flatMap((p, i) => {
    const qty = PINARO_BILL.lines[i].qty;
    const common = {
      product_id: p.id,
      created_at: '2026-09-09T12:00:00.000Z',
      sku_after: p.sku,
      catalog_sku: p.catalog_sku,
      base_sku: p.base_sku,
      movement_key: p.movement_key,
      from_location: from.code,
      to_location: dest.code,
      location_name: dest.name,
      reference: 'PIN-ST-00475',
    };
    return [
      { ...common, id: `pin-mv-${p.id}-out`, type: 'transfer_out', qty: -qty, note: 'Left Operations Hub' },
      { ...common, id: `pin-mv-${p.id}-in`, type: 'transfer_in', qty, note: 'Adopted BNPL SKU on first receipt at BNPL Field Sales' },
    ];
  });
  mergeById('df_stock_movements', moves);
  mergeById('df_invoice_attachments', [{
    id: 'att-pinaro-00475',
    invoice_id: 'pin-inv-00475',
    purchase_id: 'pin-po-00475',
    supplier_name: supplier.name,
    reference: PINARO_BILL.reference,
    vendor_invoice_no: PINARO_BILL.vendor_invoice_no,
    name: 'Pinaro paper invoice 00475',
    url: PINARO_BILL.slip_url,
    mime: 'image/jpeg',
    created_at: '2026-09-09T12:00:00.000Z',
  }]);
  const job = {
    id: PINARO_JOB_ID,
    step: 'done',
    bill: PINARO_BILL,
    supplier_id: supplier.id,
    purchase_id: purchase.id,
    invoice_id: 'pin-inv-00475',
    attachment_url: PINARO_BILL.slip_url,
    products: mapped,
    received: true,
    transferred: true,
    transfer_ref: 'PIN-ST-00475',
    updated_at: new Date().toISOString(),
  };
  saveJob(job);
  try { localStorage.setItem('df_pinaro_00475_posted', '1'); } catch { /* ignore */ }
  try { attachImeiToInvoices(); } catch { /* imei */ }
  return { job, products, purchase };
}

export async function ensurePinaroPostedToBnpl(actor = 'HQ') {
  const hydrated = hydratePinaroAtBnpl();
  try {
    for (const p of hydrated.products) {
      await saveRow('products', KEYS.products, p);
    }
    await saveRow('suppliers', KEYS.suppliers, pinaroSupplierRow());
    await saveRow('purchases', 'df_purchases', hydrated.purchase);
    await saveRow('purchase_invoices', 'df_purchase_invoices', {
      id: 'pin-inv-00475',
      reference: PINARO_BILL.reference,
      vendor_invoice_no: PINARO_BILL.vendor_invoice_no,
      supplier_id: 'pin-sup-pinaro',
      supplier_name: PINARO_BILL.supplier.name,
      invoice_date: '2026-09-09',
      status: 'paid',
      total_amount: PINARO_BILL.grand_total,
      amount_paid: PINARO_BILL.grand_total,
      attachment_url: PINARO_BILL.slip_url,
      attachments: slipAttachment(PINARO_BILL),
      lines: hydrated.job.products,
      location_code: BNPL_FIELD_LOCATION,
      subsidiary_code: 'bnpl',
      source: 'paper-invoice',
    });
    await saveRow('stock_transfers', 'df_stock_transfers', {
      id: 'pin-st-00475',
      reference: 'PIN-ST-00475',
      status: 'completed',
      from_location: OPS_HUB.code,
      to_location: BNPL_FIELD_LOCATION,
      lines: hydrated.job.products,
      source: 'paper-invoice',
      notes: 'Pinaro paper 00475 → BNPL Field (test posted)',
    });
  } catch { /* local books still hold the 15 units */ }
  hydratePinaroAtBnpl();
  return loadJob();
}

export function cedi(n) {
  return 'GH₵ ' + Number(n || 0).toLocaleString('en-GH', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

export function loadJob(id = PINARO_JOB_ID) {
  return (readLs(JOB_KEY, []) || []).find((j) => j.id === id) || {
    id,
    step: 'review',
    bill: PINARO_BILL,
    supplier_id: '',
    purchase_id: '',
    invoice_id: '',
    received: false,
    transferred: false,
    transfer_ref: '',
    products: [],
  };
}

function saveJob(job) {
  const rows = readLs(JOB_KEY, []).filter((j) => j.id !== job.id);
  rows.unshift({ ...job, updated_at: new Date().toISOString() });
  writeLs(JOB_KEY, rows);
  return job;
}

function norm(s) {
  return String(s || '').toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
}

function scoreProduct(p, line) {
  const hay = norm([p.name, p.sku, p.brand, p.product_name].join(' '));
  const want = norm(line.name);
  const hint = norm(line.hint);
  if (!hay) return 0;
  if (hay === want) return 100;
  if (hay.includes(want) || want.includes(hay)) return 80;
  if (hint && hay.includes(hint)) return 70;
  const bits = want.split(' ').filter((w) => w.length > 1);
  return bits.filter((w) => hay.includes(w)).length * 15;
}

async function catalog() {
  const local = readLs(KEYS.products, []) || [];
  let remote = [];
  try {
    const { data } = await supabase.from('products').select('id,name,sku,brand,cost_price,current_stock,current_stock_value,location_code,subsidiary_code').limit(2000);
    remote = data || [];
  } catch { /* offline */ }
  const map = new Map();
  [...remote, ...local].forEach((p) => {
    if (!p?.id) return;
    map.set(String(p.id), { ...(map.get(String(p.id)) || {}), ...p });
  });
  return [...map.values()];
}

function matchLine(line, products) {
  let best = null;
  let bestScore = 0;
  products.forEach((p) => {
    const s = scoreProduct(p, line);
    if (s > bestScore) { best = p; bestScore = s; }
  });
  return bestScore >= 40 ? best : null;
}

async function ensureSupplier(_bill) {
  const row = syncPinaroSupplier();
  try {
    await saveRow('suppliers', KEYS.suppliers, row);
  } catch { /* local already written */ }
  return row;
}

async function ensureProduct(line, products) {
  const stableId = stableProductId(line);
  const hit = products.find((p) => String(p.id) === stableId) || matchLine(line, products);
  if (hit) {
    const patch = {
      ...hit,
      id: hit.id || stableId,
      cost_price: Number(line.unit_cost) || Number(hit.cost_price) || 0,
      brand: hit.brand || line.brand,
    };
    await saveRow('products', KEYS.products, patch);
    return patch;
  }
  const sku = 'PIN-' + String(line.hint || line.name).replace(/\s+/g, '').toUpperCase().slice(0, 12);
  const row = {
    id: stableId,
    name: line.name,
    sku,
    catalog_sku: sku,
    brand: line.brand,
    type: 'Single',
    category: 'Phones',
    cost_price: line.unit_cost,
    selling_price: 0,
    current_stock: 0,
    current_stock_value: 0,
    stock: 0,
    unit: 'Pc',
    source: 'paper-invoice',
    subsidiary_code: 'ops',
    location_code: OPS_HUB.code,
    location_name: OPS_HUB.name,
  };
  const saved = await saveRow('products', KEYS.products, row);
  products.push(saved);
  return saved;
}

export async function bookPinaroInvoice(actor = 'HQ') {
  const job = loadJob();
  const bill = PINARO_BILL;
  const sup = await ensureSupplier(bill);
  const products = await catalog();
  const mapped = [];
  for (const line of bill.lines) {
    const p = await ensureProduct(line, products);
    mapped.push({
      product_id: p.id,
      sku: p.sku || line.hint,
      name: p.name || line.name,
      product_name: p.name || line.name,
      qty: line.qty,
      quantity: line.qty,
      unit_cost: line.unit_cost,
      unit_price: line.unit_cost,
      tax_percent: 0,
      line_total: line.amount,
    });
  }
  const purchaseId = job.purchase_id || uid();
  const invId = job.invoice_id || uid();
  const purchase = {
    id: purchaseId,
    supplier_id: sup.id,
    supplier_name: bill.supplier.name,
    reference: bill.reference,
    reference_no: bill.reference,
    vendor_invoice_no: bill.vendor_invoice_no,
    date: new Date().toISOString().slice(0, 10),
    order_date: new Date().toISOString().slice(0, 10),
    status: 'received',
    payment_status: 'paid',
    grand_total: bill.grand_total,
    total_amount: bill.grand_total,
    amount_paid: bill.grand_total,
    payment_due: 0,
    note: `${bill.supplier.address}. Tel ${bill.supplier.phone} / ${bill.supplier.phone2}. ${bill.terms} Paper slip #${bill.vendor_invoice_no}. Route: WMS Hub → BNPL Field.`,
    attachment_url: bill.slip_url,
    attachments: slipAttachment(bill),
    lines: mapped,
    subsidiary_code: 'fiberk',
    location_code: OPS_HUB.code,
    location_name: OPS_HUB.name,
    source: 'paper-invoice',
    added_by: actor,
  };
  await savePurchase(purchase, { id: purchaseId, table: 'purchases' });
  await saveRow('purchases', 'df_purchases', purchase);
  const invoice = {
    id: invId,
    reference: bill.reference,
    vendor_invoice_no: bill.vendor_invoice_no,
    supplier_id: sup.id,
    supplier_name: bill.supplier.name,
    invoice_date: purchase.date,
    due_days: 0,
    status: 'paid',
    subtotal: bill.grand_total,
    tax_amount: 0,
    total_amount: bill.grand_total,
    amount_paid: bill.grand_total,
    notes: purchase.note,
    attachment_url: bill.slip_url,
    attachments: slipAttachment(bill),
    subsidiary_code: 'fiberk',
    location_code: OPS_HUB.code,
    source: 'paper-invoice',
    lines: mapped,
  };
  await saveRow('purchase_invoices', 'df_purchase_invoices', invoice);
  const docs = readLs('df_invoice_attachments', []).filter((a) => a.invoice_id !== invId);
  docs.unshift({
    id: 'att-pinaro-00475',
    invoice_id: invId,
    purchase_id: purchaseId,
    supplier_name: bill.supplier.name,
    reference: bill.reference,
    vendor_invoice_no: bill.vendor_invoice_no,
    name: 'Pinaro paper invoice 00475',
    url: bill.slip_url,
    mime: 'image/jpeg',
    created_at: new Date().toISOString(),
  });
  writeLs('df_invoice_attachments', docs);
  const next = saveJob({
    ...job,
    step: 'receive',
    supplier_id: sup.id,
    purchase_id: purchaseId,
    invoice_id: invId,
    attachment_url: bill.slip_url,
    products: mapped,
    received: false,
    transferred: false,
  });
  return { job: next, purchase, invoice, supplier: sup };
}

export async function receivePinaroAtHub() {
  const job = loadJob();
  if (!job.purchase_id) throw new Error('Book the invoice first.');
  const purchases = readLs('df_purchases', []);
  const row = purchases.find((r) => String(r.id) === String(job.purchase_id));
  const lines = (row?.lines || job.products || []).map((l) => ({
    product_id: l.product_id,
    sku: l.sku,
    qty: Number(l.qty || l.quantity || 0),
    reference: PINARO_BILL.reference,
  }));
  await applyReceivedStock(lines, false, OPS_HUB.code);
  const local = readLs(KEYS.products, []) || [];
  lines.forEach((l) => {
    const i = local.findIndex((p) => String(p.id) === String(l.product_id));
    if (i < 0) return;
    const q = Number(local[i].current_stock || local[i].stock || 0) + Number(l.qty || 0);
    local[i] = {
      ...local[i],
      current_stock: q,
      stock: q,
      qty: q,
      current_stock_value: q,
      location_code: OPS_HUB.code,
      location_name: OPS_HUB.name,
      warehouse_code: OPS_HUB.warehouse,
      subsidiary_code: OPS_HUB.subsidiary,
    };
  });
  writeLs(KEYS.products, local);
  if (row) {
    const rec = { ...row, status: 'received', location_code: OPS_HUB.code, location_name: OPS_HUB.name };
    await saveRow('purchases', 'df_purchases', rec);
  }
  return saveJob({ ...job, step: 'transfer', received: true });
}

export async function transferPinaroToBnpl(actor = 'HQ') {
  const job = loadJob();
  if (!job.received) throw new Error('Receive at Operations Hub first.');
  const to = findLocation(BNPL_FIELD_LOCATION);
  const from = OPS_HUB;
  const products = readLs(KEYS.products, []) || [];
  const ref = 'ST' + Date.now().toString().slice(-6);
  const xferLines = [];
  for (const line of job.products || []) {
    const p = products.find((x) => String(x.id) === String(line.product_id));
    if (!p) continue;
    const gate = transferGate(from, to, [p]);
    if (!gate.ok) throw new Error(gate.message);
    const qty = Number(line.qty || 0);
    const { product: next, events } = circulateProduct(p, {
      from, to, qty, reference: ref, type: 'transfer',
    });
    applyProductPatch(next);
    if (events?.length) appendMovements(events);
    xferLines.push({ id: p.id, sku: displaySku(next), name: next.name, qty });
  }
  await saveRow('stock_transfers', 'df_stock_transfers', {
    reference: ref,
    status: 'completed',
    transfer_date: new Date().toISOString(),
    from_location: from.code,
    to_location: to.code,
    from_warehouse_code: from.warehouse,
    to_warehouse_code: to.warehouse,
    from_subsidiary: from.subsidiary,
    to_subsidiary: to.subsidiary,
    via_virtual: true,
    notes: `Pinaro paper ${PINARO_BILL.vendor_invoice_no} → BNPL Field`,
    lines: xferLines,
    added_by: actor,
    source: 'paper-invoice',
  });
  try { await peelWrite('wms_activity', {
    id: uid(),
    type: 'transfer',
    sku: xferLines.map((l) => l.sku).join(', '),
    qty: xferLines.reduce((a, l) => a + l.qty, 0),
    from_location: from.code,
    to_location: to.code,
    ref,
    note: 'Paper invoice PIN-00475 posted to BNPL Field',
    created_at: new Date().toISOString(),
  }, {}); } catch { /* optional */ }
  return saveJob({ ...job, step: 'done', transferred: true, transfer_ref: ref });
}

export { esc };
