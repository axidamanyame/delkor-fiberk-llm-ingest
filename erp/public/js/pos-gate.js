import { registerClickGuard, PRIORITY } from './click-router.js';
/**
 * Own-till bypass + PIN gate.
 * Default till PIN for every current user is 1234 until they change it.
 */
import { supabase } from './supabaseClient.js';
import { applyTillPair } from './scope.js';

export const DEFAULT_TILL_PIN = '1234';
const PIN_KEY = 'df_till_pin';

export function readLocalPin() {
  try { return localStorage.getItem(PIN_KEY) || DEFAULT_TILL_PIN; } catch { return DEFAULT_TILL_PIN; }
}

export function writeLocalPin(pin) {
  try { localStorage.setItem(PIN_KEY, String(pin || DEFAULT_TILL_PIN)); } catch { /* ignore */ }
}

export async function loadTillPin(userId) {
  const local = readLocalPin();
  if (!userId) return local;
  try {
    const { data, error } = await supabase.from('profiles').select('*').eq('id', userId).maybeSingle();
    if (error && /pos_pin|till_pin|column/i.test(error.message || '')) {
      return local;
    }
    const pin = data?.pos_pin || data?.till_pin;
    if (pin) {
      writeLocalPin(pin);
      return String(pin);
    }
  } catch { /* column may be missing */ }
  writeLocalPin(local || DEFAULT_TILL_PIN);
  return local || DEFAULT_TILL_PIN;
}

export function askTillPin(expected, label = 'Enter till PIN') {
  const want = String(expected || DEFAULT_TILL_PIN);
  const got = window.prompt(label + ' (default for current users is 1234)');
  if (got == null) return false;
  return String(got).trim() === want;
}

export async function findMyOpenSession(userId) {
  if (!userId) return null;
  const { data } = await supabase
    .from('pos_sessions')
    .select('*')
    .eq('status', 'open')
    .eq('cashier_id', userId)
    .order('opened_at', { ascending: false })
    .limit(5);
  const now = Date.now();
  const fresh = (data || []).find((s) => {
    const t = Date.parse(s.opened_at || s.created_at || 0);
    if (!t) return true;
    return (now - t) < 18 * 60 * 60 * 1000;
  });
  return fresh ? applyTillPair(fresh) : null;
}

export function tillUrl(sessionId, repair = false) {
  return (repair ? '/repair-till.html' : '/pos.html') + '?session=' + encodeURIComponent(sessionId);
}

export function tillUnlocked() {
  try { return sessionStorage.getItem('df_till_ok') === '1'; } catch { return false; }
}

/** Header / menu POS click: one till login. Never a second open-register screen. */
export function tillLoginUrl(repair = false) {
  return '/till-login.html' + (repair ? '?mode=repair' : '');
}

export async function goToRegister({ userId, repair = false } = {}) {
  try {
    const mine = await findMyOpenSession(userId);
    if (mine?.id && tillUnlocked()) {
      location.assign(tillUrl(mine.id, repair));
      return mine;
    }
  } catch { /* pin first */ }
  if (!/till-login\.html/i.test(location.pathname)) {
    location.assign(tillLoginUrl(repair));
  }
  return null;
}

export function isTillStayUrl(href) {
  if (!href) return true;
  const raw = String(href).trim();
  if (!raw || raw.startsWith('#') || raw.toLowerCase().startsWith('javascript:')) return true;
  if (/^(mailto|tel|whatsapp|sms):/i.test(raw)) return true;
  try {
    const u = new URL(raw, location.href);
    if (u.origin !== location.origin) return true;
    const file = (u.pathname.split('/').pop() || '').toLowerCase();
    return /^(pos|repair-till|customer-display)\.html$/.test(file);
  } catch {
    return true;
  }
}

export async function closeTillSession(sessionId) {
  if (!sessionId) return { ok: false, error: { message: 'No till' } };
  try { sessionStorage.removeItem('df_pos_session_' + sessionId); } catch { /* ignore */ }
  if (String(sessionId).startsWith('local-')) return { ok: true };
  const patch = { status: 'closed', closed_at: new Date().toISOString() };
  let { error } = await supabase.from('pos_sessions').update(patch).eq('id', sessionId);
  if (error) {
    const r = await supabase.from('pos_sessions').update({ status: 'closed' }).eq('id', sessionId);
    error = r.error;
  }
  return { ok: !error, error };
}

