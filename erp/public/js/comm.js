/** Internal Communication — announcements, groups, messages, 1-to-1 rooms. No demo people. */
import { readLs, writeLs, uid } from './ls-rows.js';
import { supabase } from './supabaseClient.js';
import { peelWrite } from './account-rules.js';
import { pushNotice, listAllNotices, pullAllNotices } from './inbox.js';

export const GROUP_KEY = 'df_comm_groups';
export const MSG_KEY = 'df_comm_messages';
export const READ_KEY = 'df_comm_read';
const SEED_FLAG = 'df_comm_seeded_v1';
const BUS_NAME = 'df-comm';

export const SUGGESTED_GROUPS = [
  'Operations Hub Team',
  'Sales Team',
  'Finance Team',
  'Admin',
];

export const DEFAULT_ROOMS = [
  { id: 'team:all', name: 'Delkor-Fiberk' },
  { id: 'team:ops', name: 'Operations Hub Team' },
  { id: 'team:sales', name: 'Sales Team' },
  { id: 'team:finance', name: 'Finance Team' },
  { id: 'team:admin', name: 'Admin' },
];

function bus() {
  try {
    if (typeof BroadcastChannel === 'undefined') return null;
    if (!globalThis.__df_comm_bus) globalThis.__df_comm_bus = new BroadcastChannel(BUS_NAME);
    return globalThis.__df_comm_bus;
  } catch {
    return null;
  }
}

function publishBus(row) {
  try { bus()?.postMessage({ type: 'msg', row }); } catch { /* ignore */ }
}

function mergeMessage(row) {
  if (!row?.id) return;
  const byId = new Map(listMessages().map((m) => [String(m.id), m]));
  byId.set(String(row.id), { ...byId.get(String(row.id)), ...row });
  writeLs(MSG_KEY, [...byId.values()].slice(-2000));
}

export function listGroups() {
  const rows = readLs(GROUP_KEY, []);
  return Array.isArray(rows) ? rows : [];
}

export function teamGroups() {
  return listGroups().filter((g) => String(g.kind || 'team') !== 'dm');
}

export function dmGroups() {
  return listGroups().filter((g) => g.kind === 'dm');
}

export async function pullGroups() {
  try {
    const { data, error } = await supabase.from('app_comm_groups').select('*').order('created_at', { ascending: true }).limit(200);
    if (!error && Array.isArray(data) && data.length) {
      const byId = new Map(listGroups().map((g) => [String(g.id), g]));
      data.forEach((g) => byId.set(String(g.id), { ...byId.get(String(g.id)), ...g }));
      writeLs(GROUP_KEY, [...byId.values()]);
    }
  } catch { /* local */ }
  return listGroups();
}

export async function saveGroup(body, { id } = {}) {
  const row = {
    id: id || body.id || uid(),
    name: String(body.name || '').trim(),
    kind: body.kind || 'team',
    members: Array.isArray(body.members) ? body.members : (body.members || []),
    created_at: body.created_at || new Date().toISOString(),
  };
  if (!row.name) return { error: { message: 'Group name is required' } };
  try {
    await supabase.from('app_comm_groups').upsert({
      id: row.id,
      name: row.name,
      kind: row.kind,
      members: row.members,
      created_at: row.created_at,
    }, { onConflict: 'id' });
  } catch { /* local */ }
  const q = await peelWrite('app_comm_groups', row, { id: row.id });
  const rows = listGroups();
  const i = rows.findIndex((g) => String(g.id) === String(row.id));
  if (i >= 0) rows[i] = { ...rows[i], ...row };
  else rows.push(row);
  writeLs(GROUP_KEY, rows);
  return q.error && !row.id ? q : { data: row, error: null };
}

export async function removeGroup(id) {
  writeLs(GROUP_KEY, listGroups().filter((g) => String(g.id) !== String(id)));
  writeLs(MSG_KEY, listMessages().filter((m) => String(m.group_id) !== String(id)));
  try { await supabase.from('app_comm_groups').delete().eq('id', id); } catch { /* local */ }
  try { await supabase.from('app_comm_messages').delete().eq('group_id', id); } catch { /* local */ }
}

