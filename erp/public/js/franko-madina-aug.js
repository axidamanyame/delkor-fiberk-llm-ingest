/** Franko Madina — Aug Delivery / Removable IMEIs matched to EasyBuy sales. */
import { readLs, writeLs } from './ls-rows.js';
import { KEYS } from './catalog-seed.js';
import { OPS_HUB, findLocation } from './scope.js';
import { appendMovements } from './sku-lifecycle.js';
import { promoteToInventory } from './inventory-book.js';
import { attachImeiToInvoices } from './imei-assign.js';

export const FM_REF = 'FM-AUG-LOCK';
const FLAG = 'df_franko_madina_aug_lock';

export const FRANKO_MADINA = {
  id: 's-franko-madina',
  name: 'FRANKO MADINA',
  business_name: 'FRANKO MADINA',
  display_name: 'FRANKO MADINA',
  is_active: true,
  source: 'live',
};

/** Costs from Pinaro / Rabi slips. Sell from EasyBuy unit book. */
export const FM_UNITS = [
  { imei: '352455870377751', product: 'TECNO SPARK 50 (4G+128G) BLACK', cost: 1835, sell: 2099, customer: 'Abigail Mensah', order: 'EB1016563121570979882', sa: 'Nathan Tetteh Buer-Doe', delivered_at: '2026-09-05 20:18:55', exp: '2026-08-13 23:28:39', tab: 'delivery' },
  { imei: '352562721396607', product: 'INFINIX SMART 20 (4G+64G) BLACK', cost: 1581, sell: 1569, customer: 'Abraham Dery', order: 'EB1017229057886003274', sa: 'Nathan Tetteh Buer-Doe', delivered_at: '2026-09-07 16:25:07', exp: '2026-08-13 23:25:21', tab: 'delivery' },
  { imei: '352562721366691', product: 'INFINIX SMART 20 (4G+64G) BLACK', cost: 1581, sell: 1569, customer: 'Regina Bali', order: 'EB1016851754731438112', sa: 'Nathan Tetteh Buer-Doe', delivered_at: '2026-09-06 15:25:51', exp: '2026-08-13 23:15:46', tab: 'delivery' },
  { imei: '352562721688854', product: 'INFINIX SMART 20 (4G+64G) BLACK', cost: 1581, sell: 1569, customer: 'Elijah Andah Anderson', order: 'EB1011751376058847320', sa: 'ANNABEL KOKOR OWORHU', delivered_at: '2026-08-23 13:38:46', exp: '2026-08-08 19:21:27', tab: 'delivery' },
  { imei: '354396744923644', product: 'TECNO POP 20 (4G+64G) BLACK', cost: 1355, sell: 1579, customer: 'prosper Dunyo', order: 'EB1017566328795430928', sa: 'Nathan Tetteh Buer-Doe', delivered_at: '2026-09-08 14:45:19', exp: '2026-08-13 23:03:03', tab: 'delivery' },
  { imei: '354396744816509', product: 'TECNO POP 20 (4G+64G) BLACK', cost: 1355, sell: 1579, customer: 'Lordson Martey', order: 'EB1015743753702350873', sa: 'Nathan Tetteh Buer-Doe', delivered_at: '2026-09-03 14:03:03', exp: '2026-08-13 22:52:04', tab: 'delivery' },
  { imei: '354396744855911', product: 'TECNO POP 20 (4G+64G) BLACK', cost: 1355, sell: 1579, customer: 'JOHN TETTEH', order: 'EB1010692977191813191', sa: 'KRAH AARON', delivered_at: '2026-08-20 15:33:04', exp: '2026-08-13 22:39:06', tab: 'delivery' },
  { imei: '354396744926258', product: 'TECNO POP 20 (4G+64G) BLACK', cost: 1355, sell: 0, customer: '', order: '', sa: '', delivered_at: '', exp: '2026-08-13 23:09:00', tab: 'removable', lock_code: 'TBXYQ38A', pre_apply: 'PRE1008263453606936611' },
];

function mergeById(key, incoming) {
  const cur = readLs(key, []) || [];
  const map = new Map(cur.map((r) => [String(r.id), r]));
  incoming.forEach((r) => { if (r?.id) map.set(String(r.id), { ...(map.get(String(r.id)) || {}), ...r }); });
  writeLs(key, [...map.values()]);
}

function linesFromUnits() {
  const groups = new Map();
  FM_UNITS.forEach((u) => {
    const g = groups.get(u.product) || { product: u.product, qty: 0, unit_cost: u.cost, serials: [] };
    g.qty += 1;
    g.serials.push(u);
    groups.set(u.product, g);
  });
  return [...groups.values()].map((g, i) => ({
    product_id: 'prd-fm-' + (i + 1),
    name: g.product,
    product_name: g.product,
    qty: g.qty,
    quantity: g.qty,
    unit_cost: g.unit_cost,
    unit_price: g.unit_cost,
    line_total: g.qty * g.unit_cost,
    serials: g.serials.map((s) => ({ imei: s.imei, at: s.exp, tab: s.tab, lock_code: s.lock_code, pre_apply: s.pre_apply })),
    imei: g.serials.map((s) => s.imei).join(', '),
  }));
}

