import { confirmAction, ackResult } from './confirm-action.js';
/**
 * Delkor-Fiberk ERP Calendar + Add To Do.
 * Events live in localStorage so the pane stays dense without extra SQL.
 */
import { esc, uid, readLs, writeLs } from './ls-rows.js';
import { BUSINESS_LOCATIONS } from './scope.js';

export const CAL_KEY = 'df_cal_events';
export const CAL_FLAG = 'df_cal_demo_v2';
export const PROFILE_KEY = 'df_my_profile';
export const NOTIF_KEY = 'df_notif_templates';

export const EVENT_TYPES = [
  { id: 'bookings', label: 'Bookings', color: '#0ea5e9' },
  { id: 'followups', label: 'Follow ups', color: '#2563eb' },
  { id: 'todo', label: 'To Do', color: '#16a34a' },
  { id: 'holidays', label: 'Holidays', color: '#dc2626' },
  { id: 'leaves', label: 'Leaves', color: '#7c3aed' },
  { id: 'reminders', label: 'Reminders', color: '#ea580c' },
];

export const STAFF = [
  { id: 'u-unassigned', name: 'Unassigned', email: '' },
];

export const PRIORITIES = ['Low', 'Medium', 'High', 'Urgent'];
export const STATUSES = ['New', 'In Progress', 'On Hold', 'Completed'];

export function typeOf(id) {
  return EVENT_TYPES.find((t) => t.id === id) || EVENT_TYPES[2];
}

export function staffOf(id) {
  return STAFF.find((s) => s.id === id) || STAFF[0];
}

function ev(partial) {
  return {
    id: uid(),
    type: 'todo',
    title: '',
    start: '',
    end: '',
    allDay: true,
    user_id: 'u-unassigned',
    location_code: '',
    priority: 'Medium',
    status: 'New',
    hours: '',
    description: '',
    files: [],
    ...partial,
  };
}

function seedEvents() {
  const rows = [
    ev({ type: 'holidays', title: "New Year's Day", start: '2026-01-01', allDay: true, user_id: '' }),
    ev({ type: 'holidays', title: 'Independence Day', start: '2026-03-06', allDay: true, user_id: '' }),
    ev({ type: 'holidays', title: 'Good Friday', start: '2026-04-03', allDay: true, user_id: '' }),
    ev({ type: 'holidays', title: 'Easter Monday', start: '2026-04-06', allDay: true, user_id: '' }),
    ev({ type: 'holidays', title: 'May Day', start: '2026-05-01', allDay: true, user_id: '' }),
    ev({ type: 'holidays', title: "Founders' Day", start: '2026-08-04', allDay: true, user_id: '' }),
    ev({ type: 'holidays', title: 'Kwame Nkrumah Memorial Day', start: '2026-09-21', allDay: true, user_id: '' }),
    ev({ type: 'holidays', title: "Farmers' Day", start: '2026-12-04', allDay: true, user_id: '' }),
    ev({ type: 'holidays', title: 'Christmas Day', start: '2026-12-25', allDay: true, user_id: '' }),
    ev({ type: 'holidays', title: 'Boxing Day', start: '2026-12-26', allDay: true, user_id: '' }),
  ];
  writeLs(CAL_KEY, rows);
  try { localStorage.setItem(CAL_FLAG, '1'); } catch { /* ignore */ }
  return rows;
}

export function loadEvents() {
  try {
    if (localStorage.getItem(CAL_FLAG) !== '1') return seedEvents();
  } catch { /* ignore */ }
  return readLs(CAL_KEY, []);
}

export function saveEvents(rows) {
  writeLs(CAL_KEY, rows);
  pingCal();
}

export function upsertEvent(row) {
  const rows = loadEvents();
  const next = { ...row, id: row.id || uid(), updated_at: new Date().toISOString() };
  const i = rows.findIndex((r) => String(r.id) === String(next.id));
  if (i >= 0) rows[i] = { ...rows[i], ...next };
  else rows.unshift(next);
  saveEvents(rows);
  return next;
}

export function removeEvent(id) {
  saveEvents(loadEvents().filter((r) => String(r.id) !== String(id)));
}

export function pingCal() {
  const evn = new Event('df-cal-change');
  window.dispatchEvent(evn);
  try { window.parent.dispatchEvent(evn); } catch { /* ignore */ }
}

