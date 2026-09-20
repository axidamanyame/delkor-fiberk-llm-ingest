/**
 * Communications color-coded module.
 * Floor + Announcements, Messages (real DMs/groups), Calls, Meetings, Groups,
 * To Do, Documents, Memos, Reminders, Knowledge Base.
 */
import { esc, actMenu } from './ls-rows.js';
import { bindTable } from './home-tables.js';
import { hubTabs, bindHubTabs, goFile, svgIco, maybePaintNest, resolveHubTab, nestsFor, onHubNavigate, emptyRow, floorNav, tryPaintFloor } from './hub-kit.js';
import { getAccess } from './rbac.js';
import { isHqRole, isOwnerRole } from './access-rules.js';
import { confirmAction, ackResult } from './confirm-action.js';
import { promptDeleteKey } from './delete-guard.js';
import { loadBizSettings } from './settings-store.js';
import {
  pullGroups, teamGroups, dmGroups, pullMessages, listMessages, sendMessage,
  listStaff, ensureDm, otherInDm, ensureDefaultGroups, lastMessage, unreadIn,
  markRead, subscribeComm, probeComm, pullAnnouncements, listAnnouncements,
  postAnnouncement, listGroups, saveGroup, removeGroup, SUGGESTED_GROUPS,
} from './comm.js';
import { startCall, openMeetModal, canPlaceCall, installCallListener, listCalls, listMeetings } from './comm-calls.js';
import {
  bindEssHost, paintTodo, paintDocs, paintRemind, paintSettings,
  loadEssState, loadEssPeople,
} from './essentials-hub.js';

const FILE = '/communications.html';
const TABS = [
  { key: 'floor', label: 'Floor' },
  { key: 'announce', label: 'Announcements' },
  { key: 'msg', label: 'Messages' },
  { key: 'calls', label: 'Calls' },
  { key: 'meet', label: 'Meetings' },
  { key: 'groups', label: 'Groups' },
  { key: 'todo', label: 'To Do' },
  { key: 'docs', label: 'Documents' },
  { key: 'memos', label: 'Memos' },
  { key: 'remind', label: 'Reminders' },
];
const BRAND = `${svgIco('conv') || '💬'} Communications`;
const ALIAS = {
  announcements: 'announce', announcement: 'announce',
  messages: 'msg', message: 'msg', chat: 'msg',
  meetings: 'meet', meeting: 'meet',
  'comm-groups': 'groups', group: 'groups',
  documents: 'docs', document: 'docs',
  reminders: 'remind', reminder: 'remind',
  setting: 'settings',
};

let sessionMe = {
  email: '',
  name: '',
  id: '',
  hq: false,
  allowCall: false,
};
let msgCurrent = '';
let staffCache = [];
let commBound = false;

function tab() {
  const raw = new URLSearchParams(location.search).get('tab') || 'floor';
  const mapped = ALIAS[raw] || raw;
  if (mapped === 'settings') return 'settings';
  return resolveHubTab(mapped, TABS, 'floor', nestsFor(FILE));
}
function go(t) {
  const home = !t || t === 'floor';
  goFile(FILE, home ? '' : t);
  paint();
}
function nav(on) { return floorNav(BRAND, on, 'floor', FILE); }

function bindEss() {
  bindEssHost({ file: FILE, brand: BRAND, tabs: TABS, brandKey: 'floor', go, paint });
}

function when(iso) {
  if (!iso) return '—';
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? String(iso).replace('T', ' ').slice(0, 16) : d.toLocaleString();
}
function dur(s) {
  const n = Number(s || 0);
  if (!n) return '—';
  const m = Math.floor(n / 60);
  const r = n % 60;
  return m ? m + 'm ' + r + 's' : r + 's';
}
function todayKey() { return new Date().toISOString().slice(0, 10); }

function unreadTotal(me) {
  try {
    const rooms = [...teamGroups(), ...dmGroups()];
    return rooms.reduce((n, g) => n + (unreadIn(g.id, me) || 0), 0);
  } catch { return 0; }
}