export function hydrateFrankoMadinaAug() {
  const hub = findLocation(OPS_HUB.code) || OPS_HUB;
  const mapped = linesFromUnits();
  const total = mapped.reduce((s, l) => s + l.line_total, 0);
  const note = `Franko Madina lock-app Delivery / Removable. Delivered by Bernard Fiagbey. Received by Harry Coleman. Costs from live slips (Spark 50 ₵1835, Smart 20 ₵1581, Pop 20 ₵1355). EasyBuy Fiberk sell used for profit on matched IMEIs.`;
  const purchase = {
    id: 'po-fm-aug-lock',
    supplier_id: FRANKO_MADINA.id,
    supplier_name: FRANKO_MADINA.name,
    reference: FM_REF,
    reference_no: FM_REF,
    vendor_invoice_no: 'LOCK-AUG',
    date: '2026-08-13',
    order_date: '2026-08-13',
    status: 'received',
    payment_status: 'paid',
    grand_total: total,
    total_amount: total,
    amount_paid: total,
    payment_due: 0,
    payments: [{ date: '2026-08-13', amount: total, method: 'cash', note: 'Paid before pickup and delivery' }],
    note,
    lines: mapped,
    subsidiary_code: 'fiberk',
    location_code: hub.code,
    location_name: hub.name,
    delivered_by: 'Bernard Fiagbey',
    received_by: 'Harry Coleman',
    added_by: 'Harry Coleman',
    source: 'lock-app',
  };
  mergeById(KEYS.suppliers, [FRANKO_MADINA]);
  mergeById('df_purchases', [purchase]);
  mergeById('df_purchase_orders', [purchase]);
  mergeById('df_purchase_invoices', [{
    id: 'inv-fm-aug-lock',
    reference: FM_REF,
    vendor_invoice_no: 'LOCK-AUG',
    supplier_id: FRANKO_MADINA.id,
    supplier_name: FRANKO_MADINA.name,
    invoice_date: '2026-08-13',
    status: 'paid',
    subtotal: total,
    total_amount: total,
    amount_paid: total,
    lines: mapped,
    notes: note,
    location_code: hub.code,
    delivered_by: 'Bernard Fiagbey',
    received_by: 'Harry Coleman',
    source: 'lock-app',
  }]);

  const products = mapped.map((l) => ({
    id: l.product_id,
    name: l.name,
    sku: 'OPH-FM-' + l.product_id.slice(-1),
    category: 'Phones',
    cost_price: l.unit_cost,
    selling_price: 0,
    stock: 0,
    current_stock: 0,
    supplier_id: FRANKO_MADINA.id,
    supplier_name: FRANKO_MADINA.name,
    location_code: hub.code,
    subsidiary_code: 'bnpl',
    source: 'lock-app',
    purchase_ref: FM_REF,
  }));
  mergeById(KEYS.products, products);

  const sales = FM_UNITS.filter((u) => u.order && u.sell).map((u) => ({
    id: 'so-fm-' + u.imei,
    reference: u.order,
    eb_order_id: u.order,
    customer_name: u.customer,
    agent_name: u.sa,
    product_name: u.product,
    sku: u.imei,
    imei: u.imei,
    qty: 1,
    unit_cost: u.cost,
    cost_price: u.cost,
    selling_price: u.sell,
    fiberk_sell: u.sell,
    line_total: u.sell,
    profit: Number(u.sell) - Number(u.cost),
    date: String(u.delivered_at).slice(0, 10),
    delivered_at: u.delivered_at,
    status: 'delivered',
    payment_status: 'hp',
    subsidiary_code: 'bnpl',
    location_code: 'BNPL-FIELD',
    supplier_name: FRANKO_MADINA.name,
    purchase_ref: FM_REF,
    source: 'easybuy',
    note: `Cost ₵${u.cost} · Fiberk sell ₵${u.sell} · profit ₵${Number(u.sell) - Number(u.cost)}`,
  }));
  mergeById('df_sales_orders', sales);

  const sold = FM_UNITS.filter((u) => u.sell).reduce((s, u) => s + Number(u.sell), 0);
  const costSold = FM_UNITS.filter((u) => u.sell).reduce((s, u) => s + Number(u.cost), 0);
  mergeById('df_profit_snaps', [{
    id: 'profit-fm-aug-lock',
    reference: FM_REF,
    units_sold: sales.length,
    units_open: FM_UNITS.filter((u) => !u.sell).length,
    cost_sold: costSold,
    sell_sold: sold,
    profit: sold - costSold,
    as_of: '2026-09-10',
    note: 'Franko Madina Aug lock units vs EasyBuy Fiberk sell',
  }]);

  try {
    appendMovements(FM_UNITS.map((u) => ({
      product_id: u.imei,
      sku: u.imei,
      type: u.sell ? 'sale' : 'purchase_in',
      qty: u.sell ? -1 : 1,
      to_location: u.sell ? '' : hub.code,
      from_location: u.sell ? hub.code : '',
      reference: u.order || FM_REF,
      note: u.customer || 'Removable — no EasyBuy match',
      created_at: u.delivered_at || u.exp,
    })));
  } catch { /* mov */ }

  try { attachImeiToInvoices(); } catch { /* */ }
  try { localStorage.setItem(FLAG, '1'); } catch { /* */ }
  return { purchase, sales, total, profit: sold - costSold, sold, costSold };
}
