/**
 * Internal 1-to-1 WebRTC + team Meet, on top of Communication.
 * Signaling rides the existing Supabase realtime channel (broadcast + optional SQL).
 * Google Meet cannot be iframed (Google blocks it) — Meet opens a join window and
 * copies the link. Team room stays in this window via a named in-ERP room.
 */
import { supabase } from './supabaseClient.js';
import { uid, readLs, writeLs } from './ls-rows.js';
import { peelWrite } from './account-rules.js';
import { getAccess } from './rbac.js';

export const CALL_KEY = 'df_comm_calls';
export const MEET_KEY = 'df_comm_meetings';

const RTC_CONFIG = {
  iceServers: [
    { urls: 'stun:stun.l.google.com:19302' },
    { urls: 'stun:stun1.l.google.com:19302' },
  ],
};

const CHANNEL = 'df-staff-calls';
const RING_MS = 45000;

let installed = false;
let channel = null;
let pc = null;
let localStream = null;
let remoteStream = null;
let iceQueue = [];
let inCall = false;
let currentPeer = null;
let pendingOffer = null;
let pendingRequest = null;
let callId = null;
let callKind = 'video';
let callStartedAt = 0;
let ringTimer = null;
let ringAudio = null;
let cameraTrack = null;

function me() {
  const a = getAccess() || {};
  return {
    id: a.userId || '',
    email: String(a.email || '').toLowerCase(),
    name: a.fullName || String(a.email || '').split('@')[0] || 'Staff',
    role: a.roleName || '',
    gated: !!a.gated,
  };
}

export function canPlaceCall(access) {
  const a = access || getAccess();
  if (!a || a.gated) return false;
  const k = String(a.roleName || '').replace(/[\s_-]/g, '').toLowerCase();
  if (k === 'pending' || k === 'viewer') return false;
  return true;
}

export function listCalls() {
  const rows = readLs(CALL_KEY, []);
  return Array.isArray(rows) ? rows : [];
}

export function listMeetings() {
  const rows = readLs(MEET_KEY, []);
  return Array.isArray(rows) ? rows : [];
}

function persistCall(row) {
  const rows = listCalls();
  const i = rows.findIndex((r) => String(r.id) === String(row.id));
  if (i >= 0) rows[i] = { ...rows[i], ...row };
  else rows.unshift(row);
  writeLs(CALL_KEY, rows.slice(0, 200));
  peelWrite('app_comm_calls', {
    id: row.id,
    from_email: row.from_email,
    from_name: row.from_name,
    to_email: row.to_email,
    to_name: row.to_name,
    kind: row.kind,
    status: row.status,
    started_at: row.started_at,
    ended_at: row.ended_at || null,
    duration_s: row.duration_s || null,
  }, { id: row.id }).catch(() => {});
  return row;
}

function persistMeeting(row) {
  const rows = listMeetings();
  const i = rows.findIndex((r) => String(r.id) === String(row.id));
  if (i >= 0) rows[i] = { ...rows[i], ...row };
  else rows.unshift(row);
  writeLs(MEET_KEY, rows.slice(0, 200));
  peelWrite('app_comm_meetings', row, { id: row.id }).catch(() => {});
  return row;
}

function isForMe(msg) {
  const u = me();
  const to = String(msg?.to || '').toLowerCase();
  const toId = String(msg?.toId || '');
  if (to && u.email && to === u.email) return true;
  if (toId && u.id && toId === u.id) return true;
  return false;
}

function isFromMe(msg) {
  const u = me();
  return (u.email && String(msg?.from || '').toLowerCase() === u.email)
    || (u.id && String(msg?.fromId || '') === u.id);
}