export function ymd(d) {
  const x = d instanceof Date ? d : new Date(d);
  if (Number.isNaN(x.getTime())) return '';
  const z = (n) => String(n).padStart(2, '0');
  return `${x.getFullYear()}-${z(x.getMonth() + 1)}-${z(x.getDate())}`;
}

export function parseDay(iso) {
  const s = String(iso || '').slice(0, 10);
  const [y, m, d] = s.split('-').map(Number);
  if (!y) return new Date();
  return new Date(y, m - 1, d);
}

export function eventDay(e) {
  return String(e.start || '').slice(0, 10);
}

export function eventOnDay(e, day) {
  const a = eventDay(e);
  const b = String(e.end || a).slice(0, 10);
  return a && day >= a && day <= b;
}

export function locLabel(code) {
  if (!code) return 'All Locations';
  return BUSINESS_LOCATIONS.find((l) => l.code === code)?.name || code;
}

export function filterEvents(rows, { userId = '', loc = '', types = null } = {}) {
  const on = types || new Set(EVENT_TYPES.map((t) => t.id));
  return rows.filter((e) => {
    if (!on.has(e.type)) return false;
    if (userId && e.user_id && e.user_id !== userId) return false;
    if (loc && e.location_code && e.location_code !== loc) return false;
    return true;
  });
}

function startOfMonth(d) { return new Date(d.getFullYear(), d.getMonth(), 1); }

function monthGrid(anchor) {
  const first = startOfMonth(anchor);
  const start = new Date(first);
  start.setDate(1 - first.getDay()); // Sunday
  const cells = [];
  for (let i = 0; i < 42; i++) {
    const d = new Date(start);
    d.setDate(start.getDate() + i);
    cells.push(d);
  }
  return cells;
}

function weekDays(anchor) {
  const s = new Date(anchor);
  s.setDate(anchor.getDate() - anchor.getDay());
  return Array.from({ length: 7 }, (_, i) => {
    const d = new Date(s);
    d.setDate(s.getDate() + i);
    return d;
  });
}

function fmtTime(iso) {
  if (!iso || iso.length <= 10) return '';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  return d.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' });
}

function chip(e) {
  const t = typeOf(e.type);
  const time = e.allDay ? '' : fmtTime(e.start);
  return `<button type="button" class="cal-chip" data-id="${esc(e.id)}" style="background:${t.color}22;color:${t.color};border-color:${t.color}55" title="${esc(e.title)}">${time ? `<span class="tm">${esc(time)}</span>` : ''}${esc(e.title)}</button>`;
}

export function renderMonth(anchor, events) {
  const cells = monthGrid(anchor);
  const today = ymd(new Date());
  const mon = anchor.getMonth();
  const heads = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
  return `<div class="cal-month">
    <div class="cal-head">${heads.map((h) => `<div>${h}</div>`).join('')}</div>
    <div class="cal-grid">${cells.map((d) => {
      const day = ymd(d);
      const out = d.getMonth() !== mon;
      const hits = events.filter((e) => eventOnDay(e, day)).slice(0, 3);
      const extra = events.filter((e) => eventOnDay(e, day)).length - hits.length;
      return `<div class="cal-cell ${out ? 'out' : ''} ${day === today ? 'today' : ''}" data-day="${day}">
        <div class="cal-num">${d.getDate()}</div>
        <div class="cal-chips">${hits.map(chip).join('')}${extra > 0 ? `<span class="cal-more">+${extra} more</span>` : ''}</div>
      </div>`;
    }).join('')}</div>
  </div>`;
}

export function renderWeek(anchor, events) {
  const days = weekDays(anchor);
  const hours = Array.from({ length: 13 }, (_, i) => i + 7);
  return `<div class="cal-week">
    <div class="cal-week-head"><div></div>${days.map((d) =>
      `<div class="${ymd(d) === ymd(new Date()) ? 'today' : ''}"><b>${d.toLocaleDateString('en-GB', { weekday: 'short' })}</b><span>${d.getDate()}</span></div>`
    ).join('')}</div>
    <div class="cal-week-body">${hours.map((h) => {
      const lab = `${String(h).padStart(2, '0')}:00`;
      return `<div class="cal-hour"><div class="cal-h">${lab}</div>${days.map((d) => {
        const day = ymd(d);
        const hits = events.filter((e) => eventOnDay(e, day) && (e.allDay || Number(String(e.start).slice(11, 13)) === h));
        return `<div class="cal-slot" data-day="${day}" data-h="${h}">${hits.map(chip).join('')}</div>`;
      }).join('')}</div>`;
    }).join('')}</div>
  </div>`;
}

