/**
 * Inbound Call Centre — ads, WhatsApp, shop rings.
 * Empty until a real call is logged. Collections stays the partner debt book.
 */
import { esc, uid, readLs, writeLs, saveRow, mergeRows, actMenu, deleteRow } from './ls-rows.js';
import { supabase } from './supabaseClient.js';
import { tableBar, tableFoot } from './accounting.js';
import { bindTable } from './home-tables.js';
import { bindHubTabs, bindOverflowTabs, innerTabs, cyanPill, orangePill, emptyRow, floorNav, tryPaintFloor } from './hub-kit.js';
import { confirmAction, ackResult } from './confirm-action.js';
import { bindDeletes } from './admin-crud.js';
import { todayYmd, gradeBadge, listHandoffs, listEligible, listOffers, addOffer, setOfferStatus, handoffToField, ensureOps, ACC_KEY } from './collection-ops.js';
import { trailForPhone, trailCard } from './hp-trail.js';
import { sortCallsRecent, formatCallWhen } from './call-when.js';

export const CALL_KEY = 'df_cc_calls';
export const CAMP_KEY = 'df_cc_campaigns';
export const AGENT_KEY = 'df_cc_agents';

export const SHIFTS = ['Morning', 'Afternoon', 'Evening', 'Night', 'Rotating'];
export const AGENT_STATUS = [
  { key: 'active', label: 'Active' },
  { key: 'off', label: 'Off duty' },
  { key: 'left', label: 'Left' },
];

export const QUEUES = [
  { key: 'sale', label: 'New sale' },
  { key: 'hp', label: 'HP enquiry' },
  { key: 'order', label: 'Existing order' },
  { key: 'delivery', label: 'Delivery' },
  { key: 'repair', label: 'Repair / warranty' },
  { key: 'complaint', label: 'Complaint' },
  { key: 'transfer', label: 'Transfer to department' },
  { key: 'collect', label: 'Easybuy / collections' },
];

export const WRAP = [
  { key: 'converted', label: 'Converted to sale' },
  { key: 'lead', label: 'Lead created' },
  { key: 'whatsapp', label: 'WhatsApp sent' },
  { key: 'callback', label: 'Callback booked' },
  { key: 'no_sale', label: 'No sale' },
  { key: 'wrong_number', label: 'Wrong number' },
  { key: 'complaint', label: 'Complaint logged' },
  { key: 'transferred', label: 'Transferred' },
];

export const CHANNELS = ['Voice', 'WhatsApp'];
export const SOURCES = ['Facebook', 'TikTok', 'Instagram', 'Google', 'Website', 'Walk-in', 'Referral', 'Other'];

function calls() { return sortCallsRecent(readLs(CALL_KEY, []) || []); }
function camps() { return readLs(CAMP_KEY, []) || []; }
function agents() { return readLs(AGENT_KEY, []) || []; }
function saveCalls(rows) { writeLs(CALL_KEY, rows); }
function saveCamps(rows) { writeLs(CAMP_KEY, rows); }
function saveAgents(rows) { writeLs(AGENT_KEY, rows); }

let hydrated = false;
async function hydrateDesk() {
  if (hydrated) return;
  hydrated = true;
  try {
    const t = await Promise.race([
      supabase.from('call_tickets').select('*').limit(2000),
      new Promise((resolve) => setTimeout(() => resolve({ data: null }), 4000)),
    ]);
    if (t?.data?.length) writeLs(CALL_KEY, mergeRows([t.data, calls()]));
  } catch { /* local */ }
  try {
    const c = await Promise.race([
      supabase.from('call_campaigns').select('*').limit(400),
      new Promise((resolve) => setTimeout(() => resolve({ data: null }), 4000)),
    ]);
    if (c?.data?.length) writeLs(CAMP_KEY, mergeRows([c.data, camps()]));
  } catch { /* local */ }
  try {
    const a = await Promise.race([
      supabase.from('call_agents').select('*').limit(400),
      new Promise((resolve) => setTimeout(() => resolve({ data: null }), 4000)),
    ]);
    if (a?.data?.length) writeLs(AGENT_KEY, mergeRows([a.data, agents()]));
  } catch { /* local */ }
}

function ghWa(phone) {
  const d = String(phone || '').replace(/\D/g, '');
  if (!d) return '';
  const intl = d.startsWith('0') ? `233${d.slice(1)}` : (d.startsWith('233') ? d : `233${d}`);
  return `https://wa.me/${intl}`;
}
function last9(p) { return String(p || '').replace(/\D/g, '').slice(-9); }
function phoneCell(p) {
  if (!p) return '—';
  const wa = ghWa(p);
  return `<a href="tel:${esc(p)}">${esc(p)}</a>${wa ? ` · <a href="${esc(wa)}" target="_blank" rel="noopener">WhatsApp</a>` : ''}`;
}
function queueLabel(k) { return QUEUES.find((q) => q.key === k)?.label || k || '—'; }
function wrapLabel(k) { return WRAP.find((w) => w.key === k)?.label || k || '—'; }
function statusLabel(k) { return AGENT_STATUS.find((s) => s.key === k)?.label || k || 'Active'; }
function who() {
  try {
    const a = JSON.parse(localStorage.getItem('df_auth') || 'null');
    return a?.full_name || a?.name || a?.email || a?.user?.email || '';
  } catch { return ''; }
}
function matchAgent(ticket, agent) {
  if (!ticket || !agent) return false;
  if (ticket.agent_id && String(ticket.agent_id) === String(agent.id)) return true;
  const n = String(ticket.agent || '').trim().toLowerCase();
  return n && n === String(agent.name || '').trim().toLowerCase();
}
function agentStats(agent) {
  const mine = calls().filter((c) => matchAgent(c, agent));
  return {
    n: mine.length,
    missed: mine.filter((c) => c.status === 'missed' || c.status === 'abandoned').length,
    cb: mine.filter((c) => c.status === 'callback').length,
    conv: mine.filter((c) => c.wrap === 'converted').length,
  };
}
function agentSelect(selected) {
  const list = agents().filter((a) => a.status !== 'left');
  const cur = String(selected || '').trim();
  if (!list.length) {
    return `<input name="agent" value="${esc(cur || who())}" placeholder="Onboard agents on the Agents tab" />`;
  }
  const hit = list.some((a) => a.name === cur || a.id === cur);
  return `<select name="agent">
    <option value="">— Call Centre agent —</option>
    ${list.map((a) => `<option value="${esc(a.name)}" data-id="${esc(a.id)}" ${(a.name === cur || a.id === cur) ? 'selected' : ''}>${esc(a.name)}${a.extension ? ' · x' + esc(a.extension) : ''}</option>`).join('')}
    ${cur && !hit ? `<option value="${esc(cur)}" selected>${esc(cur)}</option>` : ''}
  </select>`;
}
function gradeForPhone(phone) {
  const d = last9(phone);
  if (!d) return '';
  const accs = readLs('df_collection_accounts', []) || [];
  const hit = accs.find((a) => last9(a.phone) === d);
  return hit?.credit_grade || '';
}

