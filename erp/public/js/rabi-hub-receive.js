/** WhatsApp quote — Rabi Circle Trading → Operations Hub inventory. Live book only. */
import { readLs, writeLs } from './ls-rows.js';
import { KEYS } from './catalog-seed.js';
import { OPS_HUB, findLocation } from './scope.js';
import { appendMovements } from './sku-lifecycle.js';
import { promoteToInventory } from './inventory-book.js';
import { attachImeiToInvoices } from './imei-assign.js';

export const RABI_REF = 'RC-WA-14454';
const FLAG = 'df_rabi_wa_14454';

export const RABI_PARTY = {
  id: 'sup-rabi-circle',
  name: 'Rabi Circle Trading',
  business_name: 'Rabi Circle Trading',
  display_name: 'Rabi Circle Trading (Franko Circle)',
  phone: '0244183276',
  mobile: '0244183276',
  city: 'Circle',
  address: 'Franko Circle 3 Wholesale, Accra',
  contact_name: 'Rabi Circle',
  notes: 'WhatsApp quote. Pay confirmation number 0244183276.',
  is_active: true,
  source: 'whatsapp-quote',
};

export const RABI_BILL = {
  id: 'po-rabi-wa-14454',
  reference: RABI_REF,
  date: '2026-09-09',
  delivered_by: 'Bernard Fiagbey',
  received_by: 'Harry Coleman',
  grand_total: 14454,
  lines: [
    { id: 'prd-rabi-smart20-128', name: 'INFINIX SMART 20 (128GB)', brand: 'Infinix', qty: 4, unit_cost: 1581, amount: 6324 },
    { id: 'prd-rabi-pop20-64', name: 'TECNO POP 20 (64GB)', brand: 'Tecno', qty: 6, unit_cost: 1355, amount: 8130 },
  ],
};

function mergeById(key, incoming) {
  const cur = readLs(key, []) || [];
  const map = new Map(cur.map((r) => [String(r.id), r]));
  incoming.forEach((r) => { if (r?.id) map.set(String(r.id), { ...(map.get(String(r.id)) || {}), ...r }); });
  writeLs(key, [...map.values()]);
}

export function hydrateRabiAtHub() {
  const hub = findLocation(OPS_HUB.code) || OPS_HUB;
  const products = RABI_BILL.lines.map((line, i) => {
    const seq = 91001 + i;
    const sku = `OPH-${String(seq).padStart(6, '0')}`;
    return {
      id: line.id,
      name: line.name,
      sku,
      catalog_sku: sku,
      brand: line.brand,
      category: 'Phones',
      type: 'Single',
      cost_price: line.unit_cost,
      selling_price: 0,
      stock: line.qty,
      current_stock: line.qty,
      qty: line.qty,
      unit: 'Pc',
      supplier_id: RABI_PARTY.id,
      supplier_name: RABI_PARTY.name,
      subsidiary_code: 'fiberk',
      location_code: hub.code,
      location_name: hub.name,
      purchase_ref: RABI_REF,
      source: 'whatsapp-quote',
      is_active: true,
      received_by: RABI_BILL.received_by,
    };
  });
  mergeById(KEYS.products, products);
  mergeById(KEYS.suppliers, [RABI_PARTY]);
  products.forEach((p, i) => {
    try {
      promoteToInventory(p, {
        qty: RABI_BILL.lines[i].qty,
        stage: 'on_hand',
        source: 'whatsapp-quote',
        ref: RABI_REF,
        location: hub.code,
        note: `Received by ${RABI_BILL.received_by}. Delivered by ${RABI_BILL.delivered_by}.`,
      });
    } catch { /* book */ }
  });
  const mapped = products.map((p, i) => ({
    product_id: p.id,
    sku: p.sku,
    name: p.name,
    product_name: p.name,
    qty: RABI_BILL.lines[i].qty,
    quantity: RABI_BILL.lines[i].qty,
    unit_cost: RABI_BILL.lines[i].unit_cost,
    unit_price: RABI_BILL.lines[i].unit_cost,
    tax_percent: 0,
    line_total: RABI_BILL.lines[i].amount,
  }));
  const note = `WhatsApp quote Rabi Circle Trading (Franko Circle). Smart 20 128 ×4 @ 1581 = 6324. Pop 20 64 ×6 @ 1355 = 8130. Total 14,454 paid. Confirm 0244183276. Delivered by ${RABI_BILL.delivered_by}. Received into Hub inventory by ${RABI_BILL.received_by}.`;
  const purchase = {
    id: RABI_BILL.id,
    supplier_id: RABI_PARTY.id,
    supplier_name: RABI_PARTY.display_name,
    reference: RABI_REF,
    reference_no: RABI_REF,
    vendor_invoice_no: 'WA-14454',
    date: RABI_BILL.date,
    order_date: RABI_BILL.date,
    status: 'received',
    payment_status: 'paid',
    grand_total: 14454,
    total_amount: 14454,
    amount_paid: 14454,
    payment_due: 0,
    note,
    lines: mapped,
    payments: [{
      date: RABI_BILL.date,
      reference: RABI_REF,
      amount: 14454,
      method: 'mobile',
      note: 'Paid. Screenshot to 0244183276.',
    }],
    subsidiary_code: 'fiberk',
    location_code: hub.code,
    location_name: hub.name,
    delivered_by: RABI_BILL.delivered_by,
    received_by: RABI_BILL.received_by,
    added_by: RABI_BILL.received_by,
    source: 'whatsapp-quote',
  };
  mergeById('df_purchases', [purchase]);
  mergeById('df_purchase_orders', [purchase]);
  mergeById('df_purchase_invoices', [{
    id: 'inv-rabi-wa-14454',
    reference: RABI_REF,
    vendor_invoice_no: 'WA-14454',
    supplier_id: RABI_PARTY.id,
    supplier_name: RABI_PARTY.display_name,
    invoice_date: RABI_BILL.date,
    due_days: 0,
    status: 'paid',
    subtotal: 14454,
    tax_amount: 0,
    total_amount: 14454,
    amount_paid: 14454,
    lines: mapped,
    notes: note,
    subsidiary_code: 'fiberk',
    location_code: hub.code,
    delivered_by: RABI_BILL.delivered_by,
    received_by: RABI_BILL.received_by,
    source: 'whatsapp-quote',
  }]);
  try {
    appendMovements(products.map((p, i) => ({
      product_id: p.id,
      sku: p.sku,
      sku_after: p.sku,
      type: 'purchase_in',
      qty: RABI_BILL.lines[i].qty,
      to_location: hub.code,
      reference: RABI_REF,
      note: `Delivered by ${RABI_BILL.delivered_by}. Received by ${RABI_BILL.received_by}.`,
      created_at: '2026-09-09T18:45:00',
    })));
  } catch { /* movements */ }
  try { localStorage.setItem(FLAG, '1'); } catch { /* ignore */ }
  try { attachImeiToInvoices(); } catch { /* imei */ }
  return purchase;
}
