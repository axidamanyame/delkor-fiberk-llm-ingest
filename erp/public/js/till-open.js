/**
 * Till opening cash/MoMo count + silent HQ discrepancy alerts.
 * Cashier never sees a mismatch. HQ gets the bell + /till-alerts.html.
 */
import { supabase, writeAudit } from './supabaseClient.js';
import { readLs, writeLs, uid } from './ls-rows.js';
import { pushNotice } from './inbox.js';
import { isHqRole, isOwnerRole } from './access-rules.js';
import { tillPolicyLocal } from './till-policy.js';
import { getAccess } from './rbac.js';

export const OPEN_KEY = 'df_till_openings';
export const ALERT_KEY = 'df_till_alerts';
export const SITE_KEY = 'df_shop_sites';
export const DEVICE_KEY = 'df_till_device_id';

export const FIBERK_SHOP = {
  location_code: 'FIB-SHOP',
  location_name: 'Fiberk Shop',
  lat: 5.685577,
  lng: -0.138635,
  radius_m: 60,
};

function num(v) {
  const n = Number(v);
  return Number.isFinite(n) ? Math.round(n * 100) / 100 : 0;
}

export function deviceId() {
  try {
    let id = localStorage.getItem(DEVICE_KEY);
    if (!id) {
      id = 'tdv-' + uid().slice(0, 12);
      localStorage.setItem(DEVICE_KEY, id);
    }
    return id;
  } catch {
    return 'tdv-local';
  }
}

export function listSites() {
  const extra = readLs(SITE_KEY, []) || [];
  const by = new Map([[FIBERK_SHOP.location_code, { ...FIBERK_SHOP }]]);
  extra.forEach((s) => {
    if (!s?.location_code) return;
    by.set(s.location_code, { ...(by.get(s.location_code) || {}), ...s });
  });
  return [...by.values()];
}

export function siteFor(locationCode) {
  const code = String(locationCode || '');
  const list = listSites();
  return list.find((s) => s.location_code === code)
    || list.find((s) => /fiberk|fib-shop/i.test(code) && /fiberk|fib-shop/i.test(s.location_code))
    || null;
}

export function haversineM(lat1, lng1, lat2, lng2) {
  const R = 6371000;
  const toR = (d) => (Number(d) * Math.PI) / 180;
  const dLat = toR(lat2 - lat1);
  const dLng = toR(lng2 - lng1);
  const a = Math.sin(dLat / 2) ** 2
    + Math.cos(toR(lat1)) * Math.cos(toR(lat2)) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.min(1, Math.sqrt(a)));
}

export async function fetchPublicIp() {
  try {
    const r = await fetch('https://api.ipify.org?format=json', { signal: AbortSignal.timeout(2500) });
    const j = await r.json();
    return String(j.ip || '');
  } catch {
    return '';
  }
}

export function readGeo() {
  return new Promise((resolve) => {
    if (!navigator.geolocation) { resolve(null); return; }
    navigator.geolocation.getCurrentPosition(
      (pos) => resolve({
        lat: pos.coords.latitude,
        lng: pos.coords.longitude,
        accuracy: pos.coords.accuracy,
        mock: pos.coords.altitudeAccuracy === null && false,
      }),
      () => resolve(null),
      { enableHighAccuracy: true, timeout: 6000, maximumAge: 15000 },
    );
  });
}