export function promptCloseTill() {
  return new Promise((resolve) => {
    const wrap = document.createElement('div');
    wrap.id = 'df-till-exit';
    wrap.style.cssText = 'position:fixed;inset:0;background:rgba(15,23,42,.6);z-index:12000;display:flex;align-items:center;justify-content:center;padding:16px';
    wrap.innerHTML = `
      <div role="dialog" aria-labelledby="till-exit-title" style="background:#fff;color:#111;border-radius:14px;max-width:420px;width:100%;padding:22px;box-shadow:0 24px 48px rgba(0,0,0,.28)">
        <h3 id="till-exit-title" style="margin:0 0 8px;font-size:18px">Leave this till?</h3>
        <p style="margin:0 0 16px;line-height:1.45;color:#334155">This register stays assigned to you until it is closed. Close it before leaving so another cashier cannot inherit this till.</p>
        <div style="display:flex;justify-content:flex-end;gap:8px;flex-wrap:wrap">
          <button type="button" data-stay style="border:1px solid #111;background:#fff;color:#111;border-radius:8px;padding:10px 14px;cursor:pointer;font-weight:700">Stay on till</button>
          <button type="button" data-close style="border:0;background:#b91c1c;color:#fff;border-radius:8px;padding:10px 16px;cursor:pointer;font-weight:800">Close register</button>
        </div>
      </div>`;
    document.body.appendChild(wrap);
    const done = (v) => { wrap.remove(); resolve(v); };
    wrap.querySelector('[data-stay]').onclick = () => done(false);
    wrap.querySelector('[data-close]').onclick = () => done(true);
    wrap.addEventListener('click', (e) => { if (e.target === wrap) done(false); });
  });
}

export async function leaveTillOrStay(sessionId, dest = '/dashboard.html') {
  if (window.__dfTillLeaveOk) {
    location.assign(dest);
    return true;
  }
  const close = await promptCloseTill();
  if (!close) return false;
  try {
    if (typeof window.__dfSaveClosedRegister === 'function') await window.__dfSaveClosedRegister();
  } catch (e) { console.warn('register report', e); }
  const r = await closeTillSession(sessionId);
  if (!r.ok) {
    alert(r.error?.message || 'Could not close this register.');
    return false;
  }
  window.__dfTillLeaveOk = true;
  location.assign(dest);
  return true;
}

export function installTillExitGuard(sessionId) {
  if (!sessionId || window.__dfTillGuard) return;
  window.__dfTillGuard = true;
  window.__dfTillSessionId = sessionId;

  registerClickGuard({
    name: 'till-exit',
    priority: PRIORITY.exit,
    match: (origin) => origin?.closest?.('a[href]'),
    claim: (a) => {
      if (a.target === '_blank' || a.hasAttribute('download')) return 'pass';
      if (isTillStayUrl(a.getAttribute('href'))) return 'pass';
      leaveTillOrStay(sessionId, a.href);
      return 'claim';
    },
  });

  history.pushState({ till: sessionId }, '', location.href);
  window.addEventListener('popstate', () => {
    if (window.__dfTillLeaveOk) return;
    history.pushState({ till: sessionId }, '', location.href);
    leaveTillOrStay(sessionId, '/dashboard.html');
  });
}

export function isFullscreen() {
  return !!(document.fullscreenElement || document.webkitFullscreenElement || document.msFullscreenElement);
}

export function toggleFullscreen() {
  try {
    if (isFullscreen()) {
      const ex = document.exitFullscreen || document.webkitExitFullscreen || document.msExitFullscreen;
      return ex ? ex.call(document) : Promise.resolve();
    }
    const root = document.documentElement;
    const req = root.requestFullscreen || root.webkitRequestFullscreen || root.msRequestFullscreen;
    return req ? req.call(root) : Promise.resolve();
  } catch (e) {
    console.warn('fullscreen', e);
    return Promise.resolve();
  }
}

export function ensureFsExit() {
  if (document.getElementById('fs-exit')) return;
  const b = document.createElement('button');
  b.id = 'fs-exit';
  b.type = 'button';
  b.className = 'fs-exit';
  b.textContent = 'Exit full screen';
  b.addEventListener('click', (e) => {
    e.preventDefault();
    toggleFullscreen();
  });
  document.body.appendChild(b);
  const sync = () => {
    const on = isFullscreen();
    b.hidden = !on;
    document.body.classList.toggle('is-fs', on);
    document.querySelectorAll('#tool-fs, #btn-fs, #hdr-fs').forEach((el) => {
      el.title = on ? 'Exit full screen' : 'Full screen';
      if (el.id === 'tool-fs' || el.id === 'hdr-fs') el.innerHTML = on ? '✕' : '⛶';
    });
  };
  document.addEventListener('fullscreenchange', sync);
  document.addEventListener('webkitfullscreenchange', sync);
  document.addEventListener('MSFullscreenChange', sync);
  sync();
}