export function renderDay(anchor, events) {
  const day = ymd(anchor);
  const hits = events.filter((e) => eventOnDay(e, day));
  const hours = Array.from({ length: 13 }, (_, i) => i + 7);
  return `<div class="cal-dayv">
    <h3>${anchor.toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}</h3>
    ${hours.map((h) => {
      const at = hits.filter((e) => e.allDay ? h === 7 : Number(String(e.start).slice(11, 13)) === h);
      return `<div class="cal-day-row"><div class="cal-h">${String(h).padStart(2, '0')}:00</div><div class="cal-slot" data-day="${day}" data-h="${h}">${at.map(chip).join('') || ''}</div></div>`;
    }).join('')}
  </div>`;
}

export function renderList(anchor, events, view) {
  let from;
  let to;
  if (view === 'week') {
    const days = weekDays(anchor);
    from = ymd(days[0]);
    to = ymd(days[6]);
  } else if (view === 'day') {
    from = to = ymd(anchor);
  } else {
    const first = startOfMonth(anchor);
    const last = new Date(anchor.getFullYear(), anchor.getMonth() + 1, 0);
    from = ymd(first);
    to = ymd(last);
  }
  const rows = events.filter((e) => {
    const a = eventDay(e);
    const b = String(e.end || a).slice(0, 10);
    return a && b >= from && a <= to;
  }).sort((a, b) => String(a.start).localeCompare(String(b.start)));
  if (!rows.length) return `<div class="cal-empty">No events in this period.</div>`;
  return `<table class="ult-table cal-list"><thead><tr><th>Date</th><th>Type</th><th>Title</th><th>User</th><th>Location</th><th>Status</th></tr></thead><tbody>
    ${rows.map((e) => {
      const t = typeOf(e.type);
      const who = e.user_id ? staffOf(e.user_id).name : '—';
      return `<tr data-id="${esc(e.id)}" class="cal-list-row">
        <td>${esc(eventDay(e))}${e.allDay ? '' : ' · ' + esc(fmtTime(e.start))}</td>
        <td><span class="cal-tag" style="background:${t.color}">${esc(t.label)}</span></td>
        <td><button type="button" class="cal-link" data-id="${esc(e.id)}">${esc(e.title)}</button></td>
        <td>${esc(who)}</td>
        <td>${esc(locLabel(e.location_code))}</td>
        <td>${esc(e.status || '—')}</td>
      </tr>`;
    }).join('')}
  </tbody></table>`;
}

export function titleFor(anchor) {
  return anchor.toLocaleDateString('en-GB', { month: 'long', year: 'numeric' });
}

function localNowInput() {
  const d = new Date();
  d.setMinutes(d.getMinutes() - d.getTimezoneOffset());
  return d.toISOString().slice(0, 16);
}