export function verifyAttendance({ ip, geo, locationCode, role } = {}) {
  let r = role || '';
  try { r = r || getAccess()?.roleName || ''; } catch { /* ignore */ }
  if (isHqRole(r) || isOwnerRole(r)) {
    return { ok: true, method: 'leadership', metres: null, site: null, ip: ip || '' };
  }
  const pol = tillPolicyLocal();
  if (!pol.till_policy_on || !pol.till_attend_on) {
    return { ok: true, method: 'policy_off', metres: null, site: null, ip };
  }
  const site = siteFor(locationCode);
  if (!site) return { ok: true, method: 'unconfigured', metres: null, site: null, ip };
  const ips = [].concat(site.public_ip || [], site.public_ips || []).map(String).filter(Boolean);
  const ipOk = !!(ip && ips.includes(ip));
  let geoOk = false;
  let metres = null;
  const radius = Number(site.radius_m || pol.till_geofence_m || 60);
  if (geo && site.lat != null && site.lng != null) {
    metres = haversineM(geo.lat, geo.lng, site.lat, site.lng);
    geoOk = metres <= radius;
  }
  const tokens = [].concat(site.device_token || [], site.device_tokens || []).map(String);
  const deviceOk = tokens.includes(deviceId());
  const method = ipOk ? 'shop_ip' : geoOk ? 'geofence' : deviceOk ? 'shop_device' : 'unverified';
  return { ok: ipOk || geoOk || deviceOk, method, metres, site, ip };
}

export async function enrollThisDevice({ locationCode, locationName, enrolledBy } = {}) {
  const ip = await fetchPublicIp();
  const geo = await readGeo();
  const row = {
    location_code: locationCode || 'FIB-SHOP',
    location_name: locationName || 'Fiberk Shop',
    public_ip: ip,
    device_token: deviceId(),
    lat: geo?.lat ?? FIBERK_SHOP.lat,
    lng: geo?.lng ?? FIBERK_SHOP.lng,
    radius_m: 60,
    enrolled_at: new Date().toISOString(),
    enrolled_by: enrolledBy || '',
    active: true,
  };
  const next = listSites().filter((s) => s.location_code !== row.location_code);
  next.push({ ...siteFor(row.location_code), ...row, public_ips: [ip].filter(Boolean), device_tokens: [row.device_token] });
  writeLs(SITE_KEY, next);
  try { await supabase.from('shop_attendance_sites').insert(row); } catch { /* local */ }
  return row;
}

function cashMomoOf(sale) {
  const pays = sale.payments || sale.tenders || sale.payments_view || [];
  if (Array.isArray(pays) && pays.length) {
    return pays.reduce((s, p) => {
      const m = String(p.method || p.type || p.payment_method || '').toLowerCase();
      if (/cash|momo|mobile|mtn|telecel|airteltigo|\bat\b/.test(m)) return s + num(p.amount);
      return s;
    }, 0);
  }
  const method = String(sale.payment_method || sale.pay_method || sale.method || '').toLowerCase();
  if (/cash|momo|mobile/.test(method)) return num(sale.total_amount || sale.final_total || sale.amount_paid);
  return num(sale.amount_paid);
}

function locMatch(row, code, name) {
  const c = String(row.location_code || '');
  const n = String(row.location_name || '');
  return (code && (c === code || c.toLowerCase() === String(code).toLowerCase()))
    || (name && n === name);
}

export async function systemExpectedTotal({ locationCode, locationName, subsidiaryCode } = {}) {
  let sessions = [];
  try {
    const { data } = await supabase.from('pos_sessions').select('*').order('opened_at', { ascending: false }).limit(80);
    if (data?.length) sessions = data;
  } catch { /* local */ }
  if (!sessions.length) sessions = readLs('df_pos_sessions', []) || [];
  const mine = sessions.filter((s) => locMatch(s, locationCode, locationName) || (subsidiaryCode && s.subsidiary_code === subsidiaryCode));
  const closed = mine.filter((s) => String(s.status || '').toLowerCase() === 'closed');
  const lastClosed = closed[0];
  const lastOpen = mine[0];
  let base = 0;
  let since = '1970-01-01T00:00:00.000Z';
  if (lastClosed) {
    base = num(lastClosed.closing_cash || lastClosed.closing_float || lastClosed.opening_float);
    since = lastClosed.closed_at || lastClosed.opened_at || since;
  } else if (lastOpen) {
    base = num(lastOpen.opening_float || lastOpen.total_entered || 0);
    since = lastOpen.opened_at || lastOpen.created_at || since;
  }
  const openings = readLs(OPEN_KEY, []) || [];
  const lastCount = openings.find((o) => locMatch(o, locationCode, locationName));
  if (lastCount && !lastClosed) {
    base = num(lastCount.total_entered);
    since = lastCount.opened_at || since;
  }
  let sales = [];
  try {
    const { data } = await supabase.from('sales_orders').select('*').limit(800);
    if (data?.length) sales = data;
  } catch { /* local */ }
  if (!sales.length) {
    sales = [
      ...(readLs('df_sales_orders', []) || []),
      ...(readLs('df_pos_sales', []) || []),
      ...(readLs('df_sales', []) || []),
    ];
  }
  const sinceMs = Date.parse(since) || 0;
  const extra = sales.filter((s) => {
    if (!locMatch(s, locationCode, locationName) && s.subsidiary_code !== subsidiaryCode) return false;
    const t = Date.parse(s.created_at || s.order_date || s.transaction_date || 0);
    return t >= sinceMs && !/draft|quot|cancel/i.test(s.status || '');
  }).reduce((n, s) => n + cashMomoOf(s), 0);
  return num(base + extra);
}

