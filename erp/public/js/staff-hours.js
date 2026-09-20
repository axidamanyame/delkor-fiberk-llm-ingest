/** Staff start time (Ghana) — late login + no-show. HQ Admin / Owner exempt. */
import { isHqRole, isOwnerRole } from './access-rules.js';
import { tillPolicyLocal } from './till-policy.js';
import { listPunches, recordPunch, alreadyClockedInToday } from './time-clock.js';
import { writeStaffAlert, listStaffAlerts, writeActivity } from './staff-log.js';
import { pushNotice } from './inbox.js';
import { supabase } from './supabaseClient.js';

export const LOGIN_KEY = 'df_staff_logins';

export function ghanaNow(date = new Date()) {
  const f = new Intl.DateTimeFormat('en-GB', {
    timeZone: 'Africa/Accra',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false,
  });
  const o = {};
  f.formatToParts(date).forEach((p) => { if (p.type !== 'literal') o[p.type] = p.value; });
  const hour = Number(o.hour);
  const minute = Number(o.minute);
  return {
    ymd: `${o.year}-${o.month}-${o.day}`,
    hm: `${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')}`,
    minutes: hour * 60 + minute,
    label: `${o.day}/${o.month}/${o.year} ${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')} Ghana`,
  };
}

function hmToMin(hm) {
  const [h, m] = String(hm || '08:00').split(':').map(Number);
  return (Number(h) || 0) * 60 + (Number(m) || 0);
}

function readLogins() {
  try {
    const rows = JSON.parse(localStorage.getItem(LOGIN_KEY) || '[]');
    return Array.isArray(rows) ? rows : [];
  } catch {
    return [];
  }
}

function writeLogins(rows) {
  try { localStorage.setItem(LOGIN_KEY, JSON.stringify(rows.slice(0, 400))); } catch { /* quota */ }
}

function exemptRole(role) {
  return isHqRole(role) || isOwnerRole(role);
}

function alreadyAlerted(kind, email, day) {
  const em = String(email || '').toLowerCase();
  return listStaffAlerts().some((a) =>
    a.kind === kind
    && String(a.email || a.meta?.email || '').toLowerCase() === em
    && String(a.meta?.day || a.created_at || '').slice(0, 10) === day);
}

async function hqEmails() {
  const fallback = [
    'social.delkorfiberk@gmail.com',
    'bernardfbk@gmail.com',
    'dkormla@gmail.com',
    'colemanharry600@gmail.com',
  ];
  try {
    const { data } = await supabase.from('profiles').select('email,role,role_name,designation').limit(300);
    const rows = (data || []).filter((p) => isHqRole(p.role_name || p.role || p.designation) || isOwnerRole(p.role_name || p.role || p.designation));
    const emails = rows.map((p) => String(p.email || '').toLowerCase()).filter(Boolean);
    return emails.length ? emails : fallback;
  } catch {
    return fallback;
  }
}

async function pingHq(row) {
  const emails = await hqEmails();
  for (const email of emails) {
    try {
      await pushNotice({
        email,
        title: row.title,
        body: row.body,
        kind: row.kind,
        href: row.href || '/audit-log.html?type=staff_alert',
        meta: row.meta || {},
      });
    } catch { /* next */ }
  }
}

export function expectedStaff() {
  let users = [];
  try { users = JSON.parse(localStorage.getItem('df_users') || '[]'); } catch { users = []; }
  if (!Array.isArray(users)) users = [];
  return users.filter((u) => {
    if (!u?.email) return false;
    if (u.is_active === false || u.allow_login === false) return false;
    const role = u.role_name || u.role || '';
    if (exemptRole(role)) return false;
    const st = String(u.status || '').toLowerCase();
    if (st === 'pending' || st === 'inactive' || st === 'keyed') return false;
    return true;
  });
}

export function loginToday(email, day) {
  const em = String(email || '').toLowerCase();
  return readLogins().find((r) => r.email === em && r.day === day) || null;
}

