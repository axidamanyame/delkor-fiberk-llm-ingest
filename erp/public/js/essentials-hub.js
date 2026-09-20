import { confirmAction, ackResult } from './confirm-action.js';
/**
 * Essentials desks — To Do, Document, Memos, Reminders, Knowledge Base.
 * Hosted by Communications (color module). FILE/BRAND/tabs can be rebound.
 */
import { esc, uid } from './ls-rows.js';
import { bindTable } from './home-tables.js';
import { BUSINESS_LOCATIONS } from './scope.js';
import { supabase } from './supabaseClient.js';
import { hubTabs, bindHubTabs, goFile, emptyRow, modalHtml, bindModal, fakeEditor, bindFakeEditor, editorValue, setEditorValue, svgIco, maybePaintNest, resolveHubTab, nestsFor, onHubNavigate } from './hub-kit.js';

const FILE_DEFAULT = '/essentials.html';
const KEY = 'df_ess_hub_v1';
const FLAG = 'df_ess_hub_seed_v3';
export const ESS_TABS = [
  { key: 'todo', label: 'To Do' },
  { key: 'docs', label: 'Document' },
  { key: 'memos', label: 'Memos' },
  { key: 'remind', label: 'Reminders' },
  { key: 'msg', label: 'Messages' },
  { key: 'kb', label: 'Knowledge Base' },
  { key: 'settings', label: 'Settings' },
];
const TABS = ESS_TABS;
const BRAND_DEFAULT = `${svgIco('check')} Essentials`;
const PRI = ['Low', 'Medium', 'High', 'Urgent'];
const ST = ['New', 'In-Progress', 'On Hold', 'Completed'];
const REPEAT = [
  { v: 'one_time', l: 'One time' },
  { v: 'every_day', l: 'Every day' },
  { v: 'every_week', l: 'Every week' },
  { v: 'every_month', l: 'Every month' },
];
const SHARE = [
  { v: 'public', l: 'Public' },
  { v: 'private', l: 'Private' },
  { v: 'only_with', l: 'Only with' },
];
const FILE_OK = /\.(pdf|csv|zip|doc|docx|jpe?g|png)$/i;
const DOW = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const HOURS = [6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19];

let PEOPLE = [];
let hostFile = FILE_DEFAULT;
let hostBrand = BRAND_DEFAULT;
let hostTabs = TABS;
let hostBrandKey = '';
let hostGo = null;
let hostPaint = null;

export function bindEssHost(opts = {}) {
  hostFile = opts.file || FILE_DEFAULT;
  hostBrand = opts.brand || BRAND_DEFAULT;
  hostTabs = opts.tabs || TABS;
  hostBrandKey = opts.brandKey !== undefined ? opts.brandKey : '';
  hostGo = typeof opts.go === 'function' ? opts.go : null;
  hostPaint = typeof opts.paint === 'function' ? opts.paint : null;
}