async function paintFloor(app) {
  const ess = loadEssState();
  await pullAnnouncements().catch(() => {});
  await pullGroups().catch(() => {});
  await pullMessages().catch(() => {});
  const openTodos = (ess.todos || []).filter((t) => t.status !== 'Completed').length;
  const upcoming = (ess.reminders || []).filter((r) => String(r.date || '') >= todayKey()).length;
  const anns = listAnnouncements();
  const meets = listMeetings();
  const groups = listGroups().filter((g) => String(g.kind || 'team') !== 'dm');
  const unread = unreadTotal(sessionMe.email);
  const tiles = [
    { key: 'msg', label: 'Messages', n: unread || listMessages().length, hint: unread ? 'unread' : 'in rooms' },
    { key: 'todo', label: 'To Do', n: openTodos, hint: 'open' },
    { key: 'remind', label: 'Reminders', n: upcoming, hint: 'upcoming' },
    { key: 'announce', label: 'Announcements', n: anns.length, hint: 'posted' },
    { key: 'meet', label: 'Meetings', n: meets.length, hint: 'started' },
    { key: 'docs', label: 'Documents', n: (ess.docs || []).length, hint: 'on file' },
    { key: 'memos', label: 'Memos', n: (ess.memos || []).length, hint: 'filed' },
    { key: 'kb', label: 'Knowledge Base', n: (ess.kb || []).length, hint: 'articles' },
    { key: 'groups', label: 'Groups', n: groups.length, hint: 'rooms' },
    { key: 'calls', label: 'Calls', n: listCalls().length, hint: 'logged' },
  ];
  const latestAnn = anns.slice(0, 4);
  const todayRem = (ess.reminders || []).filter((r) => r.date === todayKey()).slice(0, 5);
  const openTd = (ess.todos || []).filter((t) => t.status !== 'Completed').slice(0, 5);
  app.classList.add('ess-hub', 'comm-hub');
  app.innerHTML = `
    ${nav('floor')}
    <section class="comm-hero">
      <div>
        <h1>Communications</h1>
        <p>Talk, assign, and keep the desk in one place — messages, meetings, to-dos, files, and reminders.</p>
      </div>
      <div class="comm-hero-actions">
        <a class="ess-add" href="${FILE}?tab=msg" data-htab="msg">Open Messages</a>
        <a class="ult-btn ult-btn-outline" href="${FILE}?tab=announce" data-htab="announce">Post announcement</a>
      </div>
    </section>
    <div class="wms-grid comm-floor">
      ${tiles.map((t) => `<a class="wms-card comm-card" href="${FILE}?tab=${esc(t.key)}" data-htab="${esc(t.key)}">
        <strong>${esc(t.label)}</strong><span>${esc(t.hint)}</span><b>${t.n}</b>
      </a>`).join('')}
    </div>
    <div class="comm-floor-cols">
      <section class="ess-card">
        <div class="ss-head"><strong>Latest announcements</strong>
          <a href="${FILE}?tab=announce" data-htab="announce">All</a></div>
        ${latestAnn.length ? latestAnn.map((n) => `<article class="comm-snip">
          <h3>${esc(n.title || 'Announcement')}</h3>
          <p>${esc(String(n.body || '').slice(0, 140))}</p>
          <small>${esc(when(n.created_at))} · ${esc(n.meta?.author || 'HQ')}</small>
        </article>`).join('') : '<p class="ess-empty">No announcements yet.</p>'}
      </section>
      <section class="ess-card">
        <div class="ss-head"><strong>Today’s reminders</strong>
          <a href="${FILE}?tab=remind" data-htab="remind">Calendar</a></div>
        ${todayRem.length ? `<ul class="comm-list">${todayRem.map((r) => `<li><b>${esc(r.time || '')}</b> ${esc(r.name)}</li>`).join('')}</ul>`
          : '<p class="ess-empty">Nothing on the calendar today. Double-click a day to add one.</p>'}
      </section>
      <section class="ess-card">
        <div class="ss-head"><strong>Open to-dos</strong>
          <a href="${FILE}?tab=todo" data-htab="todo">List</a></div>
        ${openTd.length ? `<ul class="comm-list">${openTd.map((t) => `<li><b>${esc(t.status || 'New')}</b> ${esc(t.task)} <span>${esc(t.assigned || '')}</span></li>`).join('')}</ul>`
          : '<p class="ess-empty">No open tasks. Add one from To Do.</p>'}
      </section>
    </div>`;
  bindHubTabs(app, go);
}