function css() {
  if (document.getElementById('cc-desk-css')) return;
  const s = document.createElement('style');
  s.id = 'cc-desk-css';
  s.textContent = `
    .cc-kpis{display:grid;grid-template-columns:repeat(5,minmax(0,1fr));gap:10px;margin:12px 0 16px}
    @media(max-width:1100px){.cc-kpis{grid-template-columns:1fr 1fr 1fr}}
    @media(max-width:640px){.cc-kpis{grid-template-columns:1fr 1fr}}
    .cc-pill{display:inline-block;border-radius:999px;padding:2px 8px;font-size:11px;font-weight:700;white-space:nowrap}
    .cc-open,.cc-answered{background:#e0f2fe;color:#075985}
    .cc-missed,.cc-abandoned{background:#fee2e2;color:#991b1b}
    .cc-callback{background:#fef3c7;color:#92400e}
    .cc-done{background:#d1fae5;color:#065f46}
    .cc-active{background:#d1fae5;color:#065f46}
    .cc-off{background:#fef3c7;color:#92400e}
    .cc-left{background:#e2e8f0;color:#334155}
    .cc-voice{background:#e0e7ff;color:#3730a3}
    .cc-whatsapp{background:#d1fae5;color:#065f46}
    .cc-filters{display:flex;flex-wrap:wrap;gap:6px;margin:0 0 12px}
    .cc-filters button{border:1px solid #cbd5e1;background:#fff;border-radius:999px;padding:4px 10px;font-size:12px;font-weight:700;cursor:pointer}
    .cc-filters button.on{background:#1d4ed8;color:#fff;border-color:#1d4ed8}
    .cc-q{display:block;text-decoration:none;color:inherit;background:#fff;border:1px solid #e2e8f0;border-radius:12px;padding:12px 14px}
    .cc-q.on,.cc-q:hover{border-color:#1d4ed8}
    .cc-q b{display:block;font-size:22px}
    .cc-queues{display:grid;grid-template-columns:repeat(auto-fill,minmax(150px,1fr));gap:8px;margin:0 0 14px}
    .cc-note{max-width:240px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;color:#334155}
    .cc-drawer{position:fixed;inset:0;background:rgba(15,23,42,.45);z-index:14000;display:flex;justify-content:flex-end}
    .cc-drawer-card{width:min(480px,100%);background:#fff;height:100%;overflow:auto;padding:20px 22px 40px;box-shadow:-12px 0 40px rgba(0,0,0,.2)}
    .cc-form label{display:block;font-size:12px;font-weight:700;margin:10px 0 4px;text-align:left}
    .cc-form input,.cc-form select,.cc-form textarea{width:100%;box-sizing:border-box;border:1px solid #cbd5e1;border-radius:8px;padding:8px 10px;font:inherit}
    .cc-form textarea{min-height:80px}
    .col-grade{display:inline-flex;align-items:center;justify-content:center;width:28px;height:28px;border-radius:8px;font-weight:800;font-size:13px}
    .col-g-A{background:#d1fae5;color:#065f46}
    .col-g-B{background:#e0f2fe;color:#075985}
    .col-g-C{background:#fef3c7;color:#92400e}
    .col-g-D{background:#ffedd5;color:#9a3412}
    .col-g-E{background:#fee2e2;color:#991b1b}
  `;
  document.head.appendChild(s);
}

function pill(st) {
  return `<span class="cc-pill cc-${esc(st || 'open')}">${esc(st || 'open')}</span>`;
}

export function callCenterFollowups() {
  const today = todayYmd();
  return calls().filter((c) => ['missed', 'callback', 'abandoned'].includes(c.status) && c.status !== 'done').map((c) => {
    const when = c.callback_on || c.called_on || '';
    return {
      id: c.id,
      contact: c.name || c.phone || 'Unknown',
      phone: c.phone || '',
      cat: 'Call Centre',
      status: c.status === 'callback' ? 'Scheduled' : 'Open',
      user: c.agent || 'Call Centre',
      when,
      dueToday: when && when <= today,
      source: 'calls',
      note: c.note || '',
      credit_grade: c.grade || '',
    };
  });
}

function pane() {
  const q = new URLSearchParams(location.search);
  const t = q.get('pane') || q.get('tab') || 'inbox';
  return ['inbox', 'missed', 'queues', 'campaigns', 'agents', 'complaints', 'field', 'hp'].includes(t) ? t : 'inbox';
}
function setPane(p) {
  const u = new URL(location.href);
  u.searchParams.delete('tab');
  if (p && p !== 'inbox') u.searchParams.set('pane', p);
  else u.searchParams.delete('pane');
  const next = u.pathname + u.search;
  history.pushState({ spa: next }, '', next);
  try { sessionStorage.setItem('df_last_path', next); } catch { /* ignore */ }
}

function openDrawer(html) {
  document.getElementById('cc-drawer')?.remove();
  const wrap = document.createElement('div');
  wrap.id = 'cc-drawer';
  wrap.className = 'cc-drawer';
  wrap.innerHTML = `<div class="cc-drawer-card">${html}</div>`;
  wrap.addEventListener('click', (e) => { if (e.target === wrap) wrap.remove(); });
  document.body.appendChild(wrap);
  wrap.querySelector('[data-close]')?.addEventListener('click', () => wrap.remove());
  return wrap;
}

