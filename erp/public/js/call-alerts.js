import { readLs, esc } from './ls-rows.js';
import { loadBook, shortDate } from './collections-home.js';

function today() { return new Date().toISOString().slice(0, 10); }

function initials(n) {
  return String(n || '?').split(/\s+/).map((p) => p[0]).join('').slice(0, 2).toUpperCase();
}

export function ensureOpsCss() {
  if (document.getElementById('ops-css')) return;
  const l = document.createElement('link');
  l.id = 'ops-css';
  l.rel = 'stylesheet';
  l.href = '/css/collections-ops.css';
  document.head.appendChild(l);
}

export async function workAlerts() {
  const t = today();
  const inbound = readLs('df_cc_calls', []) || [];
  const callbacks = inbound.filter((c) =>
    c.status === 'callback' || c.wrap === 'callback' || (c.callback_on && String(c.callback_on).slice(0, 10) <= t && c.status !== 'done')
  );
  let due = [];
  try {
    const { accounts } = await loadBook();
    due = (accounts || []).filter((a) => {
      const nxt = String(a.next_follow_up || '').slice(0, 10);
      return nxt && nxt <= t && !['completed', 'current'].includes(a.status);
    });
  } catch { /* ignore */ }
  const items = [
    ...callbacks.map((c) => ({
      kind: 'callback',
      title: c.name || c.phone || 'Callback',
      detail: c.phone || '',
      when: c.callback_on || '',
      href: '/call-centre.html?pane=missed',
    })),
    ...due.slice(0, 40).map((a) => ({
      kind: a.status === 'ptp' ? 'ptp' : 'follow',
      title: a.name || a.phone,
      detail: a.phone || '',
      when: a.next_follow_up || '',
      href: '/collections-floor.html?q=' + (a.status === 'ptp' ? 'over' : 'due'),
    })),
  ];
  return { callbacks: callbacks.length, due: due.length, items };
}

export function alertBanner(box) {
  ensureOpsCss();
  if (!box || (!box.callbacks && !box.due)) return '';
  const t = today();
  const shown = (box.items || []).slice(0, 8);
  const rest = Math.max(0, (box.due || 0) + (box.callbacks || 0) - shown.length);
  const kindLab = { callback: 'Callback', ptp: 'PTP', follow: 'Follow-up' };
  return `<section class="ops-work" aria-label="Work due">
    <header class="ops-work-head">
      <div class="ops-work-chips">
        <a class="ops-chip ${box.callbacks ? '' : 'quiet'}" href="/call-centre.html?pane=missed">
          <b>${box.callbacks}</b><span>inbound callback${box.callbacks === 1 ? '' : 's'}</span>
        </a>
        <a class="ops-chip ${box.due ? 'hot' : 'quiet'}" href="/collections-floor.html">
          <b>${box.due}</b><span>Easybuy follow-up${box.due === 1 ? '' : 's'} due</span>
        </a>
      </div>
      <a class="ops-work-all" href="/collections-floor.html">Open floor</a>
    </header>
    ${shown.length ? `<ul class="ops-work-list">${shown.map((i) => {
      const late = i.when && String(i.when).slice(0, 10) < t;
      return `<li><a class="ops-work-row" href="${esc(i.href)}">
        <span class="ops-av">${esc(initials(i.title))}</span>
        <span class="ops-work-name">${esc(i.title || '')}</span>
        <span class="ops-work-phone">${esc(i.detail || '—')}</span>
        <span class="ops-work-when${late ? ' late' : ''}">${esc(shortDate(i.when))}</span>
        <span class="ops-tag ops-tag-${esc(i.kind)}">${esc(kindLab[i.kind] || i.kind)}</span>
      </a></li>`;
    }).join('')}</ul>` : ''}
    ${rest ? `<a class="ops-work-more" href="/collections-floor.html">${rest} more on the floor</a>` : ''}
  </section>`;
}
