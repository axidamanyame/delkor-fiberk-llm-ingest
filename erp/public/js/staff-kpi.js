/**
 * Staff attendance → hours → KPI.
 * Late deducts minutes from the expected day. Absent is a zero day.
 * Sales/cashier jobs add a sales-target score; everyone else uses their job target.
 */
import { isHqRole, isOwnerRole } from './access-rules.js';
import { tillPolicyLocal } from './till-policy.js';
import { listPunches } from './time-clock.js';
import { ghanaNow, expectedStaff, loginToday, LOGIN_KEY } from './staff-hours.js';
import { listStaffAlerts } from './staff-log.js';
import { readLs } from './ls-rows.js';

export function policyHours() {
  const p = tillPolicyLocal();
  return {
    start: p.staff_start || '08:00',
    grace: Number(p.staff_grace_min) || 0,
    hoursDay: Math.max(1, Number(p.staff_hours_day) || 8),
    daysWeek: Math.max(1, Number(p.staff_days_week) || 5),
    attWeight: Math.min(100, Math.max(0, Number(p.staff_kpi_att_weight) || 60)),
  };
}

function hmToMin(hm) {
  const [h, m] = String(hm || '08:00').split(':').map(Number);
  return (Number(h) || 0) * 60 + (Number(m) || 0);
}

function ymdAdd(ymd, n) {
  const [y, m, d] = String(ymd).split('-').map(Number);
  return new Date(Date.UTC(y, m - 1, d + n)).toISOString().slice(0, 10);
}

export function workdaysThisWeek(now = new Date()) {
  const today = ghanaNow(now).ymd;
  const [y, m, d] = today.split('-').map(Number);
  const dow = new Date(Date.UTC(y, m - 1, d)).getUTCDay();
  const monday = dow === 0 ? -6 : 1 - dow;
  const days = [];
  for (let i = 0; i < 7; i += 1) {
    const ymd = ymdAdd(today, monday + i);
    const [yy, mm, dd] = ymd.split('-').map(Number);
    const w = new Date(Date.UTC(yy, mm - 1, dd)).getUTCDay();
    if (w === 0 || w === 6) continue;
    if (ymd > today) continue;
    days.push(ymd);
  }
  return { today, days };
}

function loginsAll() {
  try {
    const rows = JSON.parse(localStorage.getItem(LOGIN_KEY) || '[]');
    return Array.isArray(rows) ? rows : [];
  } catch {
    return [];
  }
}

function punchMinutes(email, id, day) {
  const em = String(email || '').toLowerCase();
  const hits = listPunches().filter((p) => {
    const t = p.clocked_at ? new Date(p.clocked_at) : null;
    if (!t || Number.isNaN(t.getTime())) return false;
    if (ghanaNow(t).ymd !== day) return false;
    return String(p.user_email || '').toLowerCase() === em || (id && String(p.user_id) === String(id));
  });
  if (!hits.length) return null;
  const first = hits.slice().sort((a, b) => String(a.clocked_at).localeCompare(String(b.clocked_at)))[0];
  return ghanaNow(new Date(first.clocked_at)).minutes;
}

function loginMinutes(email, day) {
  const rec = loginToday(email, day) || loginsAll().find((r) => r.email === String(email || '').toLowerCase() && r.day === day);
  return rec ? Number(rec.minutes) : null;
}

function alertKind(email, day) {
  const em = String(email || '').toLowerCase();
  const hit = listStaffAlerts().find((a) =>
    String(a.email || a.meta?.email || '').toLowerCase() === em
    && String(a.meta?.day || a.created_at || '').slice(0, 10) === day
    && /late_login|absent_login/.test(a.kind || ''));
  return hit?.kind || '';
}

export function dayStatusFor(person, day, now = new Date()) {
  const pol = policyHours();
  const email = String(person.email || '').toLowerCase();
  const role = person.role_name || person.role || '';
  const today = ghanaNow(now).ymd;
  const nowMin = ghanaNow(now).minutes;
  const start = hmToMin(pol.start) + pol.grace;
  if (exemptRole(role)) {
    const mins = loginMinutes(email, day) ?? punchMinutes(email, person.id, day);
    return {
      status: mins != null ? 'present' : (day < today ? 'off' : 'present'),
      hours: pol.hoursDay,
      expected: pol.hoursDay,
      inHm: mins != null ? minToHm(mins) : '',
      lateMin: 0,
      exempt: true,
    };
  }
  const flagged = alertKind(email, day);
  const mins = loginMinutes(email, day) ?? punchMinutes(email, person.id, day);
  if (flagged === 'absent_login' || (mins == null && (day < today || (day === today && nowMin >= start + Number(tillPolicyLocal().staff_absent_after_min || 15))))) {
    return { status: 'absent', hours: 0, expected: pol.hoursDay, inHm: '', lateMin: 0, exempt: false };
  }
  if (mins == null) {
    return { status: day === today ? 'pending' : 'absent', hours: day === today ? null : 0, expected: pol.hoursDay, inHm: '', lateMin: 0, exempt: false };
  }
  const lateMin = Math.max(0, mins - start);
  const hours = Math.max(0, +(pol.hoursDay - lateMin / 60).toFixed(2));
  const late = flagged === 'late_login' || lateMin > 0;
  return {
    status: late ? 'late' : 'present',
    hours,
    expected: pol.hoursDay,
    inHm: minToHm(mins),
    lateMin,
    exempt: false,
  };
}