function kpis(rows) {
  const today = todayYmd();
  const day = rows.filter((c) => c.called_on === today);
  const missed = rows.filter((c) => c.status === 'missed' || c.status === 'abandoned');
  const cb = rows.filter((c) => c.status === 'callback');
  const conv = rows.filter((c) => c.wrap === 'converted');
  const hp = rows.filter((c) => c.queue === 'hp');
  return `<div class="cc-kpis">
    ${cyanPill('cal', 'Today', day.length)}
    ${orangePill('target', 'Missed / abandoned', missed.length)}
    ${orangePill('clock', 'Callbacks', cb.length)}
    ${cyanPill('check', 'Converted', conv.length)}
    ${cyanPill('spark', 'HP enquiries', hp.length)}
  </div>`;
}

function crmBlob() {
  try {
    const v = JSON.parse(localStorage.getItem('df_crm_hub_v1') || 'null');
    if (v && typeof v === 'object' && !Array.isArray(v)) return v;
  } catch { /* ignore */ }
  return { leads: [], followups: [], campaigns: [] };
}
function saveCrm(d) {
  try { localStorage.setItem('df_crm_hub_v1', JSON.stringify(d)); } catch { /* ignore */ }
}

async function convertToLead(call, { quiet } = {}) {
  const d = crmBlob();
  if (!Array.isArray(d.leads)) d.leads = [];
  if (d.leads.some((l) => l.from_call === call.id || (last9(l.phone) && last9(l.phone) === last9(call.phone)))) {
    if (!quiet) ackResult(true, 'Already on the leads book.');
    return;
  }
  d.leads.unshift({
    id: 'ld-' + uid().slice(0, 10),
    name: call.name || call.phone || 'Inbound caller',
    company: '',
    phone: call.phone || '',
    source: call.campaign_name || call.source || 'Call Centre',
    stage: 'New',
    owner: call.agent || who() || 'Call Centre',
    value: 0,
    from_call: call.id,
  });
  saveCrm(d);
  const next = calls().map((c) => c.id === call.id ? { ...c, wrap: c.wrap || 'lead', lead_id: d.leads[0].id } : c);
  saveCalls(next);
  try { await saveRow('call_tickets', CALL_KEY, next.find((c) => c.id === call.id)); } catch { /* ignore */ }
  if (!quiet) ackResult(true, 'Lead created from this call.');
}

function logForm(existing) {
  const c = existing || {};
  const campOpts = camps().filter((x) => x.status !== 'ended').map((x) =>
    `<option value="${esc(x.id)}" ${c.campaign_id === x.id ? 'selected' : ''}>${esc(x.name)}</option>`).join('');
  return `<form class="cc-form" id="cc-log">
    <label>Direction</label>
    <select name="direction">
      <option value="in" ${c.direction !== 'out' ? 'selected' : ''}>Inbound</option>
      <option value="out" ${c.direction === 'out' ? 'selected' : ''}>Outbound</option>
    </select>
    <label>Channel</label>
    <select name="channel">${CHANNELS.map((ch) =>
      `<option ${String(c.channel || 'Voice') === ch ? 'selected' : ''}>${ch}</option>`).join('')}</select>
    <label>Phone</label>
    <input name="phone" required placeholder="024XXXXXXX" value="${esc(c.phone || '')}" />
    <label>Name</label>
    <input name="name" placeholder="If they gave a name" value="${esc(c.name || '')}" />
    <label>Campaign</label>
    <select name="campaign_id">
      <option value="">— None / unknown —</option>
      ${campOpts}
    </select>
    <label>Source</label>
    <select name="source">${SOURCES.map((s) =>
      `<option ${String(c.source || '') === s ? 'selected' : ''}>${s}</option>`).join('')}</select>
    <label>Queue</label>
    <select name="queue">${QUEUES.map((q) =>
      `<option value="${q.key}" ${c.queue === q.key ? 'selected' : ''}>${esc(q.label)}</option>`).join('')}</select>
    <label>Result of the ring</label>
    <select name="status">
      <option value="open" ${!c.status || c.status === 'open' ? 'selected' : ''}>Answered</option>
      <option value="missed" ${c.status === 'missed' ? 'selected' : ''}>Missed</option>
      <option value="abandoned" ${c.status === 'abandoned' ? 'selected' : ''}>Abandoned</option>
      <option value="callback" ${c.status === 'callback' ? 'selected' : ''}>Callback booked</option>
      <option value="done" ${c.status === 'done' ? 'selected' : ''}>Closed</option>
    </select>
    <label>Wrap-up</label>
    <select name="wrap">
      <option value="">— After the call —</option>
      ${WRAP.map((w) => `<option value="${w.key}" ${c.wrap === w.key ? 'selected' : ''}>${esc(w.label)}</option>`).join('')}
    </select>
    <label>Transfer to</label>
    <select name="transfer_to">
      <option value="">— Stay on this desk —</option>
      <option ${c.transfer_to==='sales'?'selected':''}>sales</option>
      <option ${c.transfer_to==='repairs'?'selected':''}>repairs</option>
      <option ${c.transfer_to==='delivery'?'selected':''}>delivery</option>
      <option ${c.transfer_to==='accounts'?'selected':''}>accounts</option>
      <option ${c.transfer_to==='collections'?'selected':''}>collections</option>
      <option value="field" ${c.transfer_to==='field'?'selected':''}>field</option>
      <option ${c.transfer_to==='hrm'?'selected':''}>hrm</option>
    </select>
    <label>Callback date</label>
    <input name="callback_on" type="date" value="${esc(c.callback_on || '')}" />
    <label>Note</label>
    <textarea name="note" placeholder="What they asked">${esc(c.note || '')}</textarea>
    <label>Call Centre agent</label>
    ${agentSelect(c.agent || c.agent_id || who())}
    <button type="submit" class="ult-btn ult-btn-primary" style="margin-top:14px;width:100%">${existing ? 'Save ticket' : 'Log call'}</button>
    <button type="button" class="ult-btn" data-close style="margin-top:8px;width:100%">Cancel</button>
  </form>`;
}

