/** Post live purchases, MoMo loan, UBA charge, July payroll into df_acc_journals. */
import { readLs, writeLs, uid } from './ls-rows.js';

const JKEY = 'df_acc_journals';
const AKEY = 'df_chart_of_accounts';
const FLAG = 'df_acc_live_sync_v2';

const LIVE_SRC = new Set([
  'paper-invoice', 'lock-app', 'whatsapp-quote', 'ledger-uba', 'catchup',
  'uba-match', 'hp-live',
]);

function accounts() {
  return readLs(AKEY, []) || [];
}

function pick(name) {
  const list = accounts();
  const hit = list.find((a) => String(a.name || '').toLowerCase() === name.toLowerCase())
    || list.find((a) => String(a.name || '').toLowerCase().includes(name.toLowerCase()));
  return hit || { id: '', name };
}

function upsertJe(je) {
  const rows = readLs(JKEY, []) || [];
  const i = rows.findIndex((r) => String(r.id) === String(je.id));
  if (i >= 0) rows[i] = { ...rows[i], ...je };
  else rows.unshift(je);
  writeLs(JKEY, rows);
}

function je(id, date, ref, note, lines, extra = {}) {
  const day = String(date || '').slice(0, 10);
  const total = lines.reduce((s, l) => s + Number(l.debit || 0), 0);
  upsertJe({
    id,
    journal_date: day,
    operation_date: day,
    ref_no: ref,
    note,
    added_by: extra.added_by || 'HQ',
    status: 'posted',
    subsidiary_code: extra.subsidiary_code || 'fiberk',
    location_code: extra.location_code || '',
    total,
    source: extra.source || 'live-sync',
    source_id: extra.source_id || id,
    lines: lines.map((l) => ({ id: uid(), ...l })),
    created_at: new Date().toISOString(),
  });
}

function livePurchases() {
  const raw = [...readLs('df_purchases', []), ...readLs('df_purchase_orders', [])];
  const map = new Map();
  raw.forEach((r) => {
    if (!r?.id) return;
    if (String(r.source || '') === 'fiberkapp') return;
    if (!LIVE_SRC.has(String(r.source || '')) && !r.hp_live && !/^po-uba-|^pin-|^po-fm-|^po-rabi|^po-cu-/.test(String(r.id))) {
      if (Number(r.grand_total || r.total_amount || 0) <= 0) return;
    }
    map.set(String(r.id), r);
  });
  return [...map.values()];
}

export function syncLiveAccounting() {
  const inv = pick('Uncategorised Asset');
  const ap = pick('Accounts Payable (A/P)');
  const bank = pick('Bank');
  const momo = pick('Mobile Money');
  const exp = pick('Expenses');
  const payroll = pick('Payroll Expenses');
  const liab = pick('Current liabilities');

  livePurchases().forEach((p) => {
    const amt = Number(p.grand_total || p.total_amount || 0);
    if (!(amt > 0)) return;
    const day = p.date || p.order_date || p.invoice_date;
    const ref = String(p.reference || p.reference_no || p.id);
    je(
      'je-live-po-' + p.id,
      day,
      'JE-' + ref.replace(/\//g, '-'),
      `Purchase ${ref} · ${p.supplier_name || ''} · inventory in`,
      [
        { account_id: inv.id, account: inv.name || 'Uncategorised Asset', debit: amt, credit: 0, note: 'Stock' },
        { account_id: ap.id, account: ap.name || 'Accounts Payable (A/P)', debit: 0, credit: amt, note: 'Supplier bill' },
      ],
      { subsidiary_code: p.subsidiary_code || 'fiberk', location_code: p.location_code, source: 'live-sync', source_id: p.id, added_by: p.added_by },
    );
    const paid = Number(p.amount_paid || 0);
    if (paid > 0) {
      const viaMomo = /momo/i.test(JSON.stringify(p.payments || p.last_payment || {}));
      const cash = viaMomo ? momo : bank;
      je(
        'je-live-pay-' + p.id,
        (p.last_payment && p.last_payment.paid_on) || day,
        'JE-PAY-' + ref.replace(/\//g, '-'),
        `Payment ${ref} · ${p.supplier_name || ''}`,
        [
          { account_id: ap.id, account: ap.name || 'Accounts Payable (A/P)', debit: paid, credit: 0, note: 'Settle bill' },
          { account_id: cash.id, account: cash.name || (viaMomo ? 'Mobile Money' : 'Bank'), debit: 0, credit: paid, note: viaMomo ? 'MoMo' : 'UBA / bank' },
        ],
        { subsidiary_code: p.subsidiary_code || 'fiberk', source: 'live-sync', source_id: p.id },
      );
    }
  });

  je(
    'je-uba-chg-7473610',
    '2026-06-15',
    'JE-UBA-CHG-7473610',
    'UBA IBG/GIP/7473610 transaction charge ₵10',
    [
      { account_id: exp.id, account: exp.name || 'Expenses', debit: 10, credit: 0, note: 'Bank charge' },
      { account_id: bank.id, account: bank.name || 'Bank', debit: 0, credit: 10, note: 'UBA' },
    ],
    { source: 'live-sync' },
  );

  je(
    'je-loan-phoebe-bernard',
    '2026-07-16',
    'JE-LOAN-10000',
    'Phoebe Kyei-Boateng → Fiagbey Bernard ₵10,000 parked in Fiberk MoMo 0541093516',
    [
      { account_id: momo.id, account: momo.name || 'Mobile Money', debit: 10000, credit: 0, note: 'Txn 85497209940' },
      { account_id: liab.id, account: liab.name || 'Current liabilities', debit: 0, credit: 10000, note: 'Due to Bernard (personal loan)' },
    ],
    { source: 'live-sync' },
  );

  const pays = (readLs('df_hrm_payroll', []) || []).filter((r) => r.period === '2026-07');
  const payTotal = pays.reduce((s, r) => s + Number(r.net || r.net_pay || 0), 0);
  if (payTotal > 0) {
    je(
      'je-payroll-2026-07',
      '2026-07-31',
      'JE-PAYROLL-2026-07',
      `July payroll register · ${pays.length} staff`,
      [
        { account_id: payroll.id, account: payroll.name || 'Payroll Expenses', debit: payTotal, credit: 0, note: 'July net' },
        { account_id: bank.id, account: bank.name || 'Bank', debit: 0, credit: payTotal, note: 'Net salaries' },
      ],
      { source: 'live-sync' },
    );
  }

  try { localStorage.setItem(FLAG, '1'); } catch { /* */ }
  return { purchases: livePurchases().length, payroll: payTotal };
}