function minToHm(mins) {
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  return String(h).padStart(2, '0') + ':' + String(m).padStart(2, '0');
}

function exemptRole(role) {
  return isHqRole(role) || isOwnerRole(role);
}

export function isSalesJob(role) {
  return /cashier|teller|sales|attendant|shop/i.test(String(role || ''));
}

export function weekAttendance(person, now = new Date()) {
  const { days, today } = workdaysThisWeek(now);
  const pol = policyHours();
  const marks = days.map((day) => ({ day, ...dayStatusFor(person, day, now) }));
  const counted = marks.filter((m) => m.hours != null && m.status !== 'pending' && m.status !== 'off');
  const expected = counted.length * pol.hoursDay;
  const credited = counted.reduce((a, m) => a + Number(m.hours || 0), 0);
  const pct = expected > 0 ? Math.round((credited / expected) * 1000) / 10 : 100;
  const todayMark = marks.find((m) => m.day === today) || dayStatusFor(person, today, now);
  return {
    days: marks,
    today: todayMark,
    expected,
    credited: +credited.toFixed(2),
    pct,
    lateDays: marks.filter((m) => m.status === 'late').length,
    absentDays: marks.filter((m) => m.status === 'absent').length,
  };
}

function monthSales(email) {
  const em = String(email || '').toLowerCase();
  const month = ghanaNow().ymd.slice(0, 7);
  const bags = ['df_sales_orders', 'df_sells', 'df_pos_tickets'];
  let total = 0;
  bags.forEach((key) => {
    const rows = readLs(key, []);
    (Array.isArray(rows) ? rows : []).forEach((r) => {
      const blob = `${r.cashier_email || ''} ${r.agent_email || ''} ${r.user_email || ''} ${r.created_by_email || ''}`.toLowerCase();
      const when = String(r.created_at || r.order_date || r.date || '').slice(0, 7);
      if (when === month && blob.includes(em)) total += Number(r.total_amount || r.grand_total || r.total || 0);
    });
  });
  return total;
}

function jobTargetFor(person) {
  const email = String(person.email || '').toLowerCase();
  const name = String(person.full_name || person.name || '').toLowerCase();
  let hub = {};
  try { hub = JSON.parse(localStorage.getItem('df_hrm_hub_v1') || '{}'); } catch { hub = {}; }
  const row = (hub.targets || []).find((t) =>
    String(t.email || '').toLowerCase() === email
    || String(t.user || '').toLowerCase() === email
    || String(t.user || '').toLowerCase() === name);
  const role = person.role_name || person.role || '';
  if (isSalesJob(role)) {
    const target = Number(row?.thisM || row?.target || 0);
    const actual = monthSales(email);
    return { kind: 'sales', label: 'Sales this month', target, actual, unit: 'GHS' };
  }
  const target = Number(row?.target || row?.thisM || 0);
  const actual = Number(row?.actual || row?.thisM || 0);
  const kind = row?.kind || 'work';
  return { kind, label: kind === 'calls' ? 'Calls this month' : 'Work target', target, actual, unit: '' };
}

export function ratingFor(person, now = new Date()) {
  const att = weekAttendance(person, now);
  const job = jobTargetFor(person);
  const pol = policyHours();
  const jobPct = job.target > 0 ? Math.min(120, Math.round((job.actual / job.target) * 1000) / 10) : null;
  const attW = jobPct == null ? 100 : pol.attWeight;
  const jobW = 100 - attW;
  const rating = jobPct == null
    ? att.pct
    : Math.round((att.pct * attW + jobPct * jobW) / 1000 * 10) / 10;
  return { att, job, jobPct, rating, attWeight: attW };
}

export function todayBoard(now = new Date()) {
  const day = ghanaNow(now).ymd;
  return expectedStaff().map((p) => {
    const mark = dayStatusFor(p, day, now);
    const kpi = ratingFor(p, now);
    return {
      ...p,
      name: p.full_name || [p.first_name, p.last_name].filter(Boolean).join(' ') || p.email,
      office: p.work_location || p.location_code || p.office || '—',
      ...mark,
      weekPct: kpi.att.pct,
      rating: kpi.rating,
      job: kpi.job,
      jobPct: kpi.jobPct,
    };
  });
}

export function myKpi(session, extra = {}) {
  const email = String(extra.email || session?.user?.email || '').toLowerCase();
  const people = expectedStaff();
  const person = people.find((p) => String(p.email || '').toLowerCase() === email) || {
    email,
    id: session?.user?.id,
    full_name: extra.name || extra.full_name || email,
    role: extra.role || extra.role_name || '',
    role_name: extra.role || extra.role_name || '',
  };
  return { person, ...ratingFor(person) };
}
