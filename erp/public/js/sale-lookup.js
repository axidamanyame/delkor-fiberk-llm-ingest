/** One live sale book: till tickets + EasyBuy Field Ops contracts. */
import { readLs, writeLs } from './ls-rows.js';
import { loadOrders } from './bnpl-field-orders.js';
import { loadPayments } from './bnpl-field-payments.js';
import { peekSilo } from './live-share.js';

const SALE_KEY = 'df_sales_orders';

export function hpAsSale(r, pay = {}) {
  if (!r) return null;
  const price = Number(r.price || pay.transfer_amount || 0);
  const deposit = Number(pay.downpayment || r.downpayment || 0);
  const loan = Number(r.loan_amount || Math.max(0, price - deposit));
  const paid = deposit || Math.max(0, price - loan);
  const id = String(r.order_id || r.id || r.apply_no || '');
  return {
    id,
    reference: id,
    invoice_no: id,
    so_number: pay.eb_order_id || '',
    customer_name: r.customer_name || pay.customer_name || '',
    phone: r.phone || pay.phone || '',
    total_amount: price,
    amount_paid: paid,
    loan_amount: loan,
    payment_status: loan > 0.004 ? 'partial' : 'paid',
    status: r.status || 'Normal',
    order_date: String(r.delivery_at || pay.delivery_at || '').slice(0, 10),
    delivery_at: r.delivery_at || pay.delivery_at || '',
    created_at: r.delivery_at || pay.transfer_at || '',
    sale_channel: 'field-hp',
    source: 'easybuy',
    channel: 'field',
    subsidiary_code: r.subsidiary_code || 'bnpl',
    location_code: r.location_code || 'BNPL-FIELD',
    location_name: r.location_name || 'BNPL Field',
    imei: r.imei || pay.imei || '',
    brand_type: r.brand_type || [pay.brand, pay.type].filter(Boolean).join(' '),
    sa_name: r.sa_name || pay.sa_name || '',
    sa_id: pay.sa_id || r.sa_id || '',
    pos_name: r.pos_name || pay.pos_name || 'FIBERK PHONES DSA',
    apply_no: r.order_id || pay.apply_no || id,
    eb_order_id: pay.eb_order_id || '',
    notes: '',
    sale_note: '',
    added_by: r.sa_name || pay.sa_name || '',
    created_by_name: r.sa_name || pay.sa_name || '',
    lines: [{
      name: r.brand_type || pay.brand_type || 'Handset',
      sku: r.imei || '',
      qty: 1,
      quantity: 1,
      unit_price: price,
      imei: r.imei || pay.imei || '',
    }],
    live: true,
    book: 'hp-partnership',
  };
}

export async function syncHpSalesIntoBook() {
  const [orders, pays] = await Promise.all([
    loadOrders().catch(() => []),
    loadPayments().catch(() => []),
  ]);
  const byApply = new Map((pays || []).map((p) => [String(p.apply_no || p.id), p]));
  const mapped = (orders || []).map((o) => hpAsSale(o, byApply.get(String(o.order_id || o.id)) || {}));
  const local = readLs(SALE_KEY, []) || [];
  const m = new Map();
  local.forEach((r) => {
    const k = String(r.id || r.reference || '');
    if (k) m.set(k, r);
  });
  mapped.forEach((r) => {
    if (!r?.id) return;
    m.set(r.id, { ...(m.get(r.id) || {}), ...r });
  });
  const next = [...m.values()];
  writeLs(SALE_KEY, next);
  return next;
}

export async function findSale(id) {
  const want = String(id || '').trim();
  if (!want) return null;
  const local = readLs(SALE_KEY, []) || [];
  let hit = local.find((r) => [r.id, r.reference, r.invoice_no, r.apply_no, r.imei].some((x) => String(x || '') === want));
  if (hit) return hit;
  try {
    const { supabase } = await import('./supabaseClient.js');
    const { data } = await supabase.from('sales_orders').select('*').eq('id', want).maybeSingle();
    if (data) return data;
  } catch { /* local */ }
  const [orders, pays] = await Promise.all([
    loadOrders().catch(() => []),
    loadPayments().catch(() => []),
  ]);
  const o = (orders || []).find((r) => [r.order_id, r.id, r.imei].some((x) => String(x || '') === want));
  const p = (pays || []).find((r) => [r.apply_no, r.id, r.imei, r.eb_order_id].some((x) => String(x || '') === want));
  if (o || p) {
    const sale = hpAsSale(o || p, p || {});
    const next = [...local.filter((r) => String(r.id) !== sale.id), sale];
    writeLs(SALE_KEY, next);
    return sale;
  }
  try {
    const peeked = await peekSilo('sales', want);
    if (peeked) return peeked;
  } catch { /* silo optional */ }
  return null;
}
