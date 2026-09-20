import { supabase } from './supabaseClient.js';
import { readLs, esc } from './ls-rows.js';
import { sortCallsRecent } from './call-when.js';

const today = () => new Date().toISOString().slice(0, 10);
function ymd(v) {
  if (!v) return '';
  return String(v).slice(0, 10);
}

export async function loadBook() {
  let accounts = [];
  let calls = [];
  try {
    const a = await supabase.from('collection_accounts').select('*').limit(4000);
    if (!a.error) accounts = a.data || [];
  } catch { /* ignore */ }
  try {
    const c = await supabase.from('collection_calls').select('*').limit(8000);
    if (!c.error) calls = c.data || [];
  } catch { /* ignore */ }
  if (!accounts.length) accounts = readLs('df_collection_accounts', []) || [];
  if (!calls.length) calls = readLs('df_collection_calls', []) || [];
  return { accounts, calls: sortCallsRecent(calls) };
}

export function metrics(accounts, calls) {
  const t = today();
  const callsToday = calls.filter((c) => ymd(c.at || c.called_at || c.called_on) === t);
  const connected = callsToday.filter((c) => !/no_answer|unreachable|busy|wrong/i.test(c.outcome || ''));
  const ptpDue = accounts.filter((a) => a.status === 'ptp' && ymd(a.next_follow_up) === t);
  const ptpOver = accounts.filter((a) => a.status === 'ptp' && ymd(a.next_follow_up) && ymd(a.next_follow_up) < t);
  const collected = calls.filter((c) => /completed|current|paid/i.test(c.outcome || '') || /payment made/i.test(c.response || ''));
  const weekStart = new Date(); weekStart.setDate(weekStart.getDate() - 7);
  const collectedToday = collected.filter((c) => ymd(c.at || c.called_at) === t);
  const collectedWeek = collected.filter((c) => new Date(c.at || c.called_at || 0) >= weekStart);
  const aging = { '0-30': 0, '31-60': 0, '61-90': 0, '90+': 0 };
  accounts.forEach((a) => {
    const d = a.next_follow_up || a.last_at;
    if (!d) return;
    const days = Math.max(0, Math.floor((Date.now() - new Date(d).getTime()) / 86400000));
    if (days <= 30) aging['0-30'] += 1;
    else if (days <= 60) aging['31-60'] += 1;
    else if (days <= 90) aging['61-90'] += 1;
    else aging['90+'] += 1;
  });
  const high = accounts.filter((a) => Number(a.risk_score) > 70 || a.status === 'escalate').length;
  return {
    callsToday: callsToday.length,
    connected: connected.length,
    failed: callsToday.length - connected.length,
    ptpDue: ptpDue.length,
    ptpOver: ptpOver.length,
    collectedToday: collectedToday.length,
    collectedWeek: collectedWeek.length,
    aging,
    high,
    accounts: accounts.length,
  };
}

export function queue(accounts) {
  const t = today();
  const buckets = [
    { key: 'due', label: 'Due today', test: (a) => ymd(a.next_follow_up) === t },
    { key: 'ptp', label: 'PTP today', test: (a) => a.status === 'ptp' && ymd(a.next_follow_up) === t },
    { key: 'over', label: 'Overdue PTP', test: (a) => a.status === 'ptp' && ymd(a.next_follow_up) && ymd(a.next_follow_up) < t },
    { key: 'risk', label: 'Escalate', test: (a) => a.status === 'escalate' },
    { key: 'hold', label: 'On hold / dispute', test: (a) => a.status === 'on_hold' || a.status === 'dispute' },
    { key: 'none', label: 'No contact', test: (a) => a.status === 'no_contact' },
  ];
  return buckets.map((b) => ({ ...b, rows: accounts.filter(b.test) }));
}

export function agentBoard(accounts, calls) {
  const t = today();
  const names = [...new Set(accounts.map((a) => a.agent).filter(Boolean))];
  return names.map((name) => {
    const mine = calls.filter((c) => (c.agent || '') === name);
    const todayC = mine.filter((c) => ymd(c.at || c.called_at || c.called_on) === t);
    return { name, calls: todayC.length, accounts: accounts.filter((a) => a.agent === name).length };
  }).sort((a, b) => b.calls - a.calls);
}

export function shortDate(v) {
  const s = String(v || '').slice(0, 10);
  if (!s) return '—';
  const d = new Date(`${s}T00:00:00`);
  if (Number.isNaN(d.getTime())) return s;
  return d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' });
}

function initials(n) {
  return String(n || '?').split(/\s+/).map((p) => p[0]).join('').slice(0, 2).toUpperCase();
}

