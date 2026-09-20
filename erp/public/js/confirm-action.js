/** Confirm / Cancel card before write operations, then a result acknowledgement. */
import { isDeletePrompt, promptDeleteKey } from './delete-guard.js';

export async function copyText(value) {
  const text = String(value ?? '');
  if (!text) return false;
  const inFrame = (() => { try { return window.top !== window; } catch { return true; } })();
  const viaExec = () => {
    const ta = document.createElement('textarea');
    ta.value = text;
    ta.setAttribute('readonly', '');
    ta.style.cssText = 'position:fixed;top:0;left:0;width:2px;height:2px;padding:0;border:0;opacity:0.01;z-index:2147483647';
    document.body.appendChild(ta);
    ta.focus();
    ta.select();
    ta.setSelectionRange(0, text.length);
    const ok = document.execCommand('copy');
    ta.remove();
    return !!ok;
  };
  if (inFrame) {
    try { if (viaExec()) return true; } catch { /* ignore */ }
  }
  try {
    if (navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(text);
      return true;
    }
  } catch { /* iframe / permission */ }
  if (!inFrame) {
    try { if (viaExec()) return true; } catch { /* ignore */ }
  }
  return false;
}

const ACK_KEY = 'df_ack';
let pending = null;
let autoTimer = 0;

const POP_CSS = `
.df-pop{position:fixed;inset:0;background:rgba(15,23,42,.55);display:flex;justify-content:center;align-items:center;z-index:20000;opacity:0;animation:dfPopIn .25s forwards;padding:16px}
.df-pop.fade-out{animation:dfPopOut .25s forwards}
@keyframes dfPopIn{from{opacity:0}to{opacity:1}}
@keyframes dfPopOut{from{opacity:1}to{opacity:0}}
.df-pop-card{background:#fff;color:#0b1220;padding:0 28px 24px;width:min(400px,calc(100vw - 32px));border-radius:20px;text-align:center;box-shadow:0 28px 60px rgba(15,23,42,.32);font-family:Inter,system-ui,sans-serif;overflow:hidden}
.df-pop-card::before{content:'';display:block;height:8px;margin:0 -28px 20px;background:linear-gradient(90deg,#2563eb,#06b6d4)}
.df-pop[data-confirm-card] .df-pop-card::before{background:linear-gradient(90deg,#f59e0b,#ea580c)}
.df-pop-card:has(.df-pop-btn.danger)::before{background:linear-gradient(90deg,#dc2626,#e11d48)}
.df-pop-ico{width:56px;height:56px;border-radius:16px;margin:0 auto 12px;display:flex;align-items:center;justify-content:center;font-size:28px;color:#1d4ed8;line-height:1;background:#eff6ff}
.df-pop-ico.bad{color:#b91c1c;background:#fef2f2}
.df-pop-card h2{margin:0 0 10px;font-size:22px;font-weight:800;color:#0b1220}
.df-pop-card p{margin:0 0 10px;font-size:15px;line-height:1.5;color:#334155}
.df-pop-card p strong{display:inline-block;color:#0b1220;font-size:15px;margin-top:2px}
.df-pop-btn{margin-top:12px;padding:12px 20px;width:100%;background:#2563EB;color:#fff;border:none;border-radius:12px;font-size:16px;font-weight:800;cursor:pointer}
.df-pop-btn.danger{background:#DC2626}
.df-pop-btn.ghost{margin-top:8px;background:#f1f5f9;color:#0f172a;border:1px solid #CBD5E1}
.df-pop-card input[type="password"],.df-pop-card input[type="text"],.df-pop-card input[readonly]{width:100%;box-sizing:border-box;border:1px solid #CBD5E1;border-radius:8px;padding:10px 12px;font-size:15px;margin-top:6px;text-align:left}
.df-pop-card .df-pop-err{display:none;margin:8px 0 0;color:#b91c1c;font-size:13px;text-align:left}
.df-pop-work{margin-top:14px;height:4px;background:#e5e7eb;border-radius:99px;overflow:hidden}
.df-pop-work>i{display:block;height:100%;width:40%;background:#2563EB;border-radius:99px;animation:dfack 1s ease-in-out infinite}
@keyframes dfack{0%{transform:translateX(-100%)}100%{transform:translateX(350%)}}
`;