export function listMessages(groupId) {
  const rows = readLs(MSG_KEY, []);
  const all = Array.isArray(rows) ? rows : [];
  if (!groupId) return all;
  return all.filter((m) => String(m.group_id) === String(groupId));
}

function isUuid(value) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(String(value || ''));
}

function packLegacySubject(groupId, subject) {
  return String(groupId || 'team:all') + '|' + String(subject || '');
}

function unpackLegacy(m) {
  const raw = String(m.subject || '');
  let group_id = 'team:all';
  let subject = raw;
  const pipe = raw.indexOf('|');
  if ((raw.startsWith('team:') || raw.startsWith('dm:')) && pipe >= 0) {
    group_id = raw.slice(0, pipe);
    subject = raw.slice(pipe + 1);
  }
  return {
    id: m.id ? String(m.id) : ('legacy-' + uid()),
    group_id: m.group_id || group_id,
    author_email: String(m.author_email || m.from_user || 'staff').toLowerCase(),
    author_name: m.author_name || 'Staff',
    subject,
    body: m.body || m.message || '',
    created_at: m.created_at || new Date().toISOString(),
  };
}

export async function pullMessages(groupId) {
  try {
    let q = supabase.from('app_comm_messages').select('*').order('created_at', { ascending: true }).limit(500);
    if (groupId) q = q.eq('group_id', groupId);
    const { data, error } = await q;
    if (!error && Array.isArray(data)) data.forEach((m) => mergeMessage(m));
  } catch { /* local */ }
  try {
    const { data, error } = await supabase.from('messages').select('*').order('created_at', { ascending: true }).limit(200);
    if (!error && Array.isArray(data)) data.forEach((m) => mergeMessage(unpackLegacy(m)));
  } catch { /* no tutorial table */ }
  return listMessages(groupId);
}

export async function probeComm() {
  try {
    const { error } = await supabase.from('app_comm_messages').select('id').limit(1);
    if (error) return { ok: false, reason: error.message || 'app_comm_messages not readable' };
    return { ok: true, reason: '' };
  } catch (err) {
    return { ok: false, reason: String(err?.message || err) };
  }
}

export async function sendMessage({ group_id, author_email, author_name, author_id, body, subject } = {}) {
  const text = String(body || '').trim();
  if (!text || !group_id) return { error: { message: 'Message and room are required' } };
  const row = {
    id: uid(),
    group_id,
    author_email: String(author_email || '').toLowerCase() || 'staff@local',
    author_name: author_name || author_email || 'Staff',
    subject: String(subject || '').trim(),
    body: text,
    created_at: new Date().toISOString(),
  };
  mergeMessage(row);
  publishBus(row);
  let remote = false;
  let remoteError = '';
  try {
    const payload = {
      id: row.id,
      group_id: row.group_id,
      author_email: row.author_email,
      author_name: row.author_name,
      body: row.body,
      subject: row.subject,
      created_at: row.created_at,
    };
    let q = await supabase.from('app_comm_messages').upsert(payload, { onConflict: 'id' }).select('id').maybeSingle();
    if (q.error && /subject|column/i.test(q.error.message || '')) {
      const slim = { ...payload };
      delete slim.subject;
      q = await supabase.from('app_comm_messages').upsert(slim, { onConflict: 'id' }).select('id').maybeSingle();
    }
    if (q.error) remoteError = q.error.message;
    else remote = !!(q.data?.id || !q.error);
  } catch (err) {
    remoteError = String(err?.message || err);
  }
  if (!remote) {
    try {
      const payload = {
        subject: packLegacySubject(row.group_id, row.subject),
        body: row.body,
      };
      if (isUuid(author_id)) payload.from_user = author_id;
      const ins = await supabase.from('messages').insert(payload).select('id').maybeSingle();
      if (!ins?.error) remote = true;
      else if (!remoteError) remoteError = ins.error.message;
    } catch { /* optional */ }
  }
  try {
    const room = listGroups().find((g) => String(g.id) === String(group_id));
    if (room?.kind === 'dm') {
      const peer = otherInDm(room, row.author_email);
      if (peer?.email) {
        await pushNotice({
          email: peer.email,
          title: row.subject || ('Message from ' + row.author_name),
          body: text.slice(0, 180),
          kind: 'message',
          href: '/communications.html?tab=msg&g=' + encodeURIComponent(group_id),
        });
      }
    }
  } catch { /* notice is optional */ }
  return { data: row, remote, error: null, remoteError };
}