async function hqRecipients() {
  const fallback = [
    'social.delkorfiberk@gmail.com',
    'bernardfbk@gmail.com',
    'dkormla@gmail.com',
    'colemanharry600@gmail.com',
  ];
  try {
    const { data } = await supabase.from('profiles').select('id,email,role,role_name,designation').limit(300);
    const rows = (data || []).filter((p) => isHqRole(p.role_name || p.role || p.designation) || isOwnerRole(p.role_name || p.role || p.designation));
    const emails = rows.map((p) => String(p.email || '').toLowerCase()).filter(Boolean);
    return emails.length ? emails : fallback;
  } catch {
    return fallback;
  }
}

export async function silentHqAlert(opening) {
  const pol = tillPolicyLocal();
  if (!pol.till_policy_on || !pol.till_silent_alert || !pol.till_count_required) return null;
  if (opening.hq_override) return null;
  const diff = num(opening.difference);
  if (diff === 0) return null;
  const alert = {
    id: uid(),
    till_opening_id: opening.id,
    difference: diff,
    status: 'pending',
    created_at: new Date().toISOString(),
    payload: {
      cashier: opening.cashier_name || opening.cashier_email,
      subsidiary_code: opening.subsidiary_code,
      location_name: opening.location_name,
      location_code: opening.location_code,
      momo_on_hand: opening.momo_on_hand,
      cash_on_hand: opening.cash_on_hand,
      total_entered: opening.total_entered,
      system_expected_total: opening.system_expected_total,
      difference: diff,
      opened_at: opening.opened_at,
    },
  };
  writeLs(ALERT_KEY, [alert, ...(readLs(ALERT_KEY, []) || [])].slice(0, 200));
  try {
    await writeAudit({
      action: 'TILL_DISCREPANCY',
      entity_type: 'staff_alert',
      entity_id: opening.id,
      subsidiary_code: opening.subsidiary_code,
      summary: 'Till discrepancy — ' + (opening.location_name || 'shop') + ' · ' + (opening.cashier_email || ''),
      payload: alert.payload,
    });
  } catch { /* ignore */ }
  try {
    await supabase.from('till_discrepancy_alerts').insert({
      till_opening_id: opening.id,
      difference: diff,
      status: 'pending',
      payload: alert.payload,
    });
  } catch { /* local */ }
  const sign = diff > 0 ? '+' : '−';
  const body = `${opening.location_name || 'Till'} · ${opening.cashier_email || 'cashier'} entered GH₵ ${num(opening.total_entered).toFixed(2)} vs system GH₵ ${num(opening.system_expected_total).toFixed(2)} (${sign} GH₵ ${Math.abs(diff).toFixed(2)}).`;
  const emails = await hqRecipients();
  for (const email of emails) {
    try {
      await pushNotice({
        email,
        title: 'Till discrepancy — ' + (opening.location_name || 'shop'),
        body,
        kind: 'till_discrepancy',
        href: '/till-alerts.html',
        meta: alert.payload,
      });
    } catch { /* keep going */ }
  }
  return alert;
}