async function sendSignal(payload) {
  const u = me();
  const body = {
    ...payload,
    from: payload.from || u.email,
    fromName: payload.fromName || u.name,
    fromId: payload.fromId || u.id,
    at: Date.now(),
  };
  try {
    if (!channel) await subscribeSignals();
    await channel.send({ type: 'broadcast', event: 'signal', payload: body });
  } catch { /* local */ }
  try {
    await supabase.from('app_comm_signals').insert({
      id: uid(),
      call_id: body.callId || callId || null,
      from_email: body.from,
      to_email: body.to || null,
      kind: body.type,
      payload: body,
    });
  } catch { /* table may not exist yet */ }
}

async function subscribeSignals() {
  if (channel) return channel;
  try {
    channel = supabase.channel(CHANNEL, { config: { broadcast: { ack: true } } });
    channel.on('broadcast', { event: 'signal' }, ({ payload }) => {
      try { onSignal(payload); } catch { /* ignore */ }
    });
    try {
      channel.on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'app_comm_signals' }, (p) => {
        const msg = p?.new?.payload || p?.new;
        try { onSignal(msg); } catch { /* ignore */ }
      });
    } catch { /* no table realtime */ }
    await channel.subscribe();
  } catch {
    channel = null;
  }
  return channel;
}

function onSignal(msg) {
  if (!msg || typeof msg !== 'object') return;
  if (isFromMe(msg) && msg.type !== 'call-end') return;
  if (msg.type !== 'call-end' && !isForMe(msg) && msg.type !== 'ice-candidate') {
    if (msg.type === 'ice-candidate' && callId && msg.callId === callId) {
      /* ICE for our call */
    } else if (!isForMe(msg)) return;
  }
  switch (msg.type) {
    case 'call-request': handleRequest(msg); break;
    case 'call-offer': handleOffer(msg); break;
    case 'call-answer': handleAnswer(msg); break;
    case 'ice-candidate': handleIce(msg); break;
    case 'call-decline': handleDecline(msg); break;
    case 'call-busy': handleBusy(msg); break;
    case 'call-end': handleRemoteEnd(msg); break;
    default: break;
  }
}

function statusLine(text) {
  const el = document.getElementById('df-call-status');
  if (el) el.textContent = text || '';
}

function show(el, on) {
  if (!el) return;
  el.style.display = on ? 'flex' : 'none';
}

