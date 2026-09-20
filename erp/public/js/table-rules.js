import { registerClickGuard, PRIORITY } from './click-router.js';
/** Desk tables: in-place, scoped, safe fetch. No navigation. */
import { getAuthSession, safeFetch } from './supabaseClient.js';
import { loadRows, readLs } from './ls-rows.js';
import { filterBySidebar, SCOPE_EVENT } from './scope.js';
import { specKeyFromPath } from './nav-spec.js';

export async function waitAuth() {
  try { await getAuthSession(); } catch { /* local books still work */ }
}

export async function loadDeskRows(table, key, seed = []) {
  await waitAuth();
  let rows = [];
  try { rows = await loadRows(table, key, seed); } catch { rows = readLs(key, seed) || []; }
  if (!rows.length) {
    try { rows = await safeFetch(table); } catch { rows = []; }
  }
  return filterBySidebar(rows || []);
}

export function setPageContext() {
  const file = (location.pathname.split('/').pop() || 'desk').replace('.html', '');
  const tab = new URLSearchParams(location.search).get('tab') || 'index';
  window.currentContext = `${specKeyFromPath() || 'desk'}.${file}.${tab}`;
  return window.currentContext;
}

export function tableStateHtml(kind, msg) {
  if (kind === 'load') return '<p class="tbl-state">Loading data…</p>';
  if (kind === 'err') return `<p class="tbl-state tbl-err">${msg || 'Unable to load data. Try again.'}</p>`;
  return `<p class="tbl-state">${msg || 'No results match your filters.'}</p>`;
}

const paints = new Set();
export function bindScopePaint(paint) {
  if (typeof paint !== 'function') return;
  paints.add(paint);
  window.__dfPaint = paint;
  if (!window.__dfTableRulesPaint) {
    window.__dfTableRulesPaint = true;
    const run = () => {
      if (run.q) return;
      run.q = requestAnimationFrame(() => {
        run.q = 0;
        import('./scope.js').then((m) => m.wirePageFilters()).catch(() => {});
        paints.forEach((fn) => { try { fn(); } catch { /* stay */ } });
      });
    };
    window.addEventListener(SCOPE_EVENT, run);
    window.addEventListener('df-tab', run);
  }
}


export function wrapPageTables() {
  document.querySelectorAll('table.ult-table, table.erp-table, .ult-main table').forEach((tbl) => {
    if (tbl.closest('.ult-table-wrap, .table-wrapper')) {
      tbl.closest('.ult-table-wrap, .table-wrapper').classList.add('table-wrapper', 'ult-table-wrap');
      return;
    }
    const w = document.createElement('div');
    w.className = 'ult-table-wrap table-wrapper';
    tbl.parentNode.insertBefore(w, tbl);
    w.appendChild(tbl);
  });
}

export function mountTableRules() {
  setPageContext();
  wrapPageTables();
  if (document.documentElement.dataset.tableRules === '1') return;
  document.documentElement.dataset.tableRules = '1';
  const refresh = () => {
    wrapPageTables();
    import('./scope.js').then((m) => m.wirePageFilters()).catch(() => {});
    import('./home-tables.js').then((m) => m.initGlobalHScroll?.()).catch(() => {});
  };
  window.addEventListener('df-tab', refresh);
  window.addEventListener(SCOPE_EVENT, refresh);
  import('./home-tables.js').then((m) => m.initGlobalHScroll?.()).catch(() => {});
  if (!document.getElementById('table-rules-css')) {
    const s = document.createElement('style');
    s.id = 'table-rules-css';
    s.textContent = `.tbl-state{margin:16px 4px;color:#334155;font-weight:650}
      .tbl-err{color:#b91c1c}`;
    document.head.appendChild(s);
  }
  /* Opens a cross-page link inside a table as a context table instead of
     navigating. Registered below the tab, record and lock guards so it can no
     longer answer a click meant for a form — and it now only fires when
     openContextTable actually exists, rather than cancelling the click and
     doing nothing. */
  registerClickGuard({
    name: 'table-context',
    priority: PRIORITY.table,
    match: (origin) => origin?.closest?.('table a[href]'),
    claim: (a) => {
      const href = a.getAttribute('href') || '';
      if (!href || href === '#' || href.startsWith('javascript:')) return 'pass';
      if (a.hasAttribute('data-act') || a.closest('[data-act]')) return 'pass';
      if (a.hasAttribute('data-no-context') || a.closest('[data-no-context]')) return 'pass';
      if (!window.openContextTable) return 'pass';
      try {
        const u = new URL(href, location.origin);
        if (u.pathname === location.pathname) return 'pass';
        /* A link carrying a record id is a record link: record-view (priority
           70) opens it as a card over this page. This guard is for links to a
           collection, which become a context table. */
        if (u.searchParams.get('id') || /-form\.html$|-view\.html$|-edit\.html$/.test(u.pathname)) return 'pass';
        const file = (u.pathname.split('/').pop() || '').replace('.html', '');
        window.openContextTable(file.replace(/-/g, '_'), a.textContent.trim() || file);
        return 'claim';
      } catch { return 'pass'; }
    },
  });
}

export { safeFetch };
