/** Till cash/MoMo + silent-alert policy. HQ Admin and above only. */
import { BIZ_DEFAULTS, loadBizSettings, saveBizSettings } from './settings-store.js';
import { isHqRole, isOwnerRole } from './access-rules.js';
import { getAccess } from './rbac.js';

export const TILL_POLICY_KEYS = [
  'till_policy_on',
  'till_count_required',
  'till_silent_alert',
  'till_flash_bot',
  'till_block_mismatch',
  'till_attend_on',
  'till_attend_alert',
  'till_geofence_m',
  'staff_hours_on',
  'staff_start',
  'staff_grace_min',
  'staff_late_alert',
  'staff_absent_alert',
  'staff_absent_after_min',
  'staff_hours_day',
  'staff_days_week',
  'staff_kpi_att_weight',
];

function pick(biz) {
  const src = biz || {};
  const start = String(src.staff_start || '08:00');
  return {
    till_policy_on: src.till_policy_on !== false,
    till_count_required: src.till_count_required !== false,
    till_silent_alert: src.till_silent_alert !== false,
    till_flash_bot: src.till_flash_bot !== false,
    till_block_mismatch: src.till_block_mismatch === true,
    till_attend_on: src.till_attend_on !== false,
    till_attend_alert: src.till_attend_alert !== false,
    till_geofence_m: Math.max(20, Number(src.till_geofence_m) || 60),
    staff_hours_on: src.staff_hours_on !== false,
    staff_start: /^\d{2}:\d{2}$/.test(start) ? start : '08:00',
    staff_grace_min: Math.max(0, Number(src.staff_grace_min) || 0),
    staff_late_alert: src.staff_late_alert !== false,
    staff_absent_alert: src.staff_absent_alert !== false,
    staff_absent_after_min: Math.max(0, Number(src.staff_absent_after_min) || 15),
    staff_hours_day: Math.max(1, Number(src.staff_hours_day) || 8),
    staff_days_week: Math.max(1, Math.min(7, Number(src.staff_days_week) || 5)),
    staff_kpi_att_weight: Math.min(100, Math.max(0, Number(src.staff_kpi_att_weight) || 60)),
  };
}

export function canEditTillPolicy(role) {
  const name = role || getAccess()?.roleName || '';
  return isHqRole(name) || isOwnerRole(name);
}

export function tillPolicyLocal() {
  try {
    const raw = JSON.parse(localStorage.getItem('ax_biz_settings') || '{}');
    return pick({ ...BIZ_DEFAULTS, ...raw });
  } catch {
    return pick(BIZ_DEFAULTS);
  }
}

export async function loadTillPolicy() {
  const biz = await loadBizSettings();
  const next = pick(biz);
  try {
    const cur = JSON.parse(localStorage.getItem('ax_biz_settings') || '{}');
    localStorage.setItem('ax_biz_settings', JSON.stringify({ ...cur, ...next }));
  } catch { /* ignore */ }
  return next;
}

export async function saveTillPolicy(patch) {
  if (!canEditTillPolicy()) {
    return { error: { message: 'Only HQ Admin and above can change till policy.' } };
  }
  const biz = await loadBizSettings();
  const next = { ...biz, ...pick({ ...biz, ...patch }) };
  return saveBizSettings(next);
}