function injectDom() {
  if (document.getElementById('df-call-modal')) return;
  if (!document.getElementById('df-call-css')) {
    const s = document.createElement('style');
    s.id = 'df-call-css';
    s.textContent = `
      .df-call-modal,.df-meet-modal{position:fixed;inset:0;background:rgba(15,23,42,.55);display:none;justify-content:center;align-items:center;z-index:9999}
      .df-call-box,.df-meet-box{width:min(960px,92vw);height:min(640px,90vh);background:#fff;border-radius:12px;overflow:hidden;box-shadow:0 8px 24px rgba(0,0,0,.25);display:flex;flex-direction:column}
      .df-call-hd,.df-meet-hd{padding:10px 14px;background:#0f172a;color:#f8fafc;display:flex;justify-content:space-between;align-items:center;font-weight:700}
      .df-call-hd button,.df-meet-hd button{background:transparent;border:0;color:#f8fafc;font-size:18px;cursor:pointer}
      .df-call-vids{flex:1;display:flex;gap:10px;padding:10px;background:#020617;min-height:0}
      .df-call-vids video{width:50%;height:100%;background:#111;border-radius:8px;object-fit:cover}
      .df-call-ctrls{padding:10px;display:flex;justify-content:center;gap:10px;flex-wrap:wrap;background:#f1f5f9}
      .df-call-ctrls button{border:0;border-radius:8px;padding:10px 14px;font-weight:700;cursor:pointer;background:#fff;border:1px solid #cbd5e1}
      .df-call-ctrls .end{background:#b91c1c;color:#fff;border-color:#b91c1c}
      .df-call-status{text-align:center;padding:6px;color:#3d4f66;font-size:13px;background:#f8fafc}
      .df-inring{position:fixed;bottom:20px;right:20px;background:#0f172a;color:#f8fafc;padding:16px 18px;border-radius:12px;display:none;z-index:10000;box-shadow:0 8px 24px rgba(0,0,0,.3);min-width:240px}
      .df-inring .who{font-weight:800;margin:0 0 10px}
      .df-inring .btns{display:flex;gap:8px}
      .df-inring .btns button{flex:1;border:0;border-radius:8px;padding:10px;font-weight:700;cursor:pointer}
      .df-inring .ok{background:#16a34a;color:#fff}
      .df-inring .no{background:#b91c1c;color:#fff}
      .df-meet-body{flex:1;display:flex;flex-direction:column;min-height:0}
      .df-meet-tools{display:flex;gap:8px;flex-wrap:wrap;padding:10px 14px;border-bottom:1px solid #e2e8f0;background:#f8fafc}
      .df-meet-tools input{flex:1;min-width:180px;padding:8px 10px;border:1px solid #cbd5e1;border-radius:8px}
      .df-meet-frame{flex:1;border:0;width:100%;background:#0f172a}
      .df-meet-note{padding:8px 14px;font-size:12px;color:#3d4f66}
      @media (max-width:720px){
        .df-call-box,.df-meet-box{width:100%;height:100%;border-radius:0}
        .df-call-vids{flex-direction:column}
        .df-call-vids video{width:100%;height:50%}
        .df-inring{left:12px;right:12px;bottom:72px}
      }`;
    document.head.appendChild(s);
  }
  const wrap = document.createElement('div');
  wrap.innerHTML = `
    <div id="df-call-modal" class="df-call-modal" role="dialog" aria-label="Call">
      <div class="df-call-box">
        <div class="df-call-hd"><span id="df-call-title">Call</span><button type="button" id="df-call-x" aria-label="Close">✕</button></div>
        <div class="df-call-status" id="df-call-status">Connecting…</div>
        <div class="df-call-vids">
          <video id="df-local-video" autoplay muted playsinline></video>
          <video id="df-remote-video" autoplay playsinline></video>
        </div>
        <div class="df-call-ctrls">
          <button type="button" id="df-call-mic">Mic</button>
          <button type="button" id="df-call-cam">Camera</button>
          <button type="button" id="df-call-share">Share screen</button>
          <button type="button" class="end" id="df-call-end">End</button>
        </div>
      </div>
    </div>
    <div id="df-meet-modal" class="df-meet-modal" role="dialog" aria-label="Meeting">
      <div class="df-meet-box">
        <div class="df-meet-hd"><span id="df-meet-title">Team meeting</span><button type="button" id="df-meet-x" aria-label="Close">✕</button></div>
        <div class="df-meet-body">
          <div class="df-meet-tools">
            <input id="df-meet-url" placeholder="Google Meet code or https://meet.google.com/…" />
            <button type="button" class="ult-btn" id="df-meet-open">Open Google Meet</button>
            <button type="button" class="ult-btn ult-btn-outline" id="df-meet-copy">Copy link</button>
            <button type="button" class="ult-btn ult-btn-outline" id="df-meet-chat">Share in chat</button>
            <button type="button" class="ult-btn" id="df-meet-room">Stay in this window</button>
          </div>
          <p class="df-meet-note" id="df-meet-note">Google Meet cannot sit inside this page — it opens a join window. Stay in this window uses the team room here.</p>
          <iframe id="df-meet-frame" class="df-meet-frame" allow="camera; microphone; display-capture; autoplay; fullscreen"></iframe>
        </div>
      </div>
    </div>
    <div id="df-inring" class="df-inring" role="alertdialog">
      <div class="who"><span id="df-inring-name">Someone</span> is calling…</div>
      <div class="btns">
        <button type="button" class="ok" id="df-inring-ok">Accept</button>
        <button type="button" class="no" id="df-inring-no">Decline</button>
      </div>
    </div>`;
  document.body.appendChild(wrap);
  document.getElementById('df-call-x').onclick = () => endCall(false);
  document.getElementById('df-call-end').onclick = () => endCall(false);
  document.getElementById('df-call-mic').onclick = toggleMic;
  document.getElementById('df-call-cam').onclick = toggleCamera;
  document.getElementById('df-call-share').onclick = shareScreen;
  document.getElementById('df-meet-x').onclick = closeMeetModal;
  document.getElementById('df-meet-open').onclick = openGoogleMeet;
  document.getElementById('df-meet-copy').onclick = copyMeetLink;
  document.getElementById('df-meet-room').onclick = loadInWindowRoom;
  document.getElementById('df-meet-chat').onclick = () => {
    const url = meetLinkFrom(document.getElementById('df-meet-url')?.value)
      || ('https://meet.jit.si/' + encodeURIComponent(meetRoom || 'DelkorFiberk'));
    if (meetShare) meetShare(url);
    else copyMeetLink();
  };
  document.getElementById('df-inring-ok').onclick = () => acceptCall();
  document.getElementById('df-inring-no').onclick = () => declineCall();
}

