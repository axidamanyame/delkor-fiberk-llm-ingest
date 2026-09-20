/**
 * Cross-module posting: ops_documents + ledger_entries/lines.
 * POS, purchases, expenses, returns all call these so Reports and Accounting stay in sync.
 */
import { supabase, getActiveSubsidiary, operatingCode } from './supabaseClient.js';
import { getActiveLocation } from './scope.js';

function today() {
  return new Date().toISOString().slice(0, 10);
}

export function scopeStamp() {
  const sub = operatingCode(getActiveSubsidiary()) || getActiveSubsidiary()?.code || null;
  const loc = getActiveLocation() || null;
  return { subsidiary_code: sub && sub !== 'group' ? sub : null, location_code: loc };
}

/** Insert an ops document + optional lines. Never throws — callers keep working if SQL not run. */
export async function postOpsDocument({
  doc_type, doc_no, status = 'posted', partner_name, total_amount = 0,
  paid = 0, billed = 0, notes, lines = [], extra = {},
}) {
  const stamp = scopeStamp();
  const row = {
    doc_type,
    doc_no,
    status,
    doc_date: extra.doc_date || today(),
    partner_name: partner_name || null,
    total_amount: Number(total_amount) || 0,
    paid: Number(paid) || 0,
    billed: Number(billed) || 0,
    notes: notes || null,
    ...stamp,
    ...extra,
  };
  delete row.lines;
  const { data, error } = await supabase.from('ops_documents').insert(row).select('id').single();
  if (error) {
    console.warn('postOpsDocument', error.message);
    return { id: null, error };
  }
  for (const L of lines) {
    const { error: le } = await supabase.from('ops_lines').insert({
      doc_id: data.id,
      product_id: L.product_id || L.id || null,
      sku: L.sku || null,
      product_name: L.product_name || L.name || null,
      quantity: Number(L.quantity || L.qty || 0),
      unit_cost: Number(L.unit_cost || L.cost || L.price || 0),
      unit_price: Number(L.unit_price || L.price || 0),
    });
    if (le) console.warn('ops_lines', le.message);
  }
  return { id: data.id, error: null };
}

/** Balanced journal. accounts: [{ code, debit, credit }] */
export async function postLedger({ doc_no, memo, source_type, accounts = [] }) {
  const stamp = scopeStamp();
  const { data: ent, error } = await supabase.from('ledger_entries').insert({
    entry_date: today(),
    doc_no,
    memo: memo || doc_no,
    source_type: source_type || 'ops',
    ...stamp,
  }).select('id').single();
  if (error) {
    console.warn('postLedger', error.message);
    return { error };
  }
  for (const a of accounts.filter((x) => Number(x.debit) || Number(x.credit))) {
    const { error: le } = await supabase.from('ledger_lines').insert({
      entry_id: ent.id,
      account_code: a.code,
      debit: Number(a.debit) || 0,
      credit: Number(a.credit) || 0,
    });
    if (le) console.warn('ledger_lines', le.message);
  }
  return { id: ent.id, error: null };
}

/** POS / office sale → ops + GL (cash/AR, VAT, COGS). */
export async function postSaleDocument({
  reference, customer, total, tax = 0, subtotal = 0, paid, status, lines = [],
}) {
  const isDraft = /draft|quot/i.test(status || '');
  const paidAmt = paid != null ? Number(paid) : (isDraft ? 0 : Number(total) || 0);
  await postOpsDocument({
    doc_type: isDraft ? ( /quot/i.test(status || '') ? 'quotation' : 'draft') : 'sale',
    doc_no: reference,
    status: isDraft ? 'draft' : 'completed',
    partner_name: customer || 'Walk-In Customer',
    total_amount: total,
    paid: paidAmt,
    notes: 'POS / sell',
    lines,
  });
  if (isDraft) return;
  const net = Number(subtotal) || Math.max(0, Number(total) - Number(tax));
  const vat = Number(tax) || 0;
  const cogs = net * 0.72;
  const cash = paidAmt;
  const ar = Math.max(0, Number(total) - cash);
  await postLedger({
    doc_no: reference,
    memo: 'Sale ' + reference,
    source_type: 'sales_order',
    accounts: [
      { code: '1000', debit: cash, credit: 0 },
      { code: '1200', debit: ar, credit: 0 },
      { code: '4000', debit: 0, credit: net },
      { code: '2100', debit: 0, credit: vat },
      { code: '5000', debit: cogs, credit: 0 },
      { code: '1100', debit: 0, credit: cogs },
    ],
  });
}

/** Received purchase → inventory + AP/cash. */
export async function postPurchaseDocument({
  reference, supplier, total, paid = 0, status, lines = [], notes,
}) {
  await postOpsDocument({
    doc_type: 'purchase',
    doc_no: reference,
    status: status || 'received',
    partner_name: supplier,
    total_amount: total,
    paid,
    notes,
    lines,
  });
  if (!/received|completed/i.test(status || 'received')) return;
  const amt = Number(total) || 0;
  const pay = Number(paid) || 0;
  await postLedger({
    doc_no: reference,
    memo: 'Purchase ' + reference,
    source_type: 'purchase_order',
    accounts: [
      { code: '1100', debit: amt, credit: 0 },
      { code: '2000', debit: 0, credit: Math.max(0, amt - pay) },
      { code: '1000', debit: 0, credit: pay },
    ],
  });
}

export async function postExpenseDocument({ reference, vendor, total, notes, category }) {
  await postOpsDocument({
    doc_type: 'expense',
    doc_no: reference,
    status: 'posted',
    partner_name: vendor,
    total_amount: total,
    paid: total,
    notes: [category, notes].filter(Boolean).join(' · '),
  });
  await postLedger({
    doc_no: reference,
    memo: notes || 'Expense',
    source_type: 'expense',
    accounts: [
      { code: '6000', debit: Number(total) || 0, credit: 0 },
      { code: '1000', debit: 0, credit: Number(total) || 0 },
    ],
  });
}

export async function postReturnDocument({ reference, customer, total, original }) {
  await postOpsDocument({
    doc_type: 'sell_return',
    doc_no: reference,
    status: 'completed',
    partner_name: customer,
    total_amount: total,
    notes: original ? 'Return of ' + original : 'Sell return',
  });
  const amt = Number(total) || 0;
  await postLedger({
    doc_no: reference,
    memo: 'Sell return ' + reference,
    source_type: 'sell_return',
    accounts: [
      { code: '4000', debit: amt, credit: 0 },
      { code: '1000', debit: 0, credit: amt },
    ],
  });
}

/** SKU = first 3 of subsidiary + 4 digits + first 3 of brand. */
export function makeSku(subsidiaryCode, brand, seq) {
  const a = String(subsidiaryCode || 'xxx').replace(/[^a-z]/gi, '').slice(0, 3).toUpperCase().padEnd(3, 'X');
  const b = String(brand || 'xxx').replace(/[^a-z]/gi, '').slice(0, 3).toUpperCase().padEnd(3, 'X');
  return a + String(seq).padStart(4, '0') + b;
}

export async function nextSku(subsidiaryCode, brand) {
  const prefix = String(subsidiaryCode || 'xxx').slice(0, 3).toUpperCase();
  const { data } = await supabase.from('products').select('sku').ilike('sku', prefix + '%').limit(800);
  let max = 0;
  (data || []).forEach((r) => {
    const m = String(r.sku || '').match(/^[A-Z]{3}(\d{4})[A-Z]{3}$/);
    if (m) max = Math.max(max, Number(m[1]));
  });
  return makeSku(subsidiaryCode, brand, max + 1);
}