function emptyState() {
  return {
    todos: [],
    docs: [],
    memos: [],
    reminders: [],
    messages: [],
    kb: [],
    settings: {
      leave_ref_no_prefix: '',
      leave_instructions: '',
      payroll_ref_no_prefix: '',
      is_location_required: false,
      grace_before_checkin: '',
      grace_after_checkin: '',
      grace_before_checkout: '',
      grace_after_checkout: '',
      calculate_sales_target_commission_without_tax: false,
      essentials_todos_prefix: 'TODO',
    },
  };
}
function readHub() {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) return parsed;
  } catch { /* ignore */ }
  return null;
}
function writeHub(d) {
  try { localStorage.setItem(KEY, JSON.stringify(d)); } catch { /* ignore */ }
}
function seed() {
  try { if (localStorage.getItem(FLAG) === '1' && readHub()) { purgeSeedKb(); return; } } catch { /* ignore */ }
  const prev = readHub() || {};
  writeHub({ ...emptyState(), ...prev, settings: { ...emptyState().settings, ...(prev.settings || {}) } });
  try { localStorage.setItem(FLAG, '1'); } catch { /* ignore */ }
  purgeSeedKb();
}
const SEED_KB_IDS = new Set([
  'kb1', 'kb2',
  'kb-manual-01-overview', 'kb-manual-02-till', 'kb-manual-03-comms',
  'kb-manual-04-reports', 'kb-manual-05-dashboards', 'kb-manual-06-sheets',
]);
const SEED_KB_TITLE = /how to clock in|momo vs cash|finding your way|a day on the till|communications \(talk|reports \(read the books|custom dashboards|spreadsheets \(workbooks/i;
function isSeedKb(row) {
  const id = String(row?.id || '');
  if (SEED_KB_IDS.has(id) || id.startsWith('kb-manual-')) return true;
  if (/staff manuals/i.test(String(row?.series || ''))) return true;
  if (SEED_KB_TITLE.test(String(row?.title || ''))) return true;
  if (/location is captured for hrm/i.test(String(row?.body || ''))) return true;
  return false;
}
function purgeSeedKb() {
  const d = readHub();
  if (!d || !Array.isArray(d.kb)) return;
  const next = d.kb.filter((x) => !isSeedKb(x));
  if (next.length !== d.kb.length) {
    d.kb = next;
    writeHub(d);
  }
}
export function loadEssState() { seed(); return { ...emptyState(), ...(readHub() || {}) }; }
function load() { return loadEssState(); }
function save(d) { writeHub(d); }
function tab() {
  const t = new URLSearchParams(location.search).get('tab') || 'todo';
  return resolveHubTab(t, TABS, 'todo', nestsFor(hostFile));
}
function go(t) {
  if (typeof hostGo === 'function') return hostGo(t);
  const home = hostBrandKey || 'todo';
  goFile(hostFile, (!t || t === home) ? '' : t);
  refresh();
}
function nav(on) { return hubTabs(hostBrand, hostTabs, on, hostBrandKey, hostFile); }
function refresh() {
  if (typeof hostPaint === 'function') return hostPaint();
  return paint();
}
function today() { return new Date().toISOString().slice(0, 10); }
function nowStamp() {
  const d = new Date();
  const p = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())} ${p(d.getHours())}:${p(d.getMinutes())}`;
}
function meName() {
  try {
    const p = JSON.parse(localStorage.getItem('df_my_profile') || '{}');
    return p.full_name || p.name || p.email || 'You';
  } catch { return 'You'; }
}
function plainExcerpt(html, n = 140) {
  const text = String(html || '').replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
  return text.length > n ? `${text.slice(0, n)}…` : text;
}
function nextTaskId(d) {
  const pfx = String(d.settings?.essentials_todos_prefix || 'TODO').replace(/-+$/, '') || 'TODO';
  const nums = (d.todos || []).map((t) => Number(String(t.id).replace(/\D/g, ''))).filter(Number.isFinite);
  const n = (nums.length ? Math.max(...nums) : 0) + 1;
  return `${pfx}-${String(n).padStart(4, '0')}`;
}
function optList(arr, val, { blank = '', blankLabel = 'All' } = {}) {
  const first = blank !== false ? `<option value="${esc(blank)}" ${!val ? 'selected' : ''}>${esc(blankLabel)}</option>` : '';
  return first + arr.map((x) => {
    const v = typeof x === 'string' ? x : x.v;
    const l = typeof x === 'string' ? x : x.l;
    return `<option value="${esc(v)}" ${String(val) === String(v) ? 'selected' : ''}>${esc(l)}</option>`;
  }).join('');
}
function icoField(icon, inner) {
  return `<div class="ess-ico-field"><span class="ico" aria-hidden="true">${svgIco(icon)}</span>${inner}</div>`;
}
function pageHead(title, sub) {
  return `<div class="ess-page-h"><h2>${esc(title)}</h2>${sub ? `<small>${esc(sub)}</small>` : ''}</div>`;
}
function pad2(n) { return String(n).padStart(2, '0'); }
function isoDate(dt) {
  return `${dt.getFullYear()}-${pad2(dt.getMonth() + 1)}-${pad2(dt.getDate())}`;
}
function nowLocal() {
  const d = new Date();
  return `${isoDate(d)}T${pad2(d.getHours())}:${pad2(d.getMinutes())}`;
}
function yearBounds() {
  const y = new Date().getFullYear();
  return { from: `${y}-01-01`, to: `${y}-12-31` };
}
function mdy(iso) {
  const s = String(iso || '').slice(0, 10);
  const [y, m, d] = s.split('-');
  if (!y || !m || !d) return '';
  return `${m}/${d}/${y}`;
}
function fmtRange(from, to) {
  if (!from || !to) return '';
  return `${mdy(from)} - ${mdy(to)}`;
}
function bindDrop(zone, input) {
  if (!zone || !input) return;
  const show = () => {
    const n = input.files?.length || 0;
    zone.classList.toggle('has', n > 0);
    const el = zone.querySelector('.lab');
    if (el) el.textContent = n ? [...input.files].map((f) => f.name).join(', ') : 'Drop files here to upload';
  };
  zone.addEventListener('dragover', (e) => { e.preventDefault(); zone.classList.add('drag'); });
  zone.addEventListener('dragleave', () => zone.classList.remove('drag'));
  zone.addEventListener('drop', (e) => {
    e.preventDefault();
    zone.classList.remove('drag');
    if (e.dataTransfer?.files?.length) {
      try { input.files = e.dataTransfer.files; } catch { /* ignore */ }
    }
    show();
  });
  input.addEventListener('change', show);
}
function bindFilePick(input, lab) {
  if (!input || !lab) return;
  const show = () => {
    lab.textContent = input.files?.[0]?.name || 'No file chosen';
  };
  input.addEventListener('change', show);
  show();
}
function monthCells(y, m) {
  const first = new Date(y, m, 1);
  const start = new Date(first);
  start.setDate(1 - first.getDay());
  const cells = [];
  for (let i = 0; i < 42; i++) {
    const d = new Date(start);
    d.setDate(start.getDate() + i);
    cells.push({ d, iso: isoDate(d), out: d.getMonth() !== m });
  }
  return cells;
}
function searchPickHtml(id, names, val, placeholder) {
  const label = val || placeholder || 'Please Select';
  return `<div class="ess-search-pick" data-pick="${esc(id)}">
    <button type="button" class="ess-search-btn" id="${esc(id)}-btn">${esc(label)}</button>
    <div class="ess-search-pop" hidden>
      <input class="ess-search-q" placeholder="Search" autocomplete="off" />
      <div class="ess-search-list"></div>
    </div>
    <input type="hidden" id="${esc(id)}" value="${esc(val || '')}" />
  </div>`;
}
function bindSearchPicks(app, onChange) {
  document.querySelectorAll('body > .ess-search-pop').forEach((p) => p.remove());
  const names = PEOPLE.map((p) => p.name);
  app.querySelectorAll('.ess-search-pick').forEach((wrap) => {
    const hid = wrap.querySelector('input[type="hidden"]');
    const btn = wrap.querySelector('.ess-search-btn');
    const pop = wrap.querySelector('.ess-search-pop');
    const q = wrap.querySelector('.ess-search-q');
    const list = wrap.querySelector('.ess-search-list');
    if (!hid || !btn || !pop || !q || !list) return;
    pop.dataset.pick = wrap.dataset.pick || hid.id;
    const ph = wrap.closest('.ess-filt-grid') ? 'All' : 'Please Select';
    const paintList = () => {
      const term = (q.value || '').trim().toLowerCase();
      const rows = ['', ...names].filter((n) => !term || !n || n.toLowerCase().includes(term));
      list.innerHTML = rows.map((n) => {
        const lab = n || ph;
        const on = (hid.value || '') === n ? ' on' : '';
        return `<button type="button" class="${on}" data-v="${esc(n)}">${esc(lab)}</button>`;
      }).join('');
    };
    const parkPop = () => {
      if (pop.parentNode !== wrap) wrap.appendChild(pop);
      pop.hidden = true;
    };
    btn.onclick = (e) => {
      e.preventDefault();
      e.stopPropagation();
      const willOpen = pop.hidden;
      document.querySelectorAll('.ess-search-pop').forEach((p) => {
        const home = document.querySelector(`.ess-search-pick[data-pick="${p.dataset.pick || ''}"]`);
        if (home && p.parentNode !== home) home.appendChild(p);
        p.hidden = true;
      });
      if (!willOpen) return;
      const r = wrap.getBoundingClientRect();
      document.body.appendChild(pop);
      pop.hidden = false;
      pop.style.cssText = `position:fixed;left:${Math.max(8, r.left)}px;top:${r.bottom + 2}px;width:${Math.max(r.width, 200)}px;z-index:12000`;
      q.value = '';
      paintList();
      q.focus();
    };
    q.oninput = paintList;
    list.onclick = (e) => {
      const b = e.target.closest('button[data-v]');
      if (!b) return;
      hid.value = b.dataset.v;
      btn.textContent = b.textContent;
      parkPop();
      hid.dispatchEvent(new Event('change', { bubbles: true }));
      if (typeof onChange === 'function') onChange(hid.id, hid.value);
    };
    paintList();
  });
  if (!document.documentElement.dataset.essPickOut) {
    document.documentElement.dataset.essPickOut = '1';
    document.addEventListener('click', (e) => {
      if (e.target.closest('.ess-search-pick, .ess-search-pop')) return;
      document.querySelectorAll('.ess-search-pop').forEach((p) => {
        const home = document.querySelector(`.ess-search-pick[data-pick="${p.dataset.pick || ''}"]`);
        if (home && p.parentNode !== home) home.appendChild(p);
        p.hidden = true;
      });
    });
  }
}
function setSearchPick(app, id, val, placeholder) {
  const hid = app.querySelector('#' + id);
  const btn = app.querySelector('#' + id + '-btn');
  if (hid) hid.value = val || '';
  if (btn) btn.textContent = val || placeholder || 'Please Select';
}
function ensureAdd(app, id, hostSel) {
  let el = app.querySelector('#' + id);
  if (el && el.closest('.function-bar, .erp-top-bar')) {
    const head = app.querySelector((hostSel || '') + ' .ss-head') || app.querySelector('.ss-head');
    if (head) head.appendChild(el);
  }
  if (!el) {
    const head = app.querySelector((hostSel || '') + ' .ss-head') || app.querySelector('.ss-head');
    if (head) {
      el = document.createElement('button');
      el.type = 'button';
      el.id = id;
      el.className = 'ess-add';
      el.setAttribute('data-keep-add', '1');
      el.textContent = '+ Add';
      head.appendChild(el);
    }
  }
  if (el) {
    el.hidden = false;
    el.disabled = false;
    el.style.cssText = '';
    el.removeAttribute('aria-hidden');
    el.classList.remove('is-off');
  }
  return el;
}
function bindKeepAdd(app, id, fn) {
  const key = '__essAdd_' + id;
  if (app[key]) app.removeEventListener('click', app[key], true);
  app[key] = (e) => {
    const b = e.target.closest('#' + id);
    if (!b || !app.contains(b) || b.disabled) return;
    e.preventDefault();
    e.stopPropagation();
    fn(b);
  };
  app.addEventListener('click', app[key], true);
}
function bindRange(app, onApply) {
  document.querySelectorAll('body > .ess-range-pop').forEach((p) => p.remove());
  const wrap = app.querySelector('.ess-daterange');
  if (!wrap) return;
  const input = wrap.querySelector('#f-range');
  const pop = wrap.querySelector('.ess-range-pop');
  const fromEl = wrap.querySelector('#f-from');
  const toEl = wrap.querySelector('#f-to');
  const host = wrap.querySelector('#f-cals');
  if (!input || !pop || !fromEl || !toEl || !host) return;
  const now = new Date();
  let left = new Date(now.getFullYear(), now.getMonth(), 1);
  if (fromEl.value) {
    const p = new Date(fromEl.value + 'T00:00:00');
    if (!Number.isNaN(p.getTime())) left = new Date(p.getFullYear(), p.getMonth(), 1);
  }
  let picking = '';
  const inRange = (iso, a, b) => a && b && iso > a && iso < b;
  const paintCals = () => {
    const from = fromEl.value;
    const to = toEl.value;
    const months = [new Date(left), new Date(left.getFullYear(), left.getMonth() + 1, 1)];
    host.innerHTML = months.map((dt, i) => {
      const y = dt.getFullYear();
      const m = dt.getMonth();
      const label = dt.toLocaleString('en-US', { month: 'short', year: 'numeric' });
      const cells = monthCells(y, m);
      return `<div class="ess-cal-month">
        <div class="ess-cal-mh">
          ${i === 0 ? '<button type="button" data-nav="-1" aria-label="Previous month">‹</button>' : '<span></span>'}
          <strong>${esc(label)}</strong>
          ${i === 1 ? '<button type="button" data-nav="1" aria-label="Next month">›</button>' : '<span></span>'}
        </div>
        <div class="ess-cal-dow">${['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa'].map((d0) => `<span>${d0}</span>`).join('')}</div>
        <div class="ess-cal-days">${cells.map((c) => {
          const on = c.iso === from || c.iso === to || c.iso === picking;
          const inn = inRange(c.iso, from || picking, to || (picking && from ? picking : ''));
          return `<button type="button" class="ess-cal-d${c.out ? ' out' : ''}${on ? ' on' : ''}${inn ? ' in' : ''}" data-iso="${esc(c.iso)}">${c.d.getDate()}</button>`;
        }).join('')}</div>
      </div>`;
    }).join('');
  };
  const sync = () => {
    input.value = fmtRange(fromEl.value, toEl.value);
    paintCals();
  };
  const placePop = () => {
    const r = wrap.getBoundingClientRect();
    const w = Math.min(720, window.innerWidth - 16);
    let left = r.right - w;
    if (left < 8) left = Math.max(8, r.left);
    if (left + w > window.innerWidth - 8) left = Math.max(8, window.innerWidth - w - 8);
    if (pop.parentNode !== document.body) document.body.appendChild(pop);
    pop.style.cssText = `position:fixed;left:${left}px;top:${r.bottom + 4}px;width:${w}px;z-index:12000;display:flex`;
    pop.hidden = false;
  };
  const hidePop = () => {
    pop.hidden = true;
    if (pop.parentNode !== wrap) wrap.appendChild(pop);
  };
  sync();
  const apply = (from, to) => {
    fromEl.value = from || '';
    toEl.value = to || '';
    picking = '';
    sync();
    hidePop();
    onApply();
  };
  input.addEventListener('click', (e) => {
    e.preventDefault();
    e.stopPropagation();
    if (pop.hidden) { picking = ''; placePop(); sync(); }
    else hidePop();
  });
  wrap.querySelector('.ess-ico-field .ico')?.addEventListener('click', (e) => {
    e.preventDefault();
    e.stopPropagation();
    if (pop.hidden) { picking = ''; placePop(); sync(); }
    else hidePop();
  });
  pop.addEventListener('click', (e) => e.stopPropagation());
  host.addEventListener('click', (e) => {
    const nav = e.target.closest('[data-nav]');
    if (nav) {
      e.preventDefault();
      left = new Date(left.getFullYear(), left.getMonth() + Number(nav.dataset.nav), 1);
      paintCals();
      return;
    }
    const day = e.target.closest('[data-iso]');
    if (!day) return;
    e.preventDefault();
    const iso = day.dataset.iso;
    if (!picking) {
      picking = iso;
      paintCals();
      return;
    }
    const a = picking < iso ? picking : iso;
    const b = picking < iso ? iso : picking;
    apply(a, b);
  });
  if (!document.documentElement.dataset.essRangeOut) {
    document.documentElement.dataset.essRangeOut = '1';
    document.addEventListener('click', (e) => {
      document.querySelectorAll('.ess-range-pop').forEach((p) => {
        if (p.hidden) return;
        if (!p.closest('.ess-daterange')?.contains(e.target) && !p.contains(e.target)) {
          p.hidden = true;
          const home = document.querySelector('.ess-daterange');
          if (home && p.parentNode !== home) home.appendChild(p);
        }
      });
    });
  }
  pop.querySelectorAll('[data-r]').forEach((b) => {
    b.onclick = (e) => {
      e.preventDefault();
      const k = b.dataset.r;
      const n = new Date();
      if (k === 'year') { const y = yearBounds(); apply(y.from, y.to); return; }
      if (k === 'month') {
        apply(isoDate(new Date(n.getFullYear(), n.getMonth(), 1)), isoDate(new Date(n.getFullYear(), n.getMonth() + 1, 0)));
        return;
      }
      if (k === 'today') { const t = isoDate(n); apply(t, t); return; }
      if (k === 'last7') {
        const a = new Date(n);
        a.setDate(a.getDate() - 6);
        apply(isoDate(a), isoDate(n));
      }
    };
  });
}
function actCell(id, extra = '') {
  return `<td class="act"><details class="act"><summary>Actions ▾</summary><menu>
    <button type="button" data-view="${esc(id)}">View</button>
    <button type="button" data-edit="${esc(id)}">Edit</button>
    ${extra}
    <button type="button" data-del="${esc(id)}">Delete</button>
  </menu></details></td>`;
}
function wireClick(el, fn) {
  if (!el) return;
  el.hidden = false;
  el.removeAttribute('aria-hidden');
  if (el.style) el.style.display = '';
  el.onclick = fn;
}
function bindDesk(app, tbl, opts) {
  bindHubTabs(app, go);
  const root = app.querySelector(`[data-tbl="${tbl}"]`);
  if (root) bindTable(root, { title: opts.title, storageKey: opts.storageKey, crud: true, skipFilters: true, noAutoFilters: true });
}
async function deleteRow(listKey, id) {
  if (!(await confirmAction('Are you sure?', 'This cannot be undone.'))) return;
  const d = load();
  d[listKey] = (d[listKey] || []).filter((x) => String(x.id) !== String(id));
  save(d);
  ackResult(true, 'Deleted.');
  refresh();
}
function viewCard(title, html) {
  const host = document.createElement('div');
  host.className = 'pay-modal-bg';
  host.innerHTML = `<div class="pay-modal wide kb-manual-card" role="dialog">
    <div class="pay-modal-h"><h2>${esc(title)}</h2><button type="button" class="pay-modal-x" data-x>×</button></div>
    <div class="pay-modal-b">${html}</div>
    <div class="pay-modal-f"><button type="button" class="btn-close" data-x>Close</button></div>
  </div>`;
  host.addEventListener('click', (e) => { if (e.target === host || e.target.closest('[data-x]')) host.remove(); });
  document.body.appendChild(host);
}

export async function loadEssPeople() {
  if (PEOPLE.length) return PEOPLE;
  try {
    const { data } = await supabase.from('profiles').select('id,full_name,name,email').limit(300);
    PEOPLE = (data || []).map((p) => ({
      id: p.id,
      name: p.full_name || p.name || p.email || 'Staff',
    })).filter((p) => p.name);
  } catch { PEOPLE = []; }
  if (!PEOPLE.length) PEOPLE = [{ id: 'you', name: meName() }];
  return PEOPLE;
}
async function loadPeople() { return loadEssPeople(); }

function filtersHtml(f, { open = false } = {}) {
  const shown = fmtRange(f.from, f.to);
  return `<details class="filter-section ess-filters"${open ? ' open' : ''}>
    <summary class="filter-header">${svgIco('filter')} Filters</summary>
    <div class="ess-filt-grid">
      <label>Assigned To:
        ${icoField('user', searchPickHtml('f-as', PEOPLE.map((p) => p.name), f.as, 'All'))}
      </label>
      <label>Priority:
        <select id="f-pr">${optList(PRI, f.pri)}</select>
      </label>
      <label>Status:
        <select id="f-st">${optList(ST, f.st)}</select>
      </label>
      <label>Date Range:
        <div class="ess-daterange">
          ${icoField('cal', `<input id="f-range" readonly placeholder="Select a date range" value="${esc(shown)}" />`)}
          <input type="hidden" id="f-from" value="${esc(f.from || '')}" />
          <input type="hidden" id="f-to" value="${esc(f.to || '')}" />
          <div class="ess-range-pop ess-range-cal" hidden>
            <div class="ess-range-side">
              <button type="button" data-r="today">Today</button>
              <button type="button" data-r="last7">Last 7 Days</button>
              <button type="button" data-r="month">This Month</button>
              <button type="button" data-r="year">This Year</button>
            </div>
            <div class="ess-range-months" id="f-cals"></div>
          </div>
        </div>
      </label>
    </div>
  </details>`;
}

export function paintTodo(app) {
  const d = load();
  const yb = yearBounds();
  const hadFilters = !!app.querySelector('#f-from');
  const filtersOpen = !!app.querySelector('.ess-filters')?.open;
  const f = {
    as: app.querySelector('#f-as')?.value || '',
    pri: app.querySelector('#f-pr')?.value || '',
    st: app.querySelector('#f-st')?.value || '',
    from: hadFilters ? (app.querySelector('#f-from')?.value || '') : yb.from,
    to: hadFilters ? (app.querySelector('#f-to')?.value || '') : yb.to,
  };
  let rows = d.todos || [];
  if (f.as) rows = rows.filter((t) => t.assigned === f.as);
  if (f.pri) rows = rows.filter((t) => t.priority === f.pri);
  if (f.st) rows = rows.filter((t) => t.status === f.st);
  if (f.from && f.to) {
    rows = rows.filter((t) => {
      const day = String(t.start || t.added || t.end || '').slice(0, 10);
      return (!f.from || day >= f.from) && (!f.to || day <= f.to);
    });
  }
  app.classList.add('ess-hub');
  app.innerHTML = `
    ${nav('todo')}
    ${filtersHtml(f, { open: filtersOpen })}
    <div class="ess-card ult-card" data-tbl="todo" data-act-end="1">
      <div class="ss-head"><strong>${svgIco('doc')} To Do List</strong>
        <button type="button" class="ess-add" id="td-add" data-keep-add="1">+ Add</button></div>
      <div class="ult-table-wrap table-wrapper"><table class="ult-table ess-table" data-act-end="1">
        <thead><tr>
          <th>Added On</th><th>Task Id</th><th>Task</th><th>Status</th>
          <th>Start Date</th><th>End Date</th><th>Estimated Hours</th>
          <th>Assigned By</th><th>Assigned To</th><th data-nosort="1">Action</th>
        </tr></thead>
        <tbody>${rows.map((t) => `<tr data-id="${esc(t.id)}">
          <td>${esc(t.added || '')}</td><td>${esc(t.id)}</td><td>${esc(t.task)}</td><td>${esc(t.status)}</td>
          <td>${esc(t.start || '')}</td><td>${esc(t.end || '')}</td><td>${t.hours || 0}</td>
          <td>${esc(t.by || '')}</td><td>${esc(t.assigned || '')}</td>
          ${actCell(t.id, `<button type="button" data-status="${esc(t.id)}">Change Status</button>`)}
        </tr>`).join('') || emptyRow(10, 'No data available in table')}</tbody>
      </table></div>
    </div>
    ${modalHtml('td-modal', 'Add To Do', `
      <div class="ult-field"><label>Task:*</label><input id="td-task" /></div>
      <div class="ess-form-3">
        <div class="ult-field"><label>Assigned To:*</label>
          ${icoField('user', searchPickHtml('td-to', PEOPLE.map((p) => p.name), '', 'Please Select'))}
        </div>
        <div class="ult-field"><label>Priority:</label>
          <select id="td-pr">${optList(PRI, '', { blank: '', blankLabel: 'Please Select' })}</select></div>
        <div class="ult-field"><label>Status:</label>
          <select id="td-st">${optList(ST, '', { blank: '', blankLabel: 'Please Select' })}</select></div>
      </div>
      <div class="ess-form-3">
        <div class="ult-field"><label>Start Date:*</label>
          ${icoField('cal', '<input id="td-start" type="datetime-local" />')}</div>
        <div class="ult-field"><label>End Date:</label>
          ${icoField('cal', '<input id="td-end" type="datetime-local" />')}</div>
        <div class="ult-field"><label>Estimated Hours:</label>
          ${icoField('clock', '<input id="td-hrs" type="number" min="0" step="0.5" />')}</div>
      </div>
      <div class="ult-field"><label>Description:</label></div>
      ${fakeEditor('td-desc')}
      <div class="ult-field"><label>Upload Documents:</label>
        <div class="ess-drop" id="td-drop"><span class="lab">Drop files here to upload</span>
          <input id="td-file" type="file" multiple accept=".pdf,.csv,.zip,.doc,.docx,.jpeg,.jpg,.png" /></div>
      </div>
    `, { wide: true })}
    ${modalHtml('st-modal', 'Change Status', `
      <div class="ult-field"><label>Status:</label><select id="st-val">${optList(ST, '', { blank: '', blankLabel: 'Please Select' })}</select></div>
    `)}`;
  bindDesk(app, 'todo', { title: 'To Do', storageKey: 'ess-todo' });
  bindFakeEditor(app);
  bindSearchPicks(app, (id) => { if (id === 'f-as') paintTodo(app); });
  ['f-pr', 'f-st'].forEach((id) => {
    const el = app.querySelector('#' + id);
    if (el) el.onchange = () => paintTodo(app);
  });
  bindRange(app, () => paintTodo(app));
  const modal = bindModal(app, 'td-modal');
  const stModal = bindModal(app, 'st-modal');
  bindDrop(app.querySelector('#td-drop'), app.querySelector('#td-file'));
  const fill = (row) => {
    if (!modal) return;
    const task = app.querySelector('#td-task');
    if (!task) return;
    task.value = row?.task || '';
    setSearchPick(app, 'td-to', row?.assigned || '', 'Please Select');
    app.querySelector('#td-pr').value = row?.priority || '';
    app.querySelector('#td-st').value = row?.status || '';
    app.querySelector('#td-start').value = row?.start || nowLocal();
    app.querySelector('#td-end').value = row?.end || '';
    app.querySelector('#td-hrs').value = row?.hours || '';
    setEditorValue(app, 'td-desc', row?.desc || '');
    const file = app.querySelector('#td-file');
    if (file) file.value = '';
    const lab = app.querySelector('#td-drop .lab');
    if (lab) lab.textContent = (row?.files || []).map((x) => x.name).join(', ') || 'Drop files here to upload';
    app.querySelector('#td-drop')?.classList.toggle('has', !!(row?.files || []).length);
    const h = modal.querySelector('h2');
    if (h) h.textContent = row ? 'Edit To Do' : 'Add To Do';
    modal.dataset.edit = row?.id || '';
    modal.hidden = false;
  };
  const addBtn = ensureAdd(app, 'td-add', '[data-tbl="todo"]');
  wireClick(addBtn, () => fill(null));
  bindKeepAdd(app, 'td-add', () => fill(null));
  app.querySelectorAll('[data-edit]').forEach((b) => {
    b.onclick = () => fill((d.todos || []).find((t) => String(t.id) === b.dataset.edit));
  });
  app.querySelectorAll('[data-view]').forEach((b) => {
    b.onclick = () => {
      const t = (d.todos || []).find((x) => String(x.id) === b.dataset.view);
      if (!t) return;
      const files = (t.files || []).map((x) => `<li>${esc(x.name)}</li>`).join('');
      viewCard('To Do ' + t.id, `<table class="ult-table"><tbody>
        <tr><th>Task</th><td>${esc(t.task)}</td></tr>
        <tr><th>Status</th><td>${esc(t.status)}</td></tr>
        <tr><th>Priority</th><td>${esc(t.priority)}</td></tr>
        <tr><th>Assigned To</th><td>${esc(t.assigned)}</td></tr>
        <tr><th>Assigned By</th><td>${esc(t.by)}</td></tr>
        <tr><th>Start</th><td>${esc(t.start || '')}</td></tr>
        <tr><th>End</th><td>${esc(t.end || '')}</td></tr>
        <tr><th>Hours</th><td>${esc(t.hours || 0)}</td></tr>
        <tr><th>Description</th><td>${esc(t.desc || '')}</td></tr>
        ${files ? `<tr><th>Documents</th><td><ul>${files}</ul></td></tr>` : ''}
      </tbody></table>`);
    };
  });
  app.querySelectorAll('[data-status]').forEach((b) => {
    b.onclick = () => {
      const t = (d.todos || []).find((x) => String(x.id) === b.dataset.status);
      stModal.dataset.id = t?.id || '';
      app.querySelector('#st-val').value = t?.status || '';
      stModal.hidden = false;
    };
  });
  const stSave = stModal?.querySelector('[data-save]');
  if (stSave) {
    stSave.textContent = 'Update';
    stSave.onclick = () => {
      const id = stModal.dataset.id;
      const status = app.querySelector('#st-val').value;
      if (!status) return alert('Please Select');
      const i = d.todos.findIndex((t) => String(t.id) === String(id));
      if (i >= 0) d.todos[i].status = status;
      save(d); stModal.hidden = true; refresh();
    };
  }
  const saveBtn = modal?.querySelector('[data-save]');
  if (saveBtn) saveBtn.onclick = async () => {
    const task = app.querySelector('#td-task').value.trim();
    const to = app.querySelector('#td-to').value.trim();
    const start = app.querySelector('#td-start').value;
    if (!task || !to) return alert('Task and Assigned To are required');
    if (!start) return alert('Start Date is required');
    const rec = {
      id: modal.dataset.edit || nextTaskId(d),
      task, assigned: to, by: meName(),
      priority: app.querySelector('#td-pr').value,
      status: app.querySelector('#td-st').value || 'New',
      start,
      end: app.querySelector('#td-end').value,
      hours: Number(app.querySelector('#td-hrs').value || 0),
      desc: editorValue(app, 'td-desc'),
      added: today(),
    };
    const picked = [...(app.querySelector('#td-file')?.files || [])];
    if (picked.length) {
      const metas = [];
      for (const file of picked) {
        if (!FILE_OK.test(file.name)) continue;
        const meta = await readFileMeta(file);
        if (meta?.tooBig) { alert(file.name + ' is over 2MB'); continue; }
        metas.push({ name: meta.name, mime: meta.mime, dataUrl: meta.dataUrl || '' });
      }
      rec.files = metas;
    }
    const i = d.todos.findIndex((t) => String(t.id) === String(rec.id));
    if (i >= 0) d.todos[i] = { ...d.todos[i], ...rec, files: rec.files || d.todos[i].files };
    else d.todos.unshift(rec);
    save(d); modal.hidden = true; refresh();
  };
  app.querySelectorAll('[data-del]').forEach((b) => { b.onclick = () => deleteRow('todos', b.dataset.del); });
}

function readFileMeta(file) {
  return new Promise((resolve) => {
    if (!file) return resolve(null);
    if (file.size > 2 * 1024 * 1024) return resolve({ name: file.name, mime: file.type, tooBig: true });
    const fr = new FileReader();
    fr.onload = () => resolve({ name: file.name, mime: file.type, dataUrl: fr.result });
    fr.onerror = () => resolve({ name: file.name, mime: file.type });
    fr.readAsDataURL(file);
  });
}

export function paintDocs(app, kind) {
  const d = load();
  const isMemo = kind === 'memos';
  const list = isMemo ? 'memos' : 'docs';
  const rows = d[list] || [];
  const title = isMemo ? 'All memos' : 'All documents';
  const sub = isMemo ? 'Manage all your memos' : 'Manage all your documents';
  const nameLab = isMemo ? 'Heading' : 'Name';
  const dateLab = isMemo ? 'Created Date' : 'Uploaded Date';
  const formOpen = app.querySelector('#up-form')?.classList.contains('open');
  app.classList.add('ess-hub');
  app.innerHTML = `
    ${nav(isMemo ? 'memos' : 'docs')}
    ${pageHead(title, sub)}
    <div class="ess-card ult-card" data-tbl="${esc(kind)}" data-act-end="1">
      <div class="ss-head"><strong>${esc(title)}</strong>
        <button type="button" class="ess-add" id="ess-add" data-keep-add="1">+ Add</button></div>
      <form class="ess-inline-form${formOpen ? ' open' : ''}" id="up-form">
        <div class="ess-form-half">
          <div class="ult-field"><label>${esc(isMemo ? 'Heading:*' : 'Document:*')}</label>
            ${isMemo
              ? '<input id="up-name" required />'
              : `<input id="up-file" type="file" accept=".pdf,.csv,.zip,.doc,.docx,.jpeg,.jpg,.png" />
                 <p class="help-block">Allowed File:<br>.pdf, .csv, .zip, .doc, .docx, .jpeg, .jpg, .png</p>`}
          </div>
          <div class="ult-field"><label>Description:</label>
            <textarea id="up-desc" rows="4"></textarea></div>
          <div class="ess-form-actions">
            <button type="submit" class="ess-add">Submit</button>
            <button type="button" class="ess-cancel" id="up-cancel">Cancel</button>
          </div>
        </div>
        <hr class="ess-hr" />
      </form>
      <div class="ult-table-wrap table-wrapper"><table class="ult-table ess-table" data-act-end="1">
        <thead><tr><th>${esc(nameLab)}</th><th>Description</th><th>${esc(dateLab)}</th><th data-nosort="1">Action</th></tr></thead>
        <tbody>${rows.map((r) => `<tr data-id="${esc(r.id)}">
          <td>${esc(r.name || r.fileName || '')}</td>
          <td>${esc(r.description || '')}</td>
          <td>${esc(r.at || '')}</td>
          ${actCell(r.id, `<button type="button" data-share="${esc(r.id)}">Share</button>`)}
        </tr>`).join('') || emptyRow(4, 'No data available in table')}</tbody>
      </table></div>
    </div>
    ${modalHtml('share-modal', 'Share', `
      <div class="ult-field"><label>Share with:</label>
        <select id="sh-with">${optList(SHARE, 'public', { blank: false })}</select></div>
      <div class="ult-field" id="sh-people" hidden><label>Share only with:</label>
        <select id="sh-users" multiple>${PEOPLE.map((p) => `<option value="${esc(p.name)}">${esc(p.name)}</option>`).join('')}</select></div>
    `)}`;
  bindDesk(app, kind, { title, storageKey: 'ess-' + kind });
  const form = app.querySelector('#up-form');
  const addBtn = ensureAdd(app, 'ess-add', `[data-tbl="${kind}"]`);
  const setForm = (on) => {
    form.classList.toggle('open', on);
    if (addBtn) {
      addBtn.classList.toggle('is-off', on);
      addBtn.disabled = on;
    }
  };
  const openForm = () => {
    form.reset();
    delete form.dataset.edit;
    setForm(true);
    (app.querySelector('#up-name') || app.querySelector('#up-file'))?.focus();
  };
  wireClick(addBtn, openForm);
  bindKeepAdd(app, 'ess-add', () => { if (!addBtn?.disabled) openForm(); });
  wireClick(app.querySelector('#up-cancel'), () => {
    form.reset();
    delete form.dataset.edit;
    setForm(false);
  });
  form.onsubmit = async (e) => {
    e.preventDefault();
    const rec = { description: app.querySelector('#up-desc').value.trim(), at: nowStamp(), share_with: 'private' };
    if (isMemo) {
      rec.name = app.querySelector('#up-name').value.trim();
      if (!rec.name) return alert('Heading is required');
    } else {
      const file = app.querySelector('#up-file').files[0];
      const editId = form.dataset.edit;
      if (!file && !editId) return alert('Document is required');
      if (file) {
        if (!FILE_OK.test(file.name)) return alert('Allowed File: .pdf, .csv, .zip, .doc, .docx, .jpeg, .jpg, .png');
        const meta = await readFileMeta(file);
        if (meta?.tooBig) return alert('File is over 2MB');
        rec.name = file.name;
        rec.fileName = file.name;
        rec.mime = file.type;
        rec.dataUrl = meta?.dataUrl || '';
      }
    }
    const editId = form.dataset.edit;
    if (editId) {
      const i = d[list].findIndex((x) => String(x.id) === String(editId));
      if (i >= 0) d[list][i] = { ...d[list][i], ...rec, id: editId };
    } else {
      rec.id = uid();
      if (!isMemo && !rec.name) return alert('Document is required');
      d[list].unshift(rec);
    }
    save(d);
    form.classList.remove('open');
    refresh();
  };
  const shareM = bindModal(app, 'share-modal');
  app.querySelector('#sh-with').onchange = () => {
    app.querySelector('#sh-people').hidden = app.querySelector('#sh-with').value !== 'only_with';
  };
  app.querySelectorAll('[data-share]').forEach((b) => {
    b.onclick = () => {
      shareM.dataset.id = b.dataset.share;
      shareM.hidden = false;
    };
  });
  shareM.querySelector('[data-save]').onclick = () => {
    const rec = d[list].find((x) => String(x.id) === shareM.dataset.id);
    if (rec) {
      rec.share_with = app.querySelector('#sh-with').value;
      rec.share_users = [...app.querySelector('#sh-users').selectedOptions].map((o) => o.value);
    }
    save(d); shareM.hidden = true; ackResult(true, 'Shared.');
  };
  app.querySelectorAll('[data-view]').forEach((b) => {
    b.onclick = () => {
      const r = rows.find((x) => String(x.id) === b.dataset.view);
      if (!r) return;
      let body = `<p>${esc(r.description || '')}</p>`;
      if (r.dataUrl && /^image\//.test(r.mime || '')) body += `<img src="${esc(r.dataUrl)}" alt="" style="max-width:100%" />`;
      else if (r.dataUrl) body += `<a href="${esc(r.dataUrl)}" download="${esc(r.fileName || r.name)}">Download ${esc(r.fileName || r.name)}</a>`;
      viewCard(r.name || 'View', body);
    };
  });
  app.querySelectorAll('[data-edit]').forEach((b) => {
    b.onclick = () => {
      const r = rows.find((x) => String(x.id) === b.dataset.edit);
      setForm(true);
      if (isMemo) app.querySelector('#up-name').value = r?.name || '';
      app.querySelector('#up-desc').value = r?.description || '';
      form.dataset.edit = r?.id || '';
    };
  });
  app.querySelectorAll('[data-del]').forEach((b) => { b.onclick = () => deleteRow(list, b.dataset.del); });
}

function ymd(dt) {
  const p = (n) => String(n).padStart(2, '0');
  return `${dt.getFullYear()}-${p(dt.getMonth() + 1)}-${p(dt.getDate())}`;
}
function hourLabel(h) {
  if (h === 0) return '12am';
  if (h < 12) return h + 'am';
  if (h === 12) return '12pm';
  return (h - 12) + 'pm';
}
function reminderHitsDate(r, key) {
  if (!r?.date) return false;
  if (r.date === key) return true;
  const rep = r.repeat || 'one_time';
  if (rep === 'one_time') return false;
  if (key < r.date) return false;
  const a = new Date(r.date + 'T00:00:00');
  const b = new Date(key + 'T00:00:00');
  if (Number.isNaN(a.getTime()) || Number.isNaN(b.getTime())) return false;
  const diff = Math.round((b - a) / 86400000);
  if (rep === 'every_day') return diff >= 0;
  if (rep === 'every_week') return diff >= 0 && diff % 7 === 0;
  if (rep === 'every_month') return a.getDate() === b.getDate();
  return false;
}
function remindersOn(rows, key) {
  return (rows || []).filter((r) => reminderHitsDate(r, key));
}
function eventHour(r) {
  const t = String(r.time || '09:00');
  const h = Number(t.slice(0, 2));
  return Number.isFinite(h) ? h : 9;
}

export function paintRemind(app) {
  const d = load();
  const rows = d.reminders || [];
  const param = new URLSearchParams(location.search);
  const now = new Date();
  const view = ['month', 'week', 'day'].includes(param.get('view')) ? param.get('view') : 'month';
  const y = Number(param.get('y')) || now.getFullYear();
  const m = Number(param.get('mo')) || (now.getMonth() + 1);
  const dayN = Number(param.get('d')) || now.getDate();
  const anchor = new Date(y, m - 1, view === 'month' ? 1 : dayN);
  const todayKey = today();

  const setCal = (dt, nextView = view) => {
    const u = `${hostFile}?tab=remind&view=${encodeURIComponent(nextView)}&y=${dt.getFullYear()}&mo=${dt.getMonth() + 1}&d=${dt.getDate()}`;
    try { history.pushState({ spa: u }, '', u); } catch { /* ignore */ }
    refresh();
  };

  let title = '';
  let body = '';
  if (view === 'week') {
    const start = new Date(anchor);
    start.setDate(anchor.getDate() - start.getDay());
    const end = new Date(start);
    end.setDate(start.getDate() + 6);
    const fmt = (dt) => dt.toLocaleString('en-US', { month: 'short', day: 'numeric' });
    title = start.getMonth() === end.getMonth()
      ? `${fmt(start)} – ${end.getDate()}, ${end.getFullYear()}`
      : `${fmt(start)} – ${fmt(end)}, ${end.getFullYear()}`;
    const days = Array.from({ length: 7 }, (_, i) => {
      const dt = new Date(start);
      dt.setDate(start.getDate() + i);
      return { dt, key: ymd(dt) };
    });
    body = `<div class="ess-cal-week">
      <div class="ess-cal-week-head">
        <div class="gutter"></div>
        ${days.map((c) => `<div class="${c.key === todayKey ? 'is-today' : ''}">${DOW[c.dt.getDay()]} ${c.dt.getMonth() + 1}/${c.dt.getDate()}</div>`).join('')}
      </div>
      <div class="ess-cal-week-row all-day">
        <div class="gutter">all-day</div>
        ${days.map((c) => `<div class="ess-cal-slot${c.key === todayKey ? ' is-today' : ''}" data-day="${esc(c.key)}" data-all="1">
          ${remindersOn(rows, c.key).filter((e) => !e.time).map((e) => `<div class="ess-cal-ev" data-ev="${esc(e.id)}">${esc(e.name)}</div>`).join('')}
        </div>`).join('')}
      </div>
      ${HOURS.map((h) => `<div class="ess-cal-week-row">
        <div class="gutter">${hourLabel(h)}</div>
        ${days.map((c) => `<div class="ess-cal-slot${c.key === todayKey ? ' is-today' : ''}" data-day="${esc(c.key)}" data-hour="${h}">
          ${remindersOn(rows, c.key).filter((e) => eventHour(e) === h).map((e) => `<div class="ess-cal-ev" data-ev="${esc(e.id)}">${esc(e.name)}</div>`).join('')}
        </div>`).join('')}
      </div>`).join('')}
    </div>`;
  } else if (view === 'day') {
    title = anchor.toLocaleString('en-US', { month: 'long', day: 'numeric', year: 'numeric' });
    const key = ymd(anchor);
    const todayCls = key === todayKey ? ' is-today' : '';
    body = `<div class="ess-cal-dayview">
      <div class="ess-cal-week-head"><div class="gutter"></div><div class="${todayCls}">${DOW[anchor.getDay()]}</div></div>
      <div class="ess-cal-week-row all-day">
        <div class="gutter">all-day</div>
        <div class="ess-cal-slot${todayCls}" data-day="${esc(key)}" data-all="1">
          ${remindersOn(rows, key).filter((e) => !e.time).map((e) => `<div class="ess-cal-ev" data-ev="${esc(e.id)}">${esc(e.name)}</div>`).join('')}
        </div>
      </div>
      ${HOURS.map((h) => `<div class="ess-cal-week-row">
        <div class="gutter">${hourLabel(h)}</div>
        <div class="ess-cal-slot${todayCls}" data-day="${esc(key)}" data-hour="${h}">
          ${remindersOn(rows, key).filter((e) => eventHour(e) === h).map((e) => `<div class="ess-cal-ev" data-ev="${esc(e.id)}">${esc(e.name)}</div>`).join('')}
        </div>
      </div>`).join('')}
    </div>`;
  } else {
    title = anchor.toLocaleString('en-US', { month: 'long', year: 'numeric' });
    const start = new Date(anchor.getFullYear(), anchor.getMonth(), 1);
    start.setDate(1 - start.getDay());
    const cells = [];
    for (let i = 0; i < 42; i++) {
      const day = new Date(start);
      day.setDate(start.getDate() + i);
      const key = ymd(day);
      cells.push({ day, key, out: day.getMonth() !== anchor.getMonth(), evs: remindersOn(rows, key) });
    }
    body = `<div class="ess-cal-grid">
      ${DOW.map((d0) => `<div class="dow">${d0}</div>`).join('')}
      ${cells.map((c) => `<div class="ess-cal-day${c.out ? ' out' : ''}${c.key === todayKey ? ' is-today' : ''}" data-day="${esc(c.key)}">
        <div class="n">${c.day.getDate()}</div>
        ${c.evs.map((e) => `<div class="ess-cal-ev" data-ev="${esc(e.id)}">${esc(e.name)}</div>`).join('')}
      </div>`).join('')}
    </div>`;
  }

  app.classList.add('ess-hub');
  app.innerHTML = `
    ${nav('remind')}
    <div class="ess-card">
      <div class="ss-head"><strong>Reminders</strong>
        <button type="button" class="ess-add" id="rm-add" data-keep-add="1">+ Add reminder</button></div>
      <div class="ess-cal-toolbar">
        <button type="button" data-nav="-1">‹</button>
        <button type="button" data-nav="0">today</button>
        <button type="button" data-nav="1">›</button>
        <h2>${esc(title)}</h2>
        <div class="ess-cal-views">
          <button type="button" class="${view === 'month' ? 'on' : ''}" data-view="month">month</button>
          <button type="button" class="${view === 'week' ? 'on' : ''}" data-view="week">week</button>
          <button type="button" class="${view === 'day' ? 'on' : ''}" data-view="day">day</button>
        </div>
      </div>
      ${body}
    </div>
    ${modalHtml('rm-modal', 'Add reminder', `
      <div class="ult-field"><label>Event Name:*</label><input id="rm-name" required /></div>
      <div class="pr-grid">
        <div class="ult-field"><label>Repeat:*</label><select id="rm-rep">${optList(REPEAT, 'one_time', { blank: false })}</select></div>
        <div class="ult-field"><label>Date:*</label>
          ${icoField('cal', '<input id="rm-date" type="date" required />')}</div>
        <div class="ult-field"><label>Start time:*</label>
          ${icoField('clock', '<input id="rm-time" type="time" required />')}</div>
        <div class="ult-field"><label>End time:</label>
          ${icoField('clock', '<input id="rm-end" type="time" />')}</div>
      </div>
    `)}`;
  bindHubTabs(app, go);
  const modal = bindModal(app, 'rm-modal');
  const saveBtn = modal.querySelector('[data-save]');
  const closeBtn = modal.querySelector('.pay-modal-f [data-close]');
  if (saveBtn) saveBtn.textContent = 'Submit';
  if (closeBtn) closeBtn.textContent = 'Cancel';
  if (saveBtn && closeBtn && closeBtn.nextElementSibling !== saveBtn) {
    const foot = modal.querySelector('.pay-modal-f');
    if (foot) foot.insertBefore(closeBtn, saveBtn);
  }
  const openAdd = (date, time) => {
    app.querySelector('#rm-name').value = '';
    app.querySelector('#rm-rep').value = 'one_time';
    app.querySelector('#rm-date').value = date || today();
    app.querySelector('#rm-time').value = time || '09:00';
    app.querySelector('#rm-end').value = time || '';
    modal.dataset.edit = '';
    modal.hidden = false;
  };
  const rmAdd = ensureAdd(app, 'rm-add');
  wireClick(rmAdd, () => openAdd(ymd(anchor)));
  bindKeepAdd(app, 'rm-add', () => openAdd(ymd(anchor)));
  app.querySelectorAll('[data-nav]').forEach((b) => {
    b.onclick = () => {
      const n = Number(b.dataset.nav);
      let dt;
      if (n === 0) dt = new Date();
      else if (view === 'week') dt = new Date(anchor.getFullYear(), anchor.getMonth(), anchor.getDate() + (n * 7));
      else if (view === 'day') dt = new Date(anchor.getFullYear(), anchor.getMonth(), anchor.getDate() + n);
      else dt = new Date(anchor.getFullYear(), anchor.getMonth() + n, 1);
      setCal(dt);
    };
  });
  app.querySelectorAll('[data-view]').forEach((b) => {
    b.onclick = () => setCal(anchor, b.dataset.view);
  });
  let clicks = 0;
  app.querySelectorAll('.ess-cal-day, .ess-cal-slot').forEach((el) => {
    el.onclick = () => {
      clicks += 1;
      setTimeout(() => { clicks = 0; }, 400);
      if (clicks === 2) {
        const hour = el.dataset.hour;
        const time = hour != null ? `${String(hour).padStart(2, '0')}:00` : '09:00';
        openAdd(el.dataset.day, time);
      }
    };
  });
  app.querySelectorAll('[data-ev]').forEach((el) => {
    el.onclick = (e) => {
      e.stopPropagation();
      const r = rows.find((x) => String(x.id) === el.dataset.ev);
      if (!r) return;
      viewCard(r.name, `<p>Repeat: ${esc(r.repeat)}</p><p>Date: ${esc(r.date)}</p><p>${esc(r.time || '')} – ${esc(r.end_time || '')}</p>
        <button type="button" class="ess-add" data-kill="${esc(r.id)}">Delete</button>`);
      document.querySelector(`[data-kill="${r.id}"]`)?.addEventListener('click', () => deleteRow('reminders', r.id));
    };
  });
  modal.querySelector('[data-save]').onclick = () => {
    const name = app.querySelector('#rm-name').value.trim();
    const date = app.querySelector('#rm-date').value;
    const time = app.querySelector('#rm-time').value;
    if (!name || !date || !time) return alert('Event Name, Date and Start time are required');
    d.reminders.unshift({
      id: uid(), name, date, time,
      end_time: app.querySelector('#rm-end').value,
      repeat: app.querySelector('#rm-rep').value,
    });
    save(d); modal.hidden = true; refresh();
  };
}

function paintMsg(app) {
  const d = load();
  const rows = d.messages || [];
  const locs = BUSINESS_LOCATIONS.filter((l) => !l.alias);
  app.classList.add('ess-hub');
  app.innerHTML = `
    ${nav('msg')}
    <div class="ess-chat">
      <div class="ess-chat-h">Messages</div>
      <div class="ess-chat-box" id="chat-box">
        ${rows.map((m) => `<div class="ess-msg ${m.from === meName() ? 'me' : ''}" data-id="${esc(m.id)}">
          <div class="who">${esc(m.from)}${m.location ? ' · ' + esc(m.location) : ''}</div>
          <div>${esc(m.text)}</div>
          <div class="when">${esc(m.at)} <button type="button" class="linkish" data-del="${esc(m.id)}">delete</button></div>
        </div>`).join('') || '<p class="ess-empty">No messages yet.</p>'}
      </div>
      <form class="ess-chat-foot" id="chat-form">
        <textarea id="chat-msg" required placeholder="Type message..." rows="1"></textarea>
        <select id="chat-loc"><option value="">Select location</option>${locs.map((l) => `<option value="${esc(l.name)}">${esc(l.name)}</option>`).join('')}</select>
        <button type="submit" class="ess-add">Send</button>
      </form>
    </div>`;
  bindHubTabs(app, go);
  const box = app.querySelector('#chat-box');
  box.scrollTop = box.scrollHeight;
  app.querySelector('#chat-form').onsubmit = (e) => {
    e.preventDefault();
    const text = app.querySelector('#chat-msg').value.trim();
    if (!text) return;
    d.messages.push({ id: uid(), from: meName(), text, location: app.querySelector('#chat-loc').value, at: nowStamp() });
    save(d); refresh();
  };
  app.querySelectorAll('[data-del]').forEach((b) => { b.onclick = () => deleteRow('messages', b.dataset.del); });
}

export function paintKb(app) {
  const d = load();
  const rows = (d.kb || []).filter((x) => !isSeedKb(x));
  const editing = new URLSearchParams(location.search).get('edit');
  const row = editing ? rows.find((x) => String(x.id) === editing) : null;
  const creating = new URLSearchParams(location.search).get('new') === '1' || !!row;
  app.classList.add('ess-hub');
  if (creating) {
    app.innerHTML = `
      ${nav('kb')}
      ${pageHead('Add knowledge base', '')}
      <div class="ess-card">
        <div class="ss-head"><strong>Add knowledge base</strong></div>
        <div class="ult-field"><label>Title:*</label>
          <input id="kb-title" placeholder="Title" value="${esc(row?.title || '')}" /></div>
        <div class="ult-field"><label>Content:</label>
          ${fakeEditor('kb-body')}</div>
        <div class="pr-grid">
          <div class="ult-field"><label>Share with:</label>
            <select id="kb-share">${optList(SHARE, row?.share_with || 'public', { blank: false })}</select></div>
          <div class="ult-field" id="kb-only" ${row?.share_with === 'only_with' ? '' : 'hidden'}>
            <label>Share only with:</label>
            <select id="kb-users" multiple>${PEOPLE.map((p) => `<option ${((row?.share_users || []).includes(p.name)) ? 'selected' : ''}>${esc(p.name)}</option>`).join('')}</select>
          </div>
        </div>
        <div class="ess-form-actions ess-form-actions-end">
          <button type="button" class="ess-add" id="kb-save">Save</button>
        </div>
      </div>`;
    bindHubTabs(app, go);
    bindFakeEditor(app);
    setEditorValue(app, 'kb-body', row?.body || '');
    app.querySelector('#kb-share').onchange = () => {
      app.querySelector('#kb-only').hidden = app.querySelector('#kb-share').value !== 'only_with';
    };
    app.querySelector('#kb-save').onclick = () => {
      const title = app.querySelector('#kb-title').value.trim();
      if (!title) return alert('Title is required');
      const rec = {
        id: row?.id || uid(),
        title,
        body: editorValue(app, 'kb-body'),
        share_with: app.querySelector('#kb-share').value,
        share_users: [...(app.querySelector('#kb-users')?.selectedOptions || [])].map((o) => o.value),
        at: nowStamp(),
      };
      const i = d.kb.findIndex((x) => String(x.id) === String(rec.id));
      if (i >= 0) d.kb[i] = rec;
      else d.kb.unshift(rec);
      save(d); go('kb');
    };
    return;
  }
  app.innerHTML = `
    ${nav('kb')}
    <div class="ess-card">
      <div class="ss-head"><strong>Knowledge Base</strong>
        <button type="button" class="ess-add" id="kb-add" data-keep-add="1">+ Add</button></div>
      <div class="ess-kb-grid">
        ${rows.map((k) => `<article class="ess-kb-card" data-id="${esc(k.id)}">
          <h3>${esc(k.title)}</h3>
          <span class="ess-share">${esc(k.share_with || 'public')}</span>
          <p>${esc(plainExcerpt(k.body))}</p>
          <div style="display:flex;gap:8px">
            <button type="button" data-view="${esc(k.id)}">View</button>
            <button type="button" data-edit="${esc(k.id)}">Edit</button>
            <button type="button" data-del="${esc(k.id)}">Delete</button>
          </div>
        </article>`).join('') || '<p class="ess-empty">No knowledge base articles yet.</p>'}
      </div>
    </div>`;
  bindHubTabs(app, go);
  const kbAdd = ensureAdd(app, 'kb-add');
  wireClick(kbAdd, () => {
    const u = `${hostFile}?tab=kb&new=1`;
    history.pushState({ spa: u }, '', u);
    refresh();
  });
  bindKeepAdd(app, 'kb-add', () => {
    const u = `${hostFile}?tab=kb&new=1`;
    history.pushState({ spa: u }, '', u);
    refresh();
  });
  app.querySelectorAll('[data-edit]').forEach((b) => {
    b.onclick = () => {
      const u = `${hostFile}?tab=kb&edit=${encodeURIComponent(b.dataset.edit)}`;
      history.pushState({ spa: u }, '', u);
      refresh();
    };
  });
  app.querySelectorAll('[data-view]').forEach((b) => {
    b.onclick = () => {
      const k = rows.find((x) => String(x.id) === b.dataset.view);
      if (!k) return;
      const inner = k.html
        ? `<div class="kb-read">${k.body}</div>`
        : `<p><b>Share with:</b> ${esc(k.share_with || 'public')}</p><div>${esc(k.body || '').replace(/\n/g, '<br>')}</div>`;
      viewCard(k.title, inner);
    };
  });
  app.querySelectorAll('[data-del]').forEach((b) => { b.onclick = () => deleteRow('kb', b.dataset.del); });
}

export function paintSettings(app) {
  const d = load();
  const s = d.settings || {};
  app.classList.add('ess-hub');
  app.innerHTML = `
    ${nav('settings')}
    <div class="ess-card">
      <div class="ss-head"><strong>To Do and desk settings</strong></div>
      <p class="ult-muted" style="margin:0 0 12px">Leave, payroll and attendance prefixes live in HRM. Role access is still under System → Roles — this desk does not replace that.</p>
      <form id="ess-set" class="ess-set-grid">
        <div class="ult-field"><label>Todos ID Prefix:</label>
          <input name="essentials_todos_prefix" value="${esc(s.essentials_todos_prefix || 'TODO')}" /></div>
        <div class="ult-field"><label>Leave Reference No. prefix:</label>
          <input name="leave_ref_no_prefix" value="${esc(s.leave_ref_no_prefix || '')}" /></div>
        <div class="ult-field"><label>Payroll Reference No. prefix:</label>
          <input name="payroll_ref_no_prefix" value="${esc(s.payroll_ref_no_prefix || '')}" /></div>
        <div class="ult-field span2"><label>Leave Instructions:</label>
          <textarea name="leave_instructions" rows="6">${esc(s.leave_instructions || '')}</textarea></div>
        <div class="ult-field"><label><input type="checkbox" name="is_location_required" ${s.is_location_required ? 'checked' : ''} /> Is location required?</label></div>
        <div class="ult-field"><label><input type="checkbox" name="calculate_sales_target_commission_without_tax" ${s.calculate_sales_target_commission_without_tax ? 'checked' : ''} /> Calculate Sales Target Commission without Tax</label></div>
        <div class="ult-field span2"><strong>Grace Time:</strong></div>
        <div class="ult-field"><label>Grace before checkin:</label><input name="grace_before_checkin" value="${esc(s.grace_before_checkin || '')}" /></div>
        <div class="ult-field"><label>Grace after checkin:</label><input name="grace_after_checkin" value="${esc(s.grace_after_checkin || '')}" /></div>
        <div class="ult-field"><label>Grace before checkout:</label><input name="grace_before_checkout" value="${esc(s.grace_before_checkout || '')}" /></div>
        <div class="ult-field"><label>Grace after checkout:</label><input name="grace_after_checkout" value="${esc(s.grace_after_checkout || '')}" /></div>
        <div class="span2"><button type="submit" class="ess-add">Save</button></div>
      </form>
    </div>`;
  bindHubTabs(app, go);
  app.querySelector('#ess-set').onsubmit = (e) => {
    e.preventDefault();
    const fd = new FormData(e.target);
    d.settings = {
      ...s,
      leave_ref_no_prefix: fd.get('leave_ref_no_prefix') || '',
      payroll_ref_no_prefix: fd.get('payroll_ref_no_prefix') || '',
      leave_instructions: fd.get('leave_instructions') || '',
      is_location_required: fd.get('is_location_required') === 'on',
      calculate_sales_target_commission_without_tax: fd.get('calculate_sales_target_commission_without_tax') === 'on',
      grace_before_checkin: fd.get('grace_before_checkin') || '',
      grace_after_checkin: fd.get('grace_after_checkin') || '',
      grace_before_checkout: fd.get('grace_before_checkout') || '',
      grace_after_checkout: fd.get('grace_after_checkout') || '',
      essentials_todos_prefix: fd.get('essentials_todos_prefix') || 'TODO',
    };
    save(d);
    ackResult(true, 'Settings saved.');
  };
}

function paint() {
  const app = document.getElementById('app');
  if (!app) return;
  seed();
  const on = tab();
  app.classList.add('ess-hub');
  if (maybePaintNest(app, on, { brand: hostBrand, tabs: hostTabs, brandKey: hostBrandKey, file: hostFile, go })) return;
  if (on === 'todo') return paintTodo(app);
  if (on === 'docs') return paintDocs(app, 'docs');
  if (on === 'memos') return paintDocs(app, 'memos');
  if (on === 'remind') return paintRemind(app);
  if (on === 'msg') return paintMsg(app);
  if (on === 'kb') return paintKb(app);
  if (on === 'settings' || on === 'setting') return paintSettings(app);
  app.innerHTML = `${nav('todo')}<div class="ess-card">Open a topic from the headings.</div>`;
  bindHubTabs(app, go);
}

export async function bootEssentialsHub() {
  onHubNavigate(paint);
  await loadPeople();
  try { paint(); } catch (err) {
    console.warn('essentials-hub', err);
    const app = document.getElementById('app');
    if (app) app.innerHTML = `<div class="card" style="padding:24px"><h1>Essentials</h1><p>${esc(err?.message || err)}</p></div>`;
  }
}
