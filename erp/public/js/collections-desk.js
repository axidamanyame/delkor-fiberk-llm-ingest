/** CRM Collections — Easybuy / BNPL hire-purchase debt book + call diary. */
import { esc, uid, readLs, writeLs, mergeRows, saveRow } from './ls-rows.js';
import { supabase } from './supabaseClient.js';
import { tableBar, tableFoot } from './accounting.js';
import { bindTable } from './home-tables.js';
import { innerTabs, bindHubTabs, cyanPill, orangePill, bindOverflowTabs } from './hub-kit.js';
import { confirmAction, ackResult } from './confirm-action.js';
import { crudButtons, bindDeletes } from './admin-crud.js';
import { trailForPhone, trailCard } from './hp-trail.js';
import { callDay, callTime, sortCallsRecent, formatCallDay } from './call-when.js';
import {
  ensureOps, listPtps, queueAccounts, queueCounts, QUEUES, gradeCounts, gradeBadge,
  gradeLabel, addPtp, setPtpStatus, markPtpsKept, applyPayment, setAmountDue,
  handoffToField, listHandoffs, ptpPill, money, listEligible, listOffers, addOffer,
  setOfferStatus, OFFER_TYPES, eligibilityFor, offerTypeLabel,
} from './collection-ops.js';

const ACC_KEY = 'df_collection_accounts';
const CALL_KEY = 'df_collection_calls';
const FLAG = 'df_easybuy_collections_v1';
const LIVE_FLAG = 'df_easybuy_live_ok';

const ACC_COLS = [
  'id', 'easybuy_id', 'name', 'phone', 'book', 'product', 'subsidiary_code', 'location_code',
  'status', 'lang', 'flags', 'agent', 'regular', 'exception', 'attempts', 'last_note',
  'last_follow', 'last_at', 'next_follow_up', 'amount_hint', 'source',
];
const CALL_COLS = [
  'id', 'easybuy_id', 'account_id', 'name', 'phone', 'called_on', 'called_at', 'at',
  'response', 'follow_up', 'outcome', 'next_follow_up', 'lang', 'flags', 'amount', 'channel',
];
const DATE_COLS = new Set(['next_follow_up', 'last_at', 'called_on', 'at', 'promised_on', 'due_on']);

let liveState = { accounts: 0, calls: 0, publishing: false, error: '', ok: false };
let MEM_ACC = null;
let MEM_CALLS = null;

export const BUCKETS = [
  { key: 'all', label: 'All' },
  { key: 'due', label: 'Due today' },
  { key: 'ptp', label: 'Promise to pay' },
  { key: 'no_contact', label: 'No contact' },
  { key: 'open', label: 'Open' },
  { key: 'current', label: 'Paying' },
  { key: 'on_hold', label: 'On hold' },
  { key: 'dispute', label: 'Dispute' },
  { key: 'escalate', label: 'Escalate' },
  { key: 'completed', label: 'Settled' },
];

const LABEL = {
  open: 'Open',
  ptp: 'Promise to pay',
  no_contact: 'No contact',
  current: 'Paying',
  completed: 'Settled',
  on_hold: 'On hold',
  dispute: 'Dispute',
  escalate: 'Escalate',
  language: 'Language desk',
};

function todayYmd() {
  const d = new Date();
  const p = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}

function ghWa(phone) {
  const d = String(phone || '').replace(/\D/g, '');
  if (!d) return '';
  const intl = d.startsWith('0') ? `233${d.slice(1)}` : (d.startsWith('233') ? d : `233${d}`);
  return `https://wa.me/${intl}`;
}

function pill(status) {
  const lab = LABEL[status] || status || 'Open';
  return `<span class="col-pill col-${esc(status || 'open')}">${esc(lab)}</span>`;
}

export async function ensureCollections() {
  css();
  let remoteAcc = [];
  let remoteCalls = [];
  try {
    const a = await Promise.race([
      supabase.from('collection_accounts').select('*').limit(4000),
      new Promise((resolve) => setTimeout(() => resolve({ data: null }), 4000)),
    ]);
    if (a?.data?.length) remoteAcc = a.data.map(normalizeAcc);
  } catch { /* local */ }
  try {
    const c = await Promise.race([
      supabase.from('collection_calls').select('*').limit(8000),
      new Promise((resolve) => setTimeout(() => resolve({ data: null }), 4000)),
    ]);
    if (c?.data?.length) remoteCalls = c.data.map(normalizeCall);
  } catch { /* local */ }
  const localAcc = readLs(ACC_KEY, []) || [];
  const localCalls = readLs(CALL_KEY, []) || [];
  if (remoteAcc.length || localAcc.length) writeLs(ACC_KEY, mergeRows([remoteAcc, localAcc]));
  if (remoteCalls.length || localCalls.length) writeLs(CALL_KEY, mergeRows([remoteCalls, localCalls]));
  try {
    const res = await fetch('/js/easybuy-collections-data.json?v=2026-09-11c', { cache: 'no-cache' });
    if (res.ok) {
      const data = await res.json();
      const ver = data.seed_ver || data.generated || '';
      const prev = localStorage.getItem('df_eb_coll_ver') || '';
      if (ver && ver !== prev) {
        writeLs(ACC_KEY, mergeRows([readLs(ACC_KEY, []) || [], data.accounts || []]));
        writeLs(CALL_KEY, mergeRows([readLs(CALL_KEY, []) || [], data.calls || []]));
        localStorage.setItem('df_eb_coll_ver', ver);
      } else if (!(readLs(ACC_KEY, []) || []).length) {
        writeLs(ACC_KEY, data.accounts || []);
        writeLs(CALL_KEY, data.calls || []);
      }
    }
  } catch { /* keep local */ }
  if (!(MEM_ACC || []).length) {
    MEM_ACC = readLs(ACC_KEY, []) || [];
    MEM_CALLS = readLs(CALL_KEY, []) || [];
  }
  liveState.accounts = remoteAcc.length;
  liveState.calls = remoteCalls.length;
  liveState.ok = remoteAcc.length > 0;
  try { localStorage.setItem(FLAG, '1'); } catch { /* ignore */ }
  if (!remoteAcc.length) {
    try { await publishBook({ quiet: true }); } catch { /* local until SQL 113 */ }
  }
  try { ensureOps(); } catch { /* ignore */ }
}

