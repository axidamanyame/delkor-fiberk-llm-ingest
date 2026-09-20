/** Hire-purchase trail for a phone — uses the live collections / field books. */
import { readLs } from './ls-rows.js';

export async function trailForPhone(phone) {
  const p = String(phone || '').replace(/\D/g, '');
  if (!p) return { phone: '', orders: [], payments: [], calls: [] };
  const match = (row) => String(row.phone || row.mobile || row.contact || '').replace(/\D/g, '').endsWith(p.slice(-9));
  const orders = (readLs('df_bnpl_field_orders', []) || []).filter(match);
  const payments = (readLs('df_bnpl_field_payments', []) || []).filter(match);
  const calls = (readLs('df_collection_calls', []) || []).filter(match);
  return { phone, orders, payments, calls };
}

export function trailCard(t) {
  const n = (t?.orders?.length || 0) + (t?.payments?.length || 0) + (t?.calls?.length || 0);
  if (!n) return '<div class="ult-muted">No HP trail on this number.</div>';
  return `<div class="hp-trail"><b>HP trail</b> · ${t.orders.length} orders · ${t.payments.length} payments · ${t.calls.length} calls</div>`;
}
