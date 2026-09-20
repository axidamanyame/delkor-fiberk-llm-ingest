/** One clock book for header card and HRM Time tab. */
import { readLs, writeLs, uid } from './ls-rows.js';
import { writeActivity, writeStaffAlert } from './staff-log.js';
import { isHqRole, isOwnerRole } from './access-rules.js';

export const CLOCK_KEY = 'df_clock_ins';

export function listPunches() {
  return Array.isArray(readLs(CLOCK_KEY, [])) ? readLs(CLOCK_KEY, []) : [];
}

export function punchesToday(userId) {
  const day = new Date().toISOString().slice(0, 10);
  return listPunches().filter((p) => String(p.clocked_at || '').slice(0, 10) === day
    && (!userId || p.user_id === userId || p.user_email === userId));
}

export function alreadyClockedInToday(userId) {
  const rows = punchesToday(userId);
  const last = rows[0];
  if (!last) return false;
  return last.type !== 'clock_out';
}

export function recordPunch(p = {}) {
  const row = {
    id: uid(),
    type: p.type === 'clock_out' ? 'clock_out' : 'clock_in',
    note: p.note || '',
    ip: p.ip || p.ip_address || '',
    location: p.location || p.geo || '',
    method: p.method || '',
    verified: p.verified === true,
    user_id: p.user_id || '',
    user_email: p.user_email || '',
    staff: p.staff || p.name || p.user_email || '',
    office: p.office || '',
    clocked_at: p.clocked_at || new Date().toISOString(),
  };
  const rows = listPunches();
  rows.unshift(row);
  writeLs(CLOCK_KEY, rows);
  try {
    writeActivity({
      action: row.type,
      type: 'Attendance',
      by: row.user_email || row.staff,
      user_id: row.user_id,
      note: (row.type === 'clock_out' ? 'Clocked out' : 'Clocked in')
        + (row.office ? ' · ' + row.office : '')
        + (row.method ? ' · ' + row.method : ''),
      payload: { ip: row.ip, location: row.location, verified: row.verified, method: row.method },
    });
  } catch { /* ignore */ }
  const role = p.role || p.role_name || '';
  const leadership = isHqRole(role) || isOwnerRole(role);
  if (!leadership && p.verified === false) {
    writeStaffAlert({
      kind: 'attendance_unverified',
      title: 'Attendance unverified — ' + (row.staff || row.user_email || 'staff'),
      body: (row.staff || row.user_email || 'Staff') + ' ' + row.type.replace('_', ' ')
        + ' off the shop IP / geofence'
        + (row.office ? ' · ' + row.office : '') + '.',
      href: '/audit-log.html?type=attendance',
      email: row.user_email,
      user_id: row.user_id,
      meta: { ip: row.ip, location: row.location, method: row.method, type: row.type },
    }).catch(() => {});
  }
  return row;
}

function hhmm(iso) {
  const s = String(iso || '').replace('T', ' ');
  return s.slice(11, 16) || s.slice(0, 16);
}

/** Rows for the attendance table — pulled, not opened as another app. */
export function attendanceRows(extra = []) {
  const by = new Map();
  const add = (p) => {
    if (!p) return;
    if (p.in || p.out) {
      const k = `${p.staff || p.user_email || p.id}|${p.day || p.date || ''}`;
      by.set(k || String(by.size), {
        staff: p.staff || p.user_email || '—',
        office: p.office || p.company || '—',
        in: p.in || '',
        out: p.out || '',
      });
      return;
    }
    const day = String(p.clocked_at || '').slice(0, 10);
    const k = `${p.user_id || p.user_email || p.staff}|${day}`;
    const cur = by.get(k) || {
      staff: p.staff || p.user_email || '—',
      office: p.office || '—',
      in: '',
      out: '',
      day,
    };
    const tm = hhmm(p.clocked_at);
    if (p.type === 'clock_out') cur.out = tm;
    else cur.in = tm;
    by.set(k, cur);
  };
  listPunches().forEach(add);
  extra.forEach(add);
  return [...by.values()];
}
