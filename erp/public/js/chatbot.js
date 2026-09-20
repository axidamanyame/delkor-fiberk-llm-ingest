/** Floating ERP Assistant — crawls live books + manuals, learns from questions. */
import { remainingTokens, spendToken, pushHistory } from './ai-assist.js';
import { NAV_ICONS } from './nav-icons.js';
import { esc } from './ls-rows.js';
import { answerFromFacts, factsForPrompt } from './erp-facts.js';
import { searchErp } from './erp-search.js';
import { answerFromManual, searchManual, manualCorpus } from './desk-manual.js';
import { hydrateMemory, recall, remember } from './assistant-memory.js';
import { listNotices, pullNotices } from './inbox.js';
import { listAlerts, pullAlerts } from './till-open.js';
import { pendingStaffAlerts } from './staff-log.js';
import { getAccess } from './rbac.js';
import { isHqRole, isOwnerRole } from './access-rules.js';
import { tillPolicyLocal } from './till-policy.js';

const CHIPS = [
  { q: 'Ref SIL-01', label: 'SIL-01 silo' },
  { q: 'Ref PRD-01 catalog vs inventory', label: 'PRD-01 products' },
  { q: 'Where is purchases catch-up?', label: 'Catch-up' },
  { q: 'How many customers are in default?', label: 'In default' },
  { q: "Show today's sales", label: "Today's sales" },
];

function flattenMenu(items, parent = '') {
  const out = [];
  (items || []).forEach((it) => {
    if (it.href) out.push({ label: it.label, href: it.href, parent });
    if (it.pages) it.pages.forEach((p) => out.push({ label: p.label, href: p.href, parent: it.label }));
    if (it.leaves) it.leaves.forEach((p) => out.push({ label: p.label, href: p.href, parent: it.label }));
    if (it.children) out.push(...flattenMenu(it.children, it.label));
  });
  return out;
}

function pageLabel(menu, path) {
  const file = (path || location.pathname).split('/').pop() || '';
  const hit = flattenMenu(menu).find((m) => String(m.href || '').includes(file));
  return hit ? (hit.parent ? hit.parent + ' → ' + hit.label : hit.label) : file || 'Home';
}

function isGeneric(text) {
  return !text || /I can find a report, explain this page|I can count customers/.test(text);
}

function linkify(text) {
  return esc(text)
    .replace(/\n/g, '<br>')
    .replace(/\[([^\]]+)\]\((\/[^)\s]+)\)/g, '<a href="$2">$1</a>');
}

function fromManual(q) {
  return answerFromManual(q);
}

function fromSearch(q, menu) {
  const hits = searchErp(q, menu).slice(0, 6);
  if (!hits.length) return null;
  if (/where|open|find|go to|take me|page/.test(String(q).toLowerCase()) || hits[0].s >= 80) {
    const lines = hits.map((h) => `• [${h.label}](${h.href})${h.parent ? ' — ' + h.parent : ''}`);
    return `Jump here:\n${lines.join('\n')}`;
  }
  return null;
}