export function ensurePopCss() {
  if (typeof document === 'undefined') return;
  if (document.getElementById('df-pop-css')) return;
  const s = document.createElement('style');
  s.id = 'df-pop-css';
  s.textContent = POP_CSS;
  document.head.appendChild(s);
}

function esc(s) {
  return String(s ?? '').replace(/[&<>"']/g, (ch) => {
    if (ch === '&') return '&' + 'amp;';
    if (ch === '<') return '&' + 'lt;';
    if (ch === '>') return '&' + 'gt;';
    if (ch === '"') return '&' + 'quot;';
    return '&#39;';
  });
}

function openPop(inner, id = 'df-ack-root') {
  ensurePopCss();
  document.getElementById(id)?.remove();
  const wrap = document.createElement('div');
  wrap.id = id;
  wrap.className = 'df-pop';
  wrap.setAttribute('data-ack-card', '1');
  wrap.innerHTML = `<div class="df-pop-card">${inner}</div>`;
  document.body.appendChild(wrap);
  return wrap;
}

function closePop(wrap, after) {
  if (!wrap || wrap.dataset.closed === '1') {
    after?.();
    return;
  }
  wrap.dataset.closed = '1';
  wrap.classList.add('fade-out');
  setTimeout(() => {
    wrap.remove();
    after?.();
  }, 400);
}

function cardShell(inner) {
  return openPop(inner, 'df-ack-root');
}

function cap(s) {
  s = String(s || '').trim();
  return s ? s.charAt(0).toUpperCase() + s.slice(1) : s;
}

export function prettyRole(role) {
  const s = String(role || 'Staff').replace(/_/g, ' ').trim();
  if (/^(hq\s*admin|owner|super\s*admin|admin)$/i.test(s)) return 'Staff';
  if (!s) return 'Staff';
  return s.replace(/\b\w/g, (c) => c.toUpperCase());
}

export function successCopy(title) {
  const raw = String(title || 'Action').replace(/\?+$/, '').trim();
  const m = raw.match(/^(Save|Update|Delete|Create|Restore|Import|Issue|Deactivate|Activate|Close|Post|Clone|Remove|Send|Add)\s+(?:this\s+|these\s+|a\s+|the\s+|selected\s+)?(.+)$/i);
  if (m) {
    const verb = m[1].toLowerCase();
    const noun = m[2].replace(/\?$/, '').trim();
    const map = {
      save: 'saved', update: 'updated', delete: 'deleted', create: 'created',
      restore: 'restored', import: 'imported', issue: 'issued', deactivate: 'deactivated',
      activate: 'activated', close: 'closed', post: 'posted', clone: 'cloned',
      remove: 'removed', send: 'sent', add: 'added',
    };
    return `${cap(noun)} ${map[verb] || 'completed'}.`;
  }
  return `${raw} completed.`;
}

function showWorking(title) {
  cardShell(`
    <div class="df-pop-ico">…</div>
    <h2>${esc(String(title || 'Working').replace(/\?+$/, ''))}</h2>
    <p>Working… please wait.</p>
    <div class="df-pop-work"><i></i></div>
  `);
}

function paintAck({ ok = true, message, title } = {}, onClose) {
  const msg = message || (ok ? successCopy(title) : 'That did not complete. Please try again.');
  const wrap = cardShell(`
    <div class="df-pop-ico ${ok ? '' : 'bad'}">${ok ? '✔' : '✕'}</div>
    <h2>${ok ? 'Done' : 'Could not complete'}</h2>
    <p>${esc(msg)}</p>
    <button type="button" class="df-pop-btn" data-ack-ok>Continue</button>
  `);
  const close = () => {
    clearTimeout(autoTimer);
    closePop(wrap, () => {
      try { sessionStorage.removeItem(ACK_KEY); } catch { /* ignore */ }
      if (pending) pending.acked = true;
      pending = null;
      onClose?.();
    });
  };
  wrap.querySelector('[data-ack-ok]').onclick = close;
  wrap.addEventListener('click', (e) => { if (e.target === wrap) close(); });
  if (ok) {
    clearTimeout(autoTimer);
    autoTimer = setTimeout(close, 3000);
  }
}

export function ackIfPending(ok = true, message, title) {
  if (!pending || pending.acked) return null;
  return ackResult(ok, message, title);
}

export function hasPendingAck() {
  return !!(pending && !pending.acked);
}

