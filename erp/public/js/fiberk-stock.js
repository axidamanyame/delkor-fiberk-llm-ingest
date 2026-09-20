import { readLs } from './ls-rows.js';
import { onlyMigrated } from './fiberk-silo.js';

export function fiberkTransfers() {
  return onlyMigrated(readLs('df_stock_transfers', []) || []);
}
export function fiberkStockMetrics() {
  return { n: fiberkTransfers().length };
}
export async function ensureFiberkStock() {
  return { ok: true, n: fiberkTransfers().length };
}

export function paintTransferDetails(app, row) {
  if (!app || !row) return;
  const set = (id, v) => { const el = app.querySelector('#' + id); if (el) el.value = v ?? ''; };
  set('ref', row.ref_no || row.reference || '');
  set('from', row.from_location || row.from || '');
  set('to', row.to_location || row.to || '');
  set('date', String(row.date || row.transfer_date || '').slice(0, 10));
}

export function paintAdjustmentDetails(app, row) {
  if (!app || !row) return;
  const set = (id, v) => { const el = app.querySelector('#' + id); if (el) el.value = v ?? ''; };
  set('ref', row.ref_no || row.reference || '');
  set('location', row.location || row.location_code || '');
  set('date', String(row.date || row.adjustment_date || '').slice(0, 10));
}
