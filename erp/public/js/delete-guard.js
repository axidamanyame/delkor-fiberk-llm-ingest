import { registerClickGuard, PRIORITY } from './click-router.js';
/**
 * Secondary delete gate: every Delete asks for the company delete access key.
 * View / Edit are audit-only (no key).
 */
import { writeAudit, supabase } from './supabaseClient.js';

const KEY_LS = 'df_delete_access_key';
const OK_UNTIL = 'df_delete_ok_until';
const AUDIT_LS = 'df_audit_logs';
const WINDOW_MS = 25000;

function generateAccessKey() {
  const alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let s = '';
  for (let i = 0; i < 8; i += 1) s += alphabet[Math.floor(Math.random() * alphabet.length)];
  return `DF-${s.slice(0, 4)}-${s.slice(4)}`;
}

function normalizeKey(v) {
  return String(v || '').toUpperCase().replace(/[^A-Z0-9]/g, '');
}

export function ensureDeleteKey() {
  let k = '';
  try { k = localStorage.getItem(KEY_LS) || ''; } catch { k = ''; }
  if (!k) {
    k = 'DF-DEL-' + generateAccessKey().replace(/^DF-/, '');
    try { localStorage.setItem(KEY_LS, k); } catch { /* ignore */ }
  }
  return k;
}

export function getDeleteKey() {
  return ensureDeleteKey();
}

export function rotateDeleteKey() {
  const k = 'DF-DEL-' + generateAccessKey().replace(/^DF-/, '');
  try { localStorage.setItem(KEY_LS, k); } catch { /* ignore */ }
  return k;
}

export function isDeletePrompt(title) {
  return /^(delete|remove)\b/i.test(String(title || '').trim());
}

function recentlyVerified() {
  try { return Date.now() < Number(sessionStorage.getItem(OK_UNTIL) || 0); } catch { return false; }
}

function markVerified() {
  try { sessionStorage.setItem(OK_UNTIL, String(Date.now() + WINDOW_MS)); } catch { /* ignore */ }
}

function pushLocalAudit(row) {
  try {
    const cur = JSON.parse(localStorage.getItem(AUDIT_LS) || '[]');
    const next = [row, ...(Array.isArray(cur) ? cur : [])].slice(0, 500);
    localStorage.setItem(AUDIT_LS, JSON.stringify(next));
  } catch { /* ignore */ }
}

export async function logCrud(action, extra = {}) {
  const { data: { session } } = await supabase.auth.getSession().catch(() => ({ data: { session: null } }));
  const href = extra.href || (typeof location !== 'undefined' ? location.pathname + location.search : '');
  const row = {
    id: 'aud-' + Date.now() + '-' + Math.random().toString(36).slice(2, 6),
    created_at: new Date().toISOString(),
    actor_id: session?.user?.id || extra.actor_id || null,
    actor_email: session?.user?.email || extra.email || '',
    action,
    entity_type: extra.entity_type || extra.table || 'record',
    entity_id: extra.entity_id ? String(extra.entity_id) : null,
    subsidiary_code: extra.subsidiary_code || null,
    summary: extra.summary || `${action} ${extra.label || extra.table || ''} ${extra.entity_id || ''}`.trim(),
    payload: { href, path: typeof location !== 'undefined' ? location.pathname : '', ...extra.payload },
  };
  pushLocalAudit(row);
  writeAudit({
    action: row.action,
    entity_type: row.entity_type,
    entity_id: row.entity_id,
    subsidiary_code: row.subsidiary_code,
    summary: row.summary,
    payload: row.payload,
  }).catch(() => {});
  return row;
}