async function paintAnnounce(app) {
  await pullAnnouncements();
  const rows = listAnnouncements();
  app.classList.add('ess-hub', 'comm-hub');
  app.innerHTML = `
    ${nav('announce')}
    ${sessionMe.hq ? `<form id="ann-form" class="ess-card" style="margin-bottom:16px">
      <div class="ss-head"><strong>Post announcement</strong></div>
      <div class="ult-field"><label>Title</label><input name="title" required placeholder="Title" /></div>
      <div class="ult-field"><label>Message for staff</label><textarea name="body" required rows="4" placeholder="Message for staff"></textarea></div>
      <button type="submit" class="ess-add">Publish</button>
    </form>` : ''}
    <div class="ess-card">${rows.length ? rows.map((n) => `
      <article class="comm-snip" style="border-bottom:1px solid #e2e8f0;padding:12px 0">
        <h3>${esc(n.title || 'Announcement')}</h3>
        <small>${esc(when(n.created_at))} · ${esc(n.meta?.author || 'HQ')}</small>
        <p style="white-space:pre-wrap">${esc(n.body || '')}</p>
      </article>`).join('') : '<p class="ess-empty">No announcements yet.</p>'}</div>`;
  bindHubTabs(app, go);
  const form = app.querySelector('#ann-form');
  if (form) form.onsubmit = async (e) => {
    e.preventDefault();
    const fd = new FormData(form);
    const title = String(fd.get('title') || '').trim();
    const body = String(fd.get('body') || '').trim();
    if (!title || !body) return;
    if (!(await confirmAction('Publish this announcement to staff?'))) return;
    await postAnnouncement({ title, body, author_email: sessionMe.email });
    ackResult(true, 'Announcement published.');
    paint();
  };
}

function msgHref(extra = {}) {
  const q = new URLSearchParams();
  q.set('tab', 'msg');
  Object.entries(extra).forEach(([k, v]) => { if (v) q.set(k, v); });
  return FILE + '?' + q.toString();
}
function gid() { return new URLSearchParams(location.search).get('g') || msgCurrent || ''; }
function dmWant() { return String(new URLSearchParams(location.search).get('dm') || '').toLowerCase(); }
function qtext() { return String(document.getElementById('comm-q')?.value || '').trim().toLowerCase(); }
function linkify(text) {
  const s = esc(text);
  return s.replace(/(https?:\/\/[^\s<]+)/g, '<a href="$1" target="_blank" rel="noopener">$1</a>');
}
function bubbleHtml(m) {
  const mine = String(m.author_email || '').toLowerCase() === sessionMe.email;
  const whenStr = esc(String(m.created_at || '').replace('T', ' ').slice(0, 16));
  return `<div class="comm-bubble ${mine ? 'me' : ''}" data-mid="${esc(m.id)}">
    <small>${esc(m.author_name || m.author_email || '')} · ${whenStr}</small>
    ${m.subject ? `<div class="subj">${esc(m.subject)}</div>` : ''}
    ${linkify(m.body || '')}
  </div>`;
}
function preview(g) {
  const last = lastMessage(g.id);
  if (!last) return 'No messages yet';
  const sub = last.subject ? last.subject + ' — ' : '';
  return (sub + (last.body || '')).slice(0, 72);
}