function openCallModal(title) {
  injectDom();
  document.getElementById('df-call-title').textContent = title || 'Call';
  show(document.getElementById('df-call-modal'), true);
}

function closeCallModal() {
  show(document.getElementById('df-call-modal'), false);
}

function showIncoming(name) {
  injectDom();
  document.getElementById('df-inring-name').textContent = name || 'Staff';
  show(document.getElementById('df-inring'), true);
  startRing();
}

function hideIncoming() {
  show(document.getElementById('df-inring'), false);
  stopRing();
}

function startRing() {
  stopRing();
  try {
    const ctx = new (window.AudioContext || window.webkitAudioContext)();
    const beep = () => {
      const o = ctx.createOscillator();
      const g = ctx.createGain();
      o.frequency.value = 880;
      g.gain.value = 0.04;
      o.connect(g); g.connect(ctx.destination);
      o.start();
      o.stop(ctx.currentTime + 0.18);
    };
    beep();
    ringAudio = setInterval(beep, 1600);
  } catch { /* no audio */ }
}

function stopRing() {
  if (ringTimer) { clearTimeout(ringTimer); ringTimer = null; }
  if (ringAudio) { clearInterval(ringAudio); ringAudio = null; }
}

async function setupPeer() {
  pc = new RTCPeerConnection(RTC_CONFIG);
  iceQueue = [];
  pc.onicecandidate = (e) => {
    if (e.candidate && currentPeer) {
      sendSignal({
        type: 'ice-candidate',
        to: currentPeer.email,
        toId: currentPeer.id,
        callId,
        candidate: e.candidate.toJSON ? e.candidate.toJSON() : e.candidate,
      });
    }
  };
  pc.ontrack = (e) => {
    remoteStream = e.streams[0];
    const v = document.getElementById('df-remote-video');
    if (v) v.srcObject = remoteStream;
    statusLine('Connected');
  };
  pc.onconnectionstatechange = () => {
    const st = pc?.connectionState;
    if (st === 'connected') statusLine('Connected');
    if (st === 'disconnected' || st === 'failed' || st === 'closed') {
      if (inCall) endCall(true);
    }
  };
  const wantVideo = callKind !== 'audio';
  try {
    localStream = await navigator.mediaDevices.getUserMedia({ audio: true, video: wantVideo });
  } catch {
    if (wantVideo) {
      localStream = await navigator.mediaDevices.getUserMedia({ audio: true, video: false });
      statusLine('Camera blocked — audio only');
    } else {
      throw new Error('Microphone blocked');
    }
  }
  const lv = document.getElementById('df-local-video');
  if (lv) lv.srcObject = localStream;
  cameraTrack = localStream.getVideoTracks()[0] || null;
  localStream.getTracks().forEach((t) => pc.addTrack(t, localStream));
}