function answerLocal(q, menu) {
  const s = String(q || '').toLowerCase();
  const here = pageLabel(menu);
  const mem = recall(q);
  if (mem?.a) return mem.a + (mem.href ? `\n\nOpen [${mem.href}](${mem.href})` : '');

  const man = fromManual(q);
  if (man) return man;

  const facts = answerFromFacts(q, here);
  if (facts) return facts;

  if (/migrat|fiberkapp|silo|hard fork/.test(s)) {
    return 'Fiberkapp uploads are live records. Use the filters on each desk (subsidiary, location, dates). There is no separate archive.';
  }
  if (/pinaro|paper invoice|paper slip|00475/.test(s)) {
    return 'Paper supplier invoices are booked live, then received at Operations Hub (WMS) and transferred to BNPL Field Sales. Pinaro General Ventures slip 00475 (Spark 50, Hot 70, Smart 20, A200 — GH₵ 21,934) is on that desk with the paper photo attached.\n\nOpen [Paper invoice (Pinaro)](/paper-purchase.html).';
  }
  if (/catch.?up|missing purchase|unmatched uba/.test(s)) {
    return 'Purchases catch-up lists UBA stock payments that have no live PO. HQ books a real bill from the bank line — not from the incomplete Fiberkapp 154 purchases.\n\nOpen [Purchases catch-up](/purchase-catchup.html).';
  }
  if (/uba|fiberk bank|03216347302516|operative account/.test(s)) {
    return 'Finance → Banking → UBA Fiberk is Fiberk Ltd’s UBA overdraft 03216347302516.\n\nOpen [UBA Fiberk](/uba-fiberk.html).';
  }
  if (/operation|warehouse|receive stock|put away|stock hub|\bwms\b/.test(s)) {
    return fromManual('operations hub warehouse WMS receive put away')
      || 'Operations Hub is the warehouse. WMS is the same stock floor.\n\nRef OPS-01 — [Hub board](/virtual-warehouse.html) · Ref WMS-01 — [WMS](/wms.html)';
  }
  if (/payroll|payslip|map payroll/.test(s)) {
    return 'HRM → Payroll is the staff book (SNNIT 5.5% / 13% of basic). UBA salary lines land here after Sync.\n\nOpen [Payroll](/payroll.html).';
  }
  const jump = fromSearch(q, menu);
  if (jump) return jump;
  if (/explain|what (is|does)|this menu|this page|where am i/.test(s)) {
    return `You are on ${here}. Search the sidebar for any page, SKU, or customer — results open the desk.`;
  }
  return `I can count customers in default, follow-ups due, today's sales, SKUs, and staff from the live books, or jump you to a page. Try “migrated data”, “catch-up”, or a name. You are on ${here}.`;
}

async function askRemote(q, menu) {
  let facts = '';
  try { facts = factsForPrompt(); } catch { facts = ''; }
  const ctrl = typeof AbortController !== 'undefined' ? new AbortController() : null;
  const timer = setTimeout(() => { try { ctrl?.abort(); } catch { /* ignore */ } }, 8000);
  try {
    const res = await fetch('/api/ai', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      signal: ctrl?.signal,
      body: JSON.stringify({
        title: 'ERP Assistant',
        fields: {
          question: q,
          page: pageLabel(menu),
          erp_facts: facts,
          manual_hits: searchManual(q, 6).map((h) => `${h.ref} ${h.title}: ${h.body}`).join('\n') || manualCorpus().slice(0, 6000),
          instruction: 'You are the Delkor-Fiberk ERP Assistant. Answer from manual_hits and erp_facts only. Cite the Ref code (e.g. Ref SIL-01) and link /manual.html#id. Do not invent customers, amounts, or policy. Prefer live desks over Fiberkapp migrated books. If unsure, open the matching manual section.',
        },
      }),
    });
    if (!res.ok) return null;
    const j = await res.json();
    if (j?.ok && j.text) return j.text;
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
  }
  return null;
}