async function resolveRoom() {
  await pullGroups();
  staffCache = await listStaff({ excludeEmail: sessionMe.email });
  let id = gid();
  const want = dmWant();
  const me = sessionMe.email;
  if (want) {
    const other = staffCache.find((s) => s.email === want) || { email: want, full_name: want.split('@')[0] };
    const q = await ensureDm({ meEmail: me, meName: sessionMe.name, other });
    if (q.data?.id) {
      id = String(q.data.id);
      try { history.replaceState({ spa: msgHref({ g: id }) }, '', msgHref({ g: id })); } catch { /* ignore */ }
    }
  }
  const teams = teamGroups();
  const dms = dmGroups();
  if (!id && dms[0]) id = String(dms[0].id);
  if (!id && teams[0]) {
    id = String(teams[0].id);
    try { history.replaceState({ spa: msgHref({ g: id }) }, '', msgHref({ g: id })); } catch { /* ignore */ }
  }
  msgCurrent = id;
  return { id, teams, dms };
}

function roomsHtml(id, teams) {
  const q = qtext();
  const people = staffCache.filter((s) => !q || s.full_name.toLowerCase().includes(q) || s.email.includes(q) || (s.role || '').toLowerCase().includes(q));
  const groups = teams.filter((g) => !q || String(g.name || '').toLowerCase().includes(q));
  const me = sessionMe.email;
  return `<nav class="comm-rooms">
    <input type="search" id="comm-q" placeholder="Search people or groups" value="${esc(qtext())}" />
    <h4>People</h4>
    ${people.map((s) => {
      const key = 'dm:' + [me, s.email].sort().join('|');
      const on = String(id) === key;
      const n = unreadIn(key, me);
      return `<a class="${on ? 'on' : ''}" href="${msgHref({ dm: s.email })}">
        ${n ? `<span class="badge" title="Mark as read">${n > 9 ? '9+' : n}</span>` : ''}
        ${esc(s.full_name)}<span class="sub">${esc(s.role || s.email)} · ${esc(preview({ id: key }))}</span></a>`;
    }).join('') || '<p class="comm-empty-room">No other staff on this device yet. Open a group on the right.</p>'}
    <h4>Groups</h4>
    ${groups.map((g) => {
      const n = unreadIn(g.id, me);
      return `<a class="${String(g.id) === String(id) ? 'on' : ''}" href="${msgHref({ g: g.id })}">
        ${n ? `<span class="badge" title="Mark as read">${n > 9 ? '9+' : n}</span>` : ''}
        ${esc(g.name)}<span class="sub">${esc(preview(g))}</span></a>`;
    }).join('') || `<p class="comm-empty-room">No groups. <a href="${FILE}?tab=groups" data-htab="groups">Create one</a></p>`}
  </nav>`;
}

function threadHtml(room, msgs) {
  if (!room) return `<section class="comm-thread"><div style="padding:24px;color:var(--ult-muted)">Pick a person or a group to start chatting.</div></section>`;
  const isDm = room.kind === 'dm';
  const peer = isDm ? otherInDm(room, sessionMe.email) : null;
  const peerStaff = peer ? staffCache.find((s) => s.email === peer.email) : null;
  return `<section class="comm-thread">
    <div class="comm-head">
      <div><strong>${esc(room.name)}</strong>${peerStaff?.role ? `<span class="role">${esc(peerStaff.role)}</span>` : ''}</div>
      <div class="comm-actions">
        ${isDm && sessionMe.allowCall ? `<button type="button" class="ult-btn ult-btn-outline" id="comm-call">Call</button>
          <button type="button" class="ult-btn ult-btn-outline" id="comm-video">Video</button>` : ''}
        <button type="button" class="ult-btn" id="comm-meet">Meet</button>
      </div>
    </div>
    <div class="comm-log" id="comm-log">${msgs.map(bubbleHtml).join('') || '<p style="color:var(--ult-muted)">No messages in this room yet. Write the first one.</p>'}</div>
    <form class="comm-send" id="comm-send">
      <div class="fields">
        <input name="subject" id="msg-subject" maxlength="120" placeholder="Subject (optional)" autocomplete="off" />
        <textarea name="body" id="msg-body" required placeholder="Write a message…  Enter to send"></textarea>
      </div>
      <button type="submit" class="ult-btn" id="send-btn">Send</button>
    </form>
    <p class="comm-sync" id="comm-sync"></p>
  </section>`;
}