function flushIce() {
  if (!pc?.remoteDescription) return;
  iceQueue.forEach((c) => { try { pc.addIceCandidate(new RTCIceCandidate(c)); } catch { /* ignore */ } });
  iceQueue = [];
}

function logStart({ from_email, from_name, to_email, to_name, kind, status }) {
  const row = {
    id: callId || uid(),
    from_email, from_name, to_email, to_name,
    kind: kind || callKind,
    status: status || 'ringing',
    started_at: new Date().toISOString(),
  };
  callId = row.id;
  persistCall(row);
  return row;
}

function logFinish(status) {
  if (!callId) return;
  const rows = listCalls();
  const cur = rows.find((r) => String(r.id) === String(callId)) || { id: callId };
  const ended = new Date().toISOString();
  const start = callStartedAt || Date.parse(cur.started_at || ended);
  persistCall({
    ...cur,
    status,
    ended_at: ended,
    duration_s: inCall && start ? Math.max(0, Math.round((Date.now() - start) / 1000)) : 0,
  });
}

export async function startCall({ toEmail, toName, toId, video = true } = {}) {
  injectDom();
  const u = me();
  if (!canPlaceCall()) {
    window.alert('Your role cannot place calls.');
    return;
  }
  const to = String(toEmail || '').toLowerCase();
  if (!to || to === u.email) {
    window.alert('Pick another person to call.');
    return;
  }
  if (inCall) {
    window.alert('Already in a call.');
    return;
  }
  currentPeer = { email: to, name: toName || to.split('@')[0], id: toId || '' };
  callKind = video ? 'video' : 'audio';
  callId = uid();
  inCall = true;
  callStartedAt = Date.now();
  openCallModal((video ? 'Video · ' : 'Call · ') + currentPeer.name);
  statusLine('Calling…');
  logStart({
    from_email: u.email, from_name: u.name,
    to_email: to, to_name: currentPeer.name,
    kind: callKind, status: 'ringing',
  });
  try {
    await setupPeer();
  } catch (e) {
    statusLine(e.message || 'Could not open microphone');
    inCall = false;
    return;
  }
  await sendSignal({
    type: 'call-request',
    to, toId: currentPeer.id, callId,
    kind: callKind, fromName: u.name,
  });
  const offer = await pc.createOffer();
  await pc.setLocalDescription(offer);
  await sendSignal({ type: 'call-offer', to, toId: currentPeer.id, callId, offer, kind: callKind });
  ringTimer = setTimeout(() => {
    if (pc && pc.connectionState !== 'connected') {
      statusLine('No answer');
      endCall(false, 'missed');
    }
  }, RING_MS);
}

function handleRequest(msg) {
  if (inCall) {
    sendSignal({ type: 'call-busy', to: msg.from, toId: msg.fromId, callId: msg.callId });
    return;
  }
  pendingRequest = msg;
  currentPeer = { email: msg.from, name: msg.fromName || msg.from, id: msg.fromId };
  callId = msg.callId || uid();
  callKind = msg.kind === 'audio' ? 'audio' : 'video';
  showIncoming(currentPeer.name);
  ringTimer = setTimeout(() => {
    if (!inCall && pendingRequest) {
      persistCall({
        id: callId,
        from_email: msg.from,
        from_name: msg.fromName,
        to_email: me().email,
        to_name: me().name,
        kind: callKind,
        status: 'missed',
        started_at: new Date().toISOString(),
        ended_at: new Date().toISOString(),
        duration_s: 0,
      });
      hideIncoming();
      pendingRequest = null;
    }
  }, RING_MS);
}

async function handleOffer(msg) {
  pendingOffer = msg.offer;
  if (msg.from) currentPeer = { email: msg.from, name: msg.fromName || msg.from, id: msg.fromId };
  callId = msg.callId || callId;
  if (inCall && pc) await applyOffer();
}

