/** Opening purchase payment dues from DELKOR II FIBERK Home — live table, not Migrated Data. */
import { fmt } from './supabaseClient.js';
import { uid, readLs, writeLs } from './ls-rows.js';
import { peelWrite } from './account-rules.js';
import { confirmAction, ackResult } from './confirm-action.js';

const OPENING_PO_FLAG = 'df_opening_po_dues_v1';
const OPENING_PO_DUES = [
  { supplier_name: 'MR JEREMIAH ODJEAWO', reference: 'PO2026/0134', due: 9810 },
  { supplier_name: 'MR JEREMIAH ODJEAWO', reference: 'PO2026/0135', due: 12085 },
  { supplier_name: 'MR JEREMIAH ODJEAWO', reference: 'PO2026/0136', due: 4659 },
  { supplier_name: 'MR JEREMIAH ODJEAWO', reference: 'PO2026/0137', due: 17756 },
  { supplier_name: 'MR JEREMIAH ODJEAWO', reference: 'PO2026/0138', due: 23554 },
  { supplier_name: 'MR JEREMIAH ODJEAWO', reference: 'PO2026/0143', due: 29030 },
  { supplier_name: 'MR JEREMIAH ODJEAWO', reference: 'PO2026/0146', due: 1553 },
  { supplier_name: 'MR JEREMIAH ODJEAWO', reference: 'PO2026/0147', due: 1553 },
  { supplier_name: 'FRANKO MADINA', reference: 'PO2026/0148', due: 9597 },
  { supplier_name: 'FRANKO MADINA', reference: 'PO2026/0152', due: 9468 },
  { supplier_name: 'MR JEREMIAH ODJEAWO', reference: 'PO2026/0153', due: 12429 },
  { supplier_name: 'MR JEREMIAH ODJEAWO', reference: 'PO2026/0154', due: 11800 },
  { supplier_name: 'FRANKO MADINA', reference: 'PO2026/0155', due: 4860 },
  { supplier_name: 'FRANKO MADINA', reference: 'PO2026/0157', due: 8518 },
  { supplier_name: 'FRANKO MADINA', reference: 'PO2026/0158', due: 8330 },
  { supplier_name: 'FRANKO MADINA', reference: 'PO2026/0162', due: 8330 },
  { supplier_name: 'FRANKO MADINA', reference: 'PO2026/0164', due: 8824 },
];

function esc(s) {
  return String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&', '<': '<', '>': '>', '"': '"', "'": '&#39;' }[c]));
}

export function refKey(r) {
  return String(r?.reference || r?.reference_no || r?.ref_no || '').replace(/\s+/g, '').toUpperCase();
}

function refOf(r) {
  return String(r?.reference || r?.reference_no || '').replace(/\s+/g, '').toUpperCase();
}

export function findPurchaseLocal(id) {
  const books = [
    ...readLs('df_purchase_orders', []),
    ...readLs('df_purchases', []),
    ...readLs('df_fiberk_purchases', []),
  ];
  let hit = books.find((r) => String(r.id) === String(id) || refOf(r) === String(id).replace(/\s+/g, '').toUpperCase()) || null;
  if (hit && !(hit.lines || hit.items || []).length) {
    const filled = books.find((r) => refOf(r) === refOf(hit) && (r.lines || r.items || []).length);
    if (filled) hit = { ...hit, lines: filled.lines || filled.items, items: filled.lines || filled.items };
  }
  return hit;
}

function writeBoth(row) {
  const upsert = (key) => {
    const rows = readLs(key, []);
    const i = rows.findIndex((p) => String(p.id) === String(row.id) || refKey(p) === refKey(row));
    if (i >= 0) rows[i] = { ...rows[i], ...row };
    else rows.unshift(row);
    writeLs(key, rows);
  };
  upsert('df_purchase_orders');
  upsert('df_purchases');
}

export function ensureOpeningPurchaseDues() {
  const existing = [...readLs('df_purchase_orders', []), ...readLs('df_purchases', [])];
  const have = new Set(existing.map(refKey).filter(Boolean));
  const missing = OPENING_PO_DUES.filter((d) => !have.has(d.reference.replace(/\s+/g, '').toUpperCase()));
  const made = [];
  for (const d of missing) {
    const row = {
      id: 'po-due-' + d.reference.replace(/\W+/g, '-'),
      supplier_name: d.supplier_name,
      reference: d.reference,
      reference_no: d.reference,
      order_date: '2026-09-06',
      date: '2026-09-06',
      total_amount: d.due,
      grand_total: d.due,
      amount_paid: 0,
      payment_due: d.due,
      payment_status: 'due',
      status: 'pending',
      opening_due: true,
      source: 'fiberk-home-due',
      note: 'Opening balance of payment from DELKOR II FIBERK Home · Purchase Payment Due. Catch-up due only until invoice lines are added.',
      lines: [],
      created_at: new Date().toISOString(),
    };
    writeBoth(row);
    made.push(row);
  }
  try { localStorage.setItem(OPENING_PO_FLAG, '1'); } catch { /* ignore */ }
  made.forEach((row) => {
    peelWrite('purchase_orders', row, {}).catch(() => {});
  });
  return [...readLs('df_purchase_orders', []), ...readLs('df_purchases', [])];
}