function appendRow(row) {
  if (!row || String(row.group_id) !== String(msgCurrent)) return;
  const log = document.getElementById('comm-log');
  if (!log) return;
  const empty = log.querySelector('p');
  if (empty) empty.remove();
  if (log.querySelector(`[data-mid="${CSS.escape(String(row.id))}"]`)) return;
  log.insertAdjacentHTML('beforeend', bubbleHtml(row));
  log.scrollTop = log.scrollHeight;
}

function refreshRooms(app) {
  const navEl = app.querySelector('.comm-rooms');
  if (!navEl) return;
  const html = roomsHtml(msgCurrent, teamGroups());
  const tmp = document.createElement('div');
  tmp.innerHTML = html;
  const next = tmp.firstElementChild;
  if (next) navEl.replaceWith(next);
  document.getElementById('comm-q')?.addEventListener('input', () => refreshRooms(app));
}

function bindThread(app, room) {
  const log = document.getElementById('comm-log');
  if (log) log.scrollTop = log.scrollHeight;
  const form = document.getElementById('comm-send');
  const bodyEl = document.getElementById('msg-body');
  if (bodyEl) {
    bodyEl.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        form?.requestSubmit();
      }
    });
  }
  if (form) form.onsubmit = async (e) => {
    e.preventDefault();
    const fd = new FormData(form);
    const body = String(fd.get('body') || '').trim();
    const subject = String(fd.get('subject') || '').trim();
    if (!body || !msgCurrent) return;
    const btn = document.getElementById('send-btn');
    if (btn) btn.disabled = true;
    const q = await sendMessage({
      group_id: msgCurrent,
      author_email: sessionMe.email,
      author_name: sessionMe.name,
      author_id: sessionMe.id,
      body,
      subject,
    });
    if (btn) btn.disabled = false;
    if (q.error) { ackResult(false, q.error.message); return; }
    form.reset();
    appendRow(q.data);
    refreshRooms(app);
    const sync = document.getElementById('comm-sync');
    if (sync) {
      sync.textContent = q.remote
        ? 'Delivered. The other desk will see this within a few seconds.'
        : ('Still on this device only. ' + (q.remoteError || 'Run the communication SQL in Supabase.'));
    }
    bodyEl?.focus();
  };
  const peer = room?.kind === 'dm' ? otherInDm(room, sessionMe.email) : null;
  const peerStaff = peer ? staffCache.find((s) => s.email === peer.email) : null;
  document.getElementById('comm-call')?.addEventListener('click', () => {
    if (!peer) return;
    startCall({ toEmail: peer.email, toName: peer.full_name, toId: peerStaff?.id, video: false });
  });
  document.getElementById('comm-video')?.addEventListener('click', () => {
    if (!peer) return;
    startCall({ toEmail: peer.email, toName: peer.full_name, toId: peerStaff?.id, video: true });
  });
  document.getElementById('comm-meet')?.addEventListener('click', () => {
    openMeetModal({
      title: room.name,
      groupId: room.id,
      room: 'DelkorFiberk-' + String(room.name || 'Team').replace(/[^a-z0-9]+/gi, '').slice(0, 24),
      onShare: async (url) => {
        await sendMessage({
          group_id: msgCurrent,
          author_email: sessionMe.email,
          author_name: sessionMe.name,
          body: 'Join the meeting: ' + url,
          subject: 'Meeting',
        });
        ackResult(true, 'Meeting link posted in this chat.');
        paint();
      },
    });
  });
}