function normalizeAcc(row) {
  if (!row) return row;
  const id = row.easybuy_id || row.id;
  return { ...row, id, easybuy_id: row.easybuy_id || row.id };
}
function normalizeCall(row) {
  if (!row) return row;
  const id = row.easybuy_id || row.id;
  return { ...row, id, easybuy_id: row.easybuy_id || row.id };
}

function pickRow(row, cols) {
  const o = {};
  for (const k of cols) {
    let v = row[k];
    if (k === 'easybuy_id') v = row.easybuy_id || row.id;
    if (k === 'id') v = row.id || row.easybuy_id;
    if (DATE_COLS.has(k)) v = blankDate(v);
    if (v === '') v = null;
    if (k === 'flags' && !Array.isArray(v)) v = [];
    if (k === 'source' && !v) v = 'easybuy';
    o[k] = v;
  }
  delete o.due_on;
  return o;
}

async function upsertChunk(table, rows) {
  if (!rows.length) return null;
  const { error } = await supabase.from(table).upsert(rows, { onConflict: 'id' });
  return error || null;
}

export async function publishBook({ quiet } = {}) {
  if (liveState.publishing) return liveState;
  liveState.publishing = true;
  liveState.error = '';
  const acc = (accounts() || []).map((r) => pickRow(r, ACC_COLS));
  const diary = (calls() || []).map((r) => pickRow(r, CALL_COLS));
  try {
    const size = 80;
    for (let i = 0; i < acc.length; i += size) {
      const err = await upsertChunk('collection_accounts', acc.slice(i, i + size));
      if (err) throw err;
    }
    for (let i = 0; i < diary.length; i += size) {
      const err = await upsertChunk('collection_calls', diary.slice(i, i + size));
      if (err) throw err;
    }
    liveState.accounts = acc.length;
    liveState.calls = diary.length;
    liveState.ok = true;
    try { localStorage.setItem(LIVE_FLAG, String(acc.length)); } catch { /* ignore */ }
  } catch (e) {
    liveState.ok = false;
    liveState.error = e?.message || e?.code || 'Publish failed';
    if (!quiet) throw e;
  } finally {
    liveState.publishing = false;
  }
  return liveState;
}

function blankDate(v) {
  const s = String(v || '').trim();
  return s ? s : null;
}

async function persistAcc(row) {
  if (!row) return;
  const clean = {
    ...row,
    easybuy_id: row.easybuy_id || row.id,
    next_follow_up: blankDate(row.next_follow_up),
    last_at: blankDate(row.last_at),
  };
  delete clean.due_on;
  try { await saveRow('collection_accounts', ACC_KEY, clean); } catch { /* local */ }
}

async function persistCall(row) {
  if (!row) return;
  const at = row.at && String(row.at).length >= 16 ? row.at : new Date().toISOString();
  const clean = {
    ...row,
    id: row.id,
    easybuy_id: row.easybuy_id || row.id,
    next_follow_up: blankDate(row.next_follow_up),
    called_on: blankDate(row.called_on),
    at,
  };
  delete clean.due_on;
  try { await saveRow('collection_calls', CALL_KEY, clean); } catch { /* local */ }
}

function accounts() { return (MEM_ACC && MEM_ACC.length) ? MEM_ACC : (readLs(ACC_KEY, []) || []); }
function calls() { return sortCallsRecent((MEM_CALLS && MEM_CALLS.length) ? MEM_CALLS : (readLs(CALL_KEY, []) || [])); }

function diaryArticles(hist) {
  const rows = sortCallsRecent(hist);
  let last = null;
  return rows.map((c) => {
    const day = callDay(c);
    const head = day !== last ? `<p class="col-tl-day">${esc(formatCallDay(day))}</p>` : '';
    last = day;
    const time = callTime(c).slice(0, 5);
    return `${head}<article>
        <strong>${esc(time)}</strong> ${pill(c.outcome)}
        <div>${esc(c.response || '')}</div>
        <div class="ult-muted">${esc(c.follow_up || '')}${c.next_follow_up ? ' · Next ' + esc(c.next_follow_up) : ''}</div>
      </article>`;
  }).join('') || '<p class="ult-muted">No calls yet.</p>';
}
function saveAcc(rows) { MEM_ACC = rows; writeLs(ACC_KEY, rows); }
function saveCalls(rows) { MEM_CALLS = rows; writeLs(CALL_KEY, rows); }

function pane() {
  const q = new URLSearchParams(location.search);
  const t = q.get('pane') || q.get('tab') || 'accounts';
  if (t === 'field' || t === 'offers') return t;
  return ['accounts', 'diary', 'regulars', 'exceptions', 'ptp', 'queues', 'scores'].includes(t) ? t : 'accounts';
}

function setPane(p) {
  const u = new URL(location.href);
  u.searchParams.delete('tab');
  if (p && p !== 'accounts') u.searchParams.set('pane', p);
  else u.searchParams.delete('pane');
  const next = u.pathname + u.search;
  history.pushState({ spa: next }, '', next);
}

function dueAmt(a) {
  const n = a?.amount_due ?? a?.amount_hint ?? a?.amount ?? a?.balance;
  return money(n);
}

function ptpCustomer(p) {
  if (p?.name) return p.name;
  const a = accounts().find((x) => String(x.id) === String(p.account_id) || String(x.easybuy_id) === String(p.account_id) || (p.phone && x.phone === p.phone));
  return a?.name || p.phone || '—';
}

function due(a) {
  if (!a.next_follow_up) return false;
  if (['completed', 'on_hold'].includes(a.status)) return false;
  return a.next_follow_up <= todayYmd();
}

export function crmStatusOf(a) {
  if (a.status === 'completed') return 'Completed';
  if (a.status === 'on_hold') return 'Cancelled';
  if (due(a)) return 'Open';
  if (a.next_follow_up && a.next_follow_up > todayYmd()) return 'Scheduled';
  return 'Open';
}

export function collectionCrmFollowups() {
  css();
  return accounts().map((a) => ({
    id: a.id,
    contact: a.name,
    phone: a.phone || '',
    cat: 'Collections',
    status: crmStatusOf(a),
    user: a.agent || 'Collections desk',
    when: a.next_follow_up || String(a.last_at || '').slice(0, 16),
    dueToday: due(a),
    source: 'collections',
    note: a.last_note || '',
    credit_grade: a.credit_grade || '',
    credit_score: a.credit_score || 0,
  }));
}

