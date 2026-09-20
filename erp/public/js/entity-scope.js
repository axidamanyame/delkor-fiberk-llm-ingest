import { OPERATING_SUBSIDIARIES, SUBSIDIARIES, getActiveSubsidiary } from './supabaseClient.js';
import {
  locationsFor,
  getActiveAgent,
  locationSupportsAgents,
  getActiveLocation,
  defaultFormLocation,
  defaultFormSubsidiary,
} from './scope.js';
import { isHqRole } from './access-rules.js';

const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));

export function subsidiaryLabel(code) {
  const c = String(code || '').toLowerCase();
  if (!c || c === 'group' || c === 'ops') return '—';
  const hit = SUBSIDIARIES.find((s) => s.code === code);
  return hit?.name || '—';
}

/** HQ Admin / Owner and other group staff belong to the mother company. */
export function userMembershipLabel(row, roleName) {
  const role = roleName || row?.role || row?.role_name || '';
  const code = row?.subsidiary_code || row?.home_subsidiary || '';
  if (isHqRole(role) || code === 'group' || !code) {
    const loc = String(row?.location_code || '');
    if (loc === 'OPS-HUB' || loc === 'GRP-HQ' || /corporate|operations hub/i.test(String(row?.location_name || ''))) {
      return 'Operations Hub';
    }
    return 'Delkor-Fiberk Group';
  }
  return subsidiaryLabel(code);
}

/** Operating companies only — records must belong to one real subsidiary. */
export function subsidiarySelect(selected, { required = true, name = 'subsidiary_code', allowGroup = false, disabled = false } = {}) {
  const list = allowGroup ? SUBSIDIARIES : OPERATING_SUBSIDIARIES;
  const cur = defaultFormSubsidiary(selected);
  const opts = [`<option value="">Please Select</option>`]
    .concat(list.map((s) => `<option value="${esc(s.code)}" ${cur === s.code ? 'selected' : ''}>${esc(s.short || s.name)}</option>`));
  return `<label class="fld">Subsidiary${required && !disabled ? ':*' : ':'}
    <select name="${name}" ${required && !disabled ? 'required' : ''} ${disabled ? 'disabled' : ''}>${opts.join('')}</select>
    ${disabled ? `<input type="hidden" name="${name}" value="${esc(cur || 'group')}" />` : ''}
  </label>`;
}

export function locationSelect(subCode, selected, { name = 'location_code', required = true } = {}) {
  const sub = subCode || defaultFormSubsidiary('') || getActiveSubsidiary()?.code || 'group';
  const locs = locationsFor(sub);
  const cur = defaultFormLocation(selected);
  const opts = [`<option value="">Please Select</option>`]
    .concat(locs.map((l) => `<option value="${esc(l.code)}" ${cur === l.code ? 'selected' : ''}>${esc(l.name)}</option>`));
  return `<label class="fld">Business Location${required ? ':*' : ':'}
    <select name="${name}" ${required ? 'required' : ''}>${opts.join('')}</select>
  </label>`;
}

export function stampScope(payload, form) {
  const sub = form.subsidiary_code?.value || defaultFormSubsidiary('') || '';
  let loc = form.location_code?.value || '';
  if (!sub) throw new Error('Pick the subsidiary this record belongs to.');
  const groupWide = String(sub).toLowerCase() === 'group';
  const hasLocField = !!(form.location_code);
  const allLocs = !!(form.all_locations?.checked);
  if (!loc && !groupWide && hasLocField) {
    loc = defaultFormLocation('') || getActiveLocation() || '';
  }
  if (hasLocField && !groupWide && !allLocs && !loc) {
    throw new Error('Pick the business location this record belongs to.');
  }
  payload.subsidiary_code = sub;
  payload.location_code = groupWide || allLocs ? (loc || '') : loc;
  if (loc && locationSupportsAgents(loc)) {
    const agent = form.agent_id?.value || getActiveAgent() || null;
    payload.agent_id = agent || null;
  }
  return payload;
}

/** Ghana operates 16 regions. Country is always Ghana until we go global. */
export const GHANA_REGIONS = [
  'Ahafo', 'Ashanti', 'Bono', 'Bono East', 'Central', 'Eastern',
  'Greater Accra', 'North East', 'Northern', 'Oti', 'Savannah',
  'Upper East', 'Upper West', 'Volta', 'Western', 'Western North',
];

export function regionSelect(selected, { name = 'region', id = '', required = false, disabled = false } = {}) {
  const cur = selected || 'Greater Accra';
  const opts = [`<option value="">Please Select</option>`]
    .concat(GHANA_REGIONS.map((r) => `<option value="${esc(r)}" ${cur === r ? 'selected' : ''}>${esc(r)}</option>`));
  return `<select name="${name}" ${id ? `id="${id}"` : ''} ${required ? 'required' : ''} ${disabled ? 'disabled' : ''}>${opts.join('')}</select>`;
}

export function ghanaGps(row = {}) {
  return row.ghana_post_gps || row.digital_address || row.zip_code || row.zip || '';
}

export function ghanaRegion(row = {}) {
  return row.region || row.state || '';
}

/** Street · city · region · digital address. Never country / zip / state. */
export function ghanaAddressLine(row = {}) {
  return [
    row.address_line || row.address || row.landmark || '',
    row.suburb || '',
    row.city || '',
    ghanaRegion(row),
    ghanaGps(row),
  ].filter(Boolean).join(' · ');
}

/** Write Ghana fields and keep legacy zip/state/country columns filled so old schema still saves. */
export function stampGhanaAddress(payload, src = {}) {
  const region = src.region || payload.region || ghanaRegion(payload) || 'Greater Accra';
  const gps = src.ghana_post_gps || src.digital_address || payload.ghana_post_gps || ghanaGps(payload) || '';
  const city = src.city || payload.city || '';
  payload.city = city || null;
  payload.region = region || null;
  payload.ghana_post_gps = gps || null;
  payload.country = 'Ghana';
  payload.state = region || null;
  payload.zip = gps || null;
  payload.zip_code = gps || null;
  return payload;
}