function readTicket(fd, existing) {
  const now = new Date();
  const ymd = todayYmd();
  const tm = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;
  const phone = String(fd.get('phone') || '').trim();
  const campId = String(fd.get('campaign_id') || '');
  const camp = camps().find((x) => x.id === campId);
  let status = String(fd.get('status') || 'open');
  const wrap = String(fd.get('wrap') || '');
  if (wrap === 'callback' && status === 'open') status = 'callback';
  if (wrap === 'converted' || wrap === 'no_sale' || wrap === 'wrong_number') status = 'done';
  return {
    ...(existing || {}),
    id: existing?.id || 'cc-' + uid().slice(0, 10),
    direction: String(fd.get('direction') || 'in'),
    channel: String(fd.get('channel') || 'Voice'),
    phone,
    name: String(fd.get('name') || '').trim(),
    campaign_id: campId,
    campaign_name: camp?.name || '',
    source: String(fd.get('source') || camp?.channel || ''),
    queue: String(fd.get('queue') || 'sale'),
    status,
    wrap,
    callback_on: String(fd.get('callback_on') || '') || (status === 'callback' ? ymd : ''),
    note: String(fd.get('note') || '').trim(),
    agent: String(fd.get('agent') || who()),
    agent_id: agents().find((a) => a.name === String(fd.get('agent') || '') || a.id === String(fd.get('agent') || ''))?.id || existing?.agent_id || '',
    transfer_to: String(fd.get('transfer_to') || ''),
    grade: gradeForPhone(phone),
    called_on: existing?.called_on || ymd,
    called_at: existing?.called_at || tm,
    at: existing?.at || now.toISOString(),
    updated_at: now.toISOString(),
  };
}

function openLog(existing, onPaint) {
  const wrap = openDrawer(`
    <h2 style="margin:0 0 8px">${existing ? 'Call ticket' : 'Log inbound call'}</h2>
    <p class="ult-muted">Ads, WhatsApp and shop rings. Collections cash stays with the partner desk.</p>
    <div id="hp-trail-slot"></div>
    ${logForm(existing)}
  `);
  const fillTrail = (phone) => {
    if (!phone) return;
    trailForPhone(phone).then((t) => {
      const slot = wrap.querySelector('#hp-trail-slot');
      if (slot) slot.innerHTML = trailCard(t);
      const name = wrap.querySelector('input[name="name"]');
      if (name && !name.value && t.name) name.value = t.name;
    }).catch(() => {});
  };
  if (existing?.phone) fillTrail(existing.phone);
  wrap.querySelector('input[name="phone"]')?.addEventListener('blur', (e) => fillTrail(e.target.value));
  wrap.querySelector('#cc-log').onsubmit = async (e) => {
    e.preventDefault();
    const row = readTicket(new FormData(e.target), existing);
    if (!(await confirmAction(existing ? 'Save this ticket?' : 'Log this call?', row.phone + (row.name ? ' · ' + row.name : '')))) return;
    const next = existing
      ? calls().map((c) => c.id === row.id ? row : c)
      : [row, ...calls()];
    saveCalls(next);
    if (row.campaign_id && !existing) {
      saveCamps(camps().map((c) => c.id === row.campaign_id ? { ...c, reach: Number(c.reach || 0) + 1 } : c));
    }
    try { await saveRow('call_tickets', CALL_KEY, row); } catch { /* ignore */ }
    if (row.wrap === 'lead') await convertToLead(row, { quiet: true });
    const dest = String(row.transfer_to || '').toLowerCase();
    if (dest === 'field') {
      try {
        try { ensureOps(); } catch { /* ignore */ }
        const d = String(row.phone || '').replace(/\D/g, '').slice(-9);
        const acc = (readLs(ACC_KEY, []) || []).find((a) => String(a.phone || '').replace(/\D/g, '').slice(-9) === d);
        if (acc) handoffToField(acc, { note: row.note, from_desk: 'Call Centre', agent: row.agent });
      } catch { /* book optional */ }
    }
    wrap.remove();
    ackResult(true, existing ? 'Ticket saved.' : 'Call logged.');
    onPaint?.();
  };
}

function openCampaign(existing, onPaint) {
  const c = existing || {};
  const wrap = openDrawer(`
    <h2 style="margin:0 0 8px">${existing ? 'Edit campaign' : 'New campaign'}</h2>
    <form class="cc-form" id="cc-camp">
      <label>Name</label>
      <input name="name" required placeholder="TikTok HP April" value="${esc(c.name || '')}" />
      <label>Channel</label>
      <select name="channel">${SOURCES.map((s) =>
        `<option ${String(c.channel || 'TikTok') === s ? 'selected' : ''}>${s}</option>`).join('')}</select>
      <label>Tracking code / unique WhatsApp</label>
      <input name="code" placeholder="Optional" value="${esc(c.code || '')}" />
      <label>Status</label>
      <select name="status">
        <option value="live" ${c.status !== 'paused' && c.status !== 'ended' ? 'selected' : ''}>Live</option>
        <option value="paused" ${c.status === 'paused' ? 'selected' : ''}>Paused</option>
        <option value="ended" ${c.status === 'ended' ? 'selected' : ''}>Ended</option>
      </select>
      <button type="submit" class="ult-btn ult-btn-primary" style="margin-top:14px;width:100%">Save campaign</button>
      <button type="button" class="ult-btn" data-close style="margin-top:8px;width:100%">Cancel</button>
    </form>
  `);
  wrap.querySelector('#cc-camp').onsubmit = async (e) => {
    e.preventDefault();
    const fd = new FormData(e.target);
    if (!(await confirmAction(existing ? 'Save this campaign?' : 'Add this campaign?'))) return;
    const row = {
      ...(existing || {}),
      id: existing?.id || 'cmp-' + uid().slice(0, 10),
      name: String(fd.get('name') || '').trim(),
      channel: String(fd.get('channel') || ''),
      code: String(fd.get('code') || '').trim(),
      status: String(fd.get('status') || 'live'),
      reach: existing?.reach || 0,
      converted: existing?.converted || 0,
      created_at: existing?.created_at || new Date().toISOString(),
    };
    const next = existing ? camps().map((x) => x.id === row.id ? row : x) : [row, ...camps()];
    saveCamps(next);
    try { await saveRow('call_campaigns', CAMP_KEY, row); } catch { /* ignore */ }
    wrap.remove();
    ackResult(true, 'Campaign saved.');
    onPaint?.();
  };
}