function ensureBotCss() {
  if (document.getElementById('df-bot-css')) return;
  const s = document.createElement('style');
  s.id = 'df-bot-css';
  s.textContent = `
#df-bot-root{position:fixed;right:18px;bottom:18px;z-index:12000;font-family:var(--ult-font,Inter,system-ui,sans-serif)}
.df-bot-fab{
  width:52px;height:52px;border:0;border-radius:16px;cursor:pointer;
  background:#1d4ed8;color:#fff;display:flex;align-items:center;justify-content:center;
  box-shadow:0 10px 24px rgba(29,78,216,.38);
}
.df-bot-fab{position:relative}
.df-bot-fab.alert{
  background:#dc2626;animation:df-bot-pulse 1.15s ease-in-out infinite;
  box-shadow:0 0 0 0 rgba(220,38,38,.7);
}
.df-bot-fab.alert:hover{background:#b91c1c}
.df-bot-badge{
  position:absolute;top:-5px;right:-5px;min-width:18px;height:18px;padding:0 4px;
  border-radius:9px;background:#fff;color:#dc2626;font-size:11px;font-weight:800;
  display:flex;align-items:center;justify-content:center;box-shadow:0 0 0 2px #dc2626;
  pointer-events:none;
}
@keyframes df-bot-pulse{
  0%{transform:scale(1);box-shadow:0 0 0 0 rgba(220,38,38,.65)}
  70%{transform:scale(1.08);box-shadow:0 0 0 16px rgba(220,38,38,0)}
  100%{transform:scale(1);box-shadow:0 0 0 0 rgba(220,38,38,0)}
}
.df-bot-alert{
  align-self:stretch;max-width:100%;background:#fef2f2;border:1px solid #fecaca;
  color:#7f1d1d;border-radius:12px;padding:10px 12px;font-size:13px;line-height:1.45;
}
.df-bot-alert strong{display:block;margin:0 0 4px;font-size:13px}
.df-bot-alert a{color:#991b1b;font-weight:800}
.df-bot-panel.alert-open header{background:#991b1b}
.df-bot-fab .nav-svg{width:22px;height:22px}
.df-bot-panel{
  position:absolute;right:0;bottom:64px;width:min(360px,calc(100vw - 24px));
  height:min(480px,calc(100vh - 120px));
  background:#fff;color:#0f172a;border:1px solid #e2e8f0;border-radius:16px;
  box-shadow:0 18px 48px rgba(15,23,42,.2);
  display:flex;flex-direction:column;overflow:hidden;
}
.df-bot-panel[hidden]{display:none!important}
.df-bot-panel header{
  display:flex;align-items:center;gap:8px;padding:10px 12px;
  background:#1e3a8a;color:#fff;flex:0 0 auto;
}
.df-bot-panel header strong{flex:1;font-size:14px}
.df-bot-panel header a{color:#bfdbfe;font-size:12px;text-decoration:none}
.df-bot-panel header button{
  border:0;background:transparent;color:#fff;font-size:22px;line-height:1;cursor:pointer;padding:0 4px;
}
.df-bot-log{flex:1;overflow:auto;padding:12px;background:#f8fafc;display:flex;flex-direction:column;gap:8px}
.df-bot-ai,.df-bot-me{
  max-width:88%;padding:8px 10px;border-radius:12px;font-size:13px;line-height:1.45;
}
.df-bot-ai{align-self:flex-start;background:#fff;border:1px solid #e2e8f0}
.df-bot-me{align-self:flex-end;background:#dbeafe;border:1px solid #bfdbfe}
.df-bot-ai p,.df-bot-me p{margin:0}
.df-bot-ai a{color:#1d4ed8;font-weight:700}
.df-bot-chips{display:flex;flex-wrap:wrap;gap:6px;padding:8px 10px;border-top:1px solid #e2e8f0;background:#fff}
.df-bot-chips button{
  border:1px solid #dbeafe;background:#eff6ff;color:#1e3a8a;border-radius:999px;
  font-size:11px;padding:4px 8px;cursor:pointer;
}
#df-bot-form{display:flex;gap:6px;padding:8px;border-top:1px solid #e2e8f0;background:#fff}
#df-bot-form input{
  flex:1;border:1px solid #e2e8f0;border-radius:8px;padding:8px 10px;font:inherit;font-size:13px;
}
#df-bot-form button{
  border:0;border-radius:8px;background:#1d4ed8;color:#fff;font-weight:700;padding:8px 12px;cursor:pointer;
}
@media (max-width:720px){
  #df-bot-root{right:12px;bottom:72px}
  .df-bot-panel{bottom:62px}
}
`;
  document.head.appendChild(s);
}

function hqSeesAlerts() {
  try {
    const ctx = getAccess() || {};
    return isHqRole(ctx.roleName) || isOwnerRole(ctx.roleName);
  } catch {
    return false;
  }
}