export function openTodoModal(opts = {}) {
  const existing = opts.event || null;
  const startVal = existing
    ? String(existing.start || '').slice(0, 16)
    : (opts.start || localNowInput());
  const endVal = existing ? String(existing.end || '').slice(0, 16) : '';
  const host = document.body;
  host.querySelector('#todo-modal-bg')?.remove();
  const bg = document.createElement('div');
  bg.id = 'todo-modal-bg';
  bg.className = 'pay-modal-bg';
  const assigned = existing?.user_id || opts.userId || 'u-hq';
  bg.innerHTML = `<div class="pay-modal wide todo-modal" role="dialog" aria-label="Add To Do">
    <div class="pay-modal-h">
      <h2>${existing ? 'Edit To Do' : 'Add To Do'}</h2>
      <button type="button" class="pay-modal-x" data-close>×</button>
    </div>
    <div class="pay-modal-b">
      <div class="fld"><label>Task:*</label><input id="td-title" value="${esc(existing?.title || '')}" /></div>
      <div class="fld"><label>Assigned To:*</label>
        <select id="td-user">${STAFF.map((s) =>
          `<option value="${s.id}" ${s.id === assigned ? 'selected' : ''}>${esc(s.name)}</option>`).join('')}</select>
      </div>
      <div class="todo-split">
        <div class="fld"><label>Priority:</label>
          <select id="td-pri"><option value="">Please Select</option>${PRIORITIES.map((p) =>
            `<option ${existing?.priority === p ? 'selected' : ''}>${p}</option>`).join('')}</select>
        </div>
        <div class="fld"><label>Status:</label>
          <select id="td-st"><option value="">Please Select</option>${STATUSES.map((p) =>
            `<option ${existing?.status === p ? 'selected' : ''}>${p}</option>`).join('')}</select>
        </div>
      </div>
      <div class="todo-split">
        <div class="fld"><label>Start Date:*</label><input id="td-start" type="datetime-local" value="${esc(startVal)}" /></div>
        <div class="fld"><label>End Date:</label><input id="td-end" type="datetime-local" value="${esc(endVal)}" /></div>
      </div>
      <div class="fld"><label>Estimated Hours:</label><input id="td-hours" type="number" min="0" step="0.5" value="${esc(existing?.hours || '')}" /></div>
      <div class="fld"><label>Description:</label>
        <div class="todo-tb">
          <button type="button" data-cmd="bold"><b>B</b></button>
          <button type="button" data-cmd="italic"><i>I</i></button>
          <button type="button" data-cmd="underline"><u>U</u></button>
          <button type="button" data-cmd="insertUnorderedList">• List</button>
        </div>
        <div id="td-desc" class="todo-desc" contenteditable="true">${existing?.description || ''}</div>
      </div>
      <div class="fld"><label>Upload Documents:</label>
        <div class="todo-drop" id="td-drop">Drop files here to upload<input id="td-files" type="file" multiple /></div>
        <ul class="todo-files" id="td-file-list">${(existing?.files || []).map((f) => `<li>${esc(f.name)}</li>`).join('')}</ul>
      </div>
    </div>
    <div class="pay-modal-f">
      <button type="button" class="btn-save" id="td-save">Save</button>
      <button type="button" class="btn-close" data-close>Close</button>
    </div>
  </div>`;
  host.appendChild(bg);
  const files = [...(existing?.files || [])];
  const list = () => {
    bg.querySelector('#td-file-list').innerHTML = files.map((f) => `<li>${esc(f.name)} <small>(${Math.round((f.size || 0) / 1024)} KB)</small></li>`).join('');
  };
  bg.querySelector('#td-files').onchange = (e) => {
    [...e.target.files].forEach((f) => files.push({ name: f.name, size: f.size }));
    list();
  };
  const drop = bg.querySelector('#td-drop');
  drop.addEventListener('dragover', (e) => { e.preventDefault(); drop.classList.add('over'); });
  drop.addEventListener('dragleave', () => drop.classList.remove('over'));
  drop.addEventListener('drop', (e) => {
    e.preventDefault();
    drop.classList.remove('over');
    [...e.dataTransfer.files].forEach((f) => files.push({ name: f.name, size: f.size }));
    list();
  });
  bg.querySelectorAll('.todo-tb [data-cmd]').forEach((b) => {
    b.onclick = () => document.execCommand(b.dataset.cmd, false, null);
  });
  const close = () => bg.remove();
  bg.querySelectorAll('[data-close]').forEach((b) => { b.onclick = close; });
  bg.addEventListener('click', (e) => { if (e.target === bg) close(); });
  bg.querySelector('#td-save').onclick = () => {
    const title = bg.querySelector('#td-title').value.trim();
    if (!title) { bg.querySelector('#td-title').focus(); return; }
    const start = bg.querySelector('#td-start').value;
    if (!start) { bg.querySelector('#td-start').focus(); return; }
    upsertEvent({
      id: existing?.id,
      type: 'todo',
      title,
      start,
      end: bg.querySelector('#td-end').value || '',
      allDay: start.length <= 10,
      user_id: bg.querySelector('#td-user').value,
      location_code: existing?.location_code || opts.location || '',
      priority: bg.querySelector('#td-pri').value,
      status: bg.querySelector('#td-st').value || 'New',
      hours: bg.querySelector('#td-hours').value,
      description: bg.querySelector('#td-desc').innerHTML,
      files,
    });
    close();
    if (typeof opts.onSaved === 'function') opts.onSaved();
  };
  return bg;
}