export async function applyPurchasePayment(id, { amount, method, paid_on, note } = {}) {
  const add = Number(amount || 0);
  if (!(add > 0)) return { ok: false, error: 'Enter a payment amount.' };
  const row = findPurchaseLocal(id);
  if (!row) return { ok: false, error: 'Purchase not found.' };
  const total = Number(row.total_amount ?? row.grand_total ?? 0);
  const paid = Number(row.amount_paid || 0) + add;
  const due = Math.max(0, total - paid);
  const next = {
    ...row,
    amount_paid: paid,
    payment_due: due,
    payment_status: due <= 0.004 ? 'paid' : (paid > 0 ? 'partial' : 'due'),
    last_payment: { amount: add, method: method || 'cash', paid_on: paid_on || new Date().toISOString(), note: note || '' },
    payments: [...(row.payments || []), { id: uid(), amount: add, method: method || 'cash', paid_on: paid_on || new Date().toISOString(), note: note || '' }],
    updated_at: new Date().toISOString(),
  };
  writeBoth(next);
  peelWrite('purchase_orders', next, { id: next.id }).catch(() => {});
  return { ok: true, row: next };
}

export function openAddPurchasePayment(row, onDone) {
  document.getElementById('po-pay-modal')?.remove();
  const due = Math.max(0, Number(row.total_amount ?? row.grand_total ?? 0) - Number(row.amount_paid || 0));
  const wrap = document.createElement('div');
  wrap.id = 'po-pay-modal';
  wrap.className = 'modal';
  wrap.innerHTML = `<div class="box" style="max-width:460px">
    <h3 style="margin:0 0 8px">Add payment</h3>
    <p style="margin:0 0 12px;color:#475569;font-size:13px">${esc(row.supplier_name || '')} · ${esc(row.reference || row.reference_no || '')} · due ${fmt(due)}</p>
    <form id="po-pay-form">
      <label class="fld"><span>Amount *</span><input name="amount" type="number" step="0.01" min="0.01" value="${due}" required /></label>
      <label class="fld"><span>Paid on *</span><input name="paid_on" type="datetime-local" value="${new Date().toISOString().slice(0,16)}" required /></label>
      <label class="fld"><span>Payment method *</span>
        <select name="method">
          ${['cash','momo','bank_transfer','cheque','card','other'].map((m) => `<option value="${m}">${m.replace('_',' ')}</option>`).join('')}
        </select>
      </label>
      <label class="fld"><span>Note</span><textarea name="note" rows="2"></textarea></label>
      <div class="bar" style="justify-content:flex-end;margin-top:12px;display:flex;gap:8px">
        <button type="button" class="ghost" id="po-pay-cancel">Cancel</button>
        <button type="submit" class="go">Record payment</button>
      </div>
    </form>
  </div>`;
  document.body.appendChild(wrap);
  wrap.addEventListener('click', (e) => { if (e.target === wrap) wrap.remove(); });
  wrap.querySelector('#po-pay-cancel').onclick = () => wrap.remove();
  wrap.querySelector('#po-pay-form').onsubmit = async (e) => {
    e.preventDefault();
    const fd = new FormData(e.target);
    const amount = Number(fd.get('amount') || 0);
    if (!(await confirmAction('Record payment of ' + fmt(amount) + '?', 'This reduces the amount due on ' + (row.reference || row.reference_no || 'this bill') + '.'))) return;
    const r = await applyPurchasePayment(row.id, {
      amount,
      method: String(fd.get('method') || 'cash'),
      paid_on: String(fd.get('paid_on') || ''),
      note: String(fd.get('note') || ''),
    });
    wrap.remove();
    if (!r.ok) return ackResult(false, r.error);
    ackResult(true, 'Payment recorded. Remaining due ' + fmt(r.row.payment_due) + '.');
    if (typeof onDone === 'function') onDone(r.row);
  };
}