function moneyGhs(n) {
  const v = Number(n);
  if (!Number.isFinite(v)) return '—';
  const sign = v < 0 ? '− ' : '';
  return sign + 'GH₵ ' + Math.abs(v).toLocaleString('en-GH', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function collectHqAlerts(email, userId) {
  const notices = listNotices(email, userId).filter((n) =>
    !n.read && /till_discrepancy|attendance_unverified/.test(String(n.kind || '')));
  const rows = (listAlerts() || []).filter((a) => a.status === 'pending' || a.status === 'under_review');
  const fromNotices = notices.map((n) => ({
    id: 'n-' + n.id,
    kind: n.kind,
    title: n.title,
    body: n.body,
    href: n.href || '/till-alerts.html',
    meta: n.meta || {},
  }));
  const seen = new Set(fromNotices.map((x) => String(x.meta.location_code || '') + String(x.meta.difference || '') + String(x.meta.opened_at || '')));
  rows.forEach((a) => {
    const p = a.payload || {};
    const k = String(p.location_code || '') + String(a.difference || '') + String(p.opened_at || a.created_at || '');
    if (seen.has(k)) return;
    seen.add(k);
    fromNotices.push({
      id: 'a-' + a.id,
      kind: 'till_discrepancy',
      title: 'Till discrepancy — ' + (p.location_name || p.location_code || 'shop'),
      body: `${p.cashier || 'Cashier'} entered ${moneyGhs(p.total_entered)} vs system ${moneyGhs(p.system_expected_total)} (${moneyGhs(a.difference)}).`,
      href: '/till-alerts.html',
      meta: p,
    });
  });
  pendingStaffAlerts().forEach((a) => {
    fromNotices.push({
      id: 's-' + a.id,
      kind: a.kind || 'staff_alert',
      title: a.title,
      body: a.body,
      href: a.href || '/audit-log.html?type=attendance',
      meta: a.meta || {},
    });
  });
  return fromNotices;
}

function alertBubble(item) {
  const p = item.meta || {};
  const extra = item.kind === 'till_discrepancy' && (p.momo_on_hand != null)
    ? `<div>MoMo ${esc(moneyGhs(p.momo_on_hand))} · Cash ${esc(moneyGhs(p.cash_on_hand))}</div>`
    : '';
  return `<div class="df-bot-alert" data-alert="${esc(item.id)}">
    <strong>${esc(item.title || 'HQ alert')}</strong>
    <div>${esc(item.body || '')}</div>
    ${extra}
    <div style="margin-top:6px"><a href="${esc(item.href || '/till-alerts.html')}">Open till discrepancies</a></div>
  </div>`;
}

function bubble(role, text) {
  const cls = role === 'me' ? 'df-bot-me' : 'df-bot-ai';
  return `<div class="${cls}"><p>${role === 'ai' ? linkify(text) : esc(text).replace(/\n/g, '<br>')}</p></div>`;
}

export function mountChatbot({ session, menu } = {}) {
  if (document.getElementById('df-bot-root')) return;
  const path = (location.pathname.split('/').pop() || '').toLowerCase();
  if (/^(login|index|home|pos-open|pos|repair-till|customer-display)\.html$/.test(path) || path === '') return;
  ensureBotCss();
  hydrateMemory().catch(() => {});

  const root = document.createElement('div');
  root.id = 'df-bot-root';
  root.innerHTML = `
    <button type="button" class="df-bot-fab" id="df-bot-fab" title="ERP Assistant" aria-label="ERP Assistant">${NAV_ICONS.bot || '✦'}</button>
    <div class="df-bot-panel" id="df-bot-panel" hidden>
      <header>
        <strong>ERP Assistant</strong>
        <a href="/academy.html">Academy</a>
        <a href="/ai-assistance.html">Full tools</a>
        <button type="button" id="df-bot-close" aria-label="Close">×</button>
      </header>
      <div class="df-bot-log" id="df-bot-log">
        ${bubble('ai', 'I read Academy (staff manuals and policies) and the live books. Ask a policy, a page, or a how-to.')}
      </div>
      <div class="df-bot-chips">${CHIPS.map((c) => `<button type="button" data-q="${esc(c.q)}">${esc(c.label)}</button>`).join('')}</div>
      <form id="df-bot-form">
        <input name="q" autocomplete="off" placeholder="Ask the ERP…" maxlength="400" />
        <button type="submit">Send</button>
      </form>
    </div>`;
  document.body.appendChild(root);

  const panel = root.querySelector('#df-bot-panel');
  const log = root.querySelector('#df-bot-log');
  const form = root.querySelector('#df-bot-form');
  const fab = root.querySelector('#df-bot-fab');
  const who = session?.user?.email || 'staff';

  const add = (role, text) => {
    log.insertAdjacentHTML('beforeend', bubble(role, text));
    log.scrollTop = log.scrollHeight;
  };

  log.addEventListener('click', (e) => {
    const a = e.target.closest('a[href]');
    if (!a) return;
    const href = a.getAttribute('href');
    if (href && href.startsWith('/')) {
      e.preventDefault();
      location.href = href;
    }
  });

  let busy = false;
  async function ask(q) {
    const text = String(q || '').trim();
    if (!text || busy) return;
    busy = true;
    add('me', text);
    add('ai', 'Looking through the books…');
    const wait = log.lastElementChild;
    try {
      const local = answerLocal(text, menu || []);
      let remote = null;
      if (isGeneric(local) && remainingTokens() > 0) {
        try { remote = await askRemote(text, menu || []); } catch { remote = null; }
      }
      const out = !isGeneric(local) ? local : (remote || local);
      if (wait) wait.remove();
      add('ai', out);
      try { if (remote) spendToken(); } catch { /* ignore */ }
      try { await remember(text, out); } catch { /* ignore */ }
      try {
        pushHistory({
          input: text,
          output: out,
          tool: 'ERP Assistant',
          added_by: who,
          created_at: new Date().toISOString().replace('T', ' ').slice(0, 19),
        });
      } catch { /* ignore */ }
    } catch (err) {
      if (wait) wait.remove();
      add('ai', answerLocal(text, menu || []) || 'I could not read the books just then. Try again.');
      console.warn(err);
    } finally {
      busy = false;
    }
  }

  fab.onclick = () => {
    panel.hidden = !panel.hidden;
    if (!panel.hidden) {
      form.querySelector('input')?.focus();
      paintHqAlerts({ open: true });
    }
  };
  root.querySelector('#df-bot-close').onclick = () => { panel.hidden = true; };
  root.querySelectorAll('[data-q]').forEach((b) => {
    b.onclick = () => ask(b.dataset.q);
  });
  form.onsubmit = (e) => {
    e.preventDefault();
    const input = form.querySelector('input');
    const q = input.value;
    input.value = '';
    ask(q);
  };

  const shown = new Set();
  async function paintHqAlerts({ open } = {}) {
    if (!hqSeesAlerts()) {
      fab.classList.remove('alert');
      fab.querySelector('.df-bot-badge')?.remove();
      return;
    }
    const email = session?.user?.email;
    const userId = session?.user?.id;
    try { await pullNotices(email, userId); } catch { /* local */ }
    try { await pullAlerts(); } catch { /* local */ }
    const pol = tillPolicyLocal();
    const all = collectHqAlerts(email, userId);
    const items = all.filter((i) => {
      if (i.kind === 'till_discrepancy') return pol.till_policy_on && pol.till_flash_bot;
      return true;
    });
    fab.classList.toggle('alert', items.length > 0);
    panel.classList.toggle('alert-open', items.length > 0 && !panel.hidden);
    let badge = fab.querySelector('.df-bot-badge');
    if (items.length) {
      if (!badge) {
        badge = document.createElement('span');
        badge.className = 'df-bot-badge';
        fab.appendChild(badge);
      }
      badge.textContent = items.length > 9 ? '9+' : String(items.length);
      fab.title = items.length + ' HQ alert' + (items.length === 1 ? '' : 's');
    } else {
      badge?.remove();
      fab.title = 'ERP Assistant';
    }
    if (open || !panel.hidden) {
      items.forEach((item) => {
        if (shown.has(item.id)) return;
        shown.add(item.id);
        log.insertAdjacentHTML('beforeend', alertBubble(item));
        log.scrollTop = log.scrollHeight;
      });
    }
  }
  paintHqAlerts();
  setInterval(() => paintHqAlerts(), 8000);
}
