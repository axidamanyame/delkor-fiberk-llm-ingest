/**
 * Staff productivity trail:
 *   alerts  → audit log (till mismatch, attendance unverified, profile policy)
 *   work    → activity log (clock in/out, till open, profile edit, sale)
 */
import { uid } from './ls-rows.js';
import { writeAudit } from './supabaseClient.js';

export const ACTIVITY_KEY = 'df_activity_logs';
export const STAFF_ALERT_KEY = 'df_staff_alerts';

function read(key) {
  try {
    const rows = JSON.parse(localStorage.getItem(key) || '[]');
    return Array.isArray(rows) ? rows : [];
  } catch {
    return [];
  }
}

function write(key, rows) {
  try { localStorage.setItem(key, JSON.stringify(rows.slice(0, 500))); } catch { /* quota */ }
}

export function listActivity() {
  return read(ACTIVITY_KEY);
}

export function writeActivity({ action, type, by, note, user_id, payload } = {}) {
  const now = new Date().toISOString();
  const row = {
    id: uid(),
    at: now,
    created_at: now,
    date: now,
    type: type || 'Staff',
    action: action || 'update',
    by: by || '',
    user: by || '',
    user_email: by || '',
    note: note || '',
    user_id: user_id || '',
    payload: payload && typeof payload === 'object' ? payload : {},
  };
  write(ACTIVITY_KEY, [row, ...listActivity()]);
  return row;
}

export function listStaffAlerts() {
  return read(STAFF_ALERT_KEY);
}

export function pendingStaffAlerts() {
  return listStaffAlerts().filter((a) => a.status !== 'resolved' && a.status !== 'dismissed');
}

export async function writeStaffAlert({ kind, title, body, href, meta, user_id, email } = {}) {
  const now = new Date().toISOString();
  const row = {
    id: uid(),
    kind: kind || 'staff_alert',
    title: title || 'Staff alert',
    body: body || '',
    href: href || '/audit-log.html?type=staff_alert',
    meta: meta && typeof meta === 'object' ? meta : {},
    user_id: user_id || '',
    email: email || '',
    created_at: now,
    status: 'pending',
  };
  write(STAFF_ALERT_KEY, [row, ...listStaffAlerts()]);
  await writeAudit({
    action: kind || 'staff_alert',
    entity_type: 'staff_alert',
    entity_id: user_id || email || null,
    summary: title || body,
    payload: { body, href: row.href, email, ...(row.meta) },
  });
  return row;
}

export function resolveStaffAlert(id, status = 'resolved') {
  write(STAFF_ALERT_KEY, listStaffAlerts().map((a) =>
    String(a.id) === String(id) ? { ...a, status } : a));
}