function agingBar(aging) {
  const parts = [
    ['a0', aging['0-30'] || 0, '0–30'],
    ['a1', aging['31-60'] || 0, '31–60'],
    ['a2', aging['61-90'] || 0, '61–90'],
    ['a3', aging['90+'] || 0, '90+'],
  ];
  const total = parts.reduce((s, p) => s + p[1], 0) || 1;
  return `<div class="ops-aging">
    <div class="ops-aging-lab">Aging</div>
    <div class="ops-aging-track" aria-hidden="true">${parts.map(([c, n]) =>
      `<i class="${c}" style="width:${Math.round((n / total) * 100)}%"></i>`).join('')}</div>
    <ul class="ops-aging-keys">${parts.map(([, n, lab]) =>
      `<li><b>${n}</b> ${lab}</li>`).join('')}</ul>
  </div>`;
}

function queueCard(q) {
  const more = Math.max(0, q.rows.length - 5);
  const href = `/collections-floor.html?q=${encodeURIComponent(q.key)}`;
  return `<article class="ops-col ${esc(q.key)}">
    <header class="ops-col-h"><span>${esc(q.label)}</span><b>${q.rows.length}</b></header>
    ${q.rows.length
      ? `<ul class="ops-col-list">${q.rows.slice(0, 5).map((a) => `
          <li><a href="${href}">
            <strong>${esc(a.name || '')}</strong>
            <span>${esc(a.phone || '—')} · ${esc(a.status || '')}</span>
          </a></li>`).join('')}</ul>
         ${more ? `<a class="ops-col-more" href="${href}">${more} more on the floor</a>` : ''}`
      : `<p class="ops-col-empty">None in this queue.</p>`}
  </article>`;
}

export function paintHome(root, { accounts, calls, banner = '', chrome = '' } = {}) {
  const m = metrics(accounts, calls);
  const qs = queue(accounts);
  const board = agentBoard(accounts, calls);
  const heroGo = m.ptpOver ? '/collections-floor.html?q=over' : '/collections-floor.html';
  root.innerHTML = `
    ${chrome}
    <div class="ops-page">
      <div class="ops-toolbar">
        <p class="ops-sub">Call / arrears desk — queues, promises, and call work only.</p>
        <div class="ops-actions">
          <a class="ult-btn ult-btn-primary" href="/collections-desk.html">Open book</a>
          <a class="ult-btn ult-btn-outline" href="/collections-floor.html">Floor</a>
          <a class="ult-btn ult-btn-outline" href="/collections-desk.html?pane=diary">Call diary</a>
        </div>
      </div>
      ${banner}
      <div class="ops-kpis">
        <a class="ops-kpi hero" href="${heroGo}">
          <div class="ops-kpi-lab">Overdue PTP</div>
          <div class="ops-kpi-n">${m.ptpOver}</div>
          <div class="ops-kpi-meta">${m.ptpDue} promised for today · open the floor</div>
          <div class="ops-kpi-go">Work this queue</div>
        </a>
        <a class="ops-kpi" href="/collections-desk.html?pane=diary">
          <div class="ops-kpi-lab">Calls today</div>
          <div class="ops-kpi-n">${m.callsToday}</div>
          <div class="ops-kpi-meta">${m.connected} connected · ${m.failed} no connect</div>
        </a>
        <a class="ops-kpi" href="/collections-desk.html?pane=accounts">
          <div class="ops-kpi-lab">Collected marks</div>
          <div class="ops-kpi-n">${m.collectedToday}</div>
          <div class="ops-kpi-meta">${m.collectedWeek} in the last 7 days</div>
        </a>
        <a class="ops-kpi" href="/collections-desk.html">
          <div class="ops-kpi-lab">On the book</div>
          <div class="ops-kpi-n">${m.accounts}</div>
          <div class="ops-kpi-meta">${m.high} escalate / high risk</div>
        </a>
      </div>
      ${agingBar(m.aging)}
      <div class="ops-body">
        <div class="ops-board">${qs.map(queueCard).join('')}</div>
        <aside class="ops-agents">
          <h2>Agents on the book</h2>
          ${board.length
            ? board.map((r) => `
              <div class="ops-agent">
                <div class="ops-av">${esc(initials(r.name))}</div>
                <div><strong>${esc(r.name)}</strong><span>${r.accounts} accounts · ${r.calls} calls today</span></div>
              </div>`).join('')
            : '<p class="ops-col-empty">No agent names on accounts.</p>'}
        </aside>
      </div>
    </div>`;
}
