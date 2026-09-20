/**
 * Keep live books on one set of records:
 * Field Ops orders/payments ↔ sales due ↔ customers ↔ collections ↔ journals.
 * Fiberkapp books are merged into the live desks on boot.
 */
import { hydrateEasybuyCustomers } from './easybuy-customers.js';
import { syncHpSalesIntoBook } from './sale-lookup.js';
import { syncLiveAccounting } from './acc-sync-live.js';
import { readLs, writeLs } from './ls-rows.js';

const STAMP = 'df_live_sync_at';
let busy = null;
let lastAt = 0;

function mergeAgentsFromField() {
  const orders = readLs('df_bnpl_field_orders', []) || [];
  const pays = readLs('df_bnpl_field_payments', []) || [];
  const names = new Map();
  [...orders, ...pays].forEach((r) => {
    const name = String(r.sa_name || r.agent_name || '').trim();
    const sid = String(r.sa_id || '').trim();
    if (!name && !sid) return;
    const key = sid || name.toLowerCase();
    if (!names.has(key)) names.set(key, { id: sid || `sa-${key}`, sa_id: sid, name, source: 'easybuy', live: true, kind: 'field-commission' });
  });
  if (!names.size) return;
  const cur = readLs('df_commission_agents', []) || [];
  const map = new Map(cur.map((a) => [String(a.sa_id || a.id || a.name || '').toLowerCase(), a]));
  names.forEach((a, k) => {
    const prev = map.get(k) || map.get(a.name.toLowerCase());
    if (prev) map.set(String(prev.id || k), { ...prev, sa_id: prev.sa_id || a.sa_id, name: prev.name || a.name, live: true });
    else map.set(k, a);
  });
  writeLs('df_commission_agents', [...map.values()]);
}

export async function runLiveSync(reason = 'boot') {
  if (reason !== 'boot' && Date.now() - lastAt < 20000) return;
  if (busy) return busy;
  busy = (async () => {
    lastAt = Date.now();
    try { /* Fiberkapp rows are already live — do not re-parse dump files. */ } catch { /* ignore */ }
    try { await syncHpSalesIntoBook(); } catch { /* sales book */ }
    try { hydrateEasybuyCustomers(); } catch { /* customers */ }
    try { mergeAgentsFromField(); } catch { /* agents */ }
    try { syncLiveAccounting(); } catch { /* journals */ }
    try {
      const { ensureCollections } = await import('./collections-desk.js');
      await Promise.race([
        ensureCollections(),
        new Promise((resolve) => setTimeout(resolve, 4000)),
      ]);
    } catch { /* collections */ }
    try { localStorage.setItem(STAMP, new Date().toISOString()); } catch { /* ignore */ }
    try { window.dispatchEvent(new CustomEvent('df-live-sync', { detail: { reason } })); } catch { /* ignore */ }
  })();
  try { await busy; } finally { busy = null; }
}

export function installLiveSync() {
  if (window.__df_live_sync_on) return;
  window.__df_live_sync_on = true;
  setTimeout(() => { runLiveSync('boot'); }, 20000);
  window.addEventListener('storage', (e) => {
    if (e.key === STAMP) window.dispatchEvent(new CustomEvent('df-live-sync', { detail: { reason: 'peer' } }));
  });
  document.addEventListener('visibilitychange', () => {
    if (!document.hidden) runLiveSync('focus');
  });
  setInterval(() => { if (!document.hidden) runLiveSync('poll'); }, 3 * 60 * 1000);
}