export async function recordTillOpening(row) {
  const opening = {
    id: row.id || uid(),
    pos_session_id: row.pos_session_id || null,
    cashier_id: row.cashier_id || null,
    cashier_email: row.cashier_email || '',
    cashier_name: row.cashier_name || '',
    subsidiary_code: row.subsidiary_code || '',
    location_code: row.location_code || '',
    location_name: row.location_name || '',
    momo_on_hand: num(row.momo_on_hand),
    cash_on_hand: num(row.cash_on_hand),
    total_entered: num(row.total_entered),
    system_expected_total: num(row.system_expected_total),
    difference: num(row.difference),
    note: row.note || null,
    device_id: deviceId(),
    public_ip: row.public_ip || '',
    geo_lat: row.geo_lat ?? null,
    geo_lng: row.geo_lng ?? null,
    attend_method: row.attend_method || '',
    attend_verified: !!row.attend_verified,
    hq_override: !!row.hq_override,
    opened_at: row.opened_at || new Date().toISOString(),
  };
  writeLs(OPEN_KEY, [opening, ...(readLs(OPEN_KEY, []) || [])].slice(0, 200));
  try {
    const { data } = await supabase.from('till_openings').insert(opening).select('id').single();
    if (data?.id) opening.id = data.id;
  } catch { /* local */ }
  try {
    const { writeActivity } = await import('./staff-log.js');
    writeActivity({
      action: 'till_open',
      type: 'Till',
      by: opening.cashier_email,
      user_id: opening.cashier_id,
      note: 'Opened till · ' + (opening.location_name || '') + ' · GH₵ ' + opening.total_entered,
      payload: { momo: opening.momo_on_hand, cash: opening.cash_on_hand, expected: opening.system_expected_total },
    });
  } catch { /* ignore */ }
  if (opening.difference !== 0 && !opening.hq_override) {
    await silentHqAlert(opening);
  }
  if (row.attend_verified === false && tillPolicyLocal().till_attend_alert && tillPolicyLocal().till_policy_on && !opening.hq_override) {
    const emails = await hqRecipients();
    for (const email of emails) {
      try {
        await pushNotice({
          email,
          title: 'Attendance unverified — ' + (opening.location_name || 'shop'),
          body: `${opening.cashier_email || 'Staff'} opened the till off the shop IP / geofence (${opening.attend_method || 'unverified'}).`,
          kind: 'attendance_unverified',
          href: '/till-alerts.html',
          meta: { location_code: opening.location_code, ip: opening.public_ip },
        });
      } catch { /* ignore */ }
    }
  }
  return opening;
}

export function listOpenings() {
  return readLs(OPEN_KEY, []) || [];
}

export function listAlerts() {
  return (readLs(ALERT_KEY, []) || []).slice().sort((a, b) => String(b.created_at).localeCompare(String(a.created_at)));
}

export async function pullAlerts() {
  try {
    const { data, error } = await supabase
      .from('till_discrepancy_alerts')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(200);
    if (!error && data?.length) {
      const mapped = data.map((a) => ({
        id: a.id,
        till_opening_id: a.till_opening_id,
        difference: num(a.difference),
        status: a.status || 'pending',
        created_at: a.created_at,
        review_note: a.review_note || '',
        payload: a.payload || {},
      }));
      writeLs(ALERT_KEY, mapped);
      return mapped;
    }
  } catch { /* local */ }
  return listAlerts();
}

export async function setAlertStatus(id, status, reviewNote) {
  const next = listAlerts().map((a) => String(a.id) === String(id)
    ? { ...a, status, review_note: reviewNote || a.review_note || '', updated_at: new Date().toISOString() }
    : a);
  writeLs(ALERT_KEY, next);
  try {
    await supabase.from('till_discrepancy_alerts').update({
      status,
      review_note: reviewNote || null,
      updated_at: new Date().toISOString(),
    }).eq('id', id);
  } catch { /* local */ }
}