async function paintMessages(app) {
  const { id, teams, dms } = await resolveRoom();
  const rooms = [...dms, ...teams];
  const room = rooms.find((g) => String(g.id) === String(id));
  await pullMessages();
  const msgs = id ? listMessages(id) : [];
  if (id) markRead(id);
  app.classList.add('ess-hub', 'comm-hub');
  app.innerHTML = `${nav('msg')}<div class="comm-wrap">${roomsHtml(id, teams)}${threadHtml(room, msgs)}</div>`;
  bindHubTabs(app, go);
  document.getElementById('comm-q')?.addEventListener('input', () => refreshRooms(app));
  bindThread(app, room);
  const live = await probeComm();
  const sync = document.getElementById('comm-sync');
  if (sync && !sync.textContent) {
    sync.textContent = live.ok
      ? 'Live table is on. Pick a person, write, Send — the other signed-in desk should see it within a few seconds.'
      : ('Chat table is not live: ' + live.reason);
  }
  if (!window.__dfCommRoomClick) {
    window.__dfCommRoomClick = true;
    document.addEventListener('click', async (e) => {
      if (!/communications\.html/.test(location.pathname)) return;
      const a = e.target.closest('.comm-rooms a[href]');
      if (!a) return;
      e.preventDefault();
      e.stopPropagation();
      const href = a.getAttribute('href') || '';
      const url = new URL(href, location.origin);
      const badge = e.target.closest('.badge');
      const me = sessionMe.email;
      const appEl = document.getElementById('app');
      if (badge) {
        const g = url.searchParams.get('g');
        const dm = String(url.searchParams.get('dm') || '').toLowerCase();
        if (g) markRead(g);
        if (dm) {
          markRead('dm:' + [me, dm].sort().join('|'));
          const q = await ensureDm({ meEmail: me, meName: sessionMe.name, other: { email: dm, full_name: dm } });
          if (q.data?.id) markRead(q.data.id);
        }
        if (appEl) refreshRooms(appEl);
        return;
      }
      try { history.pushState({ spa: href }, '', href); } catch { /* ignore */ }
      await paint();
    });
  }
}

async function paintCalls(app) {
  const staff = await listStaff({ excludeEmail: sessionMe.email });
  const rows = listCalls();
  app.classList.add('ess-hub', 'comm-hub');
  app.innerHTML = `
    ${nav('calls')}
    ${sessionMe.allowCall && staff.length ? `<div class="ess-card" style="margin-bottom:16px">
      <div class="ss-head"><strong>Place a call</strong></div>
      <form id="call-form" style="display:flex;gap:8px;flex-wrap:wrap;align-items:end">
        <label style="flex:1;min-width:220px">Person<br>
          <select name="to" required>
            <option value="">Select staff</option>
            ${staff.map((s) => `<option value="${esc(s.email)}" data-id="${esc(s.id || '')}" data-name="${esc(s.full_name)}">${esc(s.full_name)} — ${esc(s.role || s.email)}</option>`).join('')}
          </select>
        </label>
        <button type="submit" class="ult-btn ult-btn-outline" data-kind="audio">Call</button>
        <button type="submit" class="ess-add" data-kind="video">Video</button>
      </form>
      <p class="ult-muted" style="margin:10px 0 0">1-to-1 calls stay inside the ERP. Pending / Viewer cannot place a call.</p>
    </div>` : ''}
    <div class="ess-card" data-tbl="calls" data-act-end="1">
      <div class="ult-table-wrap"><table class="ult-table ess-table" data-act-end="1">
        <thead><tr><th>When</th><th>From</th><th>To</th><th>Kind</th><th>Status</th><th>Duration</th></tr></thead>
        <tbody>${rows.length ? rows.map((c) => `<tr>
          <td>${esc(when(c.started_at))}</td>
          <td>${esc(c.from_name || c.from_email || '')}</td>
          <td>${esc(c.to_name || c.to_email || '')}</td>
          <td>${esc(c.kind || 'video')}</td>
          <td>${esc(c.status || '')}</td>
          <td>${esc(dur(c.duration_s))}</td>
        </tr>`).join('') : emptyRow(6, 'No calls yet.')}</tbody>
      </table></div>
    </div>`;
  bindHubTabs(app, go);
  bindTable(app.querySelector('[data-tbl="calls"]'), { title: 'Calls', storageKey: 'comm-calls' });
  const form = app.querySelector('#call-form');
  if (form) form.addEventListener('submit', (e) => {
    e.preventDefault();
    const kind = e.submitter?.dataset.kind || 'video';
    const sel = form.to;
    const opt = sel.selectedOptions[0];
    if (!sel.value) return;
    startCall({
      toEmail: sel.value,
      toName: opt?.dataset.name || sel.value,
      toId: opt?.dataset.id,
      video: kind !== 'audio',
    });
  });
}

