/** Remaining supplier dues settled from EasyBuy reimbursement into Fiberk MoMo. Receipts later. */
import { readLs, writeLs } from './ls-rows.js';
import { applyPurchasePayment, ensureOpeningPurchaseDues } from './opening-dues.js';

const FLAG = 'df_eb_momo_settle_v1';
const NOTE = 'Settled from EasyBuy reimbursement into MoMo 0541093516. Supplier receipt to attach later. No amount owing.';

function dueOf(r) {
  const total = Number(r.total_amount ?? r.grand_total ?? 0);
  const paid = Number(r.amount_paid || 0);
  return Math.max(0, total - paid);
}

export async function settleSuppliersFromEasybuyMomo() {
  if (typeof localStorage !== 'undefined' && localStorage.getItem(FLAG) === '1') return { skipped: true };
  ensureOpeningPurchaseDues();
  const books = [...readLs('df_purchase_orders', []), ...readLs('df_purchases', [])];
  const seen = new Set();
  const settled = [];
  for (const row of books) {
    const id = String(row.id || '');
    if (!id || seen.has(id)) continue;
    seen.add(id);
    if (String(row.source || '') === 'fiberkapp') continue;
    const due = dueOf(row);
    if (due <= 0.004) continue;
    await applyPurchasePayment(id, {
      amount: due,
      method: 'momo',
      paid_on: '2026-09-10T12:00',
      note: NOTE,
    });
    settled.push({ id, ref: row.reference || row.reference_no, supplier: row.supplier_name, amount: due });
  }
  const inv = (readLs('df_purchase_invoices', []) || []).map((r) => {
    const due = dueOf(r);
    if (due <= 0.004) return r;
    if (String(r.source || '') === 'fiberkapp') return r;
    return {
      ...r,
      amount_paid: Number(r.amount_paid || 0) + due,
      payment_due: 0,
      status: 'paid',
      payment_status: 'paid',
      last_payment: { amount: due, method: 'momo', paid_on: '2026-09-10', note: NOTE },
    };
  });
  writeLs('df_purchase_invoices', inv);
  try { localStorage.setItem(FLAG, '1'); } catch { /* */ }
  return { settled, total: settled.reduce((s, r) => s + r.amount, 0) };
}