export function ackResult(ok = true, message, title) {
  const payload = {
    ok: !!ok,
    message: message || successCopy(title || pending?.title),
    title: title || pending?.title || '',
    at: Date.now(),
  };
  try { sessionStorage.setItem(ACK_KEY, JSON.stringify(payload)); } catch { /* ignore */ }
  if (pending) pending.acked = true;
  clearTimeout(autoTimer);
  paintAck(payload);
  return payload;
}

export function showPendingAck() {
  try {
    const raw = sessionStorage.getItem(ACK_KEY);
    if (!raw) return;
    const payload = JSON.parse(raw);
    const msg = String(payload?.message || '');
    if (/products_sku_key|duplicate key|Catalog write failed/i.test(msg)) {
      sessionStorage.removeItem(ACK_KEY);
      return;
    }
    if (!payload || Date.now() - (payload.at || 0) > 20000) {
      sessionStorage.removeItem(ACK_KEY);
      return;
    }
    if (document.getElementById('df-ack-root')?.querySelector('[data-ack-ok]')) return;
    paintAck(payload);
  } catch { /* ignore */ }
}

/** Login success card — Continue or auto-dismiss after 3s. */
export function showLoginModal(email, role) {
  return new Promise((resolve) => {
    const wrap = openPop(`
      <div class="df-pop-ico">✔</div>
      <h2>Login Successful</h2>
      <p>Signed in as:<br><strong id="loginEmail">${esc(email || '')}</strong></p>
      <p>Role:<br><strong id="loginRole">${esc(prettyRole(role))}</strong></p>
      <button type="button" class="df-pop-btn" data-ack-ok>Continue</button>
    `, 'loginModal');
    wrap.classList.add('login-modal');
    const close = () => closePop(wrap, resolve);
    wrap.querySelector('[data-ack-ok]').onclick = close;
    setTimeout(close, 3000);
  });
}

export function confirmAction(title, body = 'Save these changes?') {
  return new Promise((resolve) => {
    const danger = isDeletePrompt(title);
    const wrap = cardShell(`
      <div class="df-pop-ico ${danger ? 'bad' : ''}">${danger ? '!' : '?'}</div>
      <h2>${esc(title)}</h2>
      <p>${esc(body)}</p>
      <button type="button" class="df-pop-btn ${danger ? 'danger' : ''}" data-yes>${danger ? 'Continue' : 'Confirm'}</button>
      <button type="button" class="df-pop-btn ghost" data-no>Cancel</button>
    `);
    wrap.setAttribute('data-confirm-card', '1');
    const done = async (v) => {
      if (!v) {
        closePop(wrap, () => {
          pending = null;
          resolve(false);
        });
        return;
      }
      wrap.remove();
      if (isDeletePrompt(title)) {
        const keyed = await promptDeleteKey('Delete access key required');
        if (!keyed) {
          pending = null;
          resolve(false);
          return;
        }
      }
      pending = { title, acked: false };
      showWorking(title);
      clearTimeout(autoTimer);
      autoTimer = setTimeout(() => {
        if (pending && !pending.acked) ackResult(true, successCopy(title), title);
      }, 1200);
      resolve(true);
    };
    wrap.querySelector('[data-no]').onclick = () => done(false);
    wrap.querySelector('[data-yes]').onclick = () => done(true);
    wrap.addEventListener('click', (e) => { if (e.target === wrap) done(false); });
  });
}

export function toast(msg, kind = 'success') {
  if (pending && !pending.acked) {
    ackResult(kind !== 'error', msg, pending.title);
    return;
  }
  if (kind === 'error') {
    ackResult(false, msg);
    return;
  }
  document.querySelectorAll('[data-toast]').forEach((el) => el.remove());
  const el = document.createElement('div');
  el.setAttribute('data-toast', kind);
  el.textContent = msg;
  el.style.cssText = `position:fixed;top:18px;right:18px;z-index:11000;background:${kind === 'error' ? '#991b1b' : '#166534'};color:#fff;padding:10px 16px;border-radius:8px;font-size:13px;font-weight:600;box-shadow:0 8px 24px rgba(0,0,0,.2)`;
  document.body.appendChild(el);
  setTimeout(() => el.remove(), 2800);
}