export { viewAccount, todayYmd, due as collectionDue };

function matchBucket(a, key) {
  if (!key || key === 'all') return true;
  if (key === 'due') return due(a);
  if (key === 'regulars') return !!a.regular;
  if (key === 'exceptions') return !!a.exception;
  return a.status === key;
}

function css() {
  if (document.getElementById('col-desk-css')) return;
  const s = document.createElement('style');
  s.id = 'col-desk-css';
  s.textContent = `
    .col-kpis{display:grid;grid-template-columns:repeat(6,minmax(0,1fr));gap:10px;margin:12px 0 16px}
    @media(max-width:1100px){.col-kpis{grid-template-columns:1fr 1fr 1fr}}
    @media(max-width:640px){.col-kpis{grid-template-columns:1fr 1fr}}
    .col-pill{display:inline-block;border-radius:999px;padding:2px 8px;font-size:11px;font-weight:700;white-space:nowrap}
    .col-ptp{background:#fef3c7;color:#92400e}
    .col-no_contact{background:#fee2e2;color:#991b1b}
    .col-open{background:#e0f2fe;color:#075985}
    .col-current{background:#d1fae5;color:#065f46}
    .col-completed{background:#dcfce7;color:#166534}
    .col-on_hold{background:#e2e8f0;color:#334155}
    .col-dispute{background:#fae8ff;color:#86198f}
    .col-escalate{background:#ffedd5;color:#9a3412}
    .col-language{background:#ede9fe;color:#5b21b6}
    .col-filters{display:flex;flex-wrap:wrap;gap:6px;margin:0 0 12px}
    .col-filters button{border:1px solid #cbd5e1;background:#fff;border-radius:999px;padding:4px 10px;font-size:12px;font-weight:700;cursor:pointer}
    .col-filters button.on{background:#1d4ed8;color:#fff;border-color:#1d4ed8}
    .col-note{max-width:280px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;color:#334155}
    .col-drawer{position:fixed;inset:0;background:rgba(15,23,42,.45);z-index:14000;display:flex;justify-content:flex-end}
    .col-drawer-card{width:min(520px,100%);background:#fff;height:100%;overflow:auto;padding:20px 22px 40px;box-shadow:-12px 0 40px rgba(0,0,0,.2)}
    .col-tl{border-left:2px solid #cbd5e1;margin:12px 0 0 8px;padding:0 0 8px 16px}
    .col-tl article{margin:0 0 14px;position:relative}
    .col-tl article:before{content:'';position:absolute;left:-21px;top:6px;width:8px;height:8px;border-radius:50%;background:#2563eb}
    .col-tl-day{margin:16px 0 8px;font-size:12px;font-weight:800;letter-spacing:.04em;text-transform:uppercase;color:#334155}
    .col-form label{display:block;font-size:12px;font-weight:700;margin:10px 0 4px;text-align:left}
    .col-form input,.col-form select,.col-form textarea{width:100%;box-sizing:border-box;border:1px solid #cbd5e1;border-radius:8px;padding:8px 10px;font:inherit}
    .col-form textarea{min-height:90px}
    .col-grade{display:inline-flex;align-items:center;justify-content:center;width:28px;height:28px;border-radius:8px;font-weight:800;font-size:13px}
    .col-g-A{background:#d1fae5;color:#065f46}
    .col-g-B{background:#e0f2fe;color:#075985}
    .col-g-C{background:#fef3c7;color:#92400e}
    .col-g-D{background:#ffedd5;color:#9a3412}
    .col-g-E{background:#fee2e2;color:#991b1b}
    .col-ptp-open{background:#e0f2fe;color:#075985}
    .col-ptp-broken{background:#fee2e2;color:#991b1b}
    .col-ptp-kept{background:#d1fae5;color:#065f46}
    .col-ptp-rolled{background:#f1f5f9;color:#334155}
    .col-queues{display:grid;grid-template-columns:repeat(auto-fill,minmax(160px,1fr));gap:8px;margin:0 0 14px}
    .col-q{display:block;text-decoration:none;color:inherit;background:#fff;border:1px solid #e2e8f0;border-radius:12px;padding:12px 14px}
    .col-q.on,.col-q:hover{border-color:#1d4ed8}
    .col-q b{display:block;font-size:22px}
    .col-why{font-size:12px;color:#3d4f66;margin:6px 0 0}
  `;
  document.head.appendChild(s);
}

function liveBanner() {
  const nAcc = (accounts() || []).length;
  const nCall = (calls() || []).length;
  const acm = `<p class="ult-lead">Call and arrears book (${nAcc} accounts · ${nCall} calls).</p>`;
  if (liveState.ok) {
    return `${acm}<p class="ult-lead" id="col-live">Live book on server — ${liveState.accounts || nAcc} accounts · ${liveState.calls || nCall} calls.</p>`;
  }
  const err = liveState.error ? ` Last error: ${esc(liveState.error)}.` : '';
  return `${acm}<p class="ult-lead" id="col-live">This call book is on this device until it is published.${esc(err)}
    <button type="button" class="ult-btn ult-btn-primary" data-publish style="margin-left:8px">Publish to live database</button>
  </p>`;
}

function kpis(rows) {
  const n = (k) => rows.filter((a) => (k === 'due' ? due(a) : a.status === k)).length;
  const broken = listPtps('broken').length;
  const g = gradeCounts();
  return `<div class="col-kpis">
    ${cyanPill('users', 'Accounts', rows.length)}
    ${cyanPill('cal', 'Due today', n('due'))}
    ${orangePill('target', 'Broken PTP', broken)}
    ${orangePill('lock', 'No contact', n('no_contact'))}
    ${cyanPill('check', 'Paying', n('current'))}
    ${cyanPill('spark', 'Grade A–B', (g.A || 0) + (g.B || 0))}
    ${orangePill('box', 'Appliance eligible', listEligible('appliance').length)}
  </div>`;
}

function phoneCell(p) {
  if (!p) return '—';
  const wa = ghWa(p);
  return `<a href="tel:${esc(p)}">${esc(p)}</a>${wa ? ` · <a href="${esc(wa)}" target="_blank" rel="noopener">WhatsApp</a>` : ''}`;
}