function queueChecks(selected) {
  const picked = new Set(String(selected || '').split(/[,|]/).map((s) => s.trim()).filter(Boolean));
  return QUEUES.map((q) => `<label style="display:inline-flex;gap:6px;align-items:center;margin:0 10px 6px 0;font-weight:600">
    <input type="checkbox" name="queues" value="${esc(q.key)}" ${picked.has(q.key) ? 'checked' : ''} /> ${esc(q.label)}
  </label>`).join('');
}

function openAgent(existing, onPaint, { viewOnly = false } = {}) {
  const a = existing || {};
  const st = agentStats(a);
  const wrap = openDrawer(`
    <h2 style="margin:0 0 8px">${viewOnly ? 'Call Centre agent' : (existing ? 'Edit Call Centre agent' : 'Onboard Call Centre agent')}</h2>
    ${viewOnly ? `<dl class="cc-form" style="display:grid;grid-template-columns:120px 1fr;gap:8px 12px">
      <dt>Name</dt><dd>${esc(a.name || '—')}</dd>
      <dt>Phone</dt><dd>${phoneCell(a.phone)}</dd>
      <dt>Email</dt><dd>${esc(a.email || '—')}</dd>
      <dt>Extension</dt><dd>${esc(a.extension || '—')}</dd>
      <dt>Shift</dt><dd>${esc(a.shift || '—')}</dd>
      <dt>Queues</dt><dd>${esc((String(a.queues || '').split(/[,|]/).map((k) => queueLabel(k.trim())).filter(Boolean).join(', ')) || '—')}</dd>
      <dt>Status</dt><dd>${esc(statusLabel(a.status))}</dd>
      <dt>Started</dt><dd>${esc(a.start_date || '—')}</dd>
      <dt>Calls</dt><dd>${st.n} · missed ${st.missed} · callbacks ${st.cb} · converted ${st.conv}</dd>
      <dt>Note</dt><dd>${esc(a.note || '—')}</dd>
    </dl>
    <button type="button" class="ult-btn ult-btn-primary" data-edit style="margin-top:14px;width:100%">Edit</button>
    <button type="button" class="ult-btn" data-close style="margin-top:8px;width:100%">Close</button>` : `<form class="cc-form" id="cc-agent">
      <label>Full name</label>
      <input name="name" required placeholder="Desk name" value="${esc(a.name || '')}" />
      <label>Phone</label>
      <input name="phone" placeholder="024XXXXXXX" value="${esc(a.phone || '')}" />
      <label>Email</label>
      <input name="email" type="email" value="${esc(a.email || '')}" />
      <label>Desk extension</label>
      <input name="extension" placeholder="e.g. 104" value="${esc(a.extension || '')}" />
      <label>Shift</label>
      <select name="shift">${SHIFTS.map((s) => `<option ${String(a.shift || 'Morning') === s ? 'selected' : ''}>${s}</option>`).join('')}</select>
      <label>Queues they cover</label>
      <div>${queueChecks(a.queues)}</div>
      <label>Status</label>
      <select name="status">${AGENT_STATUS.map((s) => `<option value="${s.key}" ${String(a.status || 'active') === s.key ? 'selected' : ''}>${esc(s.label)}</option>`).join('')}</select>
      <label>Start date</label>
      <input name="start_date" type="date" value="${esc(a.start_date || todayYmd())}" />
      <label>Note</label>
      <textarea name="note">${esc(a.note || '')}</textarea>
      <button type="submit" class="ult-btn ult-btn-primary" style="margin-top:14px;width:100%">${existing ? 'Save agent' : 'Onboard agent'}</button>
      <button type="button" class="ult-btn" data-close style="margin-top:8px;width:100%">Cancel</button>
    </form>`}
  `);
  wrap.querySelector('[data-edit]')?.addEventListener('click', () => {
    wrap.remove();
    openAgent(existing, onPaint, { viewOnly: false });
  });
  const form = wrap.querySelector('#cc-agent');
  if (!form) return;
  form.onsubmit = async (e) => {
    e.preventDefault();
    const fd = new FormData(e.target);
    const queues = [...form.querySelectorAll('input[name="queues"]:checked')].map((i) => i.value).join(',');
    if (!(await confirmAction(existing ? 'Save this Call Centre agent?' : 'Onboard this Call Centre agent?', String(fd.get('name') || '')))) return;
    const row = {
      ...(existing || {}),
      id: existing?.id || 'cca-' + uid().slice(0, 10),
      kind: 'call_centre',
      name: String(fd.get('name') || '').trim(),
      phone: String(fd.get('phone') || '').trim(),
      email: String(fd.get('email') || '').trim(),
      extension: String(fd.get('extension') || '').trim(),
      shift: String(fd.get('shift') || 'Morning'),
      queues,
      status: String(fd.get('status') || 'active'),
      start_date: String(fd.get('start_date') || ''),
      note: String(fd.get('note') || '').trim(),
      created_at: existing?.created_at || new Date().toISOString(),
    };
    const next = existing ? agents().map((x) => x.id === row.id ? row : x) : [row, ...agents()];
    saveAgents(next);
    try { await saveRow('call_agents', AGENT_KEY, row); } catch { /* ignore */ }
    wrap.remove();
    ackResult(true, existing ? 'Agent saved.' : 'Call Centre agent onboarded.');
    onPaint?.();
  };
}