async function paintMeet(app) {
  await pullGroups();
  const teams = teamGroups();
  const rows = listMeetings();
  const biz = await loadBizSettings().catch(() => ({}));
  const meetCode = biz?.meet_code || biz?.meet_url || '';
  app.classList.add('ess-hub', 'comm-hub');
  app.innerHTML = `
    ${nav('meet')}
    ${sessionMe.allowCall ? `<div class="ess-card" style="margin-bottom:16px">
      <div class="ss-head"><strong>Start a meeting</strong></div>
      <form id="meet-form" style="display:flex;gap:8px;flex-wrap:wrap;align-items:end">
        <label style="flex:1;min-width:200px">Room / group<br>
          <select name="group">
            <option value="">Company meeting</option>
            ${teams.map((g) => `<option value="${esc(g.id)}">${esc(g.name)}</option>`).join('')}
          </select>
        </label>
        <button type="submit" class="ess-add">Start meeting</button>
        <a class="ult-btn ult-btn-outline" href="/settings.html?tab=system">Meet code</a>
      </form>
      ${meetCode ? `<p class="ult-muted" style="margin:10px 0 0">Company Google Meet: ${esc(meetCode)}</p>`
        : '<p class="ult-muted" style="margin:10px 0 0">No Google Meet code saved yet. You can still use the in-window team room.</p>'}
    </div>` : ''}
    <div class="ess-card" data-tbl="meets" data-act-end="1">
      <div class="ult-table-wrap"><table class="ult-table ess-table" data-act-end="1">
        <thead><tr><th>When</th><th>Title</th><th>Host</th><th>Link</th></tr></thead>
        <tbody>${rows.length ? rows.map((m) => `<tr>
          <td>${esc(when(m.started_at))}</td>
          <td>${esc(m.title || m.room || 'Meeting')}</td>
          <td>${esc(m.host_name || m.host_email || '')}</td>
          <td>${m.meet_url ? `<a href="${esc(m.meet_url)}" target="_blank" rel="noopener">Google Meet</a>` : esc(m.room || '—')}</td>
        </tr>`).join('') : emptyRow(4, 'No meetings started yet.')}</tbody>
      </table></div>
    </div>`;
  bindHubTabs(app, go);
  bindTable(app.querySelector('[data-tbl="meets"]'), { title: 'Meetings', storageKey: 'comm-meets' });
  app.querySelector('#meet-form')?.addEventListener('submit', (e) => {
    e.preventDefault();
    const gidVal = e.target.group.value;
    const g = teams.find((x) => String(x.id) === String(gidVal));
    openMeetModal({
      title: g?.name || 'Company meeting',
      groupId: gidVal,
      meetCode,
      room: 'DelkorFiberk-' + String(g?.name || 'HQ').replace(/[^a-z0-9]+/gi, '').slice(0, 24),
    });
  });
}