async function applyOffer() {
  if (!pendingOffer || !pc) return;
  await pc.setRemoteDescription(new RTCSessionDescription(pendingOffer));
  flushIce();
  const answer = await pc.createAnswer();
  await pc.setLocalDescription(answer);
  await sendSignal({
    type: 'call-answer',
    to: currentPeer.email,
    toId: currentPeer.id,
    callId,
    answer,
  });
  pendingOffer = null;
}

async function handleAnswer(msg) {
  if (!pc) return;
  await pc.setRemoteDescription(new RTCSessionDescription(msg.answer));
  flushIce();
  statusLine('Connected');
  const rows = listCalls();
  const cur = rows.find((r) => String(r.id) === String(callId));
  if (cur) persistCall({ ...cur, status: 'answered' });
}

function handleIce(msg) {
  if (!msg.candidate) return;
  if (callId && msg.callId && msg.callId !== callId) return;
  if (!pc || !pc.remoteDescription) { iceQueue.push(msg.candidate); return; }
  try { pc.addIceCandidate(new RTCIceCandidate(msg.candidate)); } catch { /* ignore */ }
}

function handleDecline() {
  statusLine('Declined');
  endCall(true, 'declined');
}

function handleBusy() {
  statusLine('Busy');
  endCall(true, 'busy');
}

function handleRemoteEnd() {
  endCall(true, 'ended');
}

export async function acceptCall() {
  hideIncoming();
  if (!pendingRequest && !pendingOffer) return;
  const u = me();
  inCall = true;
  callStartedAt = Date.now();
  const name = currentPeer?.name || 'Staff';
  openCallModal((callKind === 'audio' ? 'Call · ' : 'Video · ') + name);
  statusLine('Connecting…');
  logStart({
    from_email: currentPeer?.email, from_name: name,
    to_email: u.email, to_name: u.name,
    kind: callKind, status: 'answered',
  });
  try {
    await setupPeer();
    if (pendingOffer) await applyOffer();
    else statusLine('Waiting for connection…');
  } catch (e) {
    statusLine(e.message || 'Microphone blocked');
  }
}

export function declineCall() {
  hideIncoming();
  if (currentPeer) {
    sendSignal({ type: 'call-decline', to: currentPeer.email, toId: currentPeer.id, callId });
    persistCall({
      id: callId || uid(),
      from_email: currentPeer.email,
      from_name: currentPeer.name,
      to_email: me().email,
      to_name: me().name,
      kind: callKind,
      status: 'declined',
      started_at: new Date().toISOString(),
      ended_at: new Date().toISOString(),
      duration_s: 0,
    });
  }
  pendingRequest = null;
  pendingOffer = null;
  currentPeer = null;
}

function toggleMic() {
  const t = localStream?.getAudioTracks()?.[0];
  if (!t) return;
  t.enabled = !t.enabled;
  const b = document.getElementById('df-call-mic');
  if (b) b.textContent = t.enabled ? 'Mic' : 'Mic off';
}

function toggleCamera() {
  const t = localStream?.getVideoTracks()?.[0];
  if (!t) return;
  t.enabled = !t.enabled;
  const b = document.getElementById('df-call-cam');
  if (b) b.textContent = t.enabled ? 'Camera' : 'Camera off';
}

async function shareScreen() {
  if (!pc) return;
  try {
    const ds = await navigator.mediaDevices.getDisplayMedia({ video: true });
    const track = ds.getVideoTracks()[0];
    const sender = pc.getSenders().find((s) => s.track && s.track.kind === 'video');
    if (sender) await sender.replaceTrack(track);
    const lv = document.getElementById('df-local-video');
    if (lv) lv.srcObject = ds;
    track.onended = async () => {
      if (cameraTrack && sender) await sender.replaceTrack(cameraTrack);
      if (lv && localStream) lv.srcObject = localStream;
    };
  } catch { /* user cancelled */ }
}