function openDrawer(html) {
  document.getElementById('col-drawer')?.remove();
  const wrap = document.createElement('div');
  wrap.id = 'col-drawer';
  wrap.className = 'col-drawer';
  wrap.innerHTML = `<div class="col-drawer-card">${html}</div>`;
  wrap.addEventListener('click', (e) => { if (e.target === wrap) wrap.remove(); });
  document.body.appendChild(wrap);
  wrap.querySelector('[data-close]')?.addEventListener('click', () => wrap.remove());
  return wrap;
}

function viewAccount(id, onPaint) {
  const a = accounts().find((x) => x.id === id);
  if (!a) return;
  const hist = sortCallsRecent(calls().filter((c) => c.account_id === id));
  const contracts = listPtps('all').filter((p) => p.account_id === id);
  const wrap = openDrawer(`
    <div style="display:flex;justify-content:space-between;gap:8px;align-items:flex-start">
      <div>
        <h2 style="margin:0 0 4px">${esc(a.name)} ${gradeBadge(a.credit_grade)}</h2>
        <p style="margin:0 0 8px">${phoneCell(a.phone)} · ${pill(a.status)}</p>
        <p class="ult-muted" style="margin:0">${esc(gradeLabel(a.credit_grade))} · score ${a.credit_score ?? '—'} · ${esc(a.agent || 'Unassigned')}</p>
      </div>
      <button type="button" class="ult-btn" data-close>Close</button>
    </div>
    <p class="col-why">${esc(a.credit_why || '')}</p>
    <p style="margin:8px 0 0">${esc(a.promo_label || '')}</p>
    <p style="margin:12px 0 0">${esc(a.last_note || 'No latest note.')}</p>
    <p class="ult-muted">${esc(a.status || 'open')}${a.field_status ? ' · Field: ' + esc(a.field_status) : ''}</p>
    <div id="hp-trail-slot"></div>
    ${(a.flags || []).length ? `<p>${a.flags.map((f) => `<span class="col-pill col-open">${esc(f.replace(/_/g, ' '))}</span>`).join(' ')}</p>` : ''}
    <div style="display:flex;gap:8px;margin:12px 0;flex-wrap:wrap">
      <button type="button" class="ult-btn ult-btn-primary" data-log>Log call</button>
      ${a.phone ? `<a class="ult-btn" href="tel:${esc(a.phone)}">Call</a>` : ''}
    </div>
    <h3 style="margin:16px 0 8px">Promises (${contracts.length})</h3>
    ${contracts.length ? `<table class="ult-table"><thead><tr><th>Date</th><th>Status</th><th></th></tr></thead>
      <tbody>${contracts.map((p) => `<tr>
        <td>${esc(p.due_on || p.promised_on)}</td>
        <td>${ptpPill(p.status)}</td>
        <td>${p.status === 'open' || p.status === 'broken' ? `<a href="#" data-ptp="${esc(p.id)}" data-st="kept">Kept</a> · <a href="#" data-ptp="${esc(p.id)}" data-st="broken">Broken</a>` : ''}</td>
      </tr>`).join('')}</tbody></table>` : '<p class="ult-muted">No PTP contract yet.</p>'}
    <h3 style="margin:16px 0 0">Call diary (${hist.length})</h3>
    <div class="col-tl">${diaryArticles(hist)}</div>
  `);
  wrap.querySelector('[data-log]').onclick = () => { wrap.remove(); logCall(id, onPaint); };
  trailForPhone(a.phone).then((t) => {
    const slot = wrap.querySelector('#hp-trail-slot');
    if (slot) slot.outerHTML = trailCard(t);
  }).catch(() => {
    const slot = wrap.querySelector('#hp-trail-slot');
    if (slot) slot.innerHTML = '';
  });
  wrap.querySelector('[data-due]')?.remove();
  wrap.querySelector('[data-offer]')?.addEventListener('click', () => { wrap.remove(); offerPromo(id, onPaint); });
  wrap.querySelectorAll('[data-ptp]').forEach((el) => {
    el.onclick = async (e) => {
      e.preventDefault();
      const st = el.dataset.st;
      if (!(await confirmAction(st === 'kept' ? 'Mark this promise kept?' : 'Mark this promise broken?'))) return;
      setPtpStatus(el.dataset.ptp, st);
      if (st === 'kept') applyPayment(id, contracts.find((p) => p.id === el.dataset.ptp)?.amount);
      ensureOps();
      wrap.remove();
      ackResult(true, st === 'kept' ? 'Promise kept.' : 'Broken promise queued.');
      onPaint?.();
    };
  });
}

function offerPromo(id, onPaint) {
  const a = accounts().find((x) => x.id === id);
  if (!a) return;
  const allowed = eligibilityFor(a.credit_grade);
  const types = OFFER_TYPES.filter((t) => allowed.includes(t.key));
  if (!types.length) {
    ackResult(false, 'This customer is not eligible for a hire-purchase promotion.');
    return;
  }
  const wrap = openDrawer(`
    <h2 style="margin:0 0 8px">Offer hire-purchase promotion</h2>
    <p class="ult-muted">${esc(a.name)} · ${gradeBadge(a.credit_grade)} ${esc(gradeLabel(a.credit_grade))}</p>
    <p>Same Easybuy line. Grade A unlocks appliances; Grade B unlocks the next handset only.</p>
    <form class="col-form" id="col-off">
      <label>Promotion</label>
      <select name="offer_type">${types.map((t) => `<option value="${t.key}">${esc(t.label)}</option>`).join('')}</select>
      <label>Item (optional — do not invent a product)</label>
      <input name="product" placeholder="e.g. fridge, cooker — leave blank if not chosen yet" />
      <label>Note to the customer</label>
      <textarea name="note" placeholder="You have kept your Easybuy payments. You may qualify for…"></textarea>
      <button type="submit" class="ult-btn ult-btn-primary" style="margin-top:14px;width:100%">Record offer</button>
      <button type="button" class="ult-btn" data-close style="margin-top:8px;width:100%">Cancel</button>
    </form>
  `);
  wrap.querySelector('#col-off').onsubmit = async (e) => {
    e.preventDefault();
    const fd = new FormData(e.target);
    const offer_type = String(fd.get('offer_type') || '');
    if (!(await confirmAction('Record this promotion offer?', offerTypeLabel(offer_type) + ' for ' + a.name))) return;
    try {
      addOffer({
        account: a,
        offer_type,
        product: String(fd.get('product') || '').trim(),
        note: String(fd.get('note') || ''),
        agent: a.agent || '',
      });
    } catch (err) {
      ackResult(false, err?.message || 'Could not record offer.');
      return;
    }
    wrap.remove();
    ackResult(true, 'Promotion offered on the hire-purchase line.');
    onPaint?.();
  };
}

