/**
 * How desks share books.
 * Live tables include Fiberkapp rows after the hard fork.
 * peekSilo still resolves a single historic card when the compact live row is thin.
 */
import { readLs } from './ls-rows.js';
import { excludeMigrated, isMigratedRow, loadSilo } from './fiberk-silo.js';

const mem = (typeof window !== 'undefined')
  ? (window.__df_silo_peek || (window.__df_silo_peek = { packs: {}, at: 0 }))
  : { packs: {}, at: 0 };

export const BOOKS = {
  sales: 'df_sales_orders',
  purchases: 'df_purchases',
  purchase_orders: 'df_purchase_orders',
  products: 'df_products',
  customers: 'df_customers',
  suppliers: 'df_suppliers',
  expenses: 'df_expenses',
  field_orders: 'df_bnpl_field_orders',
  field_payments: 'df_bnpl_field_payments',
  collections: 'df_easybuy_collections',
};

export function liveRows(key) {
  return excludeMigrated(readLs(key, []) || []);
}

export function liveSales() {
  const sales = liveRows(BOOKS.sales);
  const hp = readLs(BOOKS.field_orders, []) || [];
  const seen = new Set(sales.map((r) => String(r.id || r.reference || '')));
  hp.forEach((r) => {
    const id = String(r.order_id || r.id || '');
    if (!id || seen.has(id)) return;
    seen.add(id);
    sales.push({
      id,
      reference: id,
      customer_name: r.customer_name,
      phone: r.phone,
      total_amount: Number(r.price || 0),
      amount_paid: Math.max(0, Number(r.price || 0) - Number(r.loan_amount || 0)),
      order_date: String(r.delivery_at || '').slice(0, 10),
      source: 'easybuy',
      sale_channel: 'field-hp',
      imei: r.imei,
      live: true,
    });
  });
  return sales;
}

export function livePurchases() {
  const a = liveRows(BOOKS.purchases);
  const b = liveRows(BOOKS.purchase_orders);
  const m = new Map();
  [...a, ...b].forEach((r) => { if (r?.id) m.set(String(r.id), r); });
  return [...m.values()];
}

function matchRow(r, needle) {
  const want = String(needle || '').trim().toLowerCase();
  if (!want) return false;
  const keys = [
    r.id, r.reference, r.invoice_no, r.apply_no, r.order_id, r.imei,
    r.sku, r.phone, r.mobile, r.name, r.customer_name, r.supplier_name,
    r.contact_code, r.so_number,
  ];
  return keys.some((x) => String(x || '').trim().toLowerCase() === want
    || (want.length >= 7 && String(x || '').toLowerCase().includes(want)));
}

export async function peekSilo(kind, needle) {
  const want = String(needle || '').trim();
  if (!want) return null;
  if (!mem.packs[kind]) {
    try {
      const pack = await loadSilo(kind);
      mem.packs[kind] = pack.rows || [];
    } catch {
      mem.packs[kind] = [];
    }
  }
  const hit = (mem.packs[kind] || []).find((r) => matchRow(r, want));
  if (!hit) return null;
  return { ...hit, source: hit.source || 'fiberkapp', session_peek: true, silo: kind };
}

export async function resolveRecord(kind, id) {
  const liveKey = {
    sales: BOOKS.sales,
    purchases: BOOKS.purchases,
    products: BOOKS.products,
    customers: BOOKS.customers,
    suppliers: BOOKS.suppliers,
  }[kind];
  if (liveKey) {
    const live = (readLs(liveKey, []) || []).find((r) => matchRow(r, id));
    if (live) return { ...live, book: 'live' };
  }
  if (kind === 'sales') {
    const hp = (readLs(BOOKS.field_orders, []) || []).find((r) => matchRow(r, id));
    if (hp) return { ...hp, book: 'live', source: 'easybuy' };
  }
  const peeked = await peekSilo(kind, id);
  return peeked ? { ...peeked, book: 'silo-session' } : null;
}

export function reportBundle() {
  const sales = liveSales();
  const purchases = livePurchases();
  const expenses = liveRows(BOOKS.expenses);
  const fieldPays = readLs(BOOKS.field_payments, []) || [];
  const sold = sales.reduce((s, r) => s + Number(r.total_amount || r.price || 0), 0);
  const paid = sales.reduce((s, r) => s + Number(r.amount_paid || 0), 0);
  const bought = purchases.reduce((s, r) => s + Number(r.grand_total || r.total_amount || 0), 0);
  const spent = expenses.reduce((s, r) => s + Number(r.amount || r.total || 0), 0);
  return {
    sales,
    purchases,
    expenses,
    fieldPays,
    totals: {
      sales: sold,
      sales_paid: paid,
      sales_due: Math.max(0, sold - paid),
      purchases: bought,
      expenses: spent,
    },
    presentation: {
      live_stamp: 'Live book',
      silo_stamp: 'Migrated · session peek only',
    },
  };
}