export function openEventPop(e, anchorEl) {
  document.getElementById('cal-pop')?.remove();
  const t = typeOf(e.type);
  const pop = document.createElement('div');
  pop.id = 'cal-pop';
  pop.className = 'cal-pop';
  pop.innerHTML = `
    <header style="background:${t.color}">${esc(t.label)}</header>
    <div class="cal-pop-b">
      <strong>${esc(e.title)}</strong>
      <p>${esc(eventDay(e))}${e.allDay ? '' : ' · ' + esc(fmtTime(e.start))}${e.end ? ' → ' + esc(fmtTime(e.end) || String(e.end).slice(0, 10)) : ''}</p>
      <p>${e.user_id ? esc(staffOf(e.user_id).name) : 'All users'} · ${esc(locLabel(e.location_code))}</p>
      ${e.priority ? `<p>Priority: ${esc(e.priority)} · ${esc(e.status || '')}</p>` : ''}
      ${e.description ? `<div class="cal-pop-desc">${e.description}</div>` : ''}
      <div class="cal-pop-act">
        ${e.type === 'todo' ? `<button type="button" class="btn-save" data-edit>Edit</button>` : ''}
        ${e.type === 'todo' ? `<button type="button" class="btn-close" data-del>Delete</button>` : ''}
        <button type="button" class="btn-close" data-x>Close</button>
      </div>
    </div>`;
  document.body.appendChild(pop);
  const r = anchorEl?.getBoundingClientRect?.();
  if (r) {
    pop.style.top = Math.min(window.innerHeight - 220, r.bottom + 6) + 'px';
    pop.style.left = Math.min(window.innerWidth - 320, Math.max(8, r.left)) + 'px';
  }
  pop.querySelector('[data-x]').onclick = () => pop.remove();
  pop.querySelector('[data-edit]')?.addEventListener('click', () => { pop.remove(); openTodoModal({ event: e }); });
  pop.querySelector('[data-del]')?.addEventListener('click', async () => {
    if (await confirmAction('Delete this to do?', 'This cannot be undone.')) {
      removeEvent(e.id);
      pop.remove();
      ackResult(true, 'To do deleted.');
    }
  });
  setTimeout(() => {
    const hide = (ev) => { if (!pop.contains(ev.target)) { pop.remove(); document.removeEventListener('click', hide, true); } };
    document.addEventListener('click', hide, true);
  }, 0);
}

/* ---------- Profile extras ---------- */
export const DEFAULT_PROFILE = {
  prefix: '',
  first_name: '',
  last_name: '',
  email: '',
  language: 'English',
  photo: '',
  dob: '',
  gender: '',
  marital: '',
  blood: '',
  mobile: '',
  alt_phone: '',
  family_phone: '',
  facebook: '',
  twitter: '',
  social1: '',
  social2: '',
  custom1: '',
  custom2: '',
  custom3: '',
  custom4: '',
  guardian: '',
  id_name: 'Ghana Card',
  id_number: '',
  perm_address: '',
  curr_address: '',
  bank_holder: '',
  bank_number: '',
  bank_name: '',
  bank_bic: '',
  bank_branch: '',
  tax_payer_id: '',
};

export function loadProfileExtra() {
  try {
    const raw = localStorage.getItem(PROFILE_KEY);
    if (raw) {
      const p = JSON.parse(raw);
      const email = String(p.email || '').toLowerCase();
      const sandboxHq = email === 'finance@delkorfiberk.com'
        || (String(p.first_name || '') === 'HQ' && String(p.last_name || '') === 'Finance');
      if (sandboxHq) {
        localStorage.removeItem(PROFILE_KEY);
        return { ...DEFAULT_PROFILE };
      }
      return { ...DEFAULT_PROFILE, ...p };
    }
  } catch { /* ignore */ }
  return { ...DEFAULT_PROFILE };
}

export function saveProfileExtra(p) {
  localStorage.setItem(PROFILE_KEY, JSON.stringify(p));
}

/* ---------- Notification templates ---------- */
function tpl(subject, email, sms, extra = {}) {
  return {
    subject, cc: '', bcc: '',
    email_body: email,
    sms_body: sms,
    whatsapp_text: extra.whatsapp_text ?? sms,
    auto_send: extra.auto_send ?? false,
    auto_send_sms: extra.auto_send_sms ?? false,
    auto_send_whatsapp: extra.auto_send_whatsapp ?? false,
    ...extra,
  };
}