function logCall(id, onPaint) {
  const a = accounts().find((x) => x.id === id) || { name: '', phone: '', status: 'open' };
  const wrap = openDrawer(`
    <h2 style="margin:0 0 8px">Log collection call</h2>
    <p class="ult-muted">${esc(a.name || 'New account')} · ${esc(a.phone || '')}</p>
    <form class="col-form" id="col-log">
      <label>Outcome</label>
      <select name="outcome">${BUCKETS.filter((b) => !['all', 'due'].includes(b.key)).map((b) =>
        `<option value="${b.key}" ${a.status === b.key ? 'selected' : ''}>${esc(b.label)}</option>`).join('')}</select>
      <label>What was said</label>
      <textarea name="response" required placeholder="Customer response"></textarea>
      <label>Follow-up plan</label>
      <input name="follow_up" placeholder="I will follow up tomorrow." />
      <label>Next follow-up / PTP date</label>
      <input name="next" type="date" />
      <label>Channel</label>
      <select name="channel">
        <option value="momo">MoMo</option>
        <option value="cash">Cash</option>
        <option value="agent">Field agent</option>
        <option value="bank">Bank</option>
      </select>
      <label>Agent</label>
      <input name="agent" value="${esc(a.agent || '')}" />
      <button type="submit" class="ult-btn ult-btn-primary" style="margin-top:14px;width:100%">Save call</button>
      <button type="button" class="ult-btn" data-close style="margin-top:8px;width:100%">Cancel</button>
    </form>
  `);
  wrap.querySelector('#col-log').onsubmit = async (e) => {
    e.preventDefault();
    const fd = new FormData(e.target);
    const outcome = String(fd.get('outcome') || 'open');
    const next = String(fd.get('next') || '');
    const amountRaw = String(fd.get('amount') || '').trim();
    const amount = amountRaw === '' ? null : Number(amountRaw);
    if (outcome === 'ptp' && !next) {
      ackResult(false, 'A promise to pay needs a due date.');
      return;
    }
    if (!(await confirmAction('Save this collection call?', 'This is written to the Easybuy debt book.'))) return;
    const now = new Date();
    const ymd = todayYmd();
    const tm = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;
    const call = {
      id: 'call-' + uid().slice(0, 8),
      account_id: a.id,
      easybuy_id: a.easybuy_id || a.id,
      name: a.name,
      phone: a.phone,
      called_on: ymd,
      called_at: tm,
      at: now.toISOString(),
      response: String(fd.get('response') || ''),
      follow_up: String(fd.get('follow_up') || ''),
      outcome,
      next_follow_up: next || null,
      amount,
      channel: String(fd.get('channel') || ''),
      lang: a.lang || 'en',
      flags: [],
    };
    saveCalls([call, ...calls()]);
    const nextAcc = accounts().map((row) => row.id !== a.id ? row : {
      ...row,
      status: call.outcome,
      last_note: call.response,
      last_follow: call.follow_up,
      last_at: call.at,
      next_follow_up: call.next_follow_up,
      attempts: (row.attempts || 0) + 1,
      agent: String(fd.get('agent') || row.agent || ''),
    });
    saveAcc(nextAcc);
    await persistCall(call);
    await persistAcc(nextAcc.find((r) => r.id === a.id));
    if (outcome === 'ptp') {
      addPtp({
        account: a,
        due_on: next,
        amount,
        channel: call.channel,
        note: call.follow_up || call.response,
        call_id: call.id,
        agent: String(fd.get('agent') || a.agent || ''),
      });
    }
    if (outcome === 'current' || outcome === 'completed') {
      markPtpsKept(a.id);
      if (amount) applyPayment(a.id, amount);
    }
    ensureOps();
    wrap.remove();
    ackResult(true, 'Call logged for ' + a.name + '.');
    onPaint?.();
  };
}

async function addAccount(onPaint) {
  const wrap = openDrawer(`
    <h2 style="margin:0 0 8px">New collection account</h2>
    <form class="col-form" id="col-add">
      <label>Customer name</label><input name="name" required />
      <label>Phone</label><input name="phone" required placeholder="024XXXXXXX" />
      <label>Agent</label><input name="agent" />
      <label>Opening note</label><textarea name="note"></textarea>
      <button type="submit" class="ult-btn ult-btn-primary" style="margin-top:14px;width:100%">Save account</button>
      <button type="button" class="ult-btn" data-close style="margin-top:8px;width:100%">Cancel</button>
    </form>
  `);
  wrap.querySelector('#col-add').onsubmit = async (e) => {
    e.preventDefault();
    const fd = new FormData(e.target);
    if (!(await confirmAction('Add this collection account?'))) return;
    const phone = String(fd.get('phone') || '').replace(/\D/g, '');
    const row = {
      id: 'col-' + uid().slice(0, 10),
      name: String(fd.get('name') || '').trim(),
      phone: phone.length === 9 ? '0' + phone : phone,
      book: 'Easybuy',
      product: 'Hire purchase handset',
      subsidiary_code: 'buynowpayslater',
      location_code: 'BNPL-FIELD',
      status: 'open',
      lang: 'en',
      flags: [],
      agent: String(fd.get('agent') || ''),
      regular: false,
      exception: false,
      attempts: 0,
      last_note: String(fd.get('note') || ''),
      last_follow: '',
      last_at: null,
      next_follow_up: todayYmd(),
      last_bucket: 'open',
      amount_hint: null,
    };
    saveAcc([row, ...accounts()]);
    await persistAcc(row);
    wrap.remove();
    ackResult(true, 'Account added.');
    onPaint?.();
  };
}