export async function ensureDefaultGroups() {
  try {
    if (localStorage.getItem(SEED_FLAG) === '1' && teamGroups().length) return listGroups();
  } catch { /* seed anyway */ }
  const have = listGroups();
  for (const room of DEFAULT_ROOMS) {
    if (have.some((g) => String(g.id) === room.id || (g.name === room.name && g.kind !== 'dm'))) continue;
    await saveGroup({ id: room.id, name: room.name, kind: 'team' }, { id: room.id });
  }
  try { localStorage.setItem(SEED_FLAG, '1'); } catch { /* ignore */ }
  if (!listMessages('team:all').length) {
    mergeMessage({
      id: 'welcome-all',
      group_id: 'team:all',
      author_email: 'ops@delkorfiberk.com',
      author_name: 'Operations Hub',
      subject: 'Staff desk',
      body: 'This is the company room. Pick a name under People for a private chat. Groups are team rooms. Messages go to the company table so every signed-in desk can see them.',
      created_at: new Date().toISOString(),
    });
  }
  return listGroups();
}

export function lastMessage(groupId) {
  const rows = listMessages(groupId);
  return rows.length ? rows[rows.length - 1] : null;
}

export function unreadIn(groupId, meEmail) {
  const mine = String(meEmail || '').toLowerCase();
  let seen = '';
  try { seen = String((readLs(READ_KEY, {}) || {})[groupId] || ''); } catch { seen = ''; }
  return listMessages(groupId).filter((m) => {
    if (String(m.id) === 'welcome-all') return false;
    if (seen && String(m.created_at || '') <= seen) return false;
    return String(m.author_email || '').toLowerCase() !== mine;
  }).length;
}

export function markRead(groupId) {
  if (!groupId) return;
  const map = readLs(READ_KEY, {}) || {};
  map[groupId] = new Date().toISOString();
  writeLs(READ_KEY, map);
}

export function subscribeComm(onRow) {
  const seen = new Set(listMessages().map((m) => String(m.id)));
  const handler = (ev) => {
    const row = ev?.data?.row;
    if (!row?.id || ev?.data?.type !== 'msg') return;
    mergeMessage(row);
    seen.add(String(row.id));
    try { onRow(row); } catch { /* listener */ }
  };
  const ch = bus();
  try { ch?.addEventListener('message', handler); } catch { /* ignore */ }
  const channels = [];
  try {
    channels.push(
      supabase.channel('comm-msg')
        .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'app_comm_messages' }, (payload) => {
          if (payload?.new) {
            mergeMessage(payload.new);
            seen.add(String(payload.new.id));
            try { onRow(payload.new); } catch { /* listener */ }
          }
        })
        .subscribe(),
    );
  } catch { /* local */ }
  try {
    channels.push(
      supabase.channel('comm-msg-legacy')
        .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'messages' }, (payload) => {
          if (!payload?.new) return;
          const row = unpackLegacy(payload.new);
          mergeMessage(row);
          seen.add(String(row.id));
          try { onRow(row); } catch { /* listener */ }
        })
        .subscribe(),
    );
  } catch { /* optional */ }

  let busy = false;
  async function tick() {
    if (busy) return;
    busy = true;
    try {
      await pullMessages();
      for (const m of listMessages()) {
        const id = String(m.id);
        if (seen.has(id)) continue;
        seen.add(id);
        try { onRow(m); } catch { /* listener */ }
      }
    } catch { /* keep polling */ }
    busy = false;
  }
  const iv = setInterval(tick, 2000);
  tick();
  return () => {
    clearInterval(iv);
    try { ch?.removeEventListener('message', handler); } catch { /* ignore */ }
    channels.forEach((sub) => { try { supabase.removeChannel(sub); } catch { /* ignore */ } });
  };
}

