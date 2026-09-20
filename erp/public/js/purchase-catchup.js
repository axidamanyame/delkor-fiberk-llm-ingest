/** HQ purchases catch-up: UBA stock payments with no live PO. Never writes Fiberkapp silo rows. */
import { uid, loadRows, saveRow, deleteRow, esc } from './ls-rows.js';
import { ensureBankBooks, ledgerRows, linkTransaction } from './bank-ledger.js';
import { classifyRemark } from './uba-fiberk-book.js';
import { excludeMigrated } from './fiberk-silo.js';
import { fmt } from './supabaseClient.js';

export const TABLE = 'purchase_catchup';
export const KEY = 'df_purchase_catchup';
export const PO_TABLE = 'purchase_orders';
export const PO_KEY = 'df_purchase_orders';

const STOCK_HINT = /franko|creditor|spark|smart\s?20|pop\s?20|\bphones?\b|inventory|stock|supplier/i;
const SKIP_CAT = new Set(['salary', 'payroll', 'rent', 'momo', 'transfer', 'charges', 'collection', 'loan']);

export function cedi(n) {
  return fmt(Number(n || 0));
}

export function isStockDebit(row) {
  const debit = Number(row.debit || row.withdrawal || 0);
  if (debit <= 0) return false;
  const cat = String(row.category || classifyRemark(row.description || row.remarks).category || '').toLowerCase();
  if (SKIP_CAT.has(cat) || cat === 'bank_charge') return false;
  if (cat === 'purchase' || cat === 'phone_inventory') return true;
  return STOCK_HINT.test(String(row.description || row.remarks || row.payee || ''));
}

function moneyClose(a, b) {
  return Math.abs(Number(a || 0) - Number(b || 0)) < 1;
}

function daysApart(a, b) {
  const da = Date.parse(String(a || '').slice(0, 10));
  const db = Date.parse(String(b || '').slice(0, 10));
  if (!Number.isFinite(da) || !Number.isFinite(db)) return 99;
  return Math.abs(da - db) / 864e5;
}

function livePurchases() {
  const raw = [
    ...(JSON.parse(localStorage.getItem('df_purchase_orders') || '[]') || []),
    ...(JSON.parse(localStorage.getItem('df_purchases') || '[]') || []),
  ];
  return excludeMigrated(raw);
}

function matchLivePo(txn, purchases) {
  const debit = Number(txn.debit || 0);
  const date = txn.transaction_date || txn.txn_date;
  const inst = String(txn.instrument_id || '');
  const payee = String(txn.payee || '').toLowerCase();
  return purchases.find((p) => {
    if (inst && String(p.reference || p.invoice_reference || '').includes(inst)) return true;
    if (String(p.uba_txn_id || '') === String(txn.id)) return true;
    const amt = Number(p.grand_total || p.amount_paid || 0);
    if (!moneyClose(amt, debit)) return false;
    if (daysApart(p.date || p.order_date, date) > 14) return false;
    if (payee && String(p.supplier_name || '').toLowerCase() && !String(p.supplier_name || '').toLowerCase().includes(payee.slice(0, 6))) {
      return true;
    }
    return true;
  }) || null;
}

import { ensureOpeningPurchaseDues } from './opening-dues.js';
import { applyStockUbaToFranko } from './stock-uba-match.js';

export async function loadCatchupDesk() {
  await ensureBankBooks();
  try { ensureOpeningPurchaseDues(); } catch { /* */ }
  try { await applyStockUbaToFranko(); } catch { /* */ }
  const bills = await loadRows(TABLE, KEY, []);
  const purchases = livePurchases();
  const debits = ledgerRows({}).filter(isStockDebit);
  const byTxn = new Map(bills.map((b) => [String(b.uba_txn_id), b]));

  const queue = debits.map((txn) => {
    const bill = byTxn.get(String(txn.id));
    const po = matchLivePo(txn, purchases);
    let status = 'unmatched';
    if (bill?.status === 'ignored') status = 'ignored';
    else if (bill?.status === 'billed' || bill?.purchase_id || po) status = 'billed';
    return {
      ...txn,
      amount: Number(txn.debit || 0),
      bill,
      purchase: po,
      status,
    };
  });

  const unmatched = queue.filter((r) => r.status === 'unmatched');
  const billed = queue.filter((r) => r.status === 'billed');
  const ignored = queue.filter((r) => r.status === 'ignored');
  const gap = unmatched.reduce((s, r) => s + r.amount, 0);
  const booked = billed.reduce((s, r) => s + r.amount, 0);
  return { bills, queue, unmatched, billed, ignored, gap, booked, purchases };
}

export async function bookCatchup(txn, fields, actor) {
  const amount = Number(fields.amount || txn.amount || txn.debit || 0);
  const po = {
    id: fields.purchase_id || ('po-cu-' + String(txn.id || uid()).replace(/[^a-z0-9]/gi, '').slice(-14)),
    date: fields.bill_date || txn.transaction_date,
    order_date: fields.bill_date || txn.transaction_date,
    reference: fields.reference || ('CU-' + String(txn.instrument_id || txn.id || uid()).slice(-10)),
    supplier_name: fields.supplier_name || txn.payee || 'Stock creditor',
    status: 'received',
    purchase_status: 'received',
    payment_status: 'paid',
    grand_total: amount,
    total_amount: amount,
    amount_paid: amount,
    payment_due: 0,
    notes: fields.notes || (txn.description || ''),
    source: 'catchup',
    uba_txn_id: txn.id,
    subsidiary_code: 'fiberk',
    location_code: fields.location_code || 'FIB-SHOP',
    added_by: actor || 'HQ catch-up',
  };
  await saveRow(PO_TABLE, PO_KEY, po);
  const bill = {
    id: fields.id || ('cu-' + String(txn.id || uid())),
    uba_txn_id: txn.id,
    purchase_id: po.id,
    supplier_name: po.supplier_name,
    bill_date: po.date,
    amount,
    reference: po.reference,
    notes: po.notes,
    status: 'billed',
    location_code: po.location_code,
    created_by: actor || '',
  };
  await saveRow(TABLE, KEY, bill);
  try { linkTransaction(txn.id, 'purchase', po.id, po.reference); } catch { /* local ok */ }
  return { po, bill };
}

export async function ignoreCatchup(txn, actor) {
  const bill = {
    id: 'cu-' + String(txn.id || uid()),
    uba_txn_id: txn.id,
    supplier_name: txn.payee || '',
    bill_date: txn.transaction_date,
    amount: Number(txn.debit || 0),
    reference: txn.instrument_id || '',
    notes: txn.description || '',
    status: 'ignored',
    created_by: actor || '',
  };
  return saveRow(TABLE, KEY, bill);
}

export async function deleteCatchup(bill) {
  if (bill?.purchase_id) {
    await deleteRow(PO_TABLE, PO_KEY, bill.purchase_id);
  }
  return deleteRow(TABLE, KEY, bill.id);
}

export { esc };