export async function paintCollections(app, { navHtml = '', go } = {}) {
  css();
  await ensureCollections();
  const onPane = pane();
  if (onPane === 'field') {
    location.replace('/call-centre.html?pane=field');
    return;
  }
  if (onPane === 'offers') {
    location.replace('/call-centre.html?pane=hp');
    return;
  }
  const bucket = new URLSearchParams(location.search).get('bucket') || 'all';
  const rows = accounts();
  const filtered = rows.filter((a) => {
    if (onPane === 'regulars') return a.regular;
    if (onPane === 'exceptions') return a.exception;
    if (onPane === 'diary') return true;
    return matchBucket(a, bucket);
  });
  const sub = innerTabs([
    { key: 'accounts', label: 'Accounts', href: '/collections-desk.html' },
    { key: 'ptp', label: 'PTP desk', href: '/collections-desk.html?pane=ptp' },
    { key: 'queues', label: 'Queues', href: '/collections-desk.html?pane=queues' },
    { key: 'scores', label: 'Credit grade', href: '/collections-desk.html?pane=scores' },
    { key: 'diary', label: 'Call diary', href: '/collections-desk.html?pane=diary' },
    { key: 'regulars', label: 'Regular payers', href: '/collections-desk.html?pane=regulars' },
    { key: 'exceptions', label: 'Exceptions', href: '/collections-desk.html?pane=exceptions' },
  ], onPane);

  const filters = onPane === 'accounts'
    ? `<div class="col-filters">${BUCKETS.map((b) =>
      `<button type="button" data-bucket="${b.key}" class="${bucket === b.key ? 'on' : ''}">${esc(b.label)}</button>`).join('')}</div>`
    : '';

  const live = liveBanner();
  const head = `${navHtml}<h1 class="hub-h1">Collections</h1>${live}${sub}${kpis(rows)}`;

  if (onPane === 'diary') {
    const hist = sortCallsRecent(calls());
    app.innerHTML = `${head}
      <div class="ult-card" data-tbl="col-diary">
        <div class="ss-head"><strong>Call diary</strong></div>
        ${tableBar()}
        <div class="ult-table-wrap"><table class="ult-table">
          <thead><tr><th>When</th><th>Customer</th><th>Phone</th><th>Outcome</th><th>Response</th><th>Next</th></tr></thead>
          <tbody>${hist.map((c) => `<tr data-acc="${esc(c.account_id)}">
            <td>${esc(callDay(c) || '')} ${esc(callTime(c).slice(0, 5))}</td>
            <td><a href="#" data-view="${esc(c.account_id)}">${esc(c.name)}</a></td>
            <td>${phoneCell(c.phone)}</td>
            <td>${pill(c.outcome)}</td>
            <td><div class="col-note" title="${esc(c.response)}">${esc(c.response)}</div></td>
            <td>${esc(c.next_follow_up || '')}</td>
          </tr>`).join('') || '<tr><td colspan="6">No calls in the diary.</td></tr>'}</tbody>
        </table></div>
        ${tableFoot()}
      </div>`;
  } else if (onPane === 'ptp') {
    const pFilter = new URLSearchParams(location.search).get('ptp') || 'all';
    const list = listPtps(pFilter);
    const tabs = [['all', 'All'], ['open', 'Open'], ['due', 'Due today'], ['broken', 'Broken'], ['kept', 'Kept'], ['rolled', 'Rolled']];
    app.innerHTML = `${head}
      <p class="ult-lead">A promise is a date and a channel. Broken promises sit here the next morning.</p>
      <div class="col-filters">${tabs.map(([k, lab]) =>
        `<button type="button" data-ptp-filter="${k}" class="${pFilter === k ? 'on' : ''}">${lab}</button>`).join('')}</div>
      <div class="ult-card" data-tbl="col-ptp">
        <div class="ss-head"><strong>PTP contracts (${list.length})</strong></div>
        ${tableBar()}
        <div class="ult-table-wrap"><table class="ult-table">
          <thead><tr><th>Customer</th><th>Phone</th><th>Promised</th><th>Due</th><th>Channel</th><th>Status</th></tr></thead>
          <tbody>${list.map((p) => `<tr>
            <td><a href="#" data-view="${esc(p.account_id)}">${esc(ptpCustomer(p))}</a></td>
            <td>${phoneCell(p.phone)}</td>
            <td>${esc(p.promised_on || '')}</td>
            <td>${esc(p.due_on || p.promised_on || '')}</td>
            <td>${esc(p.channel || '—')}</td>
            <td>${ptpPill(p.status)}${p.status === 'open' || p.status === 'broken'
              ? ` · <a href="#" data-ptp="${esc(p.id)}" data-st="kept">Kept</a> · <a href="#" data-ptp="${esc(p.id)}" data-st="broken">Broken</a>`
              : ''}</td>
          </tr>`).join('') || '<tr><td colspan="6">No promises in this filter.</td></tr>'}</tbody>
        </table></div>
        ${tableFoot()}
      </div>`;
  } else if (onPane === 'queues') {
    const qKey = new URLSearchParams(location.search).get('queue') || 'broken_ptp';
    const counts = queueCounts();
    const qRows = queueAccounts(qKey);
    app.innerHTML = `${head}
      <p class="ult-lead">Hardship, language and skip-trace leave the general dial list. Same accounts — different script.</p>
      <div class="col-queues">${QUEUES.map((q) =>
        `<a class="col-q ${qKey === q.key ? 'on' : ''}" href="/collections-desk.html?pane=queues&queue=${q.key}" data-queue="${q.key}">
          <b>${counts[q.key] || 0}</b>${esc(q.label)}</a>`).join('')}</div>
      <div class="ult-card" data-tbl="col-q">
        <div class="ss-head"><strong>${esc(QUEUES.find((q) => q.key === qKey)?.label || 'Queue')} (${qRows.length})</strong></div>
        ${tableBar()}
        <div class="ult-table-wrap"><table class="ult-table">
          <thead><tr><th>Grade</th><th>Customer</th><th>Phone</th><th>Status</th><th>Flags</th><th>Agent</th><th>Next</th></tr></thead>
          <tbody>${qRows.map((a) => `<tr>
            <td>${gradeBadge(a.credit_grade)}</td>
            <td><a href="#" data-view="${esc(a.id)}">${esc(a.name)}</a></td>
            <td>${phoneCell(a.phone)}</td>
            <td>${pill(a.status)}</td>
            <td>${(a.flags || []).map((f) => esc(f.replace(/_/g, ' '))).join(', ') || '—'}</td>
            <td>${esc(a.agent || '—')}</td>
            <td>${esc(a.next_follow_up || '')}</td>
          </tr>`).join('') || '<tr><td colspan="7">Nothing in this queue.</td></tr>'}</tbody>
        </table></div>
        ${tableFoot()}
      </div>`;
  } else if (onPane === 'scores') {
    const g = gradeCounts();
    const ranked = rows.slice().sort((a, b) => (b.credit_score || 0) - (a.credit_score || 0));
    app.innerHTML = `${head}
      <p class="ult-lead">Grade from this book: PTP kept, regularity, reach, stress flags, chase effort.</p>
      <div class="col-kpis">
        ${['A', 'B', 'C', 'D', 'E'].map((L) => cyanPill('spark', gradeLabel(L), g[L] || 0)).join('')}
      </div>
      <div class="ult-card" data-tbl="col-score">
        <div class="ss-head"><strong>Customer grades</strong></div>
        ${tableBar()}
        <div class="ult-table-wrap"><table class="ult-table">
          <thead><tr><th>Grade</th><th>Score</th><th>Customer</th><th>Phone</th><th>Why</th><th>Attempts</th></tr></thead>
          <tbody>${ranked.map((a) => `<tr>
            <td>${gradeBadge(a.credit_grade)}</td>
            <td>${a.credit_score ?? '—'}</td>
            <td><a href="#" data-view="${esc(a.id)}">${esc(a.name)}</a></td>
            <td>${phoneCell(a.phone)}</td>
            <td><div class="col-note" title="${esc(a.credit_why || '')}">${esc(a.credit_why || '')}</div></td>
            <td>${a.attempts || 0}</td>
          </tr>`).join('')}</tbody>
        </table></div>
        ${tableFoot()}
      </div>`;
  } else if (onPane === 'offers') {
    const kind = new URLSearchParams(location.search).get('promo') || 'appliance';
    const offered = listOffers('all');
    const eligible = kind === 'offered' ? [] : listEligible(kind === 'handset' ? 'next_handset' : kind === 'any' ? 'any' : 'appliance');
    const tabs = [
      ['appliance', 'Appliance eligible'],
      ['handset', 'Next handset'],
      ['offered', 'Offers made'],
    ];
    const showOffers = kind === 'offered';
    app.innerHTML = `${head}
      <p class="ult-lead">Promotions stay on the hire-purchase line. Grade A may buy appliances on Easybuy; Grade B may take the next handset. We do not invent products — staff record the offer when it is actually made.</p>
      <div class="col-filters">${tabs.map(([k, lab]) =>
        `<button type="button" data-promo="${k}" class="${kind === k ? 'on' : ''}">${lab}</button>`).join('')}</div>
      <div class="ult-card" data-tbl="col-off">
        <div class="ss-head"><strong>${showOffers ? 'Offers recorded' : 'Eligible customers'} (${showOffers ? offered.length : eligible.length})</strong></div>
        ${tableBar()}
        <div class="ult-table-wrap"><table class="ult-table">
          ${showOffers
            ? `<thead><tr><th>When</th><th>Grade</th><th>Customer</th><th>Promotion</th><th>Item</th><th>Status</th><th></th></tr></thead>
               <tbody>${offered.map((o) => `<tr>
                 <td>${esc(o.offered_on || '')}</td>
                 <td>${gradeBadge(o.grade)}</td>
                 <td><a href="#" data-view="${esc(o.account_id)}">${esc(o.name)}</a></td>
                 <td>${esc(o.title)}</td>
                 <td>${esc(o.product || '—')}</td>
                 <td>${esc(o.status)}</td>
                 <td>${o.status === 'offered' ? `<a href="#" data-off="${esc(o.id)}" data-st="accepted">Accepted</a> · <a href="#" data-off="${esc(o.id)}" data-st="declined">Declined</a>` : ''}</td>
               </tr>`).join('') || '<tr><td colspan="7">No promotions recorded yet. Open an eligible customer and tap Offer HP promotion.</td></tr>'}</tbody>`
            : `<thead><tr><th>Grade</th><th>Customer</th><th>Phone</th><th>Eligible for</th><th>Score</th><th></th></tr></thead>
               <tbody>${eligible.map((a) => `<tr>
                 <td>${gradeBadge(a.credit_grade)}</td>
                 <td><a href="#" data-view="${esc(a.id)}">${esc(a.name)}</a></td>
                 <td>${phoneCell(a.phone)}</td>
                 <td>${esc(a.promo_label)}</td>
                 <td>${a.credit_score ?? '—'}</td>
                 <td><a href="#" data-offer-acc="${esc(a.id)}">Offer</a></td>
               </tr>`).join('') || '<tr><td colspan="6">No one at this grade yet.</td></tr>'}</tbody>`}
        </table></div>
        ${tableFoot()}
      </div>`;
  } else if (onPane === 'field') {
    const hs = listHandoffs();
    app.innerHTML = `${head}
      <p class="ult-lead">Accounts handed from this desk for a field visit.</p>
      <div class="ult-card" data-tbl="col-fo">
        <div class="ss-head"><strong>Handoffs (${hs.length})</strong></div>
        ${tableBar()}
        <div class="ult-table-wrap"><table class="ult-table">
          <thead><tr><th>When</th><th>Customer</th><th>Grade</th><th>From desk</th><th>Note</th><th>Status</th></tr></thead>
          <tbody>${hs.map((h) => `<tr>
            <td>${esc(String(h.at || '').slice(0, 16).replace('T', ' '))}</td>
            <td><a href="#" data-view="${esc(h.account_id)}">${esc(h.name)}</a></td>
            <td>${gradeBadge(h.grade)}</td>
            <td>${esc(h.from_desk || '')}</td>
            <td><div class="col-note">${esc(h.note || '')}</div></td>
            <td>${esc(h.status)}</td>
          </tr>`).join('') || '<tr><td colspan="6">No accounts handed to field yet. Open an account and tap Send to Field Ops.</td></tr>'}</tbody>
        </table></div>
        ${tableFoot()}
      </div>`;
  } else {
    const title = onPane === 'regulars' ? 'Regular payers' : onPane === 'exceptions' ? 'Exceptions / special handling' : 'Collection accounts';
    app.innerHTML = `${head}
      <p class="ult-lead">BuyNowPaysLater Easybuy book. Grade, promises and queues sit on the same account.</p>
      ${filters}
      <div class="ult-card" data-tbl="col-acc">
        <div class="ss-head"><strong>${esc(title)}</strong>
          <button type="button" class="ult-btn ult-btn-primary" id="col-add">+ Account</button></div>
        ${tableBar()}
        <div class="ult-table-wrap"><table class="ult-table">
          <thead><tr><th>Grade</th><th>Customer</th><th>Phone</th><th>Status</th><th>Due ₵</th><th>Last note</th><th>Next</th><th>Attempts</th><th>Agent</th></tr></thead>
          <tbody>${filtered.map((a) => `<tr data-acc="${esc(a.id)}">
            <td>${gradeBadge(a.credit_grade)}</td>
            <td><a href="#" data-view="${esc(a.id)}">${esc(a.name)}</a>${a.regular ? ' <span class="col-pill col-current">regular</span>' : ''}${a.exception ? ' <span class="col-pill col-escalate">exception</span>' : ''}</td>
            <td>${phoneCell(a.phone)}</td>
            <td>${pill(a.status)}</td>
            <td>${esc(dueAmt(a))}</td>
            <td><div class="col-note" title="${esc(a.last_note || '')}">${esc(a.last_note || '')}</div></td>
            <td>${due(a) ? '<strong>' + esc(a.next_follow_up) + '</strong>' : esc(a.next_follow_up || '')}</td>
            <td>${a.attempts || 0}</td>
            <td>${esc(a.agent || '—')}</td>
          </tr>`).join('') || '<tr><td colspan="9">No accounts in this bucket.</td></tr>'}</tbody>
        </table></div>
        ${tableFoot()}
      </div>`;
  }

  if (typeof go === 'function') bindHubTabs(app, go);
  else bindOverflowTabs(app);
  app.querySelectorAll('[data-pane]').forEach((a) => {
    a.onclick = (e) => {
      e.preventDefault();
      setPane(a.dataset.pane);
      paintCollections(app, { navHtml, go });
    };
  });
  app.querySelectorAll('[data-bucket]').forEach((b) => {
    b.onclick = () => {
      const u = new URL(location.href);
      u.searchParams.set('tab', 'collections');
      u.searchParams.set('bucket', b.dataset.bucket);
      history.pushState({ spa: u.pathname + u.search }, '', u.pathname + u.search);
      paintCollections(app, { navHtml, go });
    };
  });
  app.querySelectorAll('[data-ptp-filter]').forEach((b) => {
    b.onclick = () => {
      const u = new URL(location.href);
      u.searchParams.set('tab', 'collections');
      u.searchParams.set('pane', 'ptp');
      u.searchParams.set('ptp', b.dataset.ptpFilter);
      history.pushState({ spa: u.pathname + u.search }, '', u.pathname + u.search);
      paintCollections(app, { navHtml, go });
    };
  });
  app.querySelectorAll('[data-queue]').forEach((b) => {
    b.onclick = (e) => {
      e.preventDefault();
      const u = new URL(location.href);
      u.searchParams.set('tab', 'collections');
      u.searchParams.set('pane', 'queues');
      u.searchParams.set('queue', b.dataset.queue);
      history.pushState({ spa: u.pathname + u.search }, '', u.pathname + u.search);
      paintCollections(app, { navHtml, go });
    };
  });
  app.querySelectorAll('[data-promo]').forEach((b) => {
    b.onclick = () => {
      const u = new URL(location.href);
      u.searchParams.set('tab', 'collections');
      u.searchParams.set('pane', 'offers');
      u.searchParams.set('promo', b.dataset.promo);
      history.pushState({ spa: u.pathname + u.search }, '', u.pathname + u.search);
      paintCollections(app, { navHtml, go });
    };
  });
  const card = app.querySelector('[data-tbl]');
  if (card) bindTable(card, { title: 'Collections', storageKey: 'crm-col-' + onPane });
  const refresh = () => paintCollections(app, { navHtml, go });
  app.querySelectorAll('[data-view]').forEach((a) => {
    a.onclick = (e) => { e.preventDefault(); viewAccount(a.dataset.view, refresh); };
  });
  app.querySelectorAll('[data-log]').forEach((a) => {
    a.onclick = (e) => { e.preventDefault(); logCall(a.dataset.log, refresh); };
  });
  app.querySelector('#col-add')?.addEventListener('click', () => addAccount(refresh));
  app.querySelector('[data-publish]')?.addEventListener('click', async () => {
    const btn = app.querySelector('[data-publish]');
    if (btn) { btn.disabled = true; btn.textContent = 'Publishing…'; }
    try {
      const r = await publishBook();
      ackResult(true, `Published ${r.accounts} accounts and ${r.calls} calls to the live book.`);
    } catch (e) {
      ackResult(false, e?.message || 'Could not publish. Run 113_collections_harden.sql first.');
    }
    refresh();
  });
  app.querySelectorAll('[data-ptp]').forEach((el) => {
    el.onclick = async (e) => {
      e.preventDefault();
      const st = el.dataset.st;
      if (!(await confirmAction(st === 'kept' ? 'Mark this promise kept?' : 'Mark this promise broken?'))) return;
      setPtpStatus(el.dataset.ptp, st);
      ensureOps();
      ackResult(true, st === 'kept' ? 'Promise kept.' : 'Broken promise queued.');
      refresh();
    };
  });
  app.querySelectorAll('[data-offer-acc]').forEach((el) => {
    el.onclick = (e) => { e.preventDefault(); offerPromo(el.dataset.offerAcc, refresh); };
  });
  app.querySelectorAll('[data-off]').forEach((el) => {
    el.onclick = async (e) => {
      e.preventDefault();
      const st = el.dataset.st;
      if (!(await confirmAction(st === 'accepted' ? 'Customer accepted this promotion?' : 'Mark this offer declined?'))) return;
      setOfferStatus(el.dataset.off, st);
      ackResult(true, st === 'accepted' ? 'Promotion accepted — continue on the HP line.' : 'Offer declined.');
      refresh();
    };
  });
  bindDeletes(app, { table: 'collection_accounts', key: ACC_KEY, label: 'this collection account', onDone: refresh });
  const openAcc = new URLSearchParams(location.search).get('acc');
  if (openAcc) viewAccount(openAcc, refresh);
}