async function paintGroups(app) {
  await pullGroups();
  const rows = listGroups().filter((g) => String(g.kind || 'team') !== 'dm');
  app.classList.add('ess-hub', 'comm-hub');
  app.innerHTML = `
    ${nav('groups')}
    ${sessionMe.hq ? `<form id="g-form" class="ess-card" style="margin-bottom:16px;display:flex;gap:8px;flex-wrap:wrap;align-items:end">
      <label style="flex:1;min-width:200px">Group name<br>
        <input name="name" required list="g-suggest" placeholder="e.g. Operations Hub Team" />
        <datalist id="g-suggest">${SUGGESTED_GROUPS.map((n) => `<option value="${esc(n)}"></option>`).join('')}</datalist>
      </label>
      <button type="submit" class="ess-add">Add group</button>
    </form>` : ''}
    <div class="ess-card" data-tbl="groups" data-act-end="1">
      <div class="ult-table-wrap"><table class="ult-table ess-table" data-act-end="1">
        <thead><tr><th>Name</th><th>Messages</th><th data-nosort="1">Action</th></tr></thead>
        <tbody>${rows.map((g) => `<tr data-id="${esc(g.id)}">
          <td>${esc(g.name)}</td>
          <td>${listMessages(g.id).length}</td>
          <td>${actMenu(g.id, [
            { href: msgHref({ g: g.id }), label: 'Open chat' },
            ...(sessionMe.hq ? [{ act: 'del', label: 'Delete' }] : []),
          ])}</td>
        </tr>`).join('') || emptyRow(3, 'No groups yet. HQ can add Operations Hub, Sales, Finance, or Admin.')}</tbody>
      </table></div>
    </div>`;
  bindHubTabs(app, go);
  bindTable(app.querySelector('[data-tbl="groups"]'), { title: 'Groups', storageKey: 'comm-groups' });
  const form = app.querySelector('#g-form');
  if (form) form.onsubmit = async (e) => {
    e.preventDefault();
    const name = String(new FormData(form).get('name') || '').trim();
    if (!name) return;
    if (!(await confirmAction('Create group “' + name + '”?'))) return;
    const q = await saveGroup({ name, kind: 'team' });
    if (q.error) { ackResult(false, q.error.message); return; }
    ackResult(true, 'Group created.');
    paint();
  };
  app.querySelectorAll('[data-act="del"]').forEach((btn) => {
    btn.onclick = async (e) => {
      e.preventDefault();
      if (!(await confirmAction('Delete this group and its messages?'))) return;
      if (!(await promptDeleteKey('Delete access key required'))) return;
      await removeGroup(btn.dataset.id);
      ackResult(true, 'Group deleted.');
      paint();
    };
  });
}

async function paint() {
  const app = document.getElementById('app');
  if (!app) return;
  bindEss();
  const on = tab();
  app.classList.add('ess-hub', 'comm-hub');
  if (tryPaintFloor(app, on, { brand: BRAND, file: FILE, go })) return;
  if (maybePaintNest(app, on, { brand: BRAND, tabs: TABS, brandKey: 'floor', file: FILE, go })) return;
  if (on === 'floor') return paintFloor(app);
  if (on === 'announce') return paintAnnounce(app);
  if (on === 'msg') return paintMessages(app);
  if (on === 'calls') return paintCalls(app);
  if (on === 'meet') return paintMeet(app);
  if (on === 'groups') return paintGroups(app);
  if (on === 'todo') return paintTodo(app);
  if (on === 'docs') return paintDocs(app, 'docs');
  if (on === 'memos') return paintDocs(app, 'memos');
  if (on === 'remind') return paintRemind(app);
  if (on === 'kb') {
    goFile('/academy.html', 'kb');
    return;
  }
  if (on === 'settings') return paintSettings(app);
  return paintFloor(app);
}

export async function bootCommunicationsHub() {
  const ctx = getAccess();
  sessionMe = {
    email: String(ctx?.email || '').toLowerCase(),
    name: ctx?.fullName || String(ctx?.email || 'Staff').split('@')[0],
    id: ctx?.userId || '',
    hq: !!(ctx?.isAdmin || isHqRole(ctx?.roleName) || isOwnerRole(ctx?.roleName)),
    allowCall: canPlaceCall(ctx),
  };
  onHubNavigate(paint);
  await Promise.all([
    loadEssPeople(),
    ensureDefaultGroups().catch(() => {}),
    installCallListener().catch(() => {}),
  ]);
  if (!commBound) {
    commBound = true;
    subscribeComm((row) => {
      appendRow(row);
      if (String(row.group_id) === String(msgCurrent)) markRead(msgCurrent);
      const app = document.getElementById('app');
      if (app?.querySelector('.comm-rooms')) refreshRooms(app);
    });
  }
  try { await paint(); } catch (err) {
    console.warn('communications-hub', err);
    const app = document.getElementById('app');
    if (app) app.innerHTML = `<div class="card" style="padding:24px"><h1>Communications</h1><p>${esc(err?.message || err)}</p></div>`;
  }
}
