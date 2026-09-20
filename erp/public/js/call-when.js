/** Calendar stamp for collection / call-centre rows. Newest first everywhere. */

export function callDay(c) {
  const blob = [c?.called_on, c?.at, c?.called_at, c?.callback_on, c?.due_on, c?.promised_on].filter(Boolean).join(' ');
  const m = String(blob).match(/(\d{4}-\d{2}-\d{2})/);
  return m ? m[1] : '';
}

export function callTime(c) {
  const tm = String(c?.called_at || '').trim();
  if (/^\d{1,2}:\d{2}/.test(tm)) return tm.length <= 5 ? tm + ':00' : tm.slice(0, 8);
  const blob = String(c?.called_on || c?.at || '');
  const m = blob.match(/(\d{1,2}:\d{2})(?::(\d{2}))?/);
  if (!m) return '00:00:00';
  return (m[1].length <= 5 ? m[1] : m[1].slice(0, 5)) + ':' + (m[2] || '00');
}

export function callStamp(c) {
  const day = callDay(c) || '1970-01-01';
  const n = Date.parse(day + 'T' + callTime(c));
  if (!Number.isNaN(n)) return n;
  const raw = Date.parse(String(c?.at || c?.called_at || c?.updated_at || ''));
  return Number.isNaN(raw) ? 0 : raw;
}

export function sortCallsRecent(list) {
  return (list || []).slice().sort((a, b) => {
    const d = callStamp(b) - callStamp(a);
    if (d) return d;
    return String(b.id || '').localeCompare(String(a.id || ''));
  });
}

export function formatCallDay(day) {
  if (!day) return 'Undated';
  const dt = new Date(day + 'T12:00:00');
  if (Number.isNaN(dt.getTime())) return day;
  return dt.toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' });
}

export function formatCallWhen(c) {
  const day = callDay(c);
  const tm = callTime(c).slice(0, 5);
  return [day, tm !== '00:00' ? tm : ''].filter(Boolean).join(' ');
}