function listForPane(onPane, queueFilter) {
  let rows = calls();
  if (onPane === 'missed') rows = rows.filter((c) => c.status === 'missed' || c.status === 'abandoned' || c.status === 'callback');
  if (onPane === 'queues' && queueFilter && queueFilter !== 'all') rows = rows.filter((c) => c.queue === queueFilter);
  if (onPane === 'complaints') rows = rows.filter((c) => c.queue === 'complaint' || c.wrap === 'complaint');
  return sortCallsRecent(rows);
}

function callRow(c) {
  return `<tr data-id="${esc(c.id)}">
    <td data-nosort="1">${actMenu(c.id, [
      { act: 'view', label: 'View' },
      { act: 'edit', label: 'Edit' },
      { act: 'del', label: 'Delete' },
    ])}</td>
    <td>${esc(formatCallWhen(c))}</td>
    <td>${c.grade ? gradeBadge(c.grade) : '—'}</td>
    <td><a href="#" data-view="${esc(c.id)}">${esc(c.name || c.phone || 'Unknown')}</a></td>
    <td>${phoneCell(c.phone)}</td>
    <td><span class="cc-pill cc-${esc(String(c.channel || 'voice').toLowerCase())}">${esc(c.channel || 'Voice')}</span></td>
    <td>${esc(c.campaign_name || c.source || '—')}</td>
    <td>${esc(queueLabel(c.queue))}</td>
    <td>${pill(c.status)}</td>
    <td>${esc(wrapLabel(c.wrap))}</td>
    <td>${esc(c.agent || '—')}</td>
  </tr>`;
}