const TAGS_BIZ = '{business_name}, {business_logo}';
const TAGS_CONTACT = '{contact_name}, {contact_custom_field_1}, {contact_custom_field_2}, {contact_custom_field_3}, {contact_custom_field_4}, {contact_custom_field_5}, {contact_custom_field_6}, {contact_custom_field_7}, {contact_custom_field_8}, {contact_custom_field_9}, {contact_custom_field_10}';
const TAGS_LOCATION = '{location_name}, {location_address}, {location_email}, {location_phone}, {location_custom_field_1}, {location_custom_field_2}, {location_custom_field_3}, {location_custom_field_4}';
const TAGS_SHIP = '{shipping_custom_field_1}, {shipping_custom_field_2}, {shipping_custom_field_3}, {shipping_custom_field_4}, {shipping_custom_field_5}';

export const NOTIF_GROUPS = [
  {
    title: 'Notifications:',
    tabs: [
      {
        id: 'send_ledger',
        label: 'Send Ledger',
        tags: [TAGS_BIZ, '{balance_due}', TAGS_CONTACT],
        ledger: true,
      },
    ],
  },
  {
    title: 'Customer Notifications:',
    tabs: [
      {
        id: 'new_sale',
        label: 'New Sale',
        tags: [
          TAGS_BIZ,
          '{invoice_number}, {invoice_url}, {total_amount}, {paid_amount}, {due_amount}, {cumulative_due_amount}, {due_date}',
          TAGS_LOCATION,
          TAGS_CONTACT,
          '{sell_custom_field_1}, {sell_custom_field_2}, {sell_custom_field_3}, {sell_custom_field_4}',
          TAGS_SHIP,
        ],
        hint: 'If enabled, sell notification will be automatically sent to customer on creating new sales for them',
      },
      {
        id: 'payment_received',
        label: 'Payment Received',
        tags: [
          TAGS_BIZ,
          '{invoice_number}, {paid_amount}, {due_amount}',
          TAGS_LOCATION,
          TAGS_CONTACT,
        ],
        hint: 'If enabled, a notice is sent when a customer payment is recorded',
      },
      {
        id: 'payment_reminder',
        label: 'Payment Reminder',
        tags: [
          TAGS_BIZ,
          '{invoice_number}, {due_amount}, {due_date}, {cumulative_due_amount}',
          TAGS_LOCATION,
          TAGS_CONTACT,
        ],
        hint: 'If enabled, a reminder is sent for invoices that still have a balance',
      },
      {
        id: 'new_booking',
        label: 'New Booking',
        tags: [TAGS_BIZ, '{booking_ref}, {booking_date}', TAGS_LOCATION, TAGS_CONTACT],
        hint: 'If enabled, booking confirmation is sent to the customer',
      },
      {
        id: 'new_quotation',
        label: 'New Quotation',
        tags: [TAGS_BIZ, '{quotation_no}, {total_amount}', TAGS_LOCATION, TAGS_CONTACT],
        hint: 'If enabled, the quotation is sent to the customer',
      },
    ],
  },
  {
    title: 'Supplier Notifications:',
    tabs: [
      {
        id: 'new_order',
        label: 'New Order',
        tags: [
          TAGS_BIZ,
          '{order_ref_number}, {total_amount}, {received_amount}, {due_amount}',
          TAGS_LOCATION,
          '{purchase_custom_field_1}, {purchase_custom_field_2}, {purchase_custom_field_3}, {purchase_custom_field_4}, {contact_business_name}',
          TAGS_CONTACT,
          TAGS_SHIP,
        ],
        hint: 'If enabled, the supplier is notified when a purchase order is created',
      },
      {
        id: 'payment_paid',
        label: 'Payment Paid',
        tags: [TAGS_BIZ, '{order_ref_number}, {paid_amount}', TAGS_LOCATION, TAGS_CONTACT],
        hint: 'If enabled, the supplier is notified when a payment is recorded',
      },
      {
        id: 'items_received',
        label: 'Items Received',
        tags: [TAGS_BIZ, '{order_ref_number}', TAGS_LOCATION, TAGS_CONTACT],
        hint: 'If enabled, the supplier is notified when goods are received',
      },
      {
        id: 'items_pending',
        label: 'Items Pending',
        tags: [TAGS_BIZ, '{order_ref_number}', TAGS_LOCATION, TAGS_CONTACT],
        hint: 'If enabled, the supplier is notified of pending items',
      },
      {
        id: 'purchase_order',
        label: 'Purchase Order',
        tags: [
          TAGS_BIZ,
          '{order_ref_number}, {total_amount}, {received_amount}, {due_amount}',
          TAGS_LOCATION,
          TAGS_CONTACT,
        ],
        hint: 'If enabled, the purchase order is sent to the supplier',
      },
    ],
  },
];

