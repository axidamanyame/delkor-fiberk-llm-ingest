/** Reconstruct Franko → Ops Hub → BNPL Field → Field Stock Hub → All sales.
 * Cost stays blank. Fiberk sell (partner reimbursement) is the invoice total.
 */
import { readLs, writeLs } from './ls-rows.js';
import { KEYS } from './catalog-seed.js';
import { OPS_HUB, BNPL_FIELD_LOCATION, FIELD_STOCK_HUB_CODE } from './scope.js';
import { appendMovements, makeHubSku, makeSubSku } from './sku-lifecycle.js';
import { loadPhoneBook, FRANKO } from './bnpl-field-phones.js';
import { hydrateLedgerTransfers } from './june-ledger-transfers.js';

const FLAG = 'df_hp_ops_flow_v2';
const PO_ID = 'hp-po-franko';
const ST1 = 'hp-st-hub-field';
const ST2 = 'hp-st-field-fsh';

function last9(p) { return String(p || '').replace(/\D/g, '').slice(-9); }

function upsert(key, rows) {
  const incoming = rows || [];
  if (!incoming.length) return;
  const ids = new Set(incoming.map((r) => String(r.id)));
  const cur = (readLs(key, []) || []).filter((r) => !ids.has(String(r.id)));
  writeLs(key, [...incoming, ...cur]);
}

function already() {
  try {
    if (localStorage.getItem(FLAG) !== '1') return false;
    const sales = readLs(KEYS.sales, []) || [];
    return sales.some((s) => String(s.id || '').startsWith('hp-sale-'));
  } catch { return false; }
}

export function hpSaleCount() {
  return (readLs(KEYS.sales, []) || []).filter((s) => String(s.id || '').startsWith('hp-sale-')).length;
}

