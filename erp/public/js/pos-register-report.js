/** Closed-register snapshots. Written only when the cashier confirms Close. */
import { fmt } from './supabaseClient.js';

export const KEY = 'df_pos_register_reports';

export function ghanaStamp(iso) {
  if (!iso) return '—';
  const d = new Date(iso);
  if (Number.isNaN(+d)) return String(iso);
  return d.toLocaleString('en-GB', {
    timeZone: 'Africa/Accra',
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
    second: '2-digit',
    hour12: true,
  });
}

export function listRegisterReports() {
  try { return JSON.parse(localStorage.getItem(KEY) || '[]'); } catch { return []; }
}

function writeLocal(rows) {
  try { localStorage.setItem(KEY, JSON.stringify((rows || []).slice(0, 200))); } catch { /* quota */ }
}

export async function saveRegisterReport(row) {
  if (!row || row.source !== 'cashier_close') return null;
  const rec = {
    id: row.id || ('reg-' + Date.now().toString(36)),
    session_id: row.session_id || '',
    opened_at: row.opened_at || null,
    closed_at: row.closed_at || new Date().toISOString(),
    cashier: row.cashier || '',
    email: row.email || '',
    subsidiary: row.subsidiary || '',
    location_name: row.location_name || '',
    opening_float: Number(row.opening_float || 0),
    net_sales: Number(row.net_sales || 0),
    expected: Number(row.expected || 0),
    cash_sales: Number(row.cash_sales || 0),
    collected: Number(row.collected || 0),
    body_html: row.body_html || row.bodyHtml || '',
    source: 'cashier_close',
    created_at: new Date().toISOString(),
  };
  const all = listRegisterReports().filter((x) => x.session_id !== rec.session_id || x.source !== 'cashier_close');
  all.unshift(rec);
  writeLocal(all);
  try {
    const { supabase } = await import('./supabaseClient.js');
    await supabase.from('pos_register_reports').upsert(rec);
  } catch { /* table optional */ }
  return rec;
}

export function getRegisterReport(id) {
  return listRegisterReports().find((r) => String(r.id) === String(id) || String(r.session_id) === String(id)) || null;
}

export function wrapRegisterHtml(snap = {}) {
  const opened = ghanaStamp(snap.opened_at);
  const closed = snap.closed_at ? ghanaStamp(snap.closed_at) : '';
  const body = snap.body_html || snap.bodyHtml || '';
  return `
    <p class="reg-open"><strong>Till opened:</strong> ${opened}</p>
    ${body}
    ${closed ? `<p class="reg-close"><strong>Till closed:</strong> ${closed}</p>` : ''}`;
}

export function registerSheetCss() {
  return `
    body{font-family:Inter,system-ui,sans-serif;padding:22px;color:#0b1220;max-width:720px;margin:auto}
    h3,h4{margin:18px 0 8px;font-size:16px}
    .reg-row{display:flex;justify-content:space-between;padding:6px 0;border-bottom:1px solid #e2e8f0}
    .reg-green{background:#ecfdf5;font-weight:700;padding:8px;border-radius:6px;margin:8px 0}
    .reg-amber{background:#fff7ed;font-weight:700;padding:8px;border-radius:6px;margin:8px 0}
    .reg-open,.reg-close{background:#eff6ff;border-radius:8px;padding:10px 12px;font-weight:700;margin:0 0 12px}
    .reg-close{background:#f8fafc;margin-top:16px}
    table{width:100%;border-collapse:collapse;margin:8px 0 16px}
    th,td{border:1px solid #e2e8f0;padding:6px 8px;text-align:left;font-size:13px}
    th{background:#eef3f8}
    .pos-table{width:100%;border-collapse:collapse}
    @media print{body{padding:8px} .no-print{display:none}}
  `;
}

export function money(n) {
  try { return fmt(n || 0); } catch { return 'GH₵ ' + Number(n || 0).toFixed(2); }
}