export function endCall(remoteEnded = false, status = 'ended') {
  stopRing();
  hideIncoming();
  const peer = currentPeer;
  try { pc?.close(); } catch { /* ignore */ }
  pc = null;
  try { localStream?.getTracks()?.forEach((t) => t.stop()); } catch { /* ignore */ }
  localStream = null;
  remoteStream = null;
  cameraTrack = null;
  iceQueue = [];
  pendingOffer = null;
  pendingRequest = null;
  const lv = document.getElementById('df-local-video');
  const rv = document.getElementById('df-remote-video');
  if (lv) lv.srcObject = null;
  if (rv) rv.srcObject = null;
  if (inCall || callId) logFinish(status);
  const wasIn = inCall;
  inCall = false;
  currentPeer = null;
  callStartedAt = 0;
  closeCallModal();
  if (!remoteEnded && wasIn && peer) {
    sendSignal({ type: 'call-end', to: peer.email, toId: peer.id, callId });
  }
  callId = null;
}

let meetShare = null;
let meetRoom = 'DelkorFiberk';

function meetLinkFrom(raw) {
  const v = String(raw || '').trim();
  if (!v) return '';
  if (/^https?:\/\//i.test(v)) return v;
  const code = v.replace(/\s/g, '');
  if (/^[a-z]{3}-[a-z]{4}-[a-z]{3}$/i.test(code)) return 'https://meet.google.com/' + code.toLowerCase();
  if (/^[a-z0-9-]{8,}$/i.test(code)) return 'https://meet.google.com/' + code;
  return v;
}

export async function openMeetModal({ title, groupId, room, meetCode, onShare } = {}) {
  injectDom();
  meetShare = typeof onShare === 'function' ? onShare : null;
  meetRoom = String(room || ('DelkorFiberk-' + String(title || 'Team').replace(/[^a-z0-9]+/gi, '').slice(0, 24))) || 'DelkorFiberk';
  document.getElementById('df-meet-title').textContent = title || 'Team meeting';
  let code = meetCode || '';
  if (!code) {
    try {
      const { loadBizSettings } = await import('./settings-store.js');
      const biz = await loadBizSettings();
      code = biz?.meet_code || biz?.meet_url || '';
    } catch { /* empty */ }
  }
  document.getElementById('df-meet-url').value = code || '';
  show(document.getElementById('df-meet-modal'), true);
  const host = me();
  persistMeeting({
    id: uid(),
    title: title || 'Team meeting',
    room: meetRoom,
    meet_url: meetLinkFrom(code) || '',
    host_email: host.email,
    host_name: host.name,
    group_id: groupId || '',
    started_at: new Date().toISOString(),
  });
  loadInWindowRoom();
}

export function closeMeetModal() {
  const frame = document.getElementById('df-meet-frame');
  if (frame) frame.src = 'about:blank';
  show(document.getElementById('df-meet-modal'), false);
  meetShare = null;
}

function loadInWindowRoom() {
  const frame = document.getElementById('df-meet-frame');
  if (!frame) return;
  const room = encodeURIComponent(meetRoom || 'DelkorFiberk');
  frame.src = 'https://meet.jit.si/' + room + '#config.prejoinPageEnabled=false';
}

function openGoogleMeet() {
  const url = meetLinkFrom(document.getElementById('df-meet-url')?.value) || 'https://meet.google.com/new';
  try { window.open(url, 'df-gmeet', 'noopener,width=1080,height=720'); } catch {
    location.href = url;
  }
}

async function copyMeetLink() {
  const url = meetLinkFrom(document.getElementById('df-meet-url')?.value)
    || ('https://meet.jit.si/' + encodeURIComponent(meetRoom || 'DelkorFiberk'));
  try { await navigator.clipboard.writeText(url); } catch { /* ignore */ }
  const n = document.getElementById('df-meet-note');
  if (n) n.textContent = 'Copied: ' + url;
}

export async function installCallListener() {
  if (installed) return;
  installed = true;
  injectDom();
  try { const { loadAccess } = await import('./rbac.js'); await loadAccess(); } catch { /* ignore */ }
  await subscribeSignals();
}