export function dmKey(emailA, emailB) {
  const [a, b] = [String(emailA || '').toLowerCase(), String(emailB || '').toLowerCase()].filter(Boolean).sort();
  return 'dm:' + a + '|' + b;
}

export function staffLabel(u) {
  if (!u) return 'Staff';
  return u.full_name || [u.first_name, u.last_name].filter(Boolean).join(' ') || String(u.email || '').split('@')[0] || 'Staff';
}

export async function listStaff({ excludeEmail } = {}) {
  const skip = String(excludeEmail || '').toLowerCase();
  let rows = [];
  try {
    const { data, error } = await supabase
      .from('profiles')
      .select('id,email,full_name,first_name,last_name,role,role_name,is_active')
      .limit(400);
    if (!error && Array.isArray(data) && data.length) rows = data;
  } catch { /* local book */ }
  if (!rows.length) {
    try {
      const { loadRows } = await import('./ls-rows.js');
      const { KEYS, SEED_USERS, isDemoUser } = await import('./catalog-seed.js');
      rows = await loadRows('profiles', KEYS.users, SEED_USERS);
      rows = (rows || []).filter((u) => !isDemoUser(u));
    } catch {
      try { rows = JSON.parse(localStorage.getItem('df_users') || '[]'); } catch { rows = []; }
    }
  }
  const seen = new Set();
  return (rows || []).filter((u) => {
    const email = String(u?.email || '').toLowerCase();
    if (!email || seen.has(email)) return false;
    if (skip && email === skip) return false;
    if (u.is_active === false) return false;
    seen.add(email);
    return true;
  }).map((u) => ({
    id: u.id,
    email: String(u.email || '').toLowerCase(),
    full_name: staffLabel(u),
    role: u.role_name || u.role || '',
  })).sort((a, b) => String(a.full_name).localeCompare(String(b.full_name)));
}

export async function ensureDm({ meEmail, meName, other }) {
  const email = String(other?.email || '').toLowerCase();
  const mine = String(meEmail || '').toLowerCase();
  if (!email || !mine || email === mine) return { error: { message: 'Pick another person' } };
  const id = dmKey(mine, email);
  const existing = listGroups().find((g) => String(g.id) === id);
  if (existing) return { data: existing, error: null };
  return saveGroup({
    id,
    name: staffLabel(other),
    kind: 'dm',
    members: [mine, email],
  }, { id });
}

export function otherInDm(group, meEmail) {
  const mine = String(meEmail || '').toLowerCase();
  const members = Array.isArray(group?.members) ? group.members : [];
  const hit = members.find((e) => String(e).toLowerCase() !== mine);
  if (hit) return { email: String(hit).toLowerCase(), full_name: group.name };
  const rest = String(group?.id || '').replace(/^dm:/, '').split('|').filter((e) => e && e !== mine);
  return rest[0] ? { email: rest[0], full_name: group?.name || rest[0] } : null;
}

export function listAnnouncements() {
  return listAllNotices().filter((n) => n.kind === 'announcement');
}

export async function pullAnnouncements() {
  try {
    const { data, error } = await supabase
      .from('app_notifications')
      .select('*')
      .eq('kind', 'announcement')
      .order('created_at', { ascending: false })
      .limit(200);
    if (!error && Array.isArray(data) && data.length) {
      await pullAllNotices();
    } else {
      await pullAllNotices();
    }
  } catch {
    try { await pullAllNotices(); } catch { /* local */ }
  }
  return listAnnouncements();
}

export async function postAnnouncement({ title, body, author_email }) {
  return pushNotice({
    email: 'broadcast',
    title: title || 'Announcement',
    body: body || '',
    kind: 'announcement',
    href: '/communications.html?tab=announce',
    meta: { author: author_email || '' },
  });
}