export async function ensureHpOpsFlow() {
  try { hydrateLedgerTransfers(); } catch { /* ledger transfers */ }
  if (already()) {
    return { ok: true, sales: hpSaleCount(), skipped: true };
  }
  const book = await loadPhoneBook();
  const skus = book.skus || [];
  const units = book.units || [];
  if (!units.length) return { ok: false, sales: 0 };

  const firstDay = units.map((u) => String(u.delivered_at || '').slice(0, 10)).filter(Boolean).sort()[0] || '2026-04-04';
  const lastDay = units.map((u) => String(u.delivered_at || '').slice(0, 10)).filter(Boolean).sort().slice(-1)[0] || firstDay;

  const products = skus.map((s, i) => {
    const seq = 900001 + i;
    const hubSku = makeHubSku(seq);
    const fieldSku = makeSubSku('bnpl', seq);
    return {
      id: s.id,
      name: s.brand_type,
      brand: s.brand,
      category: 'Phones',
      product_type: 'simple',
      enable_stock: true,
      serialized: true,
      sku: fieldSku,
      catalog_sku: hubSku,
      base_sku: fieldSku,
      sku_locked: true,
      vendor_sku: s.id,
      supplier_id: FRANKO.id,
      supplier_name: FRANKO.name,
      cost_price: null,
      purchase_price: null,
      selling_price: s.fiberk_sell_min ?? 0,
      partner_price_min: s.partner_price_min,
      partner_price_max: s.partner_price_max,
      stock: 0,
      current_stock: 0,
      qty: 0,
      sold_qty: s.sold || 0,
      open_stock: true,
      subsidiary_code: 'bnpl',
      home_subsidiary: 'bnpl',
      location_code: FIELD_STOCK_HUB_CODE,
      location_name: 'Field Stock Hub',
      warehouse_code: FIELD_STOCK_HUB_CODE,
      intended_location_code: BNPL_FIELD_LOCATION,
      is_active: true,
      source: 'hp-field',
      note: 'Sourced from Franko Trading. Cost not booked. Selling price is Fiberk sell (partner reimbursement).',
    };
  });
  const bySku = new Map(products.map((p) => [p.id, p]));

  const customers = [];
  const seen = new Set();
  for (const u of units) {
    const d = last9(u.phone);
    if (!d || seen.has(d)) continue;
    seen.add(d);
    customers.push({
      id: 'hp-cust-' + d,
      name: u.customer_name,
      mobile: u.phone,
      phone: u.phone,
      customer_group: 'BNPL hire-purchase',
      subsidiary_code: 'bnpl',
      location_code: BNPL_FIELD_LOCATION,
      location_name: 'BNPL Field Sales',
      source: 'hp-field',
      is_active: true,
    });
  }

  const unitN = units.length;
  const poLines = [{
    product_id: 'hp-book',
    sku: 'HP-BOOK',
    name: 'EasyBuy HP book (individual contracts on Field Ops → Order List)',
    qty: unitN,
    unit_cost: 0,
    unit_price: 0,
    line_total: 0,
  }];
  const purchase = {
    id: PO_ID,
    reference: 'PO-HP-FRANKO',
    reference_no: 'PO-HP-FRANKO',
    supplier_id: FRANKO.id,
    supplier_name: FRANKO.name,
    date: firstDay,
    order_date: firstDay,
    status: 'received',
    payment_status: 'due',
    grand_total: 0,
    total_amount: 0,
    amount_paid: 0,
    payment_due: 0,
    subsidiary_code: 'ops',
    location_code: OPS_HUB.code,
    location_name: OPS_HUB.name,
    added_by: 'Field Ops',
    note: 'Historical HP handsets from Franko Trading. Purchase cost left blank until buying price is reconciled.',
    lines: poLines,
    source: 'hp-field',
  };

  const xferLines = skus.map((s) => ({
    product_id: s.id,
    sku: bySku.get(s.id)?.sku,
    name: s.brand_type,
    quantity: s.sold,
    qty: s.sold,
    unit_price: 0,
  }));
  const stHubField = {
    id: ST1,
    reference: 'ST-HP-001',
    reference_no: 'ST-HP-001',
    transfer_date: firstDay + ' 08:00',
    created_at: firstDay + 'T08:00:00',
    from_location: OPS_HUB.code,
    to_location: BNPL_FIELD_LOCATION,
    from_subsidiary: 'ops',
    to_subsidiary: 'bnpl',
    subsidiary_code: 'bnpl',
    location_code: BNPL_FIELD_LOCATION,
    status: 'completed',
    shipping_charges: 0,
    total_amount: 0,
    notes: 'Hub → BNPL Field Sales. HP book reconstruction. Cost blank.',
    lines: xferLines,
    source: 'hp-field',
  };
  const stFieldHub = {
    id: ST2,
    reference: 'ST-HP-002',
    reference_no: 'ST-HP-002',
    transfer_date: firstDay + ' 10:00',
    created_at: firstDay + 'T10:00:00',
    from_location: BNPL_FIELD_LOCATION,
    to_location: FIELD_STOCK_HUB_CODE,
    from_subsidiary: 'bnpl',
    to_subsidiary: 'bnpl',
    subsidiary_code: 'bnpl',
    location_code: FIELD_STOCK_HUB_CODE,
    status: 'completed',
    shipping_charges: 0,
    total_amount: 0,
    notes: 'BNPL Field Sales → Field Stock Hub (agent pick). Then sold on delivery.',
    lines: xferLines,
    source: 'hp-field',
  };

  const sales = units.map((u) => {
    const p = bySku.get(u.sku_id) || {};
    const sell = Number(u.fiberk_sell || 0);
    const day = String(u.delivered_at || firstDay).slice(0, 10);
    const when = String(u.delivered_at || day).replace(' ', 'T');
    return {
      id: 'hp-sale-' + u.order_id,
      reference: u.order_id,
      so_number: u.order_id,
      invoice_no: u.order_id,
      order_date: day,
      created_at: when,
      customer_id: 'hp-cust-' + last9(u.phone),
      customer_name: u.customer_name,
      phone: u.phone,
      status: 'final',
      payment_status: sell ? 'paid' : 'due',
      payment_method: 'partner',
      source: 'Field Ops',
      channel: 'HP',
      total_amount: sell,
      amount_paid: sell,
      shipping_status: 'delivered',
      total_items: 1,
      location_code: BNPL_FIELD_LOCATION,
      location_name: 'BNPL Field Sales',
      subsidiary_code: 'bnpl',
      created_by_name: u.sa_name || 'Field SA',
      added_by: u.sa_name || 'Field SA',
      commission_agent: u.sa_name || '',
      imei: u.imei,
      custom_field_1: u.imei,
      custom_field_2: u.brand_type,
      notes: `Fiberk sell ₵${sell} (partner reimbursement). Partner price ₵${u.partner_price ?? '—'} is the benchmark. Cost from Franko not booked. IMEI ${u.imei}.`,
      lines: [{
        product_id: u.sku_id,
        sku: p.sku || '',
        name: u.brand_type,
        qty: 1,
        unit_price: sell,
        imei: u.imei,
      }],
    };
  });

  upsert(KEYS.products, products);
  upsert(KEYS.customers, customers);
  const hasFiberkPo = (readLs('df_purchases', []) || []).some((r) => r.source === 'fiberkapp');
  if (!hasFiberkPo) {
    upsert('df_purchases', [purchase]);
    upsert('df_purchase_orders', [purchase]);
  }
  upsert('df_stock_transfers', [stHubField, stFieldHub]);
  upsert(KEYS.sales, sales);

  const events = [];
  for (const p of products) {
    const sku = skus.find((s) => s.id === p.id);
    const qty = sku?.sold || 0;
    events.push(
      {
        id: 'hp-mv-recv-' + p.id, product_id: p.id, created_at: firstDay + 'T07:00:00',
        type: 'purchase_in', qty, sku_after: p.catalog_sku, from_location: '', to_location: OPS_HUB.code,
        location_name: OPS_HUB.name, reference: 'PO-HP-FRANKO', note: 'Received from Franko Trading. Cost blank.',
      },
      {
        id: 'hp-mv-f1-' + p.id, product_id: p.id, created_at: firstDay + 'T08:00:00',
        type: 'transfer_in', qty, sku_after: p.sku, from_location: OPS_HUB.code, to_location: BNPL_FIELD_LOCATION,
        location_name: 'BNPL Field Sales', reference: 'ST-HP-001', note: 'Adopted BNPL SKU on first receipt at Field Sales.',
      },
      {
        id: 'hp-mv-f2-' + p.id, product_id: p.id, created_at: firstDay + 'T10:00:00',
        type: 'transfer_in', qty, sku_after: p.sku, from_location: BNPL_FIELD_LOCATION, to_location: FIELD_STOCK_HUB_CODE,
        location_name: 'Field Stock Hub', reference: 'ST-HP-002', note: 'Agent pick.',
      },
      {
        id: 'hp-mv-sale-' + p.id, product_id: p.id, created_at: lastDay + 'T18:00:00',
        type: 'sale', qty: -qty, sku_after: p.sku, from_location: FIELD_STOCK_HUB_CODE, to_location: '',
        location_name: 'Customer', reference: 'HP sales', note: 'Sold through Field Ops. On-hand 0.',
      },
    );
  }
  appendMovements(events);

  try { localStorage.setItem(FLAG, '1'); } catch { /* ignore */ }
  return { ok: true, sales: sales.length, products: products.length, customers: customers.length, skipped: false };
}