function keyCard(title, body) {
  try { import('./confirm-action.js').then((m) => m.ensurePopCss?.()).catch(() => {}); } catch { /* ignore */ }
  let wrap = document.getElementById('df-del-key-root');
  if (!wrap) {
    wrap = document.createElement('div');
    wrap.id = 'df-del-key-root';
    document.body.appendChild(wrap);
  }
  wrap.className = 'df-pop';
  wrap.hidden = false;
  wrap.style.zIndex = '10020';
  wrap.innerHTML = `<div class="df-pop-card">
    <div class="df-pop-ico bad">!</div>
    <h2>${title}</h2>
    <p style="text-align:left">${body}</p>
    <label style="display:block;font-size:12px;font-weight:700;margin:8px 0 0;text-align:left">Delete access key</label>
    <input id="df-del-key-input" type="password" autocomplete="off" placeholder="DF-DEL-••••-••••" />
    <p id="df-del-key-err" class="df-pop-err"></p>
    <button type="button" class="df-pop-btn danger" data-yes>Authorise delete</button>
    <button type="button" class="df-pop-btn ghost" data-no>Cancel</button>
  </div>`;
  const input = wrap.querySelector('#df-del-key-input');
  setTimeout(() => input?.focus(), 40);
  return wrap;
}

export function promptDeleteKey(title = 'Delete access key required') {
  return new Promise((resolve) => {
    if (recentlyVerified()) {
      resolve(true);
      return;
    }
    ensureDeleteKey();
    const wrap = keyCard(
      title,
      'Enter the company delete access key. HQ Admin issues this under Users. View and Edit do not need this key — they are written to the audit log.',
    );
    const input = wrap.querySelector('#df-del-key-input');
    const err = wrap.querySelector('#df-del-key-err');
    const finish = (ok) => {
      wrap.remove();
      resolve(ok);
    };
    const tryKey = async () => {
      const typed = normalizeKey(input.value);
      if (!typed) {
        err.style.display = 'block';
        err.textContent = 'Enter the delete access key.';
        return;
      }
      if (typed !== normalizeKey(ensureDeleteKey())) {
        err.style.display = 'block';
        err.textContent = 'Delete access key not accepted [DF-GATE-1104]. Ask HQ Admin for the current key (Users → Delete access key). Contact support@delkorfiberk.com · 054 644 3323.';
        logCrud('delete_denied', { summary: 'DF-GATE-1104 wrong delete access key', entity_type: 'error_code', entity_id: 'DF-GATE-1104' });
        try { import('./error-codes.js').then((m) => m.logError('GATE_DEL_KEY', { summary: 'Wrong delete access key' })); } catch { /* ignore */ }
        input.value = '';
        input.focus();
        return;
      }
      markVerified();
      await logCrud('delete_authorised', { summary: 'Delete access key accepted', entity_type: 'delete_key' });
      finish(true);
    };
    wrap.querySelector('[data-no]').onclick = () => finish(false);
    wrap.querySelector('[data-yes]').onclick = () => tryKey();
    input.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') { e.preventDefault(); tryKey(); }
      if (e.key === 'Escape') finish(false);
    });
    wrap.addEventListener('click', (e) => { if (e.target === wrap) finish(false); });
  });
}

export function bindViewEditAudit() {
  if (typeof document === 'undefined' || window.__dfViewEditAudit) return;
  window.__dfViewEditAudit = true;
  /* Highest priority and observe-only, so the audit trail still records a click
     that a lock or a modal guard goes on to claim. */
  registerClickGuard({
    name: 'crud-audit',
    priority: PRIORITY.observe,
    match: (origin) => origin?.closest?.('a, button'),
    claim: (el) => {
    if (el.closest('#df-del-key-root, #df-ack-root')) return 'pass';
    const label = String(el.textContent || '').replace(/\s+/g, ' ').trim();
    const href = el.getAttribute('href') || '';
    const id = el.dataset.id || el.dataset.act || el.dataset.view || '';
    if (/^delete$/i.test(label) || el.classList.contains('del') || el.dataset.del || el.dataset.delSale) return 'pass';
    const isView = /^view$/i.test(label) || /[?&]view=/.test(href) || /-(view)\.html/.test(href);
    const isEdit = /^edit$/i.test(label) || /[?&](?:edit)=/.test(href) || (/-form\.html/.test(href) && /edit/i.test(label));
    if (isView) logCrud('view', { href, label, entity_id: id, summary: `View ${href || location.pathname}` });
    else if (isEdit) logCrud('edit', { href, label, entity_id: id, summary: `Edit ${href || location.pathname}` });
    return 'observe';
    },
  });
}