export async function noteStaffLogin(session, extra = {}) {
  const pol = tillPolicyLocal();
  const role = extra.role || extra.role_name || session?.user?.user_metadata?.role || '';
  const email = String(extra.email || session?.user?.email || '').toLowerCase();
  if (!email) return null;
  const now = ghanaNow();
  const rows = readLogins();
  const prev = rows.find((r) => r.email === email && r.day === now.ymd);
  const rec = prev || {
    email,
    day: now.ymd,
    at: new Date().toISOString(),
    hm: now.hm,
    minutes: now.minutes,
    role,
    name: extra.name || extra.full_name || email,
  };
  if (!prev) {
    writeLogins([rec, ...rows]);
    writeActivity({
      action: 'login',
      type: 'Attendance',
      by: email,
      user_id: session?.user?.id || '',
      note: 'Signed in at ' + now.hm + ' Ghana time',
    });
  }
  const cashier = extra.cashier === true;
  if (!cashier && !exemptRole(role) && session?.user?.id) {
    try {
      if (!alreadyClockedInToday(session.user.id)) {
        recordPunch({
          type: 'clock_in',
          note: 'App sign-in',
          user_id: session.user.id,
          user_email: email,
          staff: rec.name || email,
          role,
        });
      }
    } catch { /* local book */ }
  }
  if (exemptRole(role) || !pol.staff_hours_on || !pol.staff_late_alert) return rec;
  const start = hmToMin(pol.staff_start) + Number(pol.staff_grace_min || 0);
  if (rec.minutes <= start) return rec;
  if (alreadyAlerted('late_login', email, now.ymd)) return rec;
  const minsLate = rec.minutes - hmToMin(pol.staff_start);
  const row = await writeStaffAlert({
    kind: 'late_login',
    title: 'Late login — ' + (rec.name || email),
    body: (rec.name || email) + ' signed in at ' + rec.hm + ' Ghana time (' + minsLate + ' min after ' + pol.staff_start + ').',
    href: '/audit-log.html?type=staff_alert',
    email,
    user_id: session?.user?.id || '',
    meta: { day: now.ymd, hm: rec.hm, start: pol.staff_start, minutes_late: minsLate, role },
  });
  await pingHq(row);
  return rec;
}

export async function scanAbsences() {
  const pol = tillPolicyLocal();
  if (!pol.staff_hours_on || !pol.staff_absent_alert) return [];
  const now = ghanaNow();
  const cutoff = hmToMin(pol.staff_start) + Number(pol.staff_grace_min || 0) + Number(pol.staff_absent_after_min || 15);
  if (now.minutes < cutoff) return [];
  const punches = listPunches().filter((p) => {
    const t = p.clocked_at ? new Date(p.clocked_at) : null;
    return t && !Number.isNaN(t.getTime()) && ghanaNow(t).ymd === now.ymd;
  });
  const fired = [];
  for (const u of expectedStaff()) {
    const email = String(u.email || '').toLowerCase();
    if (loginToday(email, now.ymd)) continue;
    const punched = punches.some((p) => String(p.user_email || '').toLowerCase() === email || String(p.user_id) === String(u.id || ''));
    if (punched) continue;
    if (alreadyAlerted('absent_login', email, now.ymd)) continue;
    const name = u.full_name || [u.first_name, u.last_name].filter(Boolean).join(' ') || email;
    const row = await writeStaffAlert({
      kind: 'absent_login',
      title: 'No login — ' + name,
      body: name + ' had not signed in by ' + pol.staff_start + ' Ghana time (' + now.hm + ' now).',
      href: '/audit-log.html?type=staff_alert',
      email,
      user_id: u.id || '',
      meta: { day: now.ymd, start: pol.staff_start, hm: now.hm, role: u.role_name || u.role },
    });
    await pingHq(row);
    fired.push(row);
  }
  return fired;
}
