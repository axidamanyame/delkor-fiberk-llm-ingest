/** June ledger + setup costs → paid POs for the two 15 Jun UBA phone payments. */
import { readLs, writeLs, uid } from './ls-rows.js';
import { applyPurchasePayment, ensureOpeningPurchaseDues } from './opening-dues.js';

const FLAG = 'df_june_ledger_uba_v1';
const SPARK_COST = 1645.5; // 32910 / 20 from UBA “Twenty Spark 50”

const SPARK20 = [
  { dest: 'Mercy', qty: 1 }, { dest: 'Diana', qty: 4 }, { dest: 'Ivy', qty: 1 },
  { dest: 'Akinola', qty: 2 }, { dest: 'F. Easybuy (E. Baaba)', qty: 2 },
  { dest: 'Annabel', qty: 4 }, { dest: 'Ishmael', qty: 2 },
  { dest: 'Aaron(Somy.)', qty: 1 }, { dest: 'Nathan (Asut.)', qty: 3 },
];

/** Setup sheet costs. Pop 64 / Smart 64 etc. as typed. */
const VARIOUS = [
  { name: 'INFINIX HOT 70 (4+128G) BLUE', qty: 10, cost: 1380 },
  { name: 'INFINIX SMART 20 (4+64G) BLACK', qty: 5, cost: 1440 },
  { name: 'INFINIX SMART 20 (4+128G) BLACK', qty: 10, cost: 1260 },
  { name: 'ITEL A200 (3+128G)', qty: 3, cost: 1209 },
  { name: 'ITEL A200 (3+64G)', qty: 5, cost: 889 },
  { name: 'TECNO POP 20 (4+64G) BLACK', qty: 10, cost: 1287 },
];

function merge(key, rows) {
  const cur = readLs(key, []) || [];
  const map = new Map(cur.map((r) => [String(r.id), r]));
  rows.forEach((r) => { if (r?.id) map.set(String(r.id), { ...(map.get(String(r.id)) || {}), ...r }); });
  writeLs(key, [...map.values()]);
}

function po(id, ref, amount, lines, note) {
  return {
    id, reference: ref, reference_no: ref,
    supplier_id: 's-franko-madina',
    supplier_name: 'FRANKO MADINA',
    date: '2026-06-15', order_date: '2026-06-15',
    status: 'received', payment_status: 'paid',
    grand_total: amount, total_amount: amount,
    amount_paid: amount, payment_due: 0,
    lines, note,
    delivered_by: 'Bernard Fiagbey',
    received_by: 'Harry Coleman',
    subsidiary_code: 'bnpl',
    location_code: 'BNPL-FIELD',
    source: 'ledger-uba',
    hp_live: true, book: 'hp-partnership', loan_owner: 'easybuy',
  };
}