export async function paintCallCenter(app, { navHtml = '', go, forcePane } = {}) {
  css();
  await hydrateDesk();
  const tabQ = new URLSearchParams(location.search).get('tab') || '';
  const floorGo = (k) => {
    if (typeof go === 'function' && k && !['topics', 'reports', 'setup', 'inbox'].includes(k)) {
      const u = new URL('/call-centre.html', location.origin);
      if (k !== 'inbox') u.searchParams.set('pane', k);
      history.pushState({ spa: u.pathname + u.search }, '', u.pathname + u.search);
      return paintCallCenter(app, { navHtml, go, forcePane: k });
    }
    const u = new URL('/call-centre.html', location.origin);
    if (k && k !== 'inbox') u.searchParams.set('tab', k);
    history.pushState({ spa: u.pathname + u.search }, '', u.pathname + u.search);
    return paintCallCenter(app, { navHtml, go });
  };
  if (tryPaintFloor(app, tabQ || (forcePane && forcePane !== 'inbox' ? forcePane : 'inbox'), {
    brand: 'Call Centre',
    file: '/call-centre.html',
    go: floorGo,
  })) return;
  const onPane = forcePane || pane();
  const qFilter = new URLSearchParams(location.search).get('queue') || 'all';
  const rows = listForPane(onPane, qFilter);
  const head = `${navHtml}${floorNav('Call Centre', onPane, 'inbox', '/call-centre.html')}<h1 class="hub-h1">Call Centre</h1>
    ${kpis(calls())}`;

  if (onPane === 'campaigns') {
    const list = camps();
    app.innerHTML = `${head}
      <div class="ult-card" data-tbl="cc-camp">
        <div class="ss-head"><strong>Campaigns (${list.length})</strong>
          <button type="button" class="ult-btn ult-btn-primary add" id="cc-add-camp" data-add>+ Campaign</button></div>
        ${tableBar()}
        <div class="ult-table-wrap"><table class="ult-table">
          <thead><tr><th>Action</th><th>Name</th><th>Channel</th><th>Code</th><th>Status</th><th>Calls</th></tr></thead>
          <tbody>${list.map((c) => `<tr data-id="${esc(c.id)}">
            <td>${actMenu(c.id, [
              { act: 'view', label: 'View' },
              { act: 'edit', label: 'Edit' },
              { act: 'del', label: 'Delete' },
            ])}</td>
            <td><a href="#" data-camp="${esc(c.id)}">${esc(c.name)}</a></td>
            <td>${esc(c.channel || '—')}</td>
            <td>${esc(c.code || '—')}</td>
            <td>${pill(c.status)}</td>
            <td>${Number(c.reach || 0)}</td>
          </tr>`).join('') || emptyRow(6, 'No campaigns yet. Add the ad you are running, then log calls against it.')}</tbody>
        </table></div>
        ${tableFoot()}
      </div>`;
  } else if (onPane === 'agents') {
    const list = agents();
    app.innerHTML = `${head}
      <div class="ult-card" data-tbl="cc-ag">
        <div class="ss-head"><strong>Call Centre agents (${list.length})</strong>
          <button type="button" class="ult-btn ult-btn-primary add" id="cc-add-agent" data-add>+ Onboard agent</button></div>
        ${tableBar()}
        <div class="ult-table-wrap"><table class="ult-table">
          <thead><tr><th>Action</th><th>Agent</th><th>Extension</th><th>Shift</th><th>Queues</th><th>Status</th><th>Calls</th><th>Missed</th><th>Callbacks</th><th>Converted</th></tr></thead>
          <tbody>${list.map((u) => {
            const st = agentStats(u);
            const qs = String(u.queues || '').split(/[,|]/).map((k) => queueLabel(k.trim())).filter((x) => x && x !== '—').join(', ');
            return `<tr data-id="${esc(u.id)}">
            <td>${actMenu(u.id, [
              { act: 'view', label: 'View' },
              { act: 'edit', label: 'Edit' },
              { act: 'del', label: 'Delete' },
            ])}</td>
            <td><a href="#" data-agent="${esc(u.id)}">${esc(u.name)}</a></td>
            <td>${esc(u.extension || '—')}</td>
            <td>${esc(u.shift || '—')}</td>
            <td>${esc(qs || '—')}</td>
            <td>${pill(u.status || 'active')}</td>
            <td>${st.n}</td><td>${st.missed}</td><td>${st.cb}</td><td>${st.conv}</td>
          </tr>`;
          }).join('') || emptyRow(10, 'No Call Centre agents yet. Use + ADD to onboard a desk agent.')}</tbody>
        </table></div>
        ${tableFoot()}
      </div>`;
  } else if (onPane === 'field') {
    try { ensureOps(); } catch { /* ignore */ }
    const hs = listHandoffs();
    app.innerHTML = `${head}
      <p class="ult-lead">Field visits are raised from this floor. Log a call and transfer to Field, or send an Easybuy account from here.</p>
      <div class="ult-card" data-tbl="cc-fo">
        <div class="ss-head"><strong>Handoffs (${hs.length})</strong></div>
        ${tableBar()}
        <div class="ult-table-wrap"><table class="ult-table">
          <thead><tr><th>When</th><th>Customer</th><th>Phone</th><th>Grade</th><th>From desk</th><th>Note</th><th>Status</th></tr></thead>
          <tbody>${hs.map((h) => `<tr>
            <td>${esc(String(h.at || '').slice(0, 16).replace('T', ' '))}</td>
            <td>${esc(h.name || '—')}</td>
            <td>${phoneCell(h.phone)}</td>
            <td>${gradeBadge(h.grade)}</td>
            <td>${esc(h.from_desk || 'Call Centre')}</td>
            <td><div class="cc-note" title="${esc(h.note || '')}">${esc(h.note || '')}</div></td>
            <td>${esc(h.status || 'open')}</td>
          </tr>`).join('') || emptyRow(7, 'No field handoffs yet. On a call ticket, transfer to Field.')}</tbody>
        </table></div>
        ${tableFoot()}
      </div>`;
  } else if (onPane === 'hp') {
    try { ensureOps(); } catch { /* ignore */ }
    const kind = new URLSearchParams(location.search).get('promo') || 'appliance';
    const offered = listOffers('all');
    const eligible = kind === 'offered' ? [] : listEligible(kind === 'handset' ? 'next_handset' : 'appliance');
    const showOffers = kind === 'offered';
    app.innerHTML = `${head}
      <p class="ult-lead">Collections records the book. This floor channels hire-purchase promotions.</p>
      <div class="cc-filters">
        <button type="button" data-promo="appliance" class="${kind === 'appliance' ? 'on' : ''}">Appliance eligible</button>
        <button type="button" data-promo="handset" class="${kind === 'handset' ? 'on' : ''}">Next handset</button>
        <button type="button" data-promo="offered" class="${kind === 'offered' ? 'on' : ''}">Offers made</button>
      </div>
      <div class="ult-card" data-tbl="cc-hp">
        <div class="ss-head"><strong>${showOffers ? 'Offers recorded' : 'Eligible customers'} (${showOffers ? offered.length : eligible.length})</strong></div>
        ${tableBar()}
        <div class="ult-table-wrap"><table class="ult-table">
          ${showOffers
            ? `<thead><tr><th>When</th><th>Grade</th><th>Customer</th><th>Promotion</th><th>Status</th></tr></thead>
               <tbody>${offered.map((o) => `<tr>
                 <td>${esc(o.offered_on || '')}</td>
                 <td>${gradeBadge(o.grade)}</td>
                 <td>${esc(o.name)}</td>
                 <td>${esc(o.title || o.product || '')}</td>
                 <td>${esc(o.status)}</td>
               </tr>`).join('') || emptyRow(5, 'No promotions recorded yet.')}</tbody>`
            : `<thead><tr><th>Grade</th><th>Customer</th><th>Phone</th><th>Eligible for</th><th>Score</th></tr></thead>
               <tbody>${eligible.map((a) => `<tr>
                 <td>${gradeBadge(a.credit_grade)}</td>
                 <td>${esc(a.name)}</td>
                 <td>${phoneCell(a.phone)}</td>
                 <td>${esc(a.promo_label || '')}</td>
                 <td>${a.credit_score ?? '—'}</td>
               </tr>`).join('') || emptyRow(5, 'No one at this grade yet.')}</tbody>`}
        </table></div>
        ${tableFoot()}
      </div>`;
  } else if (onPane === 'queues') {
    app.innerHTML = `${head}
      <div class="cc-queues">${QUEUES.map((q) => {
        const n = calls().filter((c) => c.queue === q.key).length;
        return `<a class="cc-q ${qFilter === q.key ? 'on' : ''}" href="/call-centre.html?pane=queues&queue=${q.key}" data-queue="${q.key}">
          <span>${esc(q.label)}</span><b>${n}</b></a>`;
      }).join('')}
      <a class="cc-q ${qFilter === 'all' ? 'on' : ''}" href="/call-centre.html?pane=queues" data-queue="all"><span>All queues</span><b>${calls().length}</b></a>
      </div>
      <div class="ult-card" data-tbl="cc-q">
        <div class="ss-head"><strong>${esc(queueLabel(qFilter === 'all' ? '' : qFilter) || 'All queues')} (${rows.length})</strong>
          <button type="button" class="ult-btn ult-btn-primary add" id="cc-add" data-add>+ Log call</button></div>
        ${tableBar()}
        <div class="ult-table-wrap"><table class="ult-table">
          <thead><tr><th>Action</th><th>When</th><th>Grade</th><th>Caller</th><th>Phone</th><th>Channel</th><th>Campaign</th><th>Queue</th><th>Status</th><th>Wrap-up</th><th>Agent</th></tr></thead>
          <tbody>${rows.map(callRow).join('') || emptyRow(11, 'No calls in this queue.')}</tbody>
        </table></div>
        ${tableFoot()}
      </div>`;
  } else {
    const title = onPane === 'missed' ? 'Missed / callback' : onPane === 'complaints' ? 'Complaints' : 'Inbox';
    const empty = onPane === 'missed'
      ? 'No missed calls or booked callbacks.'
      : onPane === 'complaints'
        ? 'No complaints logged.'
        : 'No inbound calls yet. Log the first ring from an ad or WhatsApp.';
    app.innerHTML = `${head}
      <div class="ult-card" data-tbl="cc-in">
        <div class="ss-head"><strong>${title} (${rows.length})</strong>
          <button type="button" class="ult-btn ult-btn-primary add" id="cc-add" data-add>+ Log call</button></div>
        ${tableBar()}
        <div class="ult-table-wrap"><table class="ult-table">
          <thead><tr><th>Action</th><th>When</th><th>Grade</th><th>Caller</th><th>Phone</th><th>Channel</th><th>Campaign</th><th>Queue</th><th>Status</th><th>Wrap-up</th><th>Agent</th></tr></thead>
          <tbody>${rows.map(callRow).join('') || emptyRow(11, empty)}</tbody>
        </table></div>
        ${tableFoot()}
      </div>`;
  }

  const refresh = () => paintCallCenter(app, { navHtml, go, forcePane });
  bindHubTabs(app, floorGo);
  app.querySelectorAll('[data-pane]').forEach((a) => {
    a.onclick = (e) => {
      e.preventDefault();
      setPane(a.dataset.pane);
      paintCallCenter(app, { navHtml, go });
    };
  });
  app.querySelectorAll('[data-queue]').forEach((a) => {
    a.onclick = (e) => {
      e.preventDefault();
      const u = new URL(location.href);
      u.searchParams.delete('tab');
      u.searchParams.set('pane', 'queues');
      if (a.dataset.queue && a.dataset.queue !== 'all') u.searchParams.set('queue', a.dataset.queue);
      else u.searchParams.delete('queue');
      history.pushState({ spa: u.pathname + u.search }, '', u.pathname + u.search);
      paintCallCenter(app, { navHtml, go });
    };
  });
  app.querySelectorAll('[data-promo]').forEach((b) => {
    b.onclick = () => {
      const u = new URL(location.href);
      u.searchParams.set('pane', 'hp');
      u.searchParams.set('promo', b.dataset.promo);
      history.pushState({ spa: u.pathname + u.search }, '', u.pathname + u.search);
      paintCallCenter(app, { navHtml, go });
    };
  });
  app.querySelector('#cc-add')?.addEventListener('click', () => openLog(null, refresh));
  app.querySelector('#cc-add-camp')?.addEventListener('click', () => openCampaign(null, refresh));
  app.querySelector('#cc-add-agent')?.addEventListener('click', () => openAgent(null, refresh));
  app.querySelectorAll('[data-agent]').forEach((a) => {
    a.onclick = (e) => {
      e.preventDefault();
      const row = agents().find((x) => String(x.id) === String(a.dataset.agent));
      if (row) openAgent(row, refresh, { viewOnly: true });
    };
  });
  app.querySelectorAll('[data-view]').forEach((a) => {
    a.onclick = (e) => {
      e.preventDefault();
      const row = calls().find((c) => c.id === a.dataset.view);
      if (row) openLog(row, refresh);
    };
  });
  app.querySelectorAll('[data-camp]').forEach((a) => {
    a.onclick = (e) => {
      e.preventDefault();
      const row = camps().find((c) => c.id === a.dataset.camp);
      if (row) openCampaign(row, refresh);
    };
  });
  app.querySelectorAll('[data-lead]').forEach((a) => {
    a.onclick = async (e) => {
      e.preventDefault();
      const row = calls().find((c) => c.id === a.dataset.lead);
      if (!row) return;
      if (!(await confirmAction('Create a lead from this call?', row.name || row.phone))) return;
      await convertToLead(row);
      refresh();
    };
  });
  bindTable(app.querySelector('[data-tbl]'), {
    title: onPane === 'campaigns' ? 'Campaigns' : onPane === 'agents' ? 'Call Centre agents' : 'Call Centre',
    storageKey: 'cc-' + onPane,
    table: onPane === 'campaigns' ? 'call_campaigns' : onPane === 'agents' ? 'call_agents' : 'call_tickets',
    key: onPane === 'campaigns' ? CAMP_KEY : onPane === 'agents' ? AGENT_KEY : CALL_KEY,
    onDone: refresh,
    crud: true,
  });
  app.querySelectorAll('[data-act]').forEach((b) => {
    b.onclick = async (e) => {
      e.preventDefault();
      const act = b.dataset.act;
      const id = b.dataset.id;
      if (onPane === 'campaigns') {
        const row = camps().find((c) => String(c.id) === String(id));
        if (act === 'view' || act === 'edit') { if (row) openCampaign(row, refresh); return; }
        if (act === 'del' && row) {
          if (!(await confirmAction('Delete this campaign?', row.name))) return;
          await deleteRow('call_campaigns', CAMP_KEY, row.id, { skipKey: true });
          refresh();
        }
        return;
      }
      if (onPane === 'agents') {
        const row = agents().find((x) => String(x.id) === String(id));
        if (act === 'view' && row) { openAgent(row, refresh, { viewOnly: true }); return; }
        if (act === 'edit' && row) { openAgent(row, refresh); return; }
        if (act === 'del' && row) {
          if (!(await confirmAction('Remove this Call Centre agent?', row.name))) return;
          await deleteRow('call_agents', AGENT_KEY, row.id, { skipKey: true });
          refresh();
        }
        return;
      }
      const row = calls().find((c) => String(c.id) === String(id));
      if ((act === 'view' || act === 'edit') && row) openLog(row, refresh);
      if (act === 'del' && row) {
        if (!(await confirmAction('Delete this call ticket?', row.phone || row.name))) return;
        await deleteRow('call_tickets', CALL_KEY, row.id, { skipKey: true });
        refresh();
      }
    };
  });
  if (onPane === 'campaigns') {
    bindDeletes(app, { table: 'call_campaigns', key: CAMP_KEY, label: 'this campaign', onDone: refresh });
  } else if (onPane === 'agents') {
    bindDeletes(app, { table: 'call_agents', key: AGENT_KEY, label: 'this Call Centre agent', onDone: refresh });
  } else {
    bindDeletes(app, { table: 'call_tickets', key: CALL_KEY, label: 'this call ticket', onDone: refresh });
  }
}

export function callCenterTodayCount() {
  const today = todayYmd();
  const all = calls();
  return {
    today: all.filter((c) => c.called_on === today).length,
    missed: all.filter((c) => c.status === 'missed' || c.status === 'abandoned').length,
    total: all.length,
  };
}
