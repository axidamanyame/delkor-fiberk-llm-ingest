/**
 * All records are live. Fiberkapp uploads are the same books as till and
 * EasyBuy — use the page filters, not a separate data set.
 */
const KEY = 'df_data_scope';
export const SCOPES = ['all'];
export const DATA_SCOPE_EVENT = 'df-data-scope';

export const SCOPE_LABELS = { all: 'Live books' };
export const SCOPE_HINTS = { all: 'Every record on the desk, including Fiberkapp uploads.' };

export function getDataScope() {
  return 'all';
}

export function setDataScope() {
  try { localStorage.setItem(KEY, 'all'); } catch { /* ignore */ }
  return 'all';
}

export function applyDataScope(rows) {
  return Array.isArray(rows) ? rows : [];
}

export function dataScopeCounts(rows) {
  const n = Array.isArray(rows) ? rows.length : 0;
  return { all: n, archive: 0, live: n };
}