export function hydrateJuneLedgerPays() {
  const sparkLines = SPARK20.map((r) => ({
    product_name: 'TECNO SPARK 50 (4+128G)',
    name: 'TECNO SPARK 50 (4+128G)',
    qty: r.qty, quantity: r.qty, unit_cost: SPARK_COST, unit_price: SPARK_COST,
    line_total: r.qty * SPARK_COST, dest_agent: r.dest,
  }));
  const sparkPo = po('po-uba-7473459', 'UBA-7473459', 32910, sparkLines,
    'UBA IBG/GIP/7473459 Payment of Twenty Spark 50 Phones. Cost ₵1,645.50 from bank total. Destinations from June ledger.');

  const varLines = VARIOUS.map((r) => ({
    product_name: r.name, name: r.name,
    qty: r.qty, quantity: r.qty, unit_cost: r.cost, unit_price: r.cost,
    line_total: r.qty * r.cost,
  }));
  const sheet = VARIOUS.reduce((s, r) => s + r.qty * r.cost, 0);
  const varPo = po('po-uba-7473610', 'UBA-7473610', 57662, varLines,
    `Franko Trading Limited warehouse slip 15 Jun 2026. Cashier Eric Owusu. 43 units. Lines from paper. Gross + VAT/COVID = ₵57,663. Paid ₵57,662 (stamp PAID). UBA IBG/GIP/7473610 ₵57,672 includes ₵10 UBA transaction charge.`);

  merge('df_purchases', [sparkPo, varPo]);
  merge('df_purchase_orders', [sparkPo, varPo]);
  merge('df_purchase_invoices', [
    { id: 'inv-uba-7473459', reference: 'UBA-7473459', supplier_name: 'FRANKO MADINA', status: 'paid', total_amount: 32910, amount_paid: 32910, invoice_date: '2026-06-15', lines: sparkLines, source: 'ledger-uba' },
    { id: 'inv-uba-7473610', reference: 'UBA-7473610', supplier_name: 'FRANKO MADINA', status: 'paid', total_amount: 57662, amount_paid: 57662, invoice_date: '2026-06-15', lines: varLines, source: 'ledger-uba', attachment_name: 'Franko Invoice Receipt Ghs 57,662.00 15-06-2026.pdf' },
  ]);
  const catchup = readLs('df_purchase_catchup', []) || [];
  ['7473459', '7473610'].forEach((inst) => {
    if (!catchup.some((b) => String(b.instrument_id) === inst)) {
      catchup.push({ id: 'cu-uba-' + inst, instrument_id: inst, status: 'billed', supplier_name: 'FRANKO MADINA', bill_date: '2026-06-15', source: 'ledger-uba' });
    }
  });
  writeLs('df_purchase_catchup', catchup);
  try { localStorage.setItem(FLAG, '1'); } catch { /* */ }
  return { spark: 32910, various: 57662, sheet };
}

const AUG7 = [
  { date: '2026-08-07', amount: 30180, instrument: '7658717', remark: 'Payment of creditor' },
  { date: '2026-08-07', amount: 63459, instrument: '7658708', remark: 'Payment for creditor' },
];

function refOf(r) {
  return String(r?.reference || r?.reference_no || '').replace(/\s+/g, '').toUpperCase();
}

/** Aug 7 lumps have no same-day inbound. Apply FIFO to remaining opening dues (Franko leftover, then Pinaro/Odjeawo). */
export async function applyAug7CreditorLumps() {
  if (typeof localStorage !== 'undefined' && localStorage.getItem('df_aug7_creditor_v1') === '1') return { skipped: true };
  ensureOpeningPurchaseDues();
  const order = [
    'PO2026/0162', 'PO2026/0164',
    'PO2026/0134', 'PO2026/0135', 'PO2026/0136', 'PO2026/0137', 'PO2026/0138',
    'PO2026/0143', 'PO2026/0146', 'PO2026/0147', 'PO2026/0153', 'PO2026/0154',
  ];
  const books = [...readLs('df_purchase_orders', []), ...readLs('df_purchases', [])];
  const applied = [];
  for (const pay of AUG7) {
    let left = pay.amount;
    for (const ref of order) {
      if (left <= 0.004) break;
      const poRow = books.find((r) => refOf(r) === ref);
      if (!poRow) continue;
      const due = Math.max(0, Number(poRow.total_amount ?? poRow.grand_total ?? 0) - Number(poRow.amount_paid || 0));
      if (due <= 0) continue;
      const take = Math.min(due, left);
      await applyPurchasePayment(poRow.id, {
        amount: take, method: 'bank_transfer', paid_on: pay.date + 'T12:00',
        note: `UBA IBG/GIP/${pay.instrument} ${pay.remark}`,
      });
      left -= take;
      applied.push({ ref, take, instrument: pay.instrument });
      poRow.amount_paid = Number(poRow.amount_paid || 0) + take;
    }
    const catchup = readLs('df_purchase_catchup', []) || [];
    if (!catchup.some((b) => String(b.instrument_id) === pay.instrument)) {
      catchup.push({ id: 'cu-uba-' + pay.instrument, instrument_id: pay.instrument, status: 'billed', amount: pay.amount, bill_date: pay.date, notes: pay.remark + (left > 1 ? ` · ₵${left} not on an opening PO` : ''), source: 'ledger-uba' });
      writeLs('df_purchase_catchup', catchup);
    }
  }
  try { localStorage.setItem('df_aug7_creditor_v1', '1'); } catch { /* */ }
  return { applied };
}