export function defaultNotifTemplates() {
  return {
    send_ledger: tpl(
      'Account ledger from {business_name}',
      '<p>Dear {contact_name},</p><p>Please find your ledger from {business_name}.</p><p>Balance due: {balance_due}</p><p>{business_logo}</p>',
      'Dear {contact_name}, your balance due with {business_name} is {balance_due}.',
    ),
    new_sale: tpl(
      'Thank you from {business_name}',
      '<p>Dear {contact_name},</p><p>Your invoice number is {invoice_number}<br>Total amount: {total_amount}<br>Paid amount: {received_amount}</p><p>Thank you for shopping with us.</p><p>{business_logo}</p>',
      'Dear {contact_name}, Thank you for shopping with us. {business_name}',
    ),
    payment_received: tpl(
      'Payment received — {business_name}',
      '<p>Dear {contact_name},</p><p>We received {paid_amount} against invoice {invoice_number}.</p><p>{business_logo}</p>',
      'Payment of {paid_amount} received for {invoice_number}. {business_name}',
    ),
    payment_reminder: tpl(
      'Payment reminder from {business_name}',
      '<p>Dear {contact_name},</p><p>Invoice {invoice_number} has {due_amount} due on {due_date}.</p><p>{business_logo}</p>',
      'Reminder: {due_amount} due on {due_date} for {invoice_number}. {business_name}',
    ),
    new_booking: tpl(
      'Booking confirmed — {business_name}',
      '<p>Dear {contact_name},</p><p>Your booking {booking_ref} at {location_name} is confirmed.</p><p>{business_logo}</p>',
      'Booking {booking_ref} confirmed at {location_name}. {business_name}',
    ),
    new_quotation: tpl(
      'Quotation {quotation_no} from {business_name}',
      '<p>Dear {contact_name},</p><p>Please find quotation {quotation_no} for {total_amount}.</p><p>{business_logo}</p>',
      'Quotation {quotation_no} totalling {total_amount} from {business_name}.',
    ),
    new_order: tpl(
      'New Order, from {business_name}',
      '<p>Dear {contact_name},</p><p>We have a new order with reference number {order_ref_number}. Kindly process the products as soon as possible.</p><p>{business_name}<br>{business_logo}</p>',
      'Dear {contact_name}, We have a new order with reference number {order_ref_number}. Kindly process the products as soon as possible. {business_name}',
    ),
    payment_paid: tpl(
      'Supplier payment from {business_name}',
      '<p>Dear {contact_name},</p><p>We have paid {paid_amount} against {order_ref_number}.</p><p>{business_logo}</p>',
      'Paid {paid_amount} for {order_ref_number}. {business_name}',
    ),
    items_received: tpl(
      'Goods received — {order_ref_number}',
      '<p>Dear {contact_name},</p><p>Items on {order_ref_number} have been received at {location_name}.</p><p>{business_logo}</p>',
      'Goods received for {order_ref_number} at {location_name}. {business_name}',
    ),
    items_pending: tpl(
      'Pending items — {order_ref_number}',
      '<p>Dear {contact_name},</p><p>Some items on {order_ref_number} are still pending delivery.</p><p>{business_logo}</p>',
      'Pending items remain on {order_ref_number}. {business_name}',
    ),
    purchase_order: tpl(
      'Purchase order {order_ref_number}',
      '<p>Dear {contact_name},</p><p>Attached is purchase order {order_ref_number} for {total_amount} from {business_name}.</p><p>{business_logo}</p>',
      'Purchase order {order_ref_number} totalling {total_amount}. {business_name}',
    ),
  };
}

export function loadNotifTemplates() {
  try {
    const raw = localStorage.getItem(NOTIF_KEY);
    if (raw) {
      const saved = JSON.parse(raw);
      if (saved && saved.new_sale) return { ...defaultNotifTemplates(), ...saved };
    }
  } catch { /* ignore */ }
  const seed = defaultNotifTemplates();
  writeLs(NOTIF_KEY, seed);
  return seed;
}

export function saveNotifTemplates(data) {
  writeLs(NOTIF_KEY, data);
}