export async function shareUrl(title, url) {
  const wrap = openPop(`
    <div class="df-pop-ico">🔗</div>
    <h2>${esc(title)}</h2>
    <input id="share-url-input" readonly value="${esc(url)}" />
    <button type="button" class="df-pop-btn" data-copy>Copy</button>
    <button type="button" class="df-pop-btn ghost" data-open>Open</button>
    <button type="button" class="df-pop-btn ghost" data-close>Close</button>
  `);
  const input = wrap.querySelector('#share-url-input');
  input.focus();
  input.select();
  wrap.querySelector('[data-close]').onclick = () => closePop(wrap);
  wrap.querySelector('[data-open]').onclick = () => { window.open(url, '_blank'); };
  wrap.querySelector('[data-copy]').onclick = async () => {
    const ok = await copyText(url);
    if (!ok) {
      input.select();
      try { document.execCommand('copy'); } catch { /* ignore */ }
    }
    toast(ok ? 'Copied to clipboard' : 'Select the link and copy it');
  };
  wrap.addEventListener('click', (e) => { if (e.target === wrap) closePop(wrap); });
}

export function datePreset(key) {
  const t = new Date();
  const iso = (d) => {
    const x = new Date(d);
    const p = (n) => String(n).padStart(2, '0');
    return `${x.getFullYear()}-${p(x.getMonth() + 1)}-${p(x.getDate())}`;
  };
  const y = t.getFullYear();
  const m = t.getMonth();
  const fyStart = Number(localStorage.getItem('df_fy_start_month') || 1);
  const fyRange = (yearOffset = 0) => {
    const startMonth = Math.min(12, Math.max(1, fyStart)) - 1;
    let startY = y + yearOffset;
    if (m < startMonth) startY -= 1;
    const from = new Date(startY, startMonth, 1);
    const to = new Date(startY + 1, startMonth, 0);
    return { from: iso(from), to: iso(to) };
  };
  if (key === 'today') return { from: iso(t), to: iso(t) };
  if (key === 'yesterday') {
    const d = new Date(t); d.setDate(d.getDate() - 1);
    return { from: iso(d), to: iso(d) };
  }
  if (key === '7') {
    const d = new Date(t); d.setDate(d.getDate() - 6);
    return { from: iso(d), to: iso(t) };
  }
  if (key === '30') {
    const d = new Date(t); d.setDate(d.getDate() - 29);
    return { from: iso(d), to: iso(t) };
  }
  if (key === 'this_month' || key === 'month') return { from: iso(new Date(y, m, 1)), to: iso(new Date(y, m + 1, 0)) };
  if (key === 'last_month') return { from: iso(new Date(y, m - 1, 1)), to: iso(new Date(y, m, 0)) };
  if (key === 'this_month_ly' || key === 'month_ly') return { from: iso(new Date(y - 1, m, 1)), to: iso(new Date(y - 1, m + 1, 0)) };
  if (key === 'this_year' || key === 'year') return { from: `${y}-01-01`, to: `${y}-12-31` };
  if (key === 'last_year') return { from: `${y - 1}-01-01`, to: `${y - 1}-12-31` };
  if (key === 'fiberkapp') return { from: '2025-01-01', to: `${y}-12-31` };
  if (key === 'all' || key === 'all_dates') return { from: '', to: '' };
  if (key === 'fy') return fyRange(0);
  if (key === 'last_fy') return fyRange(-1);
  return null;
}

export const DATE_PRESETS = [
  ['today', 'Today'],
  ['yesterday', 'Yesterday'],
  ['7', 'Last 7 Days'],
  ['30', 'Last 30 Days'],
  ['this_month', 'This Month'],
  ['last_month', 'Last Month'],
  ['this_month_ly', 'This month last year'],
  ['this_year', 'This Year'],
  ['last_year', 'Last Year'],
  ['fiberkapp', 'Fiberkapp 2025–now'],
  ['all', 'All dates'],
  ['fy', 'Current financial year'],
  ['last_fy', 'Last financial year'],
];

export function datePresetHtml(selected = '') {
  return `<select id="f-preset">
    <option value="">Custom range</option>
    ${DATE_PRESETS.map(([k, l]) => `<option value="${k}" ${k === selected ? 'selected' : ''}>${l}</option>`).join('')}
  </select>`;
}

export function noteStore(key) {
  const read = () => {
    try { return JSON.parse(localStorage.getItem(key) || '[]'); } catch { return []; }
  };
  const write = (rows) => { try { localStorage.setItem(key, JSON.stringify(rows.slice(0, 80))); } catch { /* ignore */ } };
  return { read, write };
}